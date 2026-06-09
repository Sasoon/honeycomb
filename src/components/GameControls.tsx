import { useState } from 'react';
import { Undo2, RotateCw, ArrowLeftRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';

type GameControlsProps = {
  // Game state
  currentWord: string;
  phase: 'flood' | 'player' | 'gameOver' | 'gravitySettle' | 'autoClearing';
  validationState?: boolean;

  // Actions
  onSubmitWord: () => void;
  onEndTurn: () => void;
  onUndo: () => void;
  onRestart?: () => void;
  onToggleSwapMode?: () => void;

  // Conditionals
  canUndo: boolean;
  isDailyChallenge: boolean;
  swapsAvailable?: number;
  swapModeActive?: boolean;
  swapFirstTileSelected?: boolean;
};

const GameControls = ({
  currentWord,
  phase,
  validationState,
  onSubmitWord,
  onEndTurn,
  onUndo,
  onRestart,
  onToggleSwapMode,
  canUndo,
  isDailyChallenge,
  swapsAvailable = 0,
  swapModeActive = false,
  swapFirstTileSelected = false
}: GameControlsProps) => {
  const isPlayerPhase = phase === 'player';
  const canSubmit = currentWord.length >= 3 && isPlayerPhase && validationState === true;
  const canEndTurn = isPlayerPhase;
  const canRestart = !isDailyChallenge && phase !== 'flood' && phase !== 'gravitySettle';
  const canSwap = isPlayerPhase && (swapsAvailable > 0 || swapModeActive);

  // Removed fixed dimensions - now handled by Button component gameControl size

  // Restart confirmation state
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);


  const handleRestartClick = () => {
    if (!onRestart || !canRestart) return;
    setShowRestartConfirm(true);
  };

  const confirmRestart = () => {
    setShowRestartConfirm(false);
    onRestart?.();
  };

  const cancelRestart = () => {
    setShowRestartConfirm(false);
  };

  return (
    <div className="game-controls-container relative transition-[transform,opacity] duration-300 ease-in-out">
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
        {/* Swap mode toggle */}
        {onToggleSwapMode && (
          <Button
            onClick={onToggleSwapMode}
            disabled={!canSwap}
            variant={swapModeActive ? 'default' : 'secondary'}
            size="gameControl"
            className={cn(
              'gap-1 sm:gap-2 relative',
              swapModeActive && 'ring-2 ring-green-500 ring-offset-1'
            )}
            aria-pressed={swapModeActive}
            aria-label={`Swap tiles (${swapsAvailable} available)`}
          >
            <ArrowLeftRight className="w-4 h-4 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Swap</span>
            <span className={cn(
              'text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center',
              swapModeActive ? 'bg-white/25' : 'bg-secondary/30'
            )}>
              {swapsAvailable}
            </span>
          </Button>
        )}

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
            onClick={handleRestartClick}
            disabled={!canRestart}
            variant="secondary"
            size="gameControl"
            className="gap-1 sm:gap-2"
          >
            <RotateCw className="w-4 h-4 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Restart</span>
          </Button>
        )}
      </div>

      {/* Swap mode hint (absolutely positioned so the grid doesn't shift) */}
      {swapModeActive && (
        <div
          className="absolute left-1/2 -translate-x-1/2 -bottom-7 w-max text-center text-xs font-medium text-green-600"
          role="status"
        >
          {swapFirstTileSelected
            ? 'Now tap the tile to swap it with'
            : 'Swap mode: tap two tiles to swap their letters'}
        </div>
      )}

      {/* Restart Confirmation Modal */}
      {showRestartConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" onClick={cancelRestart}>
          <div className="bg-bg-primary border border-secondary/20 rounded-2xl p-6 shadow-2xl m-4 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-text-primary mb-3">Restart Game?</h3>
            <p className="text-text-secondary mb-6">Your current progress will be lost. Are you sure you want to restart?</p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={cancelRestart} className="px-4">
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmRestart} className="px-4">
                Restart
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameControls;