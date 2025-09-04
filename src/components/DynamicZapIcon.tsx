import { useEffect, useState } from 'react';
import { Zap, ZapOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface DynamicZapIconProps {
  orbitsAvailable: number;
  maxOrbits?: number;
  size?: number;
  className?: string;
  animationDelay?: number; // Delay in ms before starting orbit animation
}

export const DynamicZapIcon = ({ 
  orbitsAvailable, 
  maxOrbits = 2, 
  size = 20,
  className,
  animationDelay = 0
}: DynamicZapIconProps) => {
  const [previousOrbits, setPreviousOrbits] = useState(orbitsAvailable);
  const [isRecharging, setIsRecharging] = useState(false);
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [animatedFillPercentage, setAnimatedFillPercentage] = useState((orbitsAvailable / maxOrbits) * 100);

  // Detect orbit recharge for power-up animation
  useEffect(() => {
    if (orbitsAvailable > previousOrbits) {
      // If coming from 0 orbits, show empty state briefly before power-up
      if (previousOrbits === 0 && orbitsAvailable === 2) {
        setShowEmptyState(true);
        setAnimatedFillPercentage(0);
        setTimeout(() => {
          setShowEmptyState(false);
          setIsRecharging(true);
          
          // Animate fill from 0 to 100% over 800ms
          const startTime = Date.now();
          const animateFill = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / 800, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            setAnimatedFillPercentage(eased * 100);
            
            if (progress < 1) {
              requestAnimationFrame(animateFill);
            } else {
              setIsRecharging(false);
            }
          };
          requestAnimationFrame(animateFill);
        }, 200 + animationDelay); // Show empty state for 200ms + delay
      } else {
        // Direct recharge without empty state
        setTimeout(() => {
          setIsRecharging(true);
          
          // Animate fill from current to target over 800ms
          const startFill = (previousOrbits / maxOrbits) * 100;
          const targetFill = (orbitsAvailable / maxOrbits) * 100;
          const startTime = Date.now();
          
          const animateFill = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / 800, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            setAnimatedFillPercentage(startFill + (targetFill - startFill) * eased);
            
            if (progress < 1) {
              requestAnimationFrame(animateFill);
            } else {
              setIsRecharging(false);
            }
          };
          requestAnimationFrame(animateFill);
        }, animationDelay);
      }
    }
    setPreviousOrbits(orbitsAvailable);
  }, [orbitsAvailable, previousOrbits, animationDelay]);

  // Calculate fill percentage - use animated value during recharge, or current orbits otherwise
  const effectiveOrbits = showEmptyState ? 0 : orbitsAvailable;
  const fillPercentage = isRecharging ? animatedFillPercentage : Math.max(0, Math.min(100, (effectiveOrbits / maxOrbits) * 100));

  // Use ZapOff for 0 orbits (and not in empty state), Zap for any orbits or during empty state
  const IconComponent = orbitsAvailable === 0 && !showEmptyState ? ZapOff : Zap;

  return (
    <div className={cn("relative inline-block", className)}>
      {/* Main icon with gradient mask for partial fill */}
      <div className="relative">
        <svg 
          width={size} 
          height={size} 
          viewBox="0 0 24 24" 
          className="absolute inset-0"
        >
          {/* Define gradient for fill effect */}
          <defs>
            <linearGradient id="zapFillGradient" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="1" />
              <stop offset="100%" stopColor="#FBBF24" stopOpacity="1" />
            </linearGradient>
            
            {/* Animated gradient for recharge effect */}
            <linearGradient id="zapRechargeGradient" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="1">
                {isRecharging && (
                  <animate 
                    attributeName="stop-opacity" 
                    values="0;1;1;1" 
                    dur="0.8s" 
                    begin="0s"
                  />
                )}
              </stop>
              <stop offset="100%" stopColor="#FBBF24" stopOpacity="1">
                {isRecharging && (
                  <animate 
                    attributeName="stop-opacity" 
                    values="0;0;1;1" 
                    dur="0.8s" 
                    begin="0s"
                  />
                )}
              </stop>
            </linearGradient>
            
            {/* Mask for partial fill */}
            <mask id="zapFillMask">
              <rect 
                x="0" 
                y={24 - (24 * fillPercentage / 100)} 
                width="24" 
                height={24 * fillPercentage / 100} 
                fill="white"
                className={cn(
                  "transition-[height] duration-300 ease-out",
                  isRecharging && "animate-pulse"
                )}
              />
            </mask>
          </defs>
        </svg>
        
        {/* Animated icon transitions */}
        <AnimatePresence mode="wait">
          <motion.div
            key={IconComponent === ZapOff ? 'zap-off' : 'zap'}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="relative"
          >
            {/* Background icon (empty state) */}
            <IconComponent 
              size={size}
              className="stroke-[1] fill-none transition-[stroke,fill] duration-300 text-amber"
              style={{
                opacity: (orbitsAvailable === 0 && !showEmptyState) ? 0.4 : 1,
                color: (orbitsAvailable === 0 && !showEmptyState) ? '#6B7280' : '#F59E0B' // gray-500 or amber
              }}
            />
            
            {/* Filled icon (amber background fill) - show if orbits > 0 and not in empty state */}
            {effectiveOrbits > 0 && (
              <IconComponent 
                size={size}
                className={cn(
                  "absolute inset-0 text-amber stroke-[1]",
                  isRecharging ? "transition-[opacity] duration-[800ms] ease-in-out animate-pulse" : "transition-[opacity] duration-300"
                )}
                style={{
                  fill: '#F59E0B', // amber
                  clipPath: `inset(${100 - fillPercentage}% 0 0 0)`,
                  filter: isRecharging ? 'drop-shadow(0 0 8px #F59E0B)' : undefined
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* Power-up glow effect during recharge */}
      {isRecharging && (
        <div 
          className="absolute inset-0 rounded-full bg-amber/20 animate-ping"
          style={{
            animation: 'ping 0.8s cubic-bezier(0, 0, 0.2, 1) 1'
          }}
        />
      )}
    </div>
  );
};