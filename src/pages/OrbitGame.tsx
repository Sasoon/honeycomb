import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { RotateCw, RotateCcw, Flame } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { HexCell } from '../components/HexGrid';
import {
    clearTilesAndApplyGravity,
    generateDropLettersSmart,
    areCellsAdjacent,
} from '../lib/waxleGameUtils';
import { createSeededRNG, SeededRNG } from '../lib/seededRNG';
import wordValidator from '../lib/wordValidator';
import toastService from '../lib/toastService';

// ==================== ORBIT TUNING ====================
const ROW_COUNTS = [4, 5, 6, 7, 6, 5, 4]; // regular hexagon, side 4 — 37 cells
// Crescendo: the storm builds instead of droning
const WAVE_SIZES = [3, 3, 4, 4, 4, 5, 5, 5, 6, 6];
const WAVES = WAVE_SIZES.length;
const SEED_TILES = 12;
const TOTAL_LETTERS = SEED_TILES + WAVE_SIZES.reduce((a, b) => a + b, 0);
const FLOOD_STAGGER_MS = 50;
const HANDLE_DELAY_MS = 250; // settle time before spin handles appear
const DAILY_EPOCH = '2026-06-10'; // Daily #1
// =======================================================

const LS_RUN = 'waxle-orbit-run-v1';
const LS_STATS = 'waxle-orbit-stats-v1';
const LS_ONBOARDED = 'waxle-orbit-onboarded-v1';

// Neighbour offsets in clockwise screen order, starting top-left
const RING_OFFSETS: Array<[number, number]> = [
    [-1, -0.5], [-1, 0.5], [0, 1], [1, 0.5], [1, -0.5], [0, -1],
];

const TILE_W = 54;
const TILE_H = 62;
const PITCH_X = 58;
const PITCH_Y = 50;
const BOARD_W = 6 * PITCH_X + TILE_W;
const BOARD_H = 6 * PITCH_Y + TILE_H;

const cellX = (c: HexCell) => c.position.col * PITCH_X;
const cellY = (c: HexCell) => c.position.row * PITCH_Y;

function buildBoard(): HexCell[] {
    const cells: HexCell[] = [];
    ROW_COUNTS.forEach((count, row) => {
        const offset = (7 - count) / 2;
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

type Phase = 'storm' | 'cleanup' | 'over';
type EndReason = 'drowned' | 'finished' | 'swept';
type Mode = 'daily' | 'practice';
type Action = 'word' | 'orbit' | 'pass';
type PendingAnim = { keyframes: Keyframe[]; duration: number; delay: number; easing?: string };
type ClearFx = { id: string; letter: string; left: number; top: number };

interface DailyResult {
    score: number;
    reason: EndReason;
    strip: Action[];
    best: string;
    wordCount: number;
    stranded: number;
}

interface OrbitStats {
    streak: number;
    lastDate: string;
    games: number;
    sweeps: number;
    results: Record<string, DailyResult>;
}

const ACTION_EMOJI: Record<Action, string> = { word: '🟩', orbit: '🔄', pass: '⏭' };

const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dayNumber = (date: string) =>
    Math.max(1, Math.round((Date.parse(date) - Date.parse(DAILY_EPOCH)) / 86400000) + 1);
const hashSeed = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
    }
    return h;
};
const yesterdayOf = (date: string) => {
    const d = new Date(Date.parse(date) - 86400000);
    return d.toISOString().slice(0, 10);
};

function loadStats(): OrbitStats {
    try {
        const raw = localStorage.getItem(LS_STATS);
        if (raw) return JSON.parse(raw) as OrbitStats;
    } catch { /* fall through to fresh stats */ }
    return { streak: 0, lastDate: '', games: 0, sweeps: 0, results: {} };
}

// Flood placement: each tile takes the globally deepest cell reachable from
// any empty top-row entry via a descending path of empty cells, so waves fill
// level by level instead of stacking towers
function orbitFlood(
    grid: HexCell[],
    letters: string[],
    rng?: SeededRNG
): { newGrid: HexCell[]; paths: Record<string, string[]>; unplaced: string[] } {
    const newGrid = grid.map(c => ({ ...c, placedThisTurn: false }));
    const byPosLocal = new Map(newGrid.map(c => [`${c.position.row},${c.position.col}`, c]));
    const paths: Record<string, string[]> = {};
    const unplaced: string[] = [];
    const rand = () => (rng ? rng.next() : Math.random());

    for (const letter of letters) {
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
                const n = byPosLocal.get(`${cur.position.row + 1},${cur.position.col + dc}`);
                if (n && !n.letter && !parent.has(n.id)) {
                    parent.set(n.id, cur.id);
                    queue.push(n);
                }
            }
        }
        if (parent.size === 0) {
            unplaced.push(letter);
            continue;
        }
        let best: HexCell[] = [];
        for (const id of parent.keys()) {
            const c = newGrid.find(x => x.id === id)!;
            if (!best.length || c.position.row > best[0].position.row) best = [c];
            else if (c.position.row === best[0].position.row) best.push(c);
        }
        const target = best[Math.floor(rand() * best.length)];
        const path: string[] = [];
        for (let id: string | null = target.id; id !== null; id = parent.get(id) ?? null) {
            path.unshift(id);
        }
        target.letter = letter;
        target.isPlaced = true;
        target.placedThisTurn = true;
        paths[target.id] = path;
    }
    return { newGrid, paths, unplaced };
}

// Cleanup dead-end detection: is any 3-6 letter dictionary word traceable?
// (a board whose only words are 7+ letters is practically impossible)
let shortWordsPromise: Promise<Set<string>> | null = null;
function loadShortWords(): Promise<Set<string>> {
    if (!shortWordsPromise) {
        shortWordsPromise = fetch('/dictionary.txt')
            .then(r => r.text())
            .then(text => new Set(text.split('\n').filter(w => w.length >= 3 && w.length <= 6)))
            .catch(() => { shortWordsPromise = null; return new Set<string>(); });
    }
    return shortWordsPromise;
}

function anyWordExists(grid: HexCell[], dict: Set<string>): boolean {
    const lettered = grid.filter(c => c.letter);
    const byPosLocal = new Map(grid.map(c => [`${c.position.row},${c.position.col}`, c]));
    const neighbors = (c: HexCell) =>
        RING_OFFSETS
            .map(([dr, dc]) => byPosLocal.get(`${c.position.row + dr},${c.position.col + dc}`))
            .filter((n): n is HexCell => !!n && !!n.letter);

    const used = new Set<string>();
    const dfs = (cell: HexCell, word: string): boolean => {
        used.add(cell.id);
        const next = word + cell.letter.toLowerCase();
        if (next.length >= 3 && dict.has(next)) { used.delete(cell.id); return true; }
        if (next.length < 6) {
            for (const n of neighbors(cell)) {
                if (!used.has(n.id) && dfs(n, next)) { used.delete(cell.id); return true; }
            }
        }
        used.delete(cell.id);
        return false;
    };
    return lettered.some(c => dfs(c, ''));
}

