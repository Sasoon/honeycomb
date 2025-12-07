import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, RotateCw, X } from 'lucide-react';
import { cn } from '../lib/utils';

type OrbitControlsProps = {
  isVisible: boolean;
  orbitsAvailable: number;
  neighborCount: number;
  lockedSteps: number;
  isOverCancel: boolean;
  anchorPosition: { x: number; y: number } | null;
  cellSize: { w: number; h: number };
  onRotateCW: () => void;
  onRotateCCW: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  isDragging?: boolean;
};

const OrbitControls = ({
  isVisible,
  orbitsAvailable,
  neighborCount,
  lockedSteps,
  isOverCancel,
  anchorPosition,
  cellSize,
  onRotateCW,
  onRotateCCW,
  onCancel,
  onConfirm: _onConfirm,
  isDragging = false,
}: OrbitControlsProps) => {
  // onConfirm reserved for future use
  void _onConfirm;
  if (!isVisible || !anchorPosition || orbitsAvailable <= 0 || neighborCount < 2) {
    return null;
  }

  const buttonSize = Math.max(44, cellSize.w * 0.6); // Min 44px for touch targets
  const spacing = cellSize.w * 0.15;

  // Position buttons to the left and right of the selected tile
  const leftButtonX = anchorPosition.x - cellSize.w / 2 - buttonSize - spacing;
  const rightButtonX = anchorPosition.x + cellSize.w / 2 + spacing;
  const buttonY = anchorPosition.y - buttonSize / 2;

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Rotation Arc Indicator - shows during drag */}
          {isDragging && lockedSteps !== 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute pointer-events-none z-[70]"
              style={{
                left: anchorPosition.x - 60,
                top: anchorPosition.y - 60,
                width: 120,
                height: 120,
              }}
            >
              {/* Rotation direction arc */}
              <svg width="120" height="120" viewBox="0 0 120 120">
                <defs>
                  <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={lockedSteps > 0 ? '#22c55e' : '#3b82f6'} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={lockedSteps > 0 ? '#22c55e' : '#3b82f6'} stopOpacity="0.8" />
                  </linearGradient>
                </defs>
                {/* Arc showing rotation direction */}
                <motion.path
                  d={lockedSteps > 0
                    ? "M60,15 A45,45 0 0,1 105,60" // CW arc
                    : "M60,15 A45,45 0 0,0 15,60"  // CCW arc
                  }
                  fill="none"
                  stroke="url(#arcGradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: Math.min(Math.abs(lockedSteps) * 0.2, 1) }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
                {/* Arrow head */}
                <motion.polygon
                  points={lockedSteps > 0
                    ? "100,55 110,60 100,65" // CW arrow
                    : "20,55 10,60 20,65"   // CCW arrow
                  }
                  fill={lockedSteps > 0 ? '#22c55e' : '#3b82f6'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                />
              </svg>
              {/* Step counter */}
              <motion.div
                className={cn(
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                  "text-2xl font-bold",
                  isOverCancel ? "text-gray-400" : lockedSteps > 0 ? "text-green-500" : "text-blue-500"
                )}
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                key={lockedSteps}
              >
                {isOverCancel ? '×' : Math.abs(lockedSteps)}
              </motion.div>
            </motion.div>
          )}

          {/* CCW Button (Left) */}
          {!isDragging && (
            <motion.button
              initial={{ opacity: 0, x: 20, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.05 }}
              className={cn(
                "absolute z-[65] rounded-full",
                "bg-blue-500/90 backdrop-blur-sm",
                "shadow-lg shadow-blue-500/30",
                "flex items-center justify-center",
                "active:scale-95 transition-transform",
                "border-2 border-blue-400/50",
                "touch-manipulation"
              )}
              style={{
                left: leftButtonX,
                top: buttonY,
                width: buttonSize,
                height: buttonSize,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onRotateCCW();
              }}
              aria-label="Rotate counter-clockwise"
            >
              <RotateCcw size={buttonSize * 0.5} className="text-white" strokeWidth={2.5} />
            </motion.button>
          )}

          {/* CW Button (Right) */}
          {!isDragging && (
            <motion.button
              initial={{ opacity: 0, x: -20, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.1 }}
              className={cn(
                "absolute z-[65] rounded-full",
                "bg-green-500/90 backdrop-blur-sm",
                "shadow-lg shadow-green-500/30",
                "flex items-center justify-center",
                "active:scale-95 transition-transform",
                "border-2 border-green-400/50",
                "touch-manipulation"
              )}
              style={{
                left: rightButtonX,
                top: buttonY,
                width: buttonSize,
                height: buttonSize,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onRotateCW();
              }}
              aria-label="Rotate clockwise"
            >
              <RotateCw size={buttonSize * 0.5} className="text-white" strokeWidth={2.5} />
            </motion.button>
          )}

          {/* Orbit Count Badge */}
          {!isDragging && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.15 }}
              className={cn(
                "absolute z-[65] rounded-full px-3 py-1",
                "bg-amber-500/90 backdrop-blur-sm",
                "shadow-lg shadow-amber-500/30",
                "flex items-center justify-center gap-1",
                "text-white text-sm font-semibold",
                "border border-amber-400/50"
              )}
              style={{
                left: anchorPosition.x - 30,
                top: anchorPosition.y + cellSize.h / 2 + spacing + 8,
              }}
            >
              <span>{orbitsAvailable}</span>
              <span className="text-xs opacity-80">orbit{orbitsAvailable !== 1 ? 's' : ''}</span>
            </motion.div>
          )}

          {/* Cancel/Confirm during drag */}
          {isDragging && lockedSteps !== 0 && (
            <>
              {/* Cancel button (top) */}
              <motion.button
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{
                  opacity: 1,
                  scale: isOverCancel ? 1.1 : 1,
                  y: 0,
                  backgroundColor: isOverCancel ? 'rgba(239, 68, 68, 0.95)' : 'rgba(107, 114, 128, 0.9)'
                }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className={cn(
                  "absolute z-[70] rounded-full",
                  "backdrop-blur-sm",
                  "shadow-lg",
                  "flex items-center justify-center",
                  "border-2",
                  isOverCancel ? "border-red-400/50 shadow-red-500/30" : "border-gray-400/50 shadow-gray-500/30"
                )}
                style={{
                  left: anchorPosition.x - 22,
                  top: anchorPosition.y - cellSize.h * 0.5 - 54,
                  width: 44,
                  height: 44,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                aria-label="Cancel rotation"
              >
                <X size={24} className="text-white" strokeWidth={2.5} />
              </motion.button>
            </>
          )}
        </>
      )}
    </AnimatePresence>
  );
};

export default OrbitControls;
