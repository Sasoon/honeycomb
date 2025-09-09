const HowToPlay = () => {
  return (
    <div className="page-container page-container--standard">
      <h1 className="page-title">How to Play WAXLE</h1>
      
      <div className="bg-secondary-light rounded-lg shadow-lg border border-secondary p-6 section-spacing">
        <h2 className="text-xl font-semibold mb-4">Quick Start</h2>
        <p className="mb-4">
          Build words with falling letter tiles on a hexagonal grid. Clear tiles to prevent the board from filling up 
          as more tiles drop each round. Survive as long as possible for the highest score!
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-waxle-light rounded-lg p-4">
            <h3 className="font-semibold mb-2">Your Turn</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Select adjacent tiles to form words (3+ letters)</li>
              <li>Submit word to clear tiles and score points</li>
              <li>Use Orbit (2x) to rotate tiles around a pivot</li>
              <li>Use Lock to keep tiles in place during flood</li>
              <li>End turn when ready</li>
            </ul>
          </div>
          <div className="bg-waxle-light rounded-lg p-4">
            <h3 className="font-semibold mb-2">Flood Phase</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>New tiles drop from the top automatically</li>
              <li>Every 5 rounds = +1 more tile (3→4→5...)</li>
              <li>Tiles settle with gravity</li>
              <li>Game over if top row fills completely</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="bg-secondary-light rounded-lg shadow-lg border border-secondary p-6 section-spacing">
        <h2 className="text-xl font-semibold mb-4">Scoring</h2>
        
        <div className="space-y-3 mb-4">
          <div>
            <div className="font-medium">Base Score Formula:</div>
            <p className="text-sm text-text-muted">
              Word Length × (1 + Round × 0.1) + (Tiles Cleared × 10)
            </p>
          </div>
          <div>
            <div className="font-medium">Combo Bonus:</div>
            <p className="text-sm text-text-muted">
              Submit multiple words in one turn for 1.5× multiplier on additional words
            </p>
          </div>
        </div>
        
        <div className="bg-amber/10 border border-amber/20 rounded-lg p-3">
          <p className="text-sm">
            <strong>Example:</strong> 5-letter word in Round 3 = 5 × 1.3 = 6.5 + tile bonus = ~7-17 points
          </p>
        </div>
      </div>
      
      <div className="bg-secondary-light rounded-lg shadow-lg border border-secondary p-6 section-spacing">
        <h2 className="text-xl font-semibold mb-4">Strategy Tips</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-2">Survival</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Keep the top rows clear at all costs</li>
              <li>Clear tiles every turn - don't hoard</li>
              <li>Plan for escalating difficulty</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">High Scores</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Build longer words for exponential gains</li>
              <li>Submit multiple words per turn when possible</li>
              <li>Use Orbit to create better opportunities</li>
              <li>Save Lock for critical situations</li>
            </ul>
          </div>
        </div>
        
        <div className="text-center p-4 bg-waxle-light rounded-lg mt-4">
          <p className="font-semibold">Ready to test your word-building skills? 🧩</p>
        </div>
      </div>
    </div>
  );
};

export default HowToPlay; 