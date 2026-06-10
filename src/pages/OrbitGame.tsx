import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { Flame, RotateCw, Undo2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { OptimizedCounter } from '../components/OptimizedCounter';
import { HexCell } from '../components/HexGrid';
import {
    clearTilesAndApplyGravity,
    generateDropLettersSmart,
    areCellsAdjacent,
} from '../lib/waxleGameUtils';
import { createSeededRNG, SeededRNG } from '../lib/seededRNG';
import toastService from '../lib/toastService';
import { haptics } from '../lib/haptics';

// ==================== ORBIT TUNING ====================
// Classic-size board: the 19-cell diamond. Small board is the pressure;
// cluster words + a scarce spin bank are the player's power
const ROW_COUNTS = [3, 4, 5, 4, 3];
// The flood escalates: late waves nearly fill what early waves trickled
const WAVE_SIZES = [3, 3, 3, 4, 4, 4, 5, 5, 5, 6];
const WAVES = WAVE_SIZES.length;
const SEED_TILES = 8;
const TOTAL_LETTERS = SEED_TILES + WAVE_SIZES.reduce((a, b) => a + b, 0); // 50
const CLUSTER_MIN = 3; // smallest playable word
const CLUSTER_MAX = 8; // largest anagram indexed
const FLOOD_STAGGER_MS = 50;
const HANDLE_DELAY_MS = 250;
const DRAG_THRESHOLD_PX = 8;
const DEG_PER_STEP = 60;
const WHEEL_PER_STEP = 40;
const DAILY_UNDOS = 3;
const SPIN_START = 3;
const SPIN_MAX = 5;
const SPIN_EARN_LEN = 5; // words this long or longer earn a spin back
const DAILY_EPOCH = '2026-06-10';
// =======================================================

const LS_RUN = 'waxle-orbit-run-v3';
const LS_STATS = 'waxle-orbit-stats-v1';
const LS_ONBOARDED = 'waxle-orbit-onboarded-v2';

const RING_OFFSETS: Array<[number, number]> = [
    [-1, -0.5], [-1, 0.5], [0, 1], [1, 0.5], [1, -0.5], [0, -1],
];

// Classic tile metrics (70px tiles, uniform hex lattice spacing)
const TILE_W = 70;
const TILE_H = 80;
const PITCH_X = 76;
const PITCH_Y = 65;
const COLS = Math.max(...ROW_COUNTS);
const BOARD_W = (COLS - 1) * PITCH_X + TILE_W;
const BOARD_H = (ROW_COUNTS.length - 1) * PITCH_Y + TILE_H;
const GUIDE_R = PITCH_X;

const cellX = (c: HexCell) => c.position.col * PITCH_X;
const cellY = (c: HexCell) => c.position.row * PITCH_Y;
const mod = (a: number, n: number) => ((a % n) + n) % n;

function buildBoard(): HexCell[] {
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

type Phase = 'storm' | 'cleanup' | 'over';
type EndReason = 'drowned' | 'finished' | 'swept';
type Mode = 'daily' | 'practice';
type Action = 'word' | 'pass';
type PendingAnim = { keyframes: Keyframe[]; duration: number; delay: number; easing?: string };
type ClearFx = { id: string; letter: string; left: number; top: number };
type RingInfo = { pivotId: string; cells: HexCell[]; slots: Array<{ x: number; y: number }>; n: number };
type Snapshot = {
    kind: 'spin' | 'turn';
    letters: Array<[string, string]>;
    phase: Phase;
    wavesDropped: number;
    nextWave: string[];
    score: number;
    words: string[];
    actionLog: Action[];
    spins: number;
    rngState: number;
};

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

const ACTION_EMOJI: Record<Action, string> = { word: '🟩', pass: '⏭' };

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
const sortKey = (letters: string) => letters.toLowerCase().split('').sort().join('');

function loadStats(): OrbitStats {
    try {
        const raw = localStorage.getItem(LS_STATS);
        if (raw) return JSON.parse(raw) as OrbitStats;
    } catch { /* fall through to fresh stats */ }
    return { streak: 0, lastDate: '', games: 0, sweeps: 0, results: {} };
}

// Anagram index: sorted letters -> a representative dictionary word.
// Cluster words match if the selected letters anagram to any entry
let anagramPromise: Promise<Map<string, string>> | null = null;
function loadAnagrams(): Promise<Map<string, string>> {
    if (!anagramPromise) {
        anagramPromise = fetch('/dictionary.txt')
            .then(r => r.text())
            .then(text => {
                const map = new Map<string, string>();
                for (const w of text.split('\n')) {
                    if (w.length < CLUSTER_MIN || w.length > CLUSTER_MAX) continue;
                    const key = sortKey(w);
                    if (!map.has(key)) map.set(key, w);
                }
                return map;
            })
            .catch(() => { anagramPromise = null; return new Map<string, string>(); });
    }
    return anagramPromise;
}

// Flood placement: globally deepest reachable cell per tile
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

// Cleanup dead-end detection: does any connected cluster of 3-5 tiles
// anagram to a word?
function anyClusterWord(grid: HexCell[], index: Map<string, string>): boolean {
    const lettered = grid.filter(c => c.letter);
    if (lettered.length < CLUSTER_MIN) return false;
    const adj = new Map<string, HexCell[]>();
    lettered.forEach(c => {
        adj.set(c.id, lettered.filter(o => o.id !== c.id && areCellsAdjacent(c, o)));
    });
    const seen = new Set<string>();
    let budget = 30000;

    const grow = (set: HexCell[]): boolean => {
        if (budget-- <= 0) return false;
        if (set.length >= CLUSTER_MIN) {
            const key = sortKey(set.map(c => c.letter).join(''));
            if (index.has(key)) return true;
        }
        if (set.length >= 5) return false;
        const inSet = new Set(set.map(c => c.id));
        const frontier = new Map<string, HexCell>();
        set.forEach(c => adj.get(c.id)!.forEach(n => { if (!inSet.has(n.id)) frontier.set(n.id, n); }));
        for (const n of frontier.values()) {
            const ids = [...inSet, n.id].sort().join('|');
            if (seen.has(ids)) continue;
            seen.add(ids);
            if (grow([...set, n])) return true;
        }
        return false;
    };
    return lettered.some(c => grow([c]));
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
    const [match, setMatch] = useState<string | null>(null);
    const [spins, setSpins] = useState(SPIN_START);
    const [armed, setArmed] = useState(false);
    const [previewSteps, setPreviewSteps] = useState(0);
    const [dragging, setDragging] = useState(false);
    const [clearFx, setClearFx] = useState<ClearFx[]>([]);
    const [scoreFx, setScoreFx] = useState<{ x: number; y: number; text: string; key: number } | null>(null);
    const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
    const [undosUsed, setUndosUsed] = useState(0);
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
    const ringRef = useRef<RingInfo | null>(null);
    const previewRef = useRef(0);
    const suppressClickRef = useRef(false);
    const dragRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        pivotCx: number;
        pivotCy: number;
        active: boolean;
        lastAngle: number;
        accum: number;
        lastDetent: number;
        raf: number;
        pendingP: number;
    } | null>(null);
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

    const tileEl = useCallback((id: string) =>
        boardRef.current?.querySelector<HTMLElement>(`[data-ocell="${CSS.escape(id)}"] .orbit-tile`) ?? null, []);

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
        setMatch(null);
        setSpins(SPIN_START);
        setUndoStack([]);
        setUndosUsed(0);
    }, [dateStr]);

    const enterMode = useCallback((m: Mode) => {
        setMode(m);
        setSelected([]);
        setMatch(null);
        if (m === 'practice') {
            startFresh('practice');
            return;
        }
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
                    setSpins(typeof run.spins === 'number' ? run.spins : SPIN_START);
                    setUndoStack(run.undoStack || []);
                    setUndosUsed(run.undosUsed || 0);
                    return;
                }
            }
        } catch { /* corrupted snapshot — start over */ }
        startFresh('daily');
    }, [dateStr, startFresh]);

    useEffect(() => { enterMode('daily'); }, [enterMode]);

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
                spins,
                rngState: rngRef.current?.state ?? 0,
                letters: grid.filter(c => c.letter).map(c => [c.id, c.letter]),
                undoStack,
                undosUsed,
            }));
        } catch { /* storage full/blocked — run just won't resume */ }
    }, [mode, dateStr, grid, phase, wavesDropped, nextWave, score, words, actionLog, spins, undoStack, undosUsed]);

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

    // Word/pass ends the turn: the next wave drops
    const afterAction = useCallback((g: HexCell[]) => {
        if (phase === 'storm' && wavesDropped < WAVES) {
            const rng = rngRef.current;
            const letters = nextWave.length ? nextWave : generateDropLettersSmart(WAVE_SIZES[wavesDropped], g, rng);
            const { newGrid, paths, unplaced } = orbitFlood(g, letters, rng);

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
                haptics.error();
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

    // Cleanup dead-end watch
    useEffect(() => {
        if (phase !== 'cleanup') return;
        let cancelled = false;
        loadAnagrams().then(index => {
            if (cancelled || index.size === 0) return;
            if (!anyClusterWord(grid, index)) {
                setPhase('over');
                setEndReason(grid.every(c => !c.letter) ? 'swept' : 'finished');
                if (grid.some(c => c.letter)) toastService.success('No words left — run complete');
            }
        });
        return () => { cancelled = true; };
    }, [phase, grid]);

    // ---------- undo ----------

    const takeSnapshot = useCallback((kind: 'spin' | 'turn'): Snapshot => ({
        kind,
        letters: grid.filter(c => c.letter).map(c => [c.id, c.letter] as [string, string]),
        phase,
        wavesDropped,
        nextWave: [...nextWave],
        score,
        words: [...words],
        actionLog: [...actionLog],
        spins,
        rngState: rngRef.current?.state ?? 0,
    }), [grid, phase, wavesDropped, nextWave, score, words, actionLog, spins]);

    const pushUndo = useCallback((kind: 'spin' | 'turn') => {
        // Snapshot eagerly: inside the updater it would run at render time,
        // after the action has already advanced the RNG
        const snap = takeSnapshot(kind);
        setUndoStack(s => [...s.slice(-9), snap]);
    }, [takeSnapshot]);

    const undosLeft = mode === 'daily' ? DAILY_UNDOS - undosUsed : Infinity;
    const topUndo = undoStack[undoStack.length - 1];
    // Undoing a spin is free (it refunds the spin); undoing a turn costs a charge
    const canUndo = phase !== 'over' && !!topUndo && (topUndo.kind === 'spin' || undosLeft > 0);

    const undo = useCallback(() => {
        if (phase === 'over' || undoStack.length === 0) return;
        const snap = undoStack[undoStack.length - 1];
        if (snap.kind === 'turn' && mode === 'daily' && undosUsed >= DAILY_UNDOS) return;
        const board = buildBoard();
        const letterById = new Map(snap.letters);
        board.forEach(c => {
            const l = letterById.get(c.id);
            if (l) { c.letter = l; c.isPlaced = true; }
        });
        rngRef.current?.setState(snap.rngState);
        pendingAnimsRef.current.clear();
        setGrid(board);
        setPhase(snap.phase);
        setWavesDropped(snap.wavesDropped);
        setNextWave(snap.nextWave);
        setScore(snap.score);
        setWords(snap.words);
        setActionLog(snap.actionLog);
        setSpins(snap.spins);
        setUndoStack(s => s.slice(0, -1));
        if (snap.kind === 'turn') setUndosUsed(u => u + 1);
        setSelected([]);
        setMatch(null);
        setClearFx([]);
        setScoreFx(null);
        haptics.select();
    }, [phase, undoStack, mode, undosUsed]);

    // ---------- ring arming ----------

    const selectedLetters = useMemo(
        () => selected.map(id => grid.find(c => c.id === id)?.letter || '').join(''),
        [selected, grid]
    );

    const spinAvailable = phase !== 'over' && spins > 0;

    const pivotCell = useMemo(() => {
        if (!spinAvailable || selected.length !== 1) return null;
        const c = grid.find(x => x.id === selected[0]) || null;
        return c && ringOf(c).length >= 3 ? c : null;
    }, [spinAvailable, selected, grid, ringOf]);

    useEffect(() => {
        setArmed(false);
        if (!pivotCell) return;
        const t = window.setTimeout(() => setArmed(true), HANDLE_DELAY_MS);
        return () => window.clearTimeout(t);
    }, [pivotCell]);

    useEffect(() => {
        const prev = ringRef.current;
        if (prev) {
            prev.cells.forEach(c => {
                const el = tileEl(c.id);
                if (el) { el.style.transition = ''; el.style.transform = ''; }
            });
        }
        previewRef.current = 0;
        setPreviewSteps(0);
        if (pivotCell && armed && phase !== 'over') {
            const cells = ringOf(pivotCell);
            ringRef.current = {
                pivotId: pivotCell.id,
                cells,
                slots: cells.map(c => ({ x: cellX(c), y: cellY(c) })),
                n: cells.length,
            };
        } else {
            ringRef.current = null;
        }
    }, [pivotCell, armed, phase, ringOf, tileEl]);

    const ringIds = useMemo(() => {
        if (!pivotCell || !armed) return new Set<string>();
        return new Set(ringOf(pivotCell).map(c => c.id));
    }, [pivotCell, armed, ringOf]);

    // ---------- rotation preview / commit ----------

    const applyPreviewTransforms = useCallback((p: number, withTransition: boolean) => {
        const ring = ringRef.current;
        if (!ring) return;
        const k = Math.floor(p);
        const f = p - k;
        ring.cells.forEach((c, i) => {
            if (!c.letter) return;
            const el = tileEl(c.id);
            if (!el) return;
            const a = ring.slots[mod(i + k, ring.n)];
            const b = ring.slots[mod(i + k + 1, ring.n)];
            const x = a.x + (b.x - a.x) * f;
            const y = a.y + (b.y - a.y) * f;
            el.style.transition = withTransition ? 'transform 140ms cubic-bezier(0.3, 0.9, 0.4, 1)' : '';
            el.style.transform = `translate(${x - ring.slots[i].x}px, ${y - ring.slots[i].y}px)`;
        });
    }, [tileEl]);

    const clearPreviewTransforms = useCallback((withTransition: boolean) => {
        const ring = ringRef.current;
        if (!ring) return;
        ring.cells.forEach(c => {
            const el = tileEl(c.id);
            if (el) {
                el.style.transition = withTransition ? 'transform 140ms cubic-bezier(0.3, 0.9, 0.4, 1)' : '';
                el.style.transform = '';
            }
        });
    }, [tileEl]);

    const bumpPreview = useCallback((d: number) => {
        if (!ringRef.current) return;
        previewRef.current += d;
        setPreviewSteps(previewRef.current);
        applyPreviewTransforms(previewRef.current, true);
        haptics.select();
    }, [applyPreviewTransforms]);

    const resetPreview = useCallback(() => {
        if (previewRef.current === 0) return;
        previewRef.current = 0;
        setPreviewSteps(0);
        clearPreviewTransforms(true);
    }, [clearPreviewTransforms]);

    // Spends a spin: rotates the ring without ending the turn
    const commitRotation = useCallback((k: number, fromP: number) => {
        const ring = ringRef.current;
        if (!ring || phase === 'over') return;
        const kk = mod(k, ring.n);
        if (kk === 0) return;
        pushUndo('spin');

        const kf = Math.floor(fromP);
        const ff = fromP - kf;
        ring.cells.forEach((c, i) => {
            if (!c.letter) return;
            const a = ring.slots[mod(i + kf, ring.n)];
            const b = ring.slots[mod(i + kf + 1, ring.n)];
            const cur = { x: a.x + (b.x - a.x) * ff, y: a.y + (b.y - a.y) * ff };
            const dstIdx = mod(i + k, ring.n);
            const dst = ring.slots[dstIdx];
            const dx = cur.x - dst.x;
            const dy = cur.y - dst.y;
            if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                queueMove(ring.cells[dstIdx].id, dx, dy);
            }
        });
        clearPreviewTransforms(false);

        const newGrid = grid.map(c => ({ ...c }));
        const find = (id: string) => newGrid.find(c => c.id === id)!;
        ring.cells.forEach((src, i) => {
            const dst = find(ring.cells[mod(i + k, ring.n)].id);
            dst.letter = src.letter;
            dst.isPlaced = src.isPlaced;
        });
        previewRef.current = 0;
        setPreviewSteps(0);
        setSelected([]);
        setMatch(null);
        setSpins(s => Math.max(0, s - 1));
        haptics.success();
        setGrid(newGrid);
    }, [phase, grid, queueMove, clearPreviewTransforms, pushUndo]);

    // ---------- drag (the dial) ----------

    const pointerAngle = useCallback((clientX: number, clientY: number) => {
        const d = dragRef.current!;
        return Math.atan2(clientY - d.pivotCy, clientX - d.pivotCx) * 180 / Math.PI;
    }, []);

    const onBoardPointerDown = useCallback((e: React.PointerEvent) => {
        const ring = ringRef.current;
        if (!ring || phase === 'over') return;
        const pivotWrapper = boardRef.current?.querySelector<HTMLElement>(`[data-ocell="${CSS.escape(ring.pivotId)}"]`);
        if (!pivotWrapper) return;
        const r = pivotWrapper.getBoundingClientRect();
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
        const unit = r.width / TILE_W;
        if (dist < 0.55 * PITCH_X * unit || dist > 1.7 * PITCH_X * unit) return;
        dragRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            pivotCx: cx,
            pivotCy: cy,
            active: false,
            lastAngle: 0,
            accum: previewRef.current * DEG_PER_STEP,
            lastDetent: previewRef.current,
            raf: 0,
            pendingP: previewRef.current,
        };
    }, [phase]);

    const onBoardPointerMove = useCallback((e: React.PointerEvent) => {
        const d = dragRef.current;
        if (!d || e.pointerId !== d.pointerId) return;
        if (!d.active) {
            if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD_PX) return;
            d.active = true;
            d.lastAngle = pointerAngle(d.startX, d.startY);
            suppressClickRef.current = true;
            setDragging(true);
            boardRef.current?.setPointerCapture(e.pointerId);
        }
        const ang = pointerAngle(e.clientX, e.clientY);
        let delta = ang - d.lastAngle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        d.lastAngle = ang;
        d.accum += delta;
        d.pendingP = d.accum / DEG_PER_STEP;
        const detent = Math.round(d.pendingP);
        if (detent !== d.lastDetent) {
            d.lastDetent = detent;
            haptics.select();
        }
        if (!d.raf) {
            d.raf = requestAnimationFrame(() => {
                d.raf = 0;
                applyPreviewTransforms(d.pendingP, false);
            });
        }
    }, [pointerAngle, applyPreviewTransforms]);

    const onBoardPointerUp = useCallback((e: React.PointerEvent) => {
        const d = dragRef.current;
        if (!d || e.pointerId !== d.pointerId) return;
        dragRef.current = null;
        if (!d.active) return;
        if (d.raf) cancelAnimationFrame(d.raf);
        setDragging(false);
        // The drag's own click (if any) fires synchronously after pointerup;
        // clear the suppression right after so the next real tap isn't eaten
        window.setTimeout(() => { suppressClickRef.current = false; }, 0);
        const p = d.pendingP;
        const k = Math.round(p);
        const ring = ringRef.current;
        if (!ring || mod(k, ring.n) === 0) {
            previewRef.current = 0;
            setPreviewSteps(0);
            clearPreviewTransforms(true);
            return;
        }
        commitRotation(k, p);
    }, [clearPreviewTransforms, commitRotation]);

    // ---------- wheel + keyboard ----------

    useEffect(() => {
        const el = boardRef.current;
        if (!el) return;
        let acc = 0;
        const onWheel = (e: WheelEvent) => {
            if (!ringRef.current || phase === 'over' || dragRef.current?.active) return;
            e.preventDefault();
            acc += e.deltaY;
            while (acc >= WHEEL_PER_STEP) { acc -= WHEEL_PER_STEP; bumpPreview(1); }
            while (acc <= -WHEEL_PER_STEP) { acc += WHEEL_PER_STEP; bumpPreview(-1); }
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [phase, bumpPreview]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!ringRef.current || phase === 'over') return;
            if (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowLeft') { e.preventDefault(); bumpPreview(-1); }
            else if (e.key === 'e' || e.key === 'E' || e.key === 'ArrowRight') { e.preventDefault(); bumpPreview(1); }
            else if (e.key === 'Enter' && previewRef.current !== 0) { e.preventDefault(); commitRotation(previewRef.current, previewRef.current); }
            else if (e.key === 'Escape') { resetPreview(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [phase, bumpPreview, commitRotation, resetPreview]);

    // ---------- player actions ----------

    const submit = useCallback(() => {
        if (phase === 'over' || !match || selected.length < CLUSTER_MIN) return;
        pushUndo('turn');
        const clearedCells = selected
            .map(id => grid.find(c => c.id === id))
            .filter((c): c is HexCell => !!c);

        const fx = clearedCells.map(c => ({ id: c.id, letter: c.letter, left: cellX(c), top: cellY(c) }));
        const cx = fx.reduce((s, f) => s + f.left, 0) / fx.length + TILE_W / 2;
        const cy = Math.min(...fx.map(f => f.top));
        const earnsSpin = selected.length >= SPIN_EARN_LEN && spins < SPIN_MAX;
        setClearFx(fx);
        setScoreFx({ x: cx, y: cy, text: earnsSpin ? `+${selected.length} · +1 spin` : `+${selected.length}`, key: Date.now() });
        const t1 = window.setTimeout(() => setClearFx([]), 400);
        const t2 = window.setTimeout(() => setScoreFx(null), 750);
        fxTimersRef.current.push(t1, t2);

        const { newGrid, moveSources } = clearTilesAndApplyGravity(grid, selected);
        moveSources.forEach((srcId, dstId) => {
            const src = grid.find(c => c.id === srcId);
            const dst = newGrid.find(c => c.id === dstId);
            if (src && dst) queueMove(dstId, cellX(src) - cellX(dst), cellY(src) - cellY(dst));
        });
        setScore(s => s + selected.length);
        if (earnsSpin) setSpins(s => Math.min(SPIN_MAX, s + 1));
        setWords(w => [...w, match]);
        setSelected([]);
        setMatch(null);
        if (phase === 'storm') setActionLog(log => [...log, 'word']);
        haptics.success();
        afterAction(newGrid);
    }, [phase, match, selected, grid, spins, queueMove, afterAction, pushUndo]);

    const endTurn = useCallback(() => {
        if (phase !== 'storm') return;
        pushUndo('turn');
        setSelected([]);
        setMatch(null);
        setActionLog(log => [...log, 'pass']);
        afterAction(grid.map(c => ({ ...c })));
    }, [phase, grid, afterAction, pushUndo]);

    const finish = useCallback(() => {
        if (phase !== 'cleanup') return;
        setPhase('over');
        setEndReason('finished');
    }, [phase]);

    useEffect(() => () => { fxTimersRef.current.forEach(t => window.clearTimeout(t)); }, []);

    // ---------- cluster selection ----------

    const handleCellTap = useCallback((cell: HexCell) => {
        if (phase === 'over') return;
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
        }
        if (ringRef.current && cell.id === ringRef.current.pivotId && previewRef.current !== 0) {
            commitRotation(previewRef.current, previewRef.current);
            return;
        }
        if (previewRef.current !== 0) {
            resetPreview();
        }
        if (!cell.letter) {
            setSelected([]);
            return;
        }
        const idx = selected.indexOf(cell.id);
        if (idx !== -1) {
            // Remove only if the remaining cluster stays connected
            const rest = selected.filter(id => id !== cell.id);
            if (rest.length <= 1) { setSelected(rest); return; }
            const cells = rest.map(id => grid.find(c => c.id === id)!).filter(Boolean);
            const seen = new Set<string>([cells[0].id]);
            const queue = [cells[0]];
            while (queue.length) {
                const cur = queue.shift()!;
                cells.forEach(o => {
                    if (!seen.has(o.id) && areCellsAdjacent(cur, o)) { seen.add(o.id); queue.push(o); }
                });
            }
            if (seen.size === cells.length) setSelected(rest);
            else haptics.error();
            return;
        }
        if (selected.length === 0) {
            setSelected([cell.id]);
            return;
        }
        // Cluster rule: the tile just has to touch ANY selected tile
        const touchesCluster = selected.some(id => {
            const s = grid.find(c => c.id === id);
            return s && areCellsAdjacent(cell, s);
        });
        if (touchesCluster) {
            setSelected([...selected, cell.id]);
        } else {
            setSelected([cell.id]);
        }
    }, [phase, selected, grid, commitRotation, resetPreview]);

    // Anagram validation: any ordering of the cluster's letters
    useEffect(() => {
        if (selectedLetters.length < CLUSTER_MIN) { setMatch(null); return; }
        const seq = ++validateSeqRef.current;
        loadAnagrams().then(index => {
            if (validateSeqRef.current !== seq) return;
            setMatch(index.get(sortKey(selectedLetters)) ?? null);
        });
    }, [selectedLetters]);

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
        const update = () => {
            const reserved = window.innerWidth >= 768 ? 320 : 28;
            setScale(Math.min(1, (window.innerWidth - reserved) / BOARD_W));
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    // ---------- derived ----------

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
        const text = `${title} — ${score}/${TOTAL_LETTERS} ${headline}${stranded}\n${strip}${bestWord ? `\nBest: ${bestWord.toUpperCase()}` : ''}\nhttps://waxle.netlify.app/orbit`;
        const copy = () => navigator.clipboard.writeText(text).then(
            () => toastService.success('Result copied!'),
            () => toastService.error('Could not copy')
        );
        if (navigator.share) {
            navigator.share({ text }).catch(err => {
                if (err?.name !== 'AbortError') copy();
            });
        } else {
            copy();
        }
    }, [mode, dailyNo, endReason, tilesLeft, actionLog, score, bestWord]);

    const dismissOnboarding = useCallback(() => {
        setShowOnboarding(false);
        try { localStorage.setItem(LS_ONBOARDED, '1'); } catch { /* non-fatal */ }
    }, []);

    const wordState = selectedLetters.length >= CLUSTER_MIN ? (match ? 'valid' : 'invalid') : 'neutral';
    const dailyResult = stats.results[dateStr];
    const quietRing = previewSteps !== 0 || dragging;

    const modePills = (
        <div className="flex gap-1.5" role="tablist">
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
        </div>
    );

    const nextChips = (size: string) => (
        <div className="flex gap-1">
            {nextWave.map((letter, idx) => (
                <div
                    key={`${wavesDropped}-${idx}`}
                    className={cn(
                        size,
                        'bg-bg-secondary border border-secondary/30 rounded-lg flex items-center justify-center font-semibold text-text-primary anim-chip-in'
                    )}
                    style={{ animationDelay: `${idx * 50}ms` }}
                >
                    {letter}
                </div>
            ))}
        </div>
    );

    const waveDots = (
        <div className="flex items-center gap-1" aria-label={`Wave ${wavesDropped} of ${WAVES}`}>
            {Array.from({ length: WAVES }, (_, i) => (
                <span
                    key={i}
                    className={cn('w-2 h-2 rounded-full', i < wavesDropped ? 'bg-amber' : 'bg-secondary/30')}
                />
            ))}
        </div>
    );

    return (
        <div className="flex-1 flex flex-col md:flex-row bg-bg-primary select-none">
            {/* Mobile top bar (classic flush header) */}
            <div className={cn(
                'md:hidden sticky top-0 z-10',
                'bg-bg-primary border-b border-secondary/20',
                'px-4 shadow-lg shadow-secondary/10',
                'h-[60px] flex items-center justify-between'
            )}>
                <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-text-primary tabular-nums">{score}</span>
                    <span className="text-xs text-text-secondary">/ {TOTAL_LETTERS}</span>
                </div>
                {phase === 'storm' && nextWave.length > 0 && (
                    <div className="bg-amber/10 border border-amber/20 rounded-xl px-2 py-1.5">
                        {nextChips('w-5 h-5 text-[11px]')}
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <span className={cn(
                        'flex items-center gap-0.5 text-xs font-semibold',
                        spins > 0 ? 'text-text-primary' : 'text-text-muted'
                    )}>
                        <RotateCw size={12} className="text-amber" /> {spins}
                    </span>
                    {stats.streak > 0 && (
                        <span className="flex items-center gap-0.5 text-xs font-semibold text-amber">
                            <Flame size={12} /> {stats.streak}
                        </span>
                    )}
                    {waveDots}
                </div>
            </div>

            {/* Desktop sidebar (classic game sidebar) */}
            <div className={cn(
                'hidden md:flex w-72 shrink-0 flex-col',
                'bg-bg-primary border-r border-secondary/20',
                'shadow-2xl shadow-secondary/20'
            )}>
                <div className="flex flex-col p-6 overflow-y-auto space-y-5">
                    {/* Primary score display */}
                    <div className={cn(
                        'bg-gradient-to-br from-amber/10 to-amber/5 border border-amber/20',
                        'rounded-2xl p-6 text-center shadow-lg shadow-amber/10'
                    )}>
                        <div className="text-4xl font-bold text-amber mb-1">
                            <OptimizedCounter
                                value={score}
                                duration={0.6}
                                animationType="ticker"
                                className="tabular-nums"
                                delay={0}
                            />
                        </div>
                        <div className="text-text-secondary text-sm font-medium uppercase tracking-wide">
                            Score / {TOTAL_LETTERS}
                        </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex justify-between gap-2">
                        <div className="flex-1 bg-bg-secondary border border-secondary/20 rounded-xl p-3 text-center">
                            <div className="text-xl font-semibold text-text-primary tabular-nums">
                                {wavesDropped}<span className="text-text-secondary text-sm">/{WAVES}</span>
                            </div>
                            <div className="text-xs text-text-secondary font-medium uppercase tracking-wide mt-1">Wave</div>
                        </div>
                        <div className="flex-1 bg-bg-secondary border border-secondary/20 rounded-xl p-3 text-center">
                            <div className={cn(
                                'text-xl font-semibold flex items-center justify-center gap-1',
                                spins > 0 ? 'text-text-primary' : 'text-text-muted'
                            )}>
                                <RotateCw size={16} className="text-amber" />
                                <span className="tabular-nums">{spins}</span>
                            </div>
                            <div className="text-xs text-text-secondary font-medium uppercase tracking-wide mt-1">Spins</div>
                        </div>
                        <div className="flex-1 bg-bg-secondary border border-secondary/20 rounded-xl p-3 text-center">
                            <div className="text-xl font-semibold text-text-primary flex items-center justify-center gap-1">
                                <Flame size={16} className="text-amber" />
                                <span className="tabular-nums">{stats.streak}</span>
                            </div>
                            <div className="text-xs text-text-secondary font-medium uppercase tracking-wide mt-1">Streak</div>
                        </div>
                    </div>

                    {/* Mode */}
                    <div className="flex justify-center">{modePills}</div>

                    {/* Next drop */}
                    {phase === 'storm' && nextWave.length > 0 && (
                        <div className="relative">
                            <div className="bg-amber/10 border border-amber/20 rounded-xl p-3">
                                <div className="flex items-center justify-center">{nextChips('w-7 h-7 text-xs')}</div>
                            </div>
                            <div className="absolute -top-3 left-4">
                                <span className="bg-bg-primary px-2 text-xs font-medium text-amber uppercase tracking-wide">Next</span>
                            </div>
                        </div>
                    )}

                    {/* Current cluster */}
                    <div className="relative">
                        <div className={cn(
                            'text-lg font-mono font-bold text-center rounded-xl p-3 transition-colors duration-200',
                            wordState === 'invalid'
                                ? 'text-red-500 bg-red-500/10 border border-red-500/30'
                                : 'text-amber bg-amber/10 border border-amber/30'
                        )}>
                            {match
                                ? <>{match.toUpperCase()}<span className="ml-2 text-sm">+{selected.length}</span></>
                                : (selectedLetters || <span className="text-text-muted text-sm font-sans font-normal italic">no tiles selected</span>)}
                        </div>
                        <div className="absolute -top-3 left-4">
                            <span className="bg-bg-primary px-2 text-xs font-medium text-amber uppercase tracking-wide">Current</span>
                        </div>
                    </div>

                    {/* Found words */}
                    <div className="relative">
                        <div className="bg-success/10 border border-success/20 rounded-xl p-4 pt-5">
                            {words.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                    {words.slice(-12).map((w, i) => (
                                        <span key={i} className="text-xs font-mono text-text-secondary bg-success/5 px-2 py-0.5 rounded-lg">
                                            {w.toUpperCase()}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-text-muted italic text-center py-1">No words found yet</div>
                            )}
                        </div>
                        <div className="absolute -top-3 left-4">
                            <span className="bg-bg-primary px-2 text-xs font-medium text-amber uppercase tracking-wide">
                                Found ({words.length})
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main play area */}
            <div className="flex-1 flex flex-col items-center px-3 pt-4 pb-8">
                {/* Board */}
                <div style={{ width: BOARD_W * scale, height: BOARD_H * scale }}>
                    <div
                        ref={boardRef}
                        className={cn('relative', armed && pivotCell && 'touch-none', dragging && 'orbit-dragging')}
                        style={{ width: BOARD_W, height: BOARD_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                        onPointerDown={onBoardPointerDown}
                        onPointerMove={onBoardPointerMove}
                        onPointerUp={onBoardPointerUp}
                        onPointerCancel={onBoardPointerUp}
                    >
                        {pivotCell && armed && phase !== 'over' && (
                            <svg
                                className="orbit-guide"
                                width={GUIDE_R * 2 + 12}
                                height={GUIDE_R * 2 + 12}
                                style={{
                                    left: cellX(pivotCell) + TILE_W / 2 - GUIDE_R - 6,
                                    top: cellY(pivotCell) + TILE_H / 2 - GUIDE_R - 6,
                                }}
                                aria-hidden="true"
                            >
                                <circle
                                    cx={GUIDE_R + 6}
                                    cy={GUIDE_R + 6}
                                    r={GUIDE_R}
                                    fill="none"
                                    stroke="rgba(245, 158, 11, 0.45)"
                                    strokeWidth="2"
                                    strokeDasharray="7 6"
                                />
                            </svg>
                        )}

                        {grid.map(cell => {
                            const isSelected = selected.includes(cell.id);
                            const inRing = ringIds.has(cell.id);
                            const isPivot = pivotCell?.id === cell.id && armed;
                            return (
                                <div
                                    key={cell.id}
                                    data-ocell={cell.id}
                                    data-letter={cell.letter}
                                    onClick={() => handleCellTap(cell)}
                                    className={cn(
                                        'orbit-cell',
                                        inRing && 'orbit-cell--ring',
                                        inRing && quietRing && 'orbit-cell--quiet'
                                    )}
                                    style={{ left: cellX(cell), top: cellY(cell), width: TILE_W, height: TILE_H }}
                                >
                                    <div className="orbit-hexbg" />
                                    {cell.letter && (
                                        <div className={cn(
                                            'orbit-tile',
                                            isSelected && (wordState === 'invalid' ? 'orbit-tile--invalid' : 'orbit-tile--selected'),
                                            isPivot && 'orbit-tile--pivot'
                                        )}>
                                            {cell.letter}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

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
                    </div>
                </div>

                {/* Spin status / current word (word mirrors the sidebar on mobile) */}
                <div className="h-9 mt-3 mb-1 flex items-center">
                    {previewSteps !== 0 ? (
                        <span className="text-xs font-medium text-amber">
                            Spun {Math.abs(previewSteps)} step{Math.abs(previewSteps) === 1 ? '' : 's'} — tap the centre tile or press Enter to settle, Esc to cancel
                        </span>
                    ) : selectedLetters ? (
                        <span className={cn(
                            'md:hidden px-4 py-1 rounded-xl font-mono font-bold text-lg',
                            wordState === 'valid' && 'text-amber bg-amber/10',
                            wordState === 'invalid' && 'text-red-500 bg-red-500/10',
                            wordState === 'neutral' && 'text-text-secondary bg-secondary/10'
                        )}>
                            {match
                                ? <>{match.toUpperCase()}<span className="ml-2 text-sm">+{selected.length}</span></>
                                : selectedLetters}
                        </span>
                    ) : (
                        <span className="text-xs text-text-muted italic">
                            Tap touching tiles in any order · drag around a tile to spin
                        </span>
                    )}
                </div>
                <div className="flex gap-2 items-center">
                    <Button
                        onClick={undo}
                        disabled={!canUndo}
                        variant="secondary"
                        size="gameControl"
                        className="gap-1 relative"
                        aria-label={mode === 'daily' ? `Undo (${Math.max(0, undosLeft)} left)` : 'Undo'}
                    >
                        <Undo2 className="w-4 h-4" />
                        {mode === 'daily' && (
                            <span className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center bg-secondary/30">
                                {Math.max(0, undosLeft)}
                            </span>
                        )}
                    </Button>
                    {phase === 'storm' && (
                        <Button onClick={endTurn} variant="destructive" size="gameControl">
                            End Turn
                        </Button>
                    )}
                    <Button onClick={submit} disabled={!match || phase === 'over'} size="gameControl">
                        Submit
                    </Button>
                    {phase === 'cleanup' && (
                        <Button onClick={finish} variant="secondary" size="gameControl">
                            Finish
                        </Button>
                    )}
                </div>

                {/* Mobile-only: mode pills + found words */}
                <div className="md:hidden mt-4 flex flex-col items-center gap-3">
                    {modePills}
                    {words.length > 0 && phase !== 'over' && (
                        <div className="relative max-w-md">
                            <div className="bg-success/10 border border-success/20 rounded-xl px-3 py-2 flex flex-wrap gap-1.5 justify-center">
                                {words.slice(-10).map((w, i) => (
                                    <span key={i} className="text-xs font-mono text-text-secondary bg-success/5 px-2 py-0.5 rounded-lg">
                                        {w.toUpperCase()}
                                    </span>
                                ))}
                            </div>
                            <div className="absolute -top-2 left-3">
                                <span className="bg-bg-primary px-1.5 text-[10px] font-medium text-amber uppercase tracking-wide">
                                    Found ({words.length})
                                </span>
                            </div>
                        </div>
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
                                    ? <>{dailyResult.wordCount} {dailyResult.wordCount === 1 ? 'word' : 'words'}{dailyResult.best && <> · best <span className="font-mono font-semibold">{dailyResult.best.toUpperCase()}</span></>}{dailyResult.stranded > 0 && <> · {dailyResult.stranded} stranded</>}</>
                                    : <>{words.length} {words.length === 1 ? 'word' : 'words'}{bestWord && <> · best <span className="font-mono font-semibold">{bestWord.toUpperCase()}</span></>}{endReason !== 'swept' && tilesLeft > 0 && <> · {tilesLeft} stranded</>}</>}
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
                                <p><span className="text-lg mr-2">🔤</span><span className="font-semibold text-text-primary">Build words.</span> Tap touching tiles in any order — if the letters spell a word, Submit clears them.</p>
                                <p><span className="text-lg mr-2">🔄</span><span className="font-semibold text-text-primary">Spin wisely.</span> Drag around a tile to spin its ring. You have {SPIN_START} spins — words of {SPIN_EARN_LEN}+ letters earn one back.</p>
                                <p><span className="text-lg mr-2">🌊</span><span className="font-semibold text-text-primary">Beat the flood.</span> Every word or pass drops a bigger wave — survive {WAVES}, then empty the board for a Clean Sweep.</p>
                            </div>
                            <Button onClick={dismissOnboarding} className="w-full">Let's go</Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrbitGame;
