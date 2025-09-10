import { Zap, Lock } from 'lucide-react';

const HowToPlay = () => {
  return (
    <div className="page-container page-container--standard">
      <h1 className="page-title">How to Play WAXLE</h1>
      
      {/* Quick Start */}
      <div className="bg-secondary-light rounded-lg shadow-lg border border-secondary p-6 section-spacing">
        <h2 className="text-xl font-semibold mb-4 text-text-primary">Quick Start</h2>
        <p className="mb-4 text-text-secondary">
          Build words with falling letter tiles on a hexagonal grid. Clear tiles to prevent the board from filling up as more tiles drop each round. Survive as long as possible for the highest score!
        </p>
      </div>

      {/* Game Mechanics with GIF placeholders */}
      <div className="rounded-lg shadow-lg border border-secondary p-6 section-spacing">
        <h2 className="text-xl font-semibold mb-4 text-text-primary">Game Mechanics</h2>
        
        <div className="space-y-8">
          {/* Orbit Mechanic */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div>
              <h3 className="text-lg font-medium text-text-primary mb-3 flex items-center">
                <Zap className="w-5 h-5 text-amber mr-2" />
                Orbit System
              </h3>
              <div className="space-y-2 text-text-secondary">
                <p>Select a tile as a pivot point, click the orbit icon then drag in a circular motion to rotate surrounding tiles. To cancel an active orbit, hover over the orbit icon and release or drag the tiles back to their original position.</p>
              </div>
            </div>
            <div className="bg-secondary/10 rounded-lg p-2 text-center">
              <img 
                src="/tutorial/orbit-demo.gif" 
                alt="Real gameplay demonstration showing tiles orbiting around a selected pivot point"
                className="max-h-60 mx-auto rounded border border-secondary/20"
                style={{ objectFit: 'contain' }}
              />
            </div>
          </div>

          {/* Lock Mechanic */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div className="order-2 lg:order-1">
              <div className="bg-secondary/10 rounded-lg p-2 text-center">
                <img 
                  src="/tutorial/lock-demo.gif" 
                  alt="Real gameplay demonstration showing tile locking mechanism and locked tiles staying in place during gravity"
                  className="max-h-60 mx-auto rounded border border-secondary/20"
                  style={{ objectFit: 'contain' }}
                />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h3 className="text-lg font-medium text-text-primary mb-3 flex items-center">
                <Lock className="w-5 h-5 text-blue-400 mr-2" />
                Tile Locking
              </h3>
              <div className="space-y-2 text-text-secondary">
                <p>Lock tiles in place to prevent them from being affected by orbit. This lets you strategically move specific tiles to form even more words. Click the lock icon on any selected tile to lock it in place - this also works with multiple selections.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scoring & Gameplay */}
      <div className="bg-bg-primary rounded-lg shadow-lg border border-secondary p-6 section-spacing">
        <h2 className="text-xl font-semibold mb-4 text-text-primary">Scoring & Gameplay</h2>
        
        {/* Scoring Demonstration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center mb-8">
          <div>
            <h3 className="text-lg font-medium text-text-primary mb-3 flex items-center">
              <span className="w-5 h-5 text-amber mr-2">🎯</span>
              Scoring System
            </h3>
            <div className="space-y-2 text-text-secondary">
              <p>Your score follows three simple rules that multiply together:</p>
              <p><strong>Length Squared:</strong> Base points equal word length squared (5 letters = 25 points)</p>
              <p><strong>Adjacency Bonus:</strong> Each adjacent edge in your word adds 0.5x multiplier</p>
              <p><strong>Round Multiplier:</strong> Score increases as floods get harder (every 3 rounds)</p>
            </div>
          </div>
          <div className="bg-secondary/10 rounded-lg p-2 text-center">
            <img 
              src="/tutorial/scoring-demo.gif" 
              alt="Real gameplay demonstration showing scoring mechanics and point calculation"
              className="max-h-60 mx-auto rounded border border-secondary/20"
              style={{ objectFit: 'contain' }}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-text-primary mb-3">The Golden Rules</h3>
            <ul className="space-y-2 text-text-secondary text-sm">
              <li>• <strong>Length²:</strong> 4 letters = 16 base points</li>
              <li>• <strong>+0.5x per edge:</strong> Triangle cluster = 2.5x multiplier</li>
              <li>• <strong>Round bonus:</strong> Later rounds = higher multipliers</li>
              <li>• <strong>Example:</strong> 4-letter triangle in round 6 = 16 × 2.5 × 2 = 80 points</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-text-primary mb-3">Pro Tips</h3>
            <ul className="space-y-2 text-text-secondary text-sm">
              <li>• Use orbit to cluster tiles before making words</li>
              <li>• Curved words score much higher than straight lines</li>
              <li>• Look for triangle and L-shaped patterns</li>
              <li>• Late-game scores can be massive - survival pays off!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowToPlay; 