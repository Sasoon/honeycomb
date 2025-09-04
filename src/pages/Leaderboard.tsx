import { useState, useEffect } from 'react';
import { Trophy, Clock, Target } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { cn } from '../lib/utils';

interface LeaderboardEntry {
  rank: number;
  playerName: string;
  score: number;
  round: number;
  totalWords: number;
  longestWord: string;
  timeSpent: number;
  date: string;
  submittedAt: string;
}

interface LeaderboardData {
  success: boolean;
  type: 'daily' | 'alltime';
  date?: string;
  leaderboard: LeaderboardEntry[];
  totalEntries: number;
}

const Leaderboard = () => {
  const [activeTab, setActiveTab] = useState<'daily' | 'alltime'>('daily');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load leaderboard data
  const loadLeaderboard = async (type: 'daily' | 'alltime') => {
    try {
      setIsLoading(true);
      setError(null);

      // Add extra cache busting for fresh submissions
      const url = new URL(window.location.href);
      const isJustSubmitted = url.searchParams.get('submitted') === 'true';
      const cacheBreaker = isJustSubmitted ? `fresh=${Date.now()}&rand=${Math.random()}` : `t=${Date.now()}`;
      
      const response = await fetch(`/api/get-leaderboard?type=${type}&limit=10&${cacheBreaker}`, {
        cache: 'no-store', // Force no browser caching
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load leaderboard: ${response.statusText}`);
      }

      const result: LeaderboardData = await response.json();
      
      if (!result.success) {
        throw new Error('Failed to load leaderboard data');
      }

      setLeaderboardData(result);
    } catch (err) {
      console.error('Error loading leaderboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  };

  // Load data when tab changes
  useEffect(() => {
    loadLeaderboard(activeTab);
  }, [activeTab]);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  return (
    <div className="min-h-screen bg-bg-secondary">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <Trophy className="w-8 h-8 text-amber" />
            <h1 className="text-4xl font-bold text-text-primary">Leaderboard</h1>
          </div>
          <p className="text-text-secondary">Compete with players around the world</p>
        </div>

        {/* Modern Tab Navigation */}
        <div className="flex justify-center">
          <div className="bg-bg-primary/50 backdrop-blur-sm border border-secondary/20 rounded-2xl p-1 shadow-lg shadow-secondary/10">
            <div className="flex">
              <Button
                variant={activeTab === 'daily' ? 'default' : 'ghost'}
                size="default"
                onClick={() => setActiveTab('daily')}
                className={cn(
                  "px-6 py-3 rounded-xl transition-all duration-200",
                  activeTab === 'daily' && "shadow-lg shadow-amber/20"
                )}
              >
                📅 Daily Challenge
              </Button>
              <Button
                variant={activeTab === 'alltime' ? 'default' : 'ghost'}
                size="default"
                onClick={() => setActiveTab('alltime')}
                className={cn(
                  "px-6 py-3 rounded-xl transition-all duration-200",
                  activeTab === 'alltime' && "shadow-lg shadow-amber/20"
                )}
              >
                🏆 All Time
              </Button>
            </div>
          </div>
        </div>

        {/* Header Info */}
        {leaderboardData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-center">
                {activeTab === 'daily' 
                  ? `Daily Challenge - ${new Date().toLocaleDateString(undefined, { 
                      weekday: 'long',
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}`
                  : 'All-Time Champions'
                }
              </CardTitle>
            </CardHeader>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="flex justify-center items-center py-16">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-amber/30 border-t-amber"></div>
                <p className="text-text-secondary">Loading leaderboard...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card>
            <CardContent className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
                <Trophy className="w-8 h-8 text-accent" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">Failed to Load Leaderboard</h3>
                <p className="text-text-secondary mb-4">{error}</p>
                <Button 
                  variant="destructive"
                  onClick={() => loadLeaderboard(activeTab)}
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modern Leaderboard */}
        {leaderboardData && !isLoading && !error && (
          <Card>
            <CardContent className="p-0">
              {leaderboardData.leaderboard.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                  <div className="w-16 h-16 bg-amber/10 rounded-full flex items-center justify-center mx-auto">
                    <Trophy className="w-8 h-8 text-amber" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-text-primary">No scores yet!</p>
                    <p className="text-text-secondary">Be the first to complete today's challenge.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 p-6">
                  {leaderboardData.leaderboard.map((entry) => (
                    <div 
                      key={`${entry.playerName}-${entry.submittedAt}`}
                      className={cn(
                        "flex items-center p-4 rounded-2xl transition-all duration-200",
                        "hover:bg-secondary/5 hover:shadow-lg hover:shadow-secondary/10",
                        entry.rank <= 3 && "bg-amber/5 border border-amber/20 shadow-lg shadow-amber/10",
                        entry.rank === 1 && "ring-2 ring-amber/30"
                      )}
                    >
                      {/* Rank */}
                      <div className="flex items-center min-w-8">
                        <div className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm",
                          entry.rank === 1 && "bg-amber/20 text-amber",
                          entry.rank === 2 && "bg-secondary/20 text-text-primary", 
                          entry.rank === 3 && "bg-amber/15 text-amber-600",
                          entry.rank > 3 && "bg-secondary/10 text-text-secondary"
                        )}>
                          {entry.rank}
                        </div>
                      </div>

                      {/* Player Name */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-text-primary text-lg truncate">
                          {entry.playerName}
                        </h3>
                        <div className="flex items-center space-x-2 text-sm text-text-secondary">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(entry.submittedAt)}</span>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 ml-4">
                        <div className="text-center">
                          <div className="h-8 flex items-center justify-center text-2xl font-bold text-amber">{entry.score.toLocaleString()}</div>
                          <div className="text-xs text-text-secondary font-medium">Score</div>
                        </div>
                        <div className="text-center">
                          <div className="h-8 flex items-center justify-center text-lg font-semibold text-text-primary">{entry.round}</div>
                          <div className="text-xs text-text-secondary font-medium">Round</div>
                        </div>
                        <div className="text-center">
                          <div className="h-8 flex items-center justify-center text-lg font-semibold text-text-primary">{entry.totalWords}</div>
                          <div className="text-xs text-text-secondary font-medium">Words</div>
                        </div>
                        <div className="text-center">
                          <div className="h-8 flex items-center justify-center text-sm font-mono font-semibold text-text-primary truncate" title={entry.longestWord}>
                            {entry.longestWord || '-'}
                          </div>
                          <div className="text-xs text-text-secondary font-medium">Longest</div>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Modern Refresh Button */}
        {leaderboardData && !isLoading && (
          <div className="flex justify-center">
            <Button
              variant="secondary"
              onClick={() => loadLeaderboard(activeTab)}
              className="px-6 py-3"
            >
              <Target className="w-4 h-4 mr-2" />
              Refresh Leaderboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;