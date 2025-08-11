import { useRef, useEffect, useState, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useTetrisGameStore } from '../store/tetrisGameStore';
import HexGrid, { HexCell } from '../components/HexGrid';
import { areCellsAdjacent } from '../lib/tetrisGameUtils';
import GameOverModal from '../components/GameOverModal';

const CENTER_NUDGE_Y = 0; // pixels to nudge overlay vertically for visual centering (set to 0 for exact alignment)
// Flood animation timing constants
const FLOOD_STEP_MS = 100; // movement time between centers (ms)
const FLOOD_PAUSE_MS = 250; // dwell time at each slot (ms)

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
  
  const isDebug = typeof window !== 'undefined' && window.localStorage.getItem('tetrisDebugAnim') === '1';
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

type MoveTarget = { cellId: string; x: number; y: number };

type FxOverlay = { key: string; letter: string; x: number; y: number };

// (no-op placeholder removed)

const TetrisGame = ({ isSidebarOpen }: { isSidebarOpen: boolean; openMenu?: () => void; closeMenu: () => void; }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [previousGrid, setPreviousGrid] = useState<typeof grid>([]);
  const lastPlayerGridRef = useRef<typeof previousGrid>([]);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [fxOverlays, setFxOverlays] = useState<FxOverlay[]>([]);
  const timersRef = useRef<number[]>([]);
  const [hiddenCellIds, setHiddenCellIds] = useState<string[]>([]);
  const [cellSize, setCellSize] = useState<{ w: number; h: number }>({ w: 64, h: 56 });
  const [moveTargets, setMoveTargets] = useState<MoveTarget[]>([]);
  const [orbitAnchor, setOrbitAnchor] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartAngle, setDragStartAngle] = useState<number | null>(null);
  const [currentDragAngle, setCurrentDragAngle] = useState<number>(0);
  const [snappedRotation, setSnappedRotation] = useState<number>(0); // Tracks which 60° increment we're at

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
    nextRows,
    previewLevel,
    freeOrbitAvailable,
    initializeGame,
    selectTile,
    clearSelection,
    submitWord,
    endRound,
    startPlayerPhase,
    endPlayerPhase,
    resetGame,
    gridSize,
    moveTileOneStep,
    orbitPivot,
    gravityMoves,
    floodPaths,
  } = useTetrisGameStore();

  useEffect(() => { if (!gameInitialized) initializeGame(); }, [gameInitialized, initializeGame]);
  useEffect(() => {
    if (phase === 'player') {
      setPreviousGrid(grid);
      lastPlayerGridRef.current = grid;
      // Reset contextual UI state at start of player phase
      setMoveTargets([]);
      setOrbitAnchor(null);
      setFxOverlays([]);
    }
  }, [phase, grid]);

  // Compute contextual move targets and orbit anchor when exactly one tile is selected
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
      // Compute adjacent empty targets using the same adjacency logic as selection/scoring
      const targets: MoveTarget[] = grid
        .filter(c => c.id !== selectedCell.id && areCellsAdjacent(selectedCell, c))
        .filter(c => !c.letter || !c.isPlaced)
        .filter(c => {
          // Must remain connected: at least one occupied neighbor other than the source
          return grid.some(n => n.id !== selectedCell.id && n.letter && n.isPlaced && areCellsAdjacent(c, n));
        })
        .map(c => {
          const ctr = centers.get(`${c.position.row},${c.position.col}`);
          return ctr ? { cellId: c.id, x: ctr.x, y: ctr.y } : null;
        })
        .filter((t): t is MoveTarget => !!t);
      setMoveTargets(targets);
    } else {
      // Hide contextual UI when multi-select or none
      setMoveTargets([]);
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
        let maxDelay = 0;

        newlySettled.forEach((cell, idx) => {
            const sourceId = gravityMoves.get(cell.id);
            const sourceCell = previousGrid.find(c => c.id === sourceId);
            if (!sourceCell) return;

            const from = centers.get(`${sourceCell.position.row},${sourceCell.position.col}`);
            const to = centers.get(`${cell.position.row},${cell.position.col}`);
            if (!from || !to) return;

            const ovKey = `gset-${cell.id}-${Date.now()}`;
            setFxOverlays(prev => [...prev, { key: ovKey, letter: cell.letter, x: from.x, y: from.y }]);

            const animT = window.setTimeout(() => {
                setFxOverlays(prev => prev.map(o => o.key === ovKey ? { ...o, x: to.x, y: to.y } : o));
            }, 90 + idx * 60);
            timersRef.current.push(animT);

            const finalDelay = 320 + idx * 60;
            maxDelay = Math.max(maxDelay, finalDelay);

            const doneT = window.setTimeout(() => {
                setFxOverlays(prev => prev.filter(o => o.key !== ovKey));
                setHiddenCellIds(prev => prev.filter(id => id !== cell.id));
            }, finalDelay);
            timersRef.current.push(doneT);
        });

        animationDoneSignal = () => {
          const advanceT = window.setTimeout(() => {
            endRound();
          }, maxDelay + 80);
          timersRef.current.push(advanceT);
        };
    } else if (phase === 'flood') {
        const newlyFilled = grid
          .filter(cell => (cell as HexCell & { placedThisTurn?: boolean }).placedThisTurn)
          .sort((a, b) => (a.position.row - b.position.row) || (a.position.col - b.position.col));
        // Only hide tiles we will animate; leave others visible to avoid disappearing tiles
        setHiddenCellIds(newlyFilled.map(c => c.id));

        const debugAnim = typeof window !== 'undefined' && window.localStorage.getItem('tetrisDebugAnim') === '1';
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
        const topRowStartJitter = new Map<string, number>();
        const tilePaths = newlyFilled.map(cell => {
          // Use the exact path from the flood logic
          const pathIds = floodPaths && floodPaths[cell.id];
          
          if (!pathIds || pathIds.length === 0) {
            console.warn(`[FLOOD-ERROR] No path found for tile ${cell.id} in flood paths`);
            return null;
          }
          
          // Convert path IDs to centers, ensuring we follow the exact flood path
                     const pathCenters: Array<{ row: number; col: number; center: { x: number; y: number } }> = [];

           // Skip top-row duplicate at t=0 if multiple tiles share the same entry
           const firstCell = grid.find(g => g.id === pathIds[0]);
                        if (firstCell && firstCell.position.row === 0) {
               const entryKey = `${firstCell.position.row},${firstCell.position.col}`;
               if (usedTopEntries.has(entryKey)) {
                 // Nudge this tile to start 1 step later visually (it will animate starting from next path center)
                 pathIds.shift();
                 // Add a small per-entry jitter so staggered starters look natural
                 const prev = topRowStartJitter.get(entryKey) || 0;
                 topRowStartJitter.set(entryKey, prev + 1);
               }
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

        // Improved collision detection system that respects contiguous paths
        const occupancy = new Map<string, Set<number>>(); // slotKey -> set of timeIndices (stepIndex + offset)
        const tileOffsets = new Map<string, number>();
        
        // Sort tile paths by path length and starting position for better collision resolution
        const sortedTilePaths = [...tilePaths].sort((a, b) => {
          // Prioritize shorter paths first (they're more constrained)
          const lengthDiff = a.pathCenters.length - b.pathCenters.length;
          if (lengthDiff !== 0) return lengthDiff;
          
          // Then by starting column (left to right)
          return a.pathCenters[0].col - b.pathCenters[0].col;
        });
        
        sortedTilePaths.forEach(tp => {
          let offset = 0;
          const maxOffset = 20; // Increased to handle more converging tiles
          
          while (offset < maxOffset) {
            let conflict = false;
            
            // Check for conflicts along the entire path
            for (let i = 0; i < tp.pathCenters.length; i++) {
              const pc = tp.pathCenters[i];
              const key = `${pc.row},${pc.col}`;
              const timeIndex = i + offset;
              const set = occupancy.get(key);
              
              if (set && set.has(timeIndex)) {
                conflict = true;
                break;
              }
              
              // Additional check: ensure contiguous movement (no skipping over occupied slots)
              if (i > 0) {
                const prevPc = tp.pathCenters[i - 1];
                const prevKey = `${prevPc.row},${prevPc.col}`;
                const prevSet = occupancy.get(prevKey);
                const prevTimeIndex = (i - 1) + offset;
                
                // Ensure previous step is clear before moving to current
                if (prevSet && prevSet.has(prevTimeIndex + 1)) {
                  conflict = true;
                  break;
                }
              }
            }
            
            if (!conflict) {
                             // Reserve all positions in the path (except top row) with time buffers
               for (let i = 0; i < tp.pathCenters.length; i++) {
                 const pc = tp.pathCenters[i];
                 if (pc.row <= 0) continue; // allow top-row reuse
                 const key = `${pc.row},${pc.col}`;
                 const timeIndex = i + offset;
                 
                 if (!occupancy.has(key)) occupancy.set(key, new Set<number>());
                 occupancy.get(key)!.add(timeIndex);
                 
                 // Also reserve a buffer time to prevent phasing (3-frame buffer)
                 occupancy.get(key)!.add(timeIndex + 1);
                 occupancy.get(key)!.add(timeIndex + 2);
                 occupancy.get(key)!.add(timeIndex + 3);
               }
              
              tileOffsets.set(tp.cell.id, offset);
              break;
            }
            
            offset++;
          }
          
          // Fallback: if no valid offset found, use the maximum offset
          if (offset >= maxOffset) {
            tileOffsets.set(tp.cell.id, maxOffset);
          }
        });

        let maxFinalDelay = 0;

        if (debugAnim) {
          console.log('[FLD] START scheduling', {
            tiles: tilePaths.map(tp => ({ id: tp.cell.id, target: tp.cell.position, offset: tileOffsets.get(tp.cell.id) }))
          });
        }

        // Use the sorted paths for consistent animation ordering
        sortedTilePaths.forEach(({ cell, pathCenters }) => {
            const initial = pathCenters[0].center;
            setOverlays(prev => [...prev, { id: cell.id, letter: cell.letter, x: initial.x, y: initial.y - cellSize.h * 1.2, pulse: 0, rX: 0, rY: 0 }]);

                         const offset = tileOffsets.get(cell.id) ?? 0;
             let baseDelay = offset * perStep;

             // Apply a mild jitter for tiles starting from the same top-row entry
             const firstPathStep = pathCenters[0];
             if (firstPathStep && firstPathStep.row === 0) {
               const entryKey = `${firstPathStep.row},${firstPathStep.col}`;
               const count = topRowStartJitter.get(entryKey) || 0;
               if (count > 0) {
                 baseDelay += Math.min(count * 40, 160); // cap jitter at 160ms
               }
             }
            
            if (debugAnim) {
              console.log(`[FLOOD-DEBUG] Animating tile ${cell.id} with offset ${offset} along ${pathCenters.length} steps`);
            }

            // Animate each step of the contiguous path with consistent timing
            pathCenters.forEach((pc, stepIndex) => {
                const stepDelay = baseDelay + stepIndex * perStep;
                
                const arriveT = window.setTimeout(() => {
                    if (debugAnim) {
                      console.log(`[FLOOD-STEP] Tile ${cell.id} step ${stepIndex} at (${pc.row},${pc.col})`);
                    }
                    
                    // Compute realistic recoil based on movement direction
                    let rX = 0, rY = 0;
                    if (stepIndex > 0) {
                        const prevPc = pathCenters[stepIndex - 1];
                        const dx = pc.center.x - prevPc.center.x;
                        const dy = pc.center.y - prevPc.center.y;
                        const mag = Math.max(1, Math.hypot(dx, dy));
                        
                        // Scale recoil based on cell size
                        const ampX = Math.min(12, cellSize.w * 0.1);
                        const ampY = Math.min(12, cellSize.h * 0.1);
                        rX = -dx / mag * ampX;
                        rY = -dy / mag * ampY;
                    }
                    
                    setOverlays(prev => prev.map(o => 
                        o.id === cell.id 
                          ? { ...o, x: pc.center.x, y: pc.center.y, pulse: o.pulse + 1, rX, rY }
                          : o
                    ));
                }, stepDelay);
                timersRef.current.push(arriveT);
            });

            // Final impact animation
            const finalStepDelay = baseDelay + (pathCenters.length - 1) * perStep;
            const finalBounceDelay = finalStepDelay + stepMs;
            
            if (finalBounceDelay > maxFinalDelay) maxFinalDelay = finalBounceDelay;
            
            const bounceT = window.setTimeout(() => {
                if (debugAnim) console.log(`[FLOOD-FINAL] Tile ${cell.id} final bounce`);
                setOverlays(prev => prev.map(o => 
                    o.id === cell.id 
                      ? { ...o, isFinal: true, pulse: o.pulse + 1, rX: 0, rY: 0 } 
                      : o
                ));
            }, finalBounceDelay);
            timersRef.current.push(bounceT);

            // Clean up animation
            const cleanupDelay = finalBounceDelay + 100;
            const doneT = window.setTimeout(() => {
                if (debugAnim) {
                  const finalPos = pathCenters[pathCenters.length - 1];
                  console.log(`[FLOOD-DONE] Animation completed for tile ${cell.id} at (${finalPos.row}, ${finalPos.col})`);
                }
                
                setOverlays(prev => prev.filter(o => o.id !== cell.id));
                setHiddenCellIds(prev => prev.filter(id => id !== cell.id));
            }, cleanupDelay);
            timersRef.current.push(doneT);
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
    selectTile(cell.id);
  }, [phase, selectTile]);

  // Animated move: slide letter from source to target, hide letters during animation, then commit move
  const handleMoveTo = useCallback((sourceCellId: string, targetCellId: string) => {
    const container = containerRef.current; if (!container) return;
    const centers = mapCenters(container);
    const source = grid.find(c => c.id === sourceCellId);
    const target = grid.find(c => c.id === targetCellId);
    if (!source || !target) return;
    const sCenter = centers.get(`${source.position.row},${source.position.col}`);
    const tCenter = centers.get(`${target.position.row},${target.position.col}`);
    if (!sCenter || !tCenter) return;

    // Hide source letter during animation
    setHiddenCellIds(prev => Array.from(new Set([...prev, sourceCellId])));

    // Spawn overlay at source and animate to target
    const ovKey = `mvfx-${sourceCellId}-${targetCellId}-${Date.now()}`;
    setFxOverlays(prev => [...prev, { key: ovKey, letter: source.letter, x: sCenter.x, y: sCenter.y }]);
    // Animate
    const t = window.setTimeout(() => {
      setFxOverlays(prev => prev.map(o => o.key === ovKey ? { ...o, x: tCenter.x, y: tCenter.y } : o));
    }, 0);
    timersRef.current.push(t);

    // Commit move shortly after
    const commitT = window.setTimeout(() => {
      moveTileOneStep(sourceCellId, targetCellId);
      setFxOverlays(prev => prev.filter(o => o.key !== ovKey));
      setHiddenCellIds(prev => prev.filter(id => id !== sourceCellId));
    }, 140);
    timersRef.current.push(commitT);
  }, [grid, moveTileOneStep]);

  // Animated orbit: slide neighbor letters to next positions, hide during animation, then commit orbit
  const handleOrbit = useCallback((pivotCellId: string, dir: 'cw' | 'ccw') => {
    const container = containerRef.current; if (!container) return;
    const centers = mapCenters(container);
    const pivot = grid.find(c => c.id === pivotCellId); if (!pivot) return;

    // Build neighbors by adjacency and sort by angle around pivot for stable order
    const neighborTuples = grid
      .filter(c => c.id !== pivot.id && areCellsAdjacent(c, pivot))
      .map(cell => ({ cell, center: centers.get(`${cell.position.row},${cell.position.col}`) }))
      .filter((x): x is { cell: typeof grid[number]; center: { x: number; y: number; row: number; col: number } } => !!x.center);

    const pivotCenter = centers.get(`${pivot.position.row},${pivot.position.col}`);
    if (!pivotCenter || neighborTuples.length < 2) return;

    const neighbors = neighborTuples
      .map(x => ({ ...x, angle: Math.atan2(x.center.y - pivotCenter.y, x.center.x - pivotCenter.x) }))
      .sort((a, b) => a.angle - b.angle);

    // Letters and targets by index
    const letters = neighbors.map(n => (n.cell.letter && n.cell.isPlaced ? n.cell.letter : ''));
    const targets = neighbors.map(n => ({ x: n.center.x, y: n.center.y }));

    // Hide shown letters while animating
    setHiddenCellIds(prev => Array.from(new Set([...prev, ...neighbors.map(n => n.cell.id)])));

    // Create overlay per letter index and remember key at that index
    const keysByIndex: Array<string | null> = neighbors.map(() => null);
    neighbors.forEach((n, idx) => {
      const letter = letters[idx];
      if (!letter) return;
      const key = `orfx-${n.cell.id}-${Date.now()}`;
      keysByIndex[idx] = key;
      setFxOverlays(prev => [...prev, { key, letter, x: n.center.x, y: n.center.y }]);
    });

    // Animate overlays to next angular position; skip empty slots safely
    const animT = window.setTimeout(() => {
      neighbors.forEach((_n, idx) => {
        const letter = letters[idx];
        if (!letter) return;
        const nextIdx = dir === 'cw' ? (idx + 1) % neighbors.length : (idx - 1 + neighbors.length) % neighbors.length;
        const tCtr = targets[nextIdx];
        const key = keysByIndex[idx];
        if (!key || !tCtr) return;
        setFxOverlays(prev => prev.map(o => o.key === key ? { ...o, x: tCtr.x, y: tCtr.y } : o));
      });
    }, 0);
    timersRef.current.push(animT);

    // Commit orbit shortly after
    const commitT = window.setTimeout(() => {
      orbitPivot(pivotCellId, dir);
      // Clear overlays and unhide
      setFxOverlays(prev => prev.filter(o => !o.key.startsWith('orfx-')));
      setHiddenCellIds(prev => prev.filter(id => !neighbors.some(n => n.cell.id === id)));
    }, 180);
    timersRef.current.push(commitT);
  }, [grid, orbitPivot]);

  const handleRestart = () => {
    // Stop any ongoing animations
    timersRef.current.forEach(t => window.clearTimeout(t));
    timersRef.current = [];
    setOverlays([]);
    setFxOverlays([]);
    setHiddenCellIds([]);
    setPreviousGrid([]);
    resetGame();
    initializeGame();
  };
  
  const toggleDebugMode = () => {
    const current = localStorage.getItem('tetrisDebugAnim') === '1';
    localStorage.setItem('tetrisDebugAnim', current ? '0' : '1');
    console.log(`[DEBUG] Flood animation debug ${current ? 'DISABLED' : 'ENABLED'}`);
  };

  const selectedSingle = selectedTiles.length === 1 ? selectedTiles[0] : null;

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
                        // Squash/stretch on impact for weight
                        scaleX: ov.isFinal ? [1, 1.08, 1] : [1, 1.035, 1],
                        scaleY: ov.isFinal ? [1, 0.92, 1] : [1, 0.975, 1],
                        opacity: ov.isFinal ? [0.92, 1] : 0.96,
                        boxShadow: ov.isFinal 
                          ? ['0 14px 26px rgba(0,0,0,0.16)','0 6px 14px rgba(0,0,0,0.08)','0 0 0 rgba(0,0,0,0)'] 
                          : '0 10px 20px rgba(0,0,0,0.12)'
                      }}
                      transition={{ duration: ov.isFinal ? 0.15 : 0.2, ease: 'easeOut' }}
                      className="flex items-center justify-center relative"
                      style={{
                        width: `${cellSize.w}px`,
                        height: `${cellSize.h}px`,
                        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                        background: 'rgba(229,231,235,0.96)', // slightly darker than before
                        borderRadius: 8
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

            {/* Player-phase FX overlays (move/orbit) */}
            <div className="pointer-events-none absolute inset-0 z-50">
              <AnimatePresence>
                {fxOverlays.map(fx => (
                  <motion.div
                    key={fx.key}
                    initial={{ x: fx.x - cellSize.w / 2, y: fx.y - cellSize.h / 2, opacity: 1 }}
                    animate={{ x: fx.x - cellSize.w / 2, y: fx.y - cellSize.h / 2, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    style={{ position: 'absolute', left: 0, top: 0 }}
                  >
                    <div
                      className="flex items-center justify-center relative"
                      style={{
                        width: `${cellSize.w}px`,
                        height: `${cellSize.h}px`,
                        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                        background: 'rgba(229,231,235,0.96)', // slightly darker than before
                        borderRadius: 8,
                        boxShadow: '0 6px 14px rgba(0,0,0,0.08)'
                      }}
                    >
                      <span className="letter-tile" style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1f2937' }}>{fx.letter}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Contextual interactive elements (move targets, orbit) - hide during drag */}
            {phase === 'player' && selectedSingle && !isDragging && moveTargets.map(t => (
              <div
                key={`mv-${t.cellId}`}
                onClick={() => handleMoveTo(selectedSingle.cellId, t.cellId)}
                title="Move here"
                className="shadow-inner"
                style={{
                  position: 'absolute',
                  left: t.x,
                  top: t.y,
                  transform: 'translate(-50%, -50%)',
                  width: `${cellSize.w}px`,
                  height: `${cellSize.h}px`,
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  background: 'rgba(0,0,0,0.18)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  zIndex: 60
                }}
              />
            ))}

            {phase === 'player' && selectedSingle && orbitAnchor && (() => {
              // Arc Dragger UI for orbit controls
              const container = containerRef.current;
              if (!container) return null;
              const centers = mapCenters(container);
              const pivot = grid.find(c => c.id === selectedSingle.cellId);
              if (!pivot) return null;
              
              // Get adjacent occupied tiles that will orbit
              const adjacentTiles = grid
                .filter(c => c.id !== pivot.id && areCellsAdjacent(c, pivot) && c.letter && c.isPlaced)
                .map(cell => {
                  const center = centers.get(`${cell.position.row},${cell.position.col}`);
                  if (!center) return null;
                  const angle = Math.atan2(center.y - orbitAnchor.y, center.x - orbitAnchor.x);
                  return { cell, center, angle };
                })
                .filter((item): item is { cell: HexCell; center: { x: number; y: number }; angle: number } => item !== null)
                .sort((a, b) => a.angle - b.angle);
              
              // Only show orbit controls if there are at least 2 tiles to orbit
              if (adjacentTiles.length < 2) return null;
              
              // Get IDs of tiles that should be hidden during drag
              const dragHiddenTileIds = isDragging ? adjacentTiles.map(t => t.cell.id) : [];
              
              const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
                if (!freeOrbitAvailable) return;
                e.preventDefault();
                e.stopPropagation();
                
                const rect = container.getBoundingClientRect();
                const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
                const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
                
                // Convert to container-relative coordinates
                const containerX = clientX - rect.left;
                const containerY = clientY - rect.top;
                
                const startAngle = Math.atan2(containerY - orbitAnchor.y, containerX - orbitAnchor.x);
                setDragStartAngle(startAngle);
                setCurrentDragAngle(0);
                setSnappedRotation(0);
                setIsDragging(true);
                
                let totalRotation = 0; // Track cumulative rotation across multiple full turns
                let currentSnappedSteps = 0; // Track snapped steps locally in closure
                
                const handleDragMove = (moveE: MouseEvent | TouchEvent) => {
                  moveE.preventDefault();
                  
                  const moveClientX = 'touches' in moveE ? moveE.touches[0].clientX : moveE.clientX;
                  const moveClientY = 'touches' in moveE ? moveE.touches[0].clientY : moveE.clientY;
                  
                  // Convert to container-relative coordinates
                  const containerMoveX = moveClientX - rect.left;
                  const containerMoveY = moveClientY - rect.top;
                  
                  const currentAngle = Math.atan2(containerMoveY - orbitAnchor.y, containerMoveX - orbitAnchor.x);
                  let deltaAngle = currentAngle - startAngle;
                  
                  // Normalize the delta angle to -π to π
                  while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
                  while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
                  
                  // Accumulate total rotation across multiple turns
                  const angleDifference = deltaAngle - totalRotation;
                  if (angleDifference > Math.PI) {
                    totalRotation = deltaAngle - 2 * Math.PI;
                  } else if (angleDifference < -Math.PI) {
                    totalRotation = deltaAngle + 2 * Math.PI;
                  } else {
                    totalRotation = deltaAngle;
                  }
                  
                  console.log(`[DRAG-DEBUG] totalRotation: ${(totalRotation * 180 / Math.PI).toFixed(1)}°`);
                  
                  // Calculate snapped rotation - hex positions are every 60° (π/3)
                  const snapIncrement = Math.PI / 3; // 60 degrees
                  const rawSteps = totalRotation / snapIncrement;
                  const snappedSteps = Math.round(rawSteps);
                  const snappedAngle = snappedSteps * snapIncrement;
                  
                  console.log(`[DRAG-DEBUG] rawSteps: ${rawSteps.toFixed(2)}, snappedSteps: ${snappedSteps}`);
                  
                  // Apply magnetic snapping - if we're within 15° of a snap point, snap to it
                  const snapThreshold = Math.PI / 12; // 15 degrees
                  const distanceToSnap = Math.abs(totalRotation - snappedAngle);
                  
                  if (distanceToSnap < snapThreshold) {
                    setCurrentDragAngle(snappedAngle);
                    setSnappedRotation(snappedSteps);
                    currentSnappedSteps = snappedSteps; // Update local variable
                    console.log(`[DRAG-DEBUG] SNAPPED to ${snappedSteps} steps`);
                  } else {
                    setCurrentDragAngle(totalRotation);
                    setSnappedRotation(snappedSteps); // Still track the target snap for visual feedback
                    currentSnappedSteps = snappedSteps; // Update local variable
                    console.log(`[DRAG-DEBUG] Tracking towards ${snappedSteps} steps`);
                  }
                };
                
                const handleDragEnd = (endE: MouseEvent | TouchEvent) => {
                  endE.preventDefault();
                  setIsDragging(false);
                  
                  // Commit the rotation if we moved at least one full step (60°)
                  if (Math.abs(currentSnappedSteps) >= 1) {
                    const direction = currentSnappedSteps > 0 ? 'cw' : 'ccw';
                    const steps = Math.abs(currentSnappedSteps);
                    
                    console.log(`[ORBIT-DRAG] Committing ${steps} ${direction} rotations (currentSnappedSteps: ${currentSnappedSteps})`);
                    
                    // Apply all rotations directly to the game store in one go
                    let tempPivotId = selectedSingle.cellId;
                    for (let i = 0; i < steps; i++) {
                      console.log(`[ORBIT-DRAG] Applying step ${i + 1}/${steps} ${direction}`);
                      
                      // Bypass the handleOrbit animation and call orbitPivot directly
                      // But only consume freeOrbitAvailable on the first call
                      if (i === 0) {
                        orbitPivot(tempPivotId, direction);
                      } else {
                        // For subsequent rotations, call the orbit logic directly without the availability check
                        const currentGrid = useTetrisGameStore.getState().grid;
                        const pivot = currentGrid.find(c => c.id === tempPivotId);
                        if (pivot) {
                          const p = pivot.position;
                          const neighborCandidates = currentGrid.filter(c => c.id !== pivot.id && areCellsAdjacent(c, pivot));
                          const neighbors = neighborCandidates
                            .map(n => ({ n, angle: Math.atan2(n.position.row - p.row, n.position.col - p.col) }))
                            .sort((a, b) => a.angle - b.angle)
                            .map(x => x.n);

                          if (neighbors.length >= 2) {
                            const letters = neighbors.map(n => (n.letter && n.isPlaced ? n.letter : ''));
                            const rotated = direction === 'cw'
                              ? [letters[letters.length - 1], ...letters.slice(0, letters.length - 1)]
                              : [...letters.slice(1), letters[0]];

                            const neighborIdToNewLetter = new Map<string, string>();
                            neighbors.forEach((n, idx) => neighborIdToNewLetter.set(n.id, rotated[idx]));

                            const newGrid = currentGrid.map(cell => {
                              const newLetter = neighborIdToNewLetter.get(cell.id);
                              if (newLetter !== undefined) {
                                return { ...cell, letter: newLetter, isPlaced: newLetter !== '' };
                              }
                              return cell;
                            });

                            // Update the grid directly without consuming freeOrbitAvailable
                            useTetrisGameStore.setState({ grid: newGrid });
                          }
                        }
                      }
                    }
                  } else {
                    console.log(`[ORBIT-DRAG] No rotation committed (currentSnappedSteps: ${currentSnappedSteps})`);
                  }
                  
                  setCurrentDragAngle(0);
                  setSnappedRotation(0);
                  setDragStartAngle(null);
                  
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
              
              const ringRadius = cellSize.w * 0.6;
              
              return (
                <>
                  {/* Glowing hex selection ring around pivot */}
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: orbitAnchor.x,
                      top: orbitAnchor.y,
                      transform: 'translate(-50%, -50%)',
                      width: `${cellSize.w * 1.4}px`,
                      height: `${cellSize.h * 1.4}px`,
                      clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                      border: `3px solid ${freeOrbitAvailable ? 'rgba(59, 130, 246, 0.8)' : 'rgba(156, 163, 175, 0.5)'}`,
                      zIndex: 58,
                      boxShadow: freeOrbitAvailable ? '0 0 12px rgba(59, 130, 246, 0.4)' : 'none',
                      animation: freeOrbitAvailable ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
                    }}
                  />
                  
                  {/* Single drag handle for orbit */}
                  {freeOrbitAvailable && (
                    <div
                      onMouseDown={handleDragStart}
                      onTouchStart={handleDragStart}
                      className="absolute cursor-grab active:cursor-grabbing"
                      style={{
                        left: orbitAnchor.x + Math.cos(-Math.PI / 6) * ringRadius, // Top-right position
                        top: orbitAnchor.y + Math.sin(-Math.PI / 6) * ringRadius,
                        transform: 'translate(-50%, -50%)',
                        width: '24px',
                        height: '24px',
                        background: 'rgba(59, 130, 246, 0.9)',
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
                      title="Drag to rotate tiles around pivot"
                    >
                      🔄
                    </div>
                  )}
                  
                  {/* Real-time rotation preview during drag with magnetic snapping */}
                  {isDragging && (
                    <>
                      {adjacentTiles.map(({ cell, center }, index) => {
                        // Calculate rotated position using the current drag angle
                        const dx = center.x - orbitAnchor.x;
                        const dy = center.y - orbitAnchor.y;
                        const rotatedX = orbitAnchor.x + dx * Math.cos(currentDragAngle) - dy * Math.sin(currentDragAngle);
                        const rotatedY = orbitAnchor.y + dx * Math.sin(currentDragAngle) + dy * Math.cos(currentDragAngle);
                        
                        // Calculate if this position is "snapped" - within snap threshold
                        const snapIncrement = Math.PI / 3; // 60 degrees
                        const snappedAngle = Math.round(currentDragAngle / snapIncrement) * snapIncrement;
                        const distanceToSnap = Math.abs(currentDragAngle - snappedAngle);
                        const isSnapped = distanceToSnap < Math.PI / 12; // 15 degrees
                        
                        return (
                          <motion.div
                            key={`preview-${cell.id}`}
                            className="absolute pointer-events-none"
                            initial={{ 
                              x: rotatedX - cellSize.w / 2, 
                              y: rotatedY - cellSize.h / 2,
                              scale: 1,
                              opacity: 1
                            }}
                            animate={{
                              x: rotatedX - cellSize.w / 2,
                              y: rotatedY - cellSize.h / 2,
                              scale: isSnapped ? 1.05 : 1, // Slight scale up when snapped
                              opacity: 1
                            }}
                            transition={{
                              type: "spring",
                              stiffness: isSnapped ? 400 : 150, // Stiffer spring for snapping
                              damping: isSnapped ? 25 : 20,
                              mass: 0.5
                            }}
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              width: `${cellSize.w}px`,
                              height: `${cellSize.h}px`,
                              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                              background: isSnapped 
                                ? 'rgba(34, 197, 94, 0.4)' // Green when snapped
                                : 'rgba(59, 130, 246, 0.3)', // Blue when floating
                              border: `2px solid ${isSnapped ? 'rgba(34, 197, 94, 0.8)' : 'rgba(59, 130, 246, 0.6)'}`,
                              borderRadius: 8,
                              zIndex: 59,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1rem',
                              fontWeight: 'bold',
                              color: isSnapped ? 'rgba(34, 197, 94, 0.9)' : 'rgba(59, 130, 246, 0.9)',
                              boxShadow: isSnapped 
                                ? '0 0 12px rgba(34, 197, 94, 0.4)' // Glow when snapped
                                : 'none'
                            }}
                          >
                            {cell.letter}
                          </motion.div>
                        );
                      })}
                      
                      {/* Visual feedback for snap points */}
                      {Array.from({ length: 6 }, (_, i) => {
                        const snapAngle = (i * Math.PI) / 3; // Every 60°
                        const snapRadius = cellSize.w * 0.45;
                        const snapX = orbitAnchor.x + Math.cos(snapAngle) * snapRadius;
                        const snapY = orbitAnchor.y + Math.sin(snapAngle) * snapRadius;
                        
                        // Check if current rotation is close to this snap point
                        const distanceToThisSnap = Math.abs(((currentDragAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - snapAngle);
                        const isNearSnap = Math.min(distanceToThisSnap, 2 * Math.PI - distanceToThisSnap) < Math.PI / 12;
                        
                        return (
                          <motion.div
                            key={`snap-${i}`}
                            className="absolute pointer-events-none"
                            animate={{
                              scale: isNearSnap ? 1.5 : 1,
                              opacity: isNearSnap ? 0.8 : 0.3,
                            }}
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 20
                            }}
                            style={{
                              left: snapX,
                              top: snapY,
                              transform: 'translate(-50%, -50%)',
                              width: '8px',
                              height: '8px',
                              background: isNearSnap ? 'rgba(34, 197, 94, 0.8)' : 'rgba(156, 163, 175, 0.6)',
                              borderRadius: '50%',
                              zIndex: 57,
                              boxShadow: isNearSnap ? '0 0 8px rgba(34, 197, 94, 0.4)' : 'none'
                            }}
                          />
                        );
                      })}
                    </>
                  )}
                </>
              );
            })()}

            {/* Grid */}
            <div className={`grid-container flex justify-center mt-12 relative z-10 ${phase === 'flood' ? 'flood-phase' : ''}`}>
              <HexGrid
                cells={grid.map(c => ({ ...c, isSelected: selectedTiles.some(t => t.cellId === c.id) }))}
                onCellClick={handleCellClick}
                isWordValid={validationState}
                isPlacementPhase={phase === 'player' ? !hasSelection : true}
                isWordAlreadyScored={false}
                placedTilesThisTurn={[]}
                gridSize={gridSize}
                hiddenLetterCellIds={[
                  ...hiddenCellIds,
                  ...(isDragging && selectedSingle ? 
                    grid.filter(c => c.id !== selectedSingle.cellId && areCellsAdjacent(c, grid.find(g => g.id === selectedSingle.cellId)!) && c.letter && c.isPlaced)
                      .map(c => c.id) : []
                  )
                ]}
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
                  <button onClick={() => endPlayerPhase()} className="py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-md transition-colors">End Turn</button>
                </>
              )}
              {/* Removed Start Playing button; auto-advance to player phase after flood */}
              <button onClick={handleRestart} className="py-2 px-4 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-md transition-colors">Restart Game</button>
              <button onClick={toggleDebugMode} className="py-1 px-2 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-md transition-colors">Debug</button>
            </div>
          </div>
        </div>
      </div>
      <Toaster position="bottom-center" />

      {/* Game Over Modal */}
      <GameOverModal
        isOpen={phase === 'gameOver'}
        score={score}
        words={wordsThisRound.length} // Assuming totalWords is not directly available here, using wordsThisRound.length
        boardPercent={Math.round((grid.filter(c => c.letter && c.isPlaced).length / Math.max(1, grid.length)) * 100)}
        onRestart={handleRestart}
        onClose={() => startPlayerPhase()}
      />
    </div>
  );
};

export default TetrisGame; 