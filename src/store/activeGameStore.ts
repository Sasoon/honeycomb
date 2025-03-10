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

            // Actions
            setGameState: (state) => set((currentState) => ({
                ...currentState,
                ...state,
                isGameActive: true
            })),

            resetGame: () => set({
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
                cursedWordHint: 'H _ _ _ _',
            })
        }),
        {
            name: 'honeycomb-active-game', // unique name for localStorage
            partialize: (state) => {
                // Only persist these fields
                const {
                    gameInitialized,
                    isGameActive,
                    grid,
                    gridSize,
                    letterBag,
                    playerHand,
                    score,
                    turns,
                    isPlacementPhase,
                    scoredWords,
                    wordHistory,
                    reshuffleCost,
                    cursedWord,
                    cursedWordHint
                } = state;

                return {
                    gameInitialized,
                    isGameActive,
                    grid,
                    gridSize,
                    letterBag,
                    playerHand,
                    score,
                    turns,
                    isPlacementPhase,
                    scoredWords,
                    wordHistory,
                    reshuffleCost,
                    cursedWord,
                    cursedWordHint
                };
            }
        }
    )
); 