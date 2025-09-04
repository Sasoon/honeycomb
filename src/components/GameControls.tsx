import { useEffect, useRef, useState } from 'react';
import { Undo2, RotateCw } from 'lucide-react';
import { Button } from './ui/Button';

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

  // Removed fixed dimensions - now handled by Button component gameControl size

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
    <div className="game-controls-container transition-[transform,opacity] duration-300 ease-in-out">
      {/* Primary Actions - Always visible */}
      <div className="flex gap-2 sm:gap-3 items-center justify-center transition-[transform,opacity] duration-300 ease-in-out">
        {/* End Turn - Primary Action (first) */}
        <Button 
          onClick={onEndTurn}
          disabled={!canEndTurn}
          variant="destructive"
          size="gameControl"
          className="gap-1 sm:gap-2"
        >
          <span className="hidden xs:inline sm:inline">End Turn</span>
          <span className="inline xs:hidden sm:hidden text-lg">⏭</span>
        </Button>

        {/* Submit Word - Primary Action (second) */}
        <Button 
          onClick={onSubmitWord}
          disabled={!canSubmit} 
          variant="default"
          size="gameControl"
          className="gap-1 sm:gap-2"
        >
          <span className="hidden xs:inline sm:inline">Submit</span>
          <span className="inline xs:hidden sm:hidden text-lg">✓</span>
        </Button>
      </div>

      {/* Secondary Actions Row */}
      <div className="flex gap-2 sm:gap-3 items-center justify-center mt-2 sm:mt-3 transition-[transform,opacity] duration-300 ease-in-out">
        {/* Undo - Secondary Action */}
        <Button 
          onClick={onUndo}
          disabled={!canUndo}
          variant="secondary"
          size="gameControl"
          className="gap-1 sm:gap-2"
        >
          <Undo2 className="w-4 h-4 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Undo</span>
        </Button>

        {/* Restart - Secondary Action (only if not daily challenge) */}
        {onRestart && (
          <Button 
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerCancel={cancelHold}
            onPointerLeave={cancelHold}
            disabled={!canRestart}
            variant="secondary"
            size="gameControl"
            className="relative overflow-hidden gap-1 sm:gap-2 touch-none select-none"
          >
            <RotateCw 
              className="w-4 h-4 sm:w-4 sm:h-4 transition-transform"
              style={{ transform: `rotate(${(isHoldingRestart ? restartProgress * 360 : (snapAnimating ? snapDeg : 0))}deg)`, transition: snapAnimating ? 'transform 350ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none', willChange: 'transform' }}
            />
            <span className="hidden sm:inline">Restart</span>
          </Button>
        )}
      </div>
    </div>
  );
};

export default GameControls;