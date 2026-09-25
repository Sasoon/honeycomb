// Orbit: pure game logic — board, flood, letter stream, stats, sharing.
// Nothing here touches React or the DOM, so it stays easy to reason about.
import type { HexCell } from '../components/HexGrid';
import { createSeededRNG, LETTER_WEIGHTS, type SeededRNG } from './seededRNG';

// ==================== ORBIT TUNING ====================
// Classic-size board: the 19-cell diamond. Small board is the pressure;
// path words + spins are the player's power
export const ROW_COUNTS = [3, 4, 5, 4, 3];
export const SEED_TILES = 8;
export const WORD_MIN = 3;
export const DAILY_UNDOS = 3;
// The flood runs on a fixed schedule: every wave is a little bigger than
// the last few, so pressure builds on its own instead of punishing play
export const WAVE_START = 3;
export const WAVE_GROWTH_EVERY = 4;
export const baseWave = (wave: number, growEvery = WAVE_GROWTH_EVERY) => WAVE_START + Math.floor(wave / growEvery);
// Spins are the signature move, so the first each turn is free. Every
// extra spin adds one tile to THIS turn's wave only
export const FREE_SPINS = 1;
// With multi-word turns (lab), every word after the first adds a tile too and
// each out-spell takes one off; a wave never drops below one tile
export const waveSize = (wave: number, spins: number, extraWords = 0, shrink = 0, growEvery = WAVE_GROWTH_EVERY) =>
    Math.max(1, baseWave(wave, growEvery) + Math.max(0, spins - FREE_SPINS) + extraWords - shrink);
// Out-spell the flood: a word at least as long as the wave shrinks it by one
export const outSpelled = (wordLen: number, size: number) => wordLen >= size;
// Roughly one gold tile every other wave
const GEM_CHANCE = 0.13;
// Lab specials (wild / bomb / magnet) share a wave's single special slot
const LAB_SPECIAL_CHANCE = 0.12;
export const WILD = '*';
const DAILY_EPOCH = '2026-06-10';
// =======================================================

// ---------- scoring ----------
// Scrabble values: familiar, and they turn rare letters into prizes
const LETTER_VALUES: Record<string, number> = {
    A: 1, E: 1, I: 1, O: 1, U: 1, L: 1, N: 1, R: 1, S: 1, T: 1,
    D: 2, G: 2,
    B: 3, C: 3, M: 3, P: 3,
    F: 4, H: 4, V: 4, W: 4, Y: 4,
    K: 5,
    J: 8, X: 8,
    Q: 10, Z: 10,
};
export const letterValue = (l: string) => (l === WILD ? 0 : LETTER_VALUES[l.toUpperCase()] ?? 1);
// Long words carry the run
export const lengthMult = (len: number) => (len >= 7 ? 3 : len >= 5 ? 2 : 1);

export interface WordScore {
    letters: number;
    lengthMult: number;
    gems: number;
    total: number;
}

// ---------- rules (the daily uses DEFAULT_RULES; practice can try lab rules) ----------
// path: each tile touches the one before it
// branch: each tile touches ANY tile already picked
// leap: path, plus one hop over a single tile per word
export type WordShape = 'path' | 'branch' | 'leap';
export type Special = 'wild' | 'bomb' | 'magnet';
export interface Rules {
    shape: WordShape;
    multiWord: boolean;
    specials: Special[];
}
export const DEFAULT_RULES: Rules = { shape: 'path', multiWord: false, specials: [] };
// Looser shapes and specials clear more per turn, so the flood grows faster
// to keep runs near the same length (tuned by simulation: ~17-23 waves)
export const growEveryFor = (r: Rules) => (r.shape === 'path' && !r.specials.length ? WAVE_GROWTH_EVERY : 3);
export const isDefaultRules = (r: Rules) =>
    r.shape === DEFAULT_RULES.shape && r.multiWord === DEFAULT_RULES.multiWord && r.specials.length === 0;

const LS_LAB = 'waxle-orbit-lab-v1';
const SHAPES: WordShape[] = ['path', 'branch', 'leap'];
const SPECIALS: Special[] = ['wild', 'bomb', 'magnet'];

