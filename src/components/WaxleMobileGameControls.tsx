import { useState } from 'react';
import { ChevronDown, Trophy, Hourglass } from 'lucide-react';
import { cn } from '../lib/utils';
import { countAdjacentEdges, calculateWaxleScore } from '../lib/waxleGameUtils';
import { HexCell } from './HexGrid';
import { OptimizedCounter } from './OptimizedCounter';
import { DynamicZapIcon } from './DynamicZapIcon';

type WaxleMobileGameControlsProps = {
  score: number;
  round: number;
  wordsThisRound: number;
  wordLog: Array<{ word: string; auto: boolean }>;
  currentWord: string;
  freeSwapsAvailable: number;
  nextRows: string[][];
  isWordValid?: boolean;
  selectedTiles: Array<{ cellId: string; letter: string; position: number }>;
  grid: HexCell[];
};

const WaxleMobileGameControls = ({
  score,
  round,
  wordsThisRound,
  wordLog,
  currentWord,
  freeSwapsAvailable,
  nextRows,
  isWordValid,
  selectedTiles,
  grid
}: WaxleMobileGameControlsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="w-full relative">
      {/* Flush Compact Header */}
      <div 
        className={cn(
          "bg-bg-primary border-b border-secondary/20",
          "px-4 shadow-lg shadow-secondary/10",
          "transition-[background-color,box-shadow] duration-300 ease-out cursor-pointer",
          "hover:shadow-xl hover:shadow-secondary/20",
          "active:bg-bg-secondary/50",
          "h-[68px] flex items-center"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center space-x-3">
            {/* Next Drop Preview with responsive sizing */}
            {nextRows.length > 0 && (
              <div className={cn(
                "flex items-center",
                "bg-amber/10 border border-amber/20",
                "rounded-xl py-1.5",
                // Dynamic gap and padding based on tile count
                nextRows[0]?.length >= 6 ? "gap-1 px-2" : "gap-2 px-3"
              )}>
                {/* Show abbreviated label with many tiles, full label otherwise */}
                <div
                  key={nextRows[0]?.join('')}
                  className={cn(
                    "flex",
                    // Dynamic gap based on tile count
                    nextRows[0]?.length >= 6 ? "gap-0.5" : "gap-1"
                  )}
                >
                  {nextRows[0]?.map((letter, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "bg-bg-secondary border border-secondary/30",
                        "rounded-lg flex items-center justify-center",
                        "font-semibold text-text-primary anim-chip-in",
                        // Responsive tile sizing
                        nextRows[0]?.length >= 6 ? "w-4 h-4 text-[10px]" :
                        nextRows[0]?.length >= 5 ? "w-5 h-5 text-xs" :
                        "w-6 h-6 text-xs"
                      )}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      {letter}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Modern Stats Display */}
          <div className={cn(
            "flex items-center",
            // Tighter spacing when showing 6 tiles
            nextRows[0]?.length >= 6 ? "space-x-2" : "space-x-4"
          )}>
            {/* Full labels for >=sm */}
            <div className={cn(
              "hidden sm:flex items-center text-sm",
              nextRows[0]?.length >= 6 ? "space-x-2" : "space-x-3"
            )}>
              <div className="flex items-center space-x-1">
                <span className="text-text-secondary">Score</span>
                <span className="font-semibold text-amber bg-amber/10 px-2 py-0.5 rounded-full text-xs">
                  <OptimizedCounter 
                    value={score} 
                    duration={1.0}
                    animationType="ticker"
                    className="tabular-nums"
                    delay={0}
                  />
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-text-secondary flex items-center">
                  R<OptimizedCounter 
                    value={round}
                    animationType="tick" 
                    className="tabular-nums"
                    delay={200}
                  />
                </span>
                <span className="w-1 h-1 bg-secondary/40 rounded-full" />
                <div className="flex items-center space-x-1 text-text-secondary">
                  <DynamicZapIcon
                    swapsAvailable={freeSwapsAvailable || 0}
                    maxSwaps={3}
                    size={12}
                    className="flex-shrink-0"
                    animationDelay={400}
                  />
                  <span className="text-xs">
                    {freeSwapsAvailable || 0} {(freeSwapsAvailable || 0) === 1 ? 'Swap' : 'Swaps'}
                  </span>
                </div>
              </div>
            </div>

            {/* Icon-only for <sm */}
            <div className="flex sm:hidden items-center space-x-3 text-text-secondary">
              <div className="flex items-center space-x-1">
                <Trophy size={14} className="text-amber" />
                <span className="font-semibold tabular-nums text-xs">
                  <OptimizedCounter 
                    value={score}
                    duration={1.0}
                    animationType="ticker"
                    className="tabular-nums"
                    delay={0}
                  />
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Hourglass size={14} className="text-amber" />
                <span className="tabular-nums text-xs">
                  <OptimizedCounter 
                    value={round}
                    animationType="tick"
                    delay={200}
                    className="tabular-nums"
                  />
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <DynamicZapIcon
                  swapsAvailable={freeSwapsAvailable || 0}
                  maxSwaps={3}
                  size={14}
                  className="flex-shrink-0"
                  animationDelay={400}
                />
                <span className="text-xs">
                  {freeSwapsAvailable || 0}
                </span>
              </div>
            </div>
            {/* Modern chevron */}
            <div className={cn(
              "p-1 rounded-lg bg-secondary/10 transition-[background-color,transform] duration-200",
              isExpanded && "rotate-180"
            )}>
              <ChevronDown size={16} className="text-text-secondary" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Expandable stats panel: clipped compositor slide (no height animation) */}
      <div className="absolute left-0 right-0 top-full overflow-hidden pointer-events-none">
          <div
            className={cn(
              "mobile-stats-panel bg-bg-primary border-b border-secondary/20",
              "shadow-xl shadow-secondary/20",
              isExpanded && "show pointer-events-auto"
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
                {wordLog.length > 0 ? (
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {wordLog.slice().reverse().map((entry, idx) => (
                      <div key={idx} className={cn(
                        "text-xs font-mono px-2 py-1 rounded-lg",
                        entry.auto
                          ? "text-amber bg-amber/5"
                          : "text-text-secondary bg-success/5"
                      )}>
                        {entry.auto ? '⚡ ' : ''}{entry.word}
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
                    "text-xl font-mono font-bold text-center rounded-xl py-2 transition-colors duration-200",
                    currentWord.length >= 3 && isWordValid === false
                      ? "text-red-500 bg-red-500/10"
                      : "text-amber bg-amber/10"
                  )}>
                    {currentWord}
                    {currentWord.length >= 3 && isWordValid && (
                      <span className="text-amber-dark ml-2">
                        [{(() => {
                          const selectedTileIds = selectedTiles.map(t => t.cellId);
                          const adjacentEdges = countAdjacentEdges(selectedTileIds, grid);
                          return calculateWaxleScore(currentWord.length, adjacentEdges);
                        })()}]
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
  );
};

export default WaxleMobileGameControls;