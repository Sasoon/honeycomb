import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { RotateCw, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { HexCell } from '../components/HexGrid';
import {
    applyFallingTiles,
    clearTilesAndApplyGravity,
    generateDropLettersSmart,
    areCellsAdjacent,
} from '../lib/waxleGameUtils';
import { buildFallFrames, FALL_STAGGER_MS, FallSpec } from '../lib/fallAnimation';
import wordValidator from '../lib/wordValidator';
import toastService from '../lib/toastService';

// ==================== ORBIT PROTOTYPE TUNING ====================
const ROW_COUNTS = [4, 5, 6, 7, 6, 5, 4]; // regular hexagon, side 4 — 37 cells
const WAVES = 10;
const WAVE_SIZE = 4;
const SEED_TILES = 7;
// ================================================================

// Neighbour offsets in clockwise screen order, starting top-left
const RING_OFFSETS: Array<[number, number]> = [
    [-1, -0.5], [-1, 0.5], [0, 1], [1, 0.5], [1, -0.5], [0, -1],
];

// Board geometry (px). Vertical pitch = horizontal pitch × (√3/2 of the hex
// lattice) so the gap between tiles is uniform in every direction.
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
type PendingAnim = { keyframes: Keyframe[]; duration: number; delay: number; easing?: string };

const OrbitGame = () => {
    const [grid, setGrid] = useState<HexCell[]>([]);
    const [phase, setPhase] = useState<Phase>('storm');
    const [endReason, setEndReason] = useState<EndReason | null>(null);
    const [wavesDropped, setWavesDropped] = useState(0);
    const [nextWave, setNextWave] = useState<string[]>([]);
    const [score, setScore] = useState(0);
    const [words, setWords] = useState<string[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [isValid, setIsValid] = useState(false);

    const boardRef = useRef<HTMLDivElement>(null);
    const pendingAnimsRef = useRef<Map<string, PendingAnim>>(new Map());
    const validateSeqRef = useRef(0);
    const reducedMotion = useMemo(
        () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        []
    );

    const byPos = useMemo(() => {
        const m = new Map<string, HexCell>();
        grid.forEach(c => m.set(`${c.position.row},${c.position.col}`, c));
        return m;
    }, [grid]);

    // Existing neighbours in clockwise order. Edge cells get partial rings so
    // every tile on the board can be a pivot — the arc rotates cyclically.
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

    // ---------- game flow ----------

    const init = useCallback(() => {
        const fresh = buildBoard();
        const seedLetters = generateDropLettersSmart(SEED_TILES, fresh);
        const { newGrid } = applyFallingTiles(fresh, seedLetters, ROW_COUNTS.length);
        newGrid.forEach(c => { c.placedThisTurn = false; });
        pendingAnimsRef.current.clear();
        setGrid(newGrid);
        setNextWave(generateDropLettersSmart(WAVE_SIZE, newGrid));
        setPhase('storm');
        setEndReason(null);
        setWavesDropped(0);
        setScore(0);
        setWords([]);
        setSelected([]);
        setIsValid(false);
    }, []);

    useEffect(() => { init(); }, [init]);

    // Every storm action is followed by the forecast wave entering from the
    // top of the grid; after the last wave the cleanup phase begins
    const afterAction = useCallback((g: HexCell[]) => {
        if (phase === 'storm' && wavesDropped < WAVES) {
            const letters = nextWave.length ? nextWave : generateDropLettersSmart(WAVE_SIZE, g);
            const { newGrid, finalPaths, unplacedLetters } = applyFallingTiles(g, letters, ROW_COUNTS.length);

            // Animate each tile along its full fall path from above the board
            const placed = newGrid.filter(c => c.placedThisTurn);
            const specs: Array<FallSpec & { batch: number }> = placed.map(c => {
                const entry = finalPaths[c.id];
                const ids = entry?.path?.length ? entry.path : [c.id];
                const pts = ids
                    .map(id => newGrid.find(x => x.id === id))
                    .filter((x): x is HexCell => !!x)
                    .map(x => ({ x: cellX(x), y: cellY(x) }));
                pts.unshift({ x: pts[0].x, y: pts[0].y - TILE_H * 0.9 });
                return { key: c.id, cellId: c.id, letter: c.letter, points: pts, spawn: true, batch: entry?.batch ?? 0 };
            });
            specs.sort((a, b) => (a.batch - b.batch) || (a.points[0].x - b.points[0].x));
            const { frames } = buildFallFrames(specs, TILE_H, FALL_STAGGER_MS);
            frames.forEach(f => {
                const lx = f.xs[f.xs.length - 1];
                const ly = f.ys[f.ys.length - 1];
                pendingAnimsRef.current.set(f.cellId, {
                    keyframes: f.xs.map((x, i) => ({
                        transform: `translate(${x - lx}px, ${f.ys[i] - ly}px)`,
                        opacity: f.spawn && i === 0 ? 0 : 1,
                        offset: f.times[i],
                        easing: 'linear',
                    })),
                    duration: f.duration,
                    delay: f.delay,
                });
            });

            const nextWaves = wavesDropped + 1;
            setWavesDropped(nextWaves);
            setGrid(newGrid);
            setNextWave(generateDropLettersSmart(WAVE_SIZE, newGrid));
            if (unplacedLetters.length > 0) {
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
        afterAction(newGrid);
    }, [phase, grid, ringOf, queueMove, afterAction]);

    const currentWord = useMemo(
        () => selected.map(id => grid.find(c => c.id === id)?.letter || '').join(''),
        [selected, grid]
    );

    const submit = useCallback(() => {
        if (phase === 'over' || !isValid || selected.length < 3) return;
        const word = currentWord;
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
        afterAction(newGrid);
    }, [phase, isValid, selected, currentWord, grid, queueMove, afterAction]);

    // Pass: let the next wave fall without touching the board
    const endTurn = useCallback(() => {
        if (phase !== 'storm') return;
        setSelected([]);
        setIsValid(false);
        afterAction(grid.map(c => ({ ...c })));
    }, [phase, grid, afterAction]);

    const finish = useCallback(() => {
        if (phase !== 'cleanup') return;
        setPhase('over');
        setEndReason('finished');
    }, [phase]);

    // ---------- selection ----------

    const handleCellTap = useCallback((cell: HexCell) => {
        if (phase === 'over') return;

        if (!cell.letter) {
            // Empty cells just clear the trace — they can't be pivots
            setSelected([]);
            setIsValid(false);
            return;
        }

        const idx = selected.indexOf(cell.id);
        if (idx !== -1) {
            // Tap on a selected tile truncates the trace back to it
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
            // Not adjacent: restart the trace from the tapped tile
            setSelected([cell.id]);
        }
    }, [phase, selected, grid]);

    // Async word validation
    useEffect(() => {
        if (currentWord.length < 3) { setIsValid(false); return; }
        const seq = ++validateSeqRef.current;
        wordValidator.validateWordAsync(currentWord).then(ok => {
            if (validateSeqRef.current === seq) setIsValid(ok);
        });
    }, [currentWord]);

    // ---------- animation: run pending WAAPI moves after grid commits ----------

    useLayoutEffect(() => {
        const m = pendingAnimsRef.current;
        if (m.size === 0) return;
        if (!reducedMotion && boardRef.current) {
            m.forEach((a, id) => {
                const el = boardRef.current!.querySelector<HTMLElement>(`[data-ocell="${CSS.escape(id)}"]`);
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

    const ringIds = useMemo(() => {
        if (!pivotCell) return new Set<string>();
        return new Set(ringOf(pivotCell).map(c => c.id));
    }, [pivotCell, ringOf]);

    const bestWord = useMemo(
        () => words.reduce((a, b) => (b.length > a.length ? b : a), ''),
        [words]
    );
    const tilesLeft = useMemo(() => grid.filter(c => c.letter).length, [grid]);

    const share = useCallback(() => {
        const headline = endReason === 'swept' ? '🧹 Clean Sweep!' : endReason === 'drowned' ? '🌊 Drowned' : '🏁 Finished';
        const text = `WAXLE ORBIT — ${headline}\nScore: ${score} · Words: ${words.length}${bestWord ? ` · Best: ${bestWord}` : ''}\nhttps://waxle.netlify.app/orbit`;
        navigator.clipboard.writeText(text).then(
            () => toastService.success('Result copied!'),
            () => toastService.error('Could not copy')
        );
    }, [endReason, score, words.length, bestWord]);

    const wordState = currentWord.length >= 3 ? (isValid ? 'valid' : 'invalid') : 'neutral';

    return (
        <div className="flex-1 flex flex-col items-center px-3 pt-4 pb-8 select-none">
            {/* HUD */}
            <div className="w-full max-w-md flex items-center justify-between mb-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-text-primary tabular-nums">{score}</span>
                    <span className="text-xs uppercase tracking-wide text-text-secondary">pts</span>
                </div>
                {/* Next flood forecast */}
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
                        const isPivot = pivotCell?.id === cell.id;
                        return (
                            <div
                                key={cell.id}
                                data-ocell={cell.id}
                                data-letter={cell.letter}
                                onClick={() => handleCellTap(cell)}
                                className={cn(
                                    'orbit-cell',
                                    cell.letter ? 'orbit-cell--tile' : 'orbit-cell--empty',
                                    selIdx !== -1 && (wordState === 'invalid' ? 'orbit-cell--invalid' : 'orbit-cell--selected'),
                                    inRing && 'orbit-cell--ring',
                                    isPivot && 'orbit-cell--pivot'
                                )}
                                style={{ left: cellX(cell), top: cellY(cell), width: TILE_W, height: TILE_H }}
                            >
                                {cell.letter}
                            </div>
                        );
                    })}

                    {/* Orbit handles */}
                    {pivotCell && phase !== 'over' && (
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
            {phase === 'over' && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 anim-backdrop-in" role="dialog" aria-modal="true">
                    <div className="bg-bg-primary border border-secondary/20 rounded-2xl p-6 shadow-2xl m-4 max-w-sm w-full text-center anim-modal-in">
                        <div className="text-4xl mb-2">
                            {endReason === 'swept' ? '🧹' : endReason === 'drowned' ? '🌊' : '🏁'}
                        </div>
                        <h2 className="text-xl font-bold text-text-primary mb-1">
                            {endReason === 'swept' ? 'Clean Sweep!' : endReason === 'drowned' ? 'The board flooded' : 'Run complete'}
                        </h2>
                        <p className="text-text-secondary text-sm mb-4">
                            {score} points · {words.length} {words.length === 1 ? 'word' : 'words'}
                            {bestWord && <> · best <span className="font-mono font-semibold">{bestWord}</span></>}
                            {endReason !== 'swept' && tilesLeft > 0 && <> · {tilesLeft} tiles left</>}
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Button onClick={share} variant="secondary">Share</Button>
                            <Button onClick={init}>Play again</Button>
                        </div>
                    </div>
                </div>
            )}

            <p className="mt-6 text-[11px] text-text-muted max-w-xs text-center leading-relaxed">
                Prototype — trace touching tiles to spell words; tap a single tile to spin
                the ring around it. Survive {WAVES} waves, then empty the board.
            </p>
        </div>
    );
};

export default OrbitGame;
