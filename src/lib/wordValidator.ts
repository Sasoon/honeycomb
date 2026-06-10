// Word validation against the curated list in public/dictionary.txt
// (one lowercase word per line, 3+ letters, offensive words already
// excluded — see scripts/build-dictionary.mjs).

let words: Set<string> | null = null;
let loadPromise: Promise<Set<string>> | null = null;

function loadDictionary(): Promise<Set<string>> {
    if (!loadPromise) {
        loadPromise = fetch('/dictionary.txt')
            .then(res => {
                if (!res.ok) throw new Error(`dictionary fetch failed: ${res.status}`);
                return res.text();
            })
            .then(text => {
                words = new Set(text.split('\n').map(w => w.trim()).filter(Boolean));
                return words;
            })
            .catch(err => {
                // Clear so the next validation retries the fetch
                loadPromise = null;
                throw err;
            });
    }
    return loadPromise;
}

export const wordValidator = {
    get isReady(): boolean {
        return words !== null;
    },

    preloadDictionary(): Promise<void> {
        return loadDictionary().then(() => undefined);
    },

    async validateWordAsync(word: string): Promise<boolean> {
        if (!word || word.length < 3) return false;
        try {
            const dict = words ?? await loadDictionary();
            return dict.has(word.toLowerCase());
        } catch {
            return false;
        }
    },
};

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
