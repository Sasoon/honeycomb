import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HexCell } from '../components/HexGrid';
import { generateInitialGrid } from '../lib/gameUtils';
import { generateDropLettersSmart, generateStartingPowerCards, areCellsAdjacent, applyFallingTiles, clearTilesAndApplyGravity, calculateTetrisScore, checkPowerCardRewards, generateRandomLetter, placeStartingTiles } from '../lib/tetrisGameUtils';
import { haptics } from '../lib/haptics';
import wordValidator from '../lib/wordValidator';
import toastService from '../lib/toastService';
import { createSeededRNG, SeededRNG } from '../lib/seededRNG';

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

    // Daily Challenge mode
    isDailyChallenge: boolean;
    dailySeed?: number;
    dailyDate?: string;
    challengeStartTime?: number;
    seededRNG?: SeededRNG;

    // Persistence
    lastSaved: number;

    // Actions
    setGameState: (state: Partial<TetrisGameState>) => void;
    initializeGame: () => void;
    initializeDailyChallenge: (seed: number, gameState: any, date: string) => void;
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
    toggleTileLock: (cellId: string) => void;

    // Utility
    checkGameOver: () => boolean;
}

// Initial state
const initialState: Omit<TetrisGameState,
    'setGameState' | 'initializeGame' | 'initializeDailyChallenge' | 'resetGame' |
    'startPlayerPhase' | 'endRound' | 'endPlayerPhase' |
    'selectTile' | 'deselectTile' | 'clearSelection' | 'submitWord' | 'moveTileOneStep' | 'orbitPivot' |
    'activatePowerCard' | 'cancelPowerCard' | 'toggleTileLock' | 'checkGameOver'
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

    // Daily Challenge mode
    isDailyChallenge: false,

    lastSaved: Date.now(),
};

