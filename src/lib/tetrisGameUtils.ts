import { HexCell } from '../components/HexGrid';
import { PowerCard } from '../store/tetrisGameStore';

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

function weightedSample(weights: Record<string, number>, count: number): string[] {
    const result: string[] = [];
    const letters = Object.keys(weights);
    for (let i = 0; i < count; i++) {
        const total = letters.reduce((sum, l) => sum + weights[l], 0);
        let r = Math.random() * total;
        for (const l of letters) {
            r -= weights[l];
            if (r <= 0) { result.push(l); break; }
        }
    }
    return result;
}

// Public smart generator
export function generateDropLettersSmart(count: number, grid: HexCell[], rewardCreative = false): string[] {
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

    return weightedSample(weights, count);
}
// === End dynamic letter generation ===============================================

// Check if the game is over (top row has tiles)
export function checkTetrisGameOver(grid: HexCell[]): boolean {
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

    // BFS through empty neighbors
    while (queue.length > 0) {
        const current = queue.shift()!;
        for (const neighbor of grid) {
            if (neighbor.id === current.id) continue;
            if (air.has(neighbor.id)) continue;
            if (neighbor.letter && neighbor.isPlaced) continue;
            if (areCellsAdjacent(current, neighbor)) {
                air.add(neighbor.id);
                queue.push(neighbor);
            }
        }
    }

    return air;
}

// Apply falling letters to the grid with contiguous path flood logic
export function applyFallingTiles(
    grid: HexCell[],
    fallingLetters: string[],
    gridSize: number
): { newGrid: HexCell[]; placedCount: number; attemptedCount: number; finalPaths: Record<string, string[]>; unplacedLetters: string[] } {
    // Clone grid
    const newGrid = grid.map(cell => ({ ...cell }));

    // Reset placedThisTurn flags before a new drop
    newGrid.forEach(c => { c.placedThisTurn = false; });

    // Helper function to find cells below a given cell in a hex grid
    const findCellsBelow = (cell: HexCell): HexCell[] => {
        const possibleCells: HexCell[] = [];
        const cellRow = cell.position.row;
        const cellCol = cell.position.col;

        // Look for cells in the row below
        const cellsInRowBelow = newGrid.filter(c => c.position.row === cellRow + 1);

        // For hex grids with offset pattern:
        // The offset for odd rows means columns shift by 0.5
        cellsInRowBelow.forEach(belowCell => {
            const colDiff = Math.abs(belowCell.position.col - cellCol);
            // Adjacent if column difference is ~0 or ~0.5
            if (colDiff < 0.6) {
                possibleCells.push(belowCell);
            }
        });

        // Only return empty cells that are actually adjacent
        return possibleCells.filter(c => !c.letter && areCellsAdjacent(cell, c));
    };

    // First, apply physics-like gravity to all existing tiles
    let changesMade = true;
    const maxIterations = gridSize * 3;
    let iterations = 0;

    while (changesMade && iterations < maxIterations) {
        changesMade = false;
        iterations++;

        // Process from bottom to top to avoid conflicts
        for (let row = gridSize - 2; row >= 0; row--) {
            const cellsInRow = newGrid
                .filter(cell => cell.position.row === row && cell.letter && cell.isPlaced && (cell as HexCell & { placedThisTurn?: boolean }).placedThisTurn === true);

            cellsInRow.forEach(cell => {
                const possibleMoves = findCellsBelow(cell);

                // If there are possible moves, pick one (prefer straight down)
                if (possibleMoves.length > 0) {
                    // First priority: straight down
                    const directBelow = possibleMoves.find(c => c.position.col === cell.position.col);
                    // Second priority: leftmost available position (deterministic)
                    const targetCell = directBelow || possibleMoves.sort((a, b) => a.position.col - b.position.col)[0];

                    // Move the letter and its placedThisTurn tag
                    targetCell.letter = cell.letter;
                    targetCell.isPlaced = true;
                    // propagate flag
                    (targetCell as HexCell & { placedThisTurn?: boolean }).placedThisTurn = (cell as HexCell & { placedThisTurn?: boolean }).placedThisTurn || false;
                    cell.letter = '';
                    cell.isPlaced = false;
                    (cell as HexCell & { placedThisTurn?: boolean }).placedThisTurn = false;
                    changesMade = true;
                }
            });
        }
    }

    // Now apply the new contiguous path flood logic
    const { placedTiles, finalPaths, unplacedLetters } = applyFloodTilesWithContiguousPaths(newGrid, fallingLetters, gridSize);
    const placedCount = placedTiles.length;

    return { newGrid, placedCount, attemptedCount: fallingLetters.length, finalPaths, unplacedLetters };
}

