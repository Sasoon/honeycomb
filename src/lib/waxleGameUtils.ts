import { HexCell } from '../components/HexGrid';
import { SeededRNG } from './seededRNG';

// Letter frequency for Tetris drops (weighted towards common letters)
const LETTER_WEIGHTS = {
    // Common (70%)
    'E': 12, 'A': 10, 'I': 9, 'O': 8, 'N': 7, 'R': 7, 'T': 7, 'L': 6, 'S': 6, 'U': 5,
    // Medium (25%)
    'D': 4, 'G': 3, 'B': 3, 'C': 3, 'M': 3, 'P': 3, 'F': 2, 'H': 2, 'V': 2, 'W': 2, 'Y': 2,
    // Rare (5%)
    'K': 1, 'J': 1, 'X': 1, 'Q': 1, 'Z': 1
};

// Generate a weighted random letter
export function generateRandomLetter(): string {
    const totalWeight = Object.values(LETTER_WEIGHTS).reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (const [letter, weight] of Object.entries(LETTER_WEIGHTS)) {
        random -= weight;
        if (random <= 0) return letter;
    }

    return 'E'; // Fallback
}

// Generate letters for the next drop
export function generateDropLetters(count: number): string[] {
    const letters: string[] = [];

    // For now, just generate regular letters
    // Special tiles can be added later as a power-up or special round
    for (let i = 0; i < count; i++) {
        letters.push(generateRandomLetter());
    }

    return letters;
}

// === Dynamic letter generation =====================================================
// Utility sets
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

// Common bigram → preferred completion letters (very small sample; extendable)
const COMPLETION_HINTS: Record<string, string[]> = {
    'TH': ['E', 'A', 'I'],
    'IN': ['G', 'E'],
    'AN': ['D', 'T'],
    'RE': ['D', 'S'],
    'QU': ['E', 'I', 'O'],
};

function isVowel(l: string) { return VOWELS.has(l); }

function computeVowelRatio(grid: HexCell[]): number {
    let vowels = 0, total = 0;
    for (const cell of grid) {
        if (!cell.letter || !cell.isPlaced) continue;
        total++;
        if (isVowel(cell.letter)) vowels++;
    }
    return total === 0 ? 0.4 : vowels / total;
}

// Collect adjacent bigrams (unordered) that exist on board
function collectLiveStems(grid: HexCell[]): Set<string> {
    const stems = new Set<string>();
    for (const a of grid) {
        if (!a.letter || !a.isPlaced) continue;
        for (const b of grid) {
            if (b.id === a.id || !b.letter || !b.isPlaced) continue;
            if (areCellsAdjacent(a, b)) {
                stems.add((a.letter + b.letter).toUpperCase());
            }
        }
    }
    return stems;
}

function boostLetters(weights: Record<string, number>, letters: string[], factor = 2) {
    for (const l of letters) { if (weights[l]) weights[l] *= factor; }
}
function dampLetters(weights: Record<string, number>, letters: string[], factor = 0.25) {
    for (const l of letters) { if (weights[l]) weights[l] *= factor; }
}

function boardContainsLetter(grid: HexCell[], letter: string): boolean {
    return grid.some(c => c.letter === letter && c.isPlaced);
}

function weightedSample(weights: Record<string, number>, count: number, seededRNG?: SeededRNG): string[] {
    const result: string[] = [];
    const availableLetters = [...Object.keys(weights)];
    
    for (let i = 0; i < count; i++) {
        // Remove already selected letters from available pool to prevent duplicates
        const currentWeights: Record<string, number> = {};
        availableLetters.forEach(letter => {
            if (!result.includes(letter)) {
                currentWeights[letter] = weights[letter];
            }
        });
        
        // If we've used all letters, stop (shouldn't happen with 26 letters and typical counts)
        if (Object.keys(currentWeights).length === 0) break;
        
        const total = Object.values(currentWeights).reduce((sum, w) => sum + w, 0);
        let r = (seededRNG ? seededRNG.next() : Math.random()) * total;
        
        for (const l of Object.keys(currentWeights)) {
            r -= currentWeights[l];
            if (r <= 0) { 
                result.push(l); 
                break; 
            }
        }
    }
    return result;
}

