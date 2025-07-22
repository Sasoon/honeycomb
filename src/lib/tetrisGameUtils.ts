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
export function generateDropLetters(count: number, _round: number): string[] {
    const letters: string[] = [];

    // For now, just generate regular letters
    // Special tiles can be added later as a power-up or special round
    for (let i = 0; i < count; i++) {
        letters.push(generateRandomLetter());
    }

    return letters;
}

// Check if the game is over (top row has tiles)
export function checkTetrisGameOver(grid: HexCell[]): boolean {
    // Find cells in the top row (row 0)
    const topRowCells = grid.filter(cell => cell.position.row === 0);

    // Game is over if ALL cells in the top row have tiles
    // This means there's no room for new tiles to drop
    const filledTopCells = topRowCells.filter(cell => cell.letter && cell.isPlaced);

    return filledTopCells.length === topRowCells.length;
}

// Apply falling letters to the grid
export function applyFallingTiles(
    grid: HexCell[],
    fallingLetters: string[],
    gridSize: number
): HexCell[] {
    // Clone grid
    const newGrid = grid.map(cell => ({ ...cell }));

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
            // Adjacent if column difference is 0 or 0.5
            if (colDiff < 0.6) {
                possibleCells.push(belowCell);
            }
        });

        return possibleCells.filter(c => !c.letter);
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
            const cellsInRow = newGrid.filter(cell =>
                cell.position.row === row && cell.letter && cell.isPlaced
            );

            cellsInRow.forEach(cell => {
                const possibleMoves = findCellsBelow(cell);

                // If there are possible moves, pick one (preferably straight down)
                if (possibleMoves.length > 0) {
                    // Prefer the cell directly below (same column) if available
                    const directBelow = possibleMoves.find(c => c.position.col === cell.position.col);
                    const targetCell = directBelow || possibleMoves[0];

                    // Move the letter
                    targetCell.letter = cell.letter;
                    targetCell.isPlaced = true;
                    cell.letter = '';
                    cell.isPlaced = false;
                    changesMade = true;
                }
            });
        }
    }

    // Now add new falling letters at the top row
    const topCells = newGrid
        .filter(cell => cell.position.row === 0)
        .sort((a, b) => a.position.col - b.position.col);

    // Calculate which columns to drop letters into
    const availableColumns = topCells.filter(cell => !cell.letter);

    if (availableColumns.length === 0) {
        // No room for new tiles - game should be over
        return newGrid;
    }

    // Distribute letters evenly across columns from left to right
    const dropCount = Math.min(fallingLetters.length, availableColumns.length);

    // If we have fewer letters than columns, space them out
    if (dropCount < availableColumns.length) {
        const spacing = Math.floor(availableColumns.length / dropCount);
        for (let i = 0; i < dropCount; i++) {
            const columnIndex = Math.min(i * spacing, availableColumns.length - 1);
            availableColumns[columnIndex].letter = fallingLetters[i];
            availableColumns[columnIndex].isPlaced = true;
        }
    } else {
        // Place letters from left to right
        for (let i = 0; i < dropCount; i++) {
            availableColumns[i].letter = fallingLetters[i];
            availableColumns[i].isPlaced = true;
        }
    }

    // Apply complete physics simulation until all tiles have settled
    changesMade = true;
    iterations = 0;

    while (changesMade && iterations < maxIterations) {
        changesMade = false;
        iterations++;

        // Process ALL tiles from bottom to top, left to right for consistent behavior
        for (let row = gridSize - 2; row >= 0; row--) {
            const cellsInRow = newGrid.filter(cell =>
                cell.position.row === row && cell.letter && cell.isPlaced
            ).sort((a, b) => a.position.col - b.position.col); // Process left to right

            cellsInRow.forEach(cell => {
                const possibleMoves = findCellsBelow(cell);

                // If there are possible moves, pick one
                if (possibleMoves.length > 0) {
                    // Prefer the cell directly below (same column) if available
                    const directBelow = possibleMoves.find(c => c.position.col === cell.position.col);
                    const targetCell = directBelow || possibleMoves[0];

                    // Move the letter
                    targetCell.letter = cell.letter;
                    targetCell.isPlaced = true;
                    cell.letter = '';
                    cell.isPlaced = false;
                    changesMade = true;
                }
            });
        }
    }

    return newGrid;
}

// Clear selected tiles and apply gravity
export function clearTilesAndApplyGravity(
    grid: HexCell[],
    tilesToClear: string[]
): { newGrid: HexCell[], tilesCleared: number } {
    let newGrid = grid.map(cell => ({ ...cell }));
    let tilesCleared = 0;

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
            // Adjacent if column difference is 0 or 0.5
            if (colDiff < 0.6) {
                possibleCells.push(belowCell);
            }
        });

        return possibleCells.filter(c => !c.letter);
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
    const gridSize = Math.max(...newGrid.map(c => c.position.row)) + 1;
    const maxIterations = gridSize * 2;
    let iterations = 0;

    while (changesMade && iterations < maxIterations) {
        changesMade = false;
        iterations++;

        // Process from bottom to top
        for (let row = gridSize - 2; row >= 0; row--) {
            const cellsInRow = newGrid.filter(cell =>
                cell.position.row === row && cell.letter && cell.isPlaced
            );

            cellsInRow.forEach(cell => {
                const possibleMoves = findCellsBelow(cell);

                // If there are possible moves, pick one (randomly if multiple)
                if (possibleMoves.length > 0) {
                    const targetCell = possibleMoves.length === 1
                        ? possibleMoves[0]
                        : possibleMoves[Math.floor(Math.random() * possibleMoves.length)];

                    // Move the letter
                    targetCell.letter = cell.letter;
                    targetCell.isPlaced = true;
                    cell.letter = '';
                    cell.isPlaced = false;
                    changesMade = true;
                }
            });
        }
    }

    return { newGrid, tilesCleared };
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