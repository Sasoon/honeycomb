import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, type CSSProperties } from 'react';
import { AlertTriangle, BarChart3, Check, ChevronDown, CircleHelp, Hourglass, RotateCcw, SkipForward, Undo2, Volume2, VolumeX } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { OptimizedCounter } from '../components/OptimizedCounter';
import { HexCell } from '../components/HexGrid';
import { HelpModal } from '../components/orbit/HelpModal';
import { ResultsModal } from '../components/orbit/ResultsModal';
import { loadDictionary, peekDictionary } from '../lib/wordValidator';
import {
    COLS,
    DAILY_UNDOS,
    FREE_SPINS,
    RING_OFFSETS,
    ROW_COUNTS,
    SEED_TILES,
    WORD_MIN,
    actionStrip,
    boardFromLetters,
    boardLetters,
    buildBoard,
    dayNumber,
    loadStats,
    canExtend,
    clearAndSettle,
    isAdjacent,
    leapOver,
    letterValue,
    longestWord,
    orbitFlood,
    outSpelled,
    overflowCount,
    placementRng,
    saveStats,
    summarizeStats,
    scoreWord,
    todayStr,
    waveSize,
    waveTag,
    waveTiles,
    type Action,
    type BoardLetters,
    type DailyResult,
    type OrbitStats,
} from '../lib/orbit';
import toastService from '../lib/toastService';
import { haptics } from '../lib/haptics';
import { keyedTiles, leapGlyph, unit } from '../lib/orbitKeys';
import { sfx } from '../lib/sfx';

const FLOOD_STAGGER_MS = 50;
const HANDLE_DELAY_MS = 250;
const DRAG_THRESHOLD_PX = 8;
const DEG_PER_STEP = 60;
const WHEEL_PER_STEP = 40;
// Let the final wave land before the results sheet covers it
const RESULTS_DELAY_MS = 1100;

// Callouts for big plays, by word length
const praiseFor = (len: number, gems: number, points: number) =>
    len >= 8 ? 'Legendary!' : len >= 7 ? 'Superb!' : points >= 60 ? 'Jackpot!'
        : len >= 6 ? 'Great!' : gems > 0 ? 'Golden!' : len >= 5 ? 'Nice!' : null;

// v11: leap words (older saved runs are dropped)
const LS_RUN_DAILY = 'waxle-orbit-run-v11';
const LS_RUN_PRACTICE = 'waxle-orbit-practice-v3';
const LS_ONBOARDED = 'waxle-orbit-onboarded-v7';
const LS_MODE = 'waxle-orbit-mode';
const LS_NAME = 'waxle-player-name';

// Classic tile metrics (70px tiles, uniform hex lattice spacing)
const TILE_W = 70;
const TILE_H = 80;
const PITCH_X = 76;
const PITCH_Y = 65;
const BOARD_W = (COLS - 1) * PITCH_X + TILE_W;
const BOARD_H = (ROW_COUNTS.length - 1) * PITCH_Y + TILE_H;

const cellX = (c: HexCell) => c.position.col * PITCH_X;
const cellY = (c: HexCell) => c.position.row * PITCH_Y;
const mod = (a: number, n: number) => ((a % n) + n) % n;
// Magnetic detents for the dial: remap the fractional step so tiles dwell
// in slots and snap quickly across the gaps between them
const SNAP_K = 5;
const SNAP_NORM = 2 * Math.tanh(SNAP_K / 2);
const snapF = (f: number) => 0.5 + Math.tanh((f - 0.5) * SNAP_K) / SNAP_NORM;

