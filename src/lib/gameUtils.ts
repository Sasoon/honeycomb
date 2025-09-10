import { nanoid } from 'nanoid';
import { HexCell } from '../components/HexGrid';

// Letter distribution based on common English frequency
export const LETTER_FREQUENCY: { [key: string]: 'common' | 'medium' | 'uncommon' | 'rare' } = {
    'E': 'common', 'A': 'common', 'I': 'common', 'O': 'common', 'N': 'common', 'R': 'common',
    'T': 'common', 'L': 'common', 'S': 'common', 'U': 'common',
    'D': 'medium', 'G': 'medium', 'B': 'medium', 'C': 'medium', 'M': 'medium', 'P': 'medium',
    'F': 'medium', 'H': 'medium', 'V': 'medium', 'W': 'medium', 'Y': 'medium',
    'K': 'uncommon', 'J': 'uncommon', 'X': 'uncommon', 'Q': 'uncommon', 'Z': 'uncommon',
};

// Letter scoring values based on rarity (Scrabble-like)
export const LETTER_VALUES: { [key: string]: number } = {
    'A': 1, 'E': 1, 'I': 1, 'O': 1, 'N': 1, 'R': 1, 'T': 1, 'L': 1, 'S': 1, 'U': 1,
    'D': 2, 'G': 2,
    'B': 3, 'C': 3, 'M': 3, 'P': 3,
    'F': 4, 'H': 4, 'V': 4, 'W': 4, 'Y': 4,
    'K': 5,
    'J': 8, 'X': 8,
    'Q': 10, 'Z': 10
};

// Calculate estimated word score for preview (matches new golden rules scoring)
export const calculateDisplayWordScore = (
    word: string, 
    round: number = 1, 
    adjacentEdges: number = 0
): number => {
    if (!word || word.length < 3) return 0;
    
    // Rule 1: Base score is word length squared
    const baseScore = word.length * word.length;
    
    // Rule 2: Each adjacent edge adds 0.5x multiplier
    const adjacencyMultiplier = 1 + (adjacentEdges * 0.5);
    
    // Rule 3: Round multiplier based on flood difficulty (every 3 rounds)
    const roundMultiplier = Math.max(1, Math.floor(round / 3));
    
    const finalScore = baseScore * adjacencyMultiplier * roundMultiplier;
    
    return Math.floor(finalScore);
};

// Target score to win
export const TARGET_SCORE = 100;

// Max tiles that can be placed per turn
export const MAX_PLACEMENT_TILES = 2;

// Removed unused letter tile generation functions - now using Tetris variant

// Generate the initial grid
export const generateInitialGrid = (size: number, skipPrePlaced = false): HexCell[] => {
    const grid: HexCell[] = [];
    const mid = Math.floor(size / 2);

    // Create empty grid
    for (let r = 0; r < size; r++) {
        const offset = Math.abs(r - mid);
        const cols = size - offset;

        for (let c = 0; c < cols; c++) {
            grid.push({
                id: nanoid(),
                position: { row: r, col: c + (size - cols) / 2 },
                letter: '',
                isPrePlaced: false,
                isSelected: false,
                isPlaced: false,
                isDoubleScore: false
            });
        }
    }

    // Add 2 double score tiles at symmetric positions
    const doubleScorePositions = [
        { row: mid - 1, col: mid - 1 },
        { row: mid + 1, col: mid + 1 }
    ];

    doubleScorePositions.forEach(pos => {
        const cell = grid.find(c =>
            c.position.row === pos.row &&
            c.position.col === pos.col
        );
        if (cell) {
            cell.isDoubleScore = true;
        }
    });

    // Pre-place 3 random tiles in a cluster in the center (skip for daily challenges)
    if (!skipPrePlaced) {
        const centerTiles = grid.filter(cell =>
            Math.abs(cell.position.row - mid) <= 1 &&
            Math.abs(cell.position.col - mid) <= 1
        );

        // First, get the exact center tile as our anchor point
        const centerTile = grid.find(cell =>
            cell.position.row === mid &&
            cell.position.col === mid
        );

        if (centerTile) { // Only proceed if center tile exists
            // Find tiles adjacent to the center
            const adjacentTiles = centerTiles.filter(cell =>
                isAdjacent(cell, centerTile) &&
                cell.id !== centerTile.id
            );

            // Shuffle the adjacent tiles and take 2
            const shuffledAdjacentTiles = adjacentTiles
                .sort(() => Math.random() - 0.5)
                .slice(0, 2);

            // Our cluster is the center tile + 2 adjacent tiles
            const clusterTiles = [centerTile, ...shuffledAdjacentTiles];

            // Generate 3 random letters (biased toward vowels for playability)
            const vowels = ['A', 'E', 'I', 'O', 'U'];
            const consonants = ['B', 'C', 'D', 'F', 'G', 'H', 'L', 'M', 'N', 'P', 'R', 'S', 'T'];

            const getRandomLetter = () => {
                // 40% chance of vowel, 60% chance of consonant
                if (Math.random() < 0.4) {
                    return vowels[Math.floor(Math.random() * vowels.length)];
                } else {
                    return consonants[Math.floor(Math.random() * consonants.length)];
                }
            };

            const randomLetters = Array(3).fill(0).map(() => getRandomLetter());

            // Place the random letters in our cluster
            clusterTiles.forEach((cell, index) => {
                if (index < randomLetters.length) {
                    cell.letter = randomLetters[index];
                    cell.isPrePlaced = true;
                    cell.isPlaced = true;
                }
            });
        }
    }

    return grid;
};

