// Picked tiles ramp from a deep teal on the first tap to full accent on the
// newest, a secondary cue to the order numbers in each tile's slot
const RAMP = { valid: ['#1F9C8F', '#3FD8C7'], invalid: ['#3A4A60', '#5A6C84'] } as const;

const hexRgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

export function trailColor(i: number, n: number, invalid: boolean): string {
    const [a, b] = RAMP[invalid ? 'invalid' : 'valid'].map(hexRgb);
    const t = n <= 1 ? 1 : i / (n - 1);
    return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * t)).join(',')})`;
}
