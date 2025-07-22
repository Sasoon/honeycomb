// Remove React import
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Define types for our grid
export type CellPosition = {
  row: number;
  col: number;
};

export type HexCell = {
  id: string;
  position: CellPosition;
  letter: string;
  isPrePlaced: boolean;
  isSelected: boolean;
  isPlaced: boolean;
  isDoubleScore: boolean;
  placedThisTurn?: boolean;
  isPistonTarget?: boolean; // Indicates if the cell is a valid target for piston movement
  isAdjacentToPistonSource?: boolean; // Highlights adjacent cells when a piston is being used
};

export interface HexGridProps {
  gridSize: number;
  cells: HexCell[];
  onCellClick: (cell: HexCell) => void;
  isWordValid?: boolean;
  isPlacementPhase: boolean;
  isWordAlreadyScored?: boolean;
  placedTilesThisTurn: HexCell[];
  isGameActive?: boolean;
  playerHandRef?: React.RefObject<HTMLDivElement | null>; // Update type to accept null
}

// Interface for the animated tile (either piston or undo)
interface AnimatedTile {
  letter: string;
  sourcePosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
  isAnimating: boolean;
  angle?: number; // Angle for trail effect
  dimensions?: { width: number; height: number }; // Store actual hex dimensions
}

const HexGrid = ({ 
  cells, 
  onCellClick, 
  isWordValid, 
  isPlacementPhase,
  isWordAlreadyScored,
  placedTilesThisTurn = []
}: HexGridProps) => {
  // State for the animated tile (piston movement only)
  const [animatedTile, setAnimatedTile] = useState<AnimatedTile | null>(null);
  
  // State to track the target cell ID during animations
  const [pistonAnimationTargetId, setPistonAnimationTargetId] = useState<string | null>(null);
  
  // Refs to track positions of cells
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Previous state of cells to detect changes
  const prevCellsRef = useRef<HexCell[]>([]);
  
  // Animation states
  const [justPlacedIds, setJustPlacedIds] = useState<Set<string>>(new Set());
  const [animationCompletedIds, setAnimationCompletedIds] = useState<Set<string>>(new Set());
  const prevPlacedTilesRef = useRef<HexCell[]>([]);
  const animationTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Effect to detect piston movement and trigger animation
  useEffect(() => {
    // Find the source cell (the one that had a letter but now doesn't)
    let sourceCell = null;
    let targetCell = null;
    
    // Look for a cell that had a letter in the previous state but doesn't now
    for (let i = 0; i < prevCellsRef.current.length; i++) {
      const prevCell = prevCellsRef.current[i];
      const currentCell = cells.find(c => c.id === prevCell.id);
      
      if (prevCell && currentCell && prevCell.letter && !currentCell.letter) {
        sourceCell = prevCell;
        break;
      }
    }
    
    // If we found a source cell, look for where its letter went
    if (sourceCell) {
      // Find any cell that was recently placed and has the source's letter
      targetCell = cells.find(cell => 
        cell.placedThisTurn && 
        cell.letter === sourceCell.letter && 
        cell.id !== sourceCell.id
      );
    }
    
    // Start animation immediately if we found both cells
    if (sourceCell && targetCell) {
      const sourceElement = cellRefs.current.get(sourceCell.id);
      const targetElement = cellRefs.current.get(targetCell.id);
      
      if (sourceElement && targetElement) {
        const sourceRect = sourceElement.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();
        
        // Calculate angle for the trail effect
        const dx = targetRect.left - sourceRect.left;
        const dy = targetRect.top - sourceRect.top;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        
        // Get exact dimensions from the source element
        const dimensions = {
          width: sourceRect.width,
          height: sourceRect.height
        };
        
        // For more accurate positioning, focus on the hex cells directly
        const sourceX = sourceRect.left + sourceRect.width / 2;
        const sourceY = sourceRect.top + sourceRect.height / 2;
        const targetX = targetRect.left + targetRect.width / 2;
        const targetY = targetRect.top + targetRect.height / 2;
        
        // Before starting piston animation, prevent tile-placement animation on the target
        // by marking it as completed already
        setAnimationCompletedIds(prev => new Set([...prev, targetCell.id]));
        
        // Make sure the target is not in the justPlacedIds set
        setJustPlacedIds(prev => {
          const next = new Set(prev);
          next.delete(targetCell.id);
          return next;
        });

        // Clear any existing timeout for this target cell
        const existingTimeout = animationTimeoutsRef.current.get(targetCell.id);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          animationTimeoutsRef.current.delete(targetCell.id);
        }
        
        // Set up the animated tile immediately without any delays
        setAnimatedTile({
          letter: sourceCell.letter,
          sourcePosition: {
            x: sourceX,
            y: sourceY
          },
          targetPosition: {
            x: targetX,
            y: targetY
          },
          isAnimating: true,
          angle: angle,
          dimensions: dimensions
        });
        
        // Track the target ID to prevent conflicting animations
        setPistonAnimationTargetId(targetCell.id);
        
        // Add impact class to target element
        targetElement.classList.add('piston-target-impact');
        
        // Reset the animation and remove impact class after it completes
        setTimeout(() => {
          setAnimatedTile(null);
          targetElement.classList.remove('piston-target-impact');
          setPistonAnimationTargetId(null); // Clear the target ID
        }, 500); // Standardized to 0.5s to match other animations
      }
    }
    
    // Update the previous cells reference
    prevCellsRef.current = JSON.parse(JSON.stringify(cells));
  }, [cells]);

  // Effect to detect tile placements - removed removal animations
  useEffect(() => {
    const currentPlacedIds = new Set(placedTilesThisTurn.map(t => t.id));
    const prevPlacedIds = new Set(prevPlacedTilesRef.current.map(t => t.id));
    
    const newlyPlaced = new Set<string>();
    currentPlacedIds.forEach(id => {
      if (!prevPlacedIds.has(id) && !animationCompletedIds.has(id)) {
        newlyPlaced.add(id);
      }
    });

    // Handle newly placed tiles
    if (newlyPlaced.size > 0) {
      // Add to the set that triggers the animation
      setJustPlacedIds(prev => new Set([...prev, ...newlyPlaced]));
  
      // Set timeouts to transition from animating to finished state
      newlyPlaced.forEach(id => {
        // Clear any existing timeout for this ID first
        const existingTimeout = animationTimeoutsRef.current.get(id);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        const timer = setTimeout(() => {
          // Remove from animating set
          setJustPlacedIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          // Add to finished set
          setAnimationCompletedIds(prev => new Set([...prev, id]));
          animationTimeoutsRef.current.delete(id); // Clean up ref
        }, 500); // Animation duration
  
        animationTimeoutsRef.current.set(id, timer); // Store timeout
      });
    }

    // Handle removed (undone) tiles - just clean up state without animations
    const removedPlaced = new Set<string>();
    prevPlacedIds.forEach(id => {
      if (!currentPlacedIds.has(id)) {
        removedPlaced.add(id);
      }
    });
    
    if (removedPlaced.size > 0) {
        // Remove from animating set
        setJustPlacedIds(prev => {
            const next = new Set(prev);
            removedPlaced.forEach(id => next.delete(id));
            return next;
        });
        // Remove from finished set
        setAnimationCompletedIds(prev => {
            const next = new Set(prev);
            removedPlaced.forEach(id => next.delete(id));
            return next;
        });
        // Clear any pending timeouts for removed tiles
        removedPlaced.forEach(id => {
             const existingTimeout = animationTimeoutsRef.current.get(id);
             if (existingTimeout) {
                clearTimeout(existingTimeout);
                animationTimeoutsRef.current.delete(id);
             }
        });
    }
    
    // Update the ref for the next comparison *after* processing changes
    prevPlacedTilesRef.current = [...placedTilesThisTurn];
  
  }, [placedTilesThisTurn, cells]);

  // Effect to reset animation states when the placement phase ends/begins (turn change)
  useEffect(() => {
    setJustPlacedIds(new Set());
    setAnimationCompletedIds(new Set());
    prevPlacedTilesRef.current = []; // Reset comparison baseline
    // Clear any pending animation timeouts
    animationTimeoutsRef.current.forEach(clearTimeout);
    animationTimeoutsRef.current.clear();
  }, [isPlacementPhase]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      animationTimeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  const cellStyles = (cell: HexCell) => {
    let bgColor = 'bg-white';
    let textColor = 'text-gray-800';
    let border = '';
    let extraClasses = '';
    
    const isPlacedThisTurn = placedTilesThisTurn.some(
      placedCell => placedCell.id === cell.id
    );
    const isAnimatingPlacement = justPlacedIds.has(cell.id);
    const hasFinishedAnimation = animationCompletedIds.has(cell.id);
    const isPistonTarget = cell.id === pistonAnimationTargetId;
    
    if (cell.isPistonTarget) {
      // Highlight the cell targeted by a piston (highest priority)
      bgColor = 'bg-amber-100';
      extraClasses += ' scale-105';
    } else if (cell.isAdjacentToPistonSource) {
      // Highlight cells adjacent to a selected piston target
      // Style differently based on whether the cell is empty or occupied
      if (cell.isPlaced) {
        // Occupied adjacent cells - use orange to indicate replacement
        bgColor = 'bg-orange-100';
        extraClasses = 'pulse-glow';
      } else {
        // Empty adjacent cells - use purple as before
        bgColor = 'bg-purple-100';
        extraClasses = 'pulse-glow';
      }
    } else if (cell.isSelected) {
      // Apply validation feedback colors if a word path is formed (not in placement phase)
      if (!isPlacementPhase) {
        if (isWordAlreadyScored) {
          // Always show red for already scored words
          bgColor = 'bg-red-500';
          border = 'hex-border-red';
        } else if (isWordValid === true) {
          bgColor = 'bg-green-500';
          border = 'hex-border-green';
        } else if (isWordValid === false) {
          bgColor = 'bg-red-500';
          border = 'hex-border-red';
        } else {
          bgColor = 'bg-blue-500';
          border = 'hex-border-blue';
        }
        textColor = 'text-white';
      } else {
        // Placement phase highlighting
        bgColor = 'bg-amber-200';
        textColor = 'text-amber-900';
      }
    } else if (cell.isPlaced) {
      // Regular placed tile styling
      bgColor = cell.isPrePlaced ? 'bg-slate-200' : 'bg-blue-100';
      
      // Highlight tiles placed in the current turn
      if (isPlacedThisTurn) {
        // Special handling for piston target - keep a neutral color during animation
        if (isPistonTarget) {
          // Use a neutral blue background during piston animation
          bgColor = 'bg-blue-100';
          border = 'border-blue-400';
          // No extra animation classes since piston-target-impact will be added via DOM
        } else {
          // Normal green background for non-piston tiles placed this turn
          bgColor = 'bg-green-100';
          border = 'border-green-500';

          if (isAnimatingPlacement) {
            // Add animation classes if currently animating
            extraClasses += ' tile-placed-animation hex-placement-impact'; 
          } else if (hasFinishedAnimation) {
            // Add finished marker class if animation completed this turn
            extraClasses += ' animation-finished';
          }
        }
      }
    } else if (cell.isPrePlaced) {
      bgColor = 'bg-honeycomb-light';
      border = 'hex-border-honeycomb';
    }
    
    // If double score, add that class
    if (cell.isDoubleScore) {
      extraClasses += ' hex-double-score';
    }
    
    return `${bgColor} ${textColor} ${border} ${extraClasses}`;
  };

  // Group cells by row for the honeycomb layout
  const renderHoneycombRows = () => {
    // Find max rows
    const maxRow = cells.reduce((max, cell) => Math.max(max, cell.position.row), 0);
    
    // Create an array of rows
    const rows = [];
    
    for (let r = 0; r <= maxRow; r++) {
      // Filter cells for current row and sort by column
      const rowCells = cells
        .filter(cell => cell.position.row === r)
        .sort((a, b) => a.position.col - b.position.col);
      
      if (rowCells.length > 0) {
        // Add row with proper odd/even class for offset
        rows.push(
          <div 
            key={`row-${r}`} 
            className={`flex justify-center ${r % 2 === 1 ? 'row-odd' : ''}`}
            style={{ marginBottom: '10px', marginTop: '-25px' }} // Tighten vertical spacing
          >
            {rowCells.map(cell => (
              <div key={cell.id} style={{ width: '70px', margin: '0 5px' }}> {/* Adjust width and horizontal overlap */}
                <div
                  ref={el => {
                    if (el) cellRefs.current.set(cell.id, el);
                  }}
                  className={`hex-grid__item ${cellStyles(cell)}`}
                  onClick={() => onCellClick(cell)}
                  data-row={cell.position.row}
                  data-col={cell.position.col}
                  data-cell-id={cell.id}
                >
                  <div className="hex-grid__content">
                    {/* Only show letter if not the active piston target */}
                    {cell.id !== pistonAnimationTargetId && (
                      <span className={`letter-tile ${
                        // Check if it's a special tile (emoji)
                        ['💣', '⚡', '❄️', '🌟'].includes(cell.letter) ? 'text-2xl' : ''
                      }`}>{cell.letter || ''}</span>
                    )}
                    {cell.isDoubleScore && (
                      <div className="double-score-badge">
                        <span>2×</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      }
    }
    
    return rows;
  };

  return (
    <div className="hex-grid relative">
      <div className="flex flex-col items-center">
        {renderHoneycombRows()}
      </div>
      
      {/* Animated tile for piston movement only */}
      <AnimatePresence mode="sync">
        {animatedTile && animatedTile.isAnimating && (
          <motion.div
            initial={{ 
              position: 'fixed', 
              left: animatedTile.sourcePosition.x, 
              top: animatedTile.sourcePosition.y, 
              x: '-50%', 
              y: '-50%',
              scale: 1,
              zIndex: 100,
              opacity: 1
            }}
            animate={{ 
              left: animatedTile.targetPosition.x, 
              top: animatedTile.targetPosition.y,
              scale: 1
            }}
            transition={{ 
              type: 'spring',
              duration: 0.5,
              bounce: 0.1,
              delay: 0,
              immediate: true
            }}
            className="piston-animated-tile"
            style={{
              '--trail-angle': `${animatedTile.angle}deg`,
              width: `${animatedTile.dimensions?.width || 70}px`,
              height: `${animatedTile.dimensions?.height || 60}px`
            } as React.CSSProperties}
          >
            <motion.div
              className="hex-grid__item bg-purple-100 border-purple-500 piston-animated-tile-inner"
            >
              <div className="hex-grid__content">
                <span className="letter-tile">{animatedTile.letter}</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <style>{`
        .piston-animated-tile {
          pointer-events: none;
          will-change: transform;
        }
        
        .piston-animated-tile-inner {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 1.25rem;
          will-change: transform;
          clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
          margin: 0;
          padding: 0;
          filter: drop-shadow(0px 0px 8px rgba(147, 51, 234, 0.5));
        }
        
        /* Fix any vertical alignment issues with the letter inside */
        .piston-animated-tile-inner .letter-tile {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          margin: 0;
          padding: 0;
        }

        /* Piston target impact styling */
        .piston-target-impact {
          position: relative;
        }
        
        .piston-target-impact::after {
          content: '';
          position: absolute;
          inset: -5px;
          border-radius: 9999px;
          background: transparent;
          border: 3px solid rgba(147, 51, 234, 0.6);
          clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
          animation: piston-impact 0.5s ease-out forwards;
          z-index: 5;
        }
        
        @keyframes piston-impact {
          0% {
            transform: scale(1.2);
            opacity: 0.8;
          }
          50% {
            opacity: 0.6;
          }
          100% {
            transform: scale(0.8);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default HexGrid; 