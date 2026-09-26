import { Link } from 'react-router-dom';
import { RefreshCw, Waves, Type, Scissors, CalendarDays, Undo2, Gem } from 'lucide-react';
import { DAILY_UNDOS, WAVE_GROWTH_EVERY, WAVE_START } from '../lib/orbit';

const VALUE_GROUPS: Array<[string, number]> = [
  ['A E I O U L N R S T', 1],
  ['D G', 2],
  ['B C M P', 3],
  ['F H V W Y', 4],
  ['K', 5],
  ['J X', 8],
  ['Q Z', 10],
];

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
        <p className="text-text-secondary mb-4">
          <span className="font-semibold text-amber">Leap:</span> once per word, you may leap from your last tile to any tile two
          steps away. A line threads your word from letter to letter, starting at the dot; a leap shows as an arc hopping
          over the tile it skips. Tiles your word can't reach next fade back, so once the leap is used you'll see only the
          neighbours stay bright.
        </p>
        <p className="text-text-secondary mb-3">
          Every tile shows its letter value, Scrabble style. A word scores the sum of its letters, then
          <span className="font-semibold text-text-primary"> ×2 for 5–6 letters</span> and
          <span className="font-semibold text-text-primary"> ×3 for 7 or more</span>. Rare letters are prizes, not junk.
        </p>
        <div className="flex flex-wrap gap-2 max-w-xl">
          {VALUE_GROUPS.map(([letters, v]) => (
            <div key={letters} className="rounded-xl bg-bg-primary border border-secondary/40 px-3 py-1.5 text-center">
              <div className="text-xs font-mono tracking-wider text-text-secondary">{letters}</div>
              <div className="text-sm font-bold text-amber tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        <p className="text-sm text-text-secondary mt-3">
          Example: <span className="font-mono font-semibold text-text-primary">PLANTED</span> is 3+1+1+1+1+1+2 = 10 points, ×3 for seven letters = <span className="font-bold text-amber">30</span>.
        </p>
        <p className="text-sm text-text-muted mt-3">
          Tap the last tile again to drop it, an earlier tile to trim back to it, or the first tile to start over.
        </p>
      </div>

      <div className={card}>
        <h2 className="text-xl font-semibold mb-3 text-text-primary flex items-center gap-2">
          <Gem className="w-5 h-5 text-gold" /> Gold tiles
        </h2>
        <p className="text-text-secondary">
          Some waves carry a <span className="font-semibold text-gold">gold tile</span> (you'll see it gold in NEXT before it lands).
          Any word that uses it scores double; two gold tiles make it ×4. They stay on the board until you use them,
          so a gold tile is worth steering toward with a spin.
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
          Waves start at {WAVE_START} tiles and grow by one every {WAVE_GROWTH_EVERY} waves, so the pressure keeps building.
          If the next wave won't fit, NEXT turns red and warns you. Clear space or the run ends.
        </p>
      </div>

      <div className={card}>
        <h2 className="text-xl font-semibold mb-3 text-text-primary flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-amber" /> Spin
        </h2>
        <p className="text-text-secondary mb-3">
          Tap a single tile and its neighbours start to wiggle. Drag around it to rotate that ring of letters
          (on a computer you can also scroll or use the arrow keys, then press Enter). Spinning doesn't end your turn,
          so you can line up a word and then submit it.
        </p>
        <p className="text-text-secondary">
          <span className="font-semibold text-text-primary">Every turn brings a free spin, and an unused one carries over</span> (you
          can hold two). Every spin beyond your free ones adds one tile to the wave about to drop (only that wave). Save a
          spin to line up a two-spin word next turn, or spend an extra one when the word is worth a tile.
        </p>
      </div>

      <div className={card}>
        <h2 className="text-xl font-semibold mb-3 text-text-primary flex items-center gap-2">
          <Scissors className="w-5 h-5 text-amber" /> Out-spell the flood
        </h2>
        <p className="text-text-secondary">
          Submit a word at least as long as the NEXT row and that wave shrinks by one tile before it drops.
          Long words score more and also ease the pressure. It's the only way to shrink a wave.
        </p>
      </div>

      <div className={card}>
        <h2 className="text-xl font-semibold mb-3 text-text-primary flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-amber" /> Daily & practice
        </h2>
        <ul className="space-y-2 text-text-secondary">
          <li>• <span className="font-semibold text-text-primary">Daily:</span> everyone gets the same starting board and the same tiles. One run per day, then share your result and post it to the leaderboard.</li>
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
          <li>• Check NEXT before you move: a word as long as the wave shrinks it, and gold tiles show up there first.</li>
          <li>• Keep the top row open. A clear path down from the top keeps you alive.</li>
          <li>• Plurals and endings (-S, -ED, -ER, -ING) turn a 4-letter word into a 6-letter one.</li>
          <li>• A Q, Z, J or X in a 5-letter word is worth more than most 7-letter words. Use them, don't bury them.</li>
          <li>• A free spin costs nothing and often turns a 4-letter word into a 5. If you don't need it, save it: two spins can build a 7.</li>
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
