export type HapticPattern = number | number[];

let lastVibrateAt = 0;
const MIN_INTERVAL_MS = 30; // avoid over-spam

function canVibrate(): boolean {
    if (typeof window === 'undefined') return false;
    const nav = window.navigator as Navigator & { vibrate?: (pattern: HapticPattern) => boolean };
    return typeof nav !== 'undefined' && typeof nav.vibrate === 'function';
}

function vibrate(pattern: HapticPattern): void {
    if (!canVibrate()) return;
    const now = Date.now();
    if (now - lastVibrateAt < MIN_INTERVAL_MS) return;
    lastVibrateAt = now;
    try {
        (window.navigator as Navigator & { vibrate?: (p: HapticPattern) => boolean }).vibrate?.(pattern);
    } catch {
        // no-op
    }
}

export const haptics = {
    tick(): void {
        vibrate(10);
    },
    select(): void {
        vibrate(12);
    },
    success(): void {
        vibrate([12, 30, 40]);
    }
}; 