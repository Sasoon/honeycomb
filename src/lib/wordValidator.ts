import wordsDictionary from './words_dictionary.json';

// Cache to store validated words for performance
const validWordCache = new Map<string, boolean>();

/**
 * Word validator using comprehensive English dictionary
 * Production-ready solution for validating English words
 */
class WordValidator {
    private dictionary: Record<string, number>;
    private usedWords: Set<string>;

    constructor() {
        // Type assertion to handle the JSON dictionary format
        this.dictionary = wordsDictionary as Record<string, number>;
        this.usedWords = new Set<string>();
        console.log(`Dictionary loaded with ${Object.keys(this.dictionary).length} words`);
    }

    isValidWord(word: string): boolean {
        if (!word || word.length < 3) return false;

        const normalized = word.toLowerCase();

        // Check cache first for performance
        if (validWordCache.has(normalized)) {
            return validWordCache.get(normalized)!;
        }

        // Check if the word exists in our dictionary
        const isValid = normalized in this.dictionary;
        validWordCache.set(normalized, isValid);
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

    getSuggestions(prefix: string, limit: number = 5): string[] {
        if (!prefix || prefix.length < 2) return [];

        // Find words starting with the given prefix
        const normalizedPrefix = prefix.toLowerCase();
        const suggestions = Object.keys(this.dictionary)
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