// Lab rules picked for new practice games
export function loadLabRules(): Rules {
    try {
        const raw = JSON.parse(localStorage.getItem(LS_LAB) || 'null');
        if (raw && SHAPES.includes(raw.shape)) {
            return {
                shape: raw.shape,
                multiWord: !!raw.multiWord,
                specials: Array.isArray(raw.specials) ? raw.specials.filter((x: Special) => SPECIALS.includes(x)) : [],
            };
        }
    } catch { /* fall back to standard rules */ }
    return DEFAULT_RULES;
}

export function saveLabRules(r: Rules) {
    try { localStorage.setItem(LS_LAB, JSON.stringify(r)); } catch { /* non-fatal */ }
}

const cap = (x: string) => x[0].toUpperCase() + x.slice(1);
export const describeRules = (r: Rules) =>
    [cap(r.shape), r.multiWord ? 'Multi-word' : '', r.specials.map(cap).join(' + ')].filter(Boolean).join(' · ');

export const isAdjacent = (a: HexCell, b: HexCell) =>
    a.position.row === b.position.row
        ? Math.abs(a.position.col - b.position.col) === 1
        : Math.abs(a.position.row - b.position.row) === 1 && Math.abs(a.position.col - b.position.col) === 0.5;

// Two tiles apart with a lettered tile between them
const hopsOver = (a: HexCell, c: HexCell, grid: HexCell[]) =>
    !isAdjacent(a, c) && grid.some(m => m.letter && m.id !== a.id && m.id !== c.id && isAdjacent(a, m) && isAdjacent(m, c));

export const leapUsed = (sel: HexCell[]) => sel.some((c, i) => i > 0 && !isAdjacent(sel[i - 1], c));

// May `cell` be added to the selection under this shape rule?
export function canExtend(shape: WordShape, sel: HexCell[], cell: HexCell, grid: HexCell[]): boolean {
    if (!sel.length) return true;
    const last = sel[sel.length - 1];
    if (shape === 'branch') return sel.some(s => isAdjacent(s, cell));
    if (shape === 'leap') return isAdjacent(last, cell) || (!leapUsed(sel) && hopsOver(last, cell, grid));
    return isAdjacent(last, cell);
}

// Resolve wild tiles: the first dictionary word the '*'s can stand for
export function resolveWord(raw: string, has: (w: string) => boolean): string | null {
    const i = raw.indexOf(WILD);
    if (i === -1) return has(raw) ? raw : null;
    for (let code = 97; code <= 122; code++) {
        const hit = resolveWord(raw.slice(0, i) + String.fromCharCode(code) + raw.slice(i + 1), has);
        if (hit) return hit;
    }
    return null;
}

// Extra tiles a word takes with it: a bomb clears its whole ring, a magnet
// pulls every matching letter off the board
export function extraClears(grid: HexCell[], wordIds: string[]): string[] {
    const inWord = new Set(wordIds);
    const extra = new Set<string>();
    for (const id of wordIds) {
        const c = grid.find(x => x.id === id);
        if (!c) continue;
        if (c.special === 'bomb') {
            grid.forEach(n => { if (n.letter && !inWord.has(n.id) && isAdjacent(c, n)) extra.add(n.id); });
        } else if (c.special === 'magnet' && c.letter !== WILD) {
            grid.forEach(n => { if (n.letter === c.letter && !inWord.has(n.id)) extra.add(n.id); });
        }
    }
    return [...extra];
}

// Letter points x length bonus, doubled for every gold tile in the word
export function scoreWord(letters: string[], gems: number): WordScore {
    const sum = letters.reduce((a, l) => a + letterValue(l), 0);
    const mult = lengthMult(letters.length);
    return { letters: sum, lengthMult: mult, gems, total: sum * mult * 2 ** gems };
}

export const RING_OFFSETS: Array<[number, number]> = [
    [-1, -0.5], [-1, 0.5], [0, 1], [1, 0.5], [1, -0.5], [0, -1],
];

export const COLS = Math.max(...ROW_COUNTS);
export const BOARD_CELLS = ROW_COUNTS.reduce((a, b) => a + b, 0);

