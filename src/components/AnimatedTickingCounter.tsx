import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedTickingCounterProps {
  value: number;
  className?: string;
  formatNumber?: (num: number) => string;
}

export const AnimatedTickingCounter = ({ 
  value, 
  className,
  formatNumber = (num) => num.toString()
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
            stiffness: 800,
            damping: 25,
            duration: 0.1
          }}
          className="flex items-center justify-center"
        >
          {formatNumber(value)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};