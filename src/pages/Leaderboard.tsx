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

      const response = await fetch(`/api/get-leaderboard?type=${type}&limit=50`);
      
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
    <div className="max-w-6xl mx-auto px-3 sm:px-4">
      <h1 className="text-3xl font-bold text-center mb-6">Leaderboard</h1>

      {/* Tab Navigation */}
      <div className="flex bg-gray-100 rounded-lg p-1 mb-6 max-w-md mx-auto">
        <button
          onClick={() => setActiveTab('daily')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'daily'
              ? 'bg-white text-honeycomb shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Daily
        </button>
        <button
          onClick={() => setActiveTab('alltime')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'alltime'
              ? 'bg-white text-honeycomb shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          All Time
        </button>
      </div>

      {/* Header Info */}
      {leaderboardData && (
        <div className="text-center mb-6">
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
          <p className="text-gray-600">
            {leaderboardData.totalEntries} player{leaderboardData.totalEntries !== 1 ? 's' : ''} participated
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-honeycomb"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-red-700 mb-2">Failed to Load Leaderboard</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => loadLeaderboard(activeTab)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Leaderboard Table */}
      {leaderboardData && !isLoading && !error && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {leaderboardData.leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No scores yet!</p>
              <p className="text-gray-400 mt-2">Be the first to complete today's challenge.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-honeycomb-light">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Rank</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Player</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Score</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Round</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Words</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Longest</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Time</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {leaderboardData.leaderboard.map((entry) => (
                    <tr 
                      key={`${entry.playerName}-${entry.submittedAt}`}
                      className={`hover:bg-gray-50 ${
                        entry.rank <= 3 ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <span className={`text-lg font-bold ${
                            entry.rank === 1 ? 'text-yellow-600' :
                            entry.rank === 2 ? 'text-gray-500' :
                            entry.rank === 3 ? 'text-amber-600' :
                            'text-gray-700'
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
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {entry.playerName}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-honeycomb">
                        {entry.score.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {entry.round}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {entry.totalWords}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 font-mono">
                        {entry.longestWord || '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {formatTimeSpent(entry.timeSpent)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 text-sm">
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
            className="px-6 py-2 bg-honeycomb text-white rounded-lg hover:bg-honeycomb-dark transition-colors"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;