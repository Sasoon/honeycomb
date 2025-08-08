import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HexCell } from '../components/HexGrid';
import { generateInitialGrid } from '../lib/gameUtils';
import { generateDropLetters, generateStartingPowerCards, areCellsAdjacent, applyFallingTiles, clearTilesAndApplyGravity, calculateTetrisScore, checkPowerCardRewards, generateRandomLetter } from '../lib/tetrisGameUtils';
import wordValidator from '../lib/wordValidator';
import toastService from '../lib/toastService';

// Power card types
export type PowerCardType =
    | 'bomb'      // Clear 3x3 area
    | 'rotate'    // Rotate 3x3 section
    | 'gravity'   // Pull all letters down
    | 'wildcard'  // Turn any tile into any letter
    | 'slow'      // Next 3 drops are smaller
    | 'laser'     // Remove one column
    | 'preview'   // See next 2 rows instead of 1
    | 'excavate'  // Remove any 3 tiles
    | 'transmute' // Change 1 letter
    | 'bridge';   // Connect non-adjacent tiles for one word

export interface PowerCard {
    id: string;
    type: PowerCardType;
    name: string;
    description: string;
}

// Game phases
export type GamePhase = 'flood' | 'player' | 'gameOver';

// Selected tiles for word building
export interface SelectedTile {
    cellId: string;
    letter: string;
    position: number; // Order in which it was selected
}

// Tetris game state
interface TetrisGameState {
    // Core game state
    gameInitialized: boolean;
    phase: GamePhase;
    grid: HexCell[];
    gridSize: number;
    score: number;
    round: number;

    // Falling tiles mechanics
    nextRows: string[][]; // Letters for upcoming rows
    tilesPerDrop: number; // How many tiles drop each round
    dropSpeed: number; // For future real-time mode

    // Player state
    selectedTiles: SelectedTile[];
    currentWord: string;
    isWordValid: boolean;
    powerCards: PowerCard[];
    activePowerCard: PowerCard | null;

    // Game progression
    wordsThisRound: string[];
    totalWords: number;
    tilesCleared: number;
    longestWord: string;
    biggestCombo: number;
    wordsPerTurnLimit: number; // 0 = unlimited, > 0 = limited

    // Special effects
    slowModeRounds: number; // Rounds remaining with slower drops
    previewLevel: number; // 1 = see next row, 2 = see next 2 rows

    // Persistence
    lastSaved: number;

    // Actions
    setGameState: (state: Partial<TetrisGameState>) => void;
    initializeGame: () => void;
    resetGame: () => void;

    // Game flow actions
    startFloodPhase: () => void;
    startPlayerPhase: () => void;
    endRound: () => void;

    // Player actions
    selectTile: (cellId: string) => void;
    deselectTile: (cellId: string) => void;
    clearSelection: () => void;
    submitWord: () => Promise<void>;

    // Power card actions
    activatePowerCard: (cardId: string) => void;
    cancelPowerCard: () => void;

    // Utility
    checkGameOver: () => boolean;
}

// Initial state
const initialState: Omit<TetrisGameState,
    'setGameState' | 'initializeGame' | 'resetGame' |
    'startFloodPhase' | 'startPlayerPhase' | 'endRound' |
    'selectTile' | 'deselectTile' | 'clearSelection' | 'submitWord' |
    'activatePowerCard' | 'cancelPowerCard' | 'checkGameOver'
> = {
    gameInitialized: false,
    phase: 'player',
    grid: [],
    gridSize: 5,
    score: 0,
    round: 1,

    nextRows: [],
    tilesPerDrop: 3,
    dropSpeed: 1000,

    selectedTiles: [],
    currentWord: '',
    isWordValid: false,
    powerCards: [],
    activePowerCard: null,

    wordsThisRound: [],
    totalWords: 0,
    tilesCleared: 0,
    longestWord: '',
    biggestCombo: 0,
    wordsPerTurnLimit: 0, // 0 = unlimited by default

    slowModeRounds: 0,
    previewLevel: 1,

    lastSaved: Date.now(),
};