// Sequential multi-wave flood logic - drop tiles in waves that fit available entry points
function applyFloodTilesWithContiguousPaths(
    grid: HexCell[],
    fallingLetters: string[],
    gridSize: number
): { placedTiles: HexCell[]; finalPaths: Record<string, string[]>; unplacedLetters: string[] } {
    const finalPaths: Record<string, string[]> = {};
    const allPlacedTiles: HexCell[] = [];

    // Track positions occupied by flood tiles that have already resolved their paths
    // Initialize with all existing tiles on the grid (pre-flood state)
    const globalOccupiedPositions = new Set<string>(
        grid.filter(cell => cell.letter && cell.isPlaced).map(cell => cell.id)
    );

    // Debug logging
    if (typeof console !== 'undefined') {
        console.log(`[FLOOD-WAVES] Processing ${fallingLetters.length} tiles in sequential waves`);
        console.log(`[FLOOD-WAVES] Initial occupied positions: ${Array.from(globalOccupiedPositions).length}`);
        console.log(`[FLOOD-WAVES] Pre-existing tiles: ${Array.from(globalOccupiedPositions).join(', ')}`);
    }

    // Split letters into waves based on available entry points
    const remainingLetters = [...fallingLetters];
    let waveNumber = 0;
    const maxWaves = 5; // Safety limit

    while (remainingLetters.length > 0 && waveNumber < maxWaves) {
        waveNumber++;

        // Get available entry points for this wave
        const reachableAir = computeReachableAir(grid);
        const topRowCells = grid.filter(cell => cell.position.row === 0);
        const emptyTopCells = topRowCells.filter(cell => !cell.letter && reachableAir.has(cell.id));
        const notGloballyOccupied = emptyTopCells.filter(cell => !globalOccupiedPositions.has(cell.id));

        if (typeof console !== 'undefined') {
            console.log(`[FLOOD-WAVES] Wave ${waveNumber}: Top row analysis:`);
            console.log(`  - Total top row cells: ${topRowCells.length}`);
            console.log(`  - Empty top cells (reachable): ${emptyTopCells.length}`);
            console.log(`  - Not globally occupied: ${notGloballyOccupied.length}`);
            console.log(`  - Global occupied positions: ${Array.from(globalOccupiedPositions).length}`);
            console.log(`  - Current grid state:`, topRowCells.map(c => `(${c.position.row},${c.position.col}):${c.letter || 'empty'}`));
        }

        const availableEntries = notGloballyOccupied.sort((a, b) => a.position.col - b.position.col);

        if (availableEntries.length === 0) {
            if (typeof console !== 'undefined') {
                console.log(`[FLOOD-WAVES] Wave ${waveNumber}: No entry points available, stopping`);
                console.log(`[FLOOD-WAVES] Remaining letters: ${remainingLetters.join(', ')}`);
            }
            break;
        }

        // Process up to available entry points, but try to place as many as possible by cycling entries
        const waveSize = Math.min(remainingLetters.length, availableEntries.length);
        const currentWave = remainingLetters.splice(0, waveSize);

        if (typeof console !== 'undefined') {
            console.log(`[FLOOD-WAVES] Wave ${waveNumber}: Processing ${currentWave.length} tiles with ${availableEntries.length} entry points`);
        }

        // Process this wave with standard flood logic
        const waveResult = processFloodWave(grid, currentWave, availableEntries, globalOccupiedPositions, gridSize);

        // Collect results from this wave
        allPlacedTiles.push(...waveResult.placedTiles);
        Object.assign(finalPaths, waveResult.finalPaths);
        // Reinsert failed letters into remainingLetters for the next waves
        if (waveResult.failedLetters && waveResult.failedLetters.length > 0) {
            remainingLetters.unshift(...waveResult.failedLetters);
        }

        // Reserve final landing positions and path segments globally (except top row) to prevent phasing across waves
        waveResult.placedTiles.forEach(tile => {
            globalOccupiedPositions.add(tile.id);
            const tilePath = finalPaths[tile.id];
            if (tilePath) {
                tilePath.forEach(pathCellId => {
                    const pathCell = grid.find(c => c.id === pathCellId);
                    if (pathCell && pathCell.position.row > 0) {
                        globalOccupiedPositions.add(pathCellId);
                    }
                });
            }
        });

        if (typeof console !== 'undefined') {
            console.log(`[FLOOD-WAVES] Wave ${waveNumber}: Reserved ${waveResult.placedTiles.length} final positions`);
            console.log(`[FLOOD-WAVES] Total global occupancy: ${Array.from(globalOccupiedPositions).length} positions`);
        }

        // If this wave couldn't place any tiles, stop to prevent infinite loop
        if (waveResult.placedTiles.length === 0) {
            if (typeof console !== 'undefined') {
                console.log(`[FLOOD-WAVES] Wave ${waveNumber}: No tiles placed, stopping`);
            }
            break;
        }
    }

    if (typeof console !== 'undefined') {
        console.log(`[FLOOD-WAVES] Completed ${waveNumber} waves, placed ${allPlacedTiles.length} out of ${fallingLetters.length} tiles`);
    }

    return { placedTiles: allPlacedTiles, finalPaths, unplacedLetters: remainingLetters };
}

