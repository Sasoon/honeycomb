# WAXLE

A daily word game on a honeycomb. Spell words on a 19-tile hex board while a flood of letters pours in from the top. Clear space fast enough and you survive another wave. When a letter has nowhere to land, the run is over.

Play at https://waxle.netlify.app

## How to play

- **Build words.** Tap tiles in order, each touching the last, to spell a word of 3+ letters. Once per word you may leap to a tile two steps away; a line threads the word letter to letter from a start dot, a leap shows as an arc over the tile it skips, and tiles the word can't reach next fade back. Every tile shows its Scrabble value; a word scores its letter total ×2 at 5–6 letters and ×3 at 7+.
- **Gold tiles** arrive in some waves and double any word that uses them (two make it ×4).
- **The flood.** Submitting a word or passing ends your turn. The tiles under **NEXT** then drop in and sink as deep as they can. Waves start at 3 tiles and grow by one every 3 waves. If the next wave won't fit, NEXT turns red and warns you.
- **Spin.** Tap one tile, then drag around it (or scroll, or use ←/→ and Enter) to rotate its neighbours. Every turn brings a free spin and an unused one carries over (hold up to 2); each spin beyond the free ones adds one tile to that turn's wave only.
- **Out-spell the flood.** A word at least as long as the NEXT row shrinks that wave by one.
- **Daily vs practice.** The daily gives everyone the same tiles and 3 turn undos (spin undos are free). After the run you can share an emoji summary and post your score to the leaderboard. Practice is a random board with unlimited undos.

Keyboard: Enter submits, Backspace drops the last letter, Esc clears, Ctrl/⌘+Z undoes. Sound can be muted from the speaker icon.

## Development

```bash
npm install
npm run dev        # Vite dev server on :5173
npm run build      # typecheck + production build
npm run lint
npm run test:e2e   # Playwright smoke tests (needs the dev server running)
```

Leaderboard functions live in `netlify/functions` and run under `netlify dev`. See `docs/claude.md` for how the blob stores work.

### Layout

- `src/pages/OrbitGame.tsx`: the game screen (input, spin dial, animation, persistence)
- `src/lib/orbit.ts`: pure game logic and tuning (board, flood placement, scoring, seeded per-wave tile streams, stats, sharing)
- `src/lib/sfx.ts`: synthesized WebAudio sound effects
- `src/components/orbit/`: help and results dialogs
- `public/dictionary.txt`: word list, built by `npm run build:dictionary`

The classic game (`WaxleGame.tsx`, `DailyChallenge.tsx` and the zustand store) is still in the source tree but no longer routed.
