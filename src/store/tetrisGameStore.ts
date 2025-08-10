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

    // Utility
    checkGameOver: () => boolean;
}

// Initial state
const initialState: Omit<TetrisGameState,
    'setGameState' | 'initializeGame' | 'resetGame' |
    'startPlayerPhase' | 'endRound' |
    'selectTile' | 'deselectTile' | 'clearSelection' | 'submitWord' | 'moveTileOneStep' | 'orbitPivot' |
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

                // Generate first drop preview based on current tilesPerDrop (default 3)
                const firstDrop = generateDropLetters(3);
                const secondDrop = generateDropLetters(3);

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

                // 1. Determine tilesPerDrop for THIS round first
                let currentTilesPerDrop = state.tilesPerDrop;
                if (newRound % 3 === 0) {
                    currentTilesPerDrop = Math.min(state.tilesPerDrop + 1, 6);
                    console.log(`[STORE] Round ${newRound}: Incrementing tiles from ${state.tilesPerDrop} to ${currentTilesPerDrop}`);
                }

                // 2. Generate flood tiles for this round using the correct count
                const fallingLetters = state.nextRows[0] || generateDropLetters(currentTilesPerDrop);

                // If the preview was generated with old count but we need more tiles, add them
                const actualTilesNeeded = currentTilesPerDrop;
                let actualFallingLetters = fallingLetters;
                if (fallingLetters.length < actualTilesNeeded) {
                    const additionalTiles = generateDropLetters(actualTilesNeeded - fallingLetters.length);
                    actualFallingLetters = [...fallingLetters, ...additionalTiles];
                    console.log(`[STORE] Expanded falling letters from ${fallingLetters.length} to ${actualFallingLetters.length}`);
                }

                console.log(`[STORE] Round ${newRound}: Processing ${actualFallingLetters.length} falling tiles (target: ${currentTilesPerDrop})`);


                // 3. Apply the flood to the grid
                const { newGrid, placedCount, finalPaths, unplacedLetters } = applyFallingTiles(state.grid, actualFallingLetters, state.gridSize);

                // 4. Loss detection
                // A) Immediate loss if no tiles could be placed at all
                if (placedCount === 0 && actualFallingLetters.length > 0) {
                    const totalCells = state.grid.length;
                    const filledCells = newGrid.filter(c => c.letter && c.isPlaced).length;
                    const words = state.totalWords;
                    const points = state.score;
                    toastService.error(`Game Over — Score: ${points}, Words: ${words}, Board: ${Math.round((filledCells / totalCells) * 100)}%`);
                    set({ phase: 'gameOver', grid: newGrid, floodPaths: {}, gravityMoves: undefined, selectedTiles: [], currentWord: '' });
                    return;
                }
                // B) New rule: if any subsequent waves cannot resolve (unplaced letters remain), game over
                if (unplacedLetters.length > 0) {
                    const totalCells = state.grid.length;
                    const filledCells = newGrid.filter(c => c.letter && c.isPlaced).length;
                    const words = state.totalWords;
                    const points = state.score;
                    toastService.error(`Game Over — No space for ${unplacedLetters.length} tile(s). Score: ${points}, Words: ${words}, Board: ${Math.round((filledCells / totalCells) * 100)}%`);
                    set({ phase: 'gameOver', grid: newGrid, floodPaths: {}, gravityMoves: undefined, selectedTiles: [], currentWord: '' });
                    return;
                }

                // 5. Generate fresh previews for the upcoming turns
                // If there are unplaced tiles, prepend them to the next drop
                let nextDrop1 = generateDropLetters(currentTilesPerDrop);
                if (unplacedLetters.length > 0) {
                    // Prepend unplaced tiles and adjust the generated tiles count
                    const newTilesNeeded = Math.max(0, currentTilesPerDrop - unplacedLetters.length);
                    nextDrop1 = [...unplacedLetters, ...nextDrop1.slice(0, newTilesNeeded)];
                }
                const nextDrop2 = generateDropLetters(currentTilesPerDrop);

                // 6. Set the new state all at once
                set({
                    round: newRound,
                    tilesPerDrop: currentTilesPerDrop,
                    phase: 'flood',
                    grid: newGrid,
                    wordsThisRound: [],
                    nextRows: [nextDrop1, nextDrop2],
                    selectedTiles: [],
                    currentWord: '',
                    floodPaths: finalPaths,
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

                // If no gravity moves, end the round immediately to trigger flood
                if (moveSources.size === 0) {
                    setTimeout(() => {
                        get().endRound();
                    }, 250);
                }
            },

            // New: move one tile to an adjacent empty cell, then end round
            moveTileOneStep: (sourceCellId: string, targetCellId: string) => {
                const state = get();
                if (state.phase !== 'player') return;

                const source = state.grid.find(c => c.id === sourceCellId);
                const target = state.grid.find(c => c.id === targetCellId);
                if (!source || !target) return;

                if (!source.letter || !source.isPlaced) {
                    toastService.error('Select a tile with a letter');
                    return;
                }
                if (target.letter || target.isPlaced) {
                    toastService.error('Target must be empty');
                    return;
                }
                if (!areCellsAdjacent(source, target)) {
                    toastService.error('Must move to an adjacent cell');
                    return;
                }
                // Connected constraint: target must have at least one occupied neighbor excluding source
                const hasConnectedNeighbor = get().grid.some(n => n.id !== source.id && n.letter && n.isPlaced && areCellsAdjacent(target, n));
                if (!hasConnectedNeighbor) {
                    toastService.error('Move must stay connected');
                    return;
                }

                const newGrid = state.grid.map(cell => {
                    if (cell.id === source.id) {
                        return { ...cell, letter: '', isPlaced: false };
                    }
                    if (cell.id === target.id) {
                        return { ...cell, letter: source.letter, isPlaced: true };
                    }
                    return cell;
                });

                set({ grid: newGrid, selectedTiles: [], currentWord: '' });

                setTimeout(() => {
                    get().endRound();
                }, 150);
            },

            // New: orbit rotate the 6 neighbors around a pivot, then end round
            orbitPivot: (pivotCellId: string, direction: 'cw' | 'ccw' = 'cw') => {
                const state = get();
                if (state.phase !== 'player') return;
                const pivot = state.grid.find(c => c.id === pivotCellId);
                if (!pivot) return;

                const p = pivot.position;
                // Build neighbors by adjacency (distance 1)
                const neighborCandidates = state.grid.filter(c => c.id !== pivot.id && areCellsAdjacent(c, pivot));
                // Compute centers in grid coordinates for angular order (use row/col as coarse plane)
                const neighbors = neighborCandidates
                    .map(n => ({ n, angle: Math.atan2(n.position.row - p.row, n.position.col - p.col) }))
                    .sort((a, b) => a.angle - b.angle)
                    .map(x => x.n);

                if (neighbors.length < 2) {
                    toastService.error('Not enough neighbors to orbit');
                    return;
                }

                const letters = neighbors.map(n => (n.letter && n.isPlaced ? n.letter : ''));
                const rotated = direction === 'cw'
                    ? [letters[letters.length - 1], ...letters.slice(0, letters.length - 1)]
                    : [...letters.slice(1), letters[0]];

                const neighborIdToNewLetter = new Map<string, string>();
                neighbors.forEach((n, idx) => neighborIdToNewLetter.set(n.id, rotated[idx]));

                const newGrid = state.grid.map(cell => {
                    const newLetter = neighborIdToNewLetter.get(cell.id);
                    if (newLetter !== undefined) {
                        return { ...cell, letter: newLetter, isPlaced: newLetter !== '' };
                    }
                    return cell;
                });

                set({ grid: newGrid, selectedTiles: [], currentWord: '' });

                setTimeout(() => {
                    get().endRound();
                }, 150);
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