import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { CSSAnimatedCounter } from './CSSAnimatedCounter';
import { AnimatedTickingCounter } from './AnimatedTickingCounter';
import { DynamicZapIcon } from './DynamicZapIcon';

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
    <div className="md:hidden w-full">
      {/* Flush Compact Header */}
      <div 
        className={cn(
          "bg-bg-primary/95 backdrop-blur-sm border-b border-secondary/20",
          "px-4 shadow-lg shadow-secondary/10",
          "transition-all duration-300 ease-out cursor-pointer",
          "hover:shadow-xl hover:shadow-secondary/20",
          "active:bg-bg-secondary/50",
          "h-[68px] flex items-center"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center space-x-3">
            {/* Next Drop Preview with modern styling */}
            {previewLevel > 0 && nextRows.length > 0 && (
              <div className={cn(
                "flex items-center gap-2",
                "bg-amber/10 border border-amber/20",
                "rounded-xl px-3 py-1.5"
              )}>
                <span className="text-xs font-medium text-amber uppercase tracking-wide">Next</span>
                <div className="flex gap-1">
                  {nextRows[0]?.map((letter, idx) => (
                    <div key={idx} className={cn(
                      "w-6 h-6 bg-bg-secondary border border-secondary/30",
                      "rounded-lg flex items-center justify-center",
                      "text-xs font-semibold text-text-primary"
                    )}>
                      {letter}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Modern Stats Display */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3 text-sm">
              <div className="flex items-center space-x-1">
                <span className="text-text-secondary">Score</span>
                <span className="font-semibold text-amber bg-amber/10 px-2 py-0.5 rounded-full text-xs">
                  <CSSAnimatedCounter 
                    value={score} 
                    duration={1.0}
                    property="mobile-score"
                    className="tabular-nums"
                    delay={0}
                  />
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-text-secondary flex items-center">
                  R<AnimatedTickingCounter 
                    value={round} 
                    className="tabular-nums"
                    delay={200}
                  />
                </span>
                <span className="w-1 h-1 bg-secondary/40 rounded-full" />
                <div className="flex items-center space-x-1 text-text-secondary">
                  <DynamicZapIcon 
                    orbitsAvailable={freeOrbitsAvailable || 0}
                    maxOrbits={2}
                    size={12}
                    className="flex-shrink-0"
                    animationDelay={400}
                  />
                  <span className="text-xs">
                    {freeOrbitsAvailable || 0} {(freeOrbitsAvailable || 0) === 1 ? 'Orbit' : 'Orbits'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Modern chevron */}
            <div className={cn(
              "p-1 rounded-lg bg-secondary/10 transition-all duration-200",
              isExpanded && "rotate-180"
            )}>
              <ChevronDown size={16} className="text-text-secondary" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Modern Expandable Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.95 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.95 }}
            transition={{ duration: 0.3, type: "spring", damping: 15 }}
            className={cn(
              "bg-bg-primary/95 backdrop-blur-sm border-b border-secondary/20",
              "shadow-xl shadow-secondary/20",
              "overflow-hidden"
            )}
          >
            <div className="p-4 space-y-4">
              {/* Words Submitted Section */}
              <div className={cn(
                "bg-success/10 border border-success/20",
                "rounded-2xl p-4"
              )}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-text-primary">Words Found</h3>
                  <span className="bg-success/20 text-success px-2 py-1 rounded-full text-xs font-medium">
                    {wordsThisRound}
                  </span>
                </div>
                {wordsThisRoundList.length > 0 ? (
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {wordsThisRoundList.slice().reverse().map((word, idx) => (
                      <div key={idx} className={cn(
                        "text-xs font-mono text-text-secondary",
                        "bg-success/5 px-2 py-1 rounded-lg"
                      )}>
                        {word}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-text-muted italic text-center py-2">
                    No words found yet
                  </div>
                )}
              </div>

              {/* Current Word Display */}
              {currentWord && (
                <div className={cn(
                  "bg-amber/10 border border-amber/20",
                  "rounded-2xl p-4"
                )}>
                  <h3 className="text-sm font-semibold text-text-primary mb-2">Current Word</h3>
                  <p className={cn(
                    "text-xl font-mono text-amber font-bold text-center",
                    "bg-amber/10 rounded-xl py-2"
                  )}>
                    {currentWord}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WaxleMobileGameControls;