const HowToPlay = () => {
  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4">
      <h1 className="text-3xl font-bold text-center mb-6">How to Play Honeycomb</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Game Overview</h2>
        <p className="mb-4">
          Honeycomb is a single-player word-building puzzle game played on a grid of interlocking 
          hexagonal tiles. Your goal is to strategically place letter tiles to form words along 
          connected paths, maximizing your score while aiming to reach the target score of 100 points 
          in the fewest turns possible.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-honeycomb-light rounded-lg p-4">
            <h3 className="font-semibold mb-2">Components</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>A 5×5 hexagonal grid (honeycomb pattern)</li>
              <li>100 letter tiles in four frequency types</li>
              <li>Player's hand of 5 tiles</li>
              <li>Special mechanics: Reshuffle, Double Score</li>
            </ul>
          </div>
          <div className="bg-honeycomb-light rounded-lg p-4">
            <h3 className="font-semibold mb-2">Tile Distribution</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li><span className="font-medium">Common (61 tiles):</span> E, A, I, O, N, R, T, L, S, U</li>
              <li><span className="font-medium">Medium (26 tiles):</span> D, G, B, C, M, P, F, H, V, W, Y</li>
              <li><span className="font-medium">Uncommon (9 tiles):</span> K, J, X</li>
              <li><span className="font-medium">Rare (4 tiles):</span> Q, Z</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Game Rules</h2>
        
        <h3 className="font-semibold text-lg mb-2">Game Loop</h3>
        <ol className="list-decimal list-inside mb-6 space-y-2">
          <li>
            <strong>Placement Phase:</strong> Place 2 letter tiles from your hand onto empty hexes.
            <ul className="list-disc list-inside ml-6 mt-1 text-sm text-gray-700">
              <li>Each tile must be adjacent to at least one existing tile</li>
              <li>No need to form a valid word during placement</li>
            </ul>
          </li>
          <li>
            <strong>Scoring Phase:</strong> Trace a connected path through tiles to form a word.
            <ul className="list-disc list-inside ml-6 mt-1 text-sm text-gray-700">
              <li>Words must be at least 3 letters long</li>
              <li>Must follow a connected path through adjacent hexes</li>
              <li>No tile can be reused within the same word</li>
              <li>Each unique word path can be scored only once per game</li>
            </ul>
          </li>
          <li>
            <strong>Draw Phase:</strong> Draw tiles to maintain a hand of 5 (if tiles are available)
          </li>
        </ol>
        
        <h3 className="font-semibold text-lg mb-2">Special Mechanics</h3>
        <div className="space-y-3 mb-6">
          <div>
            <div className="font-medium">Cursed Word</div>
            <p className="text-sm text-gray-700">
              A hidden word gradually revealed as you form related words. The first letter is shown at 
              the start. As you form words with matching prefixes, more letters are revealed. Forming 
              the complete Cursed Word deducts points!
            </p>
          </div>
          <div>
            <div className="font-medium">Reshuffle System</div>
            <p className="text-sm text-gray-700">
              Discard your hand for 5 new tiles at an escalating cost: 2 → 4 → 8 points.
            </p>
          </div>
          <div>
            <div className="font-medium">Double Score Tiles</div>
            <p className="text-sm text-gray-700">
              Two special hexes on the grid double your word score when included in a word path.
              Each can only be used once per game.
            </p>
          </div>
        </div>
        
        <h3 className="font-semibold text-lg mb-2">Scoring</h3>
        <ul className="list-disc list-inside mb-6 space-y-1">
          <li><strong>Base Score:</strong> 1 point per letter in the word</li>
          <li><strong>Double Letter Bonus:</strong> +2 points for words with consecutive identical letters</li>
          <li><strong>Double Score Bonus:</strong> 2x points when a Double Score tile is used</li>
          <li><strong>Adjacency Bonus:</strong> +1 point for letters connected to more than 2 others</li>
        </ul>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Winning the Game</h2>
        <p className="mb-4">
          The game ends when you reach a score of 100 points. Your objective is to achieve this
          score in as few turns as possible, emphasizing efficiency and strategic planning.
        </p>
        <div className="text-center p-4 bg-honeycomb-light rounded-lg">
          <p className="font-semibold">Good luck and happy word building!</p>
        </div>
      </div>
    </div>
  );
};

export default HowToPlay; 