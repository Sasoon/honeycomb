// ENABLE dictionary (~173k words) and blacklist are loaded lazily/dynamically to avoid inflating bundle size
// The JSON files should be generated in build step or checked in to src/lib
// enable1.json   : { "word": 1, ... }
// offensive_words.json : [ "word1", "word2", ... ]

// Cache to store validated words for performance (limit size to avoid memory issues)
const validWordCache = new Map<string, boolean>();
const MAX_CACHE_SIZE = 1000;

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
        this.dictionaryPromise = Promise.all([
            import('./enable1.json'),
            import('./offensive_words.json')
        ]).then(([dictModule, blModule]) => {
            this.dictionary = dictModule.default as Dictionary;
            const blList = blModule.default as unknown as string[];
            this.blacklist = new Set(blList.map(w => w.toLowerCase()));
            if (import.meta.env.DEV) {
                console.log(`ENABLE dictionary loaded (${Object.keys(this.dictionary).length}) with blacklist (${this.blacklist.size})`);
            }
            this.isLoading = false;
            this._isReady = true;
        }).catch(err => {
            console.error('Error loading dictionary/blacklist', err);
            this.isLoading = false;
        });

        return this.dictionaryPromise;
    }

    private addToCache(word: string, isValid: boolean): void {
        if (validWordCache.size >= MAX_CACHE_SIZE) {
            const keysToDelete = Array.from(validWordCache.keys()).slice(0, MAX_CACHE_SIZE / 5);
            keysToDelete.forEach(key => validWordCache.delete(key));
        }
        validWordCache.set(word, isValid);
    }

    isValidWord(word: string): boolean {
        if (!word || word.length < 3) return false;

        const normalized = word.toLowerCase();
        if (validWordCache.has(normalized)) return validWordCache.get(normalized)!;
        if (this.worker) return false;

        if (this.dictionary && this.blacklist) {
            const isValid = (normalized in this.dictionary) && !this.blacklist.has(normalized);
            this.addToCache(normalized, isValid);
            return isValid;
        }

        if (!this.isLoading) {
            this.loadDictionaryIfNeeded().then(() => {
                if (import.meta.env.DEV) {
                    console.log(`Dictionary loaded, "${normalized}" can now be validated`);
                }
            });
        }
        return false;
    }

    async validateWordAsync(word: string): Promise<boolean> {
        if (!word || word.length < 3) return false;
        const normalized = word.toLowerCase();
        if (validWordCache.has(normalized)) return validWordCache.get(normalized)!;

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