// Public smart generator
export function generateDropLettersSmart(count: number, grid: HexCell[], rewardCreative = false, seededRNG?: SeededRNG): string[] {
    // 1. Copy baseline
    const weights: Record<string, number> = { ...LETTER_WEIGHTS };

    // 2. Balance vowels/consonants
    const vRatio = computeVowelRatio(grid);
    if (vRatio < 0.30) {
        boostLetters(weights, Array.from(VOWELS), 2);
    } else if (vRatio > 0.50) {
        dampLetters(weights, Array.from(VOWELS), 0.5);
    }

    // 3. Promote completers for live stems
    const stems = collectLiveStems(grid);
    const completers = new Set<string>();
    stems.forEach(stem => {
        const hints = COMPLETION_HINTS[stem];
        if (hints) { hints.forEach(l => completers.add(l)); }
    });
    if (completers.size > 0) {
        boostLetters(weights, Array.from(completers), 2.5);
    }

    // 4. Dead-combo guard (Q without U)
    if (!boardContainsLetter(grid, 'U')) dampLetters(weights, ['Q'], 0.15);

    // 5. Optional creative reward – tilt toward higher-value consonants
    if (rewardCreative) {
        boostLetters(weights, ['Y', 'K', 'H', 'B', 'M', 'P'], 1.8);
    }

    return weightedSample(weights, count, seededRNG);
}
// === End dynamic letter generation ===============================================

// Check if the game is over (top row has tiles)
export function checkWaxleGameOver(grid: HexCell[]): boolean {
    // Find cells in the top row (row 0)
    const topRowCells = grid.filter(cell => cell.position.row === 0);

    // Game is over if ALL cells in the top row have tiles
    // This means there's no room for new tiles to drop
    const filledTopCells = topRowCells.filter(cell => cell.letter && cell.isPlaced);

    return filledTopCells.length === topRowCells.length;
}

// Compute the set of empty cells connected to the top via empty adjacency ("air")
export function computeReachableAir(grid: HexCell[]): Set<string> {
    const air = new Set<string>();
    const queue: HexCell[] = [];

    // Seed with all empty cells in the top row
    for (const cell of grid) {
        if (cell.position.row === 0 && (!cell.letter || !cell.isPlaced)) {
            air.add(cell.id);
            queue.push(cell);
        }
    }

    // BFS through empty neighbors using unified adjacency function
    while (queue.length > 0) {
        const current = queue.shift()!;
        for (const neighbor of grid) {
            if (neighbor.id === current.id) continue;
            if (air.has(neighbor.id)) continue;
            if (neighbor.letter && neighbor.isPlaced) continue;
            if (isHexAdjacent(current, neighbor)) {
                air.add(neighbor.id);
                queue.push(neighbor);
            }
        }
    }

    return air;
}

// Place starting tiles with simple gravity (for game initialization)
export function placeStartingTiles(
    grid: HexCell[],
    letters: string[],
    _gridSize: number
): HexCell[] {
    const newGrid = grid.map(cell => ({ ...cell }));

    // Find top row cells and sort by column for consistent placement
    const topRowCells = newGrid
        .filter(cell => cell.position.row === 0)
        .sort((a, b) => a.position.col - b.position.col);

    // Place letters at top row first
    letters.forEach((letter, index) => {
        if (index < topRowCells.length) {
            const cell = topRowCells[index];
            cell.letter = letter;
            cell.isPlaced = true;
            (cell as HexCell & { placedThisTurn?: boolean }).placedThisTurn = true;
        }
    });

    // Apply simple gravity to let them fall to bottom
    const { newGrid: settledGrid } = clearTilesAndApplyGravity(newGrid, []);

    return settledGrid;
}

