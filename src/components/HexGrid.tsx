import { memo, useMemo, useCallback } from 'react';

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
};

type HexGridProps = {
  gridSize: number;
  cells: HexCell[];
  onCellClick: (cell: HexCell) => void;
  isWordValid?: boolean;
  isPlacementPhase: boolean;
  isWordAlreadyScored?: boolean;
};

// Memoized single cell component
const HexCell = memo(({ 
  cell, 
  onCellClick, 
  isWordValid, 
  isPlacementPhase, 
  isWordAlreadyScored 
}: { 
  cell: HexCell; 
  onCellClick: (cell: HexCell) => void;
  isWordValid?: boolean;
  isPlacementPhase: boolean;
  isWordAlreadyScored?: boolean;
}) => {
  // Memoize cell styles to prevent recalculation
  const cellStyle = useMemo(() => {
    let bgColor = 'bg-white';
    let textColor = 'text-gray-800';
    let border = '';
    let extraClasses = '';
    
    if (cell.isSelected) {
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
      } else {
        bgColor = 'bg-blue-500';
        border = 'hex-border-blue';
      }
      textColor = 'text-white';
    } else if (cell.isPlaced) {
      bgColor = 'bg-green-100';
      border = 'hex-border-green';
    } else if (cell.isPrePlaced) {
      bgColor = 'bg-honeycomb-light';
      border = 'hex-border-honeycomb';
    } else {
      border = 'hex-border-gray';
    }
    
    if (cell.isDoubleScore) {
      extraClasses = 'hex-double-score';
    }
    
    return `${bgColor} ${textColor} ${border} ${extraClasses}`;
  }, [cell, isWordValid, isPlacementPhase, isWordAlreadyScored]);

  // Memoize click handler
  const handleClick = useCallback(() => {
    onCellClick(cell);
  }, [cell, onCellClick]);

  return (
    <div
      className={`hex cursor-pointer ${cellStyle}`}
      onClick={handleClick}
    >
      <div className="hex-content flex items-center justify-center font-bold text-xl md:text-2xl select-none">
        {cell.letter}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memoization
  // Only re-render if these specific props change
  return (
    prevProps.cell.id === nextProps.cell.id &&
    prevProps.cell.letter === nextProps.cell.letter &&
    prevProps.cell.isSelected === nextProps.cell.isSelected &&
    prevProps.cell.isPlaced === nextProps.cell.isPlaced &&
    prevProps.cell.isPrePlaced === nextProps.cell.isPrePlaced &&
    prevProps.isWordValid === nextProps.isWordValid &&
    prevProps.isPlacementPhase === nextProps.isPlacementPhase &&
    prevProps.isWordAlreadyScored === nextProps.isWordAlreadyScored
  );
});

const HexGrid = memo(({ 
  cells, 
  onCellClick, 
  isWordValid, 
  isPlacementPhase,
  isWordAlreadyScored
}: HexGridProps) => {
  
  // Group cells by row for the honeycomb layout - memoize to prevent recalculation
  const renderedRows = useMemo(() => {
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
              <HexCell
                key={cell.id}
                cell={cell}
                onCellClick={onCellClick}
                isWordValid={isWordValid}
                isPlacementPhase={isPlacementPhase}
                isWordAlreadyScored={isWordAlreadyScored}
              />
            ))}
          </div>
        );
      }
    }
    
    return rows;
  }, [cells, onCellClick, isWordValid, isPlacementPhase, isWordAlreadyScored]);

  return (
    <div className="hex-grid p-3 md:p-0">
      {renderedRows}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memoization of the entire grid
  if (prevProps.cells.length !== nextProps.cells.length) return false;
  
  // If isWordValid, isPlacementPhase, or isWordAlreadyScored changed, re-render
  if (
    prevProps.isWordValid !== nextProps.isWordValid ||
    prevProps.isPlacementPhase !== nextProps.isPlacementPhase ||
    prevProps.isWordAlreadyScored !== nextProps.isWordAlreadyScored
  ) {
    return false;
  }
  
  // Check if any cell has changed
  for (let i = 0; i < prevProps.cells.length; i++) {
    const prevCell = prevProps.cells[i];
    const nextCell = nextProps.cells[i];
    if (
      prevCell.id !== nextCell.id ||
      prevCell.letter !== nextCell.letter ||
      prevCell.isSelected !== nextCell.isSelected ||
      prevCell.isPlaced !== nextCell.isPlaced
    ) {
      return false;
    }
  }
  
  return true;
});

export default HexGrid; 