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
// Leap finds ~3x the words of strict paths, so waves grow every 3 turns
// (simulated no-spin runs: 14-20 waves, ~17.5 on average)
export const WAVE_GROWTH_EVERY = 3;
export const baseWave = (wave: number) => WAVE_START + Math.floor(wave / WAVE_GROWTH_EVERY);
// Spins are the signature move, so the first each turn is free. Every
// extra spin adds one tile to THIS turn's wave only
export const FREE_SPINS = 1;
export const waveSize = (wave: number, spins: number) => baseWave(wave) + Math.max(0, spins - FREE_SPINS);
// Out-spell the flood: a word at least as long as the wave shrinks it by one
export const outSpelled = (wordLen: number, size: number) => wordLen >= size;
// Roughly one gold tile every other wave
const GEM_CHANCE = 0.13;
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
export const letterValue = (l: string) => LETTER_VALUES[l.toUpperCase()] ?? 1;
// Long words carry the run
export const lengthMult = (len: number) => (len >= 7 ? 3 : len >= 5 ? 2 : 1);

export interface WordScore {
    letters: number;
    lengthMult: number;
    gems: number;
    total: number;
}

// ---------- word shape: path + one leap ----------
// Each tile must touch the one before it, except that once per word you may
// leap to a tile two steps away (any tile sharing a neighbour with the last)

export const isAdjacent = (a: HexCell, b: HexCell) =>
    a.position.row === b.position.row
        ? Math.abs(a.position.col - b.position.col) === 1
        : Math.abs(a.position.row - b.position.row) === 1 && Math.abs(a.position.col - b.position.col) === 0.5;

// The lettered tile `a` would leap over to reach `c`, if any
export function leapOver(a: HexCell, c: HexCell, grid: HexCell[]): HexCell | null {
    if (isAdjacent(a, c)) return null;
    return grid.find(m => m.letter && m.id !== a.id && m.id !== c.id && isAdjacent(a, m) && isAdjacent(m, c)) ?? null;
}

export const leapUsed = (sel: HexCell[]) => sel.some((c, i) => i > 0 && !isAdjacent(sel[i - 1], c));

export function canExtend(sel: HexCell[], cell: HexCell, grid: HexCell[]): boolean {
    if (!sel.length) return true;
    const last = sel[sel.length - 1];
    return isAdjacent(last, cell) || (!leapUsed(sel) && !!leapOver(last, cell, grid));
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

// Saved board: [cellId, letter] or [cellId, letter, 1] for a gold tile
export type BoardLetters = Array<[string, string] | [string, string, 1]>;

export const boardLetters = (grid: HexCell[]): BoardLetters =>
    grid.filter(c => c.letter).map(c => (c.isGem ? [c.id, c.letter, 1] : [c.id, c.letter]) as [string, string] | [string, string, 1]);

export function boardFromLetters(letters: BoardLetters): HexCell[] {
    const board = buildBoard();
    const byId = new Map(letters.map(t => [t[0], t]));
    board.forEach(c => {
        const t = byId.get(c.id);
        if (t) {
            c.letter = t[1];
            c.isPlaced = true;
            c.isGem = t[2] === 1;
        }
    });
    return board;
}

export type Tile = { letter: string; gem: boolean };

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
        if (clear.has(c.id)) { c.letter = ''; c.isGem = false; c.isPlaced = false; }
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
                dst.isPlaced = true;
                origin.set(dst.id, origin.get(c.id)!);
                origin.delete(c.id);
                c.letter = '';
                c.isGem = false;
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

export function waveTiles(seed: string, tag: string, count: number): Tile[] {
    const key = `${seed}|tiles|${tag}`;
    let entry = streamCache.get(key);
    if (!entry) {
        entry = { rng: createSeededRNG(hashSeed(key)), tiles: [] };
        streamCache.set(key, entry);
    }
    while (entry.tiles.length < count) {
        const prefix = entry.tiles.map(t => t.letter);
        const letter = nextWaveLetter(entry.rng, prefix);
        // At most one gold tile per wave, drawn after the letter so the
        // stream stays prefix-stable
        const gem = !entry.tiles.some(t => t.gem) && entry.rng.next() < GEM_CHANCE;
        entry.tiles.push({ letter, gem });
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
