import { useState, useEffect } from 'react';

const DailyChallenge = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState('');
  
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
  
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4">
      <h1 className="text-3xl font-bold text-center mb-6">Daily Challenge</h1>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-honeycomb"></div>
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
            
            <button className="w-full py-3 bg-honeycomb hover:bg-honeycomb-dark text-white font-semibold rounded-lg transition-colors">
              Start Today's Challenge
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