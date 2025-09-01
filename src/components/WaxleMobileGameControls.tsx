import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type WaxleMobileGameControlsProps = {
  score: number;
  round: number;
  wordsThisRound: number;
  wordsThisRoundList: string[];
  currentWord: string;
  freeOrbitsAvailable: number;
  nextRows: string[][];
  previewLevel: number;
};

const WaxleMobileGameControls = ({
  score,
  round,
  wordsThisRound,
  wordsThisRoundList,
  currentWord,
  freeOrbitsAvailable,
  nextRows,
  previewLevel
}: WaxleMobileGameControlsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="md:hidden w-full cursor-pointer">
      {/* Compact Header - Always visible */}
      <div 
        className="bg-primary-light shadow-md border-b border-secondary p-4 transition-all"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-center">
          <div className="flex space-x-2 items-center">
            {/* Next Drop Preview */}
            {previewLevel > 0 && nextRows.length > 0 && (
              <div className="flex items-center gap-2 bg-bg-secondary rounded-full px-3 py-1">
                <span className="text-xs font-medium text-primary uppercase tracking-wide">NEXT</span>
                <div className="flex gap-1">
                  {nextRows[0]?.map((letter, idx) => (
                    <div key={idx} className="w-5 h-5 bg-secondary rounded border border-secondary-dark flex items-center justify-center text-xs font-semibold text-primary">
                      {letter}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Game Stats */}
          <div className="flex space-x-2 text-sm items-center">
            <div>
              <span className="text-text-muted">Score:</span> <span className="text-white">{score}</span>
            </div>
            <div>
              <span className="text-text-muted">Round:</span> <span className="text-white">{round}</span>
            </div>
            <div>
              <span className="text-text-muted">Orbits:</span> <span className="text-white">{freeOrbitsAvailable || 0}</span>
            </div>
            
            {/* Expand/Collapse Indicator */}
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 20 20" 
              fill="currentColor" 
              className={`w-4 h-4 text-amber-700 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            >
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>
      
      {/* Expandable Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, type: "tween" }}
            className="bg-secondary-light shadow-lg border border-secondary overflow-hidden mb-2"
          >
            {/* Content */}
            <div className="p-3">
              <div>
                  {/* Words Submitted */}
                  <div className="mb-3 p-2 bg-success-light rounded-lg">
                    <div className="text-sm font-medium text-primary mb-2">Words This Game ({wordsThisRound}):</div>
                    {wordsThisRoundList.length > 0 ? (
                      <div className="space-y-1 max-h-16 overflow-y-auto">
                        {wordsThisRoundList.reverse().map((word, idx) => (
                          <div key={idx} className="text-xs text-secondary-dark font-mono">
                            {word}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-text-muted italic">No words submitted yet</div>
                    )}
                  </div>

                  {/* Current Word Display */}
                  {currentWord && (
                    <div className="mb-3 p-2 bg-secondary rounded-lg">
                      <h3 className="text-sm font-semibold text-primary mb-1">Current Word</h3>
                      <p className="text-lg font-mono text-text-primary">{currentWord}</p>
                    </div>
                  )}
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WaxleMobileGameControls;