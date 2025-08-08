import useGameStore from '../store/gameStore';

const Stats = () => {
  const stats = useGameStore(s => s.stats);
  
  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4">
      <h1 className="text-3xl font-bold text-center mb-6">Your Statistics</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Games Played" value={stats.gamesPlayed.toString()} />
        <StatCard label="Words Formed" value={stats.wordsFormed.toString()} />
        <StatCard label="Total Score" value={stats.totalScore.toString()} />
        <StatCard label="Best Word" value={stats.bestWord || '—'} subvalue={stats.bestWordScore ? `${stats.bestWordScore} pts` : undefined} />
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
        <h2 className="text-xl font-semibold mb-4">Last Played</h2>
        <div className="text-center p-4 text-gray-700">
          {stats.lastPlayed ? stats.lastPlayed : '—'}
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