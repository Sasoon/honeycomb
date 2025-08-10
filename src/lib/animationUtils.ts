// Animation utilities for smooth tile movements

// Easing functions for smooth animations
export const easings = {
  linear: (t: number) => t,
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
  easeOutQuad: (t: number) => 1 - (1 - t) * (1 - t),
  easeInQuad: (t: number) => t * t,
  easeOutElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
};

// Animation frame manager for smooth, synchronized animations
export class AnimationFrameManager {
  private animations: Map<string, Animation> = new Map();
  private rafId: number | null = null;
  private lastTime: number = 0;

  start() {
    if (this.rafId !== null) return;
    this.lastTime = performance.now();
    this.tick();
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = () => {
    const now = performance.now();
    const deltaTime = now - this.lastTime;
    this.lastTime = now;

    // Update all animations
    this.animations.forEach((anim, id) => {
      anim.update(deltaTime);
      if (anim.isComplete) {
        this.animations.delete(id);
      }
    });

    // Continue if there are animations
    if (this.animations.size > 0) {
      this.rafId = requestAnimationFrame(this.tick);
    } else {
      this.rafId = null;
    }
  };

  addAnimation(id: string, animation: Animation) {
    this.animations.set(id, animation);
    this.start();
  }

  removeAnimation(id: string) {
    this.animations.delete(id);
  }

  clear() {
    this.animations.clear();
    this.stop();
  }
}

// Individual animation class
export class Animation {
  private elapsed: number = 0;
  public isComplete: boolean = false;

  constructor(
    private duration: number,
    private onUpdate: (progress: number) => void,
    private easing: (t: number) => number = easings.easeInOutCubic,
    private onComplete?: () => void
  ) {}

  update(deltaTime: number) {
    if (this.isComplete) return;

    this.elapsed += deltaTime;
    const rawProgress = Math.min(this.elapsed / this.duration, 1);
    const easedProgress = this.easing(rawProgress);
    
    this.onUpdate(easedProgress);

    if (rawProgress >= 1) {
      this.isComplete = true;
      this.onComplete?.();
    }
  }
}

// Tile animation orchestrator
export class TileAnimationOrchestrator {
  private slotOccupancy: Map<string, number> = new Map(); // slot key -> release timestamp
  private columnOccupancy: Map<number, number> = new Map(); // column -> release timestamp
  // Animation queue for future use
  // private animationQueue: AnimationQueueItem[] = [];
  private frameManager: AnimationFrameManager;

  constructor() {
    this.frameManager = new AnimationFrameManager();
  }

  // Clear all animations and occupancy tracking
  clear() {
    this.slotOccupancy.clear();
    this.columnOccupancy.clear();
    // this.animationQueue = [];
    this.frameManager.clear();
  }

  // Check if a slot is available at a given time
  isSlotAvailable(row: number, col: number, at: number): boolean {
    const key = `${row},${col}`;
    const occupiedUntil = this.slotOccupancy.get(key) ?? 0;
    return at >= occupiedUntil;
  }

  // Check if a column is available at a given time
  isColumnAvailable(col: number, at: number): boolean {
    const occupiedUntil = this.columnOccupancy.get(col) ?? 0;
    return at >= occupiedUntil;
  }

  // Reserve a slot for a duration
  reserveSlot(row: number, col: number, from: number, duration: number) {
    const key = `${row},${col}`;
    this.slotOccupancy.set(key, from + duration);
  }

  // Reserve a column for a duration
  reserveColumn(col: number, from: number, duration: number) {
    this.columnOccupancy.set(col, from + duration);
  }