export function buildBoard(): HexCell[] {
    const cells: HexCell[] = [];
    ROW_COUNTS.forEach((count, row) => {
        const offset = (COLS - count) / 2;
        for (let i = 0; i < count; i++) {
            cells.push({
                id: `o${row}-${i}`,
                position: { row, col: i + offset },
                letter: '',
                isPrePlaced: false,
                isSelected: false,
                isPlaced: false,
            });
        }
    });
    return cells;
}

// Saved board: [cellId, letter] plus 1 for a gold tile or a lab special
type SavedTile = [string, string] | [string, string, 1 | 'bomb' | 'magnet'];
export type BoardLetters = SavedTile[];

export const boardLetters = (grid: HexCell[]): BoardLetters =>
    grid.filter(c => c.letter).map((c): SavedTile =>
        c.isGem ? [c.id, c.letter, 1] : c.special ? [c.id, c.letter, c.special] : [c.id, c.letter]);

export function boardFromLetters(letters: BoardLetters): HexCell[] {
    const board = buildBoard();
    const byId = new Map(letters.map(t => [t[0], t]));
    board.forEach(c => {
        const t = byId.get(c.id);
        if (t) {
            c.letter = t[1];
            c.isPlaced = true;
            c.isGem = t[2] === 1;
            if (t[2] === 'bomb' || t[2] === 'magnet') c.special = t[2];
        }
    });
    return board;
}

export type Tile = { letter: string; gem: boolean; special?: 'bomb' | 'magnet' };

// Flood placement: each tile enters the top row and sinks to the globally
// deepest reachable empty cell. A tile with no way in ends the game
export function orbitFlood(
    grid: HexCell[],
    tiles: Tile[],
    rng: SeededRNG
): { newGrid: HexCell[]; paths: Record<string, string[]>; unplaced: Tile[] } {
    const newGrid = grid.map(c => ({ ...c, placedThisTurn: false }));
    const byPos = new Map(newGrid.map(c => [`${c.position.row},${c.position.col}`, c]));
    const byId = new Map(newGrid.map(c => [c.id, c]));
    const paths: Record<string, string[]> = {};
    const unplaced: Tile[] = [];

    for (const tile of tiles) {
        const parent = new Map<string, string | null>();
        const queue: HexCell[] = [];
        newGrid.forEach(c => {
            if (c.position.row === 0 && !c.letter) {
                parent.set(c.id, null);
                queue.push(c);
            }
        });
        while (queue.length) {
            const cur = queue.shift()!;
            for (const dc of [-0.5, 0.5]) {
                const n = byPos.get(`${cur.position.row + 1},${cur.position.col + dc}`);
                if (n && !n.letter && !parent.has(n.id)) {
                    parent.set(n.id, cur.id);
                    queue.push(n);
                }
            }
        }
        if (parent.size === 0) {
            unplaced.push(tile);
            continue;
        }
        let best: HexCell[] = [];
        for (const id of parent.keys()) {
            const c = byId.get(id)!;
            if (!best.length || c.position.row > best[0].position.row) best = [c];
            else if (c.position.row === best[0].position.row) best.push(c);
        }
        const target = best[Math.floor(rng.next() * best.length)];
        const path: string[] = [];
        for (let id: string | null = target.id; id !== null; id = parent.get(id) ?? null) {
            path.unshift(id);
        }
        target.letter = tile.letter;
        target.isGem = tile.gem;
        target.special = tile.special;
        target.isPlaced = true;
        target.placedThisTurn = true;
        paths[target.id] = path;
    }
    return { newGrid, paths, unplaced };
}

// How many of `count` incoming tiles would find no room (0 = the wave fits)
export function overflowCount(grid: HexCell[], count: number): number {
    const dummy = Array.from({ length: count }, () => ({ letter: 'A', gem: false }));
    return orbitFlood(grid, dummy, createSeededRNG(1)).unplaced.length;
}

