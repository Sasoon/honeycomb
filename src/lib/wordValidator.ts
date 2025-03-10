// Instead of eager loading the full dictionary
// import wordsDictionary from './words_dictionary.json';

// Cache to store validated words for performance (limit size to avoid memory issues)
const validWordCache = new Map<string, boolean>();
const MAX_CACHE_SIZE = 1000;

// Define dictionary type
type Dictionary = Record<string, number>;

/**
 * Word validator using comprehensive English dictionary
 * Memory-optimized solution for validating English words
 */
class WordValidator {
    private dictionary: Dictionary | null = null;
    private dictionaryPromise: Promise<Dictionary> | null = null;
    private usedWords: Set<string>;
    private isLoading = false;

    constructor() {
        this.usedWords = new Set<string>();
    }

    /**
     * Lazy load the dictionary only when needed
     */
    private async loadDictionaryIfNeeded(): Promise<Dictionary> {
        if (this.dictionary) {
            return this.dictionary;
        }

        if (this.dictionaryPromise) {
            return this.dictionaryPromise;
        }

        this.isLoading = true;
        this.dictionaryPromise = import('./words_dictionary.json')
            .then(module => {
                this.dictionary = module.default as Dictionary;
                console.log(`Dictionary loaded with ${Object.keys(this.dictionary).length} words`);
                this.isLoading = false;
                return this.dictionary;
            })
            .catch(error => {
                console.error('Error loading dictionary:', error);
                this.isLoading = false;
                return {} as Dictionary;
            });

        return this.dictionaryPromise;
    }

    /**
     * Add word to cache, managing the cache size
     */
    private addToCache(word: string, isValid: boolean): void {
        // If cache is full, remove oldest entries (20% of max size)
        if (validWordCache.size >= MAX_CACHE_SIZE) {
            const keysToDelete = Array.from(validWordCache.keys()).slice(0, MAX_CACHE_SIZE / 5);
            keysToDelete.forEach(key => validWordCache.delete(key));
        }
        validWordCache.set(word, isValid);
    }

    /**
     * Check if a word is valid synchronously (using cache) or asynchronously (using dictionary)
     */
    isValidWord(word: string): boolean {
        if (!word || word.length < 3) return false;

        const normalized = word.toLowerCase();

        // Check cache first for performance
        if (validWordCache.has(normalized)) {
            return validWordCache.get(normalized)!;
        }

        // If dictionary is loaded, check it
        if (this.dictionary) {
            const isValid = normalized in this.dictionary;
            this.addToCache(normalized, isValid);
            return isValid;
        }

        // If dictionary isn't loaded yet, start loading and return false for now
        // (client code will re-validate later)
        if (!this.isLoading) {
            this.loadDictionaryIfNeeded().then(() => {
                // Once loaded, client code can re-check
            });
        }

        // Default to invalid until we know otherwise
        return false;
    }

    /**
     * Validate a word asynchronously, ensuring dictionary is loaded
     */
    async validateWordAsync(word: string): Promise<boolean> {
        if (!word || word.length < 3) return false;

        const normalized = word.toLowerCase();

        // Check cache first
        if (validWordCache.has(normalized)) {
            return validWordCache.get(normalized)!;
        }

        // Ensure dictionary is loaded
        const dictionary = await this.loadDictionaryIfNeeded();
        const isValid = normalized in dictionary;
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

        // Ensure dictionary is loaded
        const dictionary = await this.loadDictionaryIfNeeded();

        // Find words starting with the given prefix
        const normalizedPrefix = prefix.toLowerCase();
        const suggestions = Object.keys(dictionary)
            .filter(word =>
                word.startsWith(normalizedPrefix) &&
                word.length >= 3 &&
                !this.isWordUsed(word)
            )
            .slice(0, limit);

        return suggestions;
    }

    reset(): void {
        this.usedWords.clear();
    }
}

// Export a singleton instance
export const wordValidator = new WordValidator();

export default wordValidator; 