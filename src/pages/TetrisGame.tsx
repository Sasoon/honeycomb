import { useRef, useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useTetrisGameStore } from '../store/tetrisGameStore';
import HexGrid from '../components/HexGrid';

const CENTER_NUDGE_Y = 0; // pixels to nudge overlay vertically for visual centering (set to 0 for exact alignment)

function mapCenters(container: HTMLElement): Map<string, { x: number; y: number; row: number; col: number }> {
  const result = new Map<string, { x: number; y: number; row: number; col: number }>();
  const base = container.getBoundingClientRect();
  container.querySelectorAll<HTMLElement>('.hex-grid__item').forEach(el => {
    const rowAttr = el.getAttribute('data-row');
    const colAttr = el.getAttribute('data-col');
    if (!rowAttr || !colAttr) return;
    const row = Number(rowAttr);
    const col = Number(colAttr);
    const slot = el.parentElement as HTMLElement; // wrapper defines slot size/position
    const r = (slot || el).getBoundingClientRect();
    result.set(`${row},${col}`, { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2 + CENTER_NUDGE_Y, row, col });
  });
  return result;
}

function measureCellSize(container: HTMLElement): { w: number; h: number } {
  const el = container.querySelector<HTMLElement>('.hex-grid__item');
  if (!el) return { w: 64, h: 56 };
  const slot = el.parentElement as HTMLElement;
  const r = (slot || el).getBoundingClientRect();
  return { w: r.width, h: r.height };
}

// Compute a visual path of centers by walking rows toward the target and choosing the cell whose x is closest to the target x in each row
function computeCenterPath(
  grid: Array<{ position: { row: number; col: number } }>,
  centers: Map<string, { x: number; y: number; row: number; col: number }>,
  startRow: number,
  target: { row: number; col: number }
): Array<{ row: number; col: number; center: { x: number; y: number } }> {
  const rows = Array.from(new Set(grid.map(c => c.position.row))).sort((a, b) => a - b);
  const targetCenter = centers.get(`${target.row},${target.col}`);
  if (!targetCenter) return [];
  const path: Array<{ row: number; col: number; center: { x: number; y: number } }> = [];
  for (let r of rows) {
    if (r < startRow) continue;
    const rowCells = grid.filter(c => c.position.row === r);
    const candidates = rowCells
      .map(c => ({ key: `${c.position.row},${c.position.col}`, row: c.position.row, col: c.position.col }))
      .map(k => ({ ...k, center: centers.get(`${k.row},${k.col}`) }))
      .filter(k => !!k.center) as Array<{ key: string; row: number; col: number; center: { x: number; y: number } }>;
    if (candidates.length === 0) continue;
    let best = candidates[0];
    let bestDx = Math.abs((best.center.x) - targetCenter.x);
    for (const c of candidates) {
      const dx = Math.abs(c.center.x - targetCenter.x);
      if (dx < bestDx) { best = c; bestDx = dx; }
    }
    path.push({ row: best.row, col: best.col, center: { x: best.center.x, y: best.center.y } });
    if (r === target.row) break;
  }
  return path;
}

type Overlay = { id: string; letter: string; x: number; y: number; pulse: number; isFinal?: boolean };

type DebugDot = { x: number; y: number; key: string };

