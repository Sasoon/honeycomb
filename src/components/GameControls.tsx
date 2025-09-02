import { Undo2, RotateCcw } from 'lucide-react';
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
  isDailyChallenge
}: GameControlsProps) => {
  const isPlayerPhase = phase === 'player';
  const canSubmit = currentWord.length >= 3 && isPlayerPhase && validationState === true;
  const canEndTurn = isPlayerPhase;
  const canRestart = !isDailyChallenge && phase !== 'flood' && phase !== 'gravitySettle';

  return (
    <div className="game-controls-container transition-all duration-300 ease-in-out">
      {/* Primary Actions - Always visible */}
      <div className="flex gap-2 sm:gap-3 items-center justify-center transition-all duration-300 ease-in-out">
        {/* Submit Word - Primary Action */}
        <button 
          onClick={onSubmitWord}
          disabled={!canSubmit} 
          className={cn(
            "inline-flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-300 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/50",
            "h-9 px-3 sm:h-10 sm:px-6", // Smaller on mobile
            canSubmit
              ? "bg-amber-light hover:bg-amber-dark text-white hover:shadow-lg hover:shadow-amber/20"
              : "disabled:pointer-events-none disabled:opacity-50 bg-secondary/10 text-text-muted"
          )}
        >
          <span className="hidden xs:inline sm:inline">Submit</span>
          <span className="inline xs:hidden sm:hidden text-lg">✓</span>
        </button>

        {/* End Turn - Primary Action */}
        <button 
          onClick={onEndTurn}
          disabled={!canEndTurn}
          className={cn(
            "inline-flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-300 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
            "h-9 px-3 sm:h-10 sm:px-6", // Smaller on mobile
            canEndTurn
              ? "bg-accent hover:bg-accent-dark text-white hover:shadow-lg hover:shadow-accent/20"
              : "disabled:pointer-events-none disabled:opacity-50 bg-secondary/10 text-text-muted"
          )}
        >
          <span className="hidden xs:inline sm:inline">End Turn</span>
          <span className="inline xs:hidden sm:hidden text-lg">⏭</span>
        </button>
      </div>

      {/* Secondary Actions Row */}
      <div className="flex gap-2 sm:gap-3 items-center justify-center mt-2 sm:mt-3 transition-all duration-300 ease-in-out">
        {/* Undo - Secondary Action */}
        <button 
          onClick={onUndo}
          disabled={!canUndo}
          className={cn(
            "inline-flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-300 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50",
            "h-8 px-2 sm:h-9 sm:px-4", // Even smaller for secondary actions
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
            onClick={onRestart}
            disabled={!canRestart}
            className={cn(
              "inline-flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-300 ease-in-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50",
              "h-8 px-2 sm:h-9 sm:px-4", // Even smaller for secondary actions
              canRestart
                ? "bg-secondary/10 hover:bg-secondary/20 border border-secondary/20 text-text-primary hover:shadow-md hover:shadow-secondary/10"
                : "disabled:pointer-events-none disabled:opacity-40 bg-secondary/5 text-text-muted"
            )}
          >
            <RotateCcw className="w-4 h-4 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Restart</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default GameControls;