// Clear the word's cells and let everything above settle: each tile slides
// down to its lower-left neighbour when empty, else its lower-right.
// Returns where every moved tile came from (dst -> src) for animation
export function clearAndSettle(
    grid: HexCell[],
    clearIds: string[]
): { newGrid: HexCell[]; moveSources: Map<string, string> } {
    const newGrid: HexCell[] = grid.map(c => ({ ...c, placedThisTurn: false }));
    const byPos = new Map(newGrid.map(c => [`${c.position.row},${c.position.col}`, c]));
    const clear = new Set(clearIds);
    newGrid.forEach(c => {
        if (clear.has(c.id)) { c.letter = ''; c.isGem = false; c.special = undefined; c.isPlaced = false; }
    });
    // origin[cellId] = the cell the resident tile started this settle in
    const origin = new Map<string, string>();
    newGrid.forEach(c => { if (c.letter) origin.set(c.id, c.id); });
    let moved = true;
    while (moved) {
        moved = false;
        for (let row = ROW_COUNTS.length - 2; row >= 0; row--) {
            for (const c of newGrid) {
                if (c.position.row !== row || !c.letter) continue;
                const below = [-0.5, 0.5]
                    .map(dc => byPos.get(`${row + 1},${c.position.col + dc}`))
                    .filter((n): n is HexCell => !!n && !n.letter);
                if (!below.length) continue;
                const dst = below[0];
                dst.letter = c.letter;
                dst.isGem = c.isGem;
                dst.special = c.special;
                dst.isPlaced = true;
                origin.set(dst.id, origin.get(c.id)!);
                origin.delete(c.id);
                c.letter = '';
                c.isGem = false;
                c.special = undefined;
                c.isPlaced = false;
                moved = true;
            }
        }
    }
    const moveSources = new Map<string, string>();
    origin.forEach((src, dst) => { if (src !== dst) moveSources.set(dst, src); });
    return { newGrid, moveSources };
}

export const hashSeed = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
    }
    return h;
};

export const placementRng = (seed: string, tag: string) => createSeededRNG(hashSeed(`${seed}|p|${tag}`));

// ---------- letter stream ----------
// Every wave draws from its own seeded sub-stream, so a wave's letters never
// depend on how big earlier waves were. Growing the NEXT row with a spin only
// reveals letters of THIS wave — spin-then-undo can't peek at future waves,
// and undoing a turn can never reroll one.
// Letters are prefix-stable: letter i depends only on letters 0..i-1 of the
// same wave, so a spin appends one letter without reshuffling the row.
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const RARE = new Set(['J', 'K', 'Q', 'X', 'Z']);

function nextWaveLetter(rng: SeededRNG, prefix: string[]): string {
    const weights: Record<string, number> = { ...LETTER_WEIGHTS };
    // Q is nearly unplayable on 19 cells without a U beside it
    weights.Q *= 0.15;
    const n = prefix.length;
    if (n >= 2) {
        // Keep every wave near the natural ~40% vowel mix so a single
        // drop can't bury the board in consonants (or vowels)
        const ratio = prefix.filter(l => VOWELS.has(l)).length / n;
        const scale = ratio < 0.3 ? 3 : ratio > 0.6 ? 0.3 : 1;
        VOWELS.forEach(v => { weights[v] *= scale; });
    }
    // At most one rare letter per wave
    if (prefix.some(l => RARE.has(l))) RARE.forEach(r => { weights[r] *= 0.1; });

    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = rng.next() * total;
    for (const [letter, w] of Object.entries(weights)) {
        r -= w;
        if (r <= 0) return letter;
    }
    return 'E';
}

const streamCache = new Map<string, { rng: SeededRNG; tiles: Tile[] }>();

