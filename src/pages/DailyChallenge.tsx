import { useState, useEffect } from 'react';
import { Clock, Play, CheckCircle, RotateCcw } from 'lucide-react';
import { useWaxleGameStore } from '../store/waxleGameStore';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { cn } from '../lib/utils';
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
  
  const { initializeDailyChallenge, dailyGameState } = useWaxleGameStore();
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
  
  // Calculate time until next day's challenge (UTC midnight)
  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date();
      
      // Get today's UTC midnight
      const todayMidnight = new Date(now);
      todayMidnight.setUTCHours(0, 0, 0, 0);
      
      // Get tomorrow's UTC midnight
      const tomorrowMidnight = new Date(todayMidnight);
      tomorrowMidnight.setUTCDate(tomorrowMidnight.getUTCDate() + 1);
      
      // Use tomorrow if we're past today's midnight
      const target = now >= todayMidnight ? tomorrowMidnight : todayMidnight;
      
      const diff = target.getTime() - now.getTime();
      
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
    timeZone: 'UTC'
  });
  
  // Helper to get local reset time
  const getLocalResetTime = () => {
    const utcMidnight = new Date();
    utcMidnight.setUTCHours(24, 0, 0, 0);
    
    // Get timezone like "Australia/Sydney" and extract city name
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const city = timeZone.split('/').pop()?.replace(/_/g, ' ') || 'your timezone';
    
    const time = utcMidnight.toLocaleTimeString(undefined, { 
      hour: 'numeric', 
      minute: '2-digit'
    });
    
    return `${time} ${city} time`;
  };
  
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
  
  
  // Check if there's an active daily game in progress
  const hasDailyGameInProgress = dailyGameState?.gameInitialized && dailyGameState?.phase !== 'gameOver';
  
  // If already in daily challenge mode or has game in progress, show game immediately to prevent flash
  if (hasDailyGameInProgress || isPlayingChallenge) {
    return (
      <WaxleGame
        onBackToDailyChallenge={handleBackToDailyPage}
      />
    );
  }
  
  return (
    <div className="min-h-screen bg-bg-secondary">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {isLoading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-amber/30 border-t-amber"></div>
              <p className="text-text-secondary">Loading today's challenge...</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
                <RotateCcw className="w-8 h-8 text-accent" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">Failed to Load Challenge</h2>
                <p className="text-text-secondary mb-4">{error}</p>
                <Button 
                  variant="destructive"
                  onClick={() => window.location.reload()}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Challenge Info Card */}
            <Card>
              <CardHeader>
                <div className="text-center space-y-2">
                  <CardTitle className="flex items-center justify-center space-x-2">
                    <span>Today's Challenge</span>
                  </CardTitle>
                  <div className="text-2xl font-bold text-amber">
                    {todayLabel}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Countdown Section */}
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center space-x-2 text-text-secondary">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">Next challenge in</span>
                  </div>
                  <div className="text-xs text-text-secondary/70">
                    Resets daily at {getLocalResetTime()}
                  </div>
                  <div className={cn(
                    "text-3xl font-mono font-bold text-center",
                    "bg-bg-secondary rounded-2xl py-4 px-6",
                    "border border-secondary/20"
                  )}>
                    {countdown}
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  onClick={handleStartChallenge}
                  disabled={!seedData || isCompleted}
                  variant={isCompleted ? "success" : "default"}
                  size="lg"
                  className="w-full"
                >
                  {isCompleted ? (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Challenge Completed!
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      Start Today's Challenge
                    </>
                  )}
                </Button>

                {/* Completion Success */}
                {isCompleted && (
                  <div className={cn(
                    "bg-success/10 border border-success/20",
                    "rounded-2xl p-6 text-center space-y-4"
                  )}>
                    <div>
                      <Button variant="success" asChild>
                        <a href="/leaderboard">
                          View Leaderboard
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyChallenge; 