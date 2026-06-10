// Unified tile-fall animation: both flood (new tiles entering) and resolve
// (tiles settling after a clear) animate as a single continuous free-fall
// along their path. Keyframe times follow real gravity — a tile starting at
// rest covers distance d at time sqrt(d/D), so motion accelerates naturally
// without per-segment easing.

export interface FallPoint {
    x: number;
    y: number;
}

export interface FallSpec {
    key: string;
    cellId: string;
    letter: string;
    /** Pixel centres along the fall, first = start, last = landing slot. */
    points: FallPoint[];
    /** When true the tile fades/scales in at its start point (flood entry). */
    spawn?: boolean;
}

export interface FallFrames {
    key: string;
    cellId: string;
    letter: string;
    xs: number[];
    ys: number[];
    /** Normalised keyframe times (0..1), spaced for constant acceleration. */
    times: number[];
    /** ms */
    duration: number;
    /** ms */
    delay: number;
    spawn: boolean;
}

// ==================== FALL TUNING ====================
// Duration of a fall one cell high; longer falls scale with sqrt(height)
// like real gravity, so a 4-cell fall takes 2x this, not 4x.
const FALL_REF_MS = 165;
const FALL_MIN_MS = 150;
const FALL_MAX_MS = 560;
// Gap between consecutive tiles starting their fall.
export const FALL_STAGGER_MS = 45;
// =====================================================

export function buildFallFrames(
    specs: FallSpec[],
    cellHeight: number,
    staggerMs: number = FALL_STAGGER_MS
): { frames: FallFrames[]; totalMs: number } {
    const frames: FallFrames[] = [];
    let totalMs = 0;

    specs.forEach((spec, idx) => {
        const pts = spec.points;
        if (pts.length < 2) return;

        // Cumulative path distance at each waypoint
        const cum: number[] = [0];
        for (let i = 1; i < pts.length; i++) {
            cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
        }
        const total = cum[cum.length - 1];
        if (total <= 0) return;

        const duration = Math.min(
            FALL_MAX_MS,
            Math.max(FALL_MIN_MS, FALL_REF_MS * Math.sqrt(total / Math.max(cellHeight, 1)))
        );
        const delay = idx * staggerMs;

        frames.push({
            key: spec.key,
            cellId: spec.cellId,
            letter: spec.letter,
            xs: pts.map(p => p.x),
            ys: pts.map(p => p.y),
            times: cum.map(d => Math.sqrt(d / total)),
            duration,
            delay,
            spawn: !!spec.spawn,
        });

        totalMs = Math.max(totalMs, delay + duration);
    });

    return { frames, totalMs };
}

/**
 * Per-segment easing functions that keep speed continuous through every
 * waypoint. Globally the fall follows s(t) = D·t² (constant acceleration);
 * within segment i, spanning normalised times [a, b], local progress p maps
 * to distance fraction ((a + p·(b−a))² − a²) / (b² − a²). With linear
 * per-segment easing instead, speed is constant inside each segment and
 * jumps at waypoints — the visible jank this removes.
 */
export function gravityEasings(times: number[]): Array<(p: number) => number> {
    const eases: Array<(p: number) => number> = [];
    for (let i = 0; i < times.length - 1; i++) {
        const a = times[i];
        const b = times[i + 1];
        const denom = b * b - a * a || 1;
        eases.push((p: number) => ((a + p * (b - a)) ** 2 - a * a) / denom);
    }
    return eases;
}