// Simplified flood logic - tiles drop as deep as possible using gravity
export function applyFallingTiles(
    grid: HexCell[],
    fallingLetters: string[],
    gridSize: number
): { newGrid: HexCell[]; placedCount: number; attemptedCount: number; finalPaths: Record<string, { path: string[]; batch: number }>; unplacedLetters: string[] } {
    // Clone grid
    const newGrid = grid.map(cell => ({ ...cell }));

    // Reset placedThisTurn flags before a new drop
    newGrid.forEach(c => { c.placedThisTurn = false; });

    // First apply gravity to existing tiles that were placed this turn
    applyGravityToExistingTiles(newGrid, gridSize);

    // Deep-slot flood logic (replaces wave logic)
    const { placedTiles, finalPaths, unplacedLetters } = applyDeepFloodTiles(newGrid, fallingLetters, gridSize);
    const placedCount = placedTiles.length;

    return { newGrid, placedCount, attemptedCount: fallingLetters.length, finalPaths, unplacedLetters };
}

// Helper function to apply gravity to existing tiles that were just placed
function applyGravityToExistingTiles(grid: HexCell[], gridSize: number): void {
    let changesMade = true;
    const maxIterations = gridSize * 3;
    let iterations = 0;

    while (changesMade && iterations < maxIterations) {
        changesMade = false;
        iterations++;

        // Process from bottom to top to avoid conflicts
        for (let row = gridSize - 2; row >= 0; row--) {
            const cellsInRow = grid.filter(cell =>
                cell.position.row === row &&
                cell.letter &&
                cell.isPlaced &&
                (cell as HexCell & { placedThisTurn?: boolean }).placedThisTurn === true
            );

            cellsInRow.forEach(cell => {
                const { finalCell } = findDeepestValidPathWithSteps(cell, grid);

                if (finalCell && finalCell.id !== cell.id) {
                    // Move the letter to its deepest valid position
                    finalCell.letter = cell.letter;
                    finalCell.isPlaced = true;
                    (finalCell as HexCell & { placedThisTurn?: boolean }).placedThisTurn = true;

                    // Clear the original position
                    cell.letter = '';
                    cell.isPlaced = false;
                    (cell as HexCell & { placedThisTurn?: boolean }).placedThisTurn = false;
                    changesMade = true;
                }
            });
        }
    }
}

// Find the deepest valid position and return the full path to get there
function findDeepestValidPathWithSteps(startCell: HexCell, grid: HexCell[], occupiedPaths?: Set<string>): { finalCell: HexCell | null; fullPath: HexCell[] } {
    let deepestCell = startCell;
    let deepestRow = startCell.position.row;
    let bestPath: HexCell[] = [startCell];

    function exploreDeepest(cell: HexCell, currentPath: HexCell[], visited: Set<string>): void {
        // Update deepest if we found a deeper position
        if (cell.position.row > deepestRow) {
            deepestRow = cell.position.row;
            deepestCell = cell;
            bestPath = [...currentPath];
        }

        // Find all cells below that we can move to
        const cellsBelow = grid.filter(belowCell =>
            belowCell.position.row === cell.position.row + 1 &&
            isHexAdjacent(cell, belowCell) &&
            !belowCell.letter &&
            !belowCell.isPlaced &&
            !visited.has(belowCell.id) &&
            !(occupiedPaths && occupiedPaths.has(belowCell.id))
        );

        // Recursively explore each possible path
        for (const belowCell of cellsBelow) {
            const newVisited = new Set([...visited, belowCell.id]);
            const newPath = [...currentPath, belowCell];
            exploreDeepest(belowCell, newPath, newVisited);
        }
    }

    const initialVisited = new Set<string>([startCell.id]);
    exploreDeepest(startCell, [startCell], initialVisited);

    return { finalCell: deepestCell, fullPath: bestPath };
}