// Create the Tetris game store
export const useTetrisGameStore = create<TetrisGameState>()(
    persist(
        (set, get) => ({
            ...initialState,

            setGameState: (state) => set((prev) => ({ ...prev, ...state })),

            initializeGame: () => {
                const gridSize = 5; // Default grid size
                const initialGrid = generateInitialGrid(gridSize);

                // Generate initial letters (about 10-12 letters for start)
                const initialLetterCount = 10 + Math.floor(Math.random() * 3);
                const initialLetters: string[] = [];
                for (let i = 0; i < initialLetterCount; i++) {
                    initialLetters.push(generateRandomLetter());
                }

                // Apply the initial letters as if they were falling from the top
                // This ensures they end up at the bottom with proper physics
                const tilesWithLetters = applyFallingTiles(initialGrid, initialLetters, gridSize);

                const startingPowerCards = generateStartingPowerCards();

                // Generate first drop preview
                const firstDrop = generateDropLetters(3, 1);
                const secondDrop = generateDropLetters(3, 1);

                set({
                    gameInitialized: true,
                    phase: 'player',
                    round: 1,
                    score: 0,
                    grid: tilesWithLetters,
                    gridSize: gridSize,
                    powerCards: startingPowerCards,
                    nextRows: [firstDrop, secondDrop],
                    tilesPerDrop: 3,
                    selectedTiles: [],
                    currentWord: '',
                    wordsThisRound: [],
                });
            },

            resetGame: () => {
                set({
                    ...initialState,
                    gameInitialized: true,
                });
            },

            startFloodPhase: () => {
                const state = get();

                // Use the letters from the preview (nextRows[0])
                const fallingLetters = state.nextRows[0] || generateDropLetters(state.tilesPerDrop, state.round);

                if (import.meta.env.DEV) {
                    // eslint-disable-next-line no-console
                    console.log('Starting flood phase with letters:', fallingLetters);
                }

                // Apply the falling tiles to the grid - this includes physics simulation
                const newGrid = applyFallingTiles(state.grid, fallingLetters, state.gridSize);

                // Debug: Check what's in the top row after physics
                const topRowCells = newGrid.filter(cell => cell.position.row === 0);
                const tilesInTopRow = topRowCells.filter(cell => cell.letter && cell.isPlaced);
                if (import.meta.env.DEV) {
                    // eslint-disable-next-line no-console
                    console.log('Top row after physics:', tilesInTopRow.length, 'tiles out of', topRowCells.length);
                }

                // Only check for game over if we couldn't place ANY tiles
                // This happens when the grid is completely full
                const isGameOver = fallingLetters.length > 0 && tilesInTopRow.length === topRowCells.length;

                // Shift the preview rows: use existing nextRows[1] as nextRows[0], generate new nextRows[1]
                const nextDrop1 = state.nextRows[1] || generateDropLetters(state.tilesPerDrop, state.round + 1);
                const nextDrop2 = generateDropLetters(state.tilesPerDrop, state.round + 1);

                set({
                    phase: isGameOver ? 'gameOver' : 'flood',
                    grid: newGrid,
                    wordsThisRound: [],
                    nextRows: [nextDrop1, nextDrop2],
                    selectedTiles: [],
                    currentWord: ''
                });
            },

            startPlayerPhase: () => {
                set({
                    phase: 'player',
                    selectedTiles: [],
                    currentWord: '',
                });
            },

            endRound: () => {
                const state = get();
                const newRound = state.round + 1;

                // Increase difficulty
                const newTilesPerDrop = Math.min(state.tilesPerDrop + Math.floor(newRound / 5), 8);
                const actualTilesPerDrop = state.slowModeRounds > 0 ? Math.max(3, newTilesPerDrop - 2) : newTilesPerDrop;

                set({
                    round: newRound,
                    tilesPerDrop: actualTilesPerDrop,
                    slowModeRounds: Math.max(0, state.slowModeRounds - 1),
                });

                // Move to flood phase
                get().startFloodPhase();
            },

            selectTile: (cellId: string) => {
                const state = get();
                const cell = state.grid.find(c => c.id === cellId);

                if (!cell || !cell.letter || state.phase !== 'player') return;

                // Check if already selected
                const existingIndex = state.selectedTiles.findIndex(t => t.cellId === cellId);
                if (existingIndex !== -1) {
                    // Deselect this tile and all tiles after it
                    const newSelected = state.selectedTiles.slice(0, existingIndex);
                    const newWord = newSelected.map(t => t.letter).join('');

                    set({
                        selectedTiles: newSelected,
                        currentWord: newWord
                    });

                    // Validate word asynchronously
                    if (newWord.length >= 3) {
                        wordValidator.validateWordAsync(newWord).then(isValid => {
                            set({ isWordValid: isValid });
                        });
                    } else {
                        set({ isWordValid: false });
                    }
                    return;
                }

                // For adjacency check (if we have selected tiles)
                if (state.selectedTiles.length > 0) {
                    // Check if adjacent to last selected tile
                    const lastSelectedId = state.selectedTiles[state.selectedTiles.length - 1].cellId;
                    const lastSelectedCell = state.grid.find(c => c.id === lastSelectedId);

                    if (!lastSelectedCell || !areCellsAdjacent(cell, lastSelectedCell)) {
                        // Not adjacent, don't allow selection
                        toastService.error('Must select adjacent tiles!');
                        return;
                    }
                }

                const newSelected = [...state.selectedTiles, {
                    cellId,
                    letter: cell.letter,
                    position: state.selectedTiles.length
                }];

                const newWord = newSelected.map(t => t.letter).join('');

                set({
                    selectedTiles: newSelected,
                    currentWord: newWord
                });

                // Validate word asynchronously
                if (newWord.length >= 3) {
                    wordValidator.validateWordAsync(newWord).then(isValid => {
                        set({ isWordValid: isValid });
                    });
                } else {
                    set({ isWordValid: false });
                }
            },

            deselectTile: (cellId: string) => {
                const state = get();
                const tileIndex = state.selectedTiles.findIndex(t => t.cellId === cellId);

                if (tileIndex === -1) return;

                // Only allow deselecting the last tile
                if (tileIndex === state.selectedTiles.length - 1) {
                    const newSelected = state.selectedTiles.slice(0, -1);
                    const newWord = newSelected.map(t => t.letter).join('');

                    set({
                        selectedTiles: newSelected,
                        currentWord: newWord
                    });

                    // Validate word asynchronously
                    if (newWord.length >= 3) {
                        wordValidator.validateWordAsync(newWord).then(isValid => {
                            set({ isWordValid: isValid });
                        });
                    } else {
                        set({ isWordValid: false });
                    }
                }
            },

            clearSelection: () => {
                set({
                    selectedTiles: [],
                    currentWord: '',
                    isWordValid: false
                });
            },

            submitWord: async () => {
                const state = get();

                if (state.currentWord.length < 3) {
                    toastService.error('Word must be at least 3 letters');
                    return;
                }

                // Validate the word
                const isValid = await wordValidator.validateWordAsync(state.currentWord);

                if (!isValid) {
                    toastService.error('Not a valid word!');
                    return;
                }

                // Check if already scored this round
                if (state.wordsThisRound.includes(state.currentWord)) {
                    toastService.error('Already used this word!');
                    return;
                }

                // Calculate board fullness
                const totalCells = state.grid.length;
                const filledCells = state.grid.filter(cell => cell.letter && cell.isPlaced).length;
                const boardFullness = filledCells / totalCells;

                // Dynamic word limit: 1 normally, 2 if board is >50% full
                const wordLimit = boardFullness > 0.5 ? 2 : 1;

                if (state.wordsThisRound.length >= wordLimit) {
                    if (wordLimit === 1) {
                        toastService.error(`Only 1 word allowed per turn!`);
                    } else {
                        toastService.error(`Board is over 50% full - maximum 2 words allowed!`);
                    }
                    return;
                }

                // Clear the tiles and apply gravity
                const tilesToClear = state.selectedTiles.map(t => t.cellId);
                const { newGrid, tilesCleared } = clearTilesAndApplyGravity(state.grid, tilesToClear);

                // Calculate score
                const baseScore = state.currentWord.length;
                const isCombo = state.wordsThisRound.length > 0; // Simple combo: any word after the first
                const wordScore = calculateTetrisScore(baseScore, state.round, tilesCleared, isCombo);

                // Check for power card rewards
                const newPowerCard = checkPowerCardRewards(
                    state.currentWord.length,
                    tilesCleared,
                    state.wordsThisRound.length + 1
                );

                // Update state
                const updates: Partial<TetrisGameState> = {
                    grid: newGrid,
                    wordsThisRound: [...state.wordsThisRound, state.currentWord],
                    totalWords: state.totalWords + 1,
                    score: state.score + wordScore,
                    tilesCleared: state.tilesCleared + tilesCleared,
                    selectedTiles: [],
                    currentWord: ''
                };

                // Add power card if earned
                if (newPowerCard) {
                    updates.powerCards = [...state.powerCards, newPowerCard];
                    toastService.success(`Earned ${newPowerCard.name}!`);
                }

                // Update longest word
                if (state.currentWord.length > state.longestWord.length) {
                    updates.longestWord = state.currentWord;
                }

                set(updates);
                toastService.success(`+${wordScore} points!`);

                // Automatically end the player's turn and transition to flood phase (defer to next tick to sync UI)
                setTimeout(() => {
                    get().endRound();
                }, 250);
            },

            activatePowerCard: (cardId: string) => {
                const state = get();
                const card = state.powerCards.find(c => c.id === cardId);

                if (!card) return;

                set({
                    activePowerCard: card
                });
            },

            cancelPowerCard: () => {
                set({
                    activePowerCard: null
                });
            },

            checkGameOver: () => {
                // Check if top row has any tiles
                // TODO: Implement based on grid structure
                return false;
            }
        }),
        {
            name: 'honeycomb-tetris-game',
            skipHydration: false,
        }
    )
); 