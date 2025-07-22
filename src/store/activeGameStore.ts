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

// Define action types for tracking purposes
export type ActionType = 'place_tile' | 'use_piston' | 'none';

// Define the structure for storing the last action
export interface UndoableAction {
    type: ActionType;
    prevGrid: HexCell[];
    prevPlayerHand: LetterTile[];
    prevPlacedTilesThisTurn: HexCell[];
    tileUsed?: LetterTile; // Used for piston or placed tile
    pistonSourceCell?: HexCell | null; // Used for piston actions
}

// State for tile placement animation
interface TilePlacementAnimation {
    letter: string;
    sourcePosition: { x: number; y: number };
    targetPosition: { x: number; y: number };
    isAnimating: boolean;
    dimensions?: { width: number; height: number };
    frequency: string;
    tileType?: string;
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

    // Piston mechanics
    isPistonActive: boolean;
    pistonSourceCell: HexCell | null;

    // Undo functionality
    lastAction: UndoableAction | null;
    canUndo: boolean;

    // Animation states
    tilePlacementAnimation: TilePlacementAnimation | null;

    // Actions
    setGameState: (state: Partial<ActiveGameState>) => void;
    resetGame: () => void;
    undoLastAction: () => void;
}

// Initialize game with default settings
const initialState: Omit<ActiveGameState, 'setGameState' | 'resetGame' | 'undoLastAction'> = {
    gameInitialized: false,
    isGameActive: true,
    grid: [],
    gridSize: 5, // Default to 5 rings
    letterBag: [],
    playerHand: [],
    selectedHandTile: null,
    currentWord: '',
    wordPath: [],
    score: 0,
    turns: 1,
    isPlacementPhase: true,
    placedTilesThisTurn: [],
    scoredWords: [],
    wordHistory: [],
    isPistonActive: false,
    pistonSourceCell: null,
    lastAction: null,
    canUndo: false,
    tilePlacementAnimation: null
};

// Create a persisted store for the active game
export const useActiveGameStore = create<ActiveGameState>()(
    persist(
        (set) => ({
            ...initialState,

            // Set partial state
            setGameState: (state: Partial<ActiveGameState>) => set((prev) => ({ ...prev, ...state })),

            // Reset the game state to initial
            resetGame: () => set((state) => ({
                ...initialState,
                gameInitialized: true,
                isGameActive: true,
                grid: state.grid, // Keep the grid structure
                setGameState: state.setGameState,
                resetGame: state.resetGame,
                undoLastAction: state.undoLastAction
            })),

            // Undo the last action if possible
            undoLastAction: () => set((state) => {
                const { lastAction } = state;

                if (!lastAction || !state.canUndo) {
                    return state;
                }

                // Reset isSelected on all tiles in hand
                const resetPlayerHand = lastAction.prevPlayerHand.map(tile => ({
                    ...tile,
                    isSelected: false
                }));

                // Reset any piston-related visual indicators on the grid
                const resetGrid = lastAction.prevGrid.map(cell => ({
                    ...cell,
                    isPistonTarget: false,
                    isAdjacentToPistonSource: false
                }));

                return {
                    ...state,
                    grid: resetGrid,
                    playerHand: resetPlayerHand,
                    placedTilesThisTurn: lastAction.prevPlacedTilesThisTurn,
                    lastAction: null,
                    canUndo: false,
                    pistonSourceCell: null,
                    isPistonActive: false
                };
            })
        }),
        {
            name: 'honeycomb-game-state',
            skipHydration: false, // Changed from true to enable automatic hydration
        }
    )
); 