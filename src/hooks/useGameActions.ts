import { useState, useEffect } from 'react';
import { useActiveGameStore, WordHistoryEntry } from '../store/activeGameStore';
import { HexCell } from '../components/HexGrid';
import { LetterTile } from '../components/PlayerHand';
import wordValidator from '../lib/wordValidator';
import toastService from '../lib/toastService';
import {
    generateInitialGrid,
    generateLetterBag,
    generatePistonTile,
    generateWildTile,
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
    isLetterSelectionModalOpen: boolean;
    selectedCellForWild: HexCell | null;
    closeLetterSelectionModal: () => void;
    handleWildLetterSelection: (letter: string) => void;
    handleDeselectTile: () => void;
}

export function useGameActions(): GameActionsResult {
    const [isWordValid, setIsWordValid] = useState(false);
    const [isWordAlreadyScored, setIsWordAlreadyScored] = useState(false);
    const [potentialScore, setPotentialScore] = useState(0);
    const [isDictionaryLoading, setIsDictionaryLoading] = useState(true);
    const [isLetterSelectionModalOpen, setIsLetterSelectionModalOpen] = useState(false);
    const [selectedCellForWild, setSelectedCellForWild] = useState<HexCell | null>(null);

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

            // Draw initial hand (3 tiles instead of 5, to leave room for special tiles)
            const drawnTiles = initialLetterBag.slice(0, 3);
            const remainingBag = initialLetterBag.slice(3);

            // Create a piston tile and a wild tile and add them to the hand
            const pistonTile = generatePistonTile();
            const wildTile = generateWildTile();

            setGameState({
                gameInitialized: true,
                grid: initialGrid,
                letterBag: remainingBag,
                playerHand: [...drawnTiles, pistonTile, wildTile], // Add special tiles to starting hand
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
                        toastService.error(`"${wordFromPath}" has already been scored!`, {
                            id: 'already-scored',
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
            toastService.error("Complete or reset your current word first");
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

            toastService.success("Select an existing letter on the board to move with the piston");
        }
        // If this is a wild tile, let the user know how to use it
        else if (tile.tileType === 'wild') {
            // Reset any existing selections
            const clearedGrid = grid.map(cell => ({
                ...cell,
                isSelected: false
            }));

            setGameState({
                grid: clearedGrid,
                isPistonActive: false,
                pistonSourceCell: null
            });

            toastService.success("Select any existing letter on the board to change it");
        }
        else {
            // For regular tiles, turn off piston mode
            setGameState({
                isPistonActive: false,
                pistonSourceCell: null
            });
        }
    };

    // Function to deselect any selected tile in the player's hand
    const handleDeselectTile = () => {
        // Only do this during placement phase
        if (!isPlacementPhase) return;

        // Check if there's a selected tile
        if (selectedHandTile) {
            // Update the player's hand to deselect all tiles
            const updatedHand = playerHand.map(t => ({
                ...t,
                isSelected: false
            }));

            // Update state
            setGameState({
                playerHand: updatedHand,
                selectedHandTile: null,
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

                    toastService.success("Now select any adjacent space to move this tile");
                } else {
                    // Error: Tried to use piston on an empty cell
                    toastService.error("You can only use a piston on an existing letter");
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
                toastService.error("Select an adjacent space");
                return;
            }
        }

        // For wild tiles, check if we're targeting an existing letter
        else if (selectedHandTile?.tileType === 'wild') {
            // Wild tile can only be used on cells with existing letters
            if (cell.letter && cell.isPlaced) {
                // Open letter selection modal
                setSelectedCellForWild(cell);
                setIsLetterSelectionModalOpen(true);
            } else {
                // Not a valid target for wild tile
                toastService.error('Wild tiles can only be used on existing letters.', {
                    duration: 2000,
                });
            }
            return;
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
                    toastService.success('Piston move undone');
                    return;
                }

                // Create a new tile to add back to the hand
                // Using Date.now() to ensure unique IDs and prevent React key duplication errors
                // This fixes a bug where clicking the same cell multiple times would create tiles with duplicate IDs
                const tileToRestore: LetterTile = {
                    id: `restored-${placedTile.id}-${Date.now()}`,
                    letter: cell.letter,
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
                toastService.success('Tile placement undone');
                return;
            }

            // If the cell already has a letter (and wasn't placed this turn), show a hint
            if (cell.letter) {
                // Check if this is a pre-placed tile or a tile placed in a previous turn
                const isPrePlacedOrPreviousTurn = cell.isPrePlaced ||
                    (cell.isPlaced && !placedTilesThisTurn.some(t => t.id === cell.id));

                // Show hint when user has a tile selected
                if (isPrePlacedOrPreviousTurn && selectedHandTile) {
                    toastService.success("Tap an empty cell to place your selected tile", {
                        duration: 2000,
                        icon: '👆',
                    });
                }
                // Show hint when user doesn't have a tile selected
                else if (isPrePlacedOrPreviousTurn && !selectedHandTile) {
                    toastService.success("First select a tile from your hand", {
                        duration: 2000,
                        icon: '👇',
                    });
                }
                return;
            }

            // If we already placed the maximum number of tiles, show a message and return
            if (placedTilesThisTurn.length >= MAX_PLACEMENT_TILES) {
                toastService.error(`You can only place ${MAX_PLACEMENT_TILES} tiles per turn.`);
                return;
            }

            // If no tile is selected from the hand, show a helpful hint
            if (!selectedHandTile) {
                toastService.success("Select a tile from your hand first", {
                    duration: 2000,
                    icon: '👇',
                });
                return;
            }

            // Save current state before changing
            const gridBeforeChange = [...grid];
            const handBeforeChange = [...playerHand];
            const placedTilesBeforeChange = [...placedTilesThisTurn];

            // Place the letter on the grid
            const updatedGrid = grid.map(c => {
                if (c.id === cell.id) {
                    return {
                        ...c,
                        letter: selectedHandTile.letter,
                        isPlaced: true,
                        tilePlacedThisTurn: true,
                        placer: 'player'
                    };
                }
                return c;
            });

            // Add this placement to the tiles placed this turn
            const updatedPlacedTiles = [...placedTilesThisTurn, cell];

            // Remove the selected tile from the player's hand
            const updatedHand = playerHand.filter(t => t.id !== selectedHandTile.id);

            // Update the state
            setGameState({
                grid: updatedGrid,
                playerHand: updatedHand,
                selectedHandTile: null,
                placedTilesThisTurn: updatedPlacedTiles,
                canUndo: true,
                lastAction: {
                    type: 'place_tile',
                    prevGrid: gridBeforeChange,
                    prevPlayerHand: handBeforeChange,
                    prevPlacedTilesThisTurn: placedTilesBeforeChange,
                    tileUsed: selectedHandTile
                }
            });

            // Display a toast notification
            toastService.success(`Placed ${selectedHandTile.letter} on the grid!`, {
                duration: 1500,
                icon: '🎯',
            });

            // We no longer auto-transition to scoring phase
            // This is now done manually by the user via the End Phase button
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
                toastService.error("You must place at least one tile before scoring.");
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
            toastService.error("That's not a valid word");
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

        toastService.success(`+${wordScore} points for "${currentWord}"!`);

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
            toastService.error("Select a tile to burn first");
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

            toastService.success(`Burned tile "${selectedHandTile.letter}" and drew "${newTile.letter}"`);
        } else {
            // No tiles left to draw
            setGameState({
                playerHand: updatedHand,
                selectedHandTile: null
            });

            toastService.success(`Burned tile "${selectedHandTile.letter}" (no tiles left to draw)`);
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
            toastService.success(`Moved '${pistonSourceCell.letter}' and replaced '${replacedLetter}'!`);
        } else {
            toastService.success("Tile moved successfully!");
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
            toastService.success(message, {
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
            toastService.error("Game finished!");
        }
    };

    // Add the new handleEndTurn function
    const handleEndTurn = () => {
        if (isPlacementPhase) {
            handleEndPlacementPhase();
        } else {
            // Reset any selected word
            handleResetWord();
            // End the turn
            finishTurn();
        }
    };

    // For wild tiles, check if we're targeting an existing letter
    const handleWildLetterSelection = (letter: string) => {
        if (!selectedCellForWild || !selectedHandTile) return;

        const formattedLetter = letter.toUpperCase();

        // Save current state before changing
        const gridBeforeChange = [...grid];
        const handBeforeChange = [...playerHand];

        // Update the letter on the grid
        const updatedGrid = grid.map(c => {
            if (c.id === selectedCellForWild.id) {
                return {
                    ...c,
                    letter: formattedLetter
                };
            }
            return c;
        });

        // Remove the wild tile from the player's hand
        const updatedHand = playerHand.filter(t => t.id !== selectedHandTile.id);

        // Update state
        setGameState({
            grid: updatedGrid,
            playerHand: updatedHand,
            selectedHandTile: null,
            canUndo: true,
            lastAction: {
                type: 'place_tile', // Reuse existing action type
                prevGrid: gridBeforeChange,
                prevPlayerHand: handBeforeChange,
                prevPlacedTilesThisTurn: placedTilesThisTurn,
                tileUsed: selectedHandTile
            }
        });

        // Show success message
        toastService.success(`Changed ${selectedCellForWild.letter} to ${formattedLetter}!`, {
            duration: 1500,
            icon: '✨',
        });

        // Close modal and reset selected cell
        closeLetterSelectionModal();
    };

    const closeLetterSelectionModal = () => {
        setIsLetterSelectionModalOpen(false);
        setSelectedCellForWild(null);
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
        showVictoryScreen,
        isLetterSelectionModalOpen,
        selectedCellForWild,
        closeLetterSelectionModal,
        handleWildLetterSelection,
        handleDeselectTile
    };
} 