const OrbitGame = () => {
    const [mode, setMode] = useState<Mode>('daily');
    const [dateStr] = useState(todayStr);
    const [grid, setGrid] = useState<HexCell[]>([]);
    const [phase, setPhase] = useState<Phase>('storm');
    const [endReason, setEndReason] = useState<EndReason | null>(null);
    const [wavesDropped, setWavesDropped] = useState(0);
    const [nextWave, setNextWave] = useState<string[]>([]);
    const [score, setScore] = useState(0);
    const [words, setWords] = useState<string[]>([]);
    const [actionLog, setActionLog] = useState<Action[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [isValid, setIsValid] = useState(false);
    const [handlesOn, setHandlesOn] = useState(false);
    const [clearFx, setClearFx] = useState<ClearFx[]>([]);
    const [scoreFx, setScoreFx] = useState<{ x: number; y: number; text: string; key: number } | null>(null);
    const [stats, setStats] = useState<OrbitStats>(loadStats);
    const [showOnboarding, setShowOnboarding] = useState(
        () => typeof window !== 'undefined' && !localStorage.getItem(LS_ONBOARDED)
    );

    const boardRef = useRef<HTMLDivElement>(null);
    const pendingAnimsRef = useRef<Map<string, PendingAnim>>(new Map());
    const validateSeqRef = useRef(0);
    const rngRef = useRef<SeededRNG | undefined>(undefined);
    const fxTimersRef = useRef<number[]>([]);
    const recordedRef = useRef(false);
    const reducedMotion = useMemo(
        () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        []
    );

    const byPos = useMemo(() => {
        const m = new Map<string, HexCell>();
        grid.forEach(c => m.set(`${c.position.row},${c.position.col}`, c));
        return m;
    }, [grid]);

    const ringOf = useCallback((pivot: HexCell): HexCell[] => {
        const ring: HexCell[] = [];
        for (const [dr, dc] of RING_OFFSETS) {
            const n = byPos.get(`${pivot.position.row + dr},${pivot.position.col + dc}`);
            if (n) ring.push(n);
        }
        return ring;
    }, [byPos]);

    const queueMove = useCallback((id: string, dx: number, dy: number) => {
        pendingAnimsRef.current.set(id, {
            keyframes: [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
            duration: 180,
            delay: 0,
            easing: 'cubic-bezier(0.25, 0.8, 0.4, 1)',
        });
    }, []);

    // ---------- init / restore / persistence ----------

    const startFresh = useCallback((m: Mode) => {
        const rng = m === 'daily' ? createSeededRNG(hashSeed(dateStr)) : undefined;
        rngRef.current = rng;
        const fresh = buildBoard();
        const seedLetters = generateDropLettersSmart(SEED_TILES, fresh, rng);
        const { newGrid } = orbitFlood(fresh, seedLetters, rng);
        newGrid.forEach(c => { c.placedThisTurn = false; });
        pendingAnimsRef.current.clear();
        recordedRef.current = false;
        setGrid(newGrid);
        setNextWave(generateDropLettersSmart(WAVE_SIZES[0], newGrid, rng));
        setPhase('storm');
        setEndReason(null);
        setWavesDropped(0);
        setScore(0);
        setWords([]);
        setActionLog([]);
        setSelected([]);
        setIsValid(false);
    }, [dateStr]);

    const enterMode = useCallback((m: Mode) => {
        setMode(m);
        setSelected([]);
        setIsValid(false);
        if (m === 'practice') {
            startFresh('practice');
            return;
        }
        // Daily: completed → show stored result; in-progress → restore; else fresh
        const result = loadStats().results[dateStr];
        if (result) {
            recordedRef.current = true;
            const fresh = buildBoard();
            setGrid(fresh);
            setPhase('over');
            setEndReason(result.reason);
            setScore(result.score);
            setWords(result.best ? [result.best] : []);
            setActionLog(result.strip);
            setWavesDropped(WAVES);
            setNextWave([]);
            return;
        }
        try {
            const raw = localStorage.getItem(LS_RUN);
            if (raw) {
                const run = JSON.parse(raw);
                if (run.dateStr === dateStr && run.phase !== 'over') {
                    const board = buildBoard();
                    const letterById = new Map<string, string>(run.letters);
                    board.forEach(c => {
                        const l = letterById.get(c.id);
                        if (l) { c.letter = l; c.isPlaced = true; }
                    });
                    rngRef.current = createSeededRNG(hashSeed(dateStr));
                    rngRef.current.setState(run.rngState);
                    recordedRef.current = false;
                    pendingAnimsRef.current.clear();
                    setGrid(board);
                    setPhase(run.phase);
                    setEndReason(null);
                    setWavesDropped(run.wavesDropped);
                    setNextWave(run.nextWave);
                    setScore(run.score);
                    setWords(run.words);
                    setActionLog(run.actionLog);
                    return;
                }
            }
        } catch { /* corrupted snapshot — start over */ }
        startFresh('daily');
    }, [dateStr, startFresh]);

    useEffect(() => { enterMode('daily'); }, [enterMode]);

    // Snapshot the daily run so a refresh resumes instead of re-rolling
    useEffect(() => {
        if (mode !== 'daily' || grid.length === 0 || phase === 'over') return;
        try {
            localStorage.setItem(LS_RUN, JSON.stringify({
                dateStr,
                phase,
                wavesDropped,
                nextWave,
                score,
                words,
                actionLog,
                rngState: rngRef.current?.state ?? 0,
                letters: grid.filter(c => c.letter).map(c => [c.id, c.letter]),
            }));
        } catch { /* storage full/blocked — run just won't resume */ }
    }, [mode, dateStr, grid, phase, wavesDropped, nextWave, score, words, actionLog]);

    // Record the finished daily into stats (once)
    useEffect(() => {
        if (mode !== 'daily' || phase !== 'over' || !endReason || recordedRef.current) return;
        recordedRef.current = true;
        const stranded = grid.filter(c => c.letter).length;
        const best = words.reduce((a, b) => (b.length > a.length ? b : a), '');
        setStats(prev => {
            const next: OrbitStats = {
                ...prev,
                games: prev.games + 1,
                sweeps: prev.sweeps + (endReason === 'swept' ? 1 : 0),
                streak: prev.lastDate === yesterdayOf(dateStr) ? prev.streak + 1
                    : prev.lastDate === dateStr ? prev.streak
                    : 1,
                lastDate: dateStr,
                results: {
                    ...prev.results,
                    [dateStr]: { score, reason: endReason, strip: actionLog, best, wordCount: words.length, stranded },
                },
            };
            try { localStorage.setItem(LS_STATS, JSON.stringify(next)); } catch { /* non-fatal */ }
            return next;
        });
        try { localStorage.removeItem(LS_RUN); } catch { /* non-fatal */ }
    }, [mode, phase, endReason, grid, words, score, actionLog, dateStr]);

    // ---------- game flow ----------

    const afterAction = useCallback((g: HexCell[]) => {
        if (phase === 'storm' && wavesDropped < WAVES) {
            const rng = rngRef.current;
            const letters = nextWave.length ? nextWave : generateDropLettersSmart(WAVE_SIZES[wavesDropped], g, rng);
            const { newGrid, paths, unplaced } = orbitFlood(g, letters, rng);

            // Magnet ease-out along the full fall path
            const placed = newGrid.filter(c => c.placedThisTurn);
            const specs = placed.map(c => {
                const ids = paths[c.id]?.length ? paths[c.id] : [c.id];
                const pts = ids
                    .map(id => newGrid.find(x => x.id === id))
                    .filter((x): x is HexCell => !!x)
                    .map(x => ({ x: cellX(x), y: cellY(x) }));
                pts.unshift({ x: pts[0].x, y: pts[0].y - TILE_H * 0.9 });
                return { cellId: c.id, points: pts };
            });
            specs.sort((a, b) => a.points[0].x - b.points[0].x);
            specs.forEach((spec, idx) => {
                const pts = spec.points;
                const cum = [0];
                for (let i = 1; i < pts.length; i++) {
                    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
                }
                const total = cum[cum.length - 1];
                if (total <= 0) return;
                const last = pts[pts.length - 1];
                pendingAnimsRef.current.set(spec.cellId, {
                    keyframes: pts.map((p, i) => ({
                        transform: `translate(${p.x - last.x}px, ${p.y - last.y}px)`,
                        opacity: i === 0 ? 0 : 1,
                        offset: 1 - Math.sqrt(1 - cum[i] / total),
                        easing: 'linear',
                    })),
                    duration: Math.min(560, Math.max(280, 150 * Math.sqrt(total / TILE_H))),
                    delay: idx * FLOOD_STAGGER_MS,
                });
            });

            const nextWaves = wavesDropped + 1;
            setWavesDropped(nextWaves);
            setGrid(newGrid);
            setNextWave(nextWaves < WAVES ? generateDropLettersSmart(WAVE_SIZES[nextWaves], newGrid, rng) : []);
            if (unplaced.length > 0) {
                setPhase('over');
                setEndReason('drowned');
            } else if (nextWaves >= WAVES) {
                setPhase('cleanup');
            }
        } else {
            setGrid(g);
            if (phase === 'cleanup' && g.every(c => !c.letter)) {
                setPhase('over');
                setEndReason('swept');
            }
        }
    }, [phase, wavesDropped, nextWave]);

    // Cleanup dead-end watch: auto-finish when no word is traceable
    useEffect(() => {
        if (phase !== 'cleanup') return;
        let cancelled = false;
        loadShortWords().then(dict => {
            if (cancelled || dict.size === 0) return;
            if (!anyWordExists(grid, dict)) {
                setPhase('over');
                setEndReason(grid.every(c => !c.letter) ? 'swept' : 'finished');
                if (grid.some(c => c.letter)) toastService.success('No words left — run complete');
            }
        });
        return () => { cancelled = true; };
    }, [phase, grid]);

    const orbit = useCallback((pivotId: string, dir: 1 | -1) => {
        if (phase === 'over') return;
        const pivot = grid.find(c => c.id === pivotId);
        if (!pivot) return;
        const ring = ringOf(pivot);
        if (ring.length < 3) return;

        const n = ring.length;
        const newGrid = grid.map(c => ({ ...c }));
        const find = (id: string) => newGrid.find(c => c.id === id)!;
        ring.forEach((src, i) => {
            const dst = ring[(i + (dir === 1 ? 1 : n - 1)) % n];
            const target = find(dst.id);
            target.letter = src.letter;
            target.isPlaced = src.isPlaced;
            if (src.letter) {
                queueMove(dst.id, cellX(src) - cellX(dst), cellY(src) - cellY(dst));
            }
        });
        setSelected([]);
        setIsValid(false);
        if (phase === 'storm') setActionLog(log => [...log, 'orbit']);
        afterAction(newGrid);
    }, [phase, grid, ringOf, queueMove, afterAction]);

    const currentWord = useMemo(
        () => selected.map(id => grid.find(c => c.id === id)?.letter || '').join(''),
        [selected, grid]
    );

    const submit = useCallback(() => {
        if (phase === 'over' || !isValid || selected.length < 3) return;
        const word = currentWord;
        const clearedCells = selected
            .map(id => grid.find(c => c.id === id))
            .filter((c): c is HexCell => !!c);

        // Clear-pop juice: ghost tiles burst at the cleared positions and a
        // score floater rises from their centroid
        const fx = clearedCells.map(c => ({ id: c.id, letter: c.letter, left: cellX(c), top: cellY(c) }));
        const cx = fx.reduce((s, f) => s + f.left, 0) / fx.length + TILE_W / 2;
        const cy = Math.min(...fx.map(f => f.top));
        setClearFx(fx);
        setScoreFx({ x: cx, y: cy, text: `+${word.length}`, key: Date.now() });
        const t1 = window.setTimeout(() => setClearFx([]), 400);
        const t2 = window.setTimeout(() => setScoreFx(null), 750);
        fxTimersRef.current.push(t1, t2);

        const { newGrid, moveSources } = clearTilesAndApplyGravity(grid, selected);
        moveSources.forEach((srcId, dstId) => {
            const src = grid.find(c => c.id === srcId);
            const dst = newGrid.find(c => c.id === dstId);
            if (src && dst) queueMove(dstId, cellX(src) - cellX(dst), cellY(src) - cellY(dst));
        });
        setScore(s => s + word.length);
        setWords(w => [...w, word]);
        setSelected([]);
        setIsValid(false);
        if (phase === 'storm') setActionLog(log => [...log, 'word']);
        afterAction(newGrid);
    }, [phase, isValid, selected, currentWord, grid, queueMove, afterAction]);

    const endTurn = useCallback(() => {
        if (phase !== 'storm') return;
        setSelected([]);
        setIsValid(false);
        setActionLog(log => [...log, 'pass']);
        afterAction(grid.map(c => ({ ...c })));
    }, [phase, grid, afterAction]);

    const finish = useCallback(() => {
        if (phase !== 'cleanup') return;
        setPhase('over');
        setEndReason('finished');
    }, [phase]);

    useEffect(() => () => { fxTimersRef.current.forEach(t => window.clearTimeout(t)); }, []);

    // ---------- selection ----------

    const handleCellTap = useCallback((cell: HexCell) => {
        if (phase === 'over') return;
        if (!cell.letter) {
            setSelected([]);
            setIsValid(false);
            return;
        }
        const idx = selected.indexOf(cell.id);
        if (idx !== -1) {
            setSelected(selected.slice(0, idx));
            return;
        }
        if (selected.length === 0) {
            setSelected([cell.id]);
            return;
        }
        const last = grid.find(c => c.id === selected[selected.length - 1]);
        if (last && areCellsAdjacent(cell, last)) {
            setSelected([...selected, cell.id]);
        } else {
            setSelected([cell.id]);
        }
    }, [phase, selected, grid]);

    useEffect(() => {
        if (currentWord.length < 3) { setIsValid(false); return; }
        const seq = ++validateSeqRef.current;
        wordValidator.validateWordAsync(currentWord).then(ok => {
            if (validateSeqRef.current === seq) setIsValid(ok);
        });
    }, [currentWord]);

    // ---------- animation ----------

    useLayoutEffect(() => {
        const m = pendingAnimsRef.current;
        if (m.size === 0) return;
        if (!reducedMotion && boardRef.current) {
            m.forEach((a, id) => {
                const el = boardRef.current!.querySelector<HTMLElement>(`[data-ocell="${CSS.escape(id)}"] .orbit-tile`);
                el?.animate(a.keyframes, {
                    duration: a.duration,
                    delay: a.delay,
                    easing: a.easing ?? 'linear',
                    fill: 'backwards',
                });
            });
        }
        m.clear();
    }, [grid, reducedMotion]);

    // ---------- responsive scale ----------

    const [scale, setScale] = useState(1);
    useEffect(() => {
        const update = () => setScale(Math.min(1, (window.innerWidth - 28) / BOARD_W));
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    // ---------- derived ----------

    const pivotCell = useMemo(() => {
        if (selected.length !== 1) return null;
        const c = grid.find(x => x.id === selected[0]) || null;
        return c && ringOf(c).length >= 3 ? c : null;
    }, [selected, grid, ringOf]);

    // Handles (and the ring jiggle) appear only once the selection settles, so
    // they don't flicker while a word is being traced through the cell
    useEffect(() => {
        setHandlesOn(false);
        if (!pivotCell) return;
        const t = window.setTimeout(() => setHandlesOn(true), HANDLE_DELAY_MS);
        return () => window.clearTimeout(t);
    }, [pivotCell]);

    const ringIds = useMemo(() => {
        if (!pivotCell || !handlesOn) return new Set<string>();
        return new Set(ringOf(pivotCell).map(c => c.id));
    }, [pivotCell, handlesOn, ringOf]);

    const bestWord = useMemo(
        () => words.reduce((a, b) => (b.length > a.length ? b : a), ''),
        [words]
    );
    const tilesLeft = useMemo(() => grid.filter(c => c.letter).length, [grid]);
    const dailyNo = dayNumber(dateStr);

    const share = useCallback(() => {
        const headline = endReason === 'swept' ? '🧹 Clean Sweep' : endReason === 'drowned' ? '🌊 Drowned' : '🏁';
        const title = mode === 'daily' ? `WAXLE ORBIT #${dailyNo}` : 'WAXLE ORBIT (practice)';
        const stranded = endReason !== 'swept' && tilesLeft > 0 ? ` · ${tilesLeft} stranded` : '';
        const strip = actionLog.map(a => ACTION_EMOJI[a]).join('');
        const text = `${title} — ${score}/${TOTAL_LETTERS} ${headline}${stranded}\n${strip}${bestWord ? `\nBest: ${bestWord}` : ''}\nhttps://waxle.netlify.app/orbit`;
        navigator.clipboard.writeText(text).then(
            () => toastService.success('Result copied!'),
            () => toastService.error('Could not copy')
        );
    }, [mode, dailyNo, endReason, tilesLeft, actionLog, score, bestWord]);

    const dismissOnboarding = useCallback(() => {
        setShowOnboarding(false);
        try { localStorage.setItem(LS_ONBOARDED, '1'); } catch { /* non-fatal */ }
    }, []);

    const wordState = currentWord.length >= 3 ? (isValid ? 'valid' : 'invalid') : 'neutral';
    const dailyResult = stats.results[dateStr];

    return (
        <div className="flex-1 flex flex-col items-center px-3 pt-3 pb-8 select-none">
            {/* Mode pills */}
            <div className="flex gap-1.5 mb-2" role="tablist">
                <button
                    role="tab"
                    aria-selected={mode === 'daily'}
                    onClick={() => enterMode('daily')}
                    className={cn(
                        'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
                        mode === 'daily' ? 'bg-amber text-white' : 'bg-secondary/15 text-text-secondary'
                    )}
                >
                    Daily #{dailyNo}
                </button>
                <button
                    role="tab"
                    aria-selected={mode === 'practice'}
                    onClick={() => enterMode('practice')}
                    className={cn(
                        'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
                        mode === 'practice' ? 'bg-amber text-white' : 'bg-secondary/15 text-text-secondary'
                    )}
                >
                    Practice
                </button>
                {stats.streak > 0 && (
                    <span className="flex items-center gap-0.5 px-2 py-1 text-xs font-semibold text-amber">
                        <Flame size={12} /> {stats.streak}
                    </span>
                )}
            </div>

            {/* HUD */}
            <div className="w-full max-w-md flex items-center justify-between mb-1">
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-text-primary tabular-nums">{score}</span>
                    <span className="text-xs text-text-secondary">/ {TOTAL_LETTERS}</span>
                </div>
                {phase === 'storm' && nextWave.length > 0 && (
                    <div className="flex items-center gap-1.5 bg-amber/10 border border-amber/20 rounded-xl px-2.5 py-1.5">
                        <span className="text-[10px] font-medium text-amber uppercase tracking-wide">Next</span>
                        <div className="flex gap-1">
                            {nextWave.map((letter, idx) => (
                                <div
                                    key={`${wavesDropped}-${idx}`}
                                    className="w-5 h-5 bg-bg-secondary border border-secondary/30 rounded flex items-center justify-center text-[11px] font-semibold text-text-primary anim-chip-in"
                                    style={{ animationDelay: `${idx * 50}ms` }}
                                >
                                    {letter}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-1" aria-label={`Wave ${wavesDropped} of ${WAVES}`}>
                    {Array.from({ length: WAVES }, (_, i) => (
                        <span
                            key={i}
                            className={cn(
                                'w-2 h-2 rounded-full',
                                i < wavesDropped ? 'bg-amber' : 'bg-secondary/30'
                            )}
                        />
                    ))}
                </div>
            </div>
            <p className="w-full max-w-md text-xs text-text-secondary mb-3 min-h-4">
                {phase === 'storm' && 'Storm: every move drops more letters. Trace words or spin rings.'}
                {phase === 'cleanup' && 'The flood has passed — clear everything for a Clean Sweep.'}
            </p>

            {/* Board */}
            <div style={{ width: BOARD_W * scale, height: BOARD_H * scale }}>
                <div
                    ref={boardRef}
                    className="relative"
                    style={{ width: BOARD_W, height: BOARD_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                >
                    {grid.map(cell => {
                        const selIdx = selected.indexOf(cell.id);
                        const inRing = ringIds.has(cell.id);
                        const isPivot = pivotCell?.id === cell.id && handlesOn;
                        return (
                            <div
                                key={cell.id}
                                data-ocell={cell.id}
                                data-letter={cell.letter}
                                onClick={() => handleCellTap(cell)}
                                className={cn('orbit-cell', inRing && 'orbit-cell--ring')}
                                style={{ left: cellX(cell), top: cellY(cell), width: TILE_W, height: TILE_H }}
                            >
                                <div className="orbit-hexbg" />
                                {cell.letter && (
                                    <div className={cn(
                                        'orbit-tile',
                                        selIdx !== -1 && (wordState === 'invalid' ? 'orbit-tile--invalid' : 'orbit-tile--selected'),
                                        isPivot && 'orbit-tile--pivot'
                                    )}>
                                        {cell.letter}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Clear burst + score floater */}
                    {clearFx.map(fx => (
                        <div
                            key={fx.id}
                            className="orbit-clearfx"
                            style={{ left: fx.left, top: fx.top, width: TILE_W, height: TILE_H }}
                        >
                            {fx.letter}
                        </div>
                    ))}
                    {scoreFx && (
                        <div key={scoreFx.key} className="orbit-scorefx" style={{ left: scoreFx.x, top: scoreFx.y - 10 }}>
                            {scoreFx.text}
                        </div>
                    )}

                    {/* Orbit handles */}
                    {pivotCell && handlesOn && phase !== 'over' && (
                        <>
                            <button
                                aria-label="Orbit counter-clockwise"
                                onClick={e => { e.stopPropagation(); orbit(pivotCell.id, -1); }}
                                className="orbit-handle"
                                style={{ left: cellX(pivotCell) - 26, top: cellY(pivotCell) - 26 }}
                            >
                                <RotateCcw size={16} />
                            </button>
                            <button
                                aria-label="Orbit clockwise"
                                onClick={e => { e.stopPropagation(); orbit(pivotCell.id, 1); }}
                                className="orbit-handle"
                                style={{ left: cellX(pivotCell) + TILE_W - 8, top: cellY(pivotCell) - 26 }}
                            >
                                <RotateCw size={16} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Word + actions */}
            <div className="h-9 mt-3 mb-1 flex items-center">
                {currentWord ? (
                    <span className={cn(
                        'px-4 py-1 rounded-xl font-mono font-bold text-lg',
                        wordState === 'valid' && 'text-amber bg-amber/10',
                        wordState === 'invalid' && 'text-red-500 bg-red-500/10',
                        wordState === 'neutral' && 'text-text-secondary bg-secondary/10'
                    )}>
                        {currentWord}
                        {wordState === 'valid' && <span className="ml-2 text-sm">+{currentWord.length}</span>}
                    </span>
                ) : (
                    <span className="text-xs text-text-muted italic">
                        Tap tiles to trace a word · tap one tile to spin its ring
                    </span>
                )}
            </div>
            <div className="flex gap-2 items-center">
                {phase === 'storm' && (
                    <Button onClick={endTurn} variant="destructive" size="gameControl">
                        End Turn
                    </Button>
                )}
                <Button onClick={submit} disabled={!isValid || phase === 'over'} size="gameControl">
                    Submit
                </Button>
                {phase === 'cleanup' && (
                    <Button onClick={finish} variant="secondary" size="gameControl">
                        Finish
                    </Button>
                )}
            </div>

            {/* Game over */}
            {phase === 'over' && !showOnboarding && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 anim-backdrop-in" role="dialog" aria-modal="true">
                    <div className="bg-bg-primary border border-secondary/20 rounded-2xl p-6 shadow-2xl m-4 max-w-sm w-full text-center anim-modal-in">
                        <div className="text-4xl mb-2">
                            {endReason === 'swept' ? '🧹' : endReason === 'drowned' ? '🌊' : '🏁'}
                        </div>
                        <h2 className="text-xl font-bold text-text-primary mb-1">
                            {endReason === 'swept' ? 'Clean Sweep!' : endReason === 'drowned' ? 'The board flooded' : 'Run complete'}
                        </h2>
                        <p className="text-2xl font-bold text-amber mb-1 tabular-nums">
                            {score} <span className="text-sm text-text-secondary font-medium">/ {TOTAL_LETTERS}</span>
                        </p>
                        {actionLog.length > 0 && (
                            <p className="text-base tracking-wide mb-2" aria-label="run history">
                                {actionLog.map(a => ACTION_EMOJI[a]).join('')}
                            </p>
                        )}
                        <p className="text-text-secondary text-sm mb-2">
                            {mode === 'daily' && dailyResult
                                ? <>{dailyResult.wordCount} {dailyResult.wordCount === 1 ? 'word' : 'words'}{dailyResult.best && <> · best <span className="font-mono font-semibold">{dailyResult.best}</span></>}{dailyResult.stranded > 0 && <> · {dailyResult.stranded} stranded</>}</>
                                : <>{words.length} {words.length === 1 ? 'word' : 'words'}{bestWord && <> · best <span className="font-mono font-semibold">{bestWord}</span></>}{endReason !== 'swept' && tilesLeft > 0 && <> · {tilesLeft} stranded</>}</>}
                        </p>
                        {mode === 'daily' && (
                            <p className="text-xs text-text-secondary mb-4">
                                🔥 {stats.streak} day streak · 🧹 {stats.sweeps}/{stats.games} sweeps
                            </p>
                        )}
                        <div className="flex gap-3 justify-center">
                            <Button onClick={share} variant="secondary">Share</Button>
                            {mode === 'daily'
                                ? <Button onClick={() => enterMode('practice')}>Practice</Button>
                                : <Button onClick={() => startFresh('practice')}>Play again</Button>}
                        </div>
                    </div>
                </div>
            )}

            {/* First-run onboarding */}
            {showOnboarding && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 anim-backdrop-in" role="dialog" aria-modal="true">
                    <div className="bg-bg-primary border border-secondary/20 rounded-2xl p-6 shadow-2xl m-4 max-w-sm w-full anim-modal-in">
                        <h2 className="text-xl font-bold text-text-primary mb-4 text-center">How to play Orbit</h2>
                        <div className="space-y-3 text-sm text-text-secondary mb-5">
                            <p><span className="text-lg mr-2">🔤</span><span className="font-semibold text-text-primary">Trace words.</span> Tap touching tiles to spell a word (3+ letters), then Submit to clear them.</p>
                            <p><span className="text-lg mr-2">🔄</span><span className="font-semibold text-text-primary">Spin rings.</span> Tap a single tile and use the arrows to rotate the tiles around it into place.</p>
                            <p><span className="text-lg mr-2">🌊</span><span className="font-semibold text-text-primary">Beat the flood.</span> Every move drops more letters — survive {WAVES} waves, then empty the board for a Clean Sweep.</p>
                        </div>
                        <Button onClick={dismissOnboarding} className="w-full">Let's go</Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrbitGame;
