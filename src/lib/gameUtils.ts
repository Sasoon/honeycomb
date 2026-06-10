import { nanoid } from 'nanoid';
import { HexCell } from '../components/HexGrid';
import { isHexAdjacent } from './waxleGameUtils';

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
                isPlaced: false
            });
        }
    }

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