// Simple adjacency check for clicking on cells
export const isAdjacentToCell = (cell1: HexCell, cell2: HexCell): boolean => {
    const p1 = cell1.position;
    const p2 = cell2.position;

    // Same cell
    if (p1.row === p2.row && p1.col === p2.col) return false;

    // Distance between cells - using Manhattan distance for simplicity
    const rowDiff = Math.abs(p1.row - p2.row);
    const colDiff = Math.abs(p1.col - p2.col);

    // Hexagonal grids have special adjacency rules
    // For simplicity, we'll use a more permissive rule:
    // Cells are adjacent if they are at most 1 row and 1 column apart
    return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
};

// More detailed adjacency check for score calculation
export const isAdjacent = (cell1: HexCell, cell2: HexCell): boolean => {
    const p1 = cell1.position;
    const p2 = cell2.position;

    // Same position
    if (p1.row === p2.row && p1.col === p2.col) return false;

    // Row difference more than 1, not adjacent
    if (Math.abs(p1.row - p2.row) > 1) return false;

    // Even rows connect differently than odd rows
    if (p1.row % 2 === 0) {
        // Even row
        if (p1.row === p2.row) {
            // Same row, must be 1 column apart
            return Math.abs(p1.col - p2.col) === 1;
        } else if (p1.row + 1 === p2.row) {
            // Below, column must be same or one less
            return p1.col === p2.col || p1.col - 1 === p2.col;
        } else if (p1.row - 1 === p2.row) {
            // Above, column must be same or one less
            return p1.col === p2.col || p1.col - 1 === p2.col;
        }
    } else {
        // Odd row
        if (p1.row === p2.row) {
            // Same row, must be 1 column apart
            return Math.abs(p1.col - p2.col) === 1;
        } else if (p1.row + 1 === p2.row) {
            // Below, column must be same or one more
            return p1.col === p2.col || p1.col + 1 === p2.col;
        } else if (p1.row - 1 === p2.row) {
            // Above, column must be same or one more
            return p1.col === p2.col || p1.col + 1 === p2.col;
        }
    }

    return false;
};

// Calculate the score for a word
export const calculateWordScore = (path: HexCell[], grid: HexCell[]): number => {
    // Basic score: 1 point per letter
    let wordScore = path.length;

    // Check for double letter bonus
    const letters = path.map(cell => cell.letter);
    for (let i = 0; i < letters.length - 1; i++) {
        if (letters[i] === letters[i + 1]) {
            wordScore += 2;
            break;
        }
    }

    // Check for double score hex
    if (path.some(cell => cell.isDoubleScore)) {
        wordScore *= 2;
    }

    // Adjacency bonus: +1 for each adjacent letter not in the word path
    const adjacentBonus = path.reduce((bonus, cell) => {
        const adjacentCells = grid.filter((c: HexCell) =>
            c.letter &&
            !path.includes(c) &&
            isAdjacent(cell, c)
        );
        return bonus + adjacentCells.length;
    }, 0);

    wordScore += adjacentBonus;

    return wordScore;
};

// Game over logic moved to Tetris store - this was for classic game 