import { Zap } from 'lucide-react';

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
          {/* Swap Mechanic */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div>
              <h3 className="text-lg font-medium text-text-primary mb-3 flex items-center">
                <Zap className="w-5 h-5 text-amber mr-2" />
                Swap System
              </h3>
              <div className="space-y-2 text-text-secondary">
                <p>When you have swaps available, click any placed tile to select it (it will glow green), then click another placed tile to swap their letters. Click the same tile again to cancel.</p>
                <p className="text-sm">Swaps trigger gravity - tiles will settle after swapping!</p>
              </div>
            </div>
            <div className="bg-secondary/10 rounded-lg p-2 text-center flex items-center justify-center min-h-[15rem]">
              <div className="text-text-secondary italic">
                Swap any two tiles to create new word opportunities
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Clear Bonus Mechanic */}
      <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 rounded-lg shadow-lg border border-amber-500/30 p-6 section-spacing">
        <h2 className="text-xl font-semibold mb-4 text-text-primary flex items-center">
          <span className="w-5 h-5 text-amber-500 mr-2">⚡</span>
          Auto-Clear Bonus Mechanic
        </h2>
        <div className="space-y-4 text-text-secondary">
          <p className="text-lg">
            After new tiles flood the board, WAXLE automatically scans for bonus words across <span className="font-semibold text-amber-500">all 6 axes</span> of the hex grid.
          </p>
          <div className="bg-bg-primary/50 rounded p-4 space-y-2">
            <p><span className="font-semibold text-amber-500">✓</span> All valid 3+ letter words found on any axis are automatically cleared!</p>
            <p><span className="font-semibold text-amber-500">✓</span> Each auto-cleared word grants <span className="font-semibold text-text-primary">+1 swap</span></p>
            <p><span className="font-semibold text-amber-500">✓</span> Words clear sequentially with gravity between each</p>
            <p><span className="font-semibold text-amber-500">✓</span> Highlighted in <span className="text-amber-500 font-semibold">orange</span> as they clear</p>
          </div>
          <p className="text-sm italic">This reward system encourages strategic placement and helps you accumulate swaps for tough situations!</p>
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
              Scoring
            </h3>
            <div className="space-y-2 text-text-secondary">
              <p>3+ letter words only score.</p>
              <p>Each letter is worth <span className="font-semibold text-text-primary">2 points</span>.</p>
              <p>Creativity bonus: +1 for each extra tile-to-tile connection your word makes (max +4).</p>
              <p>That's it — add them up as you play.</p>
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
            <h3 className="font-medium text-text-primary mb-3">Scoring System</h3>
            <ul className="space-y-2 text-text-secondary text-sm">
              <li>• 3+ letters to score</li>
              <li>• Score per word = 2 × letters + creativity bonus (max +4)</li>
              <li>• No multipliers — fully additive and predictable</li>
              <li>• Example: 5-letter word with 2 extra connections = 12 points</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-text-primary mb-3">Pro Tips</h3>
            <ul className="space-y-2 text-text-secondary text-sm">
              <li>• Plan ahead - look at the next tile preview</li>
              <li>• Every swap triggers gravity - tiles settle immediately!</li>
              <li>• You start with 1 swap and swaps accumulate across rounds</li>
              <li>• Auto-clears grant bonus swaps - create axis-aligned words!</li>
              <li>• Focus on clearing the top of the board</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowToPlay; 