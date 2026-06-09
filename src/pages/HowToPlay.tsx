import { ArrowLeftRight, Zap } from 'lucide-react';

const HowToPlay = () => {
  return (
    <div className="page-container page-container--standard">
      <h1 className="page-title">How to Play WAXLE</h1>

      {/* Quick Start */}
      <div className="bg-secondary-light rounded-lg shadow-lg border border-secondary p-6 section-spacing">
        <h2 className="text-xl font-semibold mb-4 text-text-primary">Quick Start</h2>
        <p className="mb-4 text-text-secondary">
          Letter tiles drop onto a hexagonal board. Tap adjacent tiles to spell words, submit them to clear those tiles, and keep the board from filling up as more tiles flood in every round. When the top row is full, the game is over — survive as long as you can for the highest score!
        </p>
      </div>

      {/* The Round Loop */}
      <div className="rounded-lg shadow-lg border border-secondary p-6 section-spacing">
        <h2 className="text-xl font-semibold mb-4 text-text-primary">The Round Loop</h2>
        <ol className="list-decimal list-inside space-y-3 text-text-secondary">
          <li>
            <span className="font-medium text-text-primary">Trace a word.</span> Tap tiles one by one — each tile must touch the previous one. Valid words (3+ letters) light up <span className="text-amber font-semibold">gold</span>; invalid ones turn dark.
          </li>
          <li>
            <span className="font-medium text-text-primary">Submit it.</span> Submitting scores the word, clears its tiles, lets the rest settle, and drops the next wave of tiles. Submitting is your turn — make it count!
          </li>
          <li>
            <span className="font-medium text-text-primary">Or pass.</span> No good word? Hit <span className="font-semibold">End Turn</span> to skip straight to the next drop.
          </li>
          <li>
            <span className="font-medium text-text-primary">Plan ahead.</span> The <span className="font-semibold text-amber">NEXT</span> panel always shows exactly which letters drop next — and the waves get bigger as rounds go on.
          </li>
        </ol>
        <p className="mt-4 text-sm italic text-text-secondary">
          If the entire top row is occupied, no new tiles can enter and the game ends.
        </p>
      </div>

      {/* Swap System */}
      <div className="rounded-lg shadow-lg border border-secondary p-6 section-spacing">
        <h2 className="text-xl font-semibold mb-4 text-text-primary flex items-center">
          <ArrowLeftRight className="w-5 h-5 text-amber mr-2" />
          Swap System
        </h2>
        <div className="space-y-2 text-text-secondary">
          <p>
            Stuck one letter short? Press the <span className="font-semibold text-text-primary">Swap</span> button (it shows how many swaps you have), then tap any two tiles to exchange their letters.
          </p>
          <p>Swaps trigger gravity — tiles settle after swapping, so think before you swap!</p>
          <p className="text-sm">
            You start with 1 swap. Earn more from auto-clears, and unused swaps carry over between rounds. Press the Swap button again to cancel swap mode.
          </p>
        </div>
      </div>

      {/* Auto-Clear Bonus Mechanic */}
      <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 rounded-lg shadow-lg border border-amber-500/30 p-6 section-spacing">
        <h2 className="text-xl font-semibold mb-4 text-text-primary flex items-center">
          <Zap className="w-5 h-5 text-amber-500 mr-2" />
          Auto-Clear Bonus Mechanic
        </h2>
        <div className="space-y-4 text-text-secondary">
          <p className="text-lg">
            After new tiles flood the board, WAXLE automatically scans for bonus words along <span className="font-semibold text-amber-500">straight lines</span> of the hex grid.
          </p>
          <div className="bg-bg-primary/50 rounded p-4 space-y-2">
            <p><span className="font-semibold text-amber-500">✓</span> Valid 3+ letter words found on any line are automatically cleared!</p>
            <p><span className="font-semibold text-amber-500">✓</span> Each auto-cleared word grants <span className="font-semibold text-text-primary">+1 swap</span></p>
            <p><span className="font-semibold text-amber-500">✓</span> Words clear sequentially with gravity between each</p>
            <p><span className="font-semibold text-amber-500">✓</span> Highlighted in <span className="text-amber-500 font-semibold">orange</span> as they clear</p>
          </div>
          <p className="text-sm italic">Set up lines deliberately — auto-clears buy you board space and stockpile swaps for tough situations!</p>
        </div>
      </div>

      {/* Scoring & Gameplay */}
      <div className="bg-bg-primary rounded-lg shadow-lg border border-secondary p-6 section-spacing">
        <h2 className="text-xl font-semibold mb-4 text-text-primary">Scoring &amp; Gameplay</h2>

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
              <p>Creativity bonus: +1 for each <em>extra</em> connection between tiles in your word, beyond the path itself (max +4). Compact, folded words score more than straight lines!</p>
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
              <li>• Example: a straight 5-letter word = 10 points; the same 5 letters folded with 2 extra connections = 12 points</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-text-primary mb-3">Pro Tips</h3>
            <ul className="space-y-2 text-text-secondary text-sm">
              <li>• Plan ahead — the NEXT preview shows exactly what drops next</li>
              <li>• Every swap triggers gravity — tiles settle immediately!</li>
              <li>• Swaps accumulate across rounds, so save them for emergencies</li>
              <li>• Auto-clears grant bonus swaps — line up words deliberately!</li>
              <li>• Keep the top of the board clear at all costs</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowToPlay;
