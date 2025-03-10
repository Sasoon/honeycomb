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
  isShuffleAnimating: boolean;
  placedTilesThisTurn: HexCell[];
  score: number;
  turns: number;
  cursedWordHint: string;
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
  isShuffleAnimating,
  placedTilesThisTurn,
  score,
  turns,
  cursedWordHint,
  onCellClick,
  onTileSelect,
  onBurnTile,
  onEndPlacementPhase,
  onScoreWord
}, ref) => {
  return (
    <div 
      ref={ref}
      className="flex-grow"
    >
      {/* Game info section for mobile only - simplified */}
      <div className="md:hidden bg-white shadow-sm p-3 mb-4">
        <div className="flex flex-wrap items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-amber-900 font-bold">
              Score: {score}
            </div>
            <div className="text-gray-600">
              Turn: {turns}
            </div>
            <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
              {letterBagCount} tiles left
            </div>
          </div>
          
          <div className="mt-2 w-full">
            <div className="text-xs text-gray-600">
              {isPlacementPhase ? 'Placement Phase' : 'Word Formation Phase'}
            </div>
            <div className="text-xs text-red-600 font-medium">
              Cursed Word: {cursedWordHint}
            </div>
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
        <div className="flex items-center justify-center mx-auto max-w-lg mb-4 px-2">
          {/* Current word display */}
          {currentWord.length > 0 && (
            <div className={`px-3 py-1.5 rounded-lg shadow-sm mr-2 ${
              isWordAlreadyScored 
                ? 'bg-red-50 border border-red-200' 
                : 'bg-white'
            }`}>
              <span className="text-sm font-medium">Word: </span>
              <span className={`text-base font-bold ${
                isWordAlreadyScored ? 'text-red-500' : ''
              }`}>{currentWord}</span>
            </div>
          )}
          
          {/* Score Word button */}
          <button 
            className={`py-1.5 px-3 rounded-md shadow-sm flex items-center justify-center transition-colors text-sm font-medium ${
              isWordValid && !isWordAlreadyScored
                ? 'bg-green-500 hover:bg-green-600 text-white' 
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
            onClick={onScoreWord}
            disabled={!isWordValid || isWordAlreadyScored}
            aria-label="Score word"
          >
            Score Word <span className="ml-1">({potentialScore})</span>
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
                       relative hover:scale-105 ${isShuffleAnimating ? 'animate-spin' : ''}`}
            aria-label="Burn selected tile"
            style={{ 
              opacity: (!isPlacementPhase || !playerHand.some(t => t.isSelected)) ? 0.5 : 1,
              transition: 'transform 0.3s ease'
            }}
            title="Burn selected tile"
          >
            <svg viewBox="0 0 24 24" className="w-full h-full text-red-500">
              <circle cx="12" cy="12" r="11" fill="currentColor" />
              <path d="M17 8l-5 5-5-5M7 12l5 5 5-5" stroke="white" strokeWidth="2" fill="none" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});

export default GameContent; 