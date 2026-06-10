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
const debounce = <T extends (...args: never[]) => void>(func: T, wait: number): T => {
  let timeout: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
};
import HexGrid, { HexCell } from '../components/HexGrid';
import { buildFallFrames, FallFrames, FallSpec, FALL_STAGGER_MS } from '../lib/fallAnimation';
import { countAdjacentEdges } from '../lib/waxleGameUtils';
import { haptics } from '../lib/haptics';
import WaxleGameOverModal from '../components/WaxleGameOverModal';
import WaxleMobileGameControls from '../components/WaxleMobileGameControls';
import GameControls from '../components/GameControls';

const CENTER_NUDGE_Y = 0; // pixels to nudge overlay vertically for visual centering (set to 0 for exact alignment)
// Tile-fall timing (flood and resolve share the same fall system)
const GRAVITY_SHORT_DELAY_MS = 100;
const PHASE_GAP_MS = 160;
const RESOLVE_STAGGER_MS = 30; // tighter stagger for settling tiles

// Round thresholds (for future difficulty scaling)
// const ROUND_TILE_THRESHOLDS = { FOUR: 5, FIVE: 8, SIX: 11 } as const;

type FloodPathEntry = { path: string[]; batch: number };
type FloodPathsMap = Record<string, FloodPathEntry>;

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

