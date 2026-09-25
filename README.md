# WAXLE

A daily word game on a honeycomb. Spell words on a 19-tile hex board while a flood of letters pours in from the top. Clear space fast enough and you survive another wave. When a letter has nowhere to land, the run is over.

Play at https://waxle.netlify.app

## How to play

- **Build words.** Tap tiles in order, each touching the last, to spell a word of 3+ letters. Longer words score much more: 3→3, 4→4, 5→7, 6→10, 7→13, 8→16 (+2 per letter beyond 4).
- **The flood.** Submitting a word or passing ends your turn. The letters under **NEXT** then drop in and sink as deep as they can.
- **Spin.** Tap one tile, then drag around it (or scroll, or use ←/→ and Enter) to rotate its neighbours. Spins are free and don't end the turn, but each one makes every later wave one tile bigger, permanently. Passing does the same.
- **Out-spell the flood.** A word at least as long as the NEXT row shrinks that wave by one. The minimum wave size starts at 3 and rises every 4 waves.
- **Daily vs practice.** The daily gives everyone the same letters and 3 turn undos (spin undos are free). After the run you can share an emoji summary and post your score to the leaderboard. Practice is a random board with unlimited undos.

Keyboard: Enter submits, Backspace drops the last letter, Esc clears, Ctrl/⌘+Z undoes.

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
- `src/lib/orbit.ts`: pure game logic (board, flood placement, seeded per-wave letter streams, stats, sharing)
- `src/components/orbit/`: help and results dialogs
- `public/dictionary.txt`: word list, built by `npm run build:dictionary`

The classic game (`WaxleGame.tsx`, `DailyChallenge.tsx` and the zustand store) is still in the source tree but no longer routed.
