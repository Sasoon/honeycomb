import { Link } from 'react-router-dom';
import { RefreshCw, Waves, Type, Scissors, CalendarDays, Undo2 } from 'lucide-react';
import { DAILY_UNDOS, METER_START, wordPoints } from '../lib/orbit';

const card = 'rounded-2xl border border-secondary/40 bg-bg-secondary/60 p-6 section-spacing';

const HowToPlay = () => {
  return (
    <div className="page-container page-container--standard">
      <h1 className="page-title">How to Play WAXLE</h1>

      <div className={card}>
        <p className="text-text-secondary text-lg">
          Spell words on a honeycomb of 19 tiles while a flood of letters pours in from the top.
          Every turn, clear what you can, and when a letter has nowhere left to land, the game is over.
          Score as much as you can before the board fills.
        </p>
      </div>

      <div className={card}>
        <h2 className="text-xl font-semibold mb-3 text-text-primary flex items-center gap-2">
          <Type className="w-5 h-5 text-amber" /> Build words
        </h2>
        <p className="text-text-secondary mb-4">
          Tap tiles one at a time. Each tile must touch the one before it, and the letters must spell a word in
          that order, 3 letters or more. Valid words light up; press <span className="font-semibold text-text-primary">Submit</span> to
          score them. The tiles vanish and everything above them slides down.
        </p>
        <p className="text-text-secondary mb-3">Long words are worth much more than several short ones:</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-w-lg">
          {[3, 4, 5, 6, 7, 8].map(n => (
            <div key={n} className="rounded-xl bg-bg-primary border border-secondary/40 py-2 text-center">
              <div className="text-xs uppercase tracking-wide text-text-muted">{n} letters</div>
              <div className="text-lg font-bold text-amber tabular-nums">+{wordPoints(n)}</div>
            </div>
          ))}
        </div>
        <p className="text-sm text-text-muted mt-3">
          Tap the last tile again to drop it, an earlier tile to trim back to it, or the first tile to start over.
        </p>
      </div>

      <div className={card}>
        <h2 className="text-xl font-semibold mb-3 text-text-primary flex items-center gap-2">
          <Waves className="w-5 h-5 text-amber" /> The flood
        </h2>
        <p className="text-text-secondary mb-3">
          Submitting a word or pressing <span className="font-semibold text-text-primary">Pass</span> ends your turn. Then the
          letters shown under <span className="font-semibold text-amber">NEXT</span> drop in from the top row and sink as deep
          as they can. You always know exactly what's coming.
        </p>
        <p className="text-text-secondary">
          The first wave is {METER_START} tiles. The smallest a wave can get starts at 3 and rises by one every 4 waves,
          so the pressure keeps building.
        </p>
      </div>

      <div className={card}>
        <h2 className="text-xl font-semibold mb-3 text-text-primary flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-amber" /> Spin
        </h2>
        <p className="text-text-secondary mb-3">
          Tap a single tile and its neighbours start to wiggle. Drag around it to rotate that ring of letters
          (on a computer you can also scroll or use the arrow keys, then press Enter). Spinning is free and doesn't
          end your turn, so you can line up a word and then submit it.
        </p>
        <p className="text-text-secondary">
          The catch: <span className="font-semibold text-text-primary">every spin makes each later wave one tile bigger, for good.</span> Passing
          does the same. Spin when it wins you a big word, not to go fishing.
        </p>
      </div>

      <div className={card}>
        <h2 className="text-xl font-semibold mb-3 text-text-primary flex items-center gap-2">
          <Scissors className="w-5 h-5 text-amber" /> Out-spell the flood
        </h2>
        <p className="text-text-secondary">
          Submit a word at least as long as the NEXT row and that wave shrinks by one tile before it drops.
          Long words score more and also ease the pressure. It's the only way to shrink the flood.
        </p>
      </div>

      <div className={card}>
        <h2 className="text-xl font-semibold mb-3 text-text-primary flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-amber" /> Daily & practice
        </h2>
        <ul className="space-y-2 text-text-secondary">
          <li>• <span className="font-semibold text-text-primary">Daily:</span> everyone gets the same starting board and the same letters. One run per day, then share your result and post it to the leaderboard.</li>
          <li className="flex gap-1">
            <span>•</span>
            <span>
              <Undo2 className="inline w-4 h-4 mr-1 text-amber" />
              <span className="font-semibold text-text-primary">Undo:</span> undoing a spin is always free. In the daily you can take back {DAILY_UNDOS} turns, and the letters will be the same when you replay them.
            </span>
          </li>
          <li>• <span className="font-semibold text-text-primary">Practice:</span> a fresh random board every game, with unlimited undos.</li>
        </ul>
      </div>

      <div className={card}>
        <h2 className="text-xl font-semibold mb-3 text-text-primary">Tips</h2>
        <ul className="space-y-2 text-text-secondary">
          <li>• Check NEXT before you move: a word that matches the wave's length keeps it from growing.</li>
          <li>• Keep the top row open. A clear path down from the top keeps you alive.</li>
          <li>• Plurals and endings (-S, -ED, -ER, -ING) turn a 4-letter word into a 6-letter one.</li>
          <li>• One spin that sets up a 6-letter word pays for itself; three spins for a 4-letter word don't.</li>
          <li>• Keyboard: Enter submits, Backspace drops the last letter, Esc clears, Ctrl/⌘+Z undoes.</li>
        </ul>
      </div>

      <div className="text-center pb-8">
        <Link to="/" className="inline-flex h-12 px-8 items-center rounded-xl bg-amber text-bg-primary font-semibold">
          Play today's daily
        </Link>
      </div>
    </div>
  );
};

export default HowToPlay;