// NEW: deep-slot flood algorithm replacing wave logic
function applyDeepFloodTiles(
    grid: HexCell[],
    fallingLetters: string[],
    _gridSize: number
): { placedTiles: HexCell[]; finalPaths: Record<string, { path: string[]; batch: number }>; unplacedLetters: string[] } {
    const placedTiles: HexCell[] = [];
    const finalPaths: Record<string, { path: string[]; batch: number }> = {};
    const unplacedLetters: string[] = [];

    // Helper to compute deep for a single batch (<=3 letters)
    const processBatch = (letters: string[], batchIdx: number) => {
        // Build occupied set from current grid state (letters already placed)
        const occupiedStatic = new Set<string>();
        grid.forEach(c => {
            if (c.letter && c.isPlaced) occupiedStatic.add(`${c.position.row},${c.position.col}`);
        });
        const batchOccupied = new Set<string>();

        // Collect fresh empty top-row entries each batch
        const topRowEmpty = grid
            .filter(c => c.position.row === 0 && !c.letter && !c.isPlaced)
            .sort((a, b) => a.position.col - b.position.col);

        let entryIdx = 0;

        letters.forEach(letter => {
            // skip used entries inside this batch
            while (entryIdx < topRowEmpty.length && batchOccupied.has(topRowEmpty[entryIdx].id)) {
                entryIdx++;
            }
            if (entryIdx >= topRowEmpty.length) {
                unplacedLetters.push(letter);
                return;
            }
            const entryCell = topRowEmpty[entryIdx];
            batchOccupied.add(entryCell.id);

            // occupied for path finding = static + batchOccupied path cells so far
            const occupiedCombined = new Set<string>([...occupiedStatic, ...batchOccupied]);
            const { finalCell, fullPath } = findDeepestValidPathWithSteps(entryCell, grid, occupiedCombined);
            if (!finalCell) { unplacedLetters.push(letter); return; }

            finalCell.letter = letter;
            finalCell.isPlaced = true;
            (finalCell as HexCell & { placedThisTurn?: boolean }).placedThisTurn = true;
            placedTiles.push(finalCell);
            finalPaths[finalCell.id] = { path: fullPath.map(c => c.id), batch: batchIdx };
            fullPath.forEach(c => batchOccupied.add(c.id));
            // also update grid static occupancy for subsequent letters in later batches
            occupiedStatic.add(`${finalCell.position.row},${finalCell.position.col}`);
        });
    };

    for (let i = 0; i < fallingLetters.length; i += 3) {
        processBatch(fallingLetters.slice(i, i + 3), Math.floor(i / 3));
    }

    return { placedTiles, finalPaths, unplacedLetters };
}

// Clear selected tiles and apply gravity
export function clearTilesAndApplyGravity(
    grid: HexCell[],
    tilesToClear: string[]
): { newGrid: HexCell[], tilesCleared: number, moveSources: Map<string, string> } {
    const newGrid = grid.map(cell => ({ ...cell, placedThisTurn: false }));
    let tilesCleared = 0;
    const moveSources = new Map<string, string>();

    // Helper function to find cells below a given cell in a hex grid
    const findCellsBelow = (cell: HexCell): HexCell[] => {
        const possibleCells: HexCell[] = [];
        const cellRow = cell.position.row;
        const cellCol = cell.position.col;

        // Look for cells in the row below
        const cellsInRowBelow = newGrid.filter(c => c.position.row === cellRow + 1);

        cellsInRowBelow.forEach(belowCell => {
            const colDiff = Math.abs(belowCell.position.col - cellCol);
            if (colDiff < 0.6) {
                possibleCells.push(belowCell);
            }
        });

        // Only return empty cells that are actually adjacent
        return possibleCells.filter(c => !c.letter && isHexAdjacent(cell, c));
    };

    // Clear the selected tiles
    tilesToClear.forEach(cellId => {
        const cell = newGrid.find(c => c.id === cellId);
        if (cell && cell.letter) {
            cell.letter = '';
            cell.isPlaced = false;
            tilesCleared++;
        }
    });

    // Apply physics-based gravity - tiles fall down to fill gaps
    let changesMade = true;
    const gridSizeLocal = Math.max(...newGrid.map(c => c.position.row)) + 1;
    const maxIterations = gridSizeLocal * 2;
    let iterations = 0;

    while (changesMade && iterations < maxIterations) {
        changesMade = false;
        iterations++;

        // Process from bottom to top
        for (let row = gridSizeLocal - 2; row >= 0; row--) {
            const cellsInRow = newGrid.filter(cell =>
                cell.position.row === row && cell.letter && cell.isPlaced
            );

            cellsInRow.forEach(cell => {
                const possibleMoves = findCellsBelow(cell);

                // If there are possible moves, pick one deterministically
                if (possibleMoves.length > 0) {
                    // First priority: straight down
                    const directBelow = possibleMoves.find(c => c.position.col === cell.position.col);
                    // Second priority: leftmost available position (deterministic, no randomness)
                    const targetCell = directBelow || possibleMoves.sort((a, b) => a.position.col - b.position.col)[0];

                    // Move the letter
                    targetCell.letter = cell.letter;
                    targetCell.isPlaced = true;
                    (targetCell as HexCell & { placedThisTurn?: boolean }).placedThisTurn = true; // Mark as "newly placed" for animation
                    moveSources.set(targetCell.id, cell.id); // Record the source
                    cell.letter = '';
                    cell.isPlaced = false;
                    (cell as HexCell & { placedThisTurn?: boolean }).placedThisTurn = false;
                    changesMade = true;
                }
            });
        }
    }

    return { newGrid, tilesCleared, moveSources };
}


