// Remove React import
import { useState, useRef, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
// import HexagonBorder from './HexagonBorder'; // Available for future use

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
  isAutoClear?: boolean;
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
  hiddenLetterCellIds?: string[]; // cells whose resident letters are hidden temporarily
  isTetrisVariant?: boolean; // Flag to disable base game features in tetris mode
  enableLayout?: boolean; // Whether to enable framer-motion layout animations (default true)
  isSettling?: boolean; // When true, tiles ease-out settle on new game
}


const CellView = memo(function CellView({
  cell,
  onClick,
  containerClass,
  setRef,
  showLetter,
  // showBorder, // Disabled - borders removed from selected tiles
  // borderColor, // Disabled - borders removed from selected tiles
  // drag handlers removed
  enableLayout = true,
  isSettling,
}: {
  cell: HexCell;
  onClick: (cell: HexCell) => void;
  containerClass: string;
  setRef: (el: HTMLDivElement | null) => void;
  showLetter: boolean;
  // showBorder?: boolean; // Disabled - borders removed from selected tiles
  // borderColor?: string; // Disabled - borders removed from selected tiles
  // drag handlers removed
  enableLayout?: boolean;
  isSettling?: boolean;
}) {
  const layoutProps = enableLayout ? { layout: true } : {};
  const settleDelay = ((cell.position.row * 5 + cell.position.col * 2) % 7) * 0.02;
  const applySettle = !!isSettling;
  return (
    <motion.div
      key={cell.id}
      ref={setRef}
      data-cell-id={cell.id}
      data-row={cell.position.row}
      data-col={cell.position.col}
      data-placed-this-turn={cell.placedThisTurn ? 'true' : 'false'}
      className={`hex-grid__item ${containerClass} ${applySettle ? 'settle-tile' : ''}`}
      onClick={() => onClick(cell)}
      // drag handlers removed
      {...layoutProps}
      style={{ position: 'relative', ...(applySettle ? { animationDelay: `${settleDelay}s` } : {}) }}
    >
      <div className="hex-grid__content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="letter-tile" style={{ fontWeight: 700, fontSize: '1.1rem', opacity: showLetter ? 1 : 0 }}>
          {showLetter ? (cell.letter || '') : ''}
        </span>
        {cell.isDoubleScore && (
          <div className="double-score-badge" style={{ position: 'absolute', top: '-6px', right: '-6px' }}>
            <span
              style={{
                display: 'inline-block',
                background: '#fde68a',
                color: '#92400e',
                fontWeight: 700,
                fontSize: '0.7rem',
                padding: '2px 4px',
                borderRadius: '6px',
              }}
            >
              2×
            </span>
          </div>
        )}
        {/* HexagonBorder disabled for selected tiles - kept available for future use */}
        {/* {showBorder && (
          <HexagonBorder
            isVisible={true}
            color={borderColor || 'var(--primary)'}
            strokeWidth={2}
          />
        )} */}
      </div>
    </motion.div>
  );
});

const HexGrid = ({
  cells,
  onCellClick,
  isWordValid,
  isPlacementPhase,
  isWordAlreadyScored,
  placedTilesThisTurn = [],
  hiddenLetterCellIds = [],
  enableLayout = true,
  isSettling = false,
}: HexGridProps) => {
  // drag-to-select removed: revert to tap/click only
  
  // Refs to track positions of cells
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  
  // Animation states
  const [justPlacedIds, setJustPlacedIds] = useState<Set<string>>(new Set());
  const [animationCompletedIds, setAnimationCompletedIds] = useState<Set<string>>(new Set());
  const prevPlacedTilesRef = useRef<HexCell[]>([]);
  const animationTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  

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
    let bgColor = 'bg-secondary';
    let textColor = 'text-primary';
    let extraClasses = '';
    // let showBorder = false; // Disabled - borders removed from selected tiles
    // let borderColor = ''; // Disabled - borders removed from selected tiles

    const isPlacedThisTurn = placedTilesThisTurn.some(
      placedCell => placedCell.id === cell.id
    );
    const isAnimatingPlacement = justPlacedIds.has(cell.id);
    const hasFinishedAnimation = animationCompletedIds.has(cell.id);

    // Auto-clear highlighting (orange/amber)
    if (cell.isAutoClear) {
      bgColor = 'bg-amber-light';
      textColor = 'text-white';
      extraClasses = 'ring-2 ring-amber-400 animate-pulse';
    } else if (cell.isSelected) {
      // Apply validation feedback colors if a word path is formed (not in placement phase)
      if (!isPlacementPhase) {
        // showBorder = true; // Disabled - no borders for selected tiles
        if (isWordAlreadyScored) {
          // Always show red for already scored words
          bgColor = 'bg-amber-dark';
          // borderColor = 'var(--color-1)';
        } else if (isWordValid === true) {
          bgColor = 'bg-amber-light';
          // borderColor = 'var(--success-dark)';
        } else if (isWordValid === false) {
          bgColor = 'bg-amber-dark';
          // borderColor = 'var(--color-1)';
        } else {
          bgColor = 'bg-highlight-dark';
          // borderColor = 'var(--color-2)';
        }
        textColor = 'text-white';
      } else {
        // Placement phase highlighting
        if (isPlacedThisTurn) {
          bgColor = 'bg-highlight-light';
          // showBorder = true; // Disabled - no borders for selected tiles
          // borderColor = 'var(--secondary)';
          extraClasses = isAnimatingPlacement ? 'scale-110 shadow-lg' : hasFinishedAnimation ? '' : 'scale-105';
        } else {
          bgColor = 'bg-highlight-dark';
          // showBorder = true; // Disabled - no borders for selected tiles
          // borderColor = 'var(--color-2)';
        }
      }
    }

    return {
      container: `${bgColor} ${textColor} ${extraClasses}`,
      // showBorder, // Disabled - borders removed from selected tiles
      // borderColor, // Disabled - borders removed from selected tiles
    };
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
            {rowCells.map(cell => {
              const showLetter = !hiddenLetterCellIds.includes(cell.id);
              const styles = cellStyles(cell);
              return (
                <div key={cell.id} style={{ width: '70px', margin: '0 5px' }}> {/* Adjust width and horizontal overlap */}
                  <CellView
                    cell={cell}
                    onClick={onCellClick}
                    containerClass={styles.container}
                    setRef={(el) => { if (el) cellRefs.current.set(cell.id, el); }}
                    showLetter={showLetter}
                    enableLayout={enableLayout}
                    isSettling={isSettling}
                    // showBorder={styles.showBorder} // Disabled - borders removed
                    // borderColor={styles.borderColor} // Disabled - borders removed
                    // drag handlers removed
                  />
                </div>
              );
            })}
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
      
      
      <style>{`
        .letter-tile { user-select:none; -webkit-user-select:none; }

        @keyframes ghost-drop {
          0% { transform: scale(0.9); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default HexGrid; 