// Process a single wave of flood tiles
function processFloodWave(
    grid: HexCell[],
    waveLetters: string[],
    entryPoints: HexCell[],
    globalOccupied: Set<string>,
    gridSize: number
): { placedTiles: HexCell[]; finalPaths: Record<string, string[]>; failedLetters: string[] } {
    const placedTiles: HexCell[] = [];
    const finalPaths: Record<string, string[]> = {};
    const waveOccupied = new Set<string>(globalOccupied);
    const failedLetters: string[] = [];

    // Check if a position is connected to existing tiles
    const isPositionConnected = (cell: HexCell): boolean => {
        return grid.some(adjacentCell =>
            adjacentCell.letter &&
            adjacentCell.isPlaced &&
            areCellsAdjacent(cell, adjacentCell)
        );
    };

    // Find contiguous path for a single tile with preference for deepest positions
    const findFloodPath = (startCell: HexCell): { path: HexCell[]; finalCell: HexCell | null } => {
        const path: HexCell[] = [startCell];
        let currentCell = startCell;
        const visitedIds = new Set<string>([startCell.id]);

        if (typeof console !== 'undefined') {
            console.log(`[FLOOD-PATH] Starting path from (${startCell.position.row},${startCell.position.col})`);
        }

        while (true) {
            // Prefer straight down first, then diagonal
            const straightDown = grid.filter(cell =>
                cell.position.row === currentCell.position.row + 1 &&
                Math.abs(cell.position.col - currentCell.position.col) < 0.1 &&
                areCellsAdjacent(currentCell, cell) &&
                !cell.letter &&
                !waveOccupied.has(cell.id) &&
                !visitedIds.has(cell.id)
            );

            const diagonalCandidates = grid.filter(cell =>
                cell.position.row === currentCell.position.row + 1 &&
                areCellsAdjacent(currentCell, cell) &&
                Math.abs(cell.position.col - currentCell.position.col) > 0.1 &&
                !cell.letter &&
                !waveOccupied.has(cell.id) &&
                !visitedIds.has(cell.id)
            );

            // Always prefer straight down if available
            let nextCell: HexCell | null = null;
            if (straightDown.length > 0) {
                nextCell = straightDown[0];
            } else if (diagonalCandidates.length > 0) {
                // If no straight down, use diagonal but prefer the one that leads to deeper positions
                nextCell = diagonalCandidates.sort((a, b) => {
                    // Prefer positions that have more empty space below them
                    const aSpaceBelow = grid.filter(c => c.position.row > a.position.row && !c.letter).length;
                    const bSpaceBelow = grid.filter(c => c.position.row > b.position.row && !c.letter).length;
                    return bSpaceBelow - aSpaceBelow;
                })[0];
            }

            if (!nextCell) {
                // No more moves - check if current position is connected
                if (isPositionConnected(currentCell)) {
                    return { path, finalCell: currentCell };
                } else {
                    // Find last connected position in path
                    for (let i = path.length - 1; i >= 0; i--) {
                        if (isPositionConnected(path[i])) {
                            return { path: path.slice(0, i + 1), finalCell: path[i] };
                        }
                    }
                    return { path, finalCell: null };
                }
            }

            path.push(nextCell);
            visitedIds.add(nextCell.id);
            currentCell = nextCell;

            // Safety check
            if (path.length > gridSize * 2) {
                for (let i = path.length - 1; i >= 0; i--) {
                    if (isPositionConnected(path[i])) {
                        return { path: path.slice(0, i + 1), finalCell: path[i] };
                    }
                }
                break;
            }
        }

        return { path, finalCell: currentCell };
    };

    // Single-pass attempt: try to place each letter at any viable entry
    for (const letter of waveLetters) {
        let placed = false;
        const startIdx = Math.floor(Math.random() * entryPoints.length);
        for (let k = 0; k < entryPoints.length && !placed; k++) {
            const ep = entryPoints[(startIdx + k) % entryPoints.length];
            if (waveOccupied.has(ep.id) || (ep.letter && ep.isPlaced)) continue;

            const { path, finalCell } = findFloodPath(ep);
            if (!finalCell) continue;

            // Place
            finalCell.letter = letter;
            finalCell.isPlaced = true;
            (finalCell as HexCell & { placedThisTurn?: boolean }).placedThisTurn = true;
            placedTiles.push(finalCell);
            finalPaths[finalCell.id] = path.map(c => c.id);

            // Reserve entry point, path segments (except top row), and final landing slot within this wave
            waveOccupied.add(ep.id);
            waveOccupied.add(finalCell.id);
            const tilePathIds = finalPaths[finalCell.id];
            if (tilePathIds && tilePathIds.length > 0) {
                tilePathIds.forEach(pid => {
                    const pCell = grid.find(c => c.id === pid);
                    if (pCell && pCell.position.row > 0) {
                        waveOccupied.add(pid);
                    }
                });
            }
            placed = true;
        }
        if (!placed) {
            failedLetters.push(letter);
        }
    }

    return { placedTiles, finalPaths, failedLetters };
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
        return possibleCells.filter(c => !c.letter && areCellsAdjacent(cell, c));
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

// Generate starting power cards
export function generateStartingPowerCards(): PowerCard[] {
    const starterCards: PowerCard[] = [
        {
            id: 'starter-bomb',
            type: 'bomb',
            name: '💣 Bomb',
            description: 'Clear a 3x3 area'
        },
        {
            id: 'starter-gravity',
            type: 'gravity',
            name: '⬇️ Gravity',
            description: 'Pull all tiles down'
        },
        {
            id: 'starter-wildcard',
            type: 'wildcard',
            name: '🃏 Wildcard',
            description: 'Change any letter'
        }
    ];

    return starterCards;
}

// Award power cards based on achievements
export function checkPowerCardRewards(
    wordLength: number,
    tilesCleared: number,
    combo: number
): PowerCard | null {
    // Long word bonus
    if (wordLength >= 7) {
        return {
            id: `reward-${Date.now()}`,
            type: 'laser',
            name: '⚡ Laser',
            description: 'Clear entire column'
        };
    }

    // Big clear bonus
    if (tilesCleared >= 10) {
        return {
            id: `reward-${Date.now()}`,
            type: 'slow',
            name: '🐌 Slow',
            description: 'Smaller drops for 3 rounds'
        };
    }

    // Combo bonus
    if (combo >= 3) {
        return {
            id: `reward-${Date.now()}`,
            type: 'preview',
            name: '👁️ Preview',
            description: 'See 2 rows ahead'
        };
    }

    return null;
}

// Calculate score for a word with bonuses
export function calculateTetrisScore(
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

// Check if two cells are adjacent (including diagonals)
export function areCellsAdjacent(cell1: HexCell, cell2: HexCell): boolean {
    const p1 = cell1.position;
    const p2 = cell2.position;

    // Same position
    if (p1.row === p2.row && p1.col === p2.col) return false;

    // Row difference more than 1, not adjacent
    if (Math.abs(p1.row - p2.row) > 1) return false;

    // In our hex grid:
    // - Same row: cells are adjacent if columns differ by 1
    // - Different rows: need to account for the honeycomb offset

    if (p1.row === p2.row) {
        // Same row - simple check
        return Math.abs(p1.col - p2.col) === 1;
    }

    // Different rows - check based on the honeycomb pattern
    // In a honeycomb grid, each cell has 6 neighbors
    const colDiff = p2.col - p1.col;

    // For our specific honeycomb implementation:
    // Each cell connects to 2 cells in the row above and 2 in the row below
    // The exact columns depend on the offset pattern

    // Based on the grid generation logic where middle rows have more cells:
    // We need to check if the column difference is within valid range

    // Adjacent cells in different rows can have column differences of -1, 0, or 1
    // But we need to be more precise based on actual grid layout

    return Math.abs(colDiff) <= 1;
} 