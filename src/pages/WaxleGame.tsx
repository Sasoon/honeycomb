import { useRef, useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
// Sound functionality removed for Tetris variant
import { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Zap, Hash } from 'lucide-react';
import { cn } from '../lib/utils';
import { useWaxleGameStore } from '../store/waxleGameStore';
import HexGrid, { HexCell } from '../components/HexGrid';
import { areCellsAdjacent } from '../lib/waxleGameUtils';
import { haptics } from '../lib/haptics';
import toastService from '../lib/toastService';
import WaxleGameOverModal from '../components/WaxleGameOverModal';
import WaxleMobileGameControls from '../components/WaxleMobileGameControls';

const CENTER_NUDGE_Y = 0; // pixels to nudge overlay vertically for visual centering (set to 0 for exact alignment)
// Flood animation timing constants
const FLOOD_STEP_MS = 100; // movement time between centers (ms)
const FLOOD_PAUSE_MS = 250; // dwell time at each slot (ms)

// Memoized version to avoid expensive DOM walks on every call
const _centersCache = new WeakMap<HTMLElement, { key: string; map: Map<string, { x:number;y:number;row:number;col:number }> }>();
function mapCenters(container: HTMLElement): Map<string, { x: number; y: number; row: number; col: number }> {
  const rect = container.getBoundingClientRect();
  const key = `${rect.width}x${rect.height}-${container.querySelectorAll('.hex-grid__item').length}`;
  const cached = _centersCache.get(container);
  if (cached && cached.key === key) return cached.map;

  const result = new Map<string, { x: number; y: number; row: number; col: number }>();
  container.querySelectorAll<HTMLElement>('.hex-grid__item').forEach(el => {
    const rowAttr = el.getAttribute('data-row');
    const colAttr = el.getAttribute('data-col');
    if (!rowAttr || !colAttr) return;
    const row = Number(rowAttr);
    const col = Number(colAttr);
    const slot = el.parentElement as HTMLElement;
    const r = (slot || el).getBoundingClientRect();
    result.set(`${row},${col}`, { x: r.left - rect.left + r.width / 2, y: r.top - rect.top + r.height / 2 + CENTER_NUDGE_Y, row, col });
  });
  _centersCache.set(container, { key, map: result });
  return result;
}

function measureCellSize(container: HTMLElement): { w: number; h: number } {
  const el = container.querySelector<HTMLElement>('.hex-grid__item');
  if (!el) return { w: 64, h: 56 };
  const slot = el.parentElement as HTMLElement;
  const r = (slot || el).getBoundingClientRect();
  return { w: r.width, h: r.height };
}

// Simulate tile settling to find actual landing positions (unused)
/* function simulateTileSettling(
  startingGrid: Array<{ position: { row: number; col: number }; letter?: string; isPlaced?: boolean }>,
  newTiles: Array<{ letter: string; startCol: number }>
): Array<{ letter: string; finalRow: number; finalCol: number; path: Array<{ row: number; col: number }> }> {
  // Clone grid for simulation
  const simGrid = startingGrid.map(cell => ({ ...cell }));
  const results: Array<{ letter: string; finalRow: number; finalCol: number; path: Array<{ row: number; col: number }> }> = [];
  
  // Helper to check if a position is empty
  const isEmpty = (row: number, col: number) => {
    const tolerance = 0.1;
    return !simGrid.some(cell => 
      Math.abs(cell.position.row - row) < tolerance && 
      Math.abs(cell.position.col - col) < tolerance && 
      cell.letter && cell.isPlaced
    );
  };
  
  // Helper to find cells below (using same logic as game)
  const findCellsBelow = (row: number, col: number) => {
    const cellsInRowBelow = simGrid.filter(c => c.position.row === row + 1);
    return cellsInRowBelow.filter(belowCell => {
      const colDiff = Math.abs(belowCell.position.col - col);
      return colDiff < 0.6 && isEmpty(belowCell.position.row, belowCell.position.col);
    });
  };
  
  // Place and settle each tile
  newTiles.forEach(tile => {
    const startRow = 0;
    const startCol = tile.startCol;
    const path: Array<{ row: number; col: number }> = [{ row: startRow, col: startCol }];
    
    let currentRow = startRow;
    let currentCol = startCol;
    
    // Settle the tile step by step
    let canFall = true;
    while (canFall) {
      const cellsBelow = findCellsBelow(currentRow, currentCol);
      
      if (cellsBelow.length > 0) {
        // Prefer straight down, then leftmost
        const directBelow = cellsBelow.find(c => Math.abs(c.position.col - currentCol) < 0.1);
        const targetCell = directBelow || cellsBelow.sort((a, b) => a.position.col - b.position.col)[0];
        
        currentRow = targetCell.position.row;
        currentCol = targetCell.position.col;
        path.push({ row: currentRow, col: currentCol });
      } else {
        canFall = false;
      }
    }
    
    // Mark this position as occupied for next tiles
    const occupiedCell = simGrid.find(c => 
      Math.abs(c.position.row - currentRow) < 0.1 && 
      Math.abs(c.position.col - currentCol) < 0.1
    );
    if (occupiedCell) {
      occupiedCell.letter = tile.letter;
      occupiedCell.isPlaced = true;
    }
    
    results.push({
      letter: tile.letter,
      finalRow: currentRow,
      finalCol: currentCol,
      path
    });
  });
  
  return results;
}*/

// Compute a visual path of centers by walking rows toward the target and choosing the cell whose x is closest to the target x in each row
// The path stops when it encounters a blockage (no valid adjacent empty cells)
// Currently unused - replaced by settling simulation
/* function computeCenterPath(
  grid: Array<{ position: { row: number; col: number }; letter?: string; isPlaced?: boolean }>,
  centers: Map<string, { x: number; y: number; row: number; col: number }>,
  startRow: number,
  target: { row: number; col: number },
  occupiedPreFlood: Set<string>
): Array<{ row: number; col: number; center: { x: number; y: number } }> {
  type CenterCandidate = { key: string; row: number; col: number; center: { x: number; y: number } };
  const rows = Array.from(new Set(grid.map(c => c.position.row))).sort((a, b) => a - b);
  const targetCenter = centers.get(`${target.row},${target.col}`);
  if (!targetCenter) {
    console.warn(`[PATH-DEBUG] No center found for target (${target.row}, ${target.col})`);
    return [];
  }
  const path: Array<{ row: number; col: number; center: { x: number; y: number } }> = [];
  
  const isDebug = typeof window !== 'undefined' && window.localStorage.getItem('waxleDebugAnim') === '1';
  if (isDebug) {
    console.log(`[PATH-DEBUG] Computing path to target (${target.row}, ${target.col})`);
  }

  let previous: { row: number; col: number } | null = null;
  for (const r of rows) {
    if (r < startRow) continue;
    const rowCells = grid.filter(c => c.position.row === r);
    const rawCandidates: CenterCandidate[] = [];
    for (const rc of rowCells) {
      const ctr = centers.get(`${rc.position.row},${rc.position.col}`);
      if (!ctr) continue;
      rawCandidates.push({
        key: `${rc.position.row},${rc.position.col}`,
        row: rc.position.row,
        col: rc.position.col,
        center: { x: ctr.x, y: ctr.y },
      });
    }
    if (rawCandidates.length === 0) continue;

    // Restrict to adjacency with previous selection to ensure contiguous steps
    const candidates: CenterCandidate[] = previous
      ? rawCandidates.filter(c => areCellsAdjacent(
          { position: { row: previous!.row, col: previous!.col } } as any,
          { position: { row: c.row, col: c.col } } as any
        ))
      : rawCandidates;

    // Filter out occupied cells (except the final target if we've reached it)
    const validCandidates = candidates.filter(c => {
      const key = `${c.row},${c.col}`;
      const isFinal = c.row === target.row && c.col === target.col;
      // Allow the final target even if occupied, but only if we can reach it
      return !occupiedPreFlood.has(key) || (isFinal && r === target.row);
    });

    // If no valid candidates, we're blocked - stop here
    if (validCandidates.length === 0) {
      if (isDebug) {
        console.log(`[PATH-DEBUG] Blocked at row ${r}, no valid adjacent cells. Path so far:`, 
          path.map(p => `(${p.row},${p.col})`).join(' -> '));
        console.log(`[PATH-DEBUG] Raw candidates:`, rawCandidates.map(c => `(${c.row},${c.col})`));
        console.log(`[PATH-DEBUG] Adjacent candidates:`, candidates.map(c => `(${c.row},${c.col})`));
        console.log(`[PATH-DEBUG] Occupied positions:`, Array.from(occupiedPreFlood));
      }
      return path;
    }

    // Prefer the closest x to target from valid candidates
    let best: CenterCandidate | null = null;
    let bestDx = Infinity;
    for (const c of validCandidates) {
      const dx = Math.abs(c.center.x - targetCenter.x);
      if (dx < bestDx) { best = c; bestDx = dx; }
    }
    
    if (!best) {
      if (isDebug) console.log(`[PATH-DEBUG] No best candidate found at row ${r}`);
      return path;
    }
    
    path.push({ row: best.row, col: best.col, center: { x: best.center.x, y: best.center.y } });
    previous = { row: best.row, col: best.col };
    
    if (isDebug) {
      console.log(`[PATH-DEBUG] Added step (${best.row}, ${best.col}) to path`);
    }
    
    // Stop if we've reached a position that matches our actual settling point
    const bestKey = `${best.row},${best.col}`;
    if (occupiedPreFlood.has(bestKey) && best.row === target.row && best.col === target.col) {
      if (isDebug) console.log(`[PATH-DEBUG] Reached final target at (${best.row}, ${best.col})`);
      break;
    }
  }
  return path;
}*/

type Overlay = { id: string; letter: string; x: number; y: number; pulse: number; isFinal?: boolean; rX?: number; rY?: number };

type FxOverlay = { key: string; letter: string; x: number; y: number; kind?: 'gravity' | 'orbit' | 'move' };

// (no-op placeholder removed)

const WaxleGame = ({ onBackToDailyChallenge }: { onBackToDailyChallenge?: () => void; }) => {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [previousGrid, setPreviousGrid] = useState<typeof grid>([]);
  const lastPlayerGridRef = useRef<typeof previousGrid>([]);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [fxOverlays, setFxOverlays] = useState<FxOverlay[]>([]);
  const timersRef = useRef<number[]>([]);
  const [hiddenCellIds, setHiddenCellIds] = useState<string[]>([]);
  const [cellSize, setCellSize] = useState<{ w: number; h: number }>({ w: 64, h: 56 });
  const [orbitAnchor, setOrbitAnchor] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [, setCurrentDragAngle] = useState<number>(0);
  const operationInProgressRef = useRef<boolean>(false);
  const orbitPlanRef = useRef<{
    pivotId: string;
    // Canonical 6 slots around pivot: null where grid has no neighbor
    slotIndexToCell: (HexCell | null)[];
    // Map each neighbor cell id to its canonical slot index [0..5]
    cellIdToSlotIndex: Map<string, number>;
    // Ordered present neighbors in canonical order (non-null of slotIndexToCell)
    orderedNeighbors: HexCell[];
    // Map neighbor id -> index in orderedNeighbors
    neighborIdToPresentIndex: Map<string, number>;
    // Pivot center from DOM for positioning
    pivotCenter: { x: number; y: number };
  } | null>(null);
  const [, setLockedSteps] = useState<number>(0); // magnetic snapped steps (value stored in ref)
  const lockedStepsRef = useRef<number>(0);
  const [isOverCancel, setIsOverCancel] = useState<boolean>(false);
  const isOverCancelRef = useRef<boolean>(false);

  // Get the store state separately to avoid infinite rerenders
  const isDailyMode = location.pathname === '/daily';
  const store = useWaxleGameStore();
  const currentGameState = isDailyMode ? store.dailyGameState : store.classicGameState;

  const {
    gameInitialized,
    phase,
    grid,
    score,
    round,
    selectedTiles,
    currentWord,
    isWordValid,
    wordsThisRound,
    totalWords,
    longestWord,
    nextRows,
    previewLevel,
    freeOrbitsAvailable,
    lockMode,
    lockedTiles,
    lockAnimatingTiles,
    gridSize,
    gravityMoves,
    floodPaths,
    tilesHiddenForAnimation: _unusedTiles,
    dailyDate,
    challengeStartTime,
  } = currentGameState;

  const {
    initializeGame,
    selectTile,
    submitWord,
    endRound,
    startPlayerPhase,
    endPlayerPhase,
    resetGame,
    toggleTileLock,
  } = store;

  const isDailyChallenge = isDailyMode;

  useEffect(() => { 
    if (!gameInitialized) {
      initializeGame();
    }
  }, [gameInitialized, initializeGame]);
  
  // Clear daily challenge state when navigating to regular game (runtime fix)
  useEffect(() => {
    if (location.pathname === '/' && !onBackToDailyChallenge && isDailyChallenge) {
      console.log('Resetting game state on navigation to / from daily challenge');
      // Reset entire game state to start fresh regular game
      resetGame();
      // Initialize a new regular game after reset
      setTimeout(() => initializeGame(), 0);
    }
  }, [location.pathname, onBackToDailyChallenge, isDailyChallenge, resetGame, initializeGame]);
  
  // Mobile sidebar is now handled by App.tsx MobileSidebar component

  // Touch interactions removed - mobile navigation handled by MobileSidebar

  useEffect(() => {
    // CRITICAL FIX: If entering flood phase, immediately hide any newly placed tiles
    // This prevents the flash by hiding tiles SYNCHRONOUSLY before they can render
    if (phase === 'flood') {
      const newlyFilled = grid.filter(cell => (cell as HexCell & { placedThisTurn?: boolean }).placedThisTurn);
      if (newlyFilled.length > 0) {
        const newIds = newlyFilled.map(c => c.id);
        setHiddenCellIds(prev => [...new Set([...prev, ...newIds])]);
      }
    }
    
    if (phase === 'player') {
      setPreviousGrid(grid);
      lastPlayerGridRef.current = grid;
      // Reset contextual UI state at start of player phase
      setOrbitAnchor(null);
      setFxOverlays([]);
    }
  }, [phase, grid]);

  // Use layout effect to hide tiles synchronously before painting
  useLayoutEffect(() => {
    if (phase === 'flood') {
      const newlyPlaced = grid.filter(cell => (cell as HexCell & { placedThisTurn?: boolean }).placedThisTurn);
      if (newlyPlaced.length > 0) {
        console.log('[FLOOD-DEBUG] Hiding tiles synchronously before paint:', newlyPlaced.map(c => c.id));
        setHiddenCellIds(prev => [...new Set([...prev, ...newlyPlaced.map(c => c.id)])]);
      }
    }
  }, [phase, grid]);

  // Compute orbit anchor when exactly one tile is selected
  useEffect(() => {
    if (phase !== 'player') return;
    const container = containerRef.current; if (!container) return;
    if (selectedTiles.length === 1) {
      const centers = mapCenters(container);
      const selectedId = selectedTiles[0].cellId;
      const selectedCell = grid.find(c => c.id === selectedId);
      if (!selectedCell) return;
      // Orbit anchor at selected cell center
      const sCenter = centers.get(`${selectedCell.position.row},${selectedCell.position.col}`);
      setOrbitAnchor(sCenter ? { x: sCenter.x, y: sCenter.y } : null);
    } else {
      // Hide contextual UI when multi-select or none
      setOrbitAnchor(null);
    }
  }, [selectedTiles, grid, phase]);

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
    timersRef.current.forEach(t => window.clearTimeout(t));
    timersRef.current = [];

    const container = containerRef.current; if (!container) return;
    const centers = mapCenters(container);

    let animationDoneSignal = () => {};

    if (phase === 'gravitySettle' && gravityMoves && gravityMoves.size > 0) {
        const newlySettled = grid.filter(cell => cell.placedThisTurn);
        setHiddenCellIds(newlySettled.map(c => c.id));
        
        // Handle case where gravity moves were detected but no tiles actually need animation
        if (newlySettled.length === 0) {
            // No tiles to animate, proceed directly to flood phase
            animationDoneSignal = () => {
                const advanceT = window.setTimeout(() => {
                    endRound();
                }, 100); // Short delay to ensure state consistency
                timersRef.current.push(advanceT);
            };
        } else {
            // Group tiles by their settling distance for staggered animation
            const tilesByDistance = new Map<number, Array<{ cell: HexCell; sourceCell: HexCell; from: { x: number; y: number }; to: { x: number; y: number } }>>();
            
            newlySettled.forEach((cell) => {
                const sourceId = gravityMoves.get(cell.id);
                const sourceCell = previousGrid.find(c => c.id === sourceId);
                if (!sourceCell) return;

                const from = centers.get(`${sourceCell.position.row},${sourceCell.position.col}`);
                const to = centers.get(`${cell.position.row},${cell.position.col}`);
                if (!from || !to) return;
                
                const distance = Math.abs(cell.position.row - sourceCell.position.row);
                if (!tilesByDistance.has(distance)) {
                    tilesByDistance.set(distance, []);
                }
                tilesByDistance.get(distance)!.push({ cell, sourceCell, from, to });
            });
            
            let maxDelay = 0;
            const baseDelay = 120; // Base animation duration
            const staggerDelay = 80; // Time between distance groups
            
            // Animate by distance groups (shorter distances first)
            const sortedDistances = Array.from(tilesByDistance.keys()).sort((a, b) => a - b);
            
            sortedDistances.forEach((distance, distanceIdx) => {
                const tilesAtDistance = tilesByDistance.get(distance)!;
                
                tilesAtDistance.forEach((tileData, tileIdx) => {
                    const { cell, from, to } = tileData;
                    const ovKey = `gset-${cell.id}-${Date.now()}`;
                    
                    // Spawn overlay at source
                    setFxOverlays(prev => [...prev, { 
                        key: ovKey, 
                        letter: cell.letter, 
                        x: from.x, 
                        y: from.y,
                        kind: 'gravity'
                    }]);
                    
                    // Smooth staggered start within distance group
                    const groupStartDelay = distanceIdx * staggerDelay;
                    const tileStartDelay = groupStartDelay + (tileIdx * 25); // Small stagger within group
                    
                    // Start animation
                    const animT = window.setTimeout(() => {
                        setFxOverlays(prev => prev.map(o => 
                            o.key === ovKey ? { ...o, x: to.x, y: to.y } : o
                        ));
                    }, tileStartDelay);
                    timersRef.current.push(animT);
                    
                    // Calculate animation duration based on distance (longer falls take more time)
                    const animDuration = baseDelay + (distance * 30);
                    const finalDelay = tileStartDelay + animDuration;
                    maxDelay = Math.max(maxDelay, finalDelay);
                    
                    // Clean up overlay and reveal tile
                    const doneT = window.setTimeout(() => {
                        setFxOverlays(prev => prev.filter(o => o.key !== ovKey));
                        setHiddenCellIds(prev => prev.filter(id => id !== cell.id));
                    }, finalDelay);
                    timersRef.current.push(doneT);
                });
            });

            animationDoneSignal = () => {
              const advanceT = window.setTimeout(() => {
                endRound();
              }, maxDelay + 100);
              timersRef.current.push(advanceT);
            };
        }
    } else if (phase === 'flood') {
        const newlyFilled = grid
          .filter(cell => (cell as HexCell & { placedThisTurn?: boolean }).placedThisTurn)
          .sort((a, b) => (a.position.row - b.position.row) || (a.position.col - b.position.col));
        
        console.log('[FLOOD-DEBUG] Flood phase started. Newly filled tiles:', newlyFilled.length);
        
        // Prevent flash by ensuring tiles are hidden immediately when flood phase starts
        if (newlyFilled.length > 0) {
          setHiddenCellIds(newlyFilled.map(c => c.id));
        }

        const debugAnim = typeof window !== 'undefined' && window.localStorage.getItem('waxleDebugAnim') === '1';
        const tNow = () => (typeof performance !== 'undefined' ? Math.round(performance.now()) : Date.now());

        // Animation constants
        const stepMs = FLOOD_STEP_MS; // duration to move between centers
        const pauseMs = FLOOD_PAUSE_MS;  // dwell time at each slot
        const perStep = stepMs + pauseMs;

        // Use the provided flood paths from the new flood logic
        const centers = mapCenters(containerRef.current!);
        
        if (debugAnim) {
          console.log('[FLOOD-DEBUG] Starting synchronized animation for', newlyFilled.length, 'tiles');
          console.log('[FLOOD-DEBUG] Flood paths available:', Object.keys(floodPaths || {}).length);
        }
        
                 // Prevent top-row overlap: ensure one overlay per top-row entry at t=0
        const usedTopEntries = new Set<string>();
        const tilePaths = newlyFilled.map(cell => {
          // Use the exact path from the flood logic
          const p = floodPaths && floodPaths[cell.id];
          let pathIds: string[] | null = null;
          if (Array.isArray(p)) {
            pathIds = p;
          } else if (p && Array.isArray((p as any).path)) {
            pathIds = (p as any).path;
          }
          if (!pathIds || pathIds.length === 0) {
            console.warn(`[FLOOD-ERROR] No path found for tile ${cell.id} in flood paths`);
            return null;
          }
          let pathIdsCopy = [...pathIds];
          
          // Convert path IDs to centers, ensuring we follow the exact flood path
                     const pathCenters: Array<{ row: number; col: number; center: { x: number; y: number } }> = [];

           // Skip top-row duplicate at t=0 if multiple tiles share the same entry
           const firstCell = grid.find(g => g.id === pathIdsCopy[0]);
           if (firstCell && firstCell.position.row === 0) {
             const entryKey = `${firstCell.position.row},${firstCell.position.col}`;
             usedTopEntries.add(entryKey);
           }
          
          for (const pathId of pathIds) {
            const pathCell = grid.find(g => g.id === pathId);
            if (!pathCell) {
              console.warn(`[FLOOD-ERROR] Path cell ${pathId} not found in grid`);
              continue;
            }
            
            const center = centers.get(`${pathCell.position.row},${pathCell.position.col}`);
            if (!center) {
              console.warn(`[FLOOD-ERROR] Center not found for path cell (${pathCell.position.row},${pathCell.position.col})`);
              continue;
            }
            
            pathCenters.push({
              row: pathCell.position.row,
              col: pathCell.position.col,
              center
            });
          }
          
          if (pathCenters.length === 0) {
            console.warn(`[FLOOD-ERROR] No valid path centers for tile ${cell.id}`);
            return null;
          }
          
          if (debugAnim) {
            console.log(`[FLOOD-DEBUG] Synchronized path for ${cell.id}: ${pathCenters.map(p => `(${p.row},${p.col})`).join(' -> ')}`);
          }
          
          return { cell, pathCenters };
        }).filter(tp => tp !== null);

        // ----- BATCH-AWARE OCCUPANCY / OFFSETS ----------------------------------
        const batches = new Map<number, typeof tilePaths>();
        tilePaths.forEach(tp => {
          const batchIdx = (floodPaths && floodPaths[tp.cell.id] && (floodPaths[tp.cell.id] as any).batch) ?? 0;
          (tp as any).batch = batchIdx;
          if (!batches.has(batchIdx)) batches.set(batchIdx, [] as any);
          (batches.get(batchIdx) as any).push(tp);
        });

        const batchOffsets = new Map<string, number>();
        const perBatchMaxDelay = new Map<number, number>();

        batches.forEach((paths, batchIdx) => {
          const occupancy = new Map<string, Set<number>>();
          paths.sort((a: any, b: any) => a.pathCenters.length - b.pathCenters.length);
          paths.forEach((tp: any) => {
            let offset = 0;
            const maxOffset = 20;
            while (offset < maxOffset) {
              let conflict = false;
              for (let i = 0; i < tp.pathCenters.length; i++) {
                const pc = tp.pathCenters[i];
                const key = `${pc.row},${pc.col}`;
                const tIdx = i + offset;
                const set = occupancy.get(key);
                if (set && set.has(tIdx)) { conflict = true; break; }
              }
              if (!conflict) {
                for (let i = 0; i < tp.pathCenters.length; i++) {
                  const pc = tp.pathCenters[i];
                  if (pc.row === 0) continue;
                  const key = `${pc.row},${pc.col}`;
                  if (!occupancy.has(key)) occupancy.set(key, new Set());
                  occupancy.get(key)!.add(i + offset);
                }
                batchOffsets.set(tp.cell.id, offset);
                break;
              }
              offset++;
            }
            if (!batchOffsets.has(tp.cell.id)) batchOffsets.set(tp.cell.id, maxOffset);
          });

          // longest duration within this batch (steps)
          const longestSteps = Math.max(...paths.map((p: any)=>p.pathCenters.length));
          perBatchMaxDelay.set(batchIdx, (longestSteps-1)*perStep);
        });

        // --------- SCHEDULING ----------------------------------------------------
        let cumulativeStart = 0;
        const batchesSorted = [...batches.entries()].sort((a,b)=>a[0]-b[0]);

        let maxFinalDelay = 0;

        batchesSorted.forEach(([batchIdx, batchPaths])=>{
          const batchStart = cumulativeStart;

          (batchPaths as any).forEach(({ cell, pathCenters }: any)=>{
            const offset = batchOffsets.get(cell.id) ?? 0;
            const baseDelay = batchStart + offset*perStep;

            const initial = pathCenters[0].center;
            const fadeDelay = batchIdx === 0 ? 0 : batchStart;
            const createOv = () => setOverlays(prev => [...prev, { id: cell.id, letter: cell.letter, x: initial.x, y: initial.y, pulse: 0, rX: 0, rY: 0 }]);
            if (fadeDelay === 0) {
              createOv();
            } else {
              const ovT = window.setTimeout(createOv, fadeDelay);
              timersRef.current.push(ovT);
            }

            pathCenters.forEach((pc: any, stepIndex: number) => {
              const stepDelay = baseDelay + stepIndex*perStep;
              const arriveT = window.setTimeout(()=>{
                let rX=0,rY=0;
                if(stepIndex>0){
                  const prevPc = pathCenters[stepIndex-1];
                  const dx=pc.center.x-prevPc.center.x; const dy=pc.center.y-prevPc.center.y;
                  const mag=Math.max(1,Math.hypot(dx,dy));
                  const ampX=Math.min(12,cellSize.w*0.1); const ampY=Math.min(12,cellSize.h*0.1);
                  rX=-dx/mag*ampX; rY=-dy/mag*ampY;
                }
                setOverlays(prev=>prev.map(o=>o.id===cell.id?{...o,x:pc.center.x,y:pc.center.y,pulse:o.pulse+1,rX,rY}:o));
              },stepDelay);
              timersRef.current.push(arriveT);
            });

            const finalStepDelay = baseDelay + (pathCenters.length-1)*perStep;
            const finalBounceDelay = finalStepDelay + stepMs;
            if(finalBounceDelay>maxFinalDelay) maxFinalDelay=finalBounceDelay;
            const bounceT = window.setTimeout(()=>{
              setOverlays(prev=>prev.map(o=>o.id===cell.id?{...o,isFinal:true,pulse:o.pulse+1,rX:0,rY:0}:o));
              if(navigator.vibrate) navigator.vibrate(10);
            }, finalBounceDelay);
            timersRef.current.push(bounceT);

            const cleanupDelay = finalBounceDelay + 100;
            const doneT = window.setTimeout(()=>{
              setOverlays(prev=>prev.filter(o=>o.id!==cell.id));
              setHiddenCellIds(prev=>prev.filter(id=>id!==cell.id));
            }, cleanupDelay);
            timersRef.current.push(doneT);
          });

          cumulativeStart += (perBatchMaxDelay.get(batchIdx) ?? 0) + 160; // move to next batch start time
        });

        animationDoneSignal = () => {
          const advanceDelay = tilePaths.length === 0 ? 120 : maxFinalDelay + 160;
          const advanceT = window.setTimeout(() => {
            if (debugAnim) console.log('[FLD] ADVANCE', { at: tNow() });
            startPlayerPhase();
          }, advanceDelay);
          timersRef.current.push(advanceT);
        };
    }
    
    animationDoneSignal();

    return () => {
      timersRef.current.forEach(t => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, [phase, grid, previousGrid, cellSize.h, startPlayerPhase, gravityMoves, floodPaths, endRound]);

  const hasSelection = currentWord.length > 0;
  const validationState = currentWord.length >= 3 ? isWordValid : undefined;

  // Default selection for words
  const handleCellClick = useCallback((cell: HexCell) => {
    if (phase !== 'player') return;
    haptics.select();
    selectTile(cell.id);
  }, [phase, selectTile]);

  // Animated move: slide letter from source to target, hide letters during animation, then commit move
  

  const handleRestart = () => {
    // Prevent restart during daily challenges
    if (isDailyChallenge) {
      console.warn('Restart blocked: Daily challenge cannot be restarted');
      return;
    }
    
    // Stop any ongoing animations
    timersRef.current.forEach(t => window.clearTimeout(t));
    timersRef.current = [];
    setOverlays([]);
    setFxOverlays([]);
    setHiddenCellIds([]);
    setPreviousGrid([]);
    operationInProgressRef.current = false;
    resetGame();
    initializeGame();
  };
  

  const selectedSingle = selectedTiles.length === 1 ? selectedTiles[0] : null;

  return (
    <div className="game-container flex-1 bg-bg-primary overflow-hidden mobile-height">
      <div className="flex flex-col md:flex-row h-full">
        {/* Modern Desktop Game Sidebar */}
        <div 
          ref={sidebarRef}
          className={cn(
            "hidden md:flex game-sidebar w-72 flex-col overflow-hidden",
            "bg-bg-primary/95 backdrop-blur-sm border-r border-secondary/20",
            "shadow-2xl shadow-secondary/20"
          )}
        >
          {/* Modern Sidebar content */}
          <div className="flex flex-col h-full p-6 overflow-y-auto space-y-6">
            
            {/* Modern Game Stats */}
            <div className="space-y-4">
              {/* Primary Score Display */}
              <div className={cn(
                "bg-gradient-to-br from-amber/10 to-amber/5 border border-amber/20",
                "rounded-2xl p-6 text-center shadow-lg shadow-amber/10"
              )}>
                <div className="text-4xl font-bold text-amber mb-2">{score}</div>
                <div className="text-text-secondary text-sm font-medium uppercase tracking-wide">Score</div>
              </div>

              {/* Stats Row */}
              <div className="flex justify-between gap-4">
                <div className={cn(
                  "flex-1 bg-bg-secondary border border-secondary/20",
                  "rounded-xl p-4 text-center"
                )}>
                  <div className="text-xl font-semibold text-text-primary flex items-center justify-center space-x-2">
                    <Hash className="w-4 h-4" />
                    <span>{round}</span>
                  </div>
                  <div className="text-xs text-text-secondary font-medium uppercase tracking-wide mt-1">Round</div>
                </div>
                <div className={cn(
                  "flex-1 bg-bg-secondary border border-secondary/20",
                  "rounded-xl p-4 text-center"
                )}>
                  <div className="text-xl font-semibold text-text-primary flex items-center justify-center space-x-2">
                    <Zap className="w-4 h-4" />
                    <span>{freeOrbitsAvailable || 0}</span>
                  </div>
                  <div className="text-xs text-text-secondary font-medium uppercase tracking-wide mt-1">Orbits</div>
                </div>
              </div>
            </div>

            {/* Modern Next Drop Preview */}
            {previewLevel > 0 && nextRows.length > 0 && (
              <div className={cn(
                "bg-amber/10 border border-amber/20",
                "rounded-2xl p-4"
              )}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-text-primary">Next Drop</h3>
                  <div className="bg-amber/20 text-amber px-2 py-1 rounded-full text-xs font-medium">
                    Preview
                  </div>
                </div>
                <div className="flex gap-2 justify-center">
                  {nextRows[0]?.map((letter, idx) => (
                    <div key={idx} className={cn(
                      "w-8 h-8 bg-bg-secondary border border-secondary/30",
                      "rounded-xl flex items-center justify-center",
                      "text-sm font-semibold text-text-primary shadow-sm"
                    )}>
                      {letter}
                    </div>
                  ))}
                </div>
                {previewLevel > 1 && nextRows[1] && (
                  <div className="flex gap-2 justify-center mt-2 opacity-50">
                    {nextRows[1]?.map((letter, idx) => (
                      <div key={idx} className={cn(
                        "w-6 h-6 bg-secondary/20 border border-secondary/20",
                        "rounded-lg flex items-center justify-center",
                        "text-xs font-medium text-text-secondary"
                      )}>
                        {letter}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Modern Current Word Display */}
            {currentWord && (
              <div className={cn(
                "bg-amber/10 border border-amber/20",
                "rounded-2xl p-4"
              )}>
                <h3 className="text-sm font-semibold text-text-primary mb-3">Current Word</h3>
                <p className={cn(
                  "text-2xl font-mono text-amber font-bold text-center",
                  "bg-amber/10 rounded-xl py-3 tracking-wider"
                )}>
                  {currentWord}
                </p>
              </div>
            )}

            {/* Modern Words Submitted */}
            <div className={cn(
              "bg-success/10 border border-success/20",
              "rounded-2xl p-4"
            )}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-primary">Words Found</h3>
                <div className="bg-success/20 text-success px-2 py-1 rounded-full text-xs font-medium">
                  {wordsThisRound.length}
                </div>
              </div>
              {wordsThisRound.length > 0 ? (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {wordsThisRound.slice(-8).reverse().map((word, idx) => (
                    <div key={idx} className={cn(
                      "text-sm font-mono text-text-secondary",
                      "bg-success/5 px-3 py-2 rounded-lg",
                      "border border-success/10"
                    )}>
                      {word}
                    </div>
                  ))}
                  {wordsThisRound.length > 8 && (
                    <div className="text-xs text-text-muted italic text-center py-2">
                      ...and {wordsThisRound.length - 8} more words
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Target className="w-8 h-8 text-success/30 mx-auto mb-2" />
                  <div className="text-xs text-text-muted italic">No words found yet</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 h-full overflow-hidden relative">
          {/* Mobile Game Controls */}
          <div className="absolute top-0 left-0 right-0 z-10">
            <WaxleMobileGameControls
              score={score}
              round={round}
              wordsThisRound={wordsThisRound.length}
              wordsThisRoundList={wordsThisRound}
              currentWord={currentWord}
              freeOrbitsAvailable={freeOrbitsAvailable || 0}
              nextRows={nextRows}
              previewLevel={previewLevel}
            />
          </div>

          <div ref={containerRef} className="absolute inset-0 px-2">
            {/* Falling overlays */}
            <div className="pointer-events-none absolute inset-0 z-40">
              <AnimatePresence>
                {overlays.map(ov => (
                  <motion.div
                    key={ov.id}
                    initial={{ opacity: 0, scale: 0.92, x: ov.x - cellSize.w / 2, y: ov.y - cellSize.h / 2 }}
                    animate={{ opacity: 1, scale: 1, x: ov.x - cellSize.w / 2, y: ov.y - cellSize.h / 2 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'tween', duration: FLOOD_STEP_MS / 1000, ease: 'linear' }}
                    style={{ position: 'absolute', left: 0, top: 0 }}
                  >
                    <motion.div
                      key={ov.pulse}
                      initial={false}
                      animate={{ 
                        // Enhanced squash/stretch on impact for weight
                        scaleX: ov.isFinal ? 1.05 : 1,
                        scaleY: ov.isFinal ? 0.95 : 1,
                        opacity: ov.isFinal ? 1 : 0.96,
                        rotateZ: ov.isFinal ? 2 : 0
                      }}
                      transition={{ 
                        duration: ov.isFinal ? 0.25 : 0.2, 
                        ease: ov.isFinal ? "easeOut" : 'easeOut',
                        type: "tween"
                      }}
                      className="flex items-center justify-center relative"
                      style={{
                        width: `${cellSize.w}px`,
                        height: `${cellSize.h}px`,
                        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                        background: 'rgba(229,231,235,0.96)',
                        borderRadius: 8,
                        boxShadow: ov.isFinal 
                          ? '0 6px 14px rgba(0,0,0,0.08)' 
                          : '0 10px 20px rgba(0,0,0,0.12)'
                      }}
                    >
                      {/* Recoil inner wrapper */}
                      <motion.div
                        key={`recoil-${ov.pulse}`}
                        animate={{ x: [0, ov.rX || 0, 0], y: [0, ov.rY || 0, 0] }}
                        transition={{ type: 'tween', duration: 0.26, ease: [0.2, 0.7, 0.2, 1], times: [0, 0.45, 1] }}
                        className="flex items-center justify-center w-full h-full"
                      >
                        <span className="letter-tile" style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1f2937' }}>{ov.letter}</span>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Player-phase FX overlays (move/orbit/gravity) */}
            <div className="pointer-events-none absolute inset-0 z-50">
              <AnimatePresence>
                {fxOverlays.map(fx => (
                  <motion.div
                    key={fx.key}
                    initial={{ x: fx.x - cellSize.w / 2, y: fx.y - cellSize.h / 2, opacity: 1, scale: 1, rotateZ: 0 }}
                    animate={fx.kind === 'gravity' ? {
                      x: fx.x - cellSize.w / 2,
                      y: fx.y - cellSize.h / 2,
                      opacity: 1,
                      scale: 1,
                      rotateZ: 0
                    } : {
                      x: fx.x - cellSize.w / 2,
                      y: fx.y - cellSize.h / 2,
                      opacity: 1,
                      // Deep magnetic slingshot: dramatic burst, bounce, damped wobble
                      scale: [1, 1.5, 0.6, 1.3, 0.5, 1],
                      rotateZ: [0, 6, -8, 4, -2, 0]
                    }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={fx.kind === 'gravity' ? {
                      duration: 0.2,
                      ease: 'linear'
                    } : {
                      duration: 1.2,
                      times: [0, 0.15, 0.35, 0.55, 0.75, 1],
                      ease: 'anticipate' // pronounced ease-in then snap & wobble
                    }}
                    style={{ position: 'absolute', left: 0, top: 0 }}
                  >
                    <motion.div
                      className="flex items-center justify-center relative"
                      style={{
                        width: `${cellSize.w}px`,
                        height: `${cellSize.h}px`,
                        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                        background: 'rgba(229,231,235,0.96)',
                        borderRadius: 8,
                        boxShadow: '0 6px 14px rgba(0,0,0,0.12)'
                      }}
                      whileHover={{ scale: 1.05 }}
                      initial={{ rotateZ: 0 }}
                      animate={{ rotateZ: 0 }}
                      transition={{ duration: 0.4, ease: "easeInOut" }}
                    >
                      <span className="letter-tile" style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1f2937' }}>{fx.letter}</span>
                    </motion.div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Contextual move targets removed for now */}

            {/* Subtle hex selection outline around pivot - always show when tile selected */}
            {phase === 'player' && selectedSingle && orbitAnchor && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: orbitAnchor.x,
                  top: orbitAnchor.y,
                  transform: 'translate(-50%, -50%)',
                  width: `${cellSize.w}px`,
                  height: `${cellSize.h}px`,
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  zIndex: 58,

                }}
              />
            )}


            {phase === 'player' && selectedSingle && orbitAnchor && (freeOrbitsAvailable || 0) > 0 && (() => {
              // Arc Dragger UI for orbit controls
              const container = containerRef.current;
              if (!container) return null;
              const centers = mapCenters(container);
              const pivot = grid.find(c => c.id === selectedSingle.cellId);
              if (!pivot) return null;

              // Build canonical 6-slot map around pivot using DOM centers
              const pivotCenter = centers.get(`${pivot.position.row},${pivot.position.col}`);
              if (!pivotCenter) return null;

              // All actual neighbors within grid
              const neighborCandidates = grid.filter(c => c.id !== pivot.id && areCellsAdjacent(c, pivot));

              // Quantize neighbor angle to one of 6 slots
              const slotIndexToCell: (HexCell | null)[] = new Array(6).fill(null);
              const cellIdToSlotIndex = new Map<string, number>();
              neighborCandidates.forEach(cell => {
                const ctr = centers.get(`${cell.position.row},${cell.position.col}`);
                if (!ctr) return;
                const angle = Math.atan2(ctr.y - pivotCenter.y, ctr.x - pivotCenter.x);
                const norm = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
                const slotIdx = Math.round(norm / (Math.PI / 3)) % 6;
                // If collision, keep the closer one by angle distance
                if (slotIndexToCell[slotIdx]) {
                  const existing = slotIndexToCell[slotIdx]!;
                  const eCtr = centers.get(`${existing.position.row},${existing.position.col}`);
                  if (eCtr) {
                    const eAngle = Math.atan2(eCtr.y - pivotCenter.y, eCtr.x - pivotCenter.x);
                    const eNorm = ((eAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
                    const diffExisting = Math.abs(eNorm - slotIdx * (Math.PI / 3));
                    const diffNew = Math.abs(norm - slotIdx * (Math.PI / 3));
                    if (diffNew < diffExisting) slotIndexToCell[slotIdx] = cell;
                  }
                } else {
                  slotIndexToCell[slotIdx] = cell;
                }
                cellIdToSlotIndex.set(cell.id, slotIdx);
              });

              const orderedNeighbors = slotIndexToCell.filter((c): c is HexCell => !!c);
              const neighborIdToPresentIndex = new Map<string, number>();
              orderedNeighbors.forEach((n, idx) => neighborIdToPresentIndex.set(n.id, idx));

              orbitPlanRef.current = { pivotId: pivot.id, slotIndexToCell, cellIdToSlotIndex, orderedNeighbors, neighborIdToPresentIndex, pivotCenter };
              // Do not set state here to avoid render loops; initialize on drag start

              // Adjacent tiles with letters to preview during drag
              const adjacentTiles = grid
                .filter(c => c.id !== pivot.id && areCellsAdjacent(c, pivot) && c.letter && c.isPlaced)
                .map(cell => {
                  const center = centers.get(`${cell.position.row},${cell.position.col}`);
                  if (!center) return null;
                  const angle = Math.atan2(center.y - orbitAnchor.y, center.x - orbitAnchor.x);
                  return { cell, center: { x: center.x, y: center.y }, angle };
                })
                .filter((item): item is { cell: HexCell; center: { x: number; y: number }; angle: number } => item !== null)
                .sort((a, b) => a.angle - b.angle);

              if (adjacentTiles.length < 1) return null;

              const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
                if (!freeOrbitsAvailable || freeOrbitsAvailable <= 0) return;
                e.preventDefault();
                e.stopPropagation();

                // Initialize snapped state at start of drag
                setLockedSteps(0);
                lockedStepsRef.current = 0;
                setIsOverCancel(false);
                isOverCancelRef.current = false;

                const rect = container.getBoundingClientRect();
                const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
                const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

                const containerX = clientX - rect.left;
                const containerY = clientY - rect.top;

                const startAngle = Math.atan2(containerY - orbitAnchor.y, containerX - orbitAnchor.x);
                setCurrentDragAngle(0);
                setIsDragging(true);

                let totalRotation = 0;
                // Local copies to control hysteresis
                let currentLockedStepsLocal = 0;

                const handleDragMove = (moveE: MouseEvent | TouchEvent) => {
                  moveE.preventDefault();

                  const moveClientX = 'touches' in moveE ? moveE.touches[0].clientX : moveE.clientX;
                  const moveClientY = 'touches' in moveE ? moveE.touches[0].clientY : moveE.clientY;

                  const containerMoveX = moveClientX - rect.left;
                  const containerMoveY = moveClientY - rect.top;

                  // --- Orbit jitter guard --------------------------------------------------
                  // Very small drags near the pivot center cause the angle to flip wildly,
                  // which results in back-and-forth snapping between slots.  Delay engaging
                  // the snapping logic until the pointer is at least `minRadiusForSnap`
                  // away from the pivot.  This also gives the interaction a more
                  // "magnetic" feel — you need to pull the handle outward a little before
                  // it "catches" into the orbit track.
                  const dxPivot = containerMoveX - orbitAnchor.x;
                  const dyPivot = containerMoveY - orbitAnchor.y;
                  const radiusPivot = Math.hypot(dxPivot, dyPivot);
                  const minRadiusForSnap = cellSize.w * 0.45; // tweak as needed

                  if (radiusPivot < minRadiusForSnap) {
                    // Provide visual feedback (soft rotation) but skip snapping logic
                    const softAngle = Math.atan2(dyPivot, dxPivot) - startAngle;
                    setCurrentDragAngle(softAngle);
                    return;
                  }

                  // Detect pointer over cancel (X) icon area while dragging
                  const iconCX = orbitAnchor.x;
                  const iconCY = orbitAnchor.y - cellSize.h * 0.4;
                  const dxIcon = containerMoveX - iconCX;
                  const dyIcon = containerMoveY - iconCY;
                  const distIcon = Math.hypot(dxIcon, dyIcon);
                  const isCoarse = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
                  const cancelRadius = isCoarse ? 28 : 18; // larger on touch for reliability
                  const overCancelNow = distIcon <= cancelRadius;
                  if (overCancelNow !== isOverCancelRef.current) {
                    isOverCancelRef.current = overCancelNow;
                    setIsOverCancel(overCancelNow);
                  }
                  if (overCancelNow && lockedStepsRef.current !== 0) {
                    lockedStepsRef.current = 0;
                    currentLockedStepsLocal = 0;
                    setLockedSteps(0);
                  }

                  const currentAngle = Math.atan2(containerMoveY - orbitAnchor.y, containerMoveX - orbitAnchor.x);
                  let deltaAngle = currentAngle - startAngle;

                  while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
                  while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

                  // Update totalRotation with unwrap
                  const angleDifference = deltaAngle - totalRotation;
                  if (angleDifference > Math.PI) totalRotation = deltaAngle - 2 * Math.PI;
                  else if (angleDifference < -Math.PI) totalRotation = deltaAngle + 2 * Math.PI;
                  else totalRotation = deltaAngle;

                  // Hysteresis thresholds (radians)
                  const enterThreshold = Math.PI / 12; // ~15° to enter next slot
                  const exitThreshold = Math.PI * 5 / 12;  // ~75° to leave current slot

                  // Angle relative to current locked slot center
                  const relAngle = totalRotation - currentLockedStepsLocal * (Math.PI / 3);
                  let proposedStep = 0;
                  if (relAngle > enterThreshold) proposedStep = +1;
                  else if (relAngle < -enterThreshold) proposedStep = -1;

                  // Only allow at most ±1 change at a time and enforce exit threshold to go back
                  if (proposedStep !== 0) {
                    // If attempting to revert, require larger threshold
                    if ((proposedStep === -1 && relAngle > -exitThreshold) || (proposedStep === +1 && relAngle < enterThreshold)) {
                      proposedStep = 0;
                    }
                  }

                  // No external-ring; rotate among present neighbors only (always legal within grid)

                  if (proposedStep !== 0 && !overCancelNow) {
                    currentLockedStepsLocal += proposedStep;
                    setLockedSteps(currentLockedStepsLocal);
                    lockedStepsRef.current = currentLockedStepsLocal;
                    haptics.tick();
                    // Snap preview angle to the new slot centre for crisp, decisive motion
                    setCurrentDragAngle(currentLockedStepsLocal * (Math.PI / 3));
                  }

                  // Drive soft angle for UI feedback (handle rotation)
                  setCurrentDragAngle(totalRotation);
                };

                const handleDragEnd = (endE: MouseEvent | TouchEvent) => {
                  endE.preventDefault();
                  setIsDragging(false);

                  if (operationInProgressRef.current) return;

                  // Recompute over-cancel at end with a slightly larger radius for reliability
                  const endRect = container.getBoundingClientRect();
                  let endClientX: number;
                  let endClientY: number;
                  if ('changedTouches' in endE && endE.changedTouches && endE.changedTouches.length > 0) {
                    endClientX = endE.changedTouches[0].clientX;
                    endClientY = endE.changedTouches[0].clientY;
                  } else if ('touches' in endE && endE.touches && endE.touches.length > 0) {
                    endClientX = endE.touches[0].clientX;
                    endClientY = endE.touches[0].clientY;
                  } else {
                    endClientX = (endE as MouseEvent).clientX;
                    endClientY = (endE as MouseEvent).clientY;
                  }
                  const endX = endClientX - endRect.left;
                  const endY = endClientY - endRect.top;
                  const endIconCX = orbitAnchor.x;
                  const endIconCY = orbitAnchor.y - cellSize.h * 0.4;
                  const endDx = endX - endIconCX;
                  const endDy = endY - endIconCY;
                  const endDist = Math.hypot(endDx, endDy);
                  const endIsCoarse = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
                  const endCancelRadius = endIsCoarse ? 32 : 22; // slightly larger on release
                  const endOverCancel = endDist <= endCancelRadius;
                  isOverCancelRef.current = endOverCancel;
                  setIsOverCancel(endOverCancel);

                  const steps = Math.abs(lockedStepsRef.current);
                  if (steps >= 1 && !endOverCancel) {
                    operationInProgressRef.current = true;
                    
                    const direction = lockedStepsRef.current > 0 ? 'cw' : 'ccw';
                    console.log(`[ORBIT-DRAG] Committing ${steps} ${direction} rotations (lockedSteps: ${lockedStepsRef.current})`);

                    const storeState = useWaxleGameStore.getState();
                    let currentGrid = storeState.isDailyChallenge ? storeState.dailyGameState.grid : storeState.classicGameState.grid;
                    const plan = orbitPlanRef.current;
                    const pivot = currentGrid.find(c => c.id === selectedSingle.cellId);
                    if (!pivot || !plan || plan.pivotId !== pivot.id) {
                      operationInProgressRef.current = false;
                      return;
                    }

                    // Use canonical ordered neighbors for commit
                    const neighbors = plan.orderedNeighbors;
                    if (neighbors.length < 2) {
                      operationInProgressRef.current = false;
                      return;
                    }

                    // Get current locked tiles  
                    const storeState2 = useWaxleGameStore.getState();
                    const currentGameState = storeState2.isDailyChallenge ? storeState2.dailyGameState : storeState2.classicGameState;
                    const lockedTileIds = Array.isArray(currentGameState.lockedTiles) ? currentGameState.lockedTiles : [];
                    console.log('[ORBIT-UI] Locked tiles:', lockedTileIds);

                    // Extract current state: letters and lock status  
                    const neighborStates = neighbors.map(n => ({
                      cell: n,
                      letter: n.letter && n.isPlaced ? n.letter : '',
                      isLocked: lockedTileIds.includes(n.id)
                    }));

                    // Only rotate letters from unlocked tiles
                    const unlockedLetters = neighborStates
                      .filter(state => !state.isLocked)
                      .map(state => state.letter);

                    console.log('[ORBIT-UI] Unlocked letters to rotate:', unlockedLetters);

                    if (unlockedLetters.length < 2) {
                      toastService.error('Not enough unlocked neighbors to orbit');
                      
                      // Clean up orbit drag state properly
                      setIsDragging(false);
                      setIsOverCancel(false);
                      setCurrentDragAngle(0);
                      setLockedSteps(0);
                      lockedStepsRef.current = 0;
                      operationInProgressRef.current = false;
                      return;
                    }

                    // Rotate unlocked letters
                    let rotatedLetters = [...unlockedLetters];
                    for (let i = 0; i < steps; i++) {
                      console.log(`[ORBIT-UI] Applying step ${i + 1}/${steps} ${direction}`);
                      if (direction === 'cw') {
                        rotatedLetters = [rotatedLetters[rotatedLetters.length - 1], ...rotatedLetters.slice(0, rotatedLetters.length - 1)];
                      } else {
                        rotatedLetters = [...rotatedLetters.slice(1), rotatedLetters[0]];
                      }
                    }

                    // Distribute rotated letters back to unlocked positions
                    let rotatedIndex = 0;
                    const neighborIdToNewLetter = new Map<string, string>();
                    
                    neighborStates.forEach(({ cell, isLocked, letter }) => {
                      if (isLocked) {
                        // Locked tiles keep their current letter
                        neighborIdToNewLetter.set(cell.id, letter);
                        console.log(`[ORBIT-UI] Keeping locked tile ${cell.id}: ${letter}`);
                      } else {
                        // Unlocked tiles get the next rotated letter
                        const newLetter = rotatedLetters[rotatedIndex];
                        neighborIdToNewLetter.set(cell.id, newLetter);
                        console.log(`[ORBIT-UI] Moving ${cell.id}: ${letter} → ${newLetter}`);
                        rotatedIndex++;
                      }
                    });

                    currentGrid = currentGrid.map(cell => {
                      const finalLetter = neighborIdToNewLetter.get(cell.id);
                      if (finalLetter !== undefined) {
                        return { ...cell, letter: finalLetter, isPlaced: finalLetter !== '' };
                      }
                      return cell;
                    });

                    // Decrement orbit count properly  
                    const newOrbitsAvailable = Math.max(0, (currentGameState.freeOrbitsAvailable || 0) - 1);
                    
                    const { updateCurrentGameState } = useWaxleGameStore.getState();
                    updateCurrentGameState({ 
                      grid: currentGrid, 
                      selectedTiles: [], 
                      currentWord: '', 
                      freeOrbitsAvailable: newOrbitsAvailable
                    });
                    
                    toastService.success(`Orbit used (${newOrbitsAvailable} remaining)`);
                    haptics.success();
                    
                    operationInProgressRef.current = false;
                  } else {
                    console.log(`[ORBIT-DRAG] No rotation committed (lockedSteps: ${lockedStepsRef.current})`);
                  }

                  setIsOverCancel(false);
                  isOverCancelRef.current = false;
                  setCurrentDragAngle(0);

                  document.removeEventListener('mousemove', handleDragMove);
                  document.removeEventListener('mouseup', handleDragEnd);
                  document.removeEventListener('touchmove', handleDragMove);
                  document.removeEventListener('touchend', handleDragEnd);
                };

                document.addEventListener('mousemove', handleDragMove, { passive: false });
                document.addEventListener('mouseup', handleDragEnd, { passive: false });
                document.addEventListener('touchmove', handleDragMove, { passive: false });
                document.addEventListener('touchend', handleDragEnd, { passive: false });
              };
              
              return (
                <>
                  {(freeOrbitsAvailable || 0) > 0 && (
                    <div
                      onMouseDown={handleDragStart}
                      onTouchStart={handleDragStart}
                      className="absolute cursor-grab active:cursor-grabbing"
                      style={{
                        left: orbitAnchor.x,
                        top: orbitAnchor.y - cellSize.h * 0.4,
                        transform: 'translate(-50%, -50%)',
                        width: '24px',
                        height: '24px',
                        background: isDragging ? (isOverCancel ? 'rgba(107, 114, 128, 0.95)' : 'rgba(59, 130, 246, 0.9)') : 'rgba(59, 130, 246, 0.9)',
                        borderRadius: '50%',
                        border: '2px solid white',
                        zIndex: 62,
                        boxShadow: isDragging && isOverCancel ? '0 0 0 3px rgba(107,114,128,0.35)' : '0 2px 8px rgba(0, 0, 0, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isDragging ? '14px' : '15px',
                        color: 'white',
                        fontWeight: 'bold',
                        userSelect: 'none',
                        touchAction: 'none'
                      }}
                      title="Drag to rotate tiles around pivot"
                    >
                      {isDragging ? '×' : '↻'}
                    </div>
                  )}
                  
                  {isDragging && (
                    <>
                      {adjacentTiles.map(({ cell, center }) => {
                        // Drive overlay from locked steps using canonical slots
                        const plan = orbitPlanRef.current;
                        let drawX = center.x - cellSize.w / 2;
                        let drawY = center.y - cellSize.h / 2;
                        
                        // Check if this tile is locked
                        const currentState = useWaxleGameStore.getState();
                        const currentGameState = currentState.isDailyChallenge ? currentState.dailyGameState : currentState.classicGameState;
                        const lockedTileIds = Array.isArray(currentGameState.lockedTiles) ? currentGameState.lockedTiles : [];
                        const isLocked = lockedTileIds.includes(cell.id);
                        
                        // Only move unlocked tiles during preview
                        if (plan && !isLocked) {
                          const presentIdx = plan.neighborIdToPresentIndex.get(cell.id);
                          if (presentIdx !== undefined && plan.orderedNeighbors.length > 0) {
                            // Calculate position among ONLY unlocked tiles
                            const unlockedNeighbors = plan.orderedNeighbors.filter(n => !lockedTileIds.includes(n.id));
                            const unlockedPresentIdx = unlockedNeighbors.findIndex(n => n.id === cell.id);
                            
                            if (unlockedPresentIdx !== -1) {
                              const unlockedCount = unlockedNeighbors.length;
                              const targetUnlockedIdx = ((unlockedPresentIdx + lockedStepsRef.current) % unlockedCount + unlockedCount) % unlockedCount;
                              const targetCell = unlockedNeighbors[targetUnlockedIdx];
                              const targetCtr = centers.get(`${targetCell.position.row},${targetCell.position.col}`);
                              if (targetCtr) {
                                drawX = targetCtr.x - cellSize.w / 2;
                                drawY = targetCtr.y - cellSize.h / 2;
                              }
                            }
                          }
                        }
                        // If locked, drawX/drawY remain at original center position

                        // Border stroke disabled - no borders on orbiting tiles
                        // const borderColor = 'transparent'; // No border stroke - unused

                        // Snappy spring
                        return (
                          <motion.div
                            key={`preview-${cell.id}`}
                            className="absolute pointer-events-none"
                            initial={{ x: drawX, y: drawY, scale: 1, opacity: 1 }}
                            animate={{ x: drawX, y: drawY, scale: isLocked ? 1.0 : 1.02, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 950, damping: 50, mass: 1.5 }}
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              width: `${cellSize.w}px`,
                              height: `${cellSize.h}px`,
                              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                              background: isLocked 
                                ? 'rgba(251, 146, 60, 0.3)' // Orange for locked tiles
                                : isOverCancel ? 'rgba(156, 163, 175, 0.28)' : 'rgba(34, 197, 94, 0.32)',
                              zIndex: 59,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1rem',
                              fontWeight: 'bold',
                              color: isOverCancel ? 'rgba(156, 163, 175, 0.9)' : 'rgba(34, 197, 94, 0.92)',
                              boxShadow: isOverCancel ? '0 0 10px rgba(156, 163, 175, 0.25)' : '0 0 10px rgba(34, 197, 94, 0.3)'
                            }}
                          >
                            {/* SVG hexagonal border overlay - DISABLED */}
                            {cell.letter}
                          </motion.div>
                        );
                      })}

                    </>
                  )}
                </>
              );
            })()}

            {/* Lock button overlays */}
            {phase === 'player' && (() => {
              const container = containerRef.current;
              if (!container) return null;
              const centers = mapCenters(container);
              
              // Get tiles that should show lock buttons
              // - Show icons on locked/selected tiles 
              // - Exception: if multiple tiles selected, show icon only on last selected tile
              const isMultipleSelected = selectedTiles.length > 1;
              const lastSelectedTileId = isMultipleSelected ? selectedTiles[selectedTiles.length - 1].cellId : null;
              
              const tilesWithLockButtons = grid.filter(cell => 
                cell.letter && 
                cell.isPlaced && 
                (isMultipleSelected ? 
                  // Multiple selected: show icon only on last selected tile
                  cell.id === lastSelectedTileId :
                  // Single/no selection: show icons on all locked tiles and all selected tiles
                  (lockedTiles?.includes(cell.id) || selectedTiles.some(s => s.cellId === cell.id))
                )
              );

              return (
                <>
                  {tilesWithLockButtons.map(cell => {
                    const center = centers.get(`${cell.position.row},${cell.position.col}`);
                    if (!center) return null;
                    
                    const isLocked = lockedTiles?.includes(cell.id) || false;
                    
                    return (
                      <div
                        key={`lock-${cell.id}`}
                        className="absolute cursor-pointer"
                        style={{
                          left: center.x,
                          top: center.y + cellSize.h * 0.4, // Bottom position (inverted from orbit)
                          transform: 'translate(-50%, -50%)',
                          width: '24px',
                          height: '24px',
                          background: isLocked ? 'rgba(239, 68, 68, 0.9)' : 'rgba(34, 197, 94, 0.9)', // Red for locked, green for unlocked
                          borderRadius: '50%',
                          border: '2px solid white',
                          zIndex: 62,
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          color: 'white',
                          fontWeight: 'bold',
                          userSelect: 'none',
                          touchAction: 'none'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTileLock(cell.id);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        title={isLocked ? "Unlock this tile" : "Lock selected tiles"}
                      >
                        {isLocked ? '🔓' : '🔒'}
                      </div>
                    );
                  })}
                </>
              );
            })()}


            {/* Grid and UI Buttons container */}
            <div 
              className={`grid-container relative ${phase === 'flood' ? 'flood-phase' : ''}`}
              style={{ 
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2rem',
              }}
            >
              <HexGrid
                cells={grid.map(c => ({ ...c, isSelected: selectedTiles.some(t => t.cellId === c.id) }))}
                onCellClick={handleCellClick}
                isWordValid={validationState}
                isPlacementPhase={phase === 'player' ? !hasSelection : true}
                isWordAlreadyScored={false}
                placedTilesThisTurn={[]}
                gridSize={gridSize}
                isTetrisVariant={true}
                lockMode={lockMode}
                lockedTiles={lockedTiles}
                lockAnimatingTiles={lockAnimatingTiles}
                onTileLockToggle={toggleTileLock}
                hiddenLetterCellIds={[
                  ...hiddenCellIds,
                  ...(isDragging && selectedSingle ? 
                    grid.filter(c => c.id !== selectedSingle.cellId && areCellsAdjacent(c, grid.find(g => g.id === selectedSingle.cellId)!) && c.letter && c.isPlaced)
                      .map(c => c.id) : []
                  )
                ]}
              />
              
              {/* UI Buttons - now in same container as grid */}
              <div className="flex gap-2 flex-wrap items-center px-4 py-2 rounded-lg">
                <button 
                  onClick={() => submitWord()} 
                  disabled={currentWord.length < 3 || phase !== 'player' || validationState !== true} 
                  className={`py-1.5 px-3 text-sm font-medium rounded transition-colors ${
                    phase === 'player' && currentWord.length >= 3 && validationState === true
                      ? 'bg-amber-light hover:bg-amber text-white'
                      : 'bg-secondary-dark text-text-muted cursor-not-allowed'
                  }`}
                >
                  Submit Word
                </button>
                <button 
                  onClick={() => endPlayerPhase()} 
                  disabled={phase !== 'player'}
                  className={`py-1.5 px-3 text-sm font-medium rounded transition-colors ${
                    phase === 'player'
                      ? 'bg-accent hover:bg-accent-dark text-white'
                      : 'bg-secondary-dark text-text-muted cursor-not-allowed'
                  }`}
                >
                  End Turn
                </button>
                {!isDailyChallenge && (
                  <button 
                    onClick={handleRestart} 
                    disabled={phase === 'flood' || phase === 'gravitySettle'}
                    className={`py-1.5 px-3 text-sm font-medium rounded transition-colors ${
                      phase === 'flood' || phase === 'gravitySettle'
                        ? 'bg-secondary-dark text-text-muted cursor-not-allowed'
                        : 'bg-primary hover:bg-primary-dark text-white'
                    }`}
                  >
                    Restart
                  </button>
                )}
              </div>
            </div>

            </div>

          {/* Toast container - positioned based on modal state */}
          <div 
            className="absolute inset-x-0 pointer-events-none" 
            style={{ 
              top: phase === 'gameOver' ? '50%' : '75vh', /* Center for modal toasts, below UI for gameplay toasts */
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: phase === 'gameOver' ? 10000 : 9999,
            }}
          >
            <Toaster 
              containerStyle={{
                position: 'relative',
                width: '100vw',
              }}
              toastOptions={{
                style: {
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  minWidth: 'auto',
                  maxWidth: 'none',
                  width: 'auto',
                  padding: '12px 20px',
                }
              }}
            />
          </div>
        {/* <footer className="p-4 sm:p-6 text-center text-sm text-gray-600">
          © {new Date().getFullYear()} WAXLE - A Falling Tile Word Game
        </footer>  */}
        </div>
      </div>

      {/* Game Over Modal */}
      <WaxleGameOverModal
        isOpen={phase === 'gameOver'}
        score={score}
        totalWords={totalWords}
        round={round}
        longestWord={longestWord}
        onRestart={isDailyChallenge && onBackToDailyChallenge ? onBackToDailyChallenge : handleRestart}
        isDailyChallenge={isDailyChallenge}
        dailyDate={dailyDate}
        challengeStartTime={challengeStartTime}
      />
      
      <style>{`
        .mobile-height {
          height: 100vh; /* Fallback for browsers without svh support */
          height: 100svh; /* Modern browsers with small viewport height support */
        }
      `}</style>

    </div>
  );
};

export default WaxleGame; 