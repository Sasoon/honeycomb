import { useState } from 'react';
import { PathConnection } from '../lib/gameUtils';

// Define types for our grid
export type CellPosition = {
  row: number;
  col: number;
};

export interface HexCell {
  id: string;
  position: CellPosition;
  letter: string;
  isPrePlaced: boolean;
  isSelected: boolean;
  isPlaced: boolean;
  isDoubleScore: boolean;
  usageCount?: number; // Track how many times a cell has been used in a word
}

type HexGridProps = {
  gridSize: number;
  cells: HexCell[];
  onCellClick: (cell: HexCell) => void;
  isWordValid?: boolean;
  isPlacementPhase: boolean;
  isWordAlreadyScored?: boolean;
  connections?: PathConnection[]; // Add connections prop
};

const HexGrid = ({ 
  gridSize, 
  cells, 
  onCellClick, 
  isWordValid, 
  isPlacementPhase,
  isWordAlreadyScored,
  connections = [] // Default to empty array
}: HexGridProps) => {
  const cellStyles = (cell: HexCell) => {
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
      bgColor = 'bg-amber-100';
      border = 'hex-border-amber';
    } else {
      bgColor = cell.letter ? 'bg-white' : 'bg-gray-50';
      border = cell.letter ? 'hex-border-gray' : 'hex-border-dashed';
    }
    
    if (cell.isDoubleScore) {
      extraClasses += ' double-score';
    }
    
    return `${bgColor} ${textColor} ${border} ${extraClasses}`;
  };

  // Function to calculate cell position in px
  const getCellPosition = (cell: HexCell) => {
    // Use a hexagon with a side length of 30px
    const hexHeight = 60; // 2 * 30
    const hexWidth = Math.sqrt(3) * 30; // ~52
    
    // Offset for odd rows
    const oddRowOffset = hexWidth / 2;
    
    // Calculate position
    const x = cell.position.col * hexWidth + (cell.position.row % 2 === 1 ? oddRowOffset : 0);
    const y = cell.position.row * (hexHeight * 0.75); // Overlap by 1/4 height
    
    return { x, y };
  };
  
  // Function to draw the connections between cells
  const renderConnections = () => {
    if (!connections || connections.length === 0) return null;
    
    // Map from cell ID to position
    const positionMap = new Map<string, { x: number, y: number }>();
    cells.forEach(cell => {
      positionMap.set(cell.id, getCellPosition(cell));
    });
    
    // Calculate the SVG viewBox dimensions based on the cells
    const minX = Math.min(...Array.from(positionMap.values()).map(pos => pos.x)) - 30;
    const minY = Math.min(...Array.from(positionMap.values()).map(pos => pos.y)) - 30;
    const maxX = Math.max(...Array.from(positionMap.values()).map(pos => pos.x)) + 60;
    const maxY = Math.max(...Array.from(positionMap.values()).map(pos => pos.y)) + 60;
    
    const viewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
    
    return (
      <svg 
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        viewBox={viewBox}
        style={{ zIndex: 10 }}
      >
        {connections.map((conn, index) => {
          const fromPos = positionMap.get(conn.from);
          const toPos = positionMap.get(conn.to);
          
          if (!fromPos || !toPos) return null;
          
          // Calculate center point of hexagons (30px is hex side length)
          const fromX = fromPos.x + 30;
          const fromY = fromPos.y + 30;
          const toX = toPos.x + 30;
          const toY = toPos.y + 30;
          
          return (
            <line
              key={`conn-${index}`}
              x1={fromX}
              y1={fromY}
              x2={toX}
              y2={toY}
              stroke={conn.dotted ? '#f97316' : '#0ea5e9'} // Amber for dotted lines, blue for solid
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={conn.dotted ? '5,5' : 'none'}
            />
          );
        })}
      </svg>
    );
  };

  const renderHoneycombRows = () => {
    // Group cells by row
    const rowMap = new Map<number, HexCell[]>();
    cells.forEach(cell => {
      const row = cell.position.row;
      if (!rowMap.has(row)) {
        rowMap.set(row, []);
      }
      rowMap.get(row)?.push(cell);
    });
    
    // Sort rows by number
    const sortedRows = Array.from(rowMap.entries()).sort((a, b) => a[0] - b[0]);
    
    return (
      <div className="flex flex-col honeycomb-grid">
        {sortedRows.map(([rowNum, rowCells]) => (
          <div 
            key={`row-${rowNum}`} 
            className={`flex flex-row ${rowNum % 2 === 1 ? 'honeycomb-row-odd' : ''}`}
          >
            {rowCells.sort((a, b) => a.position.col - b.position.col).map(cell => (
              <div 
                key={cell.id}
                className={`hexagon ${cellStyles(cell)}`}
                onClick={() => onCellClick(cell)}
              >
                <div className="hex-content">
                  {cell.letter}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="honeycomb-container relative">
      {renderConnections()}
      {renderHoneycombRows()}
    </div>
  );
};

export default HexGrid; 