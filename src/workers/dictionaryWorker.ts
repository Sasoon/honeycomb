// Dictionary Web Worker
// Loads the large JSON off the main thread and responds to queries

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON imports are handled by Vite
import wordsSmall from '../lib/enable1.json';
// @ts-ignore
import blacklistArr from '../lib/offensive_words.json';
// @ts-ignore
import wordsLarge from '../lib/words_dictionary.json';

type Dictionary = Record<string, number>;

function toDictionary(raw: any): Dictionary {
    const dict: Dictionary = {};
    if (Array.isArray(raw)) {
        for (const w of raw) if (typeof w === 'string') dict[w.toLowerCase()] = 1;
    } else if (raw && typeof raw === 'object') {
        for (const k of Object.keys(raw)) dict[k.toLowerCase()] = 1;
    }
    return dict;
}

// Prefer large dictionary; fallback to small
const dictionary: Dictionary = Object.keys(wordsLarge || {}).length > 0 ? toDictionary(wordsLarge) : toDictionary(wordsSmall);
const blacklist = new Set<string>((blacklistArr as unknown as string[]).map(w => w.toLowerCase()));

// Performance optimization: Pre-compute word count for logging
const WORD_COUNT = Object.keys(dictionary).length;
// Guard console in prod builds
declare const importMetaEnvDev: boolean | undefined;
// @ts-ignore
const __DEV__ = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[DictionaryWorker] Loaded ${WORD_COUNT.toLocaleString()} words`);
}

// Build a small prefix index (first 2 letters)
const prefixIndex = new Map<string, string[]>();
for (const w of Object.keys(dictionary)) {
    if (w.length < 3) continue;
    const key = w.slice(0, 2);
    if (!prefixIndex.has(key)) prefixIndex.set(key, []);
    const arr = prefixIndex.get(key)!;
    if (arr.length < 500) arr.push(w); // cap per-bucket to bound memory
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

self.addEventListener('message', (event: MessageEvent<BaseMessage | ValidateMessage | SuggestionsMessage>) => {
    const msg = event.data;

    if (!msg || typeof msg !== 'object' || typeof (msg as any).type !== 'string') return;

    switch (msg.type) {
        case 'preload': {
            // Simply acknowledge readiness
            (self as unknown as Worker).postMessage({ id: msg.id, type: 'preload', ready: true });
            break;
        }
        case 'validate': {
            const { id, word } = msg as ValidateMessage;
            const normalized = (word || '').toLowerCase();
            const isValid = !!normalized && normalized.length >= 3 && (normalized in dictionary) && !blacklist.has(normalized);
            (self as unknown as Worker).postMessage({ id, type: 'validate', isValid });
            break;
        }
        case 'suggestions': {
            const { id, prefix, limit = 5 } = msg as SuggestionsMessage;
            const normalizedPrefix = (prefix || '').toLowerCase();
            if (!normalizedPrefix || normalizedPrefix.length < 2) {
                (self as unknown as Worker).postMessage({ id, type: 'suggestions', suggestions: [] });
                break;
            }
            let candidates: string[] = [];
            const bucket = prefixIndex.get(normalizedPrefix.slice(0, 2));
            if (bucket && bucket.length) {
                for (let i = 0; i < bucket.length && candidates.length < limit; i++) {
                    const w = bucket[i];
                    if (w.startsWith(normalizedPrefix) && !blacklist.has(w)) candidates.push(w);
                }
            } else {
                // Fallback: scan dictionary keys but break early
                for (const w of Object.keys(dictionary)) {
                    if (w.startsWith(normalizedPrefix) && !blacklist.has(w)) {
                        candidates.push(w);
                        if (candidates.length >= limit) break;
                    }
                }
            }
            (self as unknown as Worker).postMessage({ id, type: 'suggestions', suggestions: candidates.slice(0, limit) });
            break;
        }
    }
}); 