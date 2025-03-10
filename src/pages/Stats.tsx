import { useState, useEffect } from 'react';

// Mock data for now - in a real implementation, this would be stored in localStorage or a database
type GameStats = {
  gamesPlayed: number;
  wordsFormed: number;
  bestWord: string;
  bestWordScore: number;
  totalScore: number;
  averageTurns: number;
  fewestTurns: number;
};

const Stats = () => {
  const [stats, setStats] = useState<GameStats>({
    gamesPlayed: 0,
    wordsFormed: 0,
    bestWord: '',
    bestWordScore: 0,
    totalScore: 0,
    averageTurns: 0,
    fewestTurns: 0
  });
  
  useEffect(() => {
    // Mock loading stats from localStorage
    const mockStats: GameStats = {
      gamesPlayed: 12,
      wordsFormed: 148,
      bestWord: 'HONEY',
      bestWordScore: 16,
      totalScore: 1245,
      averageTurns: 14.3,
      fewestTurns: 9
    };
    
    setStats(mockStats);
  }, []);
  
  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4">
      <h1 className="text-3xl font-bold text-center mb-6">Your Statistics</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Games Played" value={stats.gamesPlayed.toString()} />
        <StatCard label="Words Formed" value={stats.wordsFormed.toString()} />
        <StatCard label="Total Score" value={stats.totalScore.toString()} />
        <StatCard label="Best Word" value={stats.bestWord} subvalue={`${stats.bestWordScore} pts`} />
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Game Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Average Turns per Win</h3>
            <div className="flex items-center">
              <div className="text-4xl font-bold text-honeycomb-dark">{stats.averageTurns}</div>
              <div className="ml-2 text-sm text-gray-600">turns</div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Fewest Turns to Win</h3>
            <div className="flex items-center">
              <div className="text-4xl font-bold text-green-600">{stats.fewestTurns}</div>
              <div className="ml-2 text-sm text-gray-600">turns</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Word History</h2>
        <div className="text-center p-8 text-gray-500">
          Word history will be implemented in a future update.
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 text-center">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {subvalue && <div className="text-xs text-gray-500">{subvalue}</div>}
    </div>
  );
};

export default Stats; 