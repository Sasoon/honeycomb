import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface TetrisGameOverModalProps {
  isOpen: boolean;
  score: number;
  totalWords: number;
  round: number;
  longestWord: string;
  onRestart: () => void;
  onShare?: () => void;
  isDailyChallenge?: boolean;
  dailyDate?: string;
  challengeStartTime?: number;
}

const TetrisGameOverModal = ({
  isOpen,
  score,
  totalWords,
  round,
  longestWord,
  onRestart,
  onShare,
  isDailyChallenge = false,
  dailyDate,
  challengeStartTime
}: TetrisGameOverModalProps) => {
  const [playerName, setPlayerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    success: boolean;
    message?: string;
    rank?: { rank: number; totalPlayers: number };
  } | null>(null);

  // Load saved player name from localStorage and mark daily challenge as completed
  useEffect(() => {
    if (isDailyChallenge && dailyDate) {
      const savedName = localStorage.getItem('honeycomb-player-name');
      if (savedName) {
        setPlayerName(savedName);
      }
      
      // Mark today's daily challenge as completed
      localStorage.setItem(`honeycomb-daily-completed-${dailyDate}`, 'true');
    }
  }, [isDailyChallenge, dailyDate]);

  const handleSubmitScore = async () => {
    if (!playerName.trim() || !isDailyChallenge || !dailyDate) return;
    
    try {
      setIsSubmitting(true);
      
      // Calculate time spent
      const timeSpent = challengeStartTime ? Math.floor((Date.now() - challengeStartTime) / 1000) : 0;
      
      // Save player name to localStorage
      localStorage.setItem('honeycomb-player-name', playerName.trim());
      
      const response = await fetch('/api/submit-score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerName: playerName.trim(),
          score,
          round,
          totalWords,
          longestWord,
          timeSpent,
          date: dailyDate
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to submit score: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to submit score');
      }
      
      setSubmissionResult({
        success: true,
        message: result.isPersonalBest ? 'New personal best!' : 'Score submitted!',
        rank: result.dailyRank
      });
      
    } catch (error) {
      console.error('Error submitting score:', error);
      setSubmissionResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to submit score'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = () => {
    const shareText = `🎯 Honeycomb Tetris\n\nFinal Score: ${score}\nWords Found: ${totalWords}\nRounds Survived: ${round}\nLongest Word: ${longestWord}\n\nPlay at: ${window.location.origin}`;
    
    if (navigator.share && navigator.canShare({ text: shareText })) {
      navigator.share({
        title: 'Honeycomb Tetris',
        text: shareText
      });
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(shareText).then(() => {
        // Could show a toast here
        console.log('Stats copied to clipboard!');
      });
    }
    
    if (onShare) onShare();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && !isDailyChallenge && onRestart()}
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: "spring", damping: 15 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Game Over!</h2>
              <p className="text-gray-600 mb-6">Nice run! Here are your stats:</p>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-amber-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-amber-700">{score}</div>
                  <div className="text-sm text-gray-600">Final Score</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-700">{totalWords}</div>
                  <div className="text-sm text-gray-600">Words Found</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-700">{round}</div>
                  <div className="text-sm text-gray-600">Rounds Survived</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-lg font-bold text-purple-700 truncate" title={longestWord}>
                    {longestWord || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">Longest Word</div>
                </div>
              </div>

              {/* Daily Challenge Submission */}
              {isDailyChallenge && !submissionResult && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Submit to Daily Leaderboard</h3>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Enter your name"
                    maxLength={20}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-honeycomb focus:border-transparent mb-3"
                    onKeyPress={(e) => e.key === 'Enter' && handleSubmitScore()}
                  />
                  <button
                    onClick={handleSubmitScore}
                    disabled={!playerName.trim() || isSubmitting}
                    className="w-full bg-honeycomb hover:bg-honeycomb-dark disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
                  >
                    {isSubmitting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    ) : null}
                    {isSubmitting ? 'Submitting...' : 'Submit Score'}
                  </button>
                </div>
              )}

              {/* Submission Result */}
              {submissionResult && (
                <div className={`mb-6 p-4 rounded-lg ${
                  submissionResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <div className={`font-semibold ${
                    submissionResult.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {submissionResult.success ? '✅ ' : '❌ '}
                    {submissionResult.message}
                  </div>
                  {submissionResult.success && submissionResult.rank && (
                    <div className="text-sm text-green-600 mt-2">
                      Daily Rank: #{submissionResult.rank.rank} of {submissionResult.rank.totalPlayers} players
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                {isDailyChallenge ? (
                  <a
                    href="/daily"
                    className="flex-1 text-center bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-300"
                  >
                    Back to Daily Challenge
                  </a>
                ) : (
                  <button
                    onClick={onRestart}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-300"
                  >
                    Play Again
                  </button>
                )}
                <button
                  onClick={handleShare}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  Share Stats
                </button>
              </div>
              
              {/* Additional Actions for Daily Challenge */}
              {isDailyChallenge && submissionResult?.success && (
                <div className="mt-3">
                  <a
                    href="/leaderboard"
                    className="block w-full text-center py-2 px-4 bg-honeycomb-light text-honeycomb hover:bg-honeycomb hover:text-white rounded-lg transition-colors"
                  >
                    View Full Leaderboard
                  </a>
                </div>
              )}
              
              <p className="text-xs text-gray-400 mt-4">
                {isDailyChallenge 
                  ? 'Daily challenge complete! Submit your score above or return to the daily page.'
                  : 'Tap outside or press Play Again to continue'
                }
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TetrisGameOverModal;