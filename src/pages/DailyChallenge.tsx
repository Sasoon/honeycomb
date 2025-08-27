import { useState, useEffect } from 'react';
import { useTetrisGameStore } from '../store/tetrisGameStore';
import { useNavigate } from 'react-router-dom';

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
  
  const { initializeDailyChallenge, isDailyChallenge, dailyDate } = useTetrisGameStore();
  const navigate = useNavigate();
  
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
    if (!seedData) return;
    
    // Initialize the daily challenge in the game store
    initializeDailyChallenge(seedData.seed, seedData.gameState, seedData.date);
    
    // Navigate to the main game page
    navigate('/');
  };
  
  // Check if already playing today's challenge
  const isPlayingToday = isDailyChallenge && dailyDate === seedData?.date;
  
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4">
      <h1 className="text-3xl font-bold text-center mb-6">Daily Challenge</h1>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-honeycomb"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-700 mb-2">Failed to Load Challenge</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center mb-6">
            <div className="text-xl font-semibold">Today's Challenge</div>
            <div className="text-2xl font-bold text-honeycomb-dark">
              {todayLabel}
            </div>
          </div>
          
          <div className="mb-6">
            <div className="text-sm text-gray-600 mb-1">Next challenge in:</div>
            <div className="text-3xl font-mono font-bold text-center">{countdown}</div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-honeycomb-light rounded-lg p-4">
              <h2 className="font-semibold mb-2">Today's Challenge Rules:</h2>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Standard game rules apply</li>
                <li>Everyone gets the same starting grid</li>
                <li>Complete with the fewest turns to top the leaderboard</li>
              </ul>
            </div>
            
            <button 
              onClick={handleStartChallenge}
              disabled={!seedData}
              className="w-full py-3 bg-honeycomb hover:bg-honeycomb-dark disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {isPlayingToday ? 'Continue Today\'s Challenge' : 'Start Today\'s Challenge'}
            </button>
            
            <div>
              <h2 className="font-semibold mb-2">Top Scores:</h2>
              <div className="text-sm text-gray-600 italic">
                Challenge leaderboard will be implemented in a future update
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyChallenge; 