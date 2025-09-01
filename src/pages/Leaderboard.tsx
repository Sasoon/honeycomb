import { useState, useEffect } from 'react';

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

      const response = await fetch(`/api/get-leaderboard?type=${type}&limit=10&t=${Date.now()}`);
      
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

  const formatTimeSpent = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="page-container page-container--wide">
      <h1 className="page-title">Leaderboard</h1>

      {/* Tab Navigation */}
      <div className="flex bg-secondary rounded-lg p-1 content-spacing max-w-md mx-auto">
        <button
          onClick={() => setActiveTab('daily')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'daily'
              ? 'bg-secondary-light text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Daily
        </button>
        <button
          onClick={() => setActiveTab('alltime')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'alltime'
              ? 'bg-secondary-light text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          All Time
        </button>
      </div>

      {/* Header Info */}
      {leaderboardData && (
        <div className="text-center content-spacing">
          <h2 className="text-xl font-semibold mb-2">
            {activeTab === 'daily' 
              ? `Daily Challenge - ${new Date().toLocaleDateString(undefined, { 
                  weekday: 'long',
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}`
              : 'All-Time Best Scores'
            }
          </h2>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-waxle"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-accent-light border border-accent rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-text-primary mb-2">Failed to Load Leaderboard</h3>
          <p className="text-text-secondary mb-4">{error}</p>
          <button 
            onClick={() => loadLeaderboard(activeTab)}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Leaderboard Table */}
      {leaderboardData && !isLoading && !error && (
        <div className="bg-secondary-light rounded-lg shadow-lg border border-secondary overflow-hidden">
          {leaderboardData.leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-muted text-lg">No scores yet!</p>
              <p className="text-text-muted mt-2 opacity-80">Be the first to complete today's challenge.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-waxle-light">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Rank</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Player</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-text-secondary">Score</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-text-secondary">Round</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-text-secondary">Words</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-text-secondary">Longest</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-text-secondary">Time</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-text-secondary">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary">
                  {leaderboardData.leaderboard.map((entry) => (
                    <tr 
                      key={`${entry.playerName}-${entry.submittedAt}`}
                      className={`hover:bg-secondary ${
                        entry.rank <= 3 ? 'bg-highlight-light' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <span className={`text-lg font-bold ${
                            entry.rank === 1 ? 'text-success' :
                            entry.rank === 2 ? 'text-text-secondary' :
                            entry.rank === 3 ? 'text-highlight' :
                            'text-text-primary'
                          }`}>
                            #{entry.rank}
                          </span>
                          {entry.rank <= 3 && (
                            <span className="ml-2 text-lg">
                              {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-text-primary">
                        {entry.playerName}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-honeycomb">
                        {entry.score.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center text-text-secondary">
                        {entry.round}
                      </td>
                      <td className="px-4 py-3 text-center text-text-secondary">
                        {entry.totalWords}
                      </td>
                      <td className="px-4 py-3 text-center text-text-secondary font-mono">
                        {entry.longestWord || '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-text-secondary">
                        {formatTimeSpent(entry.timeSpent)}
                      </td>
                      <td className="px-4 py-3 text-center text-text-muted text-sm">
                        {formatDate(entry.submittedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Refresh Button */}
      {leaderboardData && !isLoading && (
        <div className="text-center mt-6">
          <button
            onClick={() => loadLeaderboard(activeTab)}
            className="px-6 py-2 bg-waxle text-white rounded-lg hover:bg-waxle-dark transition-colors"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;