// Count adjacent edges within a word (not including sequential word path)
export function countAdjacentEdges(selectedTiles: string[], grid: HexCell[]): number {
    let edges = 0;
    
    for (let i = 0; i < selectedTiles.length; i++) {
        const tile1 = grid.find(c => c.id === selectedTiles[i]);
        if (!tile1) continue;
        
        for (let j = i + 1; j < selectedTiles.length; j++) {
            const tile2 = grid.find(c => c.id === selectedTiles[j]);
            if (!tile2) continue;
            
            // Count adjacency between non-sequential tiles in the word
            if (isHexAdjacent(tile1, tile2)) {
                edges++;
            }
        }
    }
    
    return edges;
}

// Calculate score using new golden rules: Length² × Adjacency × Round
export function calculateWaxleScore(
    wordLength: number,
    round: number,
    adjacentEdges: number
): number {
    // Rule 1: Base score is word length squared
    const baseScore = wordLength * wordLength;
    
    // Rule 2: Each adjacent edge adds 0.5x multiplier
    const adjacencyMultiplier = 1 + (adjacentEdges * 0.5);
    
    // Rule 3: Round multiplier based on flood difficulty (every 3 rounds)
    const roundMultiplier = Math.max(1, Math.floor(round / 3));
    
    const finalScore = baseScore * adjacencyMultiplier * roundMultiplier;
    
    return Math.floor(finalScore);
}

// Unified hex adjacency function - replaces all other adjacency functions
export function isHexAdjacent(cell1: HexCell, cell2: HexCell): boolean {
    const p1 = cell1.position;
    const p2 = cell2.position;

    // Same position - not adjacent
    if (p1.row === p2.row && p1.col === p2.col) return false;

    // Row difference more than 1 - not adjacent
    if (Math.abs(p1.row - p2.row) > 1) return false;

    // Same row - adjacent if columns differ by exactly 1
    if (p1.row === p2.row) {
        return Math.abs(p1.col - p2.col) === 1;
    }

    // Different rows - hex adjacency depends on row parity
    // In our diamond hex grid, even and odd rows connect differently
    const rowDiff = p2.row - p1.row;
    const colDiff = p2.col - p1.col;

    if (Math.abs(rowDiff) === 1) {
        // Adjacent rows - column difference must be 0 or ±1 depending on grid layout
        // For our diamond grid, adjacent cells in different rows can have colDiff of -1, 0, or 1
        return Math.abs(colDiff) <= 1;
    }

    return false;
}

// Legacy function - keep for compatibility but use isHexAdjacent internally
export function areCellsAdjacent(cell1: HexCell, cell2: HexCell): boolean {
    return isHexAdjacent(cell1, cell2);
}