import { useState, useEffect } from 'react';
import { useActiveGameStore, WordHistoryEntry } from '../store/activeGameStore';
import { HexCell } from '../components/HexGrid';
import { LetterTile } from '../components/PlayerHand';
import wordValidator from '../lib/wordValidator';
import { toast } from 'react-hot-toast';
import {
    generateInitialGrid,
    generateLetterBag,
    generatePistonTile,
    isAdjacentToCell,
    calculateWordScore,
    checkGameOver,
    MAX_PLACEMENT_TILES
} from '../lib/gameUtils';
import confetti from 'canvas-confetti';

export interface GameActionsResult {
    isWordValid: boolean;
    isWordAlreadyScored: boolean;
    potentialScore: number;
    isDictionaryLoading: boolean;
    handleTileSelect: (tile: LetterTile) => void;
    handleCellClick: (cell: HexCell) => void;
    handleEndPlacementPhase: () => void;
    handleEndTurn: () => void;
    handleResetWord: () => void;
    handleScoreWord: () => void;
    handleBurnWithAnimation: () => void;
    handlePistonMove: (targetCell: HexCell) => void;
    drawTiles: (count: number) => void;
    showVictoryScreen: () => void;
}

export function useGameActions(): GameActionsResult {
    const [isWordValid, setIsWordValid] = useState(false);
    const [isWordAlreadyScored, setIsWordAlreadyScored] = useState(false);
    const [potentialScore, setPotentialScore] = useState(0);
    const [isDictionaryLoading, setIsDictionaryLoading] = useState(true);

    const {
        gameInitialized,
        grid,
        gridSize,
        letterBag,
        playerHand,
        selectedHandTile,
        currentWord,
        wordPath,
        placedTilesThisTurn,
        scoredWords: scoredWordsArray,
        score,
        turns,
        isPlacementPhase,
        setGameState,
        isPistonActive,
        pistonSourceCell,
        undoLastAction,
        wordHistory
    } = useActiveGameStore();

    // Convert the scoredWords array to a Set for faster lookups
    const scoredWords = new Set<string>(scoredWordsArray);

    // Initialize the game if not already done
    useEffect(() => {
        if (!gameInitialized) {
            const initialGrid = generateInitialGrid(gridSize);
            const initialLetterBag = generateLetterBag();

            // Draw initial hand (4 tiles instead of 5, to leave room for piston)
            const drawnTiles = initialLetterBag.slice(0, 4);
            const remainingBag = initialLetterBag.slice(4);

            // Create a piston tile and add it to the hand
            const pistonTile = generatePistonTile();

            setGameState({
                gameInitialized: true,
                grid: initialGrid,
                letterBag: remainingBag,
                playerHand: [...drawnTiles, pistonTile], // Add piston tile to starting hand
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

            // Track dictionary loading state
            if (!wordValidator.isReady) {
                setIsDictionaryLoading(true);
            }

            // Use async validation for better user experience
            const validateWordAsynchronously = async () => {
                try {
                    // Check if word is valid
                    const valid = await wordValidator.validateWordAsync(wordFromPath);

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
                } finally {
                    // Dictionary should be loaded by now
                    setIsDictionaryLoading(false);
                }
            };

            validateWordAsynchronously();
        } else {
            setIsWordValid(false);
            setIsWordAlreadyScored(false);
            setPotentialScore(0);
            setIsDictionaryLoading(false);
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
        // If we're not in placement phase, ignore
        if (!isPlacementPhase) {
            toast.error("Complete or reset your current word first");
            return;
        }

        // Update the selected tile in the player's hand
        const updatedHand = playerHand.map(t => ({
            ...t,
            isSelected: t.id === tile.id
        }));

        // Set the selected tile
        setGameState({
            playerHand: updatedHand,
            selectedHandTile: tile
        });

        // If this is a piston tile, reset any existing cell selection
        // We will require the player to click on a placed tile first
        if (tile.tileType === 'piston') {
            // Reset any existing piston state and enter piston mode
            const clearedGrid = grid.map(cell => ({
                ...cell,
                isSelected: false,
                isPistonTarget: false,
                isAdjacentToPistonSource: false
            }));

            setGameState({
                grid: clearedGrid,
                isPistonActive: true,
                pistonSourceCell: null
            });

            toast.success("Select an existing letter on the board to move with the piston");
        } else {
            // For regular tiles, turn off piston mode
            setGameState({
                isPistonActive: false,
                pistonSourceCell: null
            });
        }
    };

    const handleCellClick = (cell: HexCell) => {
        // For piston tiles, we need to check if the cell is valid
        if (selectedHandTile?.tileType === 'piston' && isPistonActive) {
            // First click: If no source cell is selected yet, this must be a cell with a letter
            if (!pistonSourceCell) {
                // Check if this cell has a letter
                if (cell.isPlaced && cell.letter) {
                    // Mark this cell as the piston target
                    const updatedGrid = grid.map(c => {
                        // The clicked cell becomes the piston source
                        if (c.id === cell.id) {
                            return { ...c, isPistonTarget: true };
                        }

                        // Find and mark all adjacent cells
                        const isAdjacent = isAdjacentToCell(c, cell);
                        return {
                            ...c,
                            isAdjacentToPistonSource: isAdjacent
                        };
                    });

                    setGameState({
                        grid: updatedGrid,
                        pistonSourceCell: cell
                    });

                    toast.success("Now select any adjacent space to move this tile");
                } else {
                    // Error: Tried to use piston on an empty cell
                    toast.error("You can only use a piston on an existing letter");
                }
                return;
            }

            // Second click: If source is selected and this is an adjacent cell, move the tile
            if (pistonSourceCell && cell.isAdjacentToPistonSource) {
                handlePistonMove(cell);
                return;
            }

            // If clicking on a non-adjacent cell, show error
            if (pistonSourceCell) {
                toast.error("Select an adjacent space");
                return;
            }
        }

        // Regular tile placement logic (existing code)
        if (isPlacementPhase) {
            // Placement phase logic

            // Check if this is a cell that was placed this turn
            const wasPlacedThisTurn = placedTilesThisTurn.some(
                placedCell => placedCell.id === cell.id
            );

            // If the cell has a letter and was placed this turn, undo the placement
            if (cell.letter && wasPlacedThisTurn) {
                // Find the placed tile to restore to hand
                const placedTile = placedTilesThisTurn.find(t => t.id === cell.id);

                if (!placedTile) return; // Safety check

                // Check if this tile was placed using a piston (by checking lastAction)
                const { lastAction, canUndo } = useActiveGameStore.getState();
                if (canUndo && lastAction?.type === 'use_piston' && lastAction.pistonSourceCell) {
                    // Just use the global undo action as it's more reliable for piston moves
                    undoLastAction();
                    toast.success('Piston move undone');
                    return;
                }

                // Create a new tile to add back to the hand
                // Using Date.now() to ensure unique IDs and prevent React key duplication errors
                // This fixes a bug where clicking the same cell multiple times would create tiles with duplicate IDs
                const tileToRestore: LetterTile = {
                    id: `restored-${placedTile.id}-${Date.now()}`,
                    letter: placedTile.letter,
                    isSelected: false,
                    frequency: 'common',
                    tileType: 'regular'
                };

                // Remove the letter from the cell
                const updatedGrid = grid.map(c => {
                    if (c.id === cell.id) {
                        return {
                            ...c,
                            letter: '',
                            isPlaced: c.isPrePlaced // Only keep isPlaced true if it was pre-placed
                        };
                    }
                    return c;
                });

                // Add the tile back to the hand
                const updatedHand = [...playerHand, tileToRestore];

                // Remove this cell from placedTilesThisTurn
                const updatedPlacedTiles = placedTilesThisTurn.filter(
                    t => t.id !== cell.id
                );

                // Update the state
                setGameState({
                    grid: updatedGrid,
                    playerHand: updatedHand,
                    placedTilesThisTurn: updatedPlacedTiles
                });

                // Show feedback to the user
                toast.success('Tile placement undone');
                return;
            }

            // If the cell already has a letter (and wasn't placed this turn), show a hint
            if (cell.letter) {
                // Check if this is a pre-placed tile or a tile placed in a previous turn
                const isPrePlacedOrPreviousTurn = cell.isPrePlaced ||
                    (cell.isPlaced && !placedTilesThisTurn.some(t => t.id === cell.id));

                // Only show the hint if the user has a tile selected
                if (isPrePlacedOrPreviousTurn && selectedHandTile) {
                    toast.success("Tap an empty cell to place your selected tile", {
                        duration: 2000,
                        icon: '👆',
                    });
                }
                return;
            }

            // If we already placed the maximum number of tiles, show a message and return
            if (placedTilesThisTurn.length >= MAX_PLACEMENT_TILES) {
                toast.error(`You can only place ${MAX_PLACEMENT_TILES} tiles per turn.`);
                return;
            }

            // If no tile is selected from the hand, show a helpful hint
            if (!selectedHandTile) {
                toast.success("Select a tile from your hand first", {
                    duration: 2000,
                    icon: '👇',
                });
                return;
            }

            // Create deep copies of current state BEFORE any changes
            const gridBeforeChange = grid.map(c => ({ ...c }));
            const handBeforeChange = playerHand.map(t => ({ ...t }));
            const placedTilesBeforeChange = [...placedTilesThisTurn];

            // Place the letter from the selected hand tile into the cell
            const updatedGrid = grid.map(c => {
                if (c.id === cell.id) {
                    return {
                        ...c,
                        letter: selectedHandTile.letter,
                        isPlaced: true,
                        placedThisTurn: true
                    };
                }
                return c;
            });

            // Remove the tile from the player's hand
            const updatedHand = playerHand.filter(t => t.id !== selectedHandTile.id);

            // Update the state
            setGameState({
                grid: updatedGrid,
                playerHand: updatedHand,
                selectedHandTile: null,
                placedTilesThisTurn: [
                    ...placedTilesThisTurn,
                    {
                        ...cell,
                        letter: selectedHandTile.letter,
                        isPlaced: true,
                        placedThisTurn: true
                    }
                ],
                // Track the action for undo functionality
                lastAction: {
                    type: 'place_tile',
                    prevGrid: gridBeforeChange,
                    prevPlayerHand: handBeforeChange,
                    prevPlacedTilesThisTurn: placedTilesBeforeChange,
                    tileUsed: selectedHandTile
                },
                canUndo: true
            });

            // Auto-transition to scoring phase when max tiles are placed
            // We need to check if this placement will reach the max tiles limit
            if (placedTilesThisTurn.length + 1 === MAX_PLACEMENT_TILES) {
                // Use setTimeout to ensure state is updated before transitioning
                setTimeout(() => {
                    // Create a flash effect
                    const flashElement = document.createElement('div');
                    flashElement.style.position = 'fixed';
                    flashElement.style.top = '0';
                    flashElement.style.left = '0';
                    flashElement.style.width = '100%';
                    flashElement.style.height = '100%';
                    flashElement.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                    flashElement.style.zIndex = '9999';
                    flashElement.style.opacity = '0';
                    flashElement.style.pointerEvents = 'none';
                    flashElement.style.transition = 'opacity 0.5s ease';
                    document.body.appendChild(flashElement);

                    // Trigger the flash animation
                    setTimeout(() => {
                        flashElement.style.opacity = '0.7';
                        setTimeout(() => {
                            flashElement.style.opacity = '0';
                            setTimeout(() => {
                                document.body.removeChild(flashElement);
                            }, 500);
                        }, 150);
                    }, 10);

                    // Transition to scoring phase
                    handleEndPlacementPhase();

                    // Show a notification that we're entering scoring phase
                    toast.success('Entering scoring phase!', {
                        duration: 2000,
                        icon: '✨',
                    });
                }, 300);
            } else {
                // Show regular tile placement notification
                toast.success(`Placed tile: ${selectedHandTile.letter}`, {
                    duration: 1500,
                    icon: '🔤',
                });
            }
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
    };

    const handleEndPlacementPhase = () => {
        if (isPlacementPhase) {
            // Require at least one tile to be placed before ending the placement phase
            if (placedTilesThisTurn.length === 0) {
                toast.error("You must place at least one tile before scoring.");
                return;
            }

            // Clear undo ability when transitioning between phases
            setGameState({
                isPlacementPhase: false,
                placedTilesThisTurn: [],
                canUndo: false,
                lastAction: null
            });
        }

        // After ending placement phase, check if the game is over
        setTimeout(() => {
            if (checkGameOver(grid, letterBag, playerHand)) {
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
        // If there's no valid word, don't do anything
        if (!isWordValid) {
            toast.error("That's not a valid word");
            return;
        }

        // Clear undo ability when scoring (non-undoable action)
        setGameState({
            canUndo: false,
            lastAction: null
        });

        // Calculate the final score for this word
        const wordScore = calculateWordScore(wordPath, grid);

        // Display confetti for scoring
        confetti({
            particleCount: Math.min(wordScore * 5, 100),
            spread: 70,
            origin: { y: 0.6 }
        });

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

        toast.success(`+${wordScore} points for "${currentWord}"!`);

        // End the turn after scoring
        finishTurn();

        // After updating the state with the scored word, check if game is over
        setTimeout(() => {
            if (checkGameOver(grid, letterBag, playerHand)) {
                showVictoryScreen();
            }
        }, 500);
    };

    // Replace the handleShuffleWithAnimation with handleBurnWithAnimation
    const handleBurnWithAnimation = () => {
        // Require a selected tile to burn
        if (!selectedHandTile) {
            toast.error("Select a tile to burn first");
            return;
        }

        // Clear undo ability when burning (non-undoable action)
        setGameState({
            canUndo: false,
            lastAction: null
        });

        // Process the tile burning
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
    };

    // New function to handle the piston movement logic
    const handlePistonMove = (targetCell: HexCell) => {
        if (!pistonSourceCell || !selectedHandTile) return;

        // Check if the target cell already has a letter (replacement)
        const isReplacing = targetCell.isPlaced && targetCell.letter !== '';
        const replacedLetter = targetCell.letter;

        // Create deep copies of current state for undo functionality
        const gridBeforeChange = grid.map(c => ({ ...c }));
        const handBeforeChange = playerHand.map(t => ({ ...t }));
        const placedTilesBeforeChange = [...placedTilesThisTurn];

        // Create updated grid with the tile moved to the new position
        const updatedGrid = grid.map(cell => {
            // Clear the source cell
            if (cell.id === pistonSourceCell.id) {
                return {
                    ...cell,
                    letter: '',
                    isPlaced: false,
                    isPrePlaced: false,
                    isPistonTarget: false,
                    isSelected: false
                };
            }

            // Update the target cell with the source cell's letter
            if (cell.id === targetCell.id) {
                return {
                    ...cell,
                    letter: pistonSourceCell.letter,
                    isPlaced: true,
                    isPrePlaced: false,
                    isAdjacentToPistonSource: false,
                    placedThisTurn: true
                };
            }

            // Reset all other cells
            return {
                ...cell,
                isPistonTarget: false,
                isAdjacentToPistonSource: false
            };
        });

        // Remove the used piston tile from player's hand
        const updatedHand = playerHand.filter(tile => tile.id !== selectedHandTile.id);

        // Update the game state
        setGameState({
            grid: updatedGrid,
            playerHand: updatedHand,
            selectedHandTile: null,
            isPistonActive: false,
            pistonSourceCell: null,
            placedTilesThisTurn: [...placedTilesThisTurn, { ...targetCell, letter: pistonSourceCell.letter }],
            // Track the action for undo functionality
            lastAction: {
                type: 'use_piston',
                prevGrid: gridBeforeChange,
                prevPlayerHand: handBeforeChange,
                prevPlacedTilesThisTurn: placedTilesBeforeChange,
                tileUsed: selectedHandTile,
                pistonSourceCell: pistonSourceCell
            },
            canUndo: true
        });

        // Show a different message if we replaced a tile
        if (isReplacing) {
            toast.success(`Moved '${pistonSourceCell.letter}' and replaced '${replacedLetter}'!`);
        } else {
            toast.success("Tile moved successfully!");
        }
    };

    // Show victory screen
    const showVictoryScreen = () => {
        try {
            // Safety check to prevent recursive calls
            if (!grid || !Array.isArray(grid)) {
                console.error("Grid is not properly initialized");
                return;
            }

            // Calculate board completion percentage
            const totalCells = grid.length;
            const filledCells = grid.filter(cell => cell && cell.letter).length;
            const completionPercentage = Math.round((filledCells / totalCells) * 100);

            // Check if high score
            const isHighScore = localStorage.getItem('highScore') ?
                score > parseInt(localStorage.getItem('highScore') || '0') : true;

            if (isHighScore) {
                localStorage.setItem('highScore', score.toString());
            }

            // Determine if the game ended due to empty letter bag and empty hand
            const isOutOfCards = !letterBag || (Array.isArray(letterBag) && letterBag.length === 0 &&
                Array.isArray(playerHand) && playerHand.length === 0);

            // Create more descriptive victory message
            const winReason = isOutOfCards ?
                "🎮 You've used all available tiles!" :
                "🎮 You've filled the entire board!";

            const scoreInfo = `🏆 Final Score: ${score} points`;
            const boardInfo = `📊 Board Filled: ${completionPercentage}%`;
            const wordInfo = `📝 Words Formed: ${wordHistory.length}`;
            const highScoreInfo = isHighScore ? "🌟 NEW HIGH SCORE! 🌟" : "";

            // Create multiline toast message
            const message = `${winReason}\n${scoreInfo}\n${boardInfo}\n${wordInfo}${highScoreInfo ? '\n' + highScoreInfo : ''}`;

            // Show victory toast
            toast.success(message, {
                duration: 10000,
                position: 'top-center',
                style: {
                    padding: '16px',
                    color: '#713200',
                    backgroundColor: '#fff8e6',
                    borderLeft: '6px solid #f59e0b',
                    fontWeight: 'bold',
                },
                iconTheme: {
                    primary: '#f59e0b',
                    secondary: '#FFFAEE',
                },
            });
        } catch (error) {
            console.error("Error in showVictoryScreen:", error);
            toast.error("Game finished!");
        }
    };

    // Add the new handleEndTurn function
    const handleEndTurn = () => {
        if (isPlacementPhase) {
            handleEndPlacementPhase();
        } else {
            // Show skip notification
            toast.success('Turn skipped', {
                icon: '⏭️',
                duration: 2000,
                style: {
                    border: '1px solid #d1d5db',
                    padding: '12px',
                    color: '#6b7280',
                },
            });

            // Reset any selected word
            handleResetWord();
            // End the turn
            finishTurn();
        }
    };

    return {
        isWordValid,
        isWordAlreadyScored,
        potentialScore,
        isDictionaryLoading,
        handleTileSelect,
        handleCellClick,
        handleEndPlacementPhase,
        handleEndTurn,
        handleResetWord,
        handleScoreWord,
        handleBurnWithAnimation,
        handlePistonMove,
        drawTiles,
        showVictoryScreen
    };
} 