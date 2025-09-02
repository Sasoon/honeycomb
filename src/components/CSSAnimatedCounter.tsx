import { useEffect, useRef } from 'react';
import { cn } from '../lib/utils';

interface CSSAnimatedCounterProps {
  value: number;
  className?: string;
  duration?: number;
  formatNumber?: (num: number) => string;
  property?: string; // CSS custom property name
}

export const CSSAnimatedCounter = ({ 
  value, 
  className,
  duration = 1.0,
  property = 'counter-value'
}: CSSAnimatedCounterProps) => {
  const counterRef = useRef<HTMLDivElement>(null);
  const prevValueRef = useRef<number>(value);

  useEffect(() => {
    if (counterRef.current && value !== prevValueRef.current) {
      const element = counterRef.current;
      
      // Set the CSS custom property to trigger the animation
      element.style.setProperty(`--${property}`, value.toString());
      
      prevValueRef.current = value;
    }
  }, [value, property]);

  // Generate unique counter name to avoid conflicts
  const counterName = `counter-${property}`;

  return (
    <>
      <style>{`
        @property --${property} {
          syntax: '<integer>';
          initial-value: ${prevValueRef.current};
          inherits: false;
        }
        
        .css-counter-${property} {
          transition: --${property} ${duration}s cubic-bezier(0.25, 0.1, 0.25, 1);
          counter-reset: ${counterName} var(--${property});
        }
        
        .css-counter-${property}::after {
          content: counter(${counterName});
        }
      `}</style>
      <div
        ref={counterRef}
        className={cn(`css-counter-${property}`, className)}
        style={{ [`--${property}`]: value } as any}
      />
    </>
  );
};

interface CSSTickingCounterProps {
  value: number;
  className?: string;
  formatNumber?: (num: number) => string;
}

export const CSSTickingCounter = ({ 
  value, 
  className
}: CSSTickingCounterProps) => {
  const counterRef = useRef<HTMLDivElement>(null);
  const prevValueRef = useRef<number>(value);

  useEffect(() => {
    if (counterRef.current && value !== prevValueRef.current) {
      const element = counterRef.current;
      
      // Fast animation for round counter
      element.style.setProperty('--round-counter', value.toString());
      
      prevValueRef.current = value;
    }
  }, [value]);

  return (
    <>
      <style>{`
        @property --round-counter {
          syntax: '<integer>';
          initial-value: ${prevValueRef.current};
          inherits: false;
        }
        
        .css-round-counter {
          transition: --round-counter 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
          counter-reset: round var(--round-counter);
        }
        
        .css-round-counter::after {
          content: counter(round);
        }
      `}</style>
      <div
        ref={counterRef}
        className={cn('css-round-counter', className)}
        style={{ '--round-counter': value } as any}
      />
    </>
  );
};