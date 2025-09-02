import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HexCell } from '../components/HexGrid';
import { generateInitialGrid } from '../lib/gameUtils';
import { generateDropLettersSmart, areCellsAdjacent, applyFallingTiles, clearTilesAndApplyGravity, calculateWaxleScore, generateRandomLetter, placeStartingTiles } from '../lib/waxleGameUtils';
import { haptics } from '../lib/haptics';
import wordValidator from '../lib/wordValidator';
import toastService from '../lib/toastService';
import { createSeededRNG, SeededRNG } from '../lib/seededRNG';


// Game phases
export type GamePhase = 'flood' | 'player' | 'gameOver' | 'gravitySettle';

// Selected tiles for word building
export interface SelectedTile {
    cellId: string;
    letter: string;
    position: number; // Order in which it was selected
}

// Individual game state that can be stored separately for Classic and Daily
interface GameModeState {
    gameInitialized: boolean;
    phase: GamePhase;
    grid: HexCell[];
    gridSize: number;
    score: number;
    round: number;
    gravityMoves?: Map<string, string>;
    floodPaths?: Record<string, { path: string[]; batch: number }>;
    tilesHiddenForAnimation?: string[];
    freeMoveAvailable?: boolean;
    freeOrbitsAvailable?: number;
    lockMode?: boolean;
    lockedTiles?: string[];
    lockAnimatingTiles?: string[];
    nextRows: string[][];
    tilesPerDrop: number;
    dropSpeed: number;
    selectedTiles: SelectedTile[];
    currentWord: string;
    isWordValid: boolean;
    wordsThisRound: string[];
    totalWords: number;
    tilesCleared: number;
    longestWord: string;
    biggestCombo: number;
    wordsPerTurnLimit: number;
    slowModeRounds: number;
    previewLevel: number;
    // Daily-specific fields (only used in daily state)
    dailySeed?: number;
    dailyDate?: string;
    challengeStartTime?: number;
    seededRNG?: SeededRNG;
}

// WAXLE game state - now contains separate states for Classic and Daily
interface WaxleGameState {
    // Separate game states
    classicGameState: GameModeState;
    dailyGameState: GameModeState;
    
    // Current mode tracking
    isDailyChallenge: boolean;
    
    // Persistence
    lastSaved: number;

    // Helper functions for state management
    getCurrentGameState: () => GameModeState;
    updateCurrentGameState: (updates: Partial<GameModeState>) => void;
    
    // Actions
    setGameState: (state: Partial<WaxleGameState>) => void;
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

    // Lock mode actions
    toggleTileLock: (cellId: string) => void;

    // Utility
    checkGameOver: () => boolean;
}

// Initial game mode state
const initialGameModeState: GameModeState = {
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
    wordsThisRound: [],
    totalWords: 0,
    tilesCleared: 0,
    longestWord: '',
    biggestCombo: 0,
    wordsPerTurnLimit: 0,
    slowModeRounds: 0,
    previewLevel: 1,
    tilesHiddenForAnimation: [],
    lockMode: false,
    lockedTiles: [],
    lockAnimatingTiles: [],
};

// Initial state
const initialState: Omit<WaxleGameState,
    'getCurrentGameState' | 'updateCurrentGameState' |
    'setGameState' | 'initializeGame' | 'initializeDailyChallenge' | 'resetGame' |
    'startPlayerPhase' | 'endRound' | 'endPlayerPhase' |
    'selectTile' | 'deselectTile' | 'clearSelection' | 'submitWord' | 'moveTileOneStep' | 'orbitPivot' |
    'toggleTileLock' | 'checkGameOver'
> = {
    classicGameState: { ...initialGameModeState },
    dailyGameState: { ...initialGameModeState },
    isDailyChallenge: false,
    lastSaved: Date.now(),
};

