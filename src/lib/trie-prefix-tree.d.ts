declare module 'trie-prefix-tree' {
    interface Trie {
        /**
         * Adds a word to the trie
         */
        addWord(word: string): void;

        /**
         * Adds multiple words to the trie
         */
        addWords(words: string[]): void;

        /**
         * Removes a word from the trie
         */
        removeWord(word: string): void;

        /**
         * Checks if a word exists in the trie
         */
        hasWord(word: string): boolean;

        /**
         * Returns all words in the trie with the given prefix
         */
        getPrefix(prefix: string): string[];

        /**
         * Returns all words in the trie
         */
        getWords(): string[];

        /**
         * Returns the number of words in the trie
         */
        getCount(): number;
    }

    /**
     * Creates a new trie instance
     */
    function createTrie(words?: string[]): Trie;

    export default createTrie;
} 