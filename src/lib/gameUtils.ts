import { nanoid } from 'nanoid';
import { HexCell } from '../components/HexGrid';
import { isHexAdjacent } from './waxleGameUtils';

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
    _round: number = 1,
    adjacentEdges: number = 0
): number => {
    if (!word || word.length < 3) return 0;
    const letterPoints = 2 * word.length;
    const adjacencyBonus = Math.min(adjacentEdges, 4);
    return letterPoints + adjacencyBonus;
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
                isHexAdjacent(cell, centerTile) &&
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
