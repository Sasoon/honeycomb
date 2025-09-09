// ENABLE dictionary (~173k words) and blacklist are loaded lazily/dynamically to avoid inflating bundle size
// The JSON files should be generated in build step or checked in to src/lib
// enable1.json   : { "word": 1, ... }
// offensive_words.json : [ "word1", "word2", ... ]

// Cache to store validated words for performance (increased for larger dictionary)
const MAX_CACHE_SIZE = 5000;

class LRUCache<K, V> {
    private capacity: number;
    private map: Map<K, { value: V; prev?: K; next?: K }> = new Map();
    private head: K | undefined;
    private tail: K | undefined;

    constructor(capacity: number) {
        this.capacity = Math.max(1, capacity);
    }

    private validateKey(key: K): boolean {
        const node = this.map.get(key);
        if (!node) return false;
        
        // Validate linked list integrity
        if (node.prev !== undefined) {
            const prevNode = this.map.get(node.prev);
            if (!prevNode || prevNode.next !== key) return false;
        }
        if (node.next !== undefined) {
            const nextNode = this.map.get(node.next);
            if (!nextNode || nextNode.prev !== key) return false;
        }
        
        return true;
    }

    get(key: K): V | undefined {
        const node = this.map.get(key);
        if (!node) return undefined;
        // Verify cache integrity before touch
        if (!this.validateKey(key)) return undefined;
        this.touch(key);
        return node.value;
    }

    set(key: K, value: V): void {
        if (this.map.has(key)) {
            const node = this.map.get(key);
            if (node) {
                node.value = value;
                this.touch(key);
            }
            return;
        }
        // Insert at head
        this.map.set(key, { value, prev: undefined, next: this.head });
        if (this.head !== undefined) {
            const h = this.map.get(this.head);
            if (h) h.prev = key;
        }
        this.head = key;
        if (this.tail === undefined) this.tail = key;

        if (this.map.size > this.capacity) this.evict();
    }

    private touch(key: K): void {
        if (this.head === key) return;
        const node = this.map.get(key);
        if (!node) return; // Safe guard

        // detach
        if (node.prev !== undefined) {
            const p = this.map.get(node.prev);
            if (p) p.next = node.next;
        }
        if (node.next !== undefined) {
            const n = this.map.get(node.next);
            if (n) n.prev = node.prev;
        }
        if (this.tail === key) this.tail = node.prev;

        // move to head
        node.prev = undefined;
        node.next = this.head;
        if (this.head !== undefined) {
            const h = this.map.get(this.head);
            if (h) h.prev = key;
        }
        this.head = key;
    }

    private evict(): void {
        if (this.tail === undefined) return;
        const lruKey = this.tail;
        const node = this.map.get(lruKey);
        if (!node) return; // Safe guard
        
        if (node.prev !== undefined) {
            const p = this.map.get(node.prev);
            if (p) p.next = undefined;
        }
        this.tail = node.prev;
        if (this.head === lruKey) this.head = undefined;
        this.map.delete(lruKey);
    }
}

const validWordCache = new LRUCache<string, boolean>(MAX_CACHE_SIZE);

// Define dictionary type
type Dictionary = Record<string, number>;

type WorkerResponse =
    | { id: number; type: 'preload'; ready: boolean }
    | { id: number; type: 'validate'; isValid: boolean }
    | { id: number; type: 'suggestions'; suggestions: string[] };

type PreloadRequest = { type: 'preload' };
type ValidateRequest = { type: 'validate'; word: string };
type SuggestionsRequest = { type: 'suggestions'; prefix: string; limit?: number };

/**
 * Word validator using comprehensive English dictionary
 * Memory-optimized solution for validating English words
 */
class WordValidator {
    private dictionary: Dictionary | null = null;
    private blacklist: Set<string> | null = null;
    private dictionaryPromise: Promise<void> | null = null;
    private usedWords: Set<string>;
    private isLoading = false;
    private _isReady = false;  // New property to track if dictionary is fully loaded

    // Worker fields
    private worker: Worker | null = null;
    private nextRequestId = 1;
    private pending = new Map<number, (msg: WorkerResponse) => void>();

    constructor() {
        this.usedWords = new Set<string>();
        this.initWorker();
    }

