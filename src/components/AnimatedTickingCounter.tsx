import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedTickingCounterProps {
  value: number;
  className?: string;
  formatNumber?: (num: number) => string;
  delay?: number; // Animation delay in milliseconds
}

export const AnimatedTickingCounter = ({ 
  value, 
  className,
  formatNumber = (num) => num.toString(),
  delay = 0
}: AnimatedTickingCounterProps) => {
  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        <motion.div
          key={value}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 1200,
            damping: 20,
            duration: 0.05,
            delay: delay / 1000 // Convert ms to seconds for Framer Motion
          }}
          className="flex items-center justify-center"
        >
          {formatNumber(value)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};