const TetrisGame = ({ isSidebarOpen, openMenu: _openMenu, closeMenu: _closeMenu }: { isSidebarOpen: boolean; openMenu?: () => void; closeMenu: () => void; }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [previousGrid, setPreviousGrid] = useState<typeof grid>([]);
  const lastPlayerGridRef = useRef<typeof previousGrid>([]);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const timersRef = useRef<number[]>([]);
  const [hiddenCellIds, setHiddenCellIds] = useState<string[]>([]);
  const [cellSize, setCellSize] = useState<{ w: number; h: number }>({ w: 64, h: 56 });
  const [debugDots, setDebugDots] = useState<DebugDot[]>([]);

  const {
    gameInitialized,
    phase,
    grid,
    score,
    round,
    selectedTiles,
    currentWord,
    isWordValid,
    powerCards: _powerCards,
    wordsThisRound,
    nextRows,
    previewLevel,
    initializeGame,
    selectTile,
    clearSelection,
    submitWord,
    endRound: _endRound,
    startPlayerPhase,
    resetGame,
    gridSize
  } = useTetrisGameStore();

  useEffect(() => { if (!gameInitialized) initializeGame(); }, [gameInitialized, initializeGame]);
  useEffect(() => {
    if (phase === 'player') {
      setPreviousGrid(grid);
      lastPlayerGridRef.current = grid;
    }
  }, [phase, grid]);

  // Keep cell size in sync (resize)
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const update = () => setCellSize(measureCellSize(el));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];

    if (phase !== 'flood') return;
    const container = containerRef.current; if (!container) return;

    const centers = mapCenters(container);

    const baseline = previousGrid.length > 0 ? previousGrid : lastPlayerGridRef.current;

    const newlyFilled = grid.filter(cell => {
      const prev = baseline.find(p => p.id === cell.id);
      return cell.letter && cell.isPlaced && prev && !prev.letter;
    });

    setHiddenCellIds(newlyFilled.map(c => c.id));

    const stepMs = 220;
    const showDebug = typeof window !== 'undefined' && window.localStorage.getItem('tetrisDebugPath') === '1';
    if (showDebug) setDebugDots([]);

    newlyFilled.forEach((cell, idx) => {
      const col = cell.position.col;
      const columnSlots = grid
        .filter(c => c.position.col === col)
        .map(c => c.position.row);
      const startRow = Math.min(...columnSlots);

      // Build path of centers row-by-row toward targetX
      const pathCenters = computeCenterPath(grid, centers, startRow, { row: cell.position.row, col: cell.position.col });
      if (pathCenters.length === 0) return;

      if (showDebug) setDebugDots(prev => [...prev, ...pathCenters.map((pc, i) => ({ x: pc.center.x, y: pc.center.y, key: `${cell.id}-c-${i}` }))]);

      const initial = pathCenters[0].center;
      setOverlays(prev => [...prev, { id: cell.id, letter: cell.letter, x: initial.x, y: initial.y - cellSize.h * 1.2, pulse: 0 }]);

      const cascadeDelay = idx * 100;
      pathCenters.forEach((pc, i) => {
        const t = window.setTimeout(() => {
          setOverlays(prev => prev.map(o => (
            o.id === cell.id ? { ...o, x: pc.center.x, y: pc.center.y, pulse: o.pulse + 1 } : o
          )));
        }, cascadeDelay + i * stepMs);
        timersRef.current.push(t);
      });

      const finalBounceDelay = cascadeDelay + pathCenters.length * stepMs;
      const bounceT = window.setTimeout(() => {
        setOverlays(prev => prev.map(o => (
          o.id === cell.id ? { ...o, isFinal: true, pulse: o.pulse + 1 } : o
        )));
      }, finalBounceDelay);
      timersRef.current.push(bounceT);

      const doneT = window.setTimeout(() => {
        setOverlays(prev => prev.filter(o => o.id !== cell.id));
        setHiddenCellIds(prev => prev.filter(id => id !== cell.id));
      }, finalBounceDelay + 180);
      timersRef.current.push(doneT);
    });

    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current = [];
    };
  }, [phase, grid, previousGrid, cellSize.h]);

  const hasSelection = currentWord.length > 0;
  const validationState = currentWord.length >= 3 ? isWordValid : undefined;

  const handleRestart = () => {
    // Stop any ongoing animations
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    setOverlays([]);
    setHiddenCellIds([]);
    setDebugDots([]);
    setPreviousGrid([] as any);
    resetGame();
    initializeGame();
  };

  return (
    <div className="game-container min-h-screen bg-amber-50">
      <div className="flex flex-col md:flex-row">
        {/* Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', bounce: 0.25 }}
              className="fixed md:relative z-50 w-72 h-full bg-white shadow-xl"
            >
              <div className="p-6 space-y-6">
                <div className="bg-amber-50 rounded-lg p-4">
                  <h2 className="text-2xl font-bold text-amber-900 mb-2">Round {round}</h2>
                  <div className="text-amber-700">
                    <p className="text-lg">Score: {score}</p>
                    <p>Words: {wordsThisRound.length}</p>
                  </div>
                </div>
                {currentWord && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-1">Current Word</h3>
                    <p className="text-2xl font-mono tracking-wider">{currentWord}</p>
                  </div>
                )}
                <div className={`text-center p-3 rounded-lg font-semibold ${phase === 'flood' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                  {phase === 'flood' ? '⬇️ Tiles Dropping' : '✏️ Your Turn'}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content */}
        <div className="flex-1 p-4 md:p-8">
          <div ref={containerRef} className="max-w-4xl mx-auto relative">
            {/* Falling overlays */}
            <div className="pointer-events-none absolute inset-0 z-40">
              <AnimatePresence>
                {overlays.map(ov => (
                  <motion.div
                    key={ov.id}
                    initial={{ opacity: 0, scale: 0.9, x: ov.x - cellSize.w / 2, y: ov.y - cellSize.h / 2 }}
                    animate={{ opacity: 1, scale: 1, x: ov.x - cellSize.w / 2, y: ov.y - cellSize.h / 2 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: 'easeInOut' }}
                    style={{ position: 'absolute', left: 0, top: 0 }}
                  >
                    <motion.div
                      key={ov.pulse}
                      initial={false}
                      animate={{ scale: ov.isFinal ? [1, 1.08, 1] : [1, 1.06, 1] }}
                      transition={{ duration: ov.isFinal ? 0.18 : 0.14, ease: 'easeOut' }}
                      className="flex items-center justify-center"
                      style={{
                        width: `${cellSize.w}px`,
                        height: `${cellSize.h}px`,
                        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                        background: '#eef2ff',
                        border: '2px solid #a78bfa',
                        borderRadius: 8,
                        boxShadow: ov.isFinal ? '0 10px 22px rgba(99,102,241,0.38)' : '0 8px 18px rgba(99,102,241,0.35)'
                      }}
                    >
                      <span className="letter-tile" style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1f2937' }}>{ov.letter}</span>
                    </motion.div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Optional debug dots for path centers */}
              {typeof window !== 'undefined' && window.localStorage.getItem('tetrisDebugPath') === '1' && debugDots.map(d => (
                <div key={d.key} style={{ position: 'absolute', left: d.x, top: d.y, transform: 'translate(-50%, -50%)', width: 6, height: 6, borderRadius: 6, background: '#9333ea' }} />
              ))}
            </div>

            {/* Grid */}
            <div className="grid-container flex justify-center mt-12 relative z-10">
              <HexGrid
                cells={grid.map(c => ({ ...c, isSelected: selectedTiles.some(t => t.cellId === c.id) }))}
                onCellClick={(cell) => selectTile(cell.id)}
                isWordValid={validationState}
                isPlacementPhase={phase === 'player' ? !hasSelection : true}
                isWordAlreadyScored={false}
                placedTilesThisTurn={[]}
                gridSize={gridSize}
                hiddenLetterCellIds={hiddenCellIds}
              />
            </div>

            {/* Preview rows */}
            {previewLevel > 0 && nextRows.length > 0 && (
              <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Next Drop</h3>
                <div className="flex justify-center gap-2">
                                      {nextRows[0]?.map((letter, idx) => (
                    <div key={idx} className="w-10 h-10 bg-gray-300 rounded border border-black flex items-center justify-center font-bold">
                      {letter}
                    </div>
                  ))}
                </div>
                {previewLevel > 1 && nextRows[1] && (
                  <div className="flex justify-center gap-2 mt-2 opacity-50">
                    {nextRows[1]?.map((letter, idx) => (
                      <div key={idx} className="w-8 h-8 bg-gray-200 rounded border border-black flex items-center justify-center font-bold text-sm">
                        {letter}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex gap-3 justify-center flex-wrap">
              {phase === 'player' && (
                <>
                  <button onClick={() => submitWord()} disabled={currentWord.length < 3} className="py-2 px-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold rounded-md transition-colors">Submit Word</button>
                  <button onClick={() => clearSelection()} disabled={selectedTiles.length === 0} className="py-2 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-semibold rounded-md transition-colors">Clear</button>

                </>
              )}
              {phase === 'flood' && (
                <button onClick={() => startPlayerPhase()} className="py-3 px-6 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-md transition-colors animate-pulse">Start Playing!</button>
              )}
              <button onClick={handleRestart} className="py-2 px-4 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-md transition-colors">Restart Game</button>
            </div>
          </div>
        </div>
      </div>
      <Toaster position="bottom-center" />
    </div>
  );
};

export default TetrisGame; 