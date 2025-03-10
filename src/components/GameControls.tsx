import { useState } from 'react';

type GameControlsProps = {
  currentScore: number;
  targetScore: number;
  currentWord: string;
  turns: number;
  onScoreWord: () => void;
  onEndTurn: () => void;
  onResetWord: () => void;
  isWordValid: boolean;
  isPlacementPhase: boolean;
  cursedWordHint: string;
  placedTilesCount?: number;
  maxPlacementTiles?: number;
};

const GameControls = ({
  currentScore,
  targetScore,
  currentWord,
  turns,
  onScoreWord,
  onEndTurn,
  onResetWord,
  isWordValid,
  isPlacementPhase,
  cursedWordHint,
  placedTilesCount = 0,
  maxPlacementTiles = 2
}: GameControlsProps) => {
  return (
    <div className="game-controls bg-amber-50 rounded-lg shadow-sm border border-amber-100 overflow-hidden">
      {/* Phase indicator */}
      <div className="p-3 bg-amber-100 border-b border-amber-200">
        <h2 className="font-semibold text-amber-900">
          {isPlacementPhase ? 'Placement Phase' : 'Word Formation Phase'}
        </h2>
      </div>
      
      {/* Controls content */}
      <div className="p-3">
        {/* Cursed word hint */}
        <div className="mb-4">
          <div className="text-xs text-gray-600">Cursed Word Hint</div>
          <div className="text-lg font-bold text-red-600">
            {cursedWordHint}
          </div>
        </div>
        
        {/* Phase-specific controls */}
        {isPlacementPhase ? (
          <div className="space-y-2">
            {/* Tile count pill */}
            <div className="mb-3 text-center">
              <span className={`inline-block px-3 py-1 rounded-full text-sm ${
                placedTilesCount >= maxPlacementTiles 
                  ? 'bg-amber-200 text-amber-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {placedTilesCount}/{maxPlacementTiles} Tiles Placed
              </span>
            </div>
            
            {/* End placement phase button */}
            <button
              onClick={onEndTurn}
              className={`w-full py-2 px-3 rounded-md font-medium transition-colors ${
                placedTilesCount > 0
                  ? 'bg-honeycomb hover:bg-honeycomb-dark text-white' 
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
              disabled={placedTilesCount === 0}
            >
              {placedTilesCount > 0 
                ? `Begin Word Formation` 
                : 'Place at least 1 tile'}
            </button>
            
            {placedTilesCount > 0 && placedTilesCount < maxPlacementTiles && (
              <p className="text-xs text-gray-500 italic text-center mt-1">
                You can place {maxPlacementTiles - placedTilesCount} more tile{maxPlacementTiles - placedTilesCount > 1 ? 's' : ''}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Current word display */}
            {currentWord.length > 0 && (
              <div className="mb-3 text-center">
                <div className="inline-block px-3 py-1 bg-blue-100 rounded-md">
                  <span className="font-medium text-blue-800">{currentWord}</span>
                </div>
              </div>
            )}
            
            {/* Word formation buttons */}
            <button
              onClick={onScoreWord}
              className={`w-full py-2 px-3 font-medium rounded-md transition-colors ${
                isWordValid
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
              disabled={!isWordValid}
            >
              Score Word
            </button>
            
            {currentWord.length > 0 && (
              <button
                onClick={onResetWord}
                className="w-full py-2 px-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-md transition-colors"
              >
                Reset Selection
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameControls; 