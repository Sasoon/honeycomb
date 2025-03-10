import React from 'react';

interface VictoryScreenProps {
  score: number;
  letterBagEmpty: boolean;
  completionPercentage: number;
  wordCount: number;
  isHighScore: boolean;
  onPlayAgain: () => void;
  onDismiss: (id: string) => void;
  toastId: string;
}

const VictoryScreen: React.FC<VictoryScreenProps> = ({
  score,
  letterBagEmpty,
  completionPercentage,
  wordCount,
  isHighScore,
  onPlayAgain,
  onDismiss,
  toastId
}) => {
  return (
    <div className={`max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex flex-col`}>
      <div className="flex-1 p-4">
        <div className="flex items-center justify-between">
          <div className="ml-3 flex-1">
            <p className="text-lg font-medium text-amber-900">
              Game Over!
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {letterBagEmpty ? 
                "You've used all available tiles from the bag!" : 
                "You've filled the entire board!"}
            </p>
          </div>
          <button
            onClick={() => onDismiss(toastId)}
            className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="mt-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Score:</span>
            <span className="text-lg font-bold text-amber-600">{score} points</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Board Filled:</span>
            <span className="text-lg font-bold text-amber-600">{completionPercentage}%</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Words Scored:</span>
            <span className="text-lg font-bold text-amber-600">{wordCount}</span>
          </div>
          {isHighScore && (
            <div className="mt-2 text-center p-2 bg-amber-100 rounded-md">
              <span className="text-amber-800 font-semibold">🏆 New High Score! 🏆</span>
            </div>
          )}
        </div>
        <div className="mt-4">
          <button
            onClick={() => {
              onPlayAgain();
              onDismiss(toastId);
            }}
            className="w-full py-2 px-4 bg-honeycomb hover:bg-honeycomb-dark text-white rounded-md shadow-sm transition-colors"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default VictoryScreen; 