// Dictionary Web Worker
// Loads the large JSON from public folder at runtime to avoid build memory issues

type Dictionary = Record<string, number>;

// Global state for loaded dictionaries
let dictionary: Dictionary | null = null;
let blacklist: Set<string> | null = null;
let loadingPromise: Promise<void> | null = null;

async function loadDictionaries(): Promise<void> {
    if (loadingPromise) return loadingPromise;
    
    loadingPromise = (async () => {
        try {
            // Fetch dictionaries from public folder
            const [dictResponse, blacklistResponse] = await Promise.all([
                fetch('/dictionary.json'),
                fetch('/offensive_words.json')
            ]);
            
            if (!dictResponse.ok || !blacklistResponse.ok) {
                throw new Error('Failed to fetch dictionary files');
            }
            
            const [dictData, blacklistData] = await Promise.all([
                dictResponse.json(),
                blacklistResponse.json()
            ]);
            
            // Convert dictionary to normalized format
            dictionary = {};
            if (dictData && typeof dictData === 'object') {
                for (const key of Object.keys(dictData)) {
                    dictionary[key.toLowerCase()] = 1;
                }
            }
            
            // Convert blacklist to Set
            blacklist = new Set<string>();
            if (Array.isArray(blacklistData)) {
                for (const word of blacklistData) {
                    if (typeof word === 'string') {
                        blacklist.add(word.toLowerCase());
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load dictionaries:', error);
            dictionary = {};
            blacklist = new Set();
        }
    })();
    
    return loadingPromise;
}

// Prefix index for suggestions - built after dictionary loads
let prefixIndex: Map<string, string[]> | null = null;

function buildPrefixIndex(): void {
    if (!dictionary || prefixIndex) return;
    
    prefixIndex = new Map<string, string[]>();
    for (const w of Object.keys(dictionary)) {
        if (w.length < 3) continue;
        const key = w.slice(0, 2);
        if (!prefixIndex.has(key)) prefixIndex.set(key, []);
        const arr = prefixIndex.get(key)!;
        if (arr.length < 500) arr.push(w); // cap per-bucket to bound memory
    }
    
    // Guard console in prod builds
    const __DEV__ = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
    if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log(`[DictionaryWorker] Loaded ${Object.keys(dictionary).length.toLocaleString()} words`);
    }
}

interface BaseMessage {
    id: number;
    type: 'preload' | 'validate' | 'suggestions';
}

interface ValidateMessage extends BaseMessage {
    type: 'validate';
    word: string;
}

interface SuggestionsMessage extends BaseMessage {
    type: 'suggestions';
    prefix: string;
    limit?: number;
}

self.addEventListener('message', async (event: MessageEvent<BaseMessage | ValidateMessage | SuggestionsMessage>) => {
    const msg = event.data;

    if (!msg || typeof msg !== 'object' || typeof (msg as any).type !== 'string') return;

    switch (msg.type) {
        case 'preload': {
            try {
                await loadDictionaries();
                buildPrefixIndex();
                (self as unknown as Worker).postMessage({ id: msg.id, type: 'preload', ready: true });
            } catch (error) {
                (self as unknown as Worker).postMessage({ id: msg.id, type: 'preload', ready: false, error: error instanceof Error ? error.message : 'Failed to load' });
            }
            break;
        }
        case 'validate': {
            const { id, word } = msg as ValidateMessage;
            const normalized = (word || '').toLowerCase();
            
            try {
                await loadDictionaries();
                const isValid = !!normalized && 
                               normalized.length >= 3 && 
                               dictionary && 
                               (normalized in dictionary) && 
                               blacklist && 
                               !blacklist.has(normalized);
                (self as unknown as Worker).postMessage({ id, type: 'validate', isValid });
            } catch (error) {
                (self as unknown as Worker).postMessage({ id, type: 'validate', isValid: false });
            }
            break;
        }
        case 'suggestions': {
            const { id, prefix, limit = 5 } = msg as SuggestionsMessage;
            const normalizedPrefix = (prefix || '').toLowerCase();
            
            if (!normalizedPrefix || normalizedPrefix.length < 2) {
                (self as unknown as Worker).postMessage({ id, type: 'suggestions', suggestions: [] });
                break;
            }
            
            try {
                await loadDictionaries();
                buildPrefixIndex();
                
                let candidates: string[] = [];
                if (prefixIndex) {
                    const bucket = prefixIndex.get(normalizedPrefix.slice(0, 2));
                    if (bucket && bucket.length) {
                        for (let i = 0; i < bucket.length && candidates.length < limit; i++) {
                            const w = bucket[i];
                            if (w.startsWith(normalizedPrefix) && blacklist && !blacklist.has(w)) {
                                candidates.push(w);
                            }
                        }
                    } else if (dictionary) {
                        // Fallback: scan dictionary keys but break early
                        for (const w of Object.keys(dictionary)) {
                            if (w.startsWith(normalizedPrefix) && blacklist && !blacklist.has(w)) {
                                candidates.push(w);
                                if (candidates.length >= limit) break;
                            }
                        }
                    }
                }
                (self as unknown as Worker).postMessage({ id, type: 'suggestions', suggestions: candidates.slice(0, limit) });
            } catch (error) {
                (self as unknown as Worker).postMessage({ id, type: 'suggestions', suggestions: [] });
            }
            break;
        }
    }
}); 