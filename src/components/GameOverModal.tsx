import { AnimatePresence, motion } from 'framer-motion';

interface GameOverModalProps {
  isOpen: boolean;
  score: number;
  words: number;
  boardPercent: number;
  onRestart: () => void;
}

const GameOverModal = ({ isOpen, score, words, boardPercent, onRestart }: GameOverModalProps) => {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="bg-amber-50 rounded-lg shadow-lg p-5 w-full max-w-sm mx-4"
          >
            <h2 className="text-2xl font-bold text-amber-900 mb-3 text-center">Game Over</h2>
            <div className="bg-white rounded-lg p-4 mb-4 text-center">
              <div className="text-gray-700 font-medium">Score</div>
              <div className="text-2xl font-extrabold">{score}</div>
              <div className="mt-3 text-gray-700 font-medium">Words</div>
              <div className="text-xl font-bold">{words}</div>
              <div className="mt-3 text-gray-700 font-medium">Board Filled</div>
              <div className="text-xl font-bold">{boardPercent}%</div>
            </div>
            <div className="flex justify-between">
              <button onClick={onRestart} className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">Restart</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default GameOverModal; 