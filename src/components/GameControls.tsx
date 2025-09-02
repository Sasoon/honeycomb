import { useEffect, useRef, useState } from 'react';
import { Undo2, RotateCw } from 'lucide-react';
import { cn } from '../lib/utils';

type GameControlsProps = {
  // Game state
  currentWord: string;
  phase: 'flood' | 'player' | 'gameOver' | 'gravitySettle';
  validationState?: boolean;
  
  // Actions
  onSubmitWord: () => void;
  onEndTurn: () => void;
  onUndo: () => void;
  onRestart?: () => void;
  onRestartHoldChange?: (active: boolean) => void;
  
  // Conditionals
  canUndo: boolean;
  isDailyChallenge: boolean;
};

const GameControls = ({
  currentWord,
  phase,
  validationState,
  onSubmitWord,
  onEndTurn,
  onUndo,
  onRestart,
  canUndo,
  isDailyChallenge,
  onRestartHoldChange
}: GameControlsProps) => {
  const isPlayerPhase = phase === 'player';
  const canSubmit = currentWord.length >= 3 && isPlayerPhase && validationState === true;
  const canEndTurn = isPlayerPhase;
  const canRestart = !isDailyChallenge && phase !== 'flood' && phase !== 'gravitySettle';

  // Fixed dimensions for all buttons
  const fixedButtonDims = "h-[40px] w-[40px] sm:h-10 sm:w-[120px]";

  // Press-and-hold restart state
  const [isHoldingRestart, setIsHoldingRestart] = useState(false);
  const [restartProgress, setRestartProgress] = useState(0); // 0..1
  const holdStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const [snapAnimating, setSnapAnimating] = useState(false);
  const [snapDeg, setSnapDeg] = useState(0);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const startHold = () => {
    if (!onRestart || !canRestart) return;
    setIsHoldingRestart(true);
    onRestartHoldChange?.(true);
    setSnapAnimating(false);
    setRestartProgress(0);
    holdStartRef.current = performance.now();
    const durationMs = 2000;

    const step = () => {
      if (!holdStartRef.current) return;
      const elapsed = performance.now() - holdStartRef.current;
      const p = Math.min(1, elapsed / durationMs);
      setRestartProgress(p);
      if (p >= 1) {
        // Fire and reset
        setIsHoldingRestart(false);
        onRestartHoldChange?.(false);
        holdStartRef.current = null;
        rafRef.current = null;
        onRestart?.();
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const cancelHold = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    holdStartRef.current = null;
    const currentDeg = restartProgress * 360;
    setIsHoldingRestart(false);
    onRestartHoldChange?.(false);
    if (currentDeg > 0) {
      // Animate snap back to 0deg
      setSnapAnimating(true);
      setSnapDeg(currentDeg);
      requestAnimationFrame(() => {
        setSnapDeg(0);
      });
      window.setTimeout(() => setSnapAnimating(false), 350);
    }
    setRestartProgress(0);
  };

  return (
    <div className="game-controls-container transition-all duration-300 ease-in-out">
      {/* Primary Actions - Always visible */}
      <div className="flex gap-2 sm:gap-3 items-center justify-center transition-all duration-300 ease-in-out">
        {/* End Turn - Primary Action (first) */}
        <button 
          onClick={onEndTurn}
          disabled={!canEndTurn}
          className={cn(
            "inline-flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap rounded-xl text-sm font-xxl transition-all duration-300 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
            fixedButtonDims,
            canEndTurn
              ? "bg-accent hover:bg-accent-dark text-white hover:shadow-lg hover:shadow-accent/20"
              : "disabled:pointer-events-none disabled:opacity-50 bg-secondary/10 text-text-muted"
          )}
        >
          <span className="hidden xs:inline sm:inline">End Turn</span>
          <span className="inline xs:hidden sm:hidden text-lg">⏭</span>
        </button>

        {/* Submit Word - Primary Action (second) */}
        <button 
          onClick={onSubmitWord}
          disabled={!canSubmit} 
          className={cn(
            "inline-flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap rounded-xl text-sm font-xxl transition-all duration-300 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/50",
            fixedButtonDims,
            canSubmit
              ? "bg-amber-light hover:bg-amber-dark text-white hover:shadow-lg hover:shadow-amber/20"
              : "disabled:pointer-events-none disabled:opacity-50 bg-secondary/10 text-text-muted"
          )}
        >
          <span className="hidden xs:inline sm:inline">Submit</span>
          <span className="inline xs:hidden sm:hidden text-lg">✓</span>
        </button>
      </div>

      {/* Secondary Actions Row */}
      <div className="flex gap-2 sm:gap-3 items-center justify-center mt-2 sm:mt-3 transition-all duration-300 ease-in-out">
        {/* Undo - Secondary Action */}
        <button 
          onClick={onUndo}
          disabled={!canUndo}
          className={cn(
            "inline-flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap rounded-xl text-sm font-xxl transition-all duration-300 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50",
            fixedButtonDims,
            canUndo
              ? "bg-secondary/10 hover:bg-secondary/20 border border-secondary/20 text-text-primary hover:shadow-md hover:shadow-secondary/10"
              : "disabled:pointer-events-none disabled:opacity-40 bg-secondary/5 text-text-muted"
          )}
        >
          <Undo2 className="w-4 h-4 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Undo</span>
        </button>

        {/* Restart - Secondary Action (only if not daily challenge) */}
        {onRestart && (
          <button 
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerCancel={cancelHold}
            onPointerLeave={cancelHold}
            disabled={!canRestart}
            className={cn(
              "relative overflow-hidden inline-flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap rounded-xl text-sm font-xxl transition-all duration-300 ease-in-out touch-none select-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50",
              fixedButtonDims,
              canRestart
                ? "bg-secondary/10 hover:bg-secondary/20 border border-secondary/20 text-text-primary hover:shadow-md hover:shadow-secondary/10"
                : "disabled:pointer-events-none disabled:opacity-40 bg-secondary/5 text-text-muted"
            )}
          >
            <RotateCw 
              className="w-4 h-4 sm:w-4 sm:h-4 transition-transform"
              style={{ transform: `rotate(${(isHoldingRestart ? restartProgress * 360 : (snapAnimating ? snapDeg : 0))}deg)`, transition: snapAnimating ? 'transform 350ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none', willChange: 'transform' }}
            />
            <span className="hidden sm:inline">Restart</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default GameControls;