import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HexCell } from '../components/HexGrid';
import { generateInitialGrid } from '../lib/gameUtils';
import { generateDropLettersSmart, generateStartingPowerCards, areCellsAdjacent, applyFallingTiles, clearTilesAndApplyGravity, calculateTetrisScore, checkPowerCardRewards, generateRandomLetter, checkTetrisGameOver } from '../lib/tetrisGameUtils';
import { haptics } from '../lib/haptics';
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
export type GamePhase = 'flood' | 'player' | 'gameOver' | 'gravitySettle';

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
    gravityMoves?: Map<string, string>; // Optional map of post-score moves (to -> from)
    floodPaths?: Record<string, string[]>; // Paths for flood tile animations
    tilesHiddenForAnimation?: string[]; // Tiles that should be hidden during animation
    // Free utility actions
    freeMoveAvailable?: boolean;
    freeOrbitsAvailable?: number; // Changed from boolean to number (2 per turn)
    
    // Lock mode state
    lockMode?: boolean; // Whether lock mode is active
    lockedTiles?: string[]; // Array of locked tile IDs

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
    startPlayerPhase: () => void;
    endRound: () => void;
    endPlayerPhase: () => void;

    // Player actions
    selectTile: (cellId: string) => void;
    deselectTile: (cellId: string) => void;
    clearSelection: () => void;
    submitWord: () => Promise<void>;

    // New minimal actions for one-action-per-turn
    moveTileOneStep: (sourceCellId: string, targetCellId: string) => void;
    orbitPivot: (pivotCellId: string, direction?: 'cw' | 'ccw') => void;

    // Power card actions
    activatePowerCard: (cardId: string) => void;
    cancelPowerCard: () => void;

    // Lock mode actions
    toggleLockMode: () => void;
    toggleTileLock: (cellId: string) => void;

    // Utility
    checkGameOver: () => boolean;
}

