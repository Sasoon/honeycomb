import { useState, useEffect, useRef, useMemo } from 'react';
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
  const tickerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const formatRef = useRef(formatNumber);
  formatRef.current = formatNumber;

  // Ticker counts by writing textContent directly inside rAF — zero React
  // re-renders per frame. The element is memoised so React never reconciles
  // (and overwrites) the text mid-animation.
  const tickerNode = useMemo(() => (
    <div
      ref={(el) => {
        tickerRef.current = el;
        if (el) el.textContent = formatRef.current(prevValueRef.current);
      }}
      className="counter-value counter-ticker"
    />
  ), []);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      if (animationType === 'ticker') {
        // Smooth counting animation for scores, off the React render path
        const startValue = prevValueRef.current;
        const endValue = value;
        const startTime = performance.now();
        const animationDuration = duration * 1000;
        prevValueRef.current = value;

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

          const currentValue = Math.round(startValue + (endValue - startValue) * easedProgress);
          if (tickerRef.current) {
            tickerRef.current.textContent = formatRef.current(currentValue);
          }

          if (progress < 1) {
            animationRef.current = requestAnimationFrame(animate);
          }
        };

        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(true);
        // Instant update for slide/tick animations (CSS handles the transition)
        let resetTimeout: ReturnType<typeof setTimeout> | undefined;
        const timeout = setTimeout(() => {
          setDisplayValue(value);
          prevValueRef.current = value;

          resetTimeout = setTimeout(() => {
            setIsAnimating(false);
          }, duration * 1000);
        }, delay);

        return () => {
          clearTimeout(timeout);
          if (resetTimeout) clearTimeout(resetTimeout);
        };
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
      {animationType === 'ticker' ? tickerNode : (
        <div
          className={cn(
            "counter-value",
            animationType === 'slide' ? "counter-slide" : "counter-tick",
            isAnimating && "entering"
          )}
        >
          {formatNumber(displayValue)}
        </div>
      )}
    </div>
  );
};
