import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import toastService from '../lib/toastService';

interface WaxleGameOverModalProps {
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

const WaxleGameOverModal = ({
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
}: WaxleGameOverModalProps) => {
  const [playerName, setPlayerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    success: boolean;
    message?: string;
    rank?: { rank: number; totalPlayers: number };
  } | null>(null);
  const [hasAlreadySubmitted, setHasAlreadySubmitted] = useState(false);

  // Load saved player name and check submission status
  useEffect(() => {
    if (isDailyChallenge && dailyDate) {
      const savedName = localStorage.getItem('waxle-player-name');
      if (savedName) {
        setPlayerName(savedName);
      }
      
      // Check if score has already been submitted for this date
      const submissionKey = `waxle-daily-submitted-${dailyDate}`;
      const existingSubmission = localStorage.getItem(submissionKey);
      if (existingSubmission) {
        const submissionData = JSON.parse(existingSubmission);
        setHasAlreadySubmitted(true);
        setSubmissionResult({
          success: true,
          message: 'Score already submitted!',
          rank: submissionData.rank
        });
      }
    }
  }, [isDailyChallenge, dailyDate]);

  // Only mark daily challenge as completed when modal actually opens (game is actually over)
  useEffect(() => {
    if (!isOpen || !isDailyChallenge || !dailyDate) return;
    
    // Check if already marked to prevent duplicates
    const completionKey = `honeycomb-daily-completed-${dailyDate}`;
    const alreadyMarked = localStorage.getItem(completionKey) === 'true';
    
    if (!alreadyMarked) {
      // Mark today's daily challenge as completed
      localStorage.setItem(completionKey, 'true');
      
      // Store the completion data for modal persistence
      const completionData = {
        score,
        totalWords,
        round,
        longestWord,
        completedAt: new Date().toISOString()
      };
      localStorage.setItem(`waxle-daily-completion-${dailyDate}`, JSON.stringify(completionData));
    }
  }, [isOpen, isDailyChallenge, dailyDate, score, totalWords, round, longestWord]);

  const handleSubmitScore = async () => {
    if (!playerName.trim() || !isDailyChallenge || !dailyDate) return;
    
    try {
      setIsSubmitting(true);
      
      // Calculate time spent
      const timeSpent = challengeStartTime ? Math.floor((Date.now() - challengeStartTime) / 1000) : 0;
      
      // Save player name to localStorage
      localStorage.setItem('waxle-player-name', playerName.trim());
      
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
      
      const submissionData = {
        success: true,
        message: result.isPersonalBest ? 'New personal best!' : 'Score submitted!',
        rank: result.dailyRank
      };
      
      setSubmissionResult(submissionData);
      setHasAlreadySubmitted(true);
      
      // Store submission data to prevent duplicate submissions
      if (dailyDate) {
        localStorage.setItem(`waxle-daily-submitted-${dailyDate}`, JSON.stringify(submissionData));
      }
      
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
    const shareText = isDailyChallenge 
      ? `🎯 WAXLE - Daily Challenge\n\nScore: ${score}\nWords: ${totalWords}\nRounds: ${round}\nLongest: ${longestWord}\n\nPlay today's challenge: https://honeycomb-game.netlify.app/daily`
      : `🎯 WAXLE\n\nFinal Score: ${score}\nWords Found: ${totalWords}\nRounds Survived: ${round}\nLongest Word: ${longestWord}\n\nPlay at: ${window.location.origin}`;
    
    // Copy to clipboard only
    navigator.clipboard.writeText(shareText).then(() => {
      toastService.success('Stats copied to clipboard!');
    }).catch(() => {
      toastService.error('Failed to copy stats');
    });
    
    if (onShare) onShare();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 ${
            isDailyChallenge ? 'z-30' : 'z-50'
          }`}
          onClick={(e) => e.target === e.currentTarget && !isDailyChallenge && onRestart()}
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: "spring", damping: 15 }}
            className="bg-secondary-light rounded-2xl p-6 max-w-md w-full shadow-2xl border border-secondary"
          >
            <div className="text-center">
              <h2 className="text-3xl font-bold text-primary mb-2">Game Over!</h2>
              <p className="text-secondary mb-6">Nice run! Here are your stats:</p>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-accent-light rounded-lg p-4">
                  <div className="text-2xl font-bold text-primary">{score}</div>
                  <div className="text-sm text-secondary">Final Score</div>
                </div>
                <div className="bg-success-light rounded-lg p-4">
                  <div className="text-2xl font-bold text-primary">{totalWords}</div>
                  <div className="text-sm text-secondary">Words Found</div>
                </div>
                <div className="bg-secondary rounded-lg p-4">
                  <div className="text-2xl font-bold text-white">{round}</div>
                  <div className="text-sm text-white">Rounds Survived</div>
                </div>
                <div className="bg-highlight rounded-lg p-4">
                  <div className="text-lg font-bold text-primary-dark truncate" title={longestWord}>
                    {longestWord || 'N/A'}
                  </div>
                  <div className="text-sm text-secondary">Longest Word</div>
                </div>
              </div>

              {/* Daily Challenge Submission */}
              {isDailyChallenge && !hasAlreadySubmitted && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-primary mb-3">Submit to Daily Leaderboard</h3>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Enter your name"
                    maxLength={20}
                    className="w-full px-4 py-2 border border-secondary-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent mb-3"
                    onKeyPress={(e) => e.key === 'Enter' && handleSubmitScore()}
                  />
                  <button
                    onClick={handleSubmitScore}
                    disabled={!playerName.trim() || isSubmitting}
                    className="w-full bg-primary hover:bg-primary-light disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
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
                  // For daily challenge, only show Share and Leaderboard buttons
                  <>
                    <button
                      onClick={handleShare}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      Share Stats
                    </button>
                    <a
                      href={`/leaderboard?t=${Date.now()}`}
                      className="flex-1 text-center bg-primary hover:bg-primary-light text-white font-semibold py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-secondary"
                    >
                      View Leaderboard
                    </a>
                  </>
                ) : (
                  // For regular games, show Play Again and Share
                  <>
                    <button
                      onClick={onRestart}
                      className="flex-1 bg-accent hover:bg-accent-dark text-white font-semibold py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      Play Again
                    </button>
                    <button
                      onClick={handleShare}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      Share Stats
                    </button>
                  </>
                )}
              </div>
              
              <p className="text-xs text-gray-400 mt-4">
                {isDailyChallenge 
                  ? hasAlreadySubmitted 
                    ? 'Daily challenge complete! Come back tomorrow for a new challenge.'
                    : 'Submit your score to compete on the leaderboard!'
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

export default WaxleGameOverModal;