// Create the WAXLE game store
export const useWaxleGameStore = create<WaxleGameState>()(
    persist(
        (set, get) => ({
            ...initialState,

            // Helper function to get current game state (route-aware)
            getCurrentGameState: () => {
                const state = get();
                const isDailyMode = window.location.pathname === '/daily';
                return isDailyMode ? state.dailyGameState : state.classicGameState;
            },

            // Helper function to update current game state (route-aware)
            updateCurrentGameState: (updates: Partial<GameModeState>) => {
                const isDailyMode = window.location.pathname === '/daily';
                if (isDailyMode) {
                    set((prev) => ({
                        ...prev,
                        isDailyChallenge: true, // Keep flag synced
                        dailyGameState: { ...prev.dailyGameState, ...updates }
                    }));
                } else {
                    set((prev) => ({
                        ...prev,
                        isDailyChallenge: false, // Keep flag synced
                        classicGameState: { ...prev.classicGameState, ...updates }
                    }));
                }
            },

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

                // Place starting tiles with simple gravity (not flood logic)
                // This ensures they always end up at the bottom
                const tilesWithLetters = placeStartingTiles(initialGrid, initialLetters, gridSize);


                // Generate first drop preview (starts at 3 tiles for round 1)
                const initialTilesPerDrop = 3;
                const firstDrop = generateDropLettersSmart(initialTilesPerDrop, tilesWithLetters, false, undefined);
                const secondDrop = generateDropLettersSmart(initialTilesPerDrop, tilesWithLetters, false, undefined);

                // Initialize classic game state (never daily challenge here)
                set((prev) => ({
                    ...prev,
                    isDailyChallenge: false,
                    classicGameState: {
                        ...prev.classicGameState,
                        gameInitialized: true,
                        phase: 'player',
                        round: 1,
                        score: 0,
                        grid: tilesWithLetters,
                        gridSize: gridSize,
                        nextRows: [firstDrop, secondDrop],
                        tilesPerDrop: initialTilesPerDrop,
                        selectedTiles: [],
                        currentWord: '',
                        wordsThisRound: [],
                        freeMoveAvailable: false,
                        freeOrbitsAvailable: 2,
                        lockMode: false,
                        lockedTiles: [],
                        lockAnimatingTiles: [],
                        totalWords: 0,
                        tilesCleared: 0,
                        longestWord: '',
                        biggestCombo: 0,
                        isWordValid: false,
                    }
                }));
            },

            initializeDailyChallenge: (seed: number, gameState: any, date: string) => {
                const gridSize = 5;
                const initialGrid = generateInitialGrid(gridSize, true); // Skip pre-placed tiles for daily challenges
                const seededRNG = createSeededRNG(seed);
                
                // Use the pre-generated starting letters from the API
                const startingLetters = gameState.startingLetters || [];
                
                // Place starting tiles with deterministic positioning
                const tilesWithLetters = placeStartingTiles(initialGrid, startingLetters, gridSize);
                
                // Generate power cards deterministically (optional: could disable for daily challenge)
                
                // Use pre-generated drops from API
                const firstDrop = gameState.firstDrop || [];
                const secondDrop = gameState.secondDrop || [];
                
                // Set the RNG state for future generations
                seededRNG.setState(gameState.rngState);
                
                // Initialize daily challenge game state
                set((prev) => ({
                    ...prev,
                    isDailyChallenge: true,
                    dailyGameState: {
                        ...prev.dailyGameState,
                        gameInitialized: true,
                        phase: 'player',
                        round: 1,
                        score: 0,
                        grid: tilesWithLetters,
                        gridSize: gridSize,
                        nextRows: [firstDrop, secondDrop],
                        tilesPerDrop: 3,
                        selectedTiles: [],
                        currentWord: '',
                        wordsThisRound: [],
                        freeMoveAvailable: false,
                        freeOrbitsAvailable: 2,
                        lockMode: false,
                        lockedTiles: [],
                        lockAnimatingTiles: [],
                        totalWords: 0,
                        tilesCleared: 0,
                        longestWord: '',
                        biggestCombo: 0,
                        isWordValid: false,
                        // Daily challenge specific fields
                        dailySeed: seed,
                        dailyDate: date,
                        challengeStartTime: Date.now(),
                        seededRNG: seededRNG,
                    }
                }));
            },

            resetGame: () => {
                set({
                    ...initialState,
                    classicGameState: {
                        ...initialGameModeState,
                        gameInitialized: false, // Allow re-initialization
                    },
                    dailyGameState: {
                        ...initialGameModeState,
                        gameInitialized: false,
                    },
                    isDailyChallenge: false,
                });
            },

            startPlayerPhase: () => {
                console.log('[STORE] Starting player phase with 2 orbits');
                const { updateCurrentGameState } = get();
                updateCurrentGameState({
                    phase: 'player',
                    selectedTiles: [],
                    currentWord: '',
                    freeMoveAvailable: false,
                    freeOrbitsAvailable: 2,
                    tilesHiddenForAnimation: [],
                });
            },

            endPlayerPhase: () => {
                const { getCurrentGameState } = get();
                const currentState = getCurrentGameState();
                if (currentState.phase !== 'player') return;
                // Advance to flood for this turn
                get().endRound();
            },

            endRound: () => {
                const { getCurrentGameState, updateCurrentGameState } = get();
                const state = getCurrentGameState();
                const newRound = state.round + 1;

                // Clear lock mode and locked tiles immediately before flood starts
                // This ensures visual indicators disappear before flood animation
                updateCurrentGameState({
                    lockMode: false,
                    lockedTiles: [],
                    lockAnimatingTiles: [],
                });

                // Progressive difficulty: +1 tile every 3 rounds (accounting for Round 1 offset)
                let currentTilesPerDrop = 3;
                if (newRound >= 11) {
                    currentTilesPerDrop = 6; // Cap at 6 tiles (Round 11+)
                } else if (newRound >= 8) {
                    currentTilesPerDrop = 5; // Round 8-10: 5 tiles
                } else if (newRound >= 5) {
                    currentTilesPerDrop = 4; // Round 5-7: 4 tiles  
                }
                // Round 2-4: 3 tiles (default, Round 1 has no flood)
                
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

                // Game over only if tiles couldn't be placed AND top row is actually full
                const topRowCells = newGrid.filter(cell => cell.position.row === 0);
                const topRowFull = topRowCells.every(cell => cell.letter && cell.isPlaced);
                
                if (unplacedLetters.length > 0 && topRowFull) {
                    
                    // DEBUG: Log game state when game over occurs
                    console.log(`[DEBUG] GAME OVER triggered at round ${newRound}`);
                    console.log(`[DEBUG] Unplaced letters:`, unplacedLetters);
                    console.log(`[DEBUG] Attempted to place:`, actualFallingLetters);
                    console.log(`[DEBUG] Successfully placed:`, placedCount);
                    console.log(`[DEBUG] Total tiles on grid:`, newGrid.filter(cell => cell.letter && cell.isPlaced).length);
                    console.log(`[DEBUG] Empty cells available:`, newGrid.filter(cell => !cell.letter).length);
                    console.log(`[DEBUG] Top row occupied:`, newGrid.filter(cell => cell.position.row === 0 && cell.letter).length);
                    console.log(`[DEBUG] Top row full:`, topRowFull);
                    
                    // Toast removed - game over modal shows this information
                    updateCurrentGameState({ phase: 'gameOver', grid: newGrid, floodPaths: {}, gravityMoves: undefined, selectedTiles: [], currentWord: '' });
                    return;
                } else if (unplacedLetters.length > 0) {
                    // DEBUG: Log when tiles fail to place but game continues (top row not full)
                    console.log(`[DEBUG] ${unplacedLetters.length} tiles failed to place, but top row not full - continuing game`);
                    console.log(`[DEBUG] Unplaced letters:`, unplacedLetters);
                    console.log(`[DEBUG] Top row occupied:`, newGrid.filter(cell => cell.position.row === 0 && cell.letter).length, '/ 3');
                }

                // Generate fresh previews for the upcoming turns using correct tile count for each future round
                // nextDrop1 will be used for (newRound + 1), nextDrop2 will be used for (newRound + 2)
                const nextRound1 = newRound + 1;
                const nextRound2 = newRound + 2;
                
                // Calculate tile count for next round (accounting for Round 1 offset)
                let tilesForNextRound1 = 3;
                if (nextRound1 >= 11) {
                    tilesForNextRound1 = 6; // Cap at 6 tiles
                } else if (nextRound1 >= 8) {
                    tilesForNextRound1 = 5; // Round 8-10: 5 tiles
                } else if (nextRound1 >= 5) {
                    tilesForNextRound1 = 4; // Round 5-7: 4 tiles
                }
                
                // Calculate tile count for round after next (accounting for Round 1 offset)
                let tilesForNextRound2 = 3;
                if (nextRound2 >= 11) {
                    tilesForNextRound2 = 6; // Cap at 6 tiles
                } else if (nextRound2 >= 8) {
                    tilesForNextRound2 = 5; // Round 8-10: 5 tiles
                } else if (nextRound2 >= 5) {
                    tilesForNextRound2 = 4; // Round 5-7: 4 tiles
                }

                // Shift the queue: nextRows[1] becomes nextRows[0] (making forecast accurate)
                let nextDrop1 = state.nextRows[1] || generateDropLettersSmart(tilesForNextRound1, newGrid, false, state.seededRNG);
                
                // Ensure nextDrop1 has correct tile count for the next round
                if (nextDrop1.length < tilesForNextRound1) {
                    const additionalTiles = generateDropLettersSmart(tilesForNextRound1 - nextDrop1.length, newGrid, false, state.seededRNG);
                    nextDrop1 = [...nextDrop1, ...additionalTiles];
                } else if (nextDrop1.length > tilesForNextRound1) {
                    nextDrop1 = nextDrop1.slice(0, tilesForNextRound1);
                }
                
                // Only generate the new second forecast
                const nextDrop2 = generateDropLettersSmart(tilesForNextRound2, newGrid, false, state.seededRNG);

                // Set the new state all at once, including hidden tiles for animation
                const newlyPlacedTileIds = newGrid
                    .filter(cell => (cell as HexCell & { placedThisTurn?: boolean }).placedThisTurn)
                    .map(cell => cell.id);

                updateCurrentGameState({
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
                const { getCurrentGameState, updateCurrentGameState } = get();
                const state = getCurrentGameState();
                const cell = state.grid.find(c => c.id === cellId);

                if (!cell || !cell.letter || state.phase !== 'player') return;

                // Check if already selected
                const existingIndex = state.selectedTiles.findIndex(t => t.cellId === cellId);
                if (existingIndex !== -1) {
                    // Deselect this tile and all tiles after it
                    const newSelected = state.selectedTiles.slice(0, existingIndex);
                    const newWord = newSelected.map(t => t.letter).join('');

                    updateCurrentGameState({
                        selectedTiles: newSelected,
                        currentWord: newWord
                    });

                    // Validate word asynchronously
                    if (newWord.length >= 3) {
                        wordValidator.validateWordAsync(newWord).then(isValid => {
                            updateCurrentGameState({ isWordValid: isValid });
                        });
                    } else {
                        updateCurrentGameState({ isWordValid: false });
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
                            updateCurrentGameState({
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

                updateCurrentGameState({
                    selectedTiles: newSelected,
                    currentWord: newWord
                });

                // Validate word asynchronously
                if (newWord.length >= 3) {
                    wordValidator.validateWordAsync(newWord).then(isValid => {
                        updateCurrentGameState({ isWordValid: isValid });
                    });
                } else {
                    updateCurrentGameState({ isWordValid: false });
                }
            },

            deselectTile: (cellId: string) => {
                const { getCurrentGameState, updateCurrentGameState } = get();
                const state = getCurrentGameState();
                const tileIndex = state.selectedTiles.findIndex(t => t.cellId === cellId);

                if (tileIndex === -1) return;

                // Only allow deselecting the last tile
                if (tileIndex === state.selectedTiles.length - 1) {
                    const newSelected = state.selectedTiles.slice(0, -1);
                    const newWord = newSelected.map(t => t.letter).join('');

                    updateCurrentGameState({
                        selectedTiles: newSelected,
                        currentWord: newWord
                    });

                    // Validate word asynchronously
                    if (newWord.length >= 3) {
                        wordValidator.validateWordAsync(newWord).then(isValid => {
                            updateCurrentGameState({ isWordValid: isValid });
                        });
                    } else {
                        updateCurrentGameState({ isWordValid: false });
                    }
                }
            },

            clearSelection: () => {
                const { updateCurrentGameState } = get();
                updateCurrentGameState({
                    selectedTiles: [],
                    currentWord: '',
                    isWordValid: false
                });
            },

            submitWord: async () => {
                const { getCurrentGameState, updateCurrentGameState } = get();
                const state = getCurrentGameState();

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
                const wordScore = calculateWaxleScore(baseScore, state.round, tilesCleared, isCombo);


                // Update state
                const updates: Partial<GameModeState> = {
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


                // Update longest word
                if (state.currentWord.length > state.longestWord.length) {
                    updates.longestWord = state.currentWord;
                }

                updateCurrentGameState(updates);
                toastService.success(`+${wordScore} points!`);
                haptics.success();

                // Always end round after word submission (original simple logic)
                if (moveSources.size === 0) {
                    // No gravity moves needed, trigger flood phase immediately
                    get().endRound();
                }
                // If there are gravity moves, endRound will be called after gravity settles
            },

            // New: move one tile to an adjacent empty cell, then end round
            moveTileOneStep: (_sourceCellId: string, _targetCellId: string) => {
                const { getCurrentGameState } = get();
                const state = getCurrentGameState();
                if (state.phase !== 'player') return;
                toastService.error('Move power is disabled');
                return;
            },

            // Note: Orbit logic is implemented in WaxleGame.tsx drag handler
            orbitPivot: (_pivotCellId: string, _direction: 'cw' | 'ccw' = 'cw') => {
                // This function exists for interface compatibility but orbit is handled in UI
                console.log('[ORBIT-STORE] This function is not used - orbit handled in UI');
            },



            toggleTileLock: (cellId: string) => {
                const { getCurrentGameState, updateCurrentGameState } = get();
                const state = getCurrentGameState();
                
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
                    
                    // Start unlock animation
                    const currentAnimatingTiles = Array.isArray(state.lockAnimatingTiles) ? state.lockAnimatingTiles : [];
                    const newAnimatingTiles = [...new Set([...currentAnimatingTiles, ...validTilesToUnlock])];
                    
                    updateCurrentGameState({ 
                        lockAnimatingTiles: newAnimatingTiles,
                        selectedTiles: [],
                        currentWord: ''
                    });
                    
                    // After 400ms, complete the unlock
                    setTimeout(() => {
                        const { getCurrentGameState, updateCurrentGameState } = get();
                        const currentState = getCurrentGameState();
                        const newLockedTiles = (currentState.lockedTiles || []).filter(id => !validTilesToUnlock.includes(id));
                        const newAnimatingTiles = (currentState.lockAnimatingTiles || []).filter(id => !validTilesToUnlock.includes(id));
                        
                        updateCurrentGameState({
                            lockedTiles: newLockedTiles,
                            lockAnimatingTiles: newAnimatingTiles
                        });
                    }, 400);
                    
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
                    
                    // Start lock animation
                    const currentAnimatingTiles = Array.isArray(state.lockAnimatingTiles) ? state.lockAnimatingTiles : [];
                    const newAnimatingTiles = [...new Set([...currentAnimatingTiles, ...validTilesToLock])];
                    
                    updateCurrentGameState({ 
                        lockAnimatingTiles: newAnimatingTiles,
                        selectedTiles: [],
                        currentWord: ''
                    });
                    
                    // After 400ms, complete the lock
                    setTimeout(() => {
                        const { getCurrentGameState, updateCurrentGameState } = get();
                        const currentState = getCurrentGameState();
                        const newLockedTiles = [...new Set([...(currentState.lockedTiles || []), ...validTilesToLock])];
                        const newAnimatingTiles = (currentState.lockAnimatingTiles || []).filter(id => !validTilesToLock.includes(id));
                        
                        updateCurrentGameState({
                            lockedTiles: newLockedTiles,
                            lockAnimatingTiles: newAnimatingTiles
                        });
                    }, 400);
                    
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
            name: 'waxle-game',
            skipHydration: false,
            partialize: (state) => {
                // Persist both Classic and Daily states separately
                return {
                    classicGameState: {
                        ...state.classicGameState,
                        phase: 'player', // Always start in player phase on load
                        selectedTiles: [], // Clear UI state
                        currentWord: '',
                    },
                    dailyGameState: {
                        ...state.dailyGameState, 
                        phase: 'player', // Always start in player phase on load
                        selectedTiles: [], // Clear UI state
                        currentWord: '',
                    },
                    isDailyChallenge: false, // Always start in Classic mode on load
                    lastSaved: state.lastSaved,
                };
            },
        }
    )
); 