const HowToPlay = () => {
  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4">
      <h1 className="text-3xl font-bold text-center mb-6">How to Play Honeycomb Tetris</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Game Overview</h2>
        <p className="mb-4">
          Honeycomb Tetris is a fast-paced word-building puzzle game where letter tiles fall from above like Tetris blocks. 
          Form words to clear tiles from the board and survive as long as possible as the difficulty increases each round!
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-honeycomb-light rounded-lg p-4">
            <h3 className="font-semibold mb-2">Game Elements</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>5×5 hexagonal grid</li>
              <li>Falling letter tiles (3+ per round)</li>
              <li>Progressive difficulty</li>
              <li>Flood mechanics with cascading placement</li>
              <li>Orbit and Lock special abilities</li>
            </ul>
          </div>
          <div className="bg-honeycomb-light rounded-lg p-4">
            <h3 className="font-semibold mb-2">Special Mechanics</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li><span className="font-medium">Orbit:</span> Rotate tiles around a pivot point</li>
              <li><span className="font-medium">Lock:</span> Prevent tiles from moving during flood</li>
              <li><span className="font-medium">Flood:</span> New tiles cascade down from the top</li>
              <li><span className="font-medium">Gravity:</span> Tiles settle after word clearing</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">How to Play</h2>
        
        <h3 className="font-semibold text-lg mb-2">Player Phase</h3>
        <ol className="list-decimal list-inside mb-6 space-y-2">
          <li>
            <strong>Form Words:</strong> Select tiles on the grid to form words.
            <ul className="list-disc list-inside ml-6 mt-1 text-sm text-gray-700">
              <li>Words must be at least 3 letters long</li>
              <li>Tiles must be connected (adjacent to each other)</li>
              <li>Submit multiple words per turn</li>
            </ul>
          </li>
          <li>
            <strong>Use Special Abilities:</strong> Use Orbit and Lock to manipulate tiles.
            <ul className="list-disc list-inside ml-6 mt-1 text-sm text-gray-700">
              <li>Orbit: Drag to rotate tiles around a pivot point (2 uses per turn)</li>
              <li>Lock: Click to prevent tiles from moving during flood</li>
            </ul>
          </li>
          <li>
            <strong>End Turn:</strong> When ready, end your turn to trigger the flood phase.
          </li>
        </ol>
        
        <h3 className="font-semibold text-lg mb-2">Flood Phase</h3>
        <div className="space-y-3 mb-6">
          <div>
            <div className="font-medium">Automatic Tile Drop</div>
            <p className="text-sm text-gray-700">
              New letter tiles cascade from the top of the grid. The number of tiles increases each round (3 → 4 → 5 → 6 max).
            </p>
          </div>
          <div>
            <div className="font-medium">Gravity & Settling</div>
            <p className="text-sm text-gray-700">
              Tiles fall down and settle in available spaces. Locked tiles stay in place while others move around them.
            </p>
          </div>
        </div>
        
        <h3 className="font-semibold text-lg mb-2">Scoring</h3>
        <ul className="list-disc list-inside mb-6 space-y-1">
          <li><strong>Base Score:</strong> Points based on word length and round multiplier</li>
          <li><strong>Combo Bonus:</strong> Extra points for multiple words in one turn</li>
          <li><strong>Round Bonus:</strong> Score increases with higher rounds</li>
          <li><strong>Tile Clear Bonus:</strong> Bonus for clearing more tiles at once</li>
        </ul>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Game Over & Strategy</h2>
        <p className="mb-4">
          The game ends when new tiles can't fit on the board. Your goal is to survive as many rounds as possible
          while building the highest score. Use strategy to manage board space and create powerful word combinations!
        </p>
        
        <h3 className="font-semibold text-lg mb-2">Tips for Success</h3>
        <ul className="list-disc list-inside mb-4 space-y-1">
          <li>Clear tiles regularly to prevent the board from filling up</li>
          <li>Use Lock strategically to create stable word-building foundations</li>
          <li>Orbit tiles to create better word opportunities</li>
          <li>Submit multiple words per turn for combo bonuses</li>
          <li>Plan ahead for the increasing tile count each round</li>
        </ul>
        
        <div className="text-center p-4 bg-honeycomb-light rounded-lg">
          <p className="font-semibold">Good luck surviving the Tetris flood!</p>
        </div>
      </div>
    </div>
  );
};

export default HowToPlay; 