export function waveTiles(seed: string, tag: string, count: number, specials: Special[] = []): Tile[] {
    const key = `${seed}|tiles|${tag}${specials.length ? `|${[...specials].sort().join(',')}` : ''}`;
    let entry = streamCache.get(key);
    if (!entry) {
        entry = { rng: createSeededRNG(hashSeed(key)), tiles: [] };
        streamCache.set(key, entry);
    }
    while (entry.tiles.length < count) {
        const prefix = entry.tiles.map(t => t.letter);
        const letter = nextWaveLetter(entry.rng, prefix);
        // At most one gold (or lab special) tile per wave, drawn after the
        // letter so the stream stays prefix-stable
        const open = !entry.tiles.some(t => t.gem || t.special || t.letter === WILD);
        if (!specials.length) {
            entry.tiles.push({ letter, gem: open && entry.rng.next() < GEM_CHANCE });
            continue;
        }
        const r = open ? entry.rng.next() : 1;
        if (r < GEM_CHANCE) {
            entry.tiles.push({ letter, gem: true });
        } else if (r < GEM_CHANCE + LAB_SPECIAL_CHANCE) {
            const kind = specials[Math.floor(entry.rng.next() * specials.length)];
            entry.tiles.push(kind === 'wild' ? { letter: WILD, gem: false } : { letter, gem: false, special: kind });
        } else {
            entry.tiles.push({ letter, gem: false });
        }
    }
    return entry.tiles.slice(0, count);
}

export const waveTag = (wave: number) => `w${wave}`;

// ---------- dates ----------

export const todayStr = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Date strings are treated as UTC midnights so day arithmetic ignores DST
export const addDays = (date: string, n: number) =>
    new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);

export const dayNumber = (date: string) =>
    Math.max(1, Math.round((Date.parse(date) - Date.parse(DAILY_EPOCH)) / 86400000) + 1);

export function msUntilLocalMidnight(now = new Date()): number {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return next.getTime() - now.getTime();
}

export function formatCountdown(ms: number): string {
    const s = Math.max(0, Math.floor(ms / 1000));
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

// ---------- run history + stats ----------

// A word is logged by its length; 'word' is the pre-length legacy entry
export type Action = 'pass' | 'word' | number;

export interface DailyResult {
    score: number;
    strip: Action[];
    best: string;
    wordCount: number;
    waves: number;
    board?: BoardLetters;
    words?: string[];
    submitted?: { name: string; rank?: number; total?: number };
}

export interface OrbitStats {
    results: Record<string, DailyResult>;
}

const LS_STATS = 'waxle-orbit-stats-v1';

export function loadStats(): OrbitStats {
    try {
        const raw = localStorage.getItem(LS_STATS);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.results === 'object' && parsed.results) {
                return { results: parsed.results };
            }
        }
    } catch { /* fall through to fresh stats */ }
    return { results: {} };
}

export function saveStats(stats: OrbitStats) {
    try { localStorage.setItem(LS_STATS, JSON.stringify(stats)); } catch { /* non-fatal */ }
}

export interface StatsSummary {
    played: number;
    currentStreak: number;
    maxStreak: number;
    best: number;
    average: number;
}

// Streaks are derived from the result history rather than stored, so a
// missed day reads as a broken streak straight away
export function summarizeStats(stats: OrbitStats, today: string): StatsSummary {
    const dates = Object.keys(stats.results).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    const scores = dates.map(d => stats.results[d].score);
    let maxStreak = 0;
    let run = 0;
    let prev = '';
    for (const d of dates) {
        run = prev && addDays(prev, 1) === d ? run + 1 : 1;
        maxStreak = Math.max(maxStreak, run);
        prev = d;
    }
    const has = new Set(dates);
    let cursor = has.has(today) ? today : addDays(today, -1);
    let currentStreak = 0;
    while (has.has(cursor)) {
        currentStreak++;
        cursor = addDays(cursor, -1);
    }
    return {
        played: dates.length,
        currentStreak,
        maxStreak,
        best: scores.reduce((m, s) => Math.max(m, s), 0),
        average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    };
}

// ---------- sharing ----------

export function actionEmoji(a: Action): string {
    if (a === 'pass') return '⬛';
    if (a === 'word') return '🟩';
    if (a >= 7) return '🟪';
    if (a >= 5) return '🟩';
    return '🟨';
}

export function actionStrip(log: Action[], perLine = 10): string {
    const lines: string[] = [];
    for (let i = 0; i < log.length; i += perLine) {
        lines.push(log.slice(i, i + perLine).map(actionEmoji).join(''));
    }
    return lines.join('\n');
}

export const longestWord = (words: string[]) =>
    words.reduce((a, b) => (b.length > a.length ? b : a), '');
