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
    const letters = Object.keys(weights);
    for (let i = 0; i < count; i++) {
        const total = letters.reduce((sum, l) => sum + weights[l], 0);
        let r = (seededRNG ? seededRNG.next() : Math.random()) * total;
        for (const l of letters) {
            r -= weights[l];
            if (r <= 0) { result.push(l); break; }
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
): { newGrid: HexCell[]; placedCount: number; attemptedCount: number; finalPaths: Record<string, string[]>; unplacedLetters: string[] } {
    // Clone grid
    const newGrid = grid.map(cell => ({ ...cell }));

    // Reset placedThisTurn flags before a new drop
    newGrid.forEach(c => { c.placedThisTurn = false; });

    // First apply gravity to existing tiles that were placed this turn
    applyGravityToExistingTiles(newGrid, gridSize);

    // Now apply the simplified flood logic
    const { placedTiles, finalPaths, unplacedLetters } = applySimpleFloodTiles(newGrid, fallingLetters, gridSize);
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
                const deepestPosition = findDeepestValidPosition(cell, grid);
                
                if (deepestPosition && deepestPosition.id !== cell.id) {
                    // Move the letter to its deepest valid position
                    deepestPosition.letter = cell.letter;
                    deepestPosition.isPlaced = true;
                    (deepestPosition as HexCell & { placedThisTurn?: boolean }).placedThisTurn = true;
                    
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

// Find the deepest valid position for a tile to fall to using gravity
function findDeepestValidPosition(startCell: HexCell, grid: HexCell[]): HexCell | null {
    // Explore all possible paths from the start cell to find the absolute deepest position
    let deepestCell = startCell;
    let deepestRow = startCell.position.row;

    const visited = new Set<string>();
    
    function exploreDeepest(cell: HexCell, currentVisited: Set<string>): void {
        const newVisited = new Set([...currentVisited, cell.id]);

        // Update deepest if we found a deeper position
        if (cell.position.row > deepestRow) {
            deepestRow = cell.position.row;
            deepestCell = cell;
        }

        // Find all cells below that we can move to
        const cellsBelow = grid.filter(belowCell => 
            belowCell.position.row === cell.position.row + 1 &&
            isHexAdjacent(cell, belowCell) &&
            !belowCell.letter && 
            !belowCell.isPlaced &&
            !newVisited.has(belowCell.id)
        );

        // Recursively explore each possible path
        for (const belowCell of cellsBelow) {
            exploreDeepest(belowCell, newVisited);
        }
    }

    exploreDeepest(startCell, visited);
    return deepestCell;
}

// Simplified flood logic - process tiles sequentially with direct gravity
function applySimpleFloodTiles(
    grid: HexCell[],
    fallingLetters: string[],
    _gridSize: number
): { placedTiles: HexCell[]; finalPaths: Record<string, string[]>; unplacedLetters: string[] } {
    const placedTiles: HexCell[] = [];
    const finalPaths: Record<string, string[]> = {};
    const unplacedLetters: string[] = [];

    // Get available entry points from top row
    const topRowCells = grid.filter(cell => cell.position.row === 0);
    const availableEntries = topRowCells.filter(cell => !cell.letter && !cell.isPlaced);

    console.log(`[SIMPLE-FLOOD] Processing ${fallingLetters.length} tiles with ${availableEntries.length} entry points`);

    // Check if we have enough entry points for flood tiles
    if (availableEntries.length === 0) {
        // No entry points - all tiles fail to place
        unplacedLetters.push(...fallingLetters);
        console.log(`[SIMPLE-FLOOD] No entry points available - all tiles fail to place`);
        return { placedTiles, finalPaths, unplacedLetters };
    }

    // Process tiles one by one
    for (let i = 0; i < fallingLetters.length; i++) {
        const letter = fallingLetters[i];
        
        // Get current available entries (may change as tiles are placed)
        const currentEntries = topRowCells.filter(cell => !cell.letter && !cell.isPlaced);
        
        if (currentEntries.length === 0) {
            // No more entry points - remaining tiles fail to place
            unplacedLetters.push(...fallingLetters.slice(i));
            console.log(`[SIMPLE-FLOOD] No more entry points - ${fallingLetters.length - i} remaining tiles fail to place`);
            break;
        }

        // Find the entry point that leads to the deepest possible position
        let bestEntryPoint: HexCell | null = null;
        let bestFinalPosition: HexCell | null = null;
        let deepestRow = -1;

        for (const entry of currentEntries) {
            const finalPos = findDeepestValidPosition(entry, grid);
            if (finalPos && finalPos.position.row > deepestRow) {
                deepestRow = finalPos.position.row;
                bestEntryPoint = entry;
                bestFinalPosition = finalPos;
            }
        }

        if (bestEntryPoint && bestFinalPosition) {
            // Place the tile at its deepest valid position
            bestFinalPosition.letter = letter;
            bestFinalPosition.isPlaced = true;
            (bestFinalPosition as HexCell & { placedThisTurn?: boolean }).placedThisTurn = true;
            
            placedTiles.push(bestFinalPosition);
            
            // Create simple path for animation (just entry to final)
            finalPaths[bestFinalPosition.id] = [bestEntryPoint.id, bestFinalPosition.id];
            
            console.log(`[SIMPLE-FLOOD] Placed '${letter}' from (${bestEntryPoint.position.row},${bestEntryPoint.position.col}) to (${bestFinalPosition.position.row},${bestFinalPosition.position.col})`);
        } else {
            // No valid position found
            unplacedLetters.push(letter);
            console.log(`[SIMPLE-FLOOD] Failed to place '${letter}' - no valid position found`);
        }
    }

    console.log(`[SIMPLE-FLOOD] Placed ${placedTiles.length} out of ${fallingLetters.length} tiles`);
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


// Calculate score for a word with bonuses
export function calculateWaxleScore(
    baseWordScore: number,
    round: number,
    tilesCleared: number,
    isCombo: boolean
): number {
    let score = baseWordScore;

    // Round multiplier
    score *= (1 + round * 0.1);

    // Tiles cleared bonus
    score += tilesCleared * 10;

    // Combo multiplier
    if (isCombo) {
        score *= 1.5;
    }

    return Math.floor(score);
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