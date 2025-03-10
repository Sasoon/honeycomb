import { useState, useEffect, useCallback, useRef } from 'react';
import { useActiveGameStore } from '../store/activeGameStore';
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
    MAX_PLACEMENT_TILES
} from '../lib/gameUtils';

export interface GameActionsResult {
    isWordValid: boolean;
    isWordAlreadyScored: boolean;
    potentialScore: number;
    isShuffleAnimating: boolean;
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

    // Use refs to track previous values to prevent unnecessary updates
    const prevWordPathRef = useRef<HexCell[]>([]);
    const prevScoreWordsRef = useRef<string[]>([]);

    // Get state from store
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
        setGameState,
        wordHistory
    } = useActiveGameStore();

    // Convert the scoredWords array to a Set for faster lookups
    const scoredWords = new Set<string>(scoredWordsArray);

    // Initialize the game if not already done
    useEffect(() => {
        if (!gameInitialized) {
            const initialGrid = generateInitialGrid(gridSize);
            const initialLetterBag = generateLetterBag();

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
    // Use refs to prevent unnecessary updates
    useEffect(() => {
        // Skip if the wordPath hasn't changed
        if (
            prevWordPathRef.current.length === wordPath.length &&
            prevWordPathRef.current.every((cell, i) => cell.id === wordPath[i]?.id) &&
            prevScoreWordsRef.current.length === scoredWordsArray.length &&
            prevScoreWordsRef.current.every((word, i) => word === scoredWordsArray[i])
        ) {
            return;
        }

        // Update refs
        prevWordPathRef.current = [...wordPath];
        prevScoreWordsRef.current = [...scoredWordsArray];

        if (currentWord.length >= 3) {
            // Get the actual word from letters (more reliable than state)
            const wordFromPath = wordPath.map(cell => cell.letter).join('');

            // Check if word is valid using synchronous method first
            // (may return false if dictionary not loaded yet)
            let valid = wordValidator.isValidWord(wordFromPath);

            // If not valid and word is 3+ letters, try async validation
            if (!valid && wordFromPath.length >= 3) {
                // Start async validation - will update UI when complete
                wordValidator.validateWordAsync(wordFromPath).then(isValid => {
                    if (isValid) {
                        // Only update if the current word is still the same
                        const currentWordPath = wordPath.map(cell => cell.letter).join('');
                        if (currentWordPath === wordFromPath) {
                            // Check if already scored
                            const isAlreadyScored = scoredWords.has(wordFromPath);
                            setIsWordValid(isValid && !isAlreadyScored);
                            setIsWordAlreadyScored(isValid && isAlreadyScored);

                            // Calculate potential score
                            if (isValid && !isAlreadyScored) {
                                const score = calculateWordScore(wordPath, grid);
                                setPotentialScore(score);
                            }

                            if (isValid && isAlreadyScored) {
                                // Show toast notification only once per word
                                toast.error(`"${wordFromPath}" has already been scored!`, {
                                    id: `duplicate-${wordFromPath}`,
                                    duration: 2000,
                                });
                            }
                        }
                    }
                });
            }

            // Check if the word has already been scored
            const isAlreadyScored = scoredWords.has(wordFromPath);

            setIsWordValid(valid && !isAlreadyScored);
            setIsWordAlreadyScored(valid && isAlreadyScored);

            // Calculate potential score if word is valid
            if (valid && !isAlreadyScored) {
                const score = calculateWordScore(wordPath, grid);
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
    }, [currentWord, scoredWordsArray, wordPath]);

    // Show victory screen - define this first to avoid circular dependencies
    const showVictoryScreen = useCallback(() => {
        try {
            // Safety check to prevent recursive calls
            toast.error("Game finished!");
        } catch (error) {
            console.error("Error showing victory screen:", error);
        }
    }, []);

    // Draw tiles from the bag to the player's hand - memoize with useCallback
    const drawTiles = useCallback((count: number) => {
        if (letterBag.length === 0) return;

        const newBag = [...letterBag];
        const drawnTiles = newBag.splice(0, Math.min(count, newBag.length));

        setGameState({
            letterBag: newBag,
            playerHand: [...playerHand, ...drawnTiles]
        });
    }, [letterBag, playerHand, setGameState]);

    // Handle burning a tile - define this before handleBurnWithAnimation
    const handleBurnTile = useCallback(() => {
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
            if (checkGameOver(grid, letterBag, playerHand)) {
                showVictoryScreen();
            }
        }, 500);
    }, [grid, isPlacementPhase, letterBag, playerHand, selectedHandTile, setGameState, showVictoryScreen]);

    const handleBurnWithAnimation = useCallback(() => {
        // Check if we're in placement phase and have a selected tile
        if (!isPlacementPhase || !selectedHandTile) {
            return;
        }

        // Set animation state
        setIsShuffleAnimating(true);

        // After a short delay, perform the burn and reset animation
        setTimeout(() => {
            setIsShuffleAnimating(false);
            handleBurnTile();
        }, 300);
    }, [handleBurnTile, isPlacementPhase, selectedHandTile]);

    // Memoize handlers with useCallback to prevent unnecessary re-renders
    const handleTileSelect = useCallback((tile: LetterTile) => {
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
    }, [isPlacementPhase, playerHand, selectedHandTile, setGameState]);

    const handleCellClick = useCallback((cell: HexCell) => {
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
            // In word formation phase, we select letters to form words
            if (!cell.letter) return; // Skip empty cells

            // Find if this cell is already in the word path
            const pathIndex = wordPath.findIndex(pathCell => pathCell.id === cell.id);

            if (pathIndex !== -1) {
                // Cell is already in the path

                // If it's the last letter, remove it
                if (pathIndex === wordPath.length - 1) {
                    // Remove this letter from the word path
                    const newPath = wordPath.slice(0, wordPath.length - 1);

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
                }
                // If it's the first letter, reset the entire word
                else if (pathIndex === 0) {
                    handleResetWord();
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
                }
            }
        }
    }, [grid, isPlacementPhase, playerHand, selectedHandTile, setGameState, wordPath]);

    const handleEndPlacementPhase = useCallback(() => {
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
            if (checkGameOver(grid, letterBag, playerHand)) {
                showVictoryScreen();
            }
        }, 500);
    }, [placedTilesThisTurn, setGameState]);

    const handleResetWord = useCallback(() => {
        const updatedGrid = grid.map(cell => ({
            ...cell,
            isSelected: false
        }));

        setGameState({
            wordPath: [],
            grid: updatedGrid,
            currentWord: ''
        });
    }, [setGameState]);

    const handleScoreWord = useCallback(() => {
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
        const wordScore = calculateWordScore(wordPath, grid);

        // Create a unique path key for the word history
        const pathKey = wordPath.map(cell => cell.id).join('-');

        // Add to scored words and update score
        setGameState({
            scoredWords: [...scoredWordsArray, currentWord],
            score: score + wordScore,
            wordHistory: [
                ...wordHistory,
                {
                    word: currentWord,
                    score: wordScore,
                    turn: turns,
                    pathKey
                }
            ]
        });

        // Show success toast
        toast.success(`Scored "${currentWord}" for ${wordScore} points!`);

        // Reset the word path
        setTimeout(() => {
            handleResetWord();

            // Check if game is over
            if (checkGameOver(grid, letterBag, playerHand)) {
                showVictoryScreen();
            }
        }, 500);
    }, [grid, handleResetWord, letterBag, playerHand, score, scoredWordsArray, setGameState, showVictoryScreen, turns, wordHistory, wordPath]);

    return {
        isWordValid,
        isWordAlreadyScored,
        potentialScore,
        isShuffleAnimating,
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