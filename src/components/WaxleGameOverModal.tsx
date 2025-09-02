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
            className="bg-bg-primary rounded-3xl p-8 max-w-md w-full shadow-2xl border border-secondary/20 backdrop-blur-xl"
          >
            <div className="text-center space-y-8">
              {/* Header */}
              <div className="space-y-3">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber to-amber-light rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-text-primary">Game Over!</h2>
              </div>
              
              {/* Primary Score Display */}
              <div className="relative">
                <div className="bg-gradient-to-br from-bg-primary to-bg-secondary border border-secondary/20 rounded-2xl p-8 shadow-sm">
                  <div className="text-4xl font-bold text-amber mb-2">{score}</div>
                  <div className="text-text-secondary text-sm font-medium uppercase tracking-wide">Final Score</div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="flex justify-center gap-6">
                <div className="text-center space-y-2">
                  <div className="text-xl font-semibold text-text-primary">{totalWords}</div>
                  <div className="text-xs text-text-secondary font-medium uppercase tracking-wide">Words</div>
                </div>
                <div className="w-px bg-secondary/20"></div>
                <div className="text-center space-y-2">
                  <div className="text-xl font-semibold text-text-primary">{round}</div>
                  <div className="text-xs text-text-secondary font-medium uppercase tracking-wide">Rounds</div>
                </div>
                <div className="w-px bg-secondary/20"></div>
                <div className="text-center space-y-2 min-w-0 max-w-24">
                  <div className="text-lg font-semibold text-text-primary truncate" title={longestWord}>
                    {longestWord || 'N/A'}
                  </div>
                  <div className="text-xs text-text-secondary font-medium uppercase tracking-wide">Best Word</div>
                </div>
              </div>

              {/* Daily Challenge Submission */}
              {isDailyChallenge && !hasAlreadySubmitted && (
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold text-text-primary">Join the Leaderboard</h3>
                    <p className="text-sm text-text-secondary">Enter your name to compete with other players</p>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="Your name"
                      maxLength={20}
                      className="w-full px-4 py-3 bg-bg-secondary border border-secondary/20 rounded-xl focus:ring-2 focus:ring-amber/50 focus:border-amber/50 focus:outline-none transition-all text-text-primary placeholder:text-text-muted"
                      onKeyPress={(e) => e.key === 'Enter' && handleSubmitScore()}
                    />
                    <button
                      onClick={handleSubmitScore}
                      disabled={!playerName.trim() || isSubmitting}
                      className="w-full bg-amber hover:bg-amber-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-amber/20 flex items-center justify-center space-x-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit to Leaderboard</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Submission Result */}
              {submissionResult && (
                <div className={`p-6 rounded-2xl border ${
                  submissionResult.success 
                    ? 'bg-success-light/10 border-success/20' 
                    : 'bg-accent-light/10 border-accent/20'
                }`}>
                  <div className="flex items-center justify-center space-x-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      submissionResult.success ? 'bg-success/20' : 'bg-accent/20'
                    }`}>
                      {submissionResult.success ? (
                        <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-text-primary">
                        {submissionResult.message}
                      </div>
                      {submissionResult.success && submissionResult.rank && (
                        <div className="text-sm text-text-secondary mt-1">
                          Ranked #{submissionResult.rank.rank} of {submissionResult.rank.totalPlayers} players today
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                {isDailyChallenge ? (
                  // For daily challenge, only show Share and Leaderboard buttons
                  <>
                    <button
                      onClick={handleShare}
                      className="flex-1 bg-secondary/10 hover:bg-secondary/20 border border-secondary/20 text-text-primary font-medium py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-secondary/10 focus:outline-none focus:ring-2 focus:ring-secondary/50 flex items-center justify-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                      </svg>
                      <span>Share</span>
                    </button>
                    <a
                      href={`/leaderboard?t=${Date.now()}`}
                      className="flex-1 text-center bg-primary hover:bg-primary-dark text-white font-medium py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/50 flex items-center justify-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span>Leaderboard</span>
                    </a>
                  </>
                ) : (
                  // For regular games, show Play Again and Share
                  <>
                    <button
                      onClick={onRestart}
                      className="flex-1 bg-primary hover:bg-primary-dark text-white font-medium py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/50 flex items-center justify-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Play Again</span>
                    </button>
                    <button
                      onClick={handleShare}
                      className="flex-1 bg-secondary/10 hover:bg-secondary/20 border border-secondary/20 text-text-primary font-medium py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-secondary/10 focus:outline-none focus:ring-2 focus:ring-secondary/50 flex items-center justify-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                      </svg>
                      <span>Share</span>
                    </button>
                  </>
                )}
              </div>
              
              <div className="pt-2 border-t border-secondary/10">
                <p className="text-xs text-text-muted text-center">
                  {isDailyChallenge 
                    ? hasAlreadySubmitted 
                      ? 'Challenge complete • New challenge tomorrow'
                      : 'Compete with players worldwide'
                    : 'Tap outside to close • Press Play Again to continue'
                  }
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WaxleGameOverModal;