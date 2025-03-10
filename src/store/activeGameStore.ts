import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HexCell } from '../components/HexGrid';
import { LetterTile } from '../components/PlayerHand';

// Define a word history entry for tracking scored words
export interface WordHistoryEntry {
    word: string;
    score: number;
    turn: number;
    pathKey: string;
}

// Define the active game state interface
interface ActiveGameState {
    // Basic game state
    gameInitialized: boolean;
    isGameActive: boolean;
    grid: HexCell[];
    gridSize: number;
    letterBag: LetterTile[];
    playerHand: LetterTile[];
    selectedHandTile: LetterTile | null;
    currentWord: string;
    wordPath: HexCell[];
    score: number;
    turns: number;
    isPlacementPhase: boolean;
    placedTilesThisTurn: HexCell[];
    scoredWords: string[];
    wordHistory: WordHistoryEntry[];
    reshuffleCost: number;
    cursedWord: string;
    cursedWordHint: string;

    // Actions
    setGameState: (state: Partial<ActiveGameState>) => void;
    resetGame: () => void;
}

// Add batching mechanism to prevent infinite update loops
let updateScheduled = false;
const batchedUpdates = (updateFn: () => void) => {
    if (!updateScheduled) {
        updateScheduled = true;
        requestAnimationFrame(() => {
            updateFn();
            updateScheduled = false;
        });
    }
};

// Helper to create a serializable version of game state for storage
const createStorageState = (state: Partial<ActiveGameState>): Partial<ActiveGameState> => {
    // Create a shallow copy to avoid circular references
    const storageState = { ...state };

    // Remove functions (which can't be serialized)
    delete storageState.setGameState;
    delete storageState.resetGame;

    return storageState;
};

// Create the active game store with persistence
export const useActiveGameStore = create<ActiveGameState>()(
    persist(
        (set) => ({
            // Default state
            gameInitialized: false,
            isGameActive: false,
            grid: [],
            gridSize: 5,
            letterBag: [],
            playerHand: [],
            selectedHandTile: null,
            currentWord: '',
            wordPath: [],
            score: 0,
            turns: 0,
            isPlacementPhase: true,
            placedTilesThisTurn: [],
            scoredWords: [],
            wordHistory: [],
            reshuffleCost: 2,
            cursedWord: 'HONEY',
            cursedWordHint: 'H _ _ _ _',

            // Actions with batching
            setGameState: (state) => batchedUpdates(() => set((currentState) => ({
                ...currentState,
                ...state,
                isGameActive: true
            }))),

            resetGame: () => batchedUpdates(() => set({
                gameInitialized: false,
                isGameActive: false,
                grid: [],
                letterBag: [],
                playerHand: [],
                selectedHandTile: null,
                currentWord: '',
                wordPath: [],
                score: 0,
                turns: 0,
                isPlacementPhase: true,
                placedTilesThisTurn: [],
                scoredWords: [],
                wordHistory: [],
                reshuffleCost: 2,
                cursedWord: 'HONEY',
                cursedWordHint: 'H _ _ _ _'
            }))
        }),
        {
            name: 'honeycomb-game',
            // Optimize storage by removing circular references
            partialize: (state) => createStorageState(state),
            // Add version to handle schema changes
            version: 1
        }
    )
); 