import Matter from 'matter-js';

export interface FallingTile {
  /** Stable id, also used to locate the tile's DOM element. */
  id: string;
  /** Pixel centre the tile starts from. */
  from: { x: number; y: number };
  /** Pixel centre the tile must come to rest at. */
  to: { x: number; y: number };
}

export interface GravityDropOptions {
  tiles: FallingTile[];
  cellSize: { w: number; h: number };
  /** Resolves a tile id to its (already rendered) DOM element. */
  getElement: (id: string) => HTMLElement | null;
  /** Fired once a single tile has come to rest at its destination. */
  onTileSettled: (id: string) => void;
  /** Fired once every tile has settled (or the safety timeout is hit). */
  onComplete: () => void;
}

interface TileSim {
  tile: FallingTile;
  body: Matter.Body;
  el: HTMLElement | null;
  restY: number;
  lockX: number;
  settled: boolean;
  impacted: boolean;
  squash: number;
}

// ==================== PHYSICS TUNING ====================
// Gravitational pull. Matter's default is 0.001; higher = snappier drop.
const GRAVITY_SCALE = 0.0019;
// How bouncy tiles are when they hit their slot (0 = dead stop, 1 = full bounce).
const TILE_RESTITUTION = 0.4;
// Squash applied on impact, decaying each frame (sells the landing).
const SQUASH_DECAY = 0.8;
const SQUASH_X = 0.16;
const SQUASH_Y = 0.2;
// A tile is "settled" once it rests this close to its slot with little motion.
const SETTLE_DIST = 1.5;
const SETTLE_SPEED = 0.4;
// Hard stop so a stuck simulation can never wedge the game.
const SAFETY_TIMEOUT_MS = 1600;
// ========================================================

/**
 * Drops a set of tiles into their destination slots using a real physics
 * simulation (gravity, impact, bounce, settle). Motion is constrained to a
 * clean vertical fall per column, and each tile is guaranteed to land exactly
 * in its slot. Returns a cancel function.
 */
export function runGravityDrop(opts: GravityDropOptions): () => void {
  const { tiles, cellSize, getElement, onTileSettled, onComplete } = opts;
  const { Engine, Bodies, Composite, Body } = Matter;
  const { w, h } = cellSize;

  const engine = Engine.create();
  engine.gravity.y = 1;
  engine.gravity.scale = GRAVITY_SCALE;

  const sims: TileSim[] = tiles.map(tile => {
    const lockX = tile.to.x;
    const body = Bodies.rectangle(lockX, tile.from.y, w, h, {
      restitution: TILE_RESTITUTION,
      friction: 0.01,
      frictionAir: 0.005,
      density: 0.004,
    });
    return {
      tile,
      body,
      el: getElement(tile.id),
      restY: tile.to.y,
      lockX,
      settled: false,
      impacted: false,
      squash: 0,
    };
  });

  // One static floor per tile, placed so the tile rests exactly in its slot.
  // Tiles sharing a column still collide with each other mid-fall.
  const floors = sims.map(sim =>
    Bodies.rectangle(sim.lockX, sim.restY + h / 2 + 20, w, 40, {
      isStatic: true,
      restitution: 0.18,
    }),
  );

  Composite.add(engine.world, [...sims.map(s => s.body), ...floors]);

  let rafId = 0;
  let cancelled = false;
  const startTime = performance.now();

  const paint = (el: HTMLElement, x: number, y: number, sx: number, sy: number) => {
    el.style.transform =
      `translate(${x - w / 2}px, ${y - h / 2}px) scaleX(${sx}) scaleY(${sy})`;
  };

  const settleTile = (sim: TileSim) => {
    if (sim.settled) return;
    sim.settled = true;
    Composite.remove(engine.world, sim.body);
    if (sim.el) paint(sim.el, sim.lockX, sim.restY, 1, 1);
    onTileSettled(sim.tile.id);
  };

  const cleanup = () => {
    Composite.clear(engine.world, false);
    Engine.clear(engine);
  };

  const step = () => {
    if (cancelled) return;
    Engine.update(engine, 1000 / 60);

    const elapsed = performance.now() - startTime;
    const timedOut = elapsed > SAFETY_TIMEOUT_MS;
    let allSettled = true;

    for (const sim of sims) {
      if (sim.settled) continue;
      if (!sim.el) sim.el = getElement(sim.tile.id);

      // Constrain to a clean vertical drop: no horizontal drift, no spin.
      Body.setPosition(sim.body, { x: sim.lockX, y: sim.body.position.y });
      Body.setVelocity(sim.body, { x: 0, y: sim.body.velocity.y });
      Body.setAngle(sim.body, 0);
      Body.setAngularVelocity(sim.body, 0);

      const dy = sim.body.position.y - sim.restY;
      const speed = Math.abs(sim.body.velocity.y);

      // First contact with the slot triggers the impact squash.
      if (!sim.impacted && dy > -1) {
        sim.impacted = true;
        sim.squash = 1;
      }
      sim.squash *= SQUASH_DECAY;

      const atRest =
        sim.impacted &&
        Math.abs(dy) < SETTLE_DIST &&
        speed < SETTLE_SPEED &&
        sim.squash < 0.3;

      if (timedOut || atRest) {
        settleTile(sim);
        continue;
      }

      allSettled = false;
      if (sim.el) {
        paint(
          sim.el,
          sim.body.position.x,
          sim.body.position.y,
          1 + sim.squash * SQUASH_X,
          1 - sim.squash * SQUASH_Y,
        );
      }
    }

    if (allSettled) {
      cancelled = true;
      cleanup();
      onComplete();
      return;
    }
    rafId = requestAnimationFrame(step);
  };

  rafId = requestAnimationFrame(step);

  return () => {
    if (cancelled) return;
    cancelled = true;
    cancelAnimationFrame(rafId);
    cleanup();
  };
}