// Create the Tetris game store
export const useTetrisGameStore = create<TetrisGameState>()(
    persist(
        (set, get) => ({
            ...initialState,

            setGameState: (state) => set((prev) => ({ ...prev, ...state })),

            initializeGame: () => {
                const state = get();
                const gridSize = 5; // Default grid size
                const initialGrid = generateInitialGrid(gridSize);

                // Cap initial letters to bottom 2 rows width
                const bottomTwoRowCapacity = initialGrid.filter(c => c.position.row >= gridSize - 2).length;
                const initialLetterCount = Math.min(bottomTwoRowCapacity, 5);
                const initialLetters: string[] = [];
                for (let i = 0; i < initialLetterCount; i++) {
                    initialLetters.push(generateRandomLetter());
                }

                // Place starting tiles with simple gravity (not flood logic)
                // This ensures they always end up at the bottom
                const tilesWithLetters = placeStartingTiles(initialGrid, initialLetters, gridSize);

                const startingPowerCards = generateStartingPowerCards();

                // Generate first drop preview (starts at 3 tiles for round 1)
                const initialTilesPerDrop = 3;
                const firstDrop = generateDropLettersSmart(initialTilesPerDrop, tilesWithLetters, false, state.seededRNG);
                const secondDrop = generateDropLettersSmart(initialTilesPerDrop, tilesWithLetters, false, state.seededRNG);

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

            initializeDailyChallenge: (seed: number, gameState: any, date: string) => {
                const gridSize = 5;
                const initialGrid = generateInitialGrid(gridSize);
                const seededRNG = createSeededRNG(seed);
                
                // Use the pre-generated starting letters from the API
                const startingLetters = gameState.startingLetters || [];
                
                // Place starting tiles with deterministic positioning
                const tilesWithLetters = placeStartingTiles(initialGrid, startingLetters, gridSize);
                
                // Generate power cards deterministically (optional: could disable for daily challenge)
                const startingPowerCards = generateStartingPowerCards();
                
                // Use pre-generated drops from API
                const firstDrop = gameState.firstDrop || [];
                const secondDrop = gameState.secondDrop || [];
                
                // Set the RNG state for future generations
                seededRNG.setState(gameState.rngState);
                
                set({
                    gameInitialized: true,
                    phase: 'player',
                    round: 1,
                    score: 0,
                    grid: tilesWithLetters,
                    gridSize: gridSize,
                    powerCards: startingPowerCards,
                    nextRows: [firstDrop, secondDrop],
                    tilesPerDrop: 3, // Start with 3 tiles
                    selectedTiles: [],
                    currentWord: '',
                    wordsThisRound: [],
                    freeMoveAvailable: false,
                    freeOrbitsAvailable: 2,
                    lockMode: false,
                    lockedTiles: [],
                    
                    // Daily challenge specific
                    isDailyChallenge: true,
                    dailySeed: seed,
                    dailyDate: date,
                    challengeStartTime: Date.now(),
                    seededRNG: seededRNG,
                    
                    // Reset stats
                    totalWords: 0,
                    tilesCleared: 0,
                    longestWord: '',
                    biggestCombo: 0,
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
                    // Don't reset wordsThisRound here - keep accumulating words
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
                const fallingLetters = state.nextRows[0] || generateDropLettersSmart(currentTilesPerDrop, state.grid, rewardCreative, state.seededRNG);

                // Ensure we have exactly 3 tiles
                let actualFallingLetters = fallingLetters;
                if (fallingLetters.length < currentTilesPerDrop) {
                    const additionalTiles = generateDropLettersSmart(currentTilesPerDrop - fallingLetters.length, state.grid, rewardCreative, state.seededRNG);
                    actualFallingLetters = [...fallingLetters, ...additionalTiles];
                } else if (fallingLetters.length > currentTilesPerDrop) {
                    actualFallingLetters = fallingLetters.slice(0, currentTilesPerDrop);
                }

                console.log(`[STORE] Round ${newRound}: Processing ${actualFallingLetters.length} falling tiles (consistent 3 per flood)`);

                // Apply the flood to the grid
                const { newGrid, finalPaths, placedCount, unplacedLetters } = applyFallingTiles(state.grid, actualFallingLetters, state.gridSize);
                
                console.log(`[STORE] Flood complete: ${placedCount} tiles placed out of ${actualFallingLetters.length} attempted`);

                // Game over only if tiles couldn't be placed (more realistic condition)
                if (unplacedLetters.length > 0) {
                    const words = state.totalWords;
                    const points = state.score;
                    toastService.error(`Game Over — No space for ${unplacedLetters.length} tiles! Score: ${points}, Words: ${words}`);
                    set({ phase: 'gameOver', grid: newGrid, floodPaths: {}, gravityMoves: undefined, selectedTiles: [], currentWord: '' });
                    return;
                }

                // Generate fresh previews for the upcoming turns using correct tile count for each future round
                // nextDrop1 will be used for (newRound + 1), nextDrop2 will be used for (newRound + 2)
                const nextRound1 = newRound + 1;
                const nextRound2 = newRound + 2;
                
                // Calculate tile count for next round
                let tilesForNextRound1 = 3;
                if (nextRound1 >= 12) {
                    tilesForNextRound1 = 6;
                } else if (nextRound1 >= 8) {
                    tilesForNextRound1 = 5;
                } else if (nextRound1 >= 4) {
                    tilesForNextRound1 = 4;
                }
                
                // Calculate tile count for round after next
                let tilesForNextRound2 = 3;
                if (nextRound2 >= 12) {
                    tilesForNextRound2 = 6;
                } else if (nextRound2 >= 8) {
                    tilesForNextRound2 = 5;
                } else if (nextRound2 >= 4) {
                    tilesForNextRound2 = 4;
                }

                let nextDrop1 = generateDropLettersSmart(tilesForNextRound1, newGrid, false, state.seededRNG);
                const nextDrop2 = generateDropLettersSmart(tilesForNextRound2, newGrid, false, state.seededRNG);

                // Set the new state all at once, including hidden tiles for animation
                const newlyPlacedTileIds = newGrid
                    .filter(cell => (cell as HexCell & { placedThisTurn?: boolean }).placedThisTurn)
                    .map(cell => cell.id);

                set({
                    round: newRound,
                    tilesPerDrop: currentTilesPerDrop, // Progressive difficulty
                    phase: 'flood',
                    grid: newGrid,
                    // Don't reset wordsThisRound - keep all words from entire game
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

                // No word limit in Tetris mode - players can submit multiple words per turn

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
                    // Only set gravitySettle phase if there are moves to animate
                    // Otherwise stay in player phase and let endRound() handle flood transition
                    ...(moveSources.size > 0 ? { phase: 'gravitySettle' } : {}),
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

                // Always end round after word submission (original simple logic)
                if (moveSources.size === 0) {
                    setTimeout(() => {
                        get().endRound();
                    }, 250);
                }
                // If there are gravity moves, endRound will be called after gravity settles
            },

            // New: move one tile to an adjacent empty cell, then end round
            moveTileOneStep: (_sourceCellId: string, _targetCellId: string) => {
                const state = get();
                if (state.phase !== 'player') return;
                toastService.error('Move power is disabled');
                return;
            },

            // Note: Orbit logic is implemented in TetrisGame.tsx drag handler
            orbitPivot: (_pivotCellId: string, _direction: 'cw' | 'ccw' = 'cw') => {
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


            toggleTileLock: (cellId: string) => {
                const state = get();
                
                const clickedCell = state.grid.find(c => c.id === cellId);
                if (!clickedCell || !clickedCell.letter || !clickedCell.isPlaced) return; // Only lock placed tiles
                
                const currentLockedTiles = Array.isArray(state.lockedTiles) ? state.lockedTiles : [];
                const selectedTileIds = state.selectedTiles.map(t => t.cellId);
                const isClickedCellLocked = currentLockedTiles.includes(cellId);
                
                if (isClickedCellLocked) {
                    // If clicked cell is locked, unlock all selected tiles (or just the clicked one if none selected)
                    const tilesToUnlock = selectedTileIds.length > 0 ? selectedTileIds : [cellId];
                    
                    // Only unlock valid locked tiles
                    const validTilesToUnlock = tilesToUnlock.filter(tileId => {
                        return currentLockedTiles.includes(tileId);
                    });
                    
                    const newLockedTiles = currentLockedTiles.filter(id => !validTilesToUnlock.includes(id));
                    set({ 
                        lockedTiles: newLockedTiles,
                        selectedTiles: [],
                        currentWord: ''
                    });
                    
                    const count = validTilesToUnlock.length;
                    toastService.success(`${count} tile${count > 1 ? 's' : ''} unlocked`);
                } else {
                    // If clicked cell is not locked, lock all selected tiles (including the clicked one if selected)
                    const tilesToLock = selectedTileIds.length > 0 ? selectedTileIds : [cellId];
                    
                    // Only lock valid placed tiles
                    const validTilesToLock = tilesToLock.filter(tileId => {
                        const cell = state.grid.find(c => c.id === tileId);
                        return cell && cell.letter && cell.isPlaced;
                    });
                    
                    const newLockedTiles = [...new Set([...currentLockedTiles, ...validTilesToLock])];
                    set({ 
                        lockedTiles: newLockedTiles,
                        selectedTiles: [],
                        currentWord: ''
                    });
                    
                    const count = validTilesToLock.length;
                    toastService.success(`${count} tile${count > 1 ? 's' : ''} locked`);
                }
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