    private initWorker() {
        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            this.worker = new Worker(new URL('../workers/dictionaryWorker.ts', import.meta.url), { type: 'module' });
            this.worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
                const data = event.data;
                const resolver = this.pending.get(data.id);
                if (resolver) {
                    this.pending.delete(data.id);
                    resolver(data);
                }
            });
        } catch {
            this.worker = null;
        }
    }

    private postToWorker<TResponse extends WorkerResponse>(payload: PreloadRequest | ValidateRequest | SuggestionsRequest): Promise<TResponse> {
        if (!this.worker) {
            return Promise.reject(new Error('Worker not initialized'));
        }
        const id = this.nextRequestId++;
        return new Promise<TResponse>((resolve) => {
            this.pending.set(id, (msg) => resolve(msg as TResponse));
            (this.worker as Worker).postMessage({ id, ...(payload as any) });
        });
    }

    preloadDictionary(): Promise<void> {
        if (this.worker) {
            return this.postToWorker<{ id: number; type: 'preload'; ready: boolean }>({ type: 'preload' })
                .then(() => { this._isReady = true; });
        }
        return this.loadDictionaryIfNeeded()
            .then(() => {
                this._isReady = true;
                if (import.meta.env.DEV) {
                    // eslint-disable-next-line no-console
                    console.log('Dictionary preloaded and ready');
                }
            });
    }

    get isReady(): boolean {
        return this._isReady;
    }

    private async loadDictionaryIfNeeded(): Promise<void> {
        if (this.dictionary && this.blacklist) return;
        if (this.dictionaryPromise) return this.dictionaryPromise;

        this.isLoading = true;
        this.dictionaryPromise = (async () => {
            try {
                // Fetch dictionaries from public folder (same as worker)
                const [dictResponse, blResponse] = await Promise.all([
                    fetch('/dictionary.json'),
                    fetch('/offensive_words.json')
                ]);
                
                if (!dictResponse.ok || !blResponse.ok) {
                    throw new Error('Failed to fetch dictionary files');
                }

                const [rawDict, blList] = await Promise.all([
                    dictResponse.json(),
                    blResponse.json()
                ]);

                let dict: Dictionary = {};
                if (Array.isArray(rawDict)) {
                    // Array of words
                    for (const w of rawDict) {
                        if (typeof w === 'string' && w.length > 0) dict[w.toLowerCase()] = 1;
                    }
                } else if (rawDict && typeof rawDict === 'object') {
                    // Object map { word: something }
                    for (const key of Object.keys(rawDict)) {
                        dict[key.toLowerCase()] = 1;
                    }
                } else {
                    throw new Error('Unsupported dictionary format');
                }

                this.dictionary = dict;
                this.blacklist = new Set((blList as unknown as string[]).map(w => w.toLowerCase()));
                if (import.meta.env.DEV) {
                    // eslint-disable-next-line no-console
                    console.log(`Dictionary loaded (${Object.keys(this.dictionary).length}) with blacklist (${this.blacklist.size})`);
                }
                this.isLoading = false;
                this._isReady = true;
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('Error loading dictionary/blacklist', err);
                this.isLoading = false;
            }
        })();

        return this.dictionaryPromise;
    }

    private addToCache(word: string, isValid: boolean): void {
        validWordCache.set(word, isValid);
    }

    isValidWord(word: string): boolean {
        if (!word || word.length < 3) return false;

        const normalized = word.toLowerCase();
        {
            const cached = validWordCache.get(normalized);
            if (cached !== undefined) return cached;
        }
        if (this.worker) return false;

        if (this.dictionary && this.blacklist) {
            const isValid = (normalized in this.dictionary) && !this.blacklist.has(normalized);
            this.addToCache(normalized, isValid);
            return isValid;
        }

        if (!this.isLoading) {
            this.loadDictionaryIfNeeded().then(() => {
                if (import.meta.env.DEV) {
                    // eslint-disable-next-line no-console
                    console.log(`Dictionary loaded, "${normalized}" can now be validated`);
                }
            });
        }
        return false;
    }

    async validateWordAsync(word: string): Promise<boolean> {
        if (!word || word.length < 3) return false;
        const normalized = word.toLowerCase();
        {
            const cached = validWordCache.get(normalized);
            if (cached !== undefined) return cached;
        }

        if (this.worker) {
            const res = await this.postToWorker<{ id: number; type: 'validate'; isValid: boolean }>({ type: 'validate', word: normalized });
            this.addToCache(normalized, res.isValid);
            return res.isValid;
        }

        await this.loadDictionaryIfNeeded();
        const isValid = !!this.dictionary && (normalized in this.dictionary) && !this.blacklist!.has(normalized);
        this.addToCache(normalized, isValid);
        return isValid;
    }

    markWordAsUsed(word: string): void {
        const normalized = word.toLowerCase();
        this.usedWords.add(normalized);
    }

    isWordUsed(word: string): boolean {
        const normalized = word.toLowerCase();
        return this.usedWords.has(normalized);
    }

    async getSuggestions(prefix: string, limit: number = 5): Promise<string[]> {
        if (!prefix || prefix.length < 2) return [];
        const normalizedPrefix = prefix.toLowerCase();

        if (this.worker) {
            const res = await this.postToWorker<{ id: number; type: 'suggestions'; suggestions: string[] }>({ type: 'suggestions', prefix: normalizedPrefix, limit });
            return res.suggestions.filter(w => !this.isWordUsed(w)).slice(0, limit);
        }

        await this.loadDictionaryIfNeeded();
        const dictionary = this.dictionary || {};
        // Fallback: filter keys (heavy, but only used if worker failed)
        const suggestions = Object.keys(dictionary)
            .filter(word =>
                word.startsWith(normalizedPrefix) &&
                word.length >= 3 &&
                !this.isWordUsed(word) && !this.blacklist!.has(word)
            )
            .slice(0, limit);
        return suggestions;
    }

    reset(): void {
        this.usedWords.clear();
    }
}

export const wordValidator = new WordValidator();

export function scheduleDictionaryPreload() {
    const run = () => wordValidator.preloadDictionary().catch(() => { });
    const w = typeof window !== 'undefined' ? (window as unknown as { requestIdleCallback?: (cb: () => void) => number }) : undefined;
    if (w && typeof w.requestIdleCallback === 'function') {
        w.requestIdleCallback(run);
    } else {
        setTimeout(run, 0);
    }
}

export default wordValidator; 