// Initial state
const initialState: Omit<TetrisGameState,
    'setGameState' | 'initializeGame' | 'resetGame' |
    'startPlayerPhase' | 'endRound' | 'endPlayerPhase' |
    'selectTile' | 'deselectTile' | 'clearSelection' | 'submitWord' | 'moveTileOneStep' | 'orbitPivot' |
    'activatePowerCard' | 'cancelPowerCard' | 'toggleLockMode' | 'toggleTileLock' | 'checkGameOver'
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
    tilesHiddenForAnimation: [],
    lockMode: false,
    lockedTiles: [],

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

                // Cap initial letters to bottom 2 rows width
                const bottomTwoRowCapacity = initialGrid.filter(c => c.position.row >= gridSize - 2).length;
                const initialLetterCount = Math.min(bottomTwoRowCapacity, 5);
                const initialLetters: string[] = [];
                for (let i = 0; i < initialLetterCount; i++) {
                    initialLetters.push(generateRandomLetter());
                }

                // First settle any pre-placed tiles to the bottom
                const { newGrid: settledGrid } = clearTilesAndApplyGravity(initialGrid, []);

                // Apply the initial letters as if they were falling from the top
                // This ensures they end up at the bottom with proper physics
                const result = applyFallingTiles(settledGrid, initialLetters, gridSize);
                const tilesWithLetters = result.newGrid;

                const startingPowerCards = generateStartingPowerCards();

                // Generate first drop preview (starts at 3 tiles for round 1)
                const initialTilesPerDrop = 3;
                const firstDrop = generateDropLettersSmart(initialTilesPerDrop, tilesWithLetters, false);
                const secondDrop = generateDropLettersSmart(initialTilesPerDrop, tilesWithLetters, false);

                set({
                    gameInitialized: true,
                    phase: 'player',
                    round: 1,
                    score: 0,
                    grid: tilesWithLetters,
                    gridSize: gridSize,
                    powerCards: startingPowerCards,
                    nextRows: [firstDrop, secondDrop],
                    tilesPerDrop: initialTilesPerDrop,
                    selectedTiles: [],
                    currentWord: '',
                    wordsThisRound: [],
                    freeMoveAvailable: false,
                    freeOrbitsAvailable: 2, // 2 orbits per turn
                    lockMode: false,
                    lockedTiles: [],
                });
            },

            resetGame: () => {
                set({
                    ...initialState,
                    gameInitialized: true,
                });
            },

            startPlayerPhase: () => {
                console.log('[STORE] Starting player phase with 2 orbits');
                set({
                    phase: 'player',
                    selectedTiles: [],
                    currentWord: '',
                    freeMoveAvailable: false,
                    freeOrbitsAvailable: 2, // Reset to 2 orbits per turn
                    // Note: lockMode and lockedTiles are cleared at endRound start
                    tilesHiddenForAnimation: [],
                });
            },

            endPlayerPhase: () => {
                const state = get();
                if (state.phase !== 'player') return;
                // Advance to flood for this turn
                get().endRound();
            },

            endRound: () => {
                const state = get();
                const newRound = state.round + 1;

                // Clear lock mode and locked tiles immediately before flood starts
                // This ensures visual indicators disappear before flood animation
                set({
                    lockMode: false,
                    lockedTiles: [],
                });

                // Progressive difficulty: +1 tile every 4 rounds (balanced for new lock/orbit powers)
                let currentTilesPerDrop = 3;
                if (newRound >= 12) {
                    currentTilesPerDrop = 6; // Cap at 6 tiles
                } else if (newRound >= 8) {
                    currentTilesPerDrop = 5; // Round 8-11: 5 tiles
                } else if (newRound >= 4) {
                    currentTilesPerDrop = 4; // Round 4-7: 4 tiles  
                }
                // Round 1-3: 3 tiles (default)
                
                console.log(`[STORE] Round ${newRound}: ${currentTilesPerDrop} tiles per drop`);

                // Generate flood tiles for this round
                const rewardCreative = (!state.freeMoveAvailable) || ((state.freeOrbitsAvailable || 0) <= 0);
                const fallingLetters = state.nextRows[0] || generateDropLettersSmart(currentTilesPerDrop, state.grid, rewardCreative);

                // Ensure we have exactly 3 tiles
                let actualFallingLetters = fallingLetters;
                if (fallingLetters.length < currentTilesPerDrop) {
                    const additionalTiles = generateDropLettersSmart(currentTilesPerDrop - fallingLetters.length, state.grid, rewardCreative);
                    actualFallingLetters = [...fallingLetters, ...additionalTiles];
                } else if (fallingLetters.length > currentTilesPerDrop) {
                    actualFallingLetters = fallingLetters.slice(0, currentTilesPerDrop);
                }

                console.log(`[STORE] Round ${newRound}: Processing ${actualFallingLetters.length} falling tiles (consistent 3 per flood)`);

                // Apply the flood to the grid
                const { newGrid, finalPaths } = applyFallingTiles(state.grid, actualFallingLetters, state.gridSize);

                // Loss detection — only when the top row is fully blocked
                if (checkTetrisGameOver(newGrid)) {
                    const totalCells = newGrid.length;
                    const filledCells = newGrid.filter(c => c.letter && c.isPlaced).length;
                    const words = state.totalWords;
                    const points = state.score;
                    toastService.error(`Game Over — Score: ${points}, Words: ${words}, Board: ${Math.round((filledCells / Math.max(1, totalCells)) * 100)}%`);
                    set({ phase: 'gameOver', grid: newGrid, floodPaths: {}, gravityMoves: undefined, selectedTiles: [], currentWord: '' });
                    return;
                }

                // Generate fresh previews for the upcoming turns using correct tile count
                let nextDrop1 = generateDropLettersSmart(currentTilesPerDrop, newGrid, false);
                const nextDrop2 = generateDropLettersSmart(currentTilesPerDrop, newGrid, false);

                // Set the new state all at once, including hidden tiles for animation
                const newlyPlacedTileIds = newGrid
                    .filter(cell => (cell as HexCell & { placedThisTurn?: boolean }).placedThisTurn)
                    .map(cell => cell.id);

                set({
                    round: newRound,
                    tilesPerDrop: currentTilesPerDrop, // Progressive difficulty
                    phase: 'flood',
                    grid: newGrid,
                    wordsThisRound: [],
                    nextRows: [nextDrop1, nextDrop2],
                    selectedTiles: [],
                    currentWord: '',
                    floodPaths: finalPaths,
                    tilesHiddenForAnimation: newlyPlacedTileIds,
                });
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
                        // If only one tile is selected, auto-switch selection to the newly clicked tile
                        if (state.selectedTiles.length === 1) {
                            const newSelected = [{
                                cellId,
                                letter: cell.letter,
                                position: 0
                            }];
                            set({
                                selectedTiles: newSelected,
                                currentWord: cell.letter,
                                isWordValid: false
                            });
                            return;
                        }
                        // Not adjacent, don't allow extending multi-selection
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
                const { newGrid, tilesCleared, moveSources } = clearTilesAndApplyGravity(state.grid, tilesToClear);

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
                    currentWord: '',
                    gravityMoves: moveSources,
                    phase: moveSources.size > 0 ? 'gravitySettle' : 'flood', // Await animation if moves occurred
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
                haptics.success();

                // If no gravity moves, end the round immediately to trigger flood
                if (moveSources.size === 0) {
                    setTimeout(() => {
                        get().endRound();
                    }, 250);
                }
            },

            // New: move one tile to an adjacent empty cell, then end round
            moveTileOneStep: (_sourceCellId: string, _targetCellId: string) => {
                const state = get();
                if (state.phase !== 'player') return;
                toastService.error('Move power is disabled');
                return;
            },

            // Note: Orbit logic is implemented in TetrisGame.tsx drag handler
            orbitPivot: (pivotCellId: string, direction: 'cw' | 'ccw' = 'cw') => {
                // This function exists for interface compatibility but orbit is handled in UI
                console.log('[ORBIT-STORE] This function is not used - orbit handled in UI');
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

            toggleLockMode: () => {
                const state = get();
                set({
                    lockMode: !state.lockMode
                });
            },

            toggleTileLock: (cellId: string) => {
                const state = get();
                if (!state.lockMode) return; // Only works in lock mode
                
                const cell = state.grid.find(c => c.id === cellId);
                if (!cell || !cell.letter || !cell.isPlaced) return; // Only lock placed tiles
                
                const currentLocked = Array.isArray(state.lockedTiles) ? state.lockedTiles : [];
                let newLockedTiles: string[];
                
                if (currentLocked.includes(cellId)) {
                    newLockedTiles = currentLocked.filter(id => id !== cellId);
                    toastService.success('Tile unlocked');
                } else {
                    newLockedTiles = [...currentLocked, cellId];
                    toastService.success('Tile locked');
                }
                
                set({
                    lockedTiles: newLockedTiles
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