import { useState, useEffect } from 'react';
import { useWaxleGameStore } from '../store/waxleGameStore';
import WaxleGame from './WaxleGame';

interface DailySeedData {
  date: string;
  seed: number;
  gameState: {
    startingLetters: string[];
    firstDrop: string[];
    secondDrop: string[];
    rngState: number;
  };
  createdAt: string;
}

const DailyChallenge = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState('');
  const [seedData, setSeedData] = useState<DailySeedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  
  const { initializeDailyChallenge, isDailyChallenge } = useWaxleGameStore();
  const dailyDate = useWaxleGameStore(state => state.dailyGameState.dailyDate);
  const [isPlayingChallenge, setIsPlayingChallenge] = useState(false);
  
  // Load daily seed on component mount
  useEffect(() => {
    const loadDailySeed = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/daily-seed');
        
        if (!response.ok) {
          throw new Error(`Failed to load daily seed: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to load daily seed');
        }
        
        setSeedData(result.data);
        
        // Check if today's challenge has already been completed
        const today = new Date().toISOString().split('T')[0];
        const completedKey = `waxle-daily-completed-${today}`;
        const hasCompleted = localStorage.getItem(completedKey) === 'true';
        setIsCompleted(hasCompleted);
      } catch (err) {
        console.error('Error loading daily seed:', err);
        setError(err instanceof Error ? err.message : 'Failed to load daily challenge');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadDailySeed();
  }, []);
  
  // Calculate time until next day's challenge
  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const diff = tomorrow.getTime() - now.getTime();
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };
    
    // Initial calculation
    setCountdown(calculateCountdown());
    setIsLoading(false);
    
    // Update every second
    const interval = setInterval(() => {
      setCountdown(calculateCountdown());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const todayLabel = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const handleStartChallenge = () => {
    if (!seedData || isCompleted) return;
    
    // Initialize the daily challenge in the game store
    initializeDailyChallenge(seedData.seed, seedData.gameState, seedData.date);
    
    // Show the game view instead of navigating away
    setIsPlayingChallenge(true);
  };
  
  const handleBackToDailyPage = () => {
    setIsPlayingChallenge(false);
  };
  
  
  // Check if already playing today's challenge
  const isPlayingToday = isDailyChallenge && dailyDate === seedData?.date;
  
  // If playing the challenge, render the game
  if (isPlayingChallenge || isPlayingToday) {
    return (
      <WaxleGame
        onBackToDailyChallenge={handleBackToDailyPage}
      />
    );
  }
  
  return (
    <>
      <div className="page-container page-container--standard">
        <h1 className="page-title">Daily</h1>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber"></div>
        </div>
      ) : error ? (
        <div className="bg-accent-light border border-accent rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-text-primary mb-2">Failed to Load Challenge</h2>
          <p className="text-text-secondary mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-secondary-light rounded-lg shadow-lg border border-secondary p-6">
          <div className="text-center mb-6">
            <div className="text-xl font-semibold">Today's Challenge</div>
            <div className="text-2xl font-bold text-amber">
              {todayLabel}
            </div>
          </div>
          
          <div className="mb-6">
            <div className="text-sm text-text-muted mb-1">Next challenge in:</div>
            <div className="text-3xl font-mono font-bold text-center">{countdown}</div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-waxle-light rounded-lg p-4">
              <h2 className="font-semibold mb-2">Today's Challenge Rules:</h2>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Standard game rules apply</li>
                <li>Everyone gets the same starting grid</li>
                <li>Complete with the fewest turns to top the leaderboard</li>
              </ul>
            </div>
            
            <button 
              onClick={handleStartChallenge}
              disabled={!seedData || isCompleted}
              className={`w-full py-3 text-white font-semibold rounded-lg transition-colors ${
                isCompleted 
                  ? 'bg-success cursor-not-allowed' 
                  : 'bg-amber hover:bg-amber-dark disabled:bg-gray-400 disabled:cursor-not-allowed'
              }`}
            >
              {isCompleted 
                ? '✅ Challenge Completed!' 
                : isPlayingToday 
                  ? 'Continue Today\'s Challenge' 
                  : 'Start Today\'s Challenge'}
            </button>
            
            {isCompleted && (
              <div className="bg-success-light border border-success rounded-lg p-4 text-center">
                <p className="text-text-primary mb-2">🎉 Great job completing today's challenge!</p>
                <a 
                  href="/leaderboard" 
                  className="inline-block px-4 py-2 bg-success text-white rounded-lg hover:bg-success-dark transition-colors"
                >
                  View Leaderboard
                </a>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default DailyChallenge; 