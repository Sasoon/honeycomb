import { forwardRef } from 'react';
import HexGrid, { HexCell } from './HexGrid';
import PlayerHand, { LetterTile } from './PlayerHand';
import UndoButton from './UndoButton';
import MobileGameControls from './MobileGameControls';
import { WordHistoryEntry } from '../store/activeGameStore';
import { TARGET_SCORE } from '../lib/gameUtils';
import { motion, AnimatePresence } from 'framer-motion';

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
  wordHistory: WordHistoryEntry[];
  onCellClick: (cell: HexCell) => void;
  onTileSelect: (tile: LetterTile) => void;
  onBurnTile: () => void;
  onScoreWord: () => void;
  maxPlacementTiles: number;
  onEndPlacementPhase?: () => void;
  playerHandRef?: React.RefObject<HTMLDivElement | null>;
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
  wordHistory,
  onCellClick,
  onTileSelect,
  onBurnTile,
  onScoreWord,
  maxPlacementTiles,
  onEndPlacementPhase,
  playerHandRef,
}, ref) => {
  // Phase transition animation variants
  const phaseTransitionVariants = {
    initial: { 
      opacity: 0,
      scale: 0.95
    },
    animate: { 
      opacity: 1,
      scale: 1,
      transition: { 
        duration: 0.3,
        ease: "easeInOut"
      }
    },
    exit: { 
      opacity: 0,
      scale: 0.95,
      transition: { 
        duration: 0.2 
      }
    }
  };

  return (
    <div 
      ref={ref}
      className="flex-grow"
    >
      {/* Mobile Game Controls - New Component */}
      <MobileGameControls
        currentScore={score}
        targetScore={TARGET_SCORE}
        turns={turns}
        letterBagCount={letterBagCount}
        isPlacementPhase={isPlacementPhase}
        placedTilesCount={placedTilesThisTurn.length}
        maxPlacementTiles={maxPlacementTiles}
        wordHistory={wordHistory}
        currentWord={currentWord}
        onEndPlacementPhase={onEndPlacementPhase}
      />
      
      {/* Phase transition animation wrapper */}
      <AnimatePresence mode="wait">
        <motion.div
          key={isPlacementPhase ? "placement" : "scoring"}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={phaseTransitionVariants}
          className="w-full"
        >
          {/* Grid container */}
          <div className="grid-container flex justify-center mb-4 md:mb-6 mt-12">
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
        </motion.div>
      </AnimatePresence>
      
      {/* Action buttons - conditionally rendered only when there are buttons to show */}
      {(!isPlacementPhase || placedTilesThisTurn.length > 0) && (
        <div className="flex justify-center items-center mb-4 flex-wrap gap-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={isPlacementPhase ? "placement-actions" : "scoring-actions"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex flex-wrap gap-2 justify-center items-center"
            >
              {!isPlacementPhase ? (
                <>
                  {/* Dynamic button color based on word state */}
                  <button
                    className={`py-1.5 px-3 rounded-md shadow-sm
                              flex items-center justify-center transition-colors text-sm font-medium
                              ${!currentWord || currentWord.length < 3 
                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                                : isWordValid && !isWordAlreadyScored
                                  ? 'bg-green-500 hover:bg-green-600 text-white' 
                                  : 'bg-red-500 hover:bg-red-600 text-white'}`}
                    onClick={() => onScoreWord()}
                    disabled={!isWordValid || isWordAlreadyScored || currentWord.length < 3}
                    aria-label="Score word"
                  >
                    Score Word <span className="ml-1">({potentialScore})</span>
                    {isDictionaryLoading && (
                      <span className="ml-1 animate-pulse">•••</span>
                    )}
                  </button>
                  
                  {/* Current word display */}
                  {currentWord && currentWord.length > 0 && (
                    <div className="py-1.5 px-3 bg-purple-100 text-purple-800 rounded-md font-medium">
                      Word: {currentWord}
                    </div>
                  )}
                  
                  {/* Undo button */}
                  <UndoButton />
                </>
              ) : (
                <>
                  {/* Show tiles placed info */}
                  {placedTilesThisTurn.length > 0 && (
                    <div className="py-1.5 px-3 bg-blue-100 text-blue-800 rounded-md font-medium">
                      Tiles: {placedTilesThisTurn.length}/{maxPlacementTiles}
                    </div>
                  )}
                  
                  {/* End Placement Phase button - Only show during placement with at least 1 tile placed */}
                  {isPlacementPhase && placedTilesThisTurn.length > 0 && onEndPlacementPhase && (
                    <button
                      className="py-1.5 px-3 rounded-md shadow-sm
                                flex items-center justify-center transition-colors text-sm font-medium
                                bg-amber-500 hover:bg-amber-600 text-white"
                      onClick={onEndPlacementPhase}
                      aria-label="End placement phase"
                    >
                      End Phase
                    </button>
                  )}
                  
                  {/* Undo button */}
                  <UndoButton />
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
      
      {/* Player hand with positioned action buttons */}
      <div className="mt-4 pb-16 md:pb-0 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={isPlacementPhase ? "placement-hand" : "scoring-hand"}
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-center"
            ref={playerHandRef}
          >
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
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
});

export default GameContent; 