type FxOverlay = { key: string; letter: string; x: number; y: number; kind: 'fall'; fall: FallFrames };

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
  const transitionTokenRef = useRef(0);
  const desiredIsDesktopRef = useRef<boolean | null>(null);
  const [hiddenCellIds, setHiddenCellIds] = useState<string[]>([]);
  const [cellSize, setCellSize] = useState<{ w: number; h: number }>({ w: 64, h: 56 });
  const [swapFirstTile, setSwapFirstTile] = useState<string | null>(null);
  const [swapModeActive, setSwapModeActive] = useState(false);
  const [swappingCells, setSwappingCells] = useState<string[]>([]);
  const [landedCellIds, setLandedCellIds] = useState<string[]>([]);
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
      setHiddenCellIds([]);
      setSwapFirstTile(null);
      setSwapModeActive(false);
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

    // Land a finished fall: drop its overlay, reveal the real tile, squash it
    const scheduleFalls = (frames: FallFrames[]) => {
        if (frames.length === 0) return;
        setFxOverlays(frames.map(f => ({
            key: f.key,
            letter: f.letter,
            x: f.xs[0],
            y: f.ys[0],
            kind: 'fall' as const,
            fall: f,
        })));
        frames.forEach(f => {
            const landT = window.setTimeout(() => {
                setFxOverlays(prev => prev.filter(o => o.key !== f.key));
                setHiddenCellIds(prev => prev.filter(id => id !== f.cellId));
                setLandedCellIds(prev => (prev.includes(f.cellId) ? prev : [...prev, f.cellId]));
                const offT = window.setTimeout(() => {
                    setLandedCellIds(prev => prev.filter(id => id !== f.cellId));
                }, 450);
                uiTimersRef.current.push(offT);
            }, f.delay + f.duration);
            timersRef.current.push(landT);
        });
    };

    const centerOf = (cellId: string) => {
        const c = grid.find(g => g.id === cellId);
        if (!c) return null;
        const p = centers.get(`${c.position.row},${c.position.col}`);
        return p ? { x: p.x, y: p.y } : null;
    };

    if (phase === 'gravitySettle' && gravityMoves && gravityMoves.size > 0) {
        const newlySettled = grid.filter(cell => cell.placedThisTurn);
        setHiddenCellIds(newlySettled.map(c => c.id));

        const advanceAfterGravity = () => {
            if (gravitySource === 'autoClear') {
                findAndStartNextAutoClear();
            } else if (gravitySource === 'wordSubmit') {
                endRound();
            } else if (gravitySource === 'swap') {
                startPlayerPhase();
            }
        };

        const specs: FallSpec[] = prefersReducedMotion ? [] : newlySettled.map(cell => {
            // Reconstruct the full fall by walking the move chain backwards
            // (gravityMoves maps each landing cell to its immediate source)
            const chain = [cell.id];
            const seen = new Set(chain);
            let cur = cell.id;
            while (gravityMoves.has(cur)) {
                const src = gravityMoves.get(cur)!;
                if (seen.has(src)) break;
                seen.add(src);
                chain.unshift(src);
                cur = src;
            }
            const points = chain
                .map(centerOf)
                .filter((pt): pt is { x: number; y: number } => !!pt);
            return { key: `fall-${cell.id}-${Date.now()}`, cellId: cell.id, letter: cell.letter, points };
        }).filter(spec => spec.points.length >= 2);

        if (specs.length === 0) {
            // Nothing to animate (or reduced motion): reveal and advance
            setHiddenCellIds([]);
            animationDoneSignal = () => {
                const advanceT = window.setTimeout(advanceAfterGravity, GRAVITY_SHORT_DELAY_MS);
                timersRef.current.push(advanceT);
            };
        } else {
            // Left-to-right cascade for readability
            specs.sort((a, b) => a.points[a.points.length - 1].x - b.points[b.points.length - 1].x);
            const { frames, totalMs } = buildFallFrames(specs, cellSize.h, RESOLVE_STAGGER_MS);
            scheduleFalls(frames);
            animationDoneSignal = () => {
                const advanceT = window.setTimeout(advanceAfterGravity, totalMs + GRAVITY_SHORT_DELAY_MS);
                timersRef.current.push(advanceT);
            };
        }
    } else if (phase === 'flood') {
        const newlyFilled = grid.filter(cell => (cell as HexCell & { placedThisTurn?: boolean }).placedThisTurn);

        const advanceAfterFlood = () => {
            if (justScoredWord) {
                findAndStartNextAutoClear();
            } else {
                startPlayerPhase();
            }
        };

        if (prefersReducedMotion || newlyFilled.length === 0) {
            setHiddenCellIds(prev => prev.filter(id => !newlyFilled.some(c => c.id === id)));
            animationDoneSignal = () => {
                const advanceT = window.setTimeout(advanceAfterFlood, GRAVITY_SHORT_DELAY_MS + 20);
                timersRef.current.push(advanceT);
            };
        } else {
            const floodPathsTyped = (floodPaths || {}) as FloodPathsMap;
            type FloodSpec = FallSpec & { batch: number };
            const specs: FloodSpec[] = newlyFilled.flatMap(cell => {
                const entry = floodPathsTyped[cell.id];
                const pathIds = entry && Array.isArray(entry.path) && entry.path.length > 0
                    ? entry.path
                    : [cell.id];
                const points = pathIds
                    .map(centerOf)
                    .filter((pt): pt is { x: number; y: number } => !!pt);
                if (points.length === 0) return [];
                // Spawn just above the entry slot so tiles fade in mid-fall
                points.unshift({ x: points[0].x, y: points[0].y - cellSize.h * 0.9 });
                return [{
                    key: `fall-${cell.id}-${Date.now()}`,
                    cellId: cell.id,
                    letter: cell.letter,
                    points,
                    spawn: true,
                    batch: entry?.batch ?? 0,
                }];
            });

            // Earlier batches first, then left-to-right within a batch
            specs.sort((a, b) => (a.batch - b.batch) || (a.points[0].x - b.points[0].x));

            // Reveal any tiles that couldn't be animated
            const animatedIds = new Set(specs.map(spec => spec.cellId));
            const unanimated = newlyFilled.filter(c => !animatedIds.has(c.id)).map(c => c.id);
            if (unanimated.length > 0) {
                setHiddenCellIds(prev => prev.filter(id => !unanimated.includes(id)));
            }

            const { frames, totalMs } = buildFallFrames(specs, cellSize.h, FALL_STAGGER_MS);
            scheduleFalls(frames);
            animationDoneSignal = () => {
                const advanceT = window.setTimeout(advanceAfterFlood, totalMs + PHASE_GAP_MS);
                timersRef.current.push(advanceT);
            };
        }
    }
    animationDoneSignal();

    return () => {
      timersRef.current.forEach(t => window.clearTimeout(t));
      timersRef.current = [];
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

  // Handle cell clicks: word selection by default; swaps only when swap mode
  // has been explicitly armed via the Swap button
  const handleCellClick = useCallback((cell: HexCell) => {
    if (phase !== 'player') return;

    if (swapModeActive) {
      // Swap mode only operates on placed tiles with letters
      if (!cell.letter || !cell.isPlaced) {
        haptics.error();
        return;
      }

      if (!swapFirstTile) {
        // First tile of the pair
        setSwapFirstTile(cell.id);
        haptics.select();
        return;
      }

      if (swapFirstTile === cell.id) {
        // Clicked same tile - deselect it but stay in swap mode
        setSwapFirstTile(null);
        haptics.select();
        return;
      }

      const firstTile = grid.find(c => c.id === swapFirstTile);
      if (!firstTile?.letter) {
        // First tile vanished (e.g. gravity); restart the pair from this tile
        setSwapFirstTile(cell.id);
        haptics.select();
        return;
      }

      // Perform the swap: play the exchange animation and commit the letter
      // swap at its midpoint, when both tiles are squashed down
      const firstId = swapFirstTile;
      const secondId = cell.id;
      setSwapFirstTile(null);
      setSwapModeActive(false);
      setSwappingCells([firstId, secondId]);

      const commitDelay = prefersReducedMotion ? 0 : 175;
      const commitT = window.setTimeout(() => {
        const { pushToHistory, updateCurrentGameState } = useWaxleGameStore.getState();
        pushToHistory('swap');

        swapTiles(firstId, secondId);

        // Deduct one swap
        const newSwapsAvailable = Math.max(0, (freeSwapsAvailable || 0) - 1);
        updateCurrentGameState({
          freeSwapsAvailable: newSwapsAvailable,
          selectedTiles: [],
          currentWord: ''
        });
        haptics.success();
      }, commitDelay);
      const clearT = window.setTimeout(() => setSwappingCells([]), 400);
      uiTimersRef.current.push(commitT, clearT);
      return;
    }

    // Normal word selection mode
    haptics.select();
    selectTile(cell.id);
  }, [phase, swapModeActive, swapFirstTile, freeSwapsAvailable, grid, swapTiles, selectTile, prefersReducedMotion]);

  // Arm/disarm swap mode from the Swap button
  const toggleSwapMode = useCallback(() => {
    if (phase !== 'player') return;
    if (!swapModeActive && (freeSwapsAvailable || 0) <= 0) return;

    setSwapFirstTile(null);
    if (!swapModeActive) {
      // Entering swap mode clears any in-progress word selection
      useWaxleGameStore.getState().clearSelection();
    }
    setSwapModeActive(prev => !prev);
    haptics.select();
  }, [phase, swapModeActive, freeSwapsAvailable]);

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
                      maxSwaps={3}
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
                    <motion.div
                      key={nextRows[0]?.join('')}
                      initial={prefersReducedMotion ? false : 'hidden'}
                      animate="show"
                      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
                      className="flex items-center justify-center gap-1"
                    >
                      {nextRows[0]?.map((letter, idx) => (
                        <motion.div
                          key={idx}
                          variants={{
                            hidden: { opacity: 0, y: -6, scale: 0.8 },
                            show: { opacity: 1, y: 0, scale: 1 }
                          }}
                          className={cn(
                            "w-7 h-7 bg-bg-secondary border border-secondary/30",
                            "rounded-lg flex items-center justify-center",
                            "text-xs font-semibold text-text-primary"
                          )}
                        >
                          {letter}
                        </motion.div>
                      ))}
                    </motion.div>
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
                  "text-lg font-mono font-bold text-center rounded-xl p-3 transition-colors duration-200",
                  validationState === false
                    ? "text-red-500 bg-red-500/10 border border-red-500/30"
                    : "text-amber bg-amber/10 border border-amber/30"
                )}>
                  {currentWord}
                  {currentWord.length >= 3 && validationState === true && (
                    <span className="text-amber-dark ml-2">
                      (+{currentWordScore})
                    </span>
                  )}
                  {validationState === false && (
                    <span className="text-red-400 ml-2 text-sm align-middle">
                      not a word
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
            {/* FX overlays: unified tile-fall animation (flood + resolve) */}
            <div className="pointer-events-none absolute inset-0 z-50">
              {fxOverlays.map(fx => {
                const f = fx.fall;
                return (
                  <motion.div
                    key={fx.key}
                    initial={{
                      x: f.xs[0] - cellSize.w / 2,
                      y: f.ys[0] - cellSize.h / 2,
                      opacity: f.spawn ? 0 : 1,
                      scale: f.spawn ? 0.75 : 1,
                    }}
                    animate={{
                      x: f.xs.map(v => v - cellSize.w / 2),
                      y: f.ys.map(v => v - cellSize.h / 2),
                      opacity: 1,
                      scale: 1,
                    }}
                    transition={{
                      x: { delay: f.delay / 1000, duration: f.duration / 1000, times: f.times, ease: 'linear' },
                      y: { delay: f.delay / 1000, duration: f.duration / 1000, times: f.times, ease: 'linear' },
                      opacity: { delay: f.delay / 1000, duration: 0.1, ease: 'linear' },
                      scale: { delay: f.delay / 1000, duration: 0.16, ease: 'easeOut' },
                    }}
                    className="absolute flex items-center justify-center"
                    style={{
                      left: 0,
                      top: 0,
                      width: `${cellSize.w}px`,
                      height: `${cellSize.h}px`,
                      clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                      background: 'rgba(229,231,235,0.96)',
                      borderRadius: 8,
                      boxShadow: '0 6px 14px rgba(0,0,0,0.12)',
                      willChange: 'transform',
                    }}
                  >
                    <span className="letter-tile" style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1f2937' }}>{fx.letter}</span>
                  </motion.div>
                );
              })}
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
                <motion.svg
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: prefersReducedMotion ? 1 : [1, 1.06, 1] }}
                  transition={{ scale: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } }}
                  className="absolute pointer-events-none z-[60]"
                  style={{
                    left: firstCenter.x,
                    top: firstCenter.y,
                    translateX: '-50%',
                    translateY: '-50%',
                    width: `${cellSize.w + 10}px`,
                    height: `${cellSize.h + 10}px`,
                    filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.7))',
                    overflow: 'visible',
                  }}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <polygon
                    points="50,1 99,25.5 99,74.5 50,99 1,74.5 1,25.5"
                    fill="rgba(34, 197, 94, 0.12)"
                    stroke="rgb(34, 197, 94)"
                    strokeWidth={3}
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                  />
                </motion.svg>
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
                swappingCellIds={swappingCells}
                landedCellIds={landedCellIds}
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
                swapsAvailable={freeSwapsAvailable || 0}
                swapModeActive={swapModeActive}
                swapFirstTileSelected={!!swapFirstTile}
                onToggleSwapMode={toggleSwapMode}
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