  // Calculate the earliest time a path can be traversed without collisions
  calculatePathTiming(
    path: Array<{ row: number; col: number }>,
    startDelay: number,
    stepDuration: number,
    pauseDuration: number
  ): PathTiming[] {
    const timings: PathTiming[] = [];
    let currentTime = startDelay;

    path.forEach((pos, index) => {
      // Find earliest available time for this position
      let availableTime = currentTime;
      
      // Check slot availability
      while (!this.isSlotAvailable(pos.row, pos.col, availableTime)) {
        availableTime += 10; // Small increment to find available slot
      }
      
      // Check column availability for vertical movements
      if (index > 0 && path[index - 1].col === pos.col) {
        while (!this.isColumnAvailable(pos.col, availableTime)) {
          availableTime += 10;
        }
      }

      // Ensure we don't go backwards in time
      if (availableTime < currentTime) {
        availableTime = currentTime;
      }

      const duration = index === path.length - 1 ? stepDuration : stepDuration + pauseDuration;
      
      timings.push({
        position: pos,
        startTime: availableTime,
        duration: duration,
        isLast: index === path.length - 1
      });

      // Reserve the slot and column
      this.reserveSlot(pos.row, pos.col, availableTime, duration);
      if (index > 0 && path[index - 1].col === pos.col) {
        this.reserveColumn(pos.col, availableTime, stepDuration);
      }

      currentTime = availableTime + duration;
    });

    return timings;
  }

  // Animate a tile along a path with proper timing and easing
  animateTilePath(
    tileId: string,
    path: PathTiming[],
    centers: Map<string, { x: number; y: number }>,
    onPositionUpdate: (x: number, y: number, progress: number) => void,
    onComplete?: () => void
  ) {
    let currentStep = 0;

    const animateStep = () => {
      if (currentStep >= path.length) {
        onComplete?.();
        return;
      }

      const timing = path[currentStep];
      const centerKey = `${timing.position.row},${timing.position.col}`;
      const targetCenter = centers.get(centerKey);
      
      if (!targetCenter) {
        currentStep++;
        animateStep();
        return;
      }

      // Determine easing based on step type
      const easing = timing.isLast ? easings.easeOutBounce : easings.easeOutQuad;
      
      // Start position (from previous step or initial)
      let startX = targetCenter.x;
      let startY = targetCenter.y;
      
      if (currentStep > 0) {
        const prevTiming = path[currentStep - 1];
        const prevKey = `${prevTiming.position.row},${prevTiming.position.col}`;
        const prevCenter = centers.get(prevKey);
        if (prevCenter) {
          startX = prevCenter.x;
          startY = prevCenter.y;
        }
      }

      // Create animation for this step
      const animation = new Animation(
        timing.duration,
        (progress) => {
          const x = startX + (targetCenter.x - startX) * progress;
          const y = startY + (targetCenter.y - startY) * progress;
          onPositionUpdate(x, y, progress);
        },
        easing,
        () => {
          currentStep++;
          // Small delay between steps for visual clarity
          setTimeout(animateStep, timing.isLast ? 0 : 50);
        }
      );

      this.frameManager.addAnimation(`${tileId}-step-${currentStep}`, animation);
    };

    // Start animation after initial delay
    setTimeout(animateStep, path[0]?.startTime ?? 0);
  }
}

// Types for animation system
export interface PathTiming {
  position: { row: number; col: number };
  startTime: number;
  duration: number;
  isLast: boolean;
}

export interface AnimationQueueItem {
  id: string;
  priority: number;
  execute: () => void;
}

// Utility to generate smooth path coordinates
export function generateSmoothPath(
  startPos: { x: number; y: number },
  endPos: { x: number; y: number },
  steps: number = 10
): Array<{ x: number; y: number }> {
  const path: Array<{ x: number; y: number }> = [];
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const easedT = easings.easeInOutCubic(t);
    path.push({
      x: startPos.x + (endPos.x - startPos.x) * easedT,
      y: startPos.y + (endPos.y - startPos.y) * easedT
    });
  }
  
  return path;
}

// Calculate animation priority based on position (top tiles animate first)
export function calculateAnimationPriority(row: number, col: number, gridSize: number): number {
  // Lower rows and leftmost columns get higher priority (lower number = higher priority)
  return row * gridSize + col;
}