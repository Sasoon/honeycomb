import { useRef, useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { useTetrisGameStore } from '../store/tetrisGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import HexGrid from '../components/HexGrid';

// For HexGrid with odd-r offset (odd rows shifted right, 0-indexed rows)
function buildHexPathForFallingTile(
    startCell: { row: number; col: number },
    targetCell: { row: number; col: number },
    validPositionsSet: Set<string> // Set of "row,col" strings for existing cells
): Array<{ row: number; col: number }> {
    const path: Array<{ row: number; col: number }> = [];
    let currentPosition = { ...startCell };

    if (!validPositionsSet.has(`${startCell.row},${startCell.col}`)) {
        if (validPositionsSet.has(`${targetCell.row},${targetCell.col}`)) {
            return [{ ...targetCell }];
        }
        return [];
    }
    path.push({ ...currentPosition });

    const maxPathSteps = (targetCell.row - startCell.row + 1) * 4 + Math.abs(targetCell.col - startCell.col) + 20;

    for (let step = 0; step < maxPathSteps; step++) {
        if (currentPosition.row === targetCell.row && currentPosition.col === targetCell.col) {
            break;
        }

        const prospectiveRawNodes: Array<{ row: number; col: number }> = [];

        // Downward movement options
        if (currentPosition.row < targetCell.row) {
            const nextRow = currentPosition.row + 1;
            if (currentPosition.row % 2 !== 0) { // Odd row
                prospectiveRawNodes.push({ row: nextRow, col: currentPosition.col });
                prospectiveRawNodes.push({ row: nextRow, col: currentPosition.col + 1 });
            } else { // Even row
                prospectiveRawNodes.push({ row: nextRow, col: currentPosition.col - 1 });
                prospectiveRawNodes.push({ row: nextRow, col: currentPosition.col });
            }
        }
        // Horizontal movement options (only if on the same row as target)
        if (currentPosition.row === targetCell.row && currentPosition.col !== targetCell.col) {
            prospectiveRawNodes.push({
                row: currentPosition.row,
                col: currentPosition.col + Math.sign(targetCell.col - currentPosition.col),
            });
        }
        
        const prospectiveNextNodes = prospectiveRawNodes.filter(node =>
            validPositionsSet.has(`${node.row},${node.col}`)
        );

        if (prospectiveNextNodes.length === 0) {
            break;
        }

        let bestNodes: Array<{ row: number; col: number }> = [];
        let bestScore = Infinity;

        for (const node of prospectiveNextNodes) {
            let score = 0;
            // Heavily prioritize reaching the target
            if (node.row === targetCell.row && node.col === targetCell.col) {
                score -= 10000;
            }
            // Score based on distance (Manhattan distance-like)
            score += Math.abs(node.row - targetCell.row) * 100;
            score += Math.abs(node.col - targetCell.col) * 10;
            // Slightly prefer moving straight down
            if (node.col === currentPosition.col && node.row > currentPosition.row) {
                score -= 1;
            }

            if (score < bestScore) {
                bestScore = score;
                bestNodes = [node];
            } else if (score === bestScore) {
                bestNodes.push(node);
            }
        }

        if (bestNodes.length > 0) {
            // PINBALL LOGIC: If we have a tie, pick one randomly!
            const nextNode = bestNodes[Math.floor(Math.random() * bestNodes.length)];
            currentPosition = nextNode;
            path.push({ ...currentPosition });
        } else {
            break;
        }
    }
    return path;
}

// Game component props
type TetrisGameProps = {
  isSidebarOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
};

const TetrisGame = ({ isSidebarOpen, closeMenu }: TetrisGameProps) => {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  
  // Track tiles from previous phase for animation
  const [previousGrid, setPreviousGrid] = useState<typeof grid>([]);
  
  // Get game state from store
  const {
    gameInitialized,
    phase,
    grid,
    score,
    round,
    selectedTiles,
    currentWord,
    isWordValid,
    powerCards,
    wordsThisRound,
    nextRows,
    previewLevel,
    initializeGame,
    selectTile,
    clearSelection,
    submitWord,
    endRound,
    startPlayerPhase
  } = useTetrisGameStore();

  // Calculate board fullness
  const totalCells = grid.length;
  const filledCells = grid.filter(cell => cell.letter && cell.isPlaced).length;
  const boardFullness = totalCells > 0 ? (filledCells / totalCells) : 0;
  const boardFullnessPercent = Math.round(boardFullness * 100);
  const wordLimit = boardFullness > 0.5 ? 2 : 1;

  // Initialize game on mount
  useEffect(() => {
    if (!gameInitialized) {
      initializeGame();
    }
  }, [gameInitialized, initializeGame]);

  // Track grid changes for animation
  useEffect(() => {
    if (phase === 'player') {
      // Save the current grid state when player phase starts
      setPreviousGrid(grid);
    }
  }, [phase, grid]);

  // Animate tiles dropping during flood phase
  useEffect(() => {
    if (phase === 'flood' && previousGrid.length > 0) {
        const fallingTilesData: Array<{
            id: string; 
            letter: string;
            pathCoordinates: Array<{ x: number; y: number; row: number; col: number; }>; 
        }> = [];

        const validPositions = new Set(grid.map(gCell => `${gCell.position.row},${gCell.position.col}`));

        grid.forEach(cell => {
            const prevCell = previousGrid.find(p => p.id === cell.id);
            if (cell.letter && cell.isPlaced && prevCell && !prevCell.letter) { 
                const columnOfFallingTile = cell.position.col;
                let actualStartRowForPath = 0; // Default to top of board

                // Find the highest valid cell in the target column to start the path from
                const cellsInColumn = grid
                    .filter(c => c.position.col === columnOfFallingTile && c.position.row <= cell.position.row && validPositions.has(`${c.position.row},${c.position.col}`))
                    .sort((a,b) => a.position.row - b.position.row);
                
                if (cellsInColumn.length > 0) {
                    actualStartRowForPath = cellsInColumn[0].position.row;
                } else {
                    // Fallback if no valid cell is found above (should not happen for placed tiles)
                    actualStartRowForPath = cell.position.row;
                }
                
                const startHexPos = { row: actualStartRowForPath, col: columnOfFallingTile };
                const targetHexPos = { row: cell.position.row, col: cell.position.col };
                
                const hexSteps = buildHexPathForFallingTile(startHexPos, targetHexPos, validPositions);

                const currentPathCoordinates: Array<{ x: number; y: number; row: number; col: number; }> = [];
                if (hexSteps.length > 0) {
                    hexSteps.forEach(stepPos => {
                        const hexElement = document.querySelector(
                            `.hex-grid__item[data-row="${stepPos.row}"][data-col="${stepPos.col}"]`
                        ) as HTMLElement;
                        if (hexElement) {
                            const rect = hexElement.getBoundingClientRect();
                            currentPathCoordinates.push({
                                x: rect.left + rect.width / 2,
                                y: rect.top + rect.height / 2,
                                row: stepPos.row,
                                col: stepPos.col,
                            });
                        }
                    });
                }

                if (currentPathCoordinates.length > 0) {
                    fallingTilesData.push({
                        id: cell.id,
                        letter: cell.letter,
                        pathCoordinates: currentPathCoordinates,
                    });
                }
            }
        });

        fallingTilesData.sort((a, b) => { 
            const aCol = a.pathCoordinates.length > 0 ? a.pathCoordinates[0].col : 0;
            const bCol = b.pathCoordinates.length > 0 ? b.pathCoordinates[0].col : 0;
            if (aCol !== bCol) return aCol - bCol;
            return (b.pathCoordinates.length) - (a.pathCoordinates.length); 
        });

        fallingTilesData.forEach((tileData, tileIndex) => {
            if (tileData.pathCoordinates.length === 0) return;

            const finalCellElement = document.querySelector(`[data-cell-id="${tileData.id}"]`) as HTMLElement;
            let letterElementInFinalCell: HTMLElement | null = null;
            if (finalCellElement) {
                letterElementInFinalCell = finalCellElement.querySelector('.letter-tile') as HTMLElement;
                if (letterElementInFinalCell) letterElementInFinalCell.style.opacity = '0';
            }

            const animatedTile = document.createElement('div');
            animatedTile.className = 'animated-falling-tile';
            animatedTile.innerHTML = `<span class="letter-tile">${tileData.letter}</span>`;
            animatedTile.style.transform = 'translate(-50%, -50%)'; 
            document.body.appendChild(animatedTile);

            const stepMoveDuration = 350; 
            const stepPauseDuration = 150;  
            const cascadeDelay = tileIndex * 200; 

            const firstPathPoint = tileData.pathCoordinates[0];
            animatedTile.style.left = `${firstPathPoint.x}px`;
            animatedTile.style.top = `${firstPathPoint.y - 90}px`; 
            animatedTile.style.opacity = '0';
            animatedTile.style.transform = 'translate(-50%, -50%) scale(0.7)';
            
            function executeStep(currentStepIdx: number) {
                if (currentStepIdx >= tileData.pathCoordinates.length) { 
                     animatedTile.remove(); 
                     return;
                }

                const currentPoint = tileData.pathCoordinates[currentStepIdx];
                const isFinalDestination = currentStepIdx === tileData.pathCoordinates.length - 1;

                animatedTile.style.transition = `all ${stepMoveDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
                animatedTile.style.left = `${currentPoint.x}px`;
                animatedTile.style.top = `${currentPoint.y}px`;
                animatedTile.style.opacity = '1';
                animatedTile.style.transform = 'translate(-50%, -50%) scale(1)';

                setTimeout(() => {
                    if (isFinalDestination) {
                        setTimeout(() => { 
                            if (letterElementInFinalCell) letterElementInFinalCell.style.opacity = '1';
                            if (finalCellElement) {
                                finalCellElement.classList.add('tile-landed-effect');
                                setTimeout(() => finalCellElement.classList.remove('tile-landed-effect'), 400);
                            }
                            animatedTile.remove();
                        }, stepPauseDuration / 2); 
                    } else {
                        setTimeout(() => { 
                            executeStep(currentStepIdx + 1);
                        }, stepPauseDuration);
                    }
                }, stepMoveDuration); 
            }

            setTimeout(() => { 
                executeStep(0); 
            }, cascadeDelay);
        });
    }
  }, [phase, grid, previousGrid]);

  // Handle clicking outside sidebar on mobile
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (window.innerWidth < 768) {
        const headerElement = document.querySelector('header');
        if (headerElement && headerElement.contains(event.target as Node)) {
          return;
        }
        
        if (
          sidebarRef.current && 
          isSidebarOpen && 
          !sidebarRef.current.contains(event.target as Node)
        ) {
          closeMenu();
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen, closeMenu]);
  
  // Update grid cells to show selected state
  const gridWithSelection = grid.map(cell => ({
    ...cell,
    isSelected: selectedTiles.some(t => t.cellId === cell.id)
  }));

  return (
    <div className="tetris-game-container min-h-screen bg-gradient-to-b from-amber-50 to-amber-100">
      <div className="flex flex-col md:flex-row">
        {/* Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              ref={sidebarRef}
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", bounce: 0.25 }}
              className="fixed md:relative z-50 w-72 h-full bg-white shadow-xl"
            >
              <div className="p-6 space-y-6">
                {/* Game Stats */}
                <div className="bg-amber-50 rounded-lg p-4">
                  <h2 className="text-2xl font-bold text-amber-900 mb-2">Round {round}</h2>
                  <div className="text-amber-700">
                    <p className="text-lg">Score: {score}</p>
                    <p>Words: {wordsThisRound.length}</p>
                  </div>
                </div>

                {/* Current Word */}
                {currentWord && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-1">Current Word</h3>
                    <p className="text-2xl font-mono tracking-wider">{currentWord}</p>
                  </div>
                )}

                {/* Power Cards */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Power Cards</h3>
                  <div className="space-y-2">
                    {powerCards.map(card => (
                      <button
                        key={card.id}
                        className="w-full text-left p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                      >
                        <p className="font-medium text-purple-900">{card.name}</p>
                        <p className="text-sm text-purple-700">{card.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Phase Indicator */}
                <div className={`text-center p-3 rounded-lg font-semibold ${
                  phase === 'flood' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }`}>
                  {phase === 'flood' ? '⬇️ Tiles Falling!' : '✏️ Your Turn'}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Game Area */}
        <div ref={mainContentRef} className="flex-1 p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            {/* Preview Area */}
            {previewLevel > 0 && nextRows.length > 0 && (
              <div className="mb-4 p-4 bg-gray-100 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Next Drop</h3>
                <div className="flex justify-center gap-2">
                  {nextRows[0]?.map((letter, idx) => (
                    <div key={idx} className="w-10 h-10 bg-gray-300 rounded flex items-center justify-center font-bold">
                      {letter}
                    </div>
                  ))}
                </div>
                {previewLevel > 1 && nextRows[1] && (
                  <div className="flex justify-center gap-2 mt-2 opacity-50">
                    {nextRows[1]?.map((letter, idx) => (
                      <div key={idx} className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center font-bold text-sm">
                        {letter}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Flood Phase Indicator */}
            {phase === 'flood' && (
              <div className="mb-4 p-4 bg-red-100 rounded-lg animate-pulse">
                <h3 className="text-center font-bold text-red-800">⬇️ Tiles Dropping! ⬇️</h3>
              </div>
            )}

            {/* Game Grid */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <HexGrid
                gridSize={5}
                cells={gridWithSelection}
                onCellClick={(cell) => selectTile(cell.id)}
                isWordValid={isWordValid}
                isPlacementPhase={false}
                placedTilesThisTurn={[]}
                isGameActive={phase !== 'gameOver'}
              />
            </div>

            {/* Board Status */}
            {phase === 'player' && (
              <div className="mt-4 flex justify-center items-center gap-4">
                <div className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  boardFullness > 0.5 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-700'
                }`}>
                  Board: {boardFullnessPercent}% full
                </div>
                <div className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  wordsThisRound.length >= wordLimit ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  Words: {wordsThisRound.length}/{wordLimit}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex gap-4 justify-center">
              {phase === 'player' && (
                <>
                  <button
                    onClick={() => submitWord()}
                    disabled={currentWord.length < 3}
                    className="px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-colors"
                  >
                    Submit Word
                  </button>
                  <button
                    onClick={() => clearSelection()}
                    disabled={selectedTiles.length === 0}
                    className="px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => endRound()}
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    End Turn
                  </button>
                </>
              )}
              {phase === 'flood' && (
                <button
                  onClick={() => startPlayerPhase()}
                  className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors animate-pulse"
                >
                  Start Playing!
                </button>
              )}
              {phase === 'gameOver' && (
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-red-600 mb-4">Game Over!</h2>
                  <p className="text-xl mb-2">Final Score: {score}</p>
                  <p className="mb-4">Rounds Survived: {round}</p>
                  <button
                    onClick={() => {
                      useTetrisGameStore.getState().resetGame();
                      useTetrisGameStore.getState().initializeGame();
                    }}
                    className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Play Again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <Toaster 
        position="bottom-center" 
        toastOptions={{
          duration: 1000,
          id: 'single-toast'
        }} 
      />
    </div>
  );
};

export default TetrisGame; 