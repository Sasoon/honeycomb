import { useRef, useEffect, useState, useCallback, useLayoutEffect, startTransition, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
// Sound functionality removed for Tetris variant
import { motion, AnimatePresence } from 'framer-motion';
import { Hash } from 'lucide-react';
import { OptimizedCounter } from '../components/OptimizedCounter';
import { DynamicZapIcon } from '../components/DynamicZapIcon';
import { cn } from '../lib/utils';
import { calculateDisplayWordScore } from '../lib/gameUtils';
import { useWaxleGameStore } from '../store/waxleGameStore';

// Performance optimization: Debounce utility for resize handler
const debounce = <T extends (...args: any[]) => void>(func: T, wait: number): T => {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
};
import HexGrid, { HexCell } from '../components/HexGrid';
import { areCellsAdjacent, countAdjacentEdges } from '../lib/waxleGameUtils';
import { haptics } from '../lib/haptics';
import toastService from '../lib/toastService';
import WaxleGameOverModal from '../components/WaxleGameOverModal';
import WaxleMobileGameControls from '../components/WaxleMobileGameControls';
import GameControls from '../components/GameControls';

const CENTER_NUDGE_Y = 0; // pixels to nudge overlay vertically for visual centering (set to 0 for exact alignment)
// Flood animation timing constants
const FLOOD_STEP_MS = 100; // movement time between centers (ms)
const FLOOD_PAUSE_MS = 250; // dwell time at each slot (ms)
const GRAVITY_SHORT_DELAY_MS = 100;
const PHASE_GAP_MS = 160;

// Round thresholds (for future difficulty scaling)
// const ROUND_TILE_THRESHOLDS = { FOUR: 5, FIVE: 8, SIX: 11 } as const;

type FloodPathEntry = { path: string[]; batch: number };
type FloodPathsMap = Record<string, FloodPathEntry>;
type TilePathCenters = Array<{ row: number; col: number; center: { x: number; y: number } }>;
type BatchPaths = Map<number, Array<{ cell: HexCell; pathCenters: TilePathCenters }>>;

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
  const uiTimersRef = useRef<number[]>([]);
  const transitionTokenRef = useRef(0);
  const desiredIsDesktopRef = useRef<boolean | null>(null);
  const [hiddenCellIds, setHiddenCellIds] = useState<string[]>([]);
  const [cellSize, setCellSize] = useState<{ w: number; h: number }>({ w: 64, h: 56 });
  const [orbitAnchor, setOrbitAnchor] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [, setCurrentDragAngle] = useState<number>(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showDesktopSidebar, setShowDesktopSidebar] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [isGridRepositioning, setIsGridRepositioning] = useState(false);
  const [gridAnimationPhase, setGridAnimationPhase] = useState<'horizontal' | 'vertical' | 'none' | 'synchronized' | 'vertical-first' | 'horizontal-second'>('none');
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
  const anchorNeighborIdRef = useRef<string | null>(null);
  const [, setLockedSteps] = useState<number>(0); // magnetic snapped steps (value stored in ref)
  const lockedStepsRef = useRef<number>(0);
  const [isOverCancel, setIsOverCancel] = useState<boolean>(false);
  const isOverCancelRef = useRef<boolean>(false);
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    gridSize,
    gravityMoves,
    gravitySource,
    floodPaths,
    tilesHiddenForAnimation: _unusedTiles,
    dailyDate,
    challengeStartTime,
    currentAutoClearWord,
    autoClearPhase,
    autoClearLetterIndex,
    justScoredWord,
  } = currentGameState;

  const {
    initializeGame,
    selectTile,
    submitWord,
    orbitPivot,
    undoLastAction,
    canUndo,
    endRound,
    startPlayerPhase,
    endPlayerPhase,
    resetGame,
    processNextAutoClearWord,
    findAndStartNextAutoClear,
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

  // Handle auto-clear letter-by-letter highlighting
  useEffect(() => {
    if (phase === 'autoClearing' && autoClearPhase === 'clear' && currentAutoClearWord && autoClearLetterIndex !== undefined) {
      const LETTER_HIGHLIGHT_DELAY = 250; // ms per letter
      const wordLength = currentAutoClearWord.word.length;

      // Increment letter index until all letters shown
      if (autoClearLetterIndex < wordLength - 1) {
        const timer = window.setTimeout(() => {
          const { updateCurrentGameState } = useWaxleGameStore.getState();
          updateCurrentGameState({
            autoClearLetterIndex: autoClearLetterIndex + 1,
          });
        }, LETTER_HIGHLIGHT_DELAY);

        return () => clearTimeout(timer);
      } else {
        // All letters highlighted, wait briefly then clear
        const timer = window.setTimeout(() => {
          console.log('[AUTO-CLEAR UI] All letters highlighted, triggering clear');
          processNextAutoClearWord();
        }, LETTER_HIGHLIGHT_DELAY + 200); // Extra delay after last letter

        return () => clearTimeout(timer);
      }
    }
  }, [phase, autoClearPhase, currentAutoClearWord, autoClearLetterIndex, processNextAutoClearWord]);

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
    // Clear any stale overlays before scheduling new ones to avoid duplicate keys
    setOverlays([]);

    const container = containerRef.current; if (!container) return;
    const centers = mapCenters(container);

    let animationDoneSignal = () => {};

    if (phase === 'gravitySettle' && gravityMoves && gravityMoves.size > 0) {
        const newlySettled = grid.filter(cell => cell.placedThisTurn);
        setHiddenCellIds(newlySettled.map(c => c.id));
        
        // Handle case where gravity moves were detected but no tiles actually need animation
        if (newlySettled.length === 0 || prefersReducedMotion) {
            // No tiles to animate, or reduce motion
            animationDoneSignal = () => {
                const advanceT = window.setTimeout(() => {
                    // Check gravity source to determine next action
                    if (gravitySource === 'autoClear') {
                        // Auto-clear cascade: look for next word
                        console.log(`[AUTO-CLEAR] Gravity settled after auto-clear, looking for next word`);
                        findAndStartNextAutoClear();
                    } else if (gravitySource === 'wordSubmit') {
                        // Player word submit: trigger flood
                        console.log(`[GRAVITY] Gravity settled after word submission, ending round`);
                        endRound();
                    } else if (gravitySource === 'orbit') {
                        // Orbit gravity: return to player phase
                        startPlayerPhase();
                    }
                }, GRAVITY_SHORT_DELAY_MS);
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
                // Check gravity source to determine next action
                if (gravitySource === 'autoClear') {
                  // Auto-clear cascade: look for next word
                  console.log(`[AUTO-CLEAR] Gravity settled after auto-clear, looking for next word`);
                  findAndStartNextAutoClear();
                } else if (gravitySource === 'wordSubmit') {
                  // Player word submit: trigger flood
                  console.log(`[GRAVITY] Gravity settled after word submission, ending round`);
                  endRound();
                } else if (gravitySource === 'orbit') {
                  // Orbit gravity: return to player phase
                  startPlayerPhase();
                }
              }, maxDelay + 100);
              timersRef.current.push(advanceT);
            };
        }
    } else if (phase === 'flood') {
        const newlyFilled = grid
          .filter(cell => (cell as HexCell & { placedThisTurn?: boolean }).placedThisTurn)
          .sort((a, b) => (a.position.row - b.position.row) || (a.position.col - b.position.col));
        
        const debugAnim = typeof window !== 'undefined' && window.localStorage.getItem('waxleDebugAnim') === '1';
        const tNow = () => (typeof performance !== 'undefined' ? Math.round(performance.now()) : Date.now());

        if (prefersReducedMotion) {
          // Reveal immediately and skip path animation
          setHiddenCellIds(prev => prev.filter(id => !newlyFilled.some(c => c.id === id)));
          animationDoneSignal = () => {
            const advanceT = window.setTimeout(() => {
              // After flood, check if we should scan for auto-clear words
              if (justScoredWord) {
                console.log(`[AUTO-CLEAR] Flood complete, scanning for auto-clear words`);
                findAndStartNextAutoClear();
              } else {
                startPlayerPhase();
              }
            }, 120);
            timersRef.current.push(advanceT);
          };
        } else {
          // Animation constants
          const stepMs = FLOOD_STEP_MS; // movement time between centers (ms)
          const pauseMs = FLOOD_PAUSE_MS;  // dwell time at each slot (ms)
          const perStep = stepMs + pauseMs;

          // Use the provided flood paths from the new flood logic
          const centers = mapCenters(containerRef.current!);
          
          if (debugAnim) {
            console.log('[FLOOD-DEBUG] Starting synchronized animation for', newlyFilled.length, 'tiles');
            console.log('[FLOOD-DEBUG] Flood paths available:', Object.keys(floodPaths || {}).length);
          }
          
                 // Prevent top-row overlap: ensure one overlay per top-row entry at t=0
          const usedTopEntries = new Set<string>();
          const floodPathsTyped = (floodPaths || {}) as FloodPathsMap;
          const tilePaths = newlyFilled.map(cell => {
            // Use the exact path from the flood logic
            const p = floodPathsTyped && floodPathsTyped[cell.id];
            const pathIds: string[] | null = p && Array.isArray(p.path) ? p.path : null;
            if (!pathIds || pathIds.length === 0) {
              console.warn(`[FLOOD-ERROR] No path found for tile ${cell.id} in flood paths`);
              return null;
            }
            let pathIdsCopy = [...pathIds];
            
            // Convert path IDs to centers, ensuring we follow the exact flood path
            const pathCenters: TilePathCenters = [];

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
          }).filter(tp => tp !== null) as Array<{ cell: HexCell; pathCenters: TilePathCenters }>;

          // ----- BATCH-AWARE OCCUPANCY / OFFSETS ----------------------------------
          const batches: BatchPaths = new Map();
          tilePaths.forEach(tp => {
            const entry = floodPathsTyped && floodPathsTyped[tp.cell.id];
            const batchIdx = entry ? entry.batch : 0;
            if (!batches.has(batchIdx)) batches.set(batchIdx, []);
            batches.get(batchIdx)!.push(tp);
          });

          const batchOffsets = new Map<string, number>();
          const perBatchMaxDelay = new Map<number, number>();

          batches.forEach((paths, batchIdx) => {
            const occupancy = new Map<string, Set<number>>();
            paths.sort((a, b) => a.pathCenters.length - b.pathCenters.length);
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
              const createOv = () => setOverlays(prev => {
                const next = prev.filter(o => o.id !== cell.id);
                next.push({ id: cell.id, letter: cell.letter, x: initial.x, y: initial.y, pulse: 0, rX: 0, rY: 0 });
                return next;
              });
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

            cumulativeStart += (perBatchMaxDelay.get(batchIdx) ?? 0) + PHASE_GAP_MS; // move to next batch start time
          });

          animationDoneSignal = () => {
            const advanceDelay = tilePaths.length === 0 ? GRAVITY_SHORT_DELAY_MS + 20 : maxFinalDelay + PHASE_GAP_MS;
            const advanceT = window.setTimeout(() => {
              if (debugAnim) console.log('[FLD] ADVANCE', { at: tNow() });

              // After flood, check if we should scan for auto-clear words
              if (justScoredWord) {
                console.log(`[AUTO-CLEAR] Flood complete, scanning for auto-clear words`);
                findAndStartNextAutoClear();
              } else {
                startPlayerPhase();
              }
            }, advanceDelay);
            timersRef.current.push(advanceT);
          };
        }
    }
    
    animationDoneSignal();

    return () => {
      timersRef.current.forEach(t => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, [phase, grid, previousGrid, cellSize.h, startPlayerPhase, gravityMoves, floodPaths, endRound, prefersReducedMotion]);

  // Performance optimization: Memoize resize handler
  const checkScreenSize = useCallback(() => {
      const newIsDesktop = window.innerWidth >= 768;
      
      // Initialize on first load
      if (showDesktopSidebar === false && showMobileControls === false) {
        setIsDesktop(newIsDesktop);
        setShowDesktopSidebar(newIsDesktop);
        setShowMobileControls(!newIsDesktop);
        return;
      }
      
      if (newIsDesktop === isDesktop) return;

      // Cancel any pending UI transition timers
      uiTimersRef.current.forEach(t => window.clearTimeout(t));
      uiTimersRef.current = [];

      // Bump transition token and record desired target
      transitionTokenRef.current += 1;
      const token = transitionTokenRef.current;
      desiredIsDesktopRef.current = newIsDesktop;
      
      // Handle transitions with batched state updates (interruptible)
      startTransition(() => {
        setIsTransitioning(true);
        setIsGridRepositioning(true);
        setIsDesktop(newIsDesktop);
        
        if (newIsDesktop) {
          // Mobile → Desktop: Staggered reverse animation sequence
          setGridAnimationPhase('vertical-first'); // Phase 1: Vertical movement first
          setShowMobileControls(false);
        } else {
          // Desktop → Mobile: Staggered animation sequence  
          setGridAnimationPhase('horizontal'); // Phase 1: Horizontal slide with controls entrance
          setShowDesktopSidebar(false);
          setShowMobileControls(true);
        }
      });
      
      if (newIsDesktop) {
        // Phase 2: After vertical movement, trigger horizontal slide
        const t1 = window.setTimeout(() => {
          if (transitionTokenRef.current !== token) return;
          setGridAnimationPhase('horizontal-second');
        }, 50); // Small delay to ensure vertical starts first
        uiTimersRef.current.push(t1);
        
        // After both animations complete, show sidebar and reset
        const t2 = window.setTimeout(() => {
          if (transitionTokenRef.current !== token) return;
          startTransition(() => {
            setShowDesktopSidebar(true);
            setIsGridRepositioning(false);
            setGridAnimationPhase('none');
          });
        }, 650); // 300ms vertical + 50ms gap + 300ms horizontal
        uiTimersRef.current.push(t2);
      } else {
        // Phase 2: After horizontal movement, adjust vertical position
        const t1 = window.setTimeout(() => {
          if (transitionTokenRef.current !== token) return;
          setGridAnimationPhase('vertical');
        }, 50); // Small delay to ensure horizontal starts first
        uiTimersRef.current.push(t1);
        
        // Complete transition
        const t2 = window.setTimeout(() => {
          if (transitionTokenRef.current !== token) return;
          startTransition(() => {
            setIsGridRepositioning(false);
            setGridAnimationPhase('none');
          });
        }, 600); // Total time for both phases
        uiTimersRef.current.push(t2);
      }
    }, [isDesktop, showDesktopSidebar, showMobileControls]);
    
    // Screen size detection with debounced resize handler
    useEffect(() => {
      // Performance optimization: Debounce resize handler to prevent excessive calls
      const debouncedCheckScreenSize = debounce(checkScreenSize, 150);
      
      checkScreenSize(); // Initial call
      window.addEventListener('resize', debouncedCheckScreenSize);
      return () => {
        window.removeEventListener('resize', debouncedCheckScreenSize);
        uiTimersRef.current.forEach(t => window.clearTimeout(t));
        uiTimersRef.current = [];
      };
    }, [checkScreenSize]);

  // Performance optimization: Memoize expensive calculations
  const hasSelection = currentWord.length > 0;
  const validationState = useMemo(() => 
    currentWord.length >= 3 ? isWordValid : undefined, 
    [currentWord.length, isWordValid]
  );
  
  const currentWordScore = useMemo(() => {
    if (currentWord.length >= 3 && validationState === true) {
      const selectedTileIds = selectedTiles.map(t => t.cellId);
      const adjacentEdges = countAdjacentEdges(selectedTileIds, grid);
      return calculateDisplayWordScore(currentWord, round, adjacentEdges);
    }
    return 0;
  }, [currentWord, round, validationState, selectedTiles, grid]);

  // Default selection for words
  const handleCellClick = useCallback((cell: HexCell) => {
    if (phase !== 'player') return;
    haptics.select();
    selectTile(cell.id);
  }, [phase, selectTile]);

  // Animated move: slide letter from source to target, hide letters during animation, then commit move
  

  const [isSettling, setIsSettling] = useState(false);

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
    setIsSettling(true);
    window.setTimeout(() => setIsSettling(false), 700);
  };
  

  const selectedSingle = selectedTiles.length === 1 ? selectedTiles[0] : null;

  return (
    <div className="game-container flex-1 bg-bg-primary overflow-hidden mobile-height transition-[height,padding] duration-300 ease-in-out relative">
      {/* Mobile Game Controls - Outside flex container to prevent layout shifts */}
      <div className={cn("absolute top-0 left-0 right-0 z-10", isDesktop ? "hidden" : "block")}>
        <AnimatePresence
          onExitComplete={() => {
            if (desiredIsDesktopRef.current) {
              setShowDesktopSidebar(true);
              setIsTransitioning(false);
            }
          }}
        >
          {showMobileControls && (
            <motion.div
              key="mobile-controls"
              initial={{ y: -80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -80, opacity: 0 }}
              transition={{ 
                type: "spring",
                stiffness: 300,
                damping: 30,
                mass: 0.6
              }}
              style={{ willChange: 'transform' }}
            >
              <WaxleMobileGameControls
                score={score}
                round={round}
                wordsThisRound={wordsThisRound.length}
                wordsThisRoundList={wordsThisRound}
                currentWord={currentWord}
                freeOrbitsAvailable={freeOrbitsAvailable || 0}
                nextRows={nextRows}
                previewLevel={previewLevel}
                isWordValid={validationState === true}
                selectedTiles={selectedTiles}
                grid={grid}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className={cn(
        "flex h-full transition-[width,transform] duration-300 ease-in-out",
        (isDesktop || showDesktopSidebar || isTransitioning) ? "flex-row" : "flex-col"
      )}>
        {/* Modern Desktop Game Sidebar with Optimized Animation */}
        <AnimatePresence
          onExitComplete={() => {
            // Sidebar finished exiting → we are in mobile view now.
            if (desiredIsDesktopRef.current === false) {
              setShowMobileControls(true);
              setIsTransitioning(false);
            }
          }}
        >
          {showDesktopSidebar && (
            <motion.div
              ref={sidebarRef}
              key="desktop-sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '18rem', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ 
                type: "spring",
                stiffness: 300,
                damping: 30,
                mass: 0.8
              }}
              style={{ willChange: 'transform', overflow: 'hidden' }}
              className={cn(
                "flex game-sidebar flex-col",
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
                <div className="text-4xl font-bold text-amber mb-2">
                  <OptimizedCounter 
                    value={score} 
                    duration={1.0}
                    animationType="ticker"
                    className="tabular-nums"
                    delay={0}
                  />
                </div>
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
                    <OptimizedCounter 
                      value={round} 
                      animationType="tick"
                      className="min-w-[24px] tabular-nums"
                      delay={200}
                    />
                  </div>
                  <div className="text-xs text-text-secondary font-medium uppercase tracking-wide mt-1">Round</div>
                </div>
                <div className={cn(
                  "flex-1 bg-bg-secondary border border-secondary/20",
                  "rounded-xl p-4 text-center"
                )}>
                  <div className="text-xl font-semibold text-text-primary flex items-center justify-center space-x-2">
                    <DynamicZapIcon 
                      orbitsAvailable={freeOrbitsAvailable || 0}
                      maxOrbits={2}
                      size={20}
                      className="flex-shrink-0"
                      animationDelay={400}
                    />
                    <span>{freeOrbitsAvailable || 0}</span>
                  </div>
                  <div className="text-xs text-text-secondary font-medium uppercase tracking-wide mt-1">
                    {(freeOrbitsAvailable || 0) === 1 ? 'Orbit' : 'Orbits'}
                  </div>
                </div>
              </div>
            </div>

            {/* Next Drop with Border-Intersecting Labels */}
            {previewLevel > 0 && nextRows.length > 0 && (
              <div className="space-y-4">
                <div className="relative">
                  <div className={cn(
                    "bg-amber/10 border border-amber/20 rounded-xl p-3"
                  )}>
                    <div className="flex items-center justify-center gap-1">
                      {nextRows[0]?.map((letter, idx) => (
                        <div key={idx} className={cn(
                          "w-7 h-7 bg-bg-secondary border border-secondary/30",
                          "rounded-lg flex items-center justify-center",
                          "text-xs font-semibold text-text-primary"
                        )}>
                          {letter}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="absolute -top-3 left-4">
                    <span className="bg-bg-primary px-2 text-xs font-medium text-amber uppercase tracking-wide">
                      Next
                    </span>
                  </div>
                </div>
                {previewLevel > 1 && nextRows[1] && (
                  <div className="relative">
                    <div className={cn(
                      "bg-secondary/5 border border-secondary/10 rounded-xl p-3 pt-5 opacity-60"
                    )}>
                      <div className="flex items-center justify-center gap-1">
                        {nextRows[1]?.map((letter, idx) => (
                          <div key={idx} className={cn(
                            "w-5 h-5 bg-secondary/10 border border-secondary/20",
                            "rounded flex items-center justify-center",
                            "text-xs font-medium text-text-secondary"
                          )}>
                            {letter}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="absolute -top-3 left-4">
                      <span className="bg-bg-primary px-2 text-xs font-medium text-text-muted uppercase tracking-wide">
                        Then
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Current Word with Border-Intersecting Label */}
            {currentWord && (
              <div className="relative">
                <div className={cn(
                  "text-lg font-mono text-amber font-bold text-center",
                  "bg-amber/10 border border-amber/30 rounded-xl p-3"
                )}>
                  {currentWord}
                  {currentWord.length >= 3 && validationState === true && (
                    <span className="text-amber-dark ml-2">
                      (+{currentWordScore})
                    </span>
                  )}
                </div>
                <div className="absolute -top-3 left-4">
                  <span className="bg-bg-primary px-2 text-xs font-medium text-amber uppercase tracking-wide">
                    Current
                  </span>
                </div>
              </div>
            )}

            {/* Words Found with Border-Intersecting Label */}
            <div className="relative">
              <div className={cn(
                "bg-success/10 border border-success/20",
                "rounded-xl p-4 pt-6"
              )}>
                {wordsThisRound.length > 0 ? (
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {wordsThisRound.slice(-8).reverse().map((word, idx) => (
                      <div key={idx} className={cn(
                        "text-sm font-mono text-text-secondary",
                        "bg-success/5 px-2 py-1 rounded-lg"
                      )}>
                        {word}
                      </div>
                    ))}
                    {wordsThisRound.length > 8 && (
                      <div className="text-xs text-text-muted italic text-center py-1">
                        +{wordsThisRound.length - 8} more
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-3">
                    <div className="text-xs text-text-muted italic">No words found yet</div>
                  </div>
                )}
              </div>
              <div className="absolute -top-3 left-4 flex items-center gap-2">
                <span className="bg-bg-primary px-2 text-xs font-medium text-amber uppercase tracking-wide">
                  Found ({wordsThisRound.length})
                </span>
              </div>
            </div>

          </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content */}
        <div className="flex-1 h-full overflow-hidden relative">

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

            {/* Subtle hex selection outline - remove dependency on selectedSingle for orbit */}
            {phase === 'player' && orbitAnchor && (
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


            {phase === 'player' && orbitAnchor && (freeOrbitsAvailable || 0) > 0 && (() => {
              // Arc Dragger UI for orbit controls (pivot chosen on hold)
              const container = containerRef.current;
              if (!container) return null;
              const centers = mapCenters(container as HTMLElement);
              // Defer building plan until hold begins; here we only render the ring interaction layer

              const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
                if (!freeOrbitsAvailable || freeOrbitsAvailable <= 0) return;

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
                const isCoarse = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

                let totalRotation = 0;
                let currentLockedStepsLocal = 0;
                let holdSatisfied = false;
                let holdTimer: number | null = null;

                const startAngle = Math.atan2(containerY - orbitAnchor.y, containerX - orbitAnchor.x);

                const beginOrbit = () => {
                  if (holdSatisfied) return;
                  holdSatisfied = true;
                  // From this point on, orbit is active → consume events
                  e.preventDefault();
                  e.stopPropagation();

                setCurrentDragAngle(0);
                setIsDragging(true);

                // Use the selected tile as pivot directly
                if (selectedTiles.length !== 1) return;
                const selectedId = selectedTiles[0].cellId;
                const pivot = grid.find(c => c.id === selectedId);
                if (!pivot) return;
                const pivotCenter = centers.get(`${pivot.position.row},${pivot.position.col}`);
                if (!pivotCenter) return;
                setOrbitAnchor({ x: pivotCenter.x, y: pivotCenter.y });

                const neighborCandidates = grid.filter(c => c.id !== pivot.id && areCellsAdjacent(c, pivot));
                const slotIndexToCell: (HexCell | null)[] = new Array(6).fill(null);
                const cellIdToSlotIndex = new Map<string, number>();
                neighborCandidates.forEach(cell => {
                  const ctr = centers.get(`${cell.position.row},${cell.position.col}`);
                  if (!ctr) return;
                  const angleN = Math.atan2(ctr.y - pivotCenter.y, ctr.x - pivotCenter.x);
                  const norm = ((angleN % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
                  const slotIdx = Math.round(norm / (Math.PI / 3)) % 6;
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

                // Determine which neighbor is under pointer → anchor it
                anchorNeighborIdRef.current = null;
                {
                  const startPoint = { x: containerX, y: containerY };
                  let nearestIdLocal: string | null = null;
                  let nearestNeighborDist = Infinity;
                  orderedNeighbors.forEach(n => {
                    const ctr = centers.get(`${n.position.row},${n.position.col}`);
                    if (!ctr) return;
                    const d = Math.hypot(startPoint.x - ctr.x, startPoint.y - ctr.y);
                    if (d < nearestNeighborDist) { nearestNeighborDist = d; nearestIdLocal = n.id; }
                  });
                  const distPivot0 = Math.hypot(startPoint.x - pivotCenter.x, startPoint.y - pivotCenter.y);
                  if (nearestIdLocal && nearestNeighborDist < distPivot0) {
                    anchorNeighborIdRef.current = nearestIdLocal;
                  }
                }

                const handleDragMove = (moveE: MouseEvent | TouchEvent) => {
                  moveE.preventDefault();

                    const moveClientX = 'touches' in moveE ? moveE.touches[0].clientX : (moveE as MouseEvent).clientX;
                    const moveClientY = 'touches' in moveE ? moveE.touches[0].clientY : (moveE as MouseEvent).clientY;

                  const containerMoveX = moveClientX - rect.left;
                  const containerMoveY = moveClientY - rect.top;

                  // --- Orbit jitter guard --------------------------------------------------
                    const dxPivot = containerMoveX - pivotCenter.x;
                    const dyPivot = containerMoveY - pivotCenter.y;
                  const radiusPivot = Math.hypot(dxPivot, dyPivot);
                  const minRadiusForSnap = cellSize.w * 0.45; // tweak as needed

                  if (radiusPivot < minRadiusForSnap) {
                    const softAngle = Math.atan2(dyPivot, dxPivot) - startAngle;
                    setCurrentDragAngle(softAngle);
                    return;
                  }

                  // Detect pointer over cancel (X) icon area while dragging
                    const iconCX = pivotCenter.x;
                    const iconCY = pivotCenter.y - cellSize.h * 0.4;
                  const dxIcon = containerMoveX - iconCX;
                  const dyIcon = containerMoveY - iconCY;
                  const distIcon = Math.hypot(dxIcon, dyIcon);
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

                  const currentAngle = Math.atan2(containerMoveY - pivotCenter.y, containerMoveX - pivotCenter.x);
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
                    if ((proposedStep === -1 && relAngle > -exitThreshold) || (proposedStep === +1 && relAngle < enterThreshold)) {
                      proposedStep = 0;
                    }
                  }

                  if (proposedStep !== 0 && !overCancelNow) {
                    currentLockedStepsLocal += proposedStep;
                    setLockedSteps(currentLockedStepsLocal);
                    lockedStepsRef.current = currentLockedStepsLocal;
                    haptics.tick();
                    setCurrentDragAngle(currentLockedStepsLocal * (Math.PI / 3));
                  }

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
                    const endIconCX = pivotCenter.x;
                    const endIconCY = pivotCenter.y - cellSize.h * 0.4;
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
                    const pivot = currentGrid.find(c => c.id === selectedSingle?.cellId);
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

                      // Auto-anchored neighbor: keep its letter in place; rotate others
                      const anchoredId = anchorNeighborIdRef.current;
                    const neighborStates = neighbors.map(n => ({
                      cell: n,
                      letter: n.letter && n.isPlaced ? n.letter : '',
                        isAnchored: anchoredId === n.id
                      }));
                      
                      // Only rotate letters from non-anchored tiles
                      const rotatableLetters = neighborStates
                        .filter(state => !state.isAnchored)
                      .map(state => state.letter);

                      console.log('[ORBIT-UI] Rotatable letters to rotate:', rotatableLetters);

                      if (rotatableLetters.length < 2) {
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

                    // Store original letter positions for comparison
                    const originalLetterPositions = new Map<string, string>();
                    neighborStates.forEach(({ cell, letter }) => {
                      originalLetterPositions.set(cell.id, letter);
                    });

                    // Rotate unlocked letters
                      let rotatedLetters = [...rotatableLetters];
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
                    
                      neighborStates.forEach(({ cell, isAnchored, letter }) => {
                        if (isAnchored) {
                          // Anchored tile keeps its current letter
                        neighborIdToNewLetter.set(cell.id, letter);
                          console.log(`[ORBIT-UI] Keeping anchored tile ${cell.id}: ${letter}`);
                      } else {
                        // Unlocked tiles get the next rotated letter
                        const newLetter = rotatedLetters[rotatedIndex];
                        neighborIdToNewLetter.set(cell.id, newLetter);
                        console.log(`[ORBIT-UI] Moving ${cell.id}: ${letter} → ${newLetter}`);
                        rotatedIndex++;
                      }
                    });

                    // Check if any tiles actually moved to new positions
                    let actualMovement = false;
                    for (const [cellId, newLetter] of neighborIdToNewLetter.entries()) {
                      const originalLetter = originalLetterPositions.get(cellId);
                      if (originalLetter !== newLetter) {
                        actualMovement = true;
                        break;
                      }
                    }

                    if (!actualMovement) {
                      console.log('[ORBIT-UI] No actual movement detected - tiles returned to original positions');
                      toastService.error('No tiles moved - orbit canceled');
                      
                      // Clean up orbit drag state properly
                      setIsDragging(false);
                      setIsOverCancel(false);
                      setCurrentDragAngle(0);
                      setLockedSteps(0);
                      lockedStepsRef.current = 0;
                      operationInProgressRef.current = false;
                      return;
                    }

                    currentGrid = currentGrid.map(cell => {
                      const finalLetter = neighborIdToNewLetter.get(cell.id);
                      if (finalLetter !== undefined) {
                        return { ...cell, letter: finalLetter, isPlaced: finalLetter !== '' };
                      }
                      return cell;
                    });

                    // Push current state to history before orbit operation
                    const { pushToHistory } = useWaxleGameStore.getState();
                    pushToHistory('orbit');

                    // Decrement orbit count properly
                    const newOrbitsAvailable = Math.max(0, (currentGameState.freeOrbitsAvailable || 0) - 1);

                    // Apply orbit (will also apply gravity and potentially enter gravitySettle phase)
                    orbitPivot(currentGrid);

                    // Update orbit count and clear selection
                    const { updateCurrentGameState } = useWaxleGameStore.getState();
                    updateCurrentGameState({
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

                    document.removeEventListener('mousemove', handleDragMove as EventListener);
                    document.removeEventListener('mouseup', handleDragEnd as EventListener);
                    document.removeEventListener('touchmove', handleDragMove as EventListener);
                    document.removeEventListener('touchend', handleDragEnd as EventListener);
                  };

                  document.addEventListener('mousemove', handleDragMove as EventListener, { passive: false } as AddEventListenerOptions);
                  document.addEventListener('mouseup', handleDragEnd as EventListener, { passive: false } as AddEventListenerOptions);
                  document.addEventListener('touchmove', handleDragMove as EventListener, { passive: false } as AddEventListenerOptions);
                  document.addEventListener('touchend', handleDragEnd as EventListener, { passive: false } as AddEventListenerOptions);
                };

                if (isCoarse) {
                  beginOrbit();
                } else {
                  // Desktop hold-to-orbit
                  const HOLD_MS = 220;
                  holdTimer = window.setTimeout(() => {
                    beginOrbit();
                    if (holdTimer) window.clearTimeout(holdTimer);
                  }, HOLD_MS) as unknown as number;

                  // If released before hold, treat as selection click (nearest tile)
                  const handleMouseUpQuick = (upE: MouseEvent) => {
                    if (!holdSatisfied) {
                      if (holdTimer) window.clearTimeout(holdTimer);
                      document.removeEventListener('mouseup', handleMouseUpQuick);
                      const upRect = container.getBoundingClientRect();
                      const upX = upE.clientX - upRect.left;
                      const upY = upE.clientY - upRect.top;
                      const centers2 = mapCenters(container as HTMLElement);
                      let bestId: string | null = null;
                      let bestDist = Infinity;
                      grid.forEach(cell => {
                        const ctr = centers2.get(`${cell.position.row},${cell.position.col}`);
                        if (!ctr) return;
                        const d = Math.hypot(ctr.x - upX, ctr.y - upY);
                        if (d < bestDist) { bestDist = d; bestId = cell.id; }
                      });
                      if (bestId) {
                        selectTile(bestId);
                      }
                    }
                  };
                  document.addEventListener('mouseup', handleMouseUpQuick, { passive: true, once: true } as AddEventListenerOptions);
                }
              };
              
              return (
                <>
                  {/* Ring interaction: allow drag start anywhere over the ring area */}
                  {(freeOrbitsAvailable || 0) > 0 && (
                    <div
                      onMouseDown={handleDragStart}
                      onTouchStart={handleDragStart}
                      className="absolute"
                      style={{
                        left: orbitAnchor.x,
                        top: orbitAnchor.y,
                        transform: 'translate(-50%, -50%)',
                        width: `${cellSize.w * 2.2}px`,
                        height: `${cellSize.w * 2.2}px`,
                        borderRadius: '50%',
                        zIndex: 61,
                        // Invisible interaction layer
                        background: 'transparent',
                      }}
                      title="Drag a ring tile to keep it in place and rotate the others"
                    />
                  )}

                  {isDragging && (() => {
                    // Compute adjacent tiles from orbit plan
                    const plan = orbitPlanRef.current;
                    if (!plan) return null;

                    const adjacentTiles = plan.orderedNeighbors
                      .map(cell => {
                        const center = centers.get(`${cell.position.row},${cell.position.col}`);
                        return center ? { cell, center } : null;
                      })
                      .filter(item => item !== null) as Array<{ cell: HexCell; center: { x: number; y: number } }>;

                    return (
                    <>
                      {adjacentTiles.map(({ cell, center }) => {
                        // Drive overlay from locked steps using canonical slots
                        const plan = orbitPlanRef.current;
                        let drawX = center.x - cellSize.w / 2;
                        let drawY = center.y - cellSize.h / 2;
                        
                        // Anchored tile stays; others preview rotation
                        const isAnchored = anchorNeighborIdRef.current === cell.id;
                        
                        // Detect if tile is in original position
                        let isInOriginalPosition = false;
                        const originalX = center.x - cellSize.w / 2;
                        const originalY = center.y - cellSize.h / 2;
                        
                        // Only move non-anchored tiles during preview
                        if (plan && !isAnchored) {
                          const presentIdx = plan.neighborIdToPresentIndex.get(cell.id);
                          if (presentIdx !== undefined && plan.orderedNeighbors.length > 0) {
                            // Calculate position among ONLY unlocked tiles
                            const rotatableNeighbors = plan.orderedNeighbors.filter(n => anchorNeighborIdRef.current !== n.id);
                            const unlockedPresentIdx = rotatableNeighbors.findIndex(n => n.id === cell.id);
                            
                            if (unlockedPresentIdx !== -1) {
                              const unlockedCount = rotatableNeighbors.length;
                              const targetUnlockedIdx = ((unlockedPresentIdx + lockedStepsRef.current) % unlockedCount + unlockedCount) % unlockedCount;
                              const targetCell = rotatableNeighbors[targetUnlockedIdx];
                              const targetCtr = centers.get(`${targetCell.position.row},${targetCell.position.col}`);
                              if (targetCtr) {
                                drawX = targetCtr.x - cellSize.w / 2;
                                drawY = targetCtr.y - cellSize.h / 2;
                                
                                // Check if target position is same as original position
                                isInOriginalPosition = (Math.abs(drawX - originalX) < 1 && Math.abs(drawY - originalY) < 1);
                              }
                            }
                          }
                        } else {
                          // Anchored tile is always in original position
                          isInOriginalPosition = true;
                        }

                        // Border stroke disabled - no borders on orbiting tiles
                        // const borderColor = 'transparent'; // No border stroke - unused

                        // Snappy spring
                        return (
                          <motion.div
                            key={`preview-${cell.id}`}
                            className="absolute pointer-events-none"
                            initial={{ x: drawX, y: drawY, scale: 1, opacity: 1 }}
                            animate={{ x: drawX, y: drawY, scale: isAnchored ? 1.0 : 1.02, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 950, damping: 50, mass: 1.5 }}
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              width: `${cellSize.w}px`,
                              height: `${cellSize.h}px`,
                              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                              background: isAnchored 
                                ? 'rgba(59,130,246,0.28)' // Blue for anchored tile
                                : isOverCancel || isInOriginalPosition ? 'rgba(156, 163, 175, 0.28)' : 'rgba(34, 197, 94, 0.32)', // Grey for original position
                              zIndex: 59,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1rem',
                              fontWeight: 'bold',
                              color: isAnchored ? 'rgba(59,130,246,0.95)' : (isOverCancel || isInOriginalPosition ? 'rgba(156, 163, 175, 0.9)' : 'rgba(34, 197, 94, 0.92)'),
                              boxShadow: isOverCancel || isInOriginalPosition ? '0 0 10px rgba(156, 163, 175, 0.25)' : '0 0 10px rgba(34, 197, 94, 0.3)' // Grey shadow for original position
                            }}
                          >
                            {/* SVG hexagonal border overlay - DISABLED */}
                            {cell.letter}
                          </motion.div>
                        );
                      })}

                    </>
                  );
                  })()}
                </>
              );
            })()}


            {/* Grid and UI Buttons container */}
            <div 
              className={cn(
                "grid-container relative",
                phase === 'flood' ? 'flood-phase' : '',
                isGridRepositioning ? 'grid-container-transitioning' : 'transition-[left,top,transform] duration-300 ease-in-out',
                gridAnimationPhase === 'horizontal' && 'grid-horizontal-phase',
                gridAnimationPhase === 'vertical' && 'grid-vertical-phase', 
                gridAnimationPhase === 'synchronized' && 'grid-synchronized-phase',
                gridAnimationPhase === 'vertical-first' && 'grid-vertical-first-phase',
                gridAnimationPhase === 'horizontal-second' && 'grid-horizontal-second-phase'
              )}
              style={{ 
                position: 'absolute',
                // On mobile, account for mobile controls height (68px) + header (68px) = 136px total offset  
                top: !isDesktop ? 'calc(50% + 34px)' : '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2rem',
              }}
            >
              <HexGrid
                cells={grid.map(c => {
                  const isSelected = selectedTiles.some(t => t.cellId === c.id);
                  // Check if this cell is part of the current auto-clear word and should be highlighted
                  let isAutoClear = false;
                  if (phase === 'autoClearing' && currentAutoClearWord && autoClearLetterIndex !== undefined) {
                    // Only highlight cells up to the current letter index
                    const cellIndex = currentAutoClearWord.cellIds.indexOf(c.id);
                    isAutoClear = cellIndex >= 0 && cellIndex <= autoClearLetterIndex;
                  }
                  return { ...c, isSelected, isAutoClear };
                })}
                onCellClick={handleCellClick}
                isWordValid={validationState}
                isPlacementPhase={phase === 'player' ? !hasSelection : true}
                isWordAlreadyScored={false}
                placedTilesThisTurn={[]}
                gridSize={gridSize}
                isTetrisVariant={true}
                enableLayout={!isTransitioning}
                isSettling={isSettling}
                hiddenLetterCellIds={[
                  ...hiddenCellIds,
                  ...(isDragging && selectedSingle ? 
                    grid.filter(c => c.id !== selectedSingle.cellId && areCellsAdjacent(c, grid.find(g => g.id === selectedSingle.cellId)!) && c.letter && c.isPlaced)
                      .map(c => c.id) : []
                  )
                ]}
              />
              
              {/* Unified Game Controls */}
              <GameControls
                currentWord={currentWord}
                phase={phase}
                validationState={validationState}
                onSubmitWord={() => submitWord()}
                onEndTurn={() => endPlayerPhase()}
                onUndo={() => undoLastAction()}
                onRestart={!isDailyChallenge ? handleRestart : undefined}
                canUndo={canUndo()}
                isDailyChallenge={isDailyChallenge}
              />
            </div>

            </div>

          {/* Toasts temporarily disabled */}
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