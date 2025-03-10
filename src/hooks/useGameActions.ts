import { useState, useEffect } from 'react';
import { useActiveGameStore, WordHistoryEntry } from '../store/activeGameStore';
import { HexCell } from '../components/HexGrid';
import { LetterTile } from '../components/PlayerHand';
import wordValidator from '../lib/wordValidator';
import toast from 'react-hot-toast';
import {
    generateInitialGrid,
    generateLetterBag,
    isAdjacentToCell,
    calculateWordScore,
    checkGameOver,
    MAX_PLACEMENT_TILES,
    PathConnection
} from '../lib/gameUtils';
import VictoryScreen from '../components/VictoryScreen';

export interface GameActionsResult {
    isWordValid: boolean;
    isWordAlreadyScored: boolean;
    potentialScore: number;
    isShuffleAnimating: boolean;
    pathConnections: PathConnection[];
    handleTileSelect: (tile: LetterTile) => void;
    handleCellClick: (cell: HexCell) => void;
    handleEndPlacementPhase: () => void;
    handleResetWord: () => void;
    handleScoreWord: () => void;
    handleBurnWithAnimation: () => void;
    drawTiles: (count: number) => void;
    showVictoryScreen: () => void;
}

export function useGameActions(): GameActionsResult {
    const [isWordValid, setIsWordValid] = useState(false);
    const [isWordAlreadyScored, setIsWordAlreadyScored] = useState(false);
    const [potentialScore, setPotentialScore] = useState(0);
    const [isShuffleAnimating, setIsShuffleAnimating] = useState(false);
    const [pathConnections, setPathConnections] = useState<PathConnection[]>([]);

    const {
        gameInitialized,
        grid,
        gridSize,
        letterBag,
        playerHand,
        selectedHandTile,
        currentWord,
        wordPath,
        score,
        turns,
        isPlacementPhase,
        placedTilesThisTurn,
        scoredWords: scoredWordsArray,
        cursedWord,
        cursedWordHint,
        setGameState,
        resetGame,
        wordHistory
    } = useActiveGameStore();

    // Convert the scoredWords array to a Set for faster lookups
    const scoredWords = new Set<string>(scoredWordsArray);

    // Initialize the game if not already done
    useEffect(() => {
        if (!gameInitialized) {
            const initialGrid = generateInitialGrid(gridSize);
            const initialLetterBag = generateLetterBag();
            const initialHand: LetterTile[] = [];

            // Draw initial hand
            const drawnTiles = initialLetterBag.slice(0, 5);
            const remainingBag = initialLetterBag.slice(5);

            setGameState({
                gameInitialized: true,
                grid: initialGrid,
                letterBag: remainingBag,
                playerHand: drawnTiles,
                score: 0,
                turns: 0,
                isPlacementPhase: true,
                scoredWords: []
            });
        }
    }, [gameInitialized, setGameState, gridSize]);

    // Update the useEffect that checks word validity to also calculate potential score
    useEffect(() => {
        if (currentWord.length >= 3) {
            // Get the actual word from letters (more reliable than state)
            const wordFromPath = wordPath.map(cell => cell.letter).join('');

            // Check if word is valid
            const valid = wordValidator.isValidWord(wordFromPath);

            // Check if the word has already been scored
            const isAlreadyScored = scoredWords.has(wordFromPath);

            setIsWordValid(valid && !isAlreadyScored);
            setIsWordAlreadyScored(valid && isAlreadyScored);

            // Calculate potential score if word is valid
            if (valid && !isAlreadyScored) {
                const score = calculateWordScore(wordFromPath, wordPath, grid);
                setPotentialScore(score);
            } else {
                setPotentialScore(0);
            }

            if (valid && isAlreadyScored) {
                // Show toast notification only once per word
                toast.error(`"${wordFromPath}" has already been scored!`, {
                    id: `duplicate-${wordFromPath}`,
                    duration: 2000,
                });
            }
        } else {
            setIsWordValid(false);
            setIsWordAlreadyScored(false);
            setPotentialScore(0);
        }
    }, [currentWord, scoredWords, wordPath, grid]);

    // Draw tiles from the bag to the player's hand
    const drawTiles = (count: number) => {
        if (letterBag.length === 0) return;

        const newBag = [...letterBag];
        const drawnTiles = newBag.splice(0, Math.min(count, newBag.length));

        setGameState({
            letterBag: newBag,
            playerHand: [...playerHand, ...drawnTiles]
        });
    };

    const handleTileSelect = (tile: LetterTile) => {
        if (!isPlacementPhase) return;

        // Deselect if already selected
        if (tile.isSelected) {
            setGameState({
                playerHand: playerHand.map(t =>
                    t.id === tile.id ? { ...t, isSelected: false } : t
                ),
                selectedHandTile: null
            });
            return;
        }

        // Deselect any previously selected tile
        const newHand = playerHand.map(t => ({
            ...t,
            isSelected: t.id === tile.id
        }));

        setGameState({
            playerHand: newHand,
            selectedHandTile: { ...tile, isSelected: true }
        });
    };

    const handleCellClick = (cell: HexCell) => {
        if (isPlacementPhase) {
            // Placement phase logic

            // If the cell already has a letter, do nothing
            if (cell.letter) return;

            // If we already placed the maximum number of tiles, show a message and return
            if (placedTilesThisTurn.length >= MAX_PLACEMENT_TILES) {
                toast.error(`You can only place ${MAX_PLACEMENT_TILES} tiles per turn.`);
                return;
            }

            // If no tile is selected from the hand, do nothing
            if (!selectedHandTile) return;

            // Place the letter from the selected hand tile into the cell
            const updatedGrid = grid.map(c => {
                if (c.id === cell.id) {
                    return {
                        ...c,
                        letter: selectedHandTile.letter,
                        isPlaced: true,
                        isDoubleScore: c.isDoubleScore || false
                    };
                }
                return c;
            });

            // Remove the placed tile from the hand
            const updatedHand = playerHand.filter(t => t.id !== selectedHandTile.id);

            // Update the state
            setGameState({
                grid: updatedGrid,
                playerHand: updatedHand,
                selectedHandTile: null,
                placedTilesThisTurn: [...placedTilesThisTurn, {
                    ...cell,
                    letter: selectedHandTile.letter,
                    isPlaced: true
                }]
            });
        } else {
            // Word formation phase - Updated to support double usage

            // Skip empty cells
            if (!cell.letter) return;

            // Find if this cell is already in the word path
            const pathIndex = wordPath.findIndex(pathCell => pathCell.id === cell.id);

            if (pathIndex !== -1) {
                // Cell is already in the path

                // If it's the last letter, remove it
                if (pathIndex === wordPath.length - 1) {
                    // Remove this letter from the word path
                    const newPath = wordPath.slice(0, wordPath.length - 1);

                    // Update connections
                    let newConnections = [...pathConnections];
                    if (newConnections.length > 0) {
                        // Remove the last connection
                        newConnections = newConnections.slice(0, newConnections.length - 1);
                    }

                    // Update grid to reflect selection
                    const updatedGrid = grid.map(c => ({
                        ...c,
                        isSelected: newPath.some(p => p.id === c.id)
                    }));

                    // Update state
                    setGameState({
                        wordPath: newPath,
                        grid: updatedGrid,
                        currentWord: newPath.map(c => c.letter).join('')
                    });
                    setPathConnections(newConnections);
                }
                // If it's the first letter, reset the entire word
                else if (pathIndex === 0) {
                    handleResetWord();
                }
                // Don't allow adding a cell that was just used (preventing immediate backtracking)
                else if (pathIndex === wordPath.length - 2) {
                    // Can't backtrack to the previous cell
                    toast.error("Can't backtrack to the previous cell");
                    return;
                }
                else {
                    // For any other existing cell - allow reusing if not at maximum
                    const occurrences = wordPath.filter(p => p.id === cell.id).length;
                    if (occurrences >= 2) {
                        toast.error("Cell already used twice");
                        return;
                    }

                    // Check adjacency with last cell
                    const lastCell = wordPath[wordPath.length - 1];
                    if (!isAdjacentToCell(cell, lastCell)) {
                        toast.error("Cell must be adjacent to the last selected cell");
                        return;
                    }

                    // Add this letter to the word path again
                    const newPath = [...wordPath, cell];

                    // Create connection with dotted line
                    const newConnections = [...pathConnections, {
                        from: lastCell.id,
                        to: cell.id,
                        dotted: true
                    }];

                    // Update grid to reflect selection
                    const updatedGrid = grid.map(c => ({
                        ...c,
                        isSelected: newPath.some(p => p.id === c.id)
                    }));

                    // Update state
                    setGameState({
                        wordPath: newPath,
                        grid: updatedGrid,
                        currentWord: newPath.map(c => c.letter).join('')
                    });
                    setPathConnections(newConnections);
                }
            } else {
                // Cell is not in path, attempt to add it

                // Check if this cell is adjacent to the last selected cell or is the first cell
                const canAddCell =
                    wordPath.length === 0 ||
                    isAdjacentToCell(cell, wordPath[wordPath.length - 1]);

                if (canAddCell) {
                    // Add this letter to the word path
                    const newPath = [...wordPath, cell];

                    // Create new connection
                    let newConnections = [...pathConnections];
                    if (wordPath.length > 0) {
                        const lastCell = wordPath[wordPath.length - 1];
                        // For first use of a cell, use solid line
                        newConnections.push({
                            from: lastCell.id,
                            to: cell.id,
                            dotted: false
                        });
                    }

                    // Update grid to reflect selection
                    const updatedGrid = grid.map(c => ({
                        ...c,
                        isSelected: newPath.some(p => p.id === c.id)
                    }));

                    // Update state
                    setGameState({
                        wordPath: newPath,
                        grid: updatedGrid,
                        currentWord: newPath.map(c => c.letter).join('')
                    });
                    setPathConnections(newConnections);
                } else {
                    toast.error("You can only add adjacent cells to your word.");
                }
            }
        }
    };

    const handleEndPlacementPhase = () => {
        if (isPlacementPhase) {
            // Require at least one tile to be placed before ending the placement phase
            if (placedTilesThisTurn.length === 0) {
                toast.error("You must place at least one tile before scoring.");
                return;
            }

            // End placement phase, begin scoring phase
            setGameState({
                isPlacementPhase: false,
                placedTilesThisTurn: []
            });
        }

        // After ending placement phase, check if the game is over
        setTimeout(() => {
            if (checkGameOver(grid, letterBag)) {
                showVictoryScreen();
            }
        }, 500);
    };

    const handleResetWord = () => {
        const updatedGrid = grid.map(cell => ({
            ...cell,
            isSelected: false
        }));

        setGameState({
            wordPath: [],
            grid: updatedGrid,
            currentWord: ''
        });

        // Clear path connections
        setPathConnections([]);
    };

    const updateCursedWordHint = () => {
        // Check if current word shares prefix with cursed word
        const currentWordUpper = currentWord.toUpperCase();
        let revealedCount = 1; // Start with just first letter

        for (let i = 0; i < Math.min(currentWordUpper.length, cursedWord.length); i++) {
            if (currentWordUpper.substring(0, i + 1) === cursedWord.substring(0, i + 1)) {
                revealedCount = i + 1;
            }
        }

        // Update the hint
        let newHint = '';
        for (let i = 0; i < cursedWord.length; i++) {
            newHint += i < revealedCount ? cursedWord[i] : ' _ ';
        }

        setGameState({
            cursedWordHint: newHint
        });
    };

    const finishTurn = () => {
        // Calculate how many tiles need to be drawn to maintain a hand of 5
        const tilesToDraw = 5 - playerHand.length;

        // Draw new tiles if available
        let updatedHand = [...playerHand];
        if (tilesToDraw > 0 && letterBag.length > 0) {
            const newTiles: LetterTile[] = [];

            // Draw up to tilesToDraw tiles or as many as available in the bag
            for (let i = 0; i < Math.min(tilesToDraw, letterBag.length); i++) {
                const tileIndex = Math.floor(Math.random() * letterBag.length);
                const tile = letterBag[tileIndex];
                newTiles.push(tile);
            }

            // Remove drawn tiles from the bag
            const updatedBag = letterBag.filter(tile => !newTiles.includes(tile));

            // Add new tiles to hand
            updatedHand = [...playerHand, ...newTiles];

            // Update the state with the new hand and bag
            setGameState({
                playerHand: updatedHand,
                letterBag: updatedBag
            });
        }

        // Increment turn counter and reset for next turn
        setGameState({
            turns: turns + 1,
            isPlacementPhase: true,
            placedTilesThisTurn: []
        });
    };

    const handleScoreWord = () => {
        if (wordPath.length < 3) return;

        const currentWord = wordPath.map(cell => cell.letter).join('');
        if (!wordValidator.isValidWord(currentWord)) {
            toast.error(`"${currentWord}" is not a valid word.`);
            return;
        }

        // Check if this word has already been used
        if (scoredWords.has(currentWord)) {
            toast.error(`You've already used "${currentWord}" in this game.`);
            return;
        }

        // Calculate score
        const wordScore = calculateWordScore(currentWord, wordPath, grid);

        // Update cursed word hint if the word is related
        updateCursedWordHint();

        // Create a path key to potentially highlight this path later
        const pathKey = wordPath.map(cell => `${cell.position.row}-${cell.position.col}`).join(',');

        // Add to word history
        const historyEntry: WordHistoryEntry = {
            word: currentWord,
            score: wordScore,
            turn: turns,
            pathKey
        };

        // Mark the word as used in the validator
        wordValidator.markWordAsUsed(currentWord);

        // Get the updated scoredWords array for the store
        const updatedScoredWords = [...scoredWordsArray, currentWord];

        // Reset all cell highlighting in the grid
        const updatedGrid = grid.map(cell => ({
            ...cell,
            isSelected: false
        }));

        setGameState({
            score: score + wordScore,
            scoredWords: updatedScoredWords,
            wordHistory: [...wordHistory, historyEntry],
            currentWord: '',
            wordPath: [],
            isPlacementPhase: true,
            grid: updatedGrid
        });

        // Clear path connections
        setPathConnections([]);

        toast.success(`+${wordScore} points for "${currentWord}"!`);

        // End the turn after scoring
        finishTurn();

        // After updating the state with the scored word, check if game is over
        setTimeout(() => {
            if (checkGameOver(grid, letterBag)) {
                showVictoryScreen();
            }
        }, 500);
    };

    // Handle burning a tile (replacing the reshuffle function)
    const handleBurnTile = () => {
        // Can only burn in placement phase and when a tile is selected
        if (!isPlacementPhase || !selectedHandTile) {
            return;
        }

        // Remove the selected tile from the player's hand
        const updatedHand = playerHand.filter(tile => tile.id !== selectedHandTile.id);

        // Draw a new tile if there are tiles in the bag
        let newTile = null;
        if (letterBag.length > 0) {
            newTile = letterBag[0];
            const remainingBag = letterBag.slice(1);

            // Update game state with the new hand and bag
            setGameState({
                playerHand: [...updatedHand, newTile],
                letterBag: remainingBag,
                selectedHandTile: null
            });

            toast.success(`Burned tile "${selectedHandTile.letter}" and drew "${newTile.letter}"`);
        } else {
            // No tiles left to draw
            setGameState({
                playerHand: updatedHand,
                selectedHandTile: null
            });

            toast.success(`Burned tile "${selectedHandTile.letter}" (no tiles left to draw)`);
        }

        // After burning, check if game is over due to empty deck
        setTimeout(() => {
            if (checkGameOver(grid, letterBag)) {
                showVictoryScreen();
            }
        }, 500);
    };

    // Replace the handleShuffleWithAnimation with handleBurnWithAnimation
    const handleBurnWithAnimation = () => {
        // Check if we're in placement phase and have a selected tile
        if (!isPlacementPhase || !selectedHandTile) {
            if (!isPlacementPhase) {
                toast.error('Can only burn tiles during placement phase');
            } else if (!selectedHandTile) {
                toast.error('Select a tile to burn first');
            }
            return;
        }

        if (!isShuffleAnimating) {
            setIsShuffleAnimating(true);
            // Reset animation state after animation completes
            setTimeout(() => setIsShuffleAnimating(false), 500);
            // Call the actual burn function
            handleBurnTile();
        }
    };

    // Show victory screen
    const showVictoryScreen = () => {
        // Calculate board completion percentage
        const totalCells = grid.length;
        const filledCells = grid.filter(cell => cell.letter).length;
        const completionPercentage = Math.round((filledCells / totalCells) * 100);

        // Check if high score
        const isHighScore = localStorage.getItem('highScore') ?
            score > parseInt(localStorage.getItem('highScore') || '0') : true;

        if (isHighScore) {
            localStorage.setItem('highScore', score.toString());
        }

        // Simplified victory screen without using JSX or DOM manipulation
        const message = `Game Over! Score: ${score} points | Board filled: ${completionPercentage}%`;
        toast.success(message, {
            duration: 5000,
            position: 'top-center'
        });
    };

    return {
        isWordValid,
        isWordAlreadyScored,
        potentialScore,
        isShuffleAnimating,
        pathConnections,
        handleTileSelect,
        handleCellClick,
        handleEndPlacementPhase,
        handleResetWord,
        handleScoreWord,
        handleBurnWithAnimation,
        drawTiles,
        showVictoryScreen
    };
} 