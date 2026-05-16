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
import { runGravityDrop } from '../lib/gravityPhysics';
import { countAdjacentEdges } from '../lib/waxleGameUtils';
import { haptics } from '../lib/haptics';
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

type FxOverlay = { key: string; letter: string; x: number; y: number; kind?: 'gravity' | 'orbit' | 'move' | 'flood'; duration?: number };

// (no-op placeholder removed)

const WaxleGame = ({ onBackToDailyChallenge }: { onBackToDailyChallenge?: () => void; }) => {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [previousGrid, setPreviousGrid] = useState<typeof grid>([]);
  const lastPlayerGridRef = useRef<typeof previousGrid>([]);
  const [fxOverlays, setFxOverlays] = useState<FxOverlay[]>([]);
  const timersRef = useRef<number[]>([]);
  const uiTimersRef = useRef<number[]>([]);
  const rafIdsRef = useRef<number[]>([]);
  const gravityCancelRef = useRef<(() => void) | null>(null);
  const transitionTokenRef = useRef(0);
  const desiredIsDesktopRef = useRef<boolean | null>(null);
  const [hiddenCellIds, setHiddenCellIds] = useState<string[]>([]);
  const [cellSize, setCellSize] = useState<{ w: number; h: number }>({ w: 64, h: 56 });
  const [swapFirstTile, setSwapFirstTile] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showDesktopSidebar, setShowDesktopSidebar] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [isGridRepositioning, setIsGridRepositioning] = useState(false);
  const [gridAnimationPhase, setGridAnimationPhase] = useState<'horizontal' | 'vertical' | 'none' | 'synchronized' | 'vertical-first' | 'horizontal-second'>('none');
  const operationInProgressRef = useRef<boolean>(false);
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
    freeSwapsAvailable,
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
    swapTiles,
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
      setFxOverlays([]);
      setSwapFirstTile(null);
    }
  }, [phase, grid]);

  // Handle auto-clear letter-by-letter highlighting
  useEffect(() => {
    if (phase === 'autoClearing' && autoClearPhase === 'clear' && currentAutoClearWord && autoClearLetterIndex !== undefined) {
      // ==================== AUTO-CLEAR ANIMATION TIMING (Tunable) ====================
      // How fast each letter lights up sequentially (lower = faster)
      const LETTER_HIGHLIGHT_DELAY = 150; // ms per letter (default: 150)

      // How long to pause after ALL letters are lit before clearing them (higher = longer linger)
      const LINGER_AFTER_COMPLETE = 600; // ms (default: 600)
      // ===============================================================================

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
        // All letters highlighted, linger then clear
        const timer = window.setTimeout(() => {
          processNextAutoClearWord();
        }, LINGER_AFTER_COMPLETE);

        return () => clearTimeout(timer);
      }
    }
  }, [phase, autoClearPhase, currentAutoClearWord, autoClearLetterIndex, processNextAutoClearWord]);

  // Use layout effect to hide tiles synchronously before painting
  useLayoutEffect(() => {
    if (phase === 'flood') {
      const newlyPlaced = grid.filter(cell => (cell as HexCell & { placedThisTurn?: boolean }).placedThisTurn);
      if (newlyPlaced.length > 0) {
        setHiddenCellIds(prev => [...new Set([...prev, ...newlyPlaced.map(c => c.id)])]);
      }
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
    timersRef.current.forEach(t => window.clearTimeout(t));
    timersRef.current = [];
    // Clear any stale fx overlays before scheduling new ones to avoid duplicate keys
    setFxOverlays([]);

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
                        findAndStartNextAutoClear();
                    } else if (gravitySource === 'wordSubmit') {
                        // Player word submit: trigger flood
                        endRound();
                    } else if (gravitySource === 'swap') {
                        // Swap gravity: return to player phase
                        startPlayerPhase();
                    }
                }, GRAVITY_SHORT_DELAY_MS);
                timersRef.current.push(advanceT);
            };
        } else {
            // Collect every tile that needs to drop, with its source and
            // destination pixel centres. A physics simulation handles the rest.
            const fallingTiles: Array<{ id: string; cellId: string; letter: string; from: { x: number; y: number }; to: { x: number; y: number } }> = [];
            const dropStamp = Date.now();

            newlySettled.forEach((cell) => {
                const sourceId = gravityMoves.get(cell.id);
                const sourceCell = previousGrid.find(c => c.id === sourceId);
                if (!sourceCell) return;

                const from = centers.get(`${sourceCell.position.row},${sourceCell.position.col}`);
                const to = centers.get(`${cell.position.row},${cell.position.col}`);
                if (!from || !to) return;

                fallingTiles.push({
                    id: `gset-${cell.id}-${dropStamp}`,
                    cellId: cell.id,
                    letter: cell.letter,
                    from,
                    to,
                });
            });

            const advanceAfterGravity = () => {
                // Check gravity source to determine next action
                if (gravitySource === 'autoClear') {
                    findAndStartNextAutoClear();
                } else if (gravitySource === 'wordSubmit') {
                    endRound();
                } else if (gravitySource === 'swap') {
                    startPlayerPhase();
                }
            };

            if (fallingTiles.length === 0) {
                animationDoneSignal = () => {
                    const advanceT = window.setTimeout(advanceAfterGravity, GRAVITY_SHORT_DELAY_MS);
                    timersRef.current.push(advanceT);
                };
            } else {
                // Render the floating tiles at their source slots; the physics
                // loop then drives their positions imperatively.
                setFxOverlays(fallingTiles.map(t => ({
                    key: t.id,
                    letter: t.letter,
                    x: t.from.x,
                    y: t.from.y,
                    kind: 'gravity' as const,
                })));

                const cellIdByTile = new Map(fallingTiles.map(t => [t.id, t.cellId]));

                // Start the simulation on the next frame, once the floating
                // tiles have been painted and can be moved.
                const startRaf = requestAnimationFrame(() => {
                    gravityCancelRef.current = runGravityDrop({
                        tiles: fallingTiles.map(t => ({ id: t.id, from: t.from, to: t.to })),
                        cellSize,
                        getElement: (id) => document.querySelector<HTMLElement>(`[data-fx-id="${CSS.escape(id)}"]`),
                        onTileSettled: (id) => {
                            const cellId = cellIdByTile.get(id);
                            setFxOverlays(prev => prev.filter(o => o.key !== id));
                            if (cellId) setHiddenCellIds(prev => prev.filter(c => c !== cellId));
                        },
                        onComplete: () => {
                            gravityCancelRef.current = null;
                            const advanceT = window.setTimeout(advanceAfterGravity, GRAVITY_SHORT_DELAY_MS);
                            timersRef.current.push(advanceT);
                        },
                    });
                });
                rafIdsRef.current.push(startRaf);
            }
        }
    } else if (phase === 'flood') {
        const newlyFilled = grid
          .filter(cell => (cell as HexCell & { placedThisTurn?: boolean }).placedThisTurn)
          .sort((a, b) => (a.position.row - b.position.row) || (a.position.col - b.position.col));

        if (prefersReducedMotion) {
          // Reveal immediately and skip path animation
          setHiddenCellIds(prev => prev.filter(id => !newlyFilled.some(c => c.id === id)));
          animationDoneSignal = () => {
            const advanceT = window.setTimeout(() => {
              // After flood, check if we should scan for auto-clear words
              if (justScoredWord) {
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
              return null;
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

              const ovKey = `flood-${cell.id}-${Date.now()}`;

              // Create FxOverlay at start position
              const createOv = () => setFxOverlays(prev => [...prev, {
                key: ovKey,
                letter: cell.letter,
                x: initial.x,
                y: initial.y,
                kind: 'flood'
                // No duration - flood uses fixed FLOOD_STEP_MS per step
              }]);

              if (fadeDelay === 0) {
                createOv();
              } else {
                const ovT = window.setTimeout(createOv, fadeDelay);
                timersRef.current.push(ovT);
              }

              // Animate through each step in the path
              pathCenters.forEach((pc: any, stepIndex: number) => {
                const stepDelay = baseDelay + stepIndex * perStep;
                const arriveT = window.setTimeout(() => {
                  setFxOverlays(prev => prev.map(o =>
                    o.key === ovKey ? { ...o, x: pc.center.x, y: pc.center.y } : o
                  ));
                }, stepDelay);
                timersRef.current.push(arriveT);
              });

              // Calculate when animation completes
              const finalStepDelay = baseDelay + (pathCenters.length - 1) * perStep;
              const finalDelay = finalStepDelay + stepMs; // Add movement time
              if(finalDelay > maxFinalDelay) maxFinalDelay = finalDelay;

              // Clean up overlay and reveal tile
              const cleanupDelay = finalDelay + 50;
              const doneT = window.setTimeout(() => {
                setFxOverlays(prev => prev.filter(o => o.key !== ovKey));
                setHiddenCellIds(prev => prev.filter(id => id !== cell.id));
              }, cleanupDelay);
              timersRef.current.push(doneT);
            });

            cumulativeStart += (perBatchMaxDelay.get(batchIdx) ?? 0) + PHASE_GAP_MS; // move to next batch start time
          });

          animationDoneSignal = () => {
            const advanceDelay = tilePaths.length === 0 ? GRAVITY_SHORT_DELAY_MS + 20 : maxFinalDelay + PHASE_GAP_MS;
            const advanceT = window.setTimeout(() => {
              // After flood, check if we should scan for auto-clear words
              if (justScoredWord) {
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
      rafIdsRef.current.forEach(id => cancelAnimationFrame(id));
      rafIdsRef.current = [];
      if (gravityCancelRef.current) {
        gravityCancelRef.current();
        gravityCancelRef.current = null;
      }
    };
  }, [phase, grid, previousGrid, cellSize.w, cellSize.h, startPlayerPhase, gravityMoves, floodPaths, endRound, prefersReducedMotion]);

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

  // Handle cell clicks: word selection or swap mode
  const handleCellClick = useCallback((cell: HexCell) => {
    if (phase !== 'player') return;

    // Check if we're in swap mode (first tile already selected)
    if (swapFirstTile) {
      // Second tile click - perform swap or cancel
      if (swapFirstTile === cell.id) {
        // Clicked same tile - cancel swap mode
        setSwapFirstTile(null);
        haptics.select();
        return;
      }

      // Both tiles must have letters to swap
      const firstTile = grid.find(c => c.id === swapFirstTile);
      if (!firstTile?.letter || !cell.letter || !cell.isPlaced) {
        setSwapFirstTile(null);
        haptics.error();
        return;
      }

      // Perform the swap
      const { pushToHistory, updateCurrentGameState } = useWaxleGameStore.getState();
      pushToHistory('swap');

      swapTiles(swapFirstTile, cell.id);

      // Deduct one swap
      const newSwapsAvailable = Math.max(0, (freeSwapsAvailable || 0) - 1);
      updateCurrentGameState({
        freeSwapsAvailable: newSwapsAvailable,
        selectedTiles: [],
        currentWord: ''
      });

      setSwapFirstTile(null);
      haptics.success();
      return;
    }

    // Check if we should enter swap mode:
    // - Have available swaps
    // - Clicked a placed tile with a letter
    // - No current word selection
    if ((freeSwapsAvailable || 0) > 0 && cell.letter && cell.isPlaced && selectedTiles.length === 0) {
      // Enter swap mode - store first tile
      setSwapFirstTile(cell.id);
      haptics.select();
      return;
    }

    // Normal word selection mode
    haptics.select();
    selectTile(cell.id);
  }, [phase, swapFirstTile, freeSwapsAvailable, grid, swapTiles, selectTile, selectedTiles]);

  // Animated move: slide letter from source to target, hide letters during animation, then commit move
  

  const [isSettling, setIsSettling] = useState(false);

  const handleRestart = () => {
    // Prevent restart during daily challenges
    if (isDailyChallenge) {
      return;
    }

    // Stop any ongoing animations
    timersRef.current.forEach(t => window.clearTimeout(t));
    timersRef.current = [];
    setFxOverlays([]);
    setHiddenCellIds([]);
    setPreviousGrid([]);
    operationInProgressRef.current = false;
    resetGame();
    initializeGame();
    setIsSettling(true);
    window.setTimeout(() => setIsSettling(false), 700);
  };

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
                freeSwapsAvailable={freeSwapsAvailable || 0}
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
                      swapsAvailable={freeSwapsAvailable || 0}
                      maxSwaps={2}
                      size={20}
                      className="flex-shrink-0"
                      animationDelay={400}
                    />
                    <span>{freeSwapsAvailable || 0}</span>
                  </div>
                  <div className="text-xs text-text-secondary font-medium uppercase tracking-wide mt-1">
                    {(freeSwapsAvailable || 0) === 1 ? 'Swap' : 'Swaps'}
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
            {/* FX overlays (gravity/flood/orbit/move) */}
            <div className="pointer-events-none absolute inset-0 z-50">
              {/* Gravity tiles: positions driven imperatively by the physics engine */}
              {fxOverlays.filter(fx => fx.kind === 'gravity').map(fx => (
                <div
                  key={fx.key}
                  data-fx-id={fx.key}
                  className="absolute flex items-center justify-center"
                  style={{
                    left: 0,
                    top: 0,
                    width: `${cellSize.w}px`,
                    height: `${cellSize.h}px`,
                    transform: `translate(${fx.x - cellSize.w / 2}px, ${fx.y - cellSize.h / 2}px)`,
                    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                    background: 'rgba(229,231,235,0.96)',
                    borderRadius: 8,
                    boxShadow: '0 6px 14px rgba(0,0,0,0.12)',
                    willChange: 'transform',
                  }}
                >
                  <span className="letter-tile" style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1f2937' }}>{fx.letter}</span>
                </div>
              ))}

              {/* Flood / move FX: framer-motion keyframe animation */}
              <AnimatePresence>
                {fxOverlays.filter(fx => fx.kind !== 'gravity').map(fx => (
                  <motion.div
                    key={fx.key}
                    initial={{ x: fx.x - cellSize.w / 2, y: fx.y - cellSize.h / 2, opacity: 1, scale: 1, rotateZ: 0 }}
                    animate={fx.kind === 'flood' ? {
                      x: fx.x - cellSize.w / 2,
                      y: fx.y - cellSize.h / 2,
                      opacity: 1,
                      // ==================== FLOOD FEEL (Tunable) ====================
                      // Lighter bounce for short step-by-step movement
                      scale: [1, 1, 1.08, 0.96, 1],
                      // Subtle wobble
                      rotateZ: [0, 0, 1.5, -0.5, 0]
                      // ================================================================
                    } : {
                      x: fx.x - cellSize.w / 2,
                      y: fx.y - cellSize.h / 2,
                      opacity: 1,
                      // Deep magnetic slingshot: dramatic burst, bounce, damped wobble
                      scale: [1, 1.5, 0.6, 1.3, 0.5, 1],
                      rotateZ: [0, 6, -8, 4, -2, 0]
                    }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={fx.kind === 'flood' ? {
                      // ==================== FLOOD TIMING (Tunable) ====================
                      // Fixed duration per step (from FLOOD_STEP_MS constant)
                      duration: FLOOD_STEP_MS / 1000,
                      times: [0, 0.5, 0.75, 0.9, 1],
                      ease: [0.5, 2, 0.5, 1]
                      // ===================================================================
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

            {/* Swap mode: highlight first selected tile */}
            {phase === 'player' && swapFirstTile && (() => {
              const container = containerRef.current;
              if (!container) return null;

              const centers = mapCenters(container as HTMLElement);
              const firstCell = grid.find(c => c.id === swapFirstTile);
              if (!firstCell) return null;

              const firstCenter = centers.get(`${firstCell.position.row},${firstCell.position.col}`);
              if (!firstCenter) return null;

              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute pointer-events-none z-[60]"
                  style={{
                    left: firstCenter.x,
                    top: firstCenter.y,
                    transform: 'translate(-50%, -50%)',
                    width: `${cellSize.w + 8}px`,
                    height: `${cellSize.h + 8}px`,
                    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                    border: '3px solid rgb(34, 197, 94)',
                    boxShadow: '0 0 20px rgba(34, 197, 94, 0.5)',
                  }}
                />
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
                hiddenLetterCellIds={hiddenCellIds}
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