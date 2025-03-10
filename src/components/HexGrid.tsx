// Remove React import

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

type HexGridProps = {
  gridSize: number;
  cells: HexCell[];
  onCellClick: (cell: HexCell) => void;
  isWordValid?: boolean;
  isPlacementPhase: boolean;
  isWordAlreadyScored?: boolean;
  placedTilesThisTurn?: HexCell[];
};

const HexGrid = ({ 
  cells, 
  onCellClick, 
  isWordValid, 
  isPlacementPhase,
  isWordAlreadyScored,
  placedTilesThisTurn = []
}: HexGridProps) => {
  const cellStyles = (cell: HexCell) => {
    let bgColor = 'bg-white';
    let textColor = 'text-gray-800';
    let border = '';
    let extraClasses = '';
    
    const isPlacedThisTurn = placedTilesThisTurn.some(
      placedCell => placedCell.id === cell.id
    );
    
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
        bgColor = 'bg-green-100';
        border = 'border-green-500';
      }
    } else if (cell.isPrePlaced) {
      bgColor = 'bg-honeycomb-light';
      border = 'hex-border-honeycomb';
    }
    
    // If double score, add that class
    if (cell.isDoubleScore) {
      extraClasses = 'hex-double-score';
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
                  className={`hex-grid__item ${cellStyles(cell)}`}
                  onClick={() => onCellClick(cell)}
                  data-row={cell.position.row}
                  data-col={cell.position.col}
                >
                  <div className="hex-grid__content">
                    <span className="letter-tile">{cell.letter || ''}</span>
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
    <div className="hex-grid">
      <div className="flex flex-col items-center">
        {renderHoneycombRows()}
      </div>
    </div>
  );
};

export default HexGrid; 