import { useWaxleGameStore } from '../store/waxleGameStore';

const Stats = () => {
  const { score, totalWords, round, longestWord, tilesCleared } = useWaxleGameStore();
  
  return (
    <div className="page-container page-container--narrow">
      <h1 className="page-title">Game Statistics</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 section-spacing">
        <StatCard label="Current Score" value={score.toString()} />
        <StatCard label="Words Found" value={totalWords.toString()} />
        <StatCard label="Round" value={round.toString()} />
        <StatCard label="Longest Word" value={longestWord || '—'} />
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6 section-spacing">
        <h2 className="text-xl font-semibold mb-4">Game Progress</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Tiles Cleared</h3>
            <div className="flex items-center">
              <div className="text-4xl font-bold text-waxle-dark">{tilesCleared}</div>
              <div className="ml-2 text-sm text-gray-600">tiles</div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Current Round</h3>
            <div className="flex items-center">
              <div className="text-4xl font-bold text-green-600">{round}</div>
              <div className="ml-2 text-sm text-gray-600">rounds</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Game Info</h2>
        <div className="text-center p-4 text-gray-700">
          This shows your current Tetris game progress. Start a new game from the main page!
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