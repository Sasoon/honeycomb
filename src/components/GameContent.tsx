import { forwardRef } from 'react';
import HexGrid, { HexCell } from './HexGrid';
import PlayerHand, { LetterTile } from './PlayerHand';

interface GameContentProps {
  grid: HexCell[];
  gridSize: number;
  playerHand: LetterTile[];
  letterBagCount: number;
  currentWord: string;
  isPlacementPhase: boolean;
  isWordValid: boolean;
  isWordAlreadyScored: boolean;
  potentialScore: number;
  isDictionaryLoading: boolean;
  placedTilesThisTurn: HexCell[];
  score: number;
  turns: number;
  onCellClick: (cell: HexCell) => void;
  onTileSelect: (tile: LetterTile) => void;
  onBurnTile: () => void;
  onEndPlacementPhase: () => void;
  onScoreWord: () => void;
}

const GameContent = forwardRef<HTMLDivElement, GameContentProps>(({
  grid,
  gridSize,
  playerHand,
  letterBagCount,
  currentWord,
  isPlacementPhase,
  isWordValid,
  isWordAlreadyScored,
  potentialScore,
  isDictionaryLoading,
  placedTilesThisTurn,
  score,
  turns,
  onCellClick,
  onTileSelect,
  onBurnTile,
  onEndPlacementPhase,
  onScoreWord,
}, ref) => {
  return (
    <div 
      ref={ref}
      className="flex-grow"
    >
      {/* Game info section for mobile only - simplified */}
      <div className="md:hidden bg-white shadow-sm p-3 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xs text-gray-500">Score</div>
            <div className="text-xl font-bold">{score}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Turn</div>
            <div className="text-xl font-bold">{turns}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Tiles</div>
            <div className="text-xl font-bold">{letterBagCount}</div>
          </div>
        </div>
      </div>
       
      {/* Grid container */}
      <div className="grid-container flex justify-center mb-4 md:mb-6 mt-4 md:mt-0">
        <HexGrid 
          gridSize={gridSize}
          cells={grid} 
          onCellClick={onCellClick}
          isWordValid={currentWord.length >= 3 ? isWordValid : undefined}
          isPlacementPhase={isPlacementPhase}
          isWordAlreadyScored={isWordAlreadyScored}
          placedTilesThisTurn={placedTilesThisTurn}
        />
      </div>
      
      {/* Action buttons - moved above player hand */}
      {!isPlacementPhase ? (
        <div className="flex justify-center mb-4">
          <button
            className="py-1.5 px-3 bg-red-500 hover:bg-red-600 text-white rounded-md shadow-sm
                      flex items-center justify-center transition-colors text-sm font-medium mr-2"
            onClick={() => onScoreWord()}
            disabled={!isWordValid || isWordAlreadyScored || currentWord.length < 3}
            aria-label="Score word"
          >
            Score Word <span className="ml-1">({potentialScore})</span>
            {isDictionaryLoading && (
              <span className="ml-1 animate-pulse">•••</span>
            )}
          </button>
        </div>
      ) : (
        <div className="flex justify-center mb-4">
          {placedTilesThisTurn.length > 0 && (
            <button 
              className="py-1.5 px-3 bg-honeycomb hover:bg-honeycomb-dark text-white rounded-md shadow-sm
                       flex items-center justify-center transition-colors text-sm font-medium"
              onClick={onEndPlacementPhase}
              aria-label="End placement phase"
            >
              Begin Word Formation <span className="ml-1">→</span>
            </button>
          )}
        </div>
      )}
      
      {/* Player hand with positioned action buttons */}
      <div className="mt-4 pb-16 md:pb-0 relative">
        {/* Modified PlayerHand component - don't pass reshuffle props anymore */}
        <div className="flex items-center justify-center">
          <PlayerHand 
            tiles={playerHand} 
            onTileSelect={onTileSelect} 
            tilesRemaining={letterBagCount}
          />
          
          {/* Burn button */}
          <button
            onClick={onBurnTile}
            disabled={!isPlacementPhase || !playerHand.some(t => t.isSelected)}
            className={`h-12 w-12 ml-2 order-2 flex items-center justify-center
                       relative hover:scale-105`}
            aria-label="Burn selected tile"
            style={{ 
              opacity: !isPlacementPhase || !playerHand.some(t => t.isSelected) ? 0.5 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-red-500">
              <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 00-1.071-.136 9.742 9.742 0 00-3.539 6.177A7.547 7.547 0 016.648 6.61a.75.75 0 00-1.152.082A9 9 0 1015.68 4.534a7.46 7.46 0 01-2.717-2.248zM15.75 14.25a3.75 3.75 0 11-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 011.925-3.545 3.75 3.75 0 013.255 3.717z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});

export default GameContent; 