// Word order as light: selected tiles ramp from a cooled teal on the first
// tap to full accent on the newest, so direction reads at a glance
const RAMP = { valid: ['#1B8F84', '#3FD8C7'], invalid: ['#33435A', '#5A6C84'] } as const;
const hexRgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function trailColor(i: number, n: number, invalid: boolean): string {
    const [a, b] = RAMP[invalid ? 'invalid' : 'valid'].map(hexRgb);
    const t = n <= 1 ? 1 : i / (n - 1);
    return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * t)).join(',')})`;
}
const centreOf = (c: HexCell): [number, number] => [cellX(c) + TILE_W / 2, cellY(c) + TILE_H / 2];

type Phase = 'storm' | 'over';
type Mode = 'daily' | 'practice';
type Modal = 'help' | 'results' | null;
type PendingAnim = { keyframes: Keyframe[]; duration: number; delay: number; easing?: string };
type ClearFx = { id: string; letter: string; left: number; top: number };
type RingInfo = { pivotId: string; cells: HexCell[]; slots: Array<{ x: number; y: number }>; n: number };
type Snapshot = {
    kind: 'spin' | 'turn';
    letters: BoardLetters;
    phase: Phase;
    wavesDropped: number;
    spins: number;
    score: number;
    words: string[];
    actionLog: Action[];
};
type SavedRun = Omit<Snapshot, 'kind'> & {
    dateStr?: string;
    seedStr: string;
    undoStack: Snapshot[];
    undosUsed: number;
};

const runKey = (m: Mode) => (m === 'daily' ? LS_RUN_DAILY : LS_RUN_PRACTICE);

function readRun(m: Mode): SavedRun | null {
    try {
        const raw = localStorage.getItem(runKey(m));
        if (!raw) return null;
        const run = JSON.parse(raw) as SavedRun;
        return run && typeof run.seedStr === 'string' && Array.isArray(run.letters) ? run : null;
    } catch {
        return null;
    }
}

const storage = {
    get(key: string) {
        try { return localStorage.getItem(key); } catch { return null; }
    },
    set(key: string, value: string) {
        try { localStorage.setItem(key, value); } catch { /* storage full/blocked */ }
    },
    remove(key: string) {
        try { localStorage.removeItem(key); } catch { /* non-fatal */ }
    },
};

// Open straight into the daily until it's done; after that, wherever the
// player last was
function initialMode(): Mode {
    if (!loadStats().results[todayStr()]) return 'daily';
    return storage.get(LS_MODE) === 'practice' ? 'practice' : 'daily';
}

const OrbitGame = () => {
    const [mode, setMode] = useState<Mode>('daily');
    const [dateStr, setDateStr] = useState(todayStr);
    const [seedStr, setSeedStr] = useState('');
    const [grid, setGrid] = useState<HexCell[]>([]);
    const [phase, setPhase] = useState<Phase>('storm');
    const [wavesDropped, setWavesDropped] = useState(0);
    // Spins made this turn: the first is free, each extra adds a tile to this wave
    const [spins, setSpins] = useState(0);
    const [score, setScore] = useState(0);
    const [words, setWords] = useState<string[]>([]);
    const [actionLog, setActionLog] = useState<Action[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [armed, setArmed] = useState(false);
    const [statsOpen, setStatsOpen] = useState(false);
    const [previewSteps, setPreviewSteps] = useState(0);
    const [dragging, setDragging] = useState(false);
    const [clearFx, setClearFx] = useState<ClearFx[]>([]);
    const [scoreFx, setScoreFx] = useState<{ x: number; y: number; text: string; key: number } | null>(null);
    const [praise, setPraise] = useState<{ text: string; key: number } | null>(null);
    const [soundOn, setSoundOn] = useState(() => !sfx.muted);
    const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
    const [undosUsed, setUndosUsed] = useState(0);
    const [stats, setStats] = useState<OrbitStats>(loadStats);
    const [dict, setDict] = useState<Set<string> | null>(peekDictionary);
    const [modal, setModal] = useState<Modal>(() => (storage.get(LS_ONBOARDED) ? null : 'help'));

    const boardRef = useRef<HTMLDivElement>(null);
    const pendingAnimsRef = useRef<Map<string, PendingAnim>>(new Map());
    const fxTimersRef = useRef<number[]>([]);
    const resultsTimerRef = useRef(0);
    const recordedRef = useRef(false);
    const modeRef = useRef<Mode>('daily');
    const initRef = useRef(false);
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

    // Moves overshoot the slot slightly and settle back — tiles land with
    // weight instead of stopping dead
    const queueMove = useCallback((id: string, dx: number, dy: number) => {
        pendingAnimsRef.current.set(id, {
            keyframes: [
                { transform: `translate(${dx}px, ${dy}px)`, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
                { transform: `translate(${-dx * 0.07}px, ${-dy * 0.07}px)`, offset: 0.7, easing: 'ease-out' },
                { transform: 'translate(0, 0)' },
            ],
            duration: 270,
            delay: 0,
        });
    }, []);

    const queueFloodAnims = useCallback((newGrid: HexCell[], paths: Record<string, string[]>) => {
        const byId = new Map(newGrid.map(c => [c.id, c]));
        const specs = newGrid.filter(c => c.placedThisTurn).map(c => {
            const ids = paths[c.id]?.length ? paths[c.id] : [c.id];
            const pts = ids
                .map(id => byId.get(id))
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
            // The descent fills the first 80% of the timeline; the tail is a
            // squash-and-settle pop so tiles land with weight
            const kfs: Keyframe[] = pts.map((p, i) => ({
                transform: `translate(${p.x - last.x}px, ${p.y - last.y}px) scale(1)`,
                opacity: i === 0 ? 0 : 1,
                offset: (1 - Math.sqrt(1 - cum[i] / total)) * 0.8,
                easing: 'linear',
            }));
            kfs.push(
                { transform: 'translate(0, 0) scale(1.09)', opacity: 1, offset: 0.9, easing: 'ease-out' },
                { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 1 }
            );
            pendingAnimsRef.current.set(spec.cellId, {
                keyframes: kfs,
                duration: Math.min(660, Math.max(360, 150 * Math.sqrt(total / TILE_H) + 100)),
                delay: idx * FLOOD_STAGGER_MS,
            });
        });
    }, []);

    const clearTransient = useCallback(() => {
        window.clearTimeout(resultsTimerRef.current);
        pendingAnimsRef.current.clear();
        setSelected([]);
        setClearFx([]);
        setScoreFx(null);
    }, []);

    // ---------- init / restore / persistence ----------

    const applyRun = useCallback((run: SavedRun) => {
        recordedRef.current = false;
        setSeedStr(run.seedStr);
        setGrid(boardFromLetters(run.letters));
        setPhase(run.phase);
        setWavesDropped(run.wavesDropped);
        setSpins(run.spins ?? 0);
        setScore(run.score);
        setWords(run.words);
        setActionLog(run.actionLog);
        setUndoStack(run.undoStack || []);
        setUndosUsed(run.undosUsed || 0);
    }, []);

    const startFresh = useCallback((m: Mode) => {
        clearTransient();
        const seed = m === 'daily' ? dateStr : `practice-${Math.floor(Math.random() * 1e9)}`;
        const { newGrid, paths } = orbitFlood(buildBoard(), waveTiles(seed, 'seed', SEED_TILES), placementRng(seed, 'seed'));
        queueFloodAnims(newGrid, paths);
        recordedRef.current = false;
        setSeedStr(seed);
        setGrid(newGrid);
        setSpins(0);
        setPhase('storm');
        setWavesDropped(0);
        setScore(0);
        setWords([]);
        setActionLog([]);
        setUndoStack([]);
        setUndosUsed(0);
        setModal(md => (md === 'results' ? null : md));
    }, [dateStr, clearTransient, queueFloodAnims]);

    const enterMode = useCallback((m: Mode, showResults = false) => {
        modeRef.current = m;
        setMode(m);
        storage.set(LS_MODE, m);
        clearTransient();
        if (m === 'daily') {
            const result = loadStats().results[dateStr];
            if (result) {
                recordedRef.current = true;
                setSeedStr(dateStr);
                setGrid(result.board ? boardFromLetters(result.board) : buildBoard());
                setPhase('over');
                setScore(result.score);
                setWords(result.words ?? (result.best ? [result.best] : []));
                setActionLog(result.strip);
                setWavesDropped(result.waves ?? 0);
                setSpins(0);
                setUndoStack([]);
                setUndosUsed(0);
                if (showResults) setModal(md => md ?? 'results');
                return;
            }
        }
        const run = readRun(m);
        if (run && run.phase !== 'over' && (m === 'practice' || run.dateStr === dateStr)) {
            applyRun(run);
            setModal(md => (md === 'results' ? null : md));
            return;
        }
        startFresh(m);
    }, [dateStr, clearTransient, applyRun, startFresh]);

    // Mount opens the right mode; a new calendar day reloads the daily
    useEffect(() => {
        if (!initRef.current) {
            initRef.current = true;
            enterMode(initialMode(), true);
        } else if (modeRef.current === 'daily') {
            enterMode('daily');
        }
    }, [enterMode]);

    useEffect(() => {
        const check = () => {
            const t = todayStr();
            setDateStr(d => (d === t ? d : t));
        };
        const iv = window.setInterval(check, 30000);
        document.addEventListener('visibilitychange', check);
        window.addEventListener('focus', check);
        return () => {
            window.clearInterval(iv);
            document.removeEventListener('visibilitychange', check);
            window.removeEventListener('focus', check);
        };
    }, []);

    useEffect(() => {
        if (grid.length === 0 || !seedStr) return;
        if (phase === 'over') {
            if (mode === 'practice') storage.remove(LS_RUN_PRACTICE);
            return;
        }
        const run: SavedRun = {
            dateStr: mode === 'daily' ? dateStr : undefined,
            seedStr,
            phase,
            wavesDropped,
            spins,
            score,
            words,
            actionLog,
            letters: boardLetters(grid),
            undoStack,
            undosUsed,
        };
        storage.set(runKey(mode), JSON.stringify(run));
    }, [mode, dateStr, seedStr, grid, phase, wavesDropped, spins, score, words, actionLog, undoStack, undosUsed]);

    useEffect(() => {
        if (mode !== 'daily' || phase !== 'over' || recordedRef.current) return;
        recordedRef.current = true;
        const result: DailyResult = {
            score,
            strip: actionLog,
            best: longestWord(words),
            wordCount: words.length,
            waves: wavesDropped,
            board: boardLetters(grid),
            words,
        };
        setStats(prev => {
            const next: OrbitStats = { results: { ...prev.results, [dateStr]: result } };
            saveStats(next);
            return next;
        });
        storage.remove(LS_RUN_DAILY);
    }, [mode, phase, words, score, actionLog, dateStr, wavesDropped, grid]);

    // ---------- dictionary ----------

    const ensureDict = useCallback(() => {
        if (dict) return;
        loadDictionary().then(setDict, () => {
            toastService.error("Couldn't load the word list. Check your connection.");
        });
    }, [dict]);

    useEffect(() => { ensureDict(); }, [ensureDict]);

    // ---------- game flow ----------

    // Word/pass ends the turn: the flood drops `count` tiles and the turn's
    // spin tally resets
    const afterAction = useCallback((g: HexCell[], count: number) => {
        const tag = waveTag(wavesDropped);
        const { newGrid, paths, unplaced } = orbitFlood(g, waveTiles(seedStr, tag, count), placementRng(seedStr, tag));
        queueFloodAnims(newGrid, paths);
        setWavesDropped(wavesDropped + 1);
        setSpins(0);
        setGrid(newGrid);
        sfx.land(0.3);
        if (unplaced.length > 0) {
            setPhase('over');
            haptics.error();
            window.setTimeout(() => sfx.gameOver(), 450);
            window.clearTimeout(resultsTimerRef.current);
            resultsTimerRef.current = window.setTimeout(() => setModal(md => md ?? 'results'), RESULTS_DELAY_MS);
        }
    }, [wavesDropped, seedStr, queueFloodAnims]);

    // ---------- undo ----------

    const pushUndo = useCallback((kind: 'spin' | 'turn') => {
        // Snapshot eagerly: inside the updater it would run at render time,
        // after the action has already changed the state being captured
        const snap: Snapshot = {
            kind,
            letters: boardLetters(grid),
            phase,
            wavesDropped,
            spins,
            score,
            words: [...words],
            actionLog: [...actionLog],
        };
        setUndoStack(s => [...s.slice(-9), snap]);
    }, [grid, phase, wavesDropped, spins, score, words, actionLog]);

    const undosLeft = mode === 'daily' ? DAILY_UNDOS - undosUsed : Infinity;
    const topUndo = undoStack[undoStack.length - 1];
    // Undoing a spin is free (it refunds the spin); undoing a turn costs a charge
    const canUndo = phase !== 'over' && !!topUndo && (topUndo.kind === 'spin' || undosLeft > 0);

    const undo = useCallback(() => {
        if (!canUndo) return;
        const snap = undoStack[undoStack.length - 1];
        clearTransient();
        setGrid(boardFromLetters(snap.letters));
        setPhase(snap.phase);
        setWavesDropped(snap.wavesDropped);
        setSpins(snap.spins);
        setScore(snap.score);
        setWords(snap.words);
        setActionLog(snap.actionLog);
        setUndoStack(s => s.slice(0, -1));
        if (snap.kind === 'turn') setUndosUsed(u => u + 1);
        haptics.select();
        sfx.undo();
    }, [canUndo, undoStack, clearTransient]);

    // ---------- selection + validation ----------

    const selectedLetters = useMemo(
        () => selected.map(id => grid.find(c => c.id === id)?.letter || '').join(''),
        [selected, grid]
    );

    // Validation is synchronous against the loaded word list, so the match
    // can never lag behind (or outlive) the selection it describes
    const match = useMemo(() => {
        if (selectedLetters.length < WORD_MIN || !dict) return null;
        const w = selectedLetters.toLowerCase();
        return dict.has(w) ? w : null;
    }, [selectedLetters, dict]);

    useEffect(() => {
        if (selectedLetters.length >= WORD_MIN) ensureDict();
    }, [selectedLetters, ensureDict]);

    const selectedCells = useMemo(
        () => selected.map(id => grid.find(c => c.id === id)).filter((c): c is HexCell => !!c),
        [selected, grid]
    );
    const wordScore = useMemo(
        () => (match ? scoreWord(selectedCells.map(c => c.letter), selectedCells.filter(c => c.isGem).length) : null),
        [match, selectedCells]
    );
    const currentWave = waveSize(wavesDropped, spins);

    // A chime the moment a path becomes a real word
    const prevMatchRef = useRef<string | null>(null);
    useEffect(() => {
        if (match && match !== prevMatchRef.current) sfx.valid();
        prevMatchRef.current = match;
    }, [match]);

    // ---------- ring arming ----------

    // A tile arms as a pivot only when spinning its ring would actually move
    // letters: an empty (or uniform) ring can't be spun into anything new
    const pivotCell = useMemo(() => {
        if (phase === 'over' || selected.length !== 1) return null;
        const c = grid.find(x => x.id === selected[0]);
        if (!c) return null;
        const ring = ringOf(c);
        return ring.length >= 3 && new Set(ring.map(r => r.letter)).size > 1 ? c : null;
    }, [phase, selected, grid, ringOf]);

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
        const f = snapF(p - k);
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
        sfx.spinTick();
    }, [applyPreviewTransforms]);

    const resetPreview = useCallback(() => {
        previewRef.current = 0;
        setPreviewSteps(0);
        clearPreviewTransforms(true);
    }, [clearPreviewTransforms]);

    // Orbits never end the turn, but each one permanently grows the flood
    // by one tile per wave. A spin that lands every letter back where it
    // was (full turn, or a repeating ring) is cancelled for free
    const commitRotation = useCallback((k: number, fromP: number) => {
        const ring = ringRef.current;
        if (!ring || phase === 'over') return;
        const newGrid = grid.map(c => ({ ...c }));
        const byId = new Map(newGrid.map(c => [c.id, c]));
        ring.cells.forEach((src, i) => {
            const dst = byId.get(ring.cells[mod(i + k, ring.n)].id)!;
            dst.letter = src.letter;
            dst.isGem = src.isGem;
            dst.isPlaced = src.isPlaced;
        });
        if (ring.cells.every(c => {
            const d = byId.get(c.id)!;
            return d.letter === c.letter && !!d.isGem === !!c.isGem;
        })) {
            resetPreview();
            return;
        }
        pushUndo('spin');

        const kf = Math.floor(fromP);
        // Settle from the same snapped position the preview rendered
        const ff = snapF(fromP - kf);
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

        previewRef.current = 0;
        setPreviewSteps(0);
        setSelected([]);
        haptics.success();
        sfx.spinLock(spins < FREE_SPINS);
        setSpins(n => n + 1);
        setGrid(newGrid);
    }, [phase, grid, spins, queueMove, clearPreviewTransforms, resetPreview, pushUndo]);

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
            sfx.spinTick();
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
            resetPreview();
            return;
        }
        commitRotation(k, p);
    }, [resetPreview, commitRotation]);

    // ---------- player actions ----------

    const celebrate = useCallback((len: number, gems: number, points: number) => {
        const text = praiseFor(len, gems, points);
        if (text) {
            setPraise({ text, key: Date.now() });
            const t = window.setTimeout(() => setPraise(null), 1300);
            fxTimersRef.current.push(t);
        }
        if (!reducedMotion && (len >= 7 || points >= 60)) {
            import('canvas-confetti').then(({ default: confetti }) => {
                const r = boardRef.current?.getBoundingClientRect();
                const origin = r
                    ? { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 3) / window.innerHeight }
                    : { x: 0.5, y: 0.4 };
                confetti({
                    particleCount: len >= 8 ? 140 : 80,
                    spread: 75,
                    origin,
                    colors: ['#3FD8C7', '#F2C14E', '#F2EFE8', '#6FE8DA'],
                    disableForReducedMotion: true,
                });
            }).catch(() => { /* confetti is decoration only */ });
        }
    }, [reducedMotion]);

    const submit = useCallback(() => {
        if (phase !== 'storm' || !match || !wordScore || selected.length < WORD_MIN) return;
        pushUndo('turn');
        // Out-spell the flood: a word at least as long as the wave shrinks
        // the very wave about to drop
        const incoming = outSpelled(selected.length, currentWave) ? currentWave - 1 : currentWave;
        const points = wordScore.total;

        const fx = selectedCells.map(c => ({ id: c.id, letter: c.letter, left: cellX(c), top: cellY(c) }));
        const cx = fx.reduce((sum, f) => sum + f.left, 0) / fx.length + TILE_W / 2;
        const cy = Math.min(...fx.map(f => f.top));
        setClearFx(fx);
        setScoreFx({ x: cx, y: cy, text: `+${points}${incoming < currentWave ? ' · wave −1' : ''}`, key: Date.now() });
        const t1 = window.setTimeout(() => setClearFx([]), 400);
        const t2 = window.setTimeout(() => setScoreFx(null), 900);
        fxTimersRef.current.push(t1, t2);

        const { newGrid, moveSources } = clearAndSettle(grid, selected);
        moveSources.forEach((srcId, dstId) => {
            const src = grid.find(c => c.id === srcId);
            const dst = newGrid.find(c => c.id === dstId);
            if (src && dst) queueMove(dstId, cellX(src) - cellX(dst), cellY(src) - cellY(dst));
        });
        setScore(sc => sc + points);
        setWords(w => [...w, match]);
        setSelected([]);
        setActionLog(log => [...log, selected.length]);
        haptics.success();
        sfx.word(selected.length, wordScore.gems);
        celebrate(selected.length, wordScore.gems, points);
        afterAction(newGrid, incoming);
    }, [phase, match, wordScore, selected, selectedCells, grid, currentWave, queueMove, afterAction, pushUndo, celebrate]);

    // Passing clears nothing and takes the whole wave
    const endTurn = useCallback(() => {
        if (phase !== 'storm') return;
        pushUndo('turn');
        setSelected([]);
        setActionLog(log => [...log, 'pass']);
        sfx.pass();
        afterAction(grid.map(c => ({ ...c })), currentWave);
    }, [phase, grid, currentWave, afterAction, pushUndo]);

    useEffect(() => () => {
        fxTimersRef.current.forEach(t => window.clearTimeout(t));
        window.clearTimeout(resultsTimerRef.current);
    }, []);

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
            // Tap the first tile to clear the whole selection, the last to
            // pop it, an earlier tile to trim back to it
            setSelected(
                idx === 0 ? []
                    : idx === selected.length - 1 ? selected.slice(0, -1)
                    : selected.slice(0, idx + 1)
            );
            sfx.deselect();
            return;
        }
        // Path rule: each tile touches the last one, with one leap per word
        if (canExtend(selectedCells, cell, grid)) {
            setSelected([...selected, cell.id]);
            sfx.select(selected.length);
        } else {
            setSelected([cell.id]);
            sfx.select(0);
        }
    }, [phase, selected, selectedCells, grid, commitRotation, resetPreview]);

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
            if (modal) return;
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                undo();
                return;
            }
            if (e.metaKey || e.ctrlKey || e.altKey || phase === 'over') return;
            if (ringRef.current) {
                if (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowLeft') { e.preventDefault(); bumpPreview(-1); return; }
                if (e.key === 'e' || e.key === 'E' || e.key === 'ArrowRight') { e.preventDefault(); bumpPreview(1); return; }
                if (previewRef.current !== 0) {
                    if (e.key === 'Enter') { e.preventDefault(); commitRotation(previewRef.current, previewRef.current); return; }
                    if (e.key === 'Escape') { resetPreview(); return; }
                }
            }
            if (e.key === 'Enter' && match) {
                // preventDefault also stops a focused button from firing too
                e.preventDefault();
                submit();
            } else if (e.key === 'Backspace' && selected.length) {
                e.preventDefault();
                setSelected(s => s.slice(0, -1));
            } else if (e.key === 'Escape') {
                setSelected([]);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [modal, phase, match, selected.length, undo, submit, bumpPreview, commitRotation, resetPreview]);

    // ---------- animation ----------

    useLayoutEffect(() => {
        const m = pendingAnimsRef.current;
        if (m.size === 0) return;
        if (!reducedMotion && boardRef.current) {
            m.forEach((a, id) => {
                tileEl(id)?.animate(a.keyframes, {
                    duration: a.duration,
                    delay: a.delay,
                    easing: a.easing ?? 'linear',
                    fill: 'backwards',
                });
            });
        }
        m.clear();
    }, [grid, reducedMotion, tileEl]);

    // ---------- responsive scale ----------

    // Fit the board to both axes: width after the sidebar/gutters, height
    // after the header, mobile HUD rows and the control block
    const [scale, setScale] = useState(1);
    useEffect(() => {
        const update = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            const desktop = w >= 768;
            const availW = w - (desktop ? 288 + 48 : 24);
            const availH = h - 68 - (desktop ? 0 : 60 + 48) - 150;
            setScale(Math.max(0.55, Math.min(desktop ? 1.3 : 1.1, availW / BOARD_W, availH / BOARD_H)));
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    // ---------- derived ----------

    // The NEXT strip is exactly the wave about to drop: this wave's own
    // stream, grown by extra spins this turn
    const nextWindow = useMemo(
        () => (phase === 'storm' && seedStr ? waveTiles(seedStr, waveTag(wavesDropped), currentWave) : []),
        [phase, seedStr, wavesDropped, currentWave]
    );

    // Danger: the incoming wave won't fit the board as it stands
    const overflow = useMemo(
        () => (phase === 'storm' && grid.length ? overflowCount(grid, currentWave) : 0),
        [phase, grid, currentWave]
    );
    const wasDangerRef = useRef(false);
    useEffect(() => {
        if (overflow > 0 && !wasDangerRef.current) sfx.danger();
        wasDangerRef.current = overflow > 0;
    }, [overflow]);

    const bestWord = useMemo(() => longestWord(words), [words]);
    const summary = useMemo(() => summarizeStats(stats, dateStr), [stats, dateStr]);
    const dailyNo = dayNumber(dateStr);
    const dailyResult = mode === 'daily' ? stats.results[dateStr] : undefined;
    const wordCount = dailyResult?.wordCount ?? words.length;

    const share = useCallback(() => {
        const title = mode === 'daily' ? `WAXLE Orbit #${dailyNo}` : 'WAXLE Orbit (practice)';
        const best = dailyResult?.best ?? bestWord;
        const text = [
            `${title} · ${score} pts`,
            `🌊 ${wavesDropped} waves · ${wordCount} ${wordCount === 1 ? 'word' : 'words'}`,
            actionStrip(actionLog),
            best ? `Best: ${best.toUpperCase()}` : '',
            'https://waxle.netlify.app',
        ].filter(Boolean).join('\n');
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
    }, [mode, dailyNo, dailyResult, bestWord, score, wavesDropped, wordCount, actionLog]);

    const submitScore = useCallback(async (name: string) => {
        const result = stats.results[dateStr];
        if (!result) throw new Error('No result to submit');
        const res = await fetch('/api/submit-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                game: 'orbit',
                playerName: name,
                score: result.score,
                round: Math.max(1, result.waves),
                totalWords: result.wordCount,
                longestWord: result.best,
                timeSpent: 0,
                date: dateStr,
            }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) throw new Error(data?.error || 'Submit failed');
        storage.set(LS_NAME, name);
        const submitted = { name, rank: data.dailyRank?.rank, total: data.dailyRank?.totalPlayers };
        setStats(prev => {
            const current = prev.results[dateStr];
            if (!current) return prev;
            const next: OrbitStats = { results: { ...prev.results, [dateStr]: { ...current, submitted } } };
            saveStats(next);
            return next;
        });
    }, [stats, dateStr]);

    const closeModal = useCallback(() => {
        if (modal === 'help') storage.set(LS_ONBOARDED, '1');
        setModal(null);
    }, [modal]);

    const wordState = selectedLetters.length >= WORD_MIN && dict ? (match ? 'valid' : 'invalid') : 'neutral';
    const quietRing = previewSteps !== 0 || dragging;
    const cools = !!match && outSpelled(selected.length, currentWave);
    const matchPoints = wordScore?.total ?? 0;
    const nextSpinCosts = spins >= FREE_SPINS;

    const toggleSound = () => {
        const next = !soundOn;
        sfx.setMuted(!next);
        setSoundOn(next);
        if (next) sfx.select(2);
    };

    const modePills = (
        <div className="flex gap-1.5 items-center" role="tablist" aria-label="Game mode">
            {(['daily', 'practice'] as const).map(m => (
                <button
                    key={m}
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => { if (mode !== m) enterMode(m, true); }}
                    className={cn(
                        'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
                        mode === m ? 'bg-amber text-bg-primary' : 'bg-secondary/25 text-text-secondary hover:text-text-primary'
                    )}
                >
                    {m === 'daily' ? `Daily #${dailyNo}` : 'Practice'}
                </button>
            ))}
            {mode === 'practice' && (
                <button
                    onClick={() => startFresh('practice')}
                    className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-secondary/25 transition-colors"
                    aria-label="New practice game"
                    title="New practice game"
                >
                    <RotateCcw size={14} />
                </button>
            )}
        </div>
    );

    const iconButtons = (
        <div className="flex gap-1">
            <button
                onClick={toggleSound}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-secondary/25 transition-colors"
                aria-label={soundOn ? 'Mute sound' : 'Turn sound on'}
                aria-pressed={soundOn}
            >
                {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
                onClick={() => setModal('help')}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-secondary/25 transition-colors"
                aria-label="How to play"
            >
                <CircleHelp size={18} />
            </button>
            <button
                onClick={() => setModal('results')}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-secondary/25 transition-colors"
                aria-label="Stats"
            >
                <BarChart3 size={18} />
            </button>
        </div>
    );

    const nextChips = (size: string) => (
        <div className="flex flex-wrap justify-center gap-1">
            {nextWindow.map((tile, idx) => (
                <div
                    key={`${wavesDropped}-${idx}`}
                    className={cn(
                        size,
                        'border rounded-md flex items-center justify-center font-semibold anim-chip-in',
                        tile.gem
                            ? 'bg-gold border-gold text-bg-primary'
                            : 'bg-bg-secondary border-secondary/40 text-text-primary',
                        // Tiles bought with extra spins this turn
                        idx >= currentWave - Math.max(0, spins - FREE_SPINS) && 'ring-1 ring-red-400/70'
                    )}
                    style={{ animationDelay: `${idx * 50}ms` }}
                    title={tile.gem ? 'Gold tile: doubles any word that uses it' : undefined}
                >
                    {tile.letter}
                </div>
            ))}
        </div>
    );

    const wordList = (limit: string) => words.length > 0 ? (
        <div className={cn('flex flex-wrap gap-1.5 overflow-y-auto', limit)}>
            {words.map((w, i) => (
                <span key={i} className="text-xs font-mono text-text-secondary bg-success/10 px-2 py-0.5 rounded-lg">
                    {w.toUpperCase()}
                </span>
            ))}
        </div>
    ) : (
        <div className="text-xs text-text-muted italic text-center py-1">No words found yet</div>
    );

    // Word order lives on the tiles: each tile keys into the next (the seam
    // between them bends into a chevron along the word), the teal ramp runs
    // from the first tap to the newest, and a leap puts a double chevron on
    // the tile it left and the tile it reached. While the leap is unused, the
    // tiles it could reach show that chevron ghosted
    const trail = useMemo(() => {
        const n = selectedCells.length;
        const byId = new Map(grid.map(c => [c.id, c]));
        const centre = (id: string) => centreOf(byId.get(id)!);
        const keyed = keyedTiles(selected, centre, (a, b) => isAdjacent(byId.get(a)!, byId.get(b)!));
        const leapTaken = selectedCells.some((c, i) => i > 0 && !isAdjacent(selectedCells[i - 1], c));
        const ghosts = new Map<string, string>();
        if (n && !leapTaken && phase === 'storm') {
            const last = selectedCells[n - 1];
            grid.forEach(c => {
                if (c.letter && !keyed.has(c.id) && leapOver(last, c, grid)) {
                    ghosts.set(c.id, leapGlyph(unit(centreOf(last), centreOf(c)), true));
                }
            });
        }
        return { n, keyed, ghosts };
    }, [selected, selectedCells, grid, phase]);
    const invalidWord = wordState === 'invalid';

    let status: React.ReactNode;
    if (previewSteps !== 0) {
        status = (
            <span className="text-xs font-medium text-amber text-center">
                Tap the centre tile to lock it in{nextSpinCosts ? ' (+1 tile this wave)' : ' (free spin)'}
                <span className="hidden md:inline"> · Enter to lock, Esc to cancel</span>
            </span>
        );
    } else if (selectedLetters) {
        status = (
            <span className={cn(
                'px-4 py-1 rounded-xl font-bold text-lg tracking-[0.12em] flex items-center gap-2',
                wordState === 'valid' && 'text-amber bg-amber/10',
                wordState === 'invalid' && 'text-slate-300 bg-secondary/25',
                wordState === 'neutral' && 'text-text-primary bg-secondary/20'
            )}>
                {selectedLetters}
                {wordScore ? (
                    <span className="text-sm font-semibold tracking-normal flex items-baseline gap-1.5">
                        +{wordScore.total}
                        <span className="text-[11px] text-text-secondary font-medium">
                            {wordScore.letters}
                            {wordScore.lengthMult > 1 && ` ×${wordScore.lengthMult}`}
                            {wordScore.gems > 0 && <span className="text-gold"> ×{2 ** wordScore.gems}</span>}
                            {cools && ' · wave −1'}
                        </span>
                    </span>
                ) : invalidWord ? (
                    <span className="text-xs font-semibold tracking-normal text-red-300">not a word</span>
                ) : null}
            </span>
        );
    } else if (phase === 'over') {
        status = <span className="text-xs text-text-muted">The board is full. Tap Results to see how you did.</span>;
    } else if (overflow > 0) {
        status = (
            <span className="text-xs font-semibold text-red-400 text-center flex items-center gap-1.5 orbit-danger-text">
                <AlertTriangle size={14} />
                {overflow === 1 ? '1 tile' : `${overflow} tiles`} won't fit. Clear space or the run ends!
            </span>
        );
    } else {
        status = (
            <span className="text-xs text-text-muted italic text-center">
                Tap tiles in order · leap one tile per word · drag around a tile to spin
            </span>
        );
    }
    const pivotHint = armed && pivotCell && previewSteps === 0 && !dragging;

    return (
        <div className="flex-1 flex flex-col md:flex-row bg-bg-primary select-none">
            {/* Mobile top bar (tap to expand the word list) */}
            <div className="md:hidden sticky top-0 z-30 w-full">
                <div
                    role="button"
                    className={cn(
                        'relative w-full bg-bg-primary border-b border-secondary/30 cursor-pointer',
                        'px-4 shadow-lg shadow-black/20',
                        'active:bg-bg-secondary/50',
                        'h-[60px] flex items-center justify-between'
                    )}
                    onClick={() => setStatsOpen(o => !o)}
                    aria-expanded={statsOpen}
                    aria-label={`${score} points, wave ${wavesDropped}. Show words found`}
                >
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-text-primary tabular-nums">{score}</span>
                        <span className="text-xs text-text-secondary">pts</span>
                    </div>
                    {phase === 'storm' && nextWindow.length > 0 && (
                        <div className={cn(
                            'absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 border rounded-xl px-2 py-1 max-w-[62%]',
                            overflow > 0 ? 'bg-red-500/15 border-red-400/60 orbit-danger' : 'bg-amber/10 border-amber/25'
                        )}>
                            <span className={cn('text-[9px] font-semibold uppercase tracking-wider', overflow > 0 ? 'text-red-400' : 'text-amber')}>Next</span>
                            {nextChips(nextWindow.length >= 7 ? 'w-4 h-4 text-[10px]' : nextWindow.length >= 6 ? 'w-5 h-5 text-[11px]' : 'w-6 h-6 text-xs')}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-text-secondary">
                            <Hourglass size={14} className="text-amber" />
                            <span className="text-sm font-semibold tabular-nums">{wavesDropped}</span>
                        </span>
                        <div className={cn(
                            'p-1 rounded-lg bg-secondary/20 transition-transform duration-200',
                            statsOpen && 'rotate-180'
                        )}>
                            <ChevronDown size={16} className="text-text-secondary" />
                        </div>
                    </div>
                </div>
                {/* Expandable word list: clipped compositor slide */}
                <div className="absolute left-0 right-0 top-full overflow-hidden pointer-events-none">
                    <div className={cn(
                        'mobile-stats-panel bg-bg-primary border-b border-secondary/30',
                        'shadow-xl shadow-black/30',
                        statsOpen && 'show pointer-events-auto'
                    )}>
                        <div className="p-4">
                            <div className="bg-success/10 border border-success/25 rounded-2xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-text-primary">Words found</h3>
                                    <span className="bg-success/20 text-text-primary px-2 py-0.5 rounded-full text-xs font-medium">
                                        {words.length}
                                    </span>
                                </div>
                                {wordList('max-h-28')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Desktop sidebar */}
            <aside className={cn(
                'hidden md:flex w-72 shrink-0 flex-col',
                'bg-bg-primary border-r border-secondary/30',
                'shadow-2xl shadow-black/20'
            )}>
                <div className="flex flex-col p-6 overflow-y-auto space-y-5 flex-1">
                    <div className={cn(
                        'bg-gradient-to-br from-amber/10 to-amber/5 border border-amber/25',
                        'rounded-2xl p-6 text-center shadow-lg shadow-amber/5'
                    )}>
                        <div className="text-4xl font-bold text-amber mb-1">
                            <OptimizedCounter value={score} duration={0.6} animationType="ticker" className="tabular-nums" delay={0} />
                        </div>
                        <div className="text-text-secondary text-sm font-medium uppercase tracking-wide">Score</div>
                    </div>

                    <div className="bg-bg-secondary border border-secondary/30 rounded-xl p-3 text-center">
                        <div className="text-xl font-semibold text-text-primary flex items-center justify-center gap-1.5">
                            <Hourglass size={16} className="text-amber" />
                            <span className="tabular-nums">{wavesDropped}</span>
                        </div>
                        <div className="text-xs text-text-secondary font-medium uppercase tracking-wide mt-1">Wave</div>
                    </div>

                    <div className="flex justify-center">{modePills}</div>

                    {phase === 'storm' && nextWindow.length > 0 && (
                        <div className="relative">
                            <div className={cn(
                                'border rounded-xl p-3 pt-4',
                                overflow > 0 ? 'bg-red-500/15 border-red-400/60 orbit-danger' : 'bg-amber/10 border-amber/25'
                            )}>
                                {nextChips(nextWindow.length >= 8 ? 'w-5 h-5 text-[11px]' : 'w-7 h-7 text-sm')}
                                <p className="text-[11px] text-text-secondary text-center mt-2">
                                    {spins === 0 ? 'Free spin available' : spins > FREE_SPINS ? `+${spins - FREE_SPINS} from spins this turn` : 'Free spin used · more spins add tiles'}
                                </p>
                            </div>
                            <div className="absolute -top-3 left-4">
                                <span className="bg-bg-primary px-2 text-xs font-medium text-amber uppercase tracking-wide">
                                    Next · {nextWindow.length} tiles
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="relative">
                        <div className="bg-success/10 border border-success/25 rounded-xl p-4 pt-5">
                            {wordList('max-h-48')}
                        </div>
                        <div className="absolute -top-3 left-4">
                            <span className="bg-bg-primary px-2 text-xs font-medium text-amber uppercase tracking-wide">
                                Found ({words.length})
                            </span>
                        </div>
                    </div>

                    <div className="flex-1" />
                    <div className="flex justify-center">{iconButtons}</div>
                </div>
            </aside>

            {/* Main play area: the board group floats to the vertical centre */}
            <div className="flex-1 flex flex-col items-center px-3 py-3 md:py-4">
                <div className="md:hidden w-full max-w-[400px] flex items-center justify-between">
                    {modePills}
                    {iconButtons}
                </div>
                <div className="my-auto flex flex-col items-center w-full">
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
                            {grid.map(cell => {
                                const isSelected = selected.includes(cell.id);
                                const kt = trail.keyed.get(cell.id);
                                const ghost = previewSteps === 0 && !dragging ? trail.ghosts.get(cell.id) : undefined;
                                const cellStyle: CSSProperties = { left: cellX(cell), top: cellY(cell), width: TILE_W, height: TILE_H };
                                if (kt) {
                                    Object.assign(cellStyle, {
                                        '--tile': trailColor(kt.k, trail.n, invalidWord),
                                        ...(kt.hex ? { '--hex': kt.hex } : null),
                                    });
                                }
                                const inRing = ringIds.has(cell.id);
                                const isPivot = pivotCell?.id === cell.id && armed;
                                // Desync the ring jiggle: 31/17 mod 9 puts every hex-neighbour
                                // direction on a different phase of the 230ms cycle
                                const jigglePhase = `${-((cell.position.row * 31 + Math.round(cell.position.col * 2) * 17) % 9) * 26}ms`;
                                return (
                                    <div
                                        key={cell.id}
                                        data-ocell={cell.id}
                                        data-letter={cell.letter}
                                        onClick={() => handleCellTap(cell)}
                                        role={cell.letter ? 'button' : undefined}
                                        aria-label={cell.letter ? `${cell.letter}, ${letterValue(cell.letter)} points${cell.isGem ? ', gold' : ''}` : undefined}
                                        aria-pressed={cell.letter ? isSelected : undefined}
                                        className={cn(
                                            'orbit-cell',
                                            inRing && 'orbit-cell--ring',
                                            inRing && quietRing && 'orbit-cell--quiet',
                                            isPivot && 'orbit-cell--pivot',
                                            kt && (invalidWord ? 'orbit-cell--bad' : 'orbit-cell--sel'),
                                            kt?.isHead && trail.n > 1 && 'orbit-cell--head',
                                            cell.isGem && 'orbit-cell--gem'
                                        )}
                                        style={cellStyle}
                                    >
                                        {kt?.key && (
                                            <svg className="orbit-key" viewBox="-10 -10 90 100" aria-hidden="true">
                                                <path d={kt.key} />
                                            </svg>
                                        )}
                                        <div className="orbit-hexbg" />
                                        {cell.letter && (
                                            <div
                                                className={cn(
                                                    'orbit-tile',
                                                    cell.isGem && 'orbit-tile--gem',
                                                    isSelected && (wordState === 'invalid' ? 'orbit-tile--invalid' : 'orbit-tile--selected')
                                                )}
                                                style={{ animationDelay: jigglePhase }}
                                            >
                                                {(kt?.leap.length || ghost) && (
                                                    <svg className="orbit-cues" viewBox="0 0 70 80" aria-hidden="true">
                                                        {kt?.leap.map((d, i) => <path key={i} className="orbit-cue--leap" d={d} />)}
                                                        {ghost && <path className="orbit-cue--ghost" d={ghost} />}
                                                    </svg>
                                                )}
                                                <span className="orbit-tile__letter">{cell.letter}</span>
                                                <span className="orbit-tile__value">{letterValue(cell.letter)}</span>
                                                {kt && trail.n > 1 && (
                                                    <span className={cn(
                                                        'orbit-tile__order',
                                                        kt.isStart && 'orbit-tile__order--start',
                                                        kt.lowOrder && 'orbit-tile__order--low'
                                                    )}>
                                                        {kt.k + 1}
                                                    </span>
                                                )}
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
                                <div key={`score-${scoreFx.key}`} className="orbit-scorefx" style={{ left: scoreFx.x, top: scoreFx.y - 10 }}>
                                    {scoreFx.text}
                                </div>
                            )}
                            {praise && (
                                <div key={`praise-${praise.key}`} className="orbit-praise" aria-live="polite">
                                    {praise.text}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="min-h-10 mt-3 mb-2 flex items-center justify-center px-2" aria-live="polite">
                        {pivotHint && selected.length === 1 ? (
                            <span className="text-xs font-medium text-amber text-center">
                                Drag around it to spin · {nextSpinCosts ? 'next spin adds +1 tile to this wave' : 'first spin this turn is free'}
                            </span>
                        ) : status}
                    </div>

                    <div className="flex gap-2 w-full max-w-[360px] md:max-w-[400px]">
                        {phase === 'storm' ? (
                            <>
                                <Button
                                    onClick={undo}
                                    disabled={!canUndo}
                                    variant="secondary"
                                    className="h-12 px-3.5 shrink-0"
                                    aria-label={mode === 'daily' ? `Undo (${Math.max(0, undosLeft)} left)` : 'Undo'}
                                    title={mode === 'daily' ? 'Undo a spin for free, or a turn for one charge' : 'Undo'}
                                >
                                    <Undo2 className="w-4 h-4" />
                                    {mode === 'daily' && (
                                        <span className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center bg-secondary/40">
                                            {Math.max(0, undosLeft)}
                                        </span>
                                    )}
                                </Button>
                                <Button onClick={endTurn} variant="secondary" className="h-12 flex-1" title="Pass: drop the wave and grow the flood by one">
                                    <SkipForward className="w-4 h-4" /> Pass
                                </Button>
                                <Button onClick={submit} disabled={!match} className="h-12 flex-[1.4] text-base font-semibold">
                                    <Check className="w-5 h-5" /> Submit{match ? ` +${matchPoints}` : ''}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button onClick={() => setModal('results')} variant="secondary" className="h-12 flex-1">
                                    <BarChart3 className="w-4 h-4" /> Results
                                </Button>
                                <Button
                                    onClick={() => (mode === 'daily' ? enterMode('practice') : startFresh('practice'))}
                                    className="h-12 flex-[1.4] text-base font-semibold"
                                >
                                    {mode === 'daily' ? 'Practice' : 'Play again'}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {modal === 'help' && <HelpModal onClose={closeModal} />}
            {modal === 'results' && (
                <ResultsModal
                    onClose={closeModal}
                    mode={mode}
                    gameOver={phase === 'over'}
                    score={score}
                    waves={wavesDropped}
                    wordCount={wordCount}
                    best={dailyResult?.best ?? bestWord}
                    actionLog={actionLog}
                    summary={summary}
                    dailyResult={dailyResult}
                    onShare={share}
                    onPractice={() => enterMode('practice')}
                    onNewPractice={() => startFresh('practice')}
                    onSubmitScore={submitScore}
                    savedName={storage.get(LS_NAME) ?? ''}
                />
            )}
        </div>
    );
};

export default OrbitGame;
