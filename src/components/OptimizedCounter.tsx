import { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';

interface OptimizedCounterProps {
  value: number;
  className?: string;
  duration?: number; // Animation duration in seconds (default: 0.25s)
  delay?: number; // Animation delay in milliseconds (default: 0)
  formatNumber?: (num: number) => string;
  animationType?: 'ticker' | 'slide' | 'tick'; // ticker for smooth counting, slide for score, tick for round numbers
}

export const OptimizedCounter = ({ 
  value, 
  className,
  duration = 0.25,
  delay = 0,
  formatNumber = (num) => num.toString(),
  animationType = 'slide'
}: OptimizedCounterProps) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValueRef = useRef(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  
  useEffect(() => {
    if (value !== prevValueRef.current) {
      setIsAnimating(true);
      
      if (animationType === 'ticker') {
        // Smooth counting animation for scores
        const startValue = prevValueRef.current;
        const endValue = value;
        const startTime = performance.now();
        const animationDuration = duration * 1000; // Convert to milliseconds
        
        const animate = (currentTime: number) => {
          const elapsed = currentTime - startTime - delay;
          
          if (elapsed < 0) {
            animationRef.current = requestAnimationFrame(animate);
            return;
          }
          
          const progress = Math.min(elapsed / animationDuration, 1);
          // Ease-in-out easing function
          const easedProgress = progress < 0.5 
            ? 2 * progress * progress 
            : -1 + (4 - 2 * progress) * progress;
          
          const currentValue = startValue + (endValue - startValue) * easedProgress;
          setDisplayValue(Math.round(currentValue));
          
          if (progress < 1) {
            animationRef.current = requestAnimationFrame(animate);
          } else {
            setDisplayValue(endValue);
            setIsAnimating(false);
            prevValueRef.current = value;
          }
        };
        
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Instant update for slide/tick animations (CSS handles the transition)
        const timeout = setTimeout(() => {
          setDisplayValue(value);
          prevValueRef.current = value;
          
          const resetTimeout = setTimeout(() => {
            setIsAnimating(false);
          }, duration * 1000);
          
          return () => clearTimeout(resetTimeout);
        }, delay);
        
        return () => clearTimeout(timeout);
      }
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, delay, duration, animationType]);
  
  return (
    <div 
      ref={containerRef}
      className={cn("counter-container", className)}
      style={{
        '--counter-duration': `${duration}s`
      } as React.CSSProperties}
    >
      <div 
        className={cn(
          "counter-value",
          animationType === 'ticker' ? "counter-ticker" : 
          animationType === 'slide' ? "counter-slide" : "counter-tick",
          isAnimating && animationType !== 'ticker' && "entering"
        )}
      >
        {formatNumber(displayValue)}
      </div>
    </div>
  );
};