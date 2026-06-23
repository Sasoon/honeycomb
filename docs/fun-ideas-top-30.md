# Waxle Orbit — Top 30 Ideas to Make It Fun

A curated ranking from a 6-agent design swarm (Tetris DNA · Wordle DNA · Game-feel/juice ·
Progression/retention · Mechanical depth · Onboarding/clarity). Ideas that surfaced
independently from multiple lenses are marked ⭐ (convergence = high confidence).

**The north star:** Tetris is fun because of *escalating pressure + a disproportionate payoff
for the hard play (the Tetris) + flow*. Wordle is fun because of *a daily ritual + a
spoiler-free, comparable, shareable result + a humane streak*. Waxle Orbit's unique soul is
the **spin → word → flood** economy. The best ideas sharpen that core, make its hidden
causality visible, and add a sensory + social skin.

Ratings: **Fun** 1–5 (player impact), **Effort** 1–5 (build cost). Tier = recommended order.

---

## TIER 1 — Ship first (high fun, low effort, mostly additive edits to `submit`/`afterAction`)

### 1. ⭐ Audio engine (the missing sense)
The game has **zero sound** — the single biggest perceived-quality gap. A new `src/lib/audio.ts`
mirroring the `haptics` module (lazy `AudioContext`, master gain, localStorage mute, pure
oscillator synthesis — no asset files). Fire `audio.*` right beside every existing `haptics.*`
call: tile-tap, word submit, spin detent, flood splash, game-over. **Fun 5 · Effort 3**
*DNA: Tetris/Bejeweled live on the click.*

### 2. ⭐ Rising-pitch word build
Each tile you add to a selection plays the next note up a pentatonic scale; a valid submit
resolves to a chord. Built-in escalation — longer words literally sound more triumphant.
Hook into `handleCellTap`. **Fun 5 · Effort 2**

### 3. ⭐ The "Tetris" payoff — long-word jackpot
Right now a 3-letter and an 8-letter clear feel identical. Tier the entire feedback bundle by
`selected.length`: 3–4 standard pop; 5–6 brighter burst + flash + richer haptic; 7–8 a named,
screen-shaking **"WAXLE!"** event that cools the flood by **2**. Single branch in `submit`.
**Fun 5 · Effort 3** *DNA: the 4-line Tetris — outsized reward for the hardest play.*

### 4. ⭐ Overspell surplus — turn the cliff into a gradient
Cooling is currently binary (`word ≥ meter → −1`). Make it `cool = 1 + floor((len − meter)/2)`,
clamped to the floor. Beating a meter-4 flood with a 7-letter word pushes it back 2. One-line
change to the `cooled` calc + show `🌊↓2`. **Fun 4 · Effort 1**

### 5. ⭐ Sweep bonus (honor the dead stat)
`OrbitStats.sweeps` is defined but **never incremented and never shown**. Define a sweep =
`submit` leaves the board empty; award +10, reset meter to floor, fire a full-screen "SWEEP",
bump `sweeps`, prefix the share strip with 🌟. **Fun 4 · Effort 2** *DNA: Tetris Perfect Clear.*

### 6. ⭐ "Cool the flood" button + length bar
The single most important moment (a word ≥ meter) is buried under a generic "Submit". When
`match && selected.length >= meter`, swap the label to **"Cool the flood ✓"** and pulse it gold.
Add a tiny `{len}/{meter}` filling bar on the Current cluster so players see the bar *before*
hitting it. **Fun 4 · Effort 1–2** *DNA: Wordle-grade legible feedback at the decision point.*

### 7. ⭐ Relabel NEXT as the threat
The `nextWindow` chips sit under a silent "NEXT" tab. New players never learn the meter *is* the
next wave's size. Relabel to **"NEXT WAVE — spell this long to cool it · {meter}"**. Pure copy.
**Fun 4 · Effort 1**

### 8. ⭐ Personal-best celebration
At game-over, compare `score` to prior `bestDaily`; if it's a PB, fire confetti + haptic and swap
the modal headline to **"New best! +N over your record."** Near-free, big retention spike.
**Fun 4 · Effort 1**

### 9. Outspell score kicker
A word ≥ meter only cools — it gives no *scoring* reward for the risk. Add
`+(len − meter + 1)·2` and tag the floater "OUTSPELL". Additive in `submit`. **Fun 4 · Effort 1**

### 10. Causal floaters — "🌊 +1"
Spins and passes grow the flood silently. Float a small **"🌊 +1"** by the meter on
`commitRotation` and `endTurn` (reusing the `scoreFx` machinery), mirroring the existing `🌊↓`.
Makes the hidden cost felt. **Fun 4 · Effort 2**

---

## TIER 2 — Core depth (the spin→word→flood soul; touch `submit`/`commitRotation`/`endTurn`)

> ⚠️ Cross-cutting rule: every new state var must be added to `Snapshot`, `takeSnapshot`,
> `undo`, and the `LS_RUN` blob, or undo/resume desyncs. And ideas 11–14 all add cooling/score —
> stack no more than two without dropping `meterFloor`'s divisor from 4→3, or the flood stops
> being scary.

### 11. ⭐ Combo chain (kill the "pass-to-fish" meta)
Consecutive word-turns build a combo; a pass resets it. Each word scores `wordPoints + combo`;
at combo ≥3 the next word cools an extra 1. Surfaced as a "🔥 ×3" pill near the score.
**Fun 5 · Effort 2** *DNA: Tetris back-to-back / combo.*

### 12. ⭐ Spin-then-spell "Assist" bonus
Makes the spin tax pay off *this turn*. If a word uses ≥2 tiles that the most recent spin moved,
award an "ASSIST" bonus (`commitRotation` already knows the moved ring cells — stash their IDs).
The signature "I'm a genius" sequence. **Fun 5 · Effort 2** *DNA: Tetris T-spin hidden depth.*

### 13. Spin credits — give spinning an economy
Every word ≥5 letters grants 1 spin credit (cap 2). A spin spends a credit instead of growing
the flood, when available. Turns spins from pure regret into planned investment. Show "🔄×N".
**Fun 5 · Effort 2**

### 14. ⭐ Cascade clears (wire the dormant code)
`getAllAxisLines` + `findValidWordsInLines` already exist in `waxleGameUtils.ts` but are **never
called**. After a word clears and gravity settles, any straight-axis line that incidentally
spells a 4+ word auto-clears for bonus. Must fully resolve before `afterAction` floods (undo/seed
determinism). **Fun 5 · Effort 3** *DNA: Tetris cascade combos.*

### 15. ⭐ Next-wave ghost preview (honest landing telegraph)
`orbitFlood` is pure/deterministic — speculatively run it with `nextWindow` to get the exact
landing cells, and render those letters as faint ghosts in the real top-row cells. Players plan
around incoming pressure instead of committing blind. **Fun 5 · Effort 3** *DNA: Tetris next-queue
+ ghost piece.*

### 16. Sharpen the length curve
`wordPoints` is gently convex. Add `+5·(len−6)` for 7–8 letter words (7: 16→21, 8: 20→30) so the
hard finds feel legendary. One-line edit. **Fun 4 · Effort 1** *(rescales leaderboard expectations.)*

### 17. Hold slot
One tile per game can be lifted off-board into a "hold" and dropped back into any reachable cell
later — a scarce, deliberate relief valve (charge +1 meter to keep the ratchet honest).
**Fun 4 · Effort 4** *DNA: Tetris hold piece.*

### 18. Revive a special tile: Double-Score hotspot
1–2 positional `2×` cells; a word whose path crosses one doubles its points. Because the mark
stays on the cell, *spinning a great rack onto it* fuses both verbs around a spatial goal. (Store
by row,col so it survives gravity.) **Fun 4 · Effort 3** *DNA: from the original README, dropped in Orbit.*

---

## TIER 3 — Sensory escalation & tension (game-feel skin over the existing FX)

### 19. ⭐ Flood-high "danger zone"
Game-over is currently a silent cliff. As row-0/row-1 occupancy crosses a threshold, drive a
`--danger` CSS var: pulsing red vignette, throbbing meter, an escalating low drone/haptic cadence
that quickens as you near the top. **Fun 5 · Effort 3** *DNA: Tetris top-out dread.*

### 20. Word-clear particle burst
Each cleared cell emits 4–6 letter-colored shards that arc out and fall under gravity (reuse the
`clearFx` pattern + WAAPI `el.animate`; particle count tiers off idea 3). **Fun 5 · Effort 3**

### 21. Detent click track + spin whoosh
Pair the dial's existing magnetic detents (`haptics.select`) with a mechanical tick (pitch shifts
with direction) and a velocity-tracked whoosh during drag; commit ends with a "ka-chunk".
**Fun 4 · Effort 2–3**

### 22. Out-spell fanfare
When a word cools the flood, fire a teal shockwave ring from the cluster + a "water recedes" sweep
sound + the Next strip visibly recoiling one chip. Rewards the core intended play. **Fun 4 · Effort 3**

### 23. Game-over crescendo + small screen shake
On loss: a rising water wash over the board, remaining tiles dim/settle, one screen shake, a
descending "drowned" tone, then the modal rises ~600ms later. Flood splashes get a tiny
`waveCount`-scaled shake too (respect `reducedMotion`). **Fun 4 · Effort 3**

### 24. Invalid-word head-shake
A complete-but-invalid selection does a quick horizontal shake + soft "nope" blip +
`haptics.error()` (error haptic is currently only used on game-over). **Fun 3 · Effort 2**

---

## TIER 4 — Wordle ritual, social & retention (extend `OrbitStats` → bump `LS_STATS` to `-v2`)

### 25. ⭐ Spoiler-safe score grid (richer share strip)
The flat `🟩/⏭` strip leaks nothing. Encode each turn's word *length* by shade and tag out-spell
turns with 💧, wrapped to mirror the 19-cell diamond. Store length in `actionLog`. Now the strip
tells a story worth comparing. **Fun 5 · Effort 2** *DNA: Wordle's shareable grid.*

### 26. ⭐ Streak shield (humane streak)
The streak resets on a single missed day. Grant 1 shield per 7-day streak (cap 2): a one-day gap
consumes a shield instead of resetting, shown as 🛡️. Loss-aversion done kindly = far less churn.
**Fun 4 · Effort 2** *DNA: fixes Wordle's brutal reset.*

### 27. ⭐ Run grade (S/A/B/C/D)
A big letter grade on the game-over modal from score-per-wave efficiency + long-word bonus, led in
the share text. "Chase the next letter" beats "chase +40 pts." **Fun 4 · Effort 2**

### 28. ⭐ Stats screen with distribution + calendar heatmap
`OrbitStats` already holds `games/streak/sweeps/results` but there's no lifetime view. Build the
Wordle-style panel: games, current/max streak, sweeps, a **waves-survived histogram**, and a
month **heatmap** colored by each day's grade (the GitHub-graph completionist pull). Pure read of
existing data. **Fun 4 · Effort 3**

### 29. Badges + daily objectives
Client-side achievements (Tsunami: 20+ waves; Wordsmith: 8-letter word; Iron Will: 0 undos;
Centurion: 100 pts) and 3 seed-derived daily objectives ("find a 6+ word", "out-spell 3×") for
⭐ stars. Both hook the single record-effect. **Fun 5 · Effort 3**

### 30. The daily archive + "today's best word" reveal
Lift `dateStr` to settable state (the engine is already seed-parameterized) for a "Tide #N"
stepper to replay past days — archive runs don't credit the live streak. And at game-over, DFS the
opening board against the loaded word set to reveal the longest word that *was* there
("The tide held BREEZIER — did you spot it?") — closure + regret-driven return. **Fun 4 · Effort 3–4**
*DNA: Wordle archive + answer reveal.*

---

## Honorable mentions (didn't crack 30, but cheap & worth it)
- **Fix `HowToPlay.tsx`** — it documents a *different, older game* (Swap button, auto-clear) that
  doesn't exist in Orbit; a new player who reads it will hunt for buttons that aren't there.
- **Colorblind-safe valid/invalid** — red-vs-amber is a deutan confusion pair; add ✓/✕ glyphs.
- **Next-tide countdown** + **active-streak open nudge** — reinforce the daily ritual.
- **XP / mastery tiers**, **weekly challenge w/ modifiers**, **mute & reduced-motion polish**,
  **44px touch-target floor on small phones**, **keyboard tile-selection parity** (spinning is
  already keyboard-operable; spelling isn't).

## Suggested first sprint
**1, 2, 3, 6, 7, 8** (audio + the long-word payoff + exposing the flood economy) deliver the
biggest felt change for the least code, then **11, 12, 15, 19** add the depth and tension that
make people say "just one more."
