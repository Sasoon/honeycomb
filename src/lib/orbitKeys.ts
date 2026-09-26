// Keyed tiles: word order drawn with the tiles' own outlines. Each selected
// tile grows a small key from the edge facing the next tile, and the next
// tile has a matching socket, so the dark seam between them bends into a
// chevron that points along the word. A leap has no shared edge, so it gets
// the only glyph: a double chevron on the tile it left and the tile it
// reached. All coordinates are tile-local (70x80 pointy-top hex).

type Vec = [number, number];

const HEX: Vec[] = [[35, 0], [70, 20], [70, 60], [35, 80], [0, 60], [0, 20]];
const C: Vec = [35, 40];
// 11px deep, 20px wide on a 40px edge: sharp enough to read as a chevron on diagonal seams
const KEY = { depth: 11, width: 20 };

const f = (n: number) => +n.toFixed(1);
export const unit = (a: Vec, b: Vec): Vec => {
    const x = b[0] - a[0];
    const y = b[1] - a[1];
    const l = Math.hypot(x, y);
    return [x / l, y / l];
};

// The hex edge whose outward normal best matches direction d
function edgeFacing(d: Vec) {
    let best: { i: number; mid: Vec; e: Vec; score: number } | null = null;
    for (let i = 0; i < 6; i++) {
        const a = HEX[i];
        const b = HEX[(i + 1) % 6];
        const mid: Vec = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const n = unit(C, mid);
        const score = n[0] * d[0] + n[1] * d[1];
        if (!best || score > best.score) best = { i, mid, e: unit(a, b), score };
    }
    return best!;
}

// Key: pokes `depth` px past the edge, across the gap, into the next tile's socket
function keyPath(d: Vec): string {
    const { mid, e } = edgeFacing(d);
    const { depth: D, width: W } = KEY;
    const sink = 2; // the base sits inside the tile so no hairline shows
    const pt = (s: number, t: number) => `${f(mid[0] + e[0] * s + d[0] * t)} ${f(mid[1] + e[1] * s + d[1] * t)}`;
    return `M${pt(-W / 2, -sink)}L${pt(-W / 2, 0)}L${pt(0, D)}L${pt(W / 2, 0)}L${pt(W / 2, -sink)}Z`;
}

// Tile outline with a socket for every step that enters this tile. The socket
// is a touch roomier than the key so the seam keeps its width all the way round
function keyedOutline(sockets: Vec[]): string {
    const pts: Vec[] = [];
    const { depth: D, width: W } = KEY;
    const Ws = W + 2;
    for (let i = 0; i < 6; i++) {
        pts.push(HEX[i]);
        sockets.forEach(d => {
            const ef = edgeFacing([-d[0], -d[1]]);
            if (ef.i !== i) return;
            const { mid, e } = ef;
            pts.push([mid[0] - e[0] * Ws / 2, mid[1] - e[1] * Ws / 2]);
            pts.push([mid[0] + d[0] * (D + 1.5), mid[1] + d[1] * (D + 1.5)]);
            pts.push([mid[0] + e[0] * Ws / 2, mid[1] + e[1] * Ws / 2]);
        });
    }
    return `polygon(${pts.map(p => `${f(p[0])}px ${f(p[1])}px`).join(', ')})`;
}

// Distance from the centre to the hex outline along d
function rayToEdge(d: Vec): number {
    let best = Infinity;
    for (let i = 0; i < 6; i++) {
        const [ax, ay] = HEX[i];
        const [bx, by] = HEX[(i + 1) % 6];
        const ex = bx - ax;
        const ey = by - ay;
        const den = d[0] * ey - d[1] * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((ax - C[0]) * ey - (ay - C[1]) * ex) / den;
        const u = ((ax - C[0]) * d[1] - (ay - C[1]) * d[0]) / den;
        if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.min(best, t);
    }
    return best;
}

// Double chevron » along travel direction d. Outbound: tip just inside the
// edge facing the landing tile. Inbound: just inside the edge facing back
// toward the source, pointing into the tile
export function leapGlyph(d: Vec, inward: boolean): string {
    const R = rayToEdge(inward ? [-d[0], -d[1]] : d);
    const p: Vec = [-d[1], d[0]];
    // Straight up/down lands on a top/bottom corner, home of the order index
    // or letter value: go smaller and tighter there
    const vert = Math.abs(d[1]) > 0.9;
    const h = vert ? 3.8 : 5;
    const w = vert ? 9.5 : 11;
    const gap = vert ? 3.6 : 4.6;
    const inset = vert ? 2.6 : 5;
    const lead = inward ? -(R - inset - h - gap) : R - inset;
    let s = '';
    for (let i = 0; i < 2; i++) {
        const a = lead - i * gap;
        const tip: Vec = [C[0] + d[0] * a, C[1] + d[1] * a];
        const b: Vec = [tip[0] - d[0] * h, tip[1] - d[1] * h];
        s += `M${f(b[0] + p[0] * w / 2)} ${f(b[1] + p[1] * w / 2)}L${f(tip[0])} ${f(tip[1])}L${f(b[0] - p[0] * w / 2)} ${f(b[1] - p[1] * w / 2)}`;
    }
    return s;
}

export interface KeyedTile {
    k: number;
    isStart: boolean;
    isHead: boolean;
    key?: string; // SVG path for the key toward the next tile
    hex?: string; // clip-path with sockets for the steps entering this tile
    leap: string[]; // leap glyph paths
    lowOrder: boolean; // a leap glyph sits in the top corner: nudge the order index down
}

// sel: ids in tap order; centre(id) -> board px; isAdj(a, b) -> neighbours?
export function keyedTiles(
    sel: string[],
    centre: (id: string) => Vec,
    isAdj: (a: string, b: string) => boolean
): Map<string, KeyedTile> {
    const out = new Map<string, KeyedTile & { sockets: Vec[] }>();
    sel.forEach((id, k) => out.set(id, {
        k,
        isStart: k === 0 && sel.length > 1,
        isHead: k === sel.length - 1,
        sockets: [],
        leap: [],
        lowOrder: false,
    }));
    for (let k = 0; k < sel.length - 1; k++) {
        const a = out.get(sel[k])!;
        const b = out.get(sel[k + 1])!;
        const d = unit(centre(sel[k]), centre(sel[k + 1]));
        if (isAdj(sel[k], sel[k + 1])) {
            a.key = keyPath(d);
            b.sockets.push(d);
        } else {
            a.leap.push(leapGlyph(d, false));
            if (d[1] < -0.9) a.lowOrder = true;
            b.leap.push(leapGlyph(d, true));
        }
    }
    out.forEach(t => { if (t.sockets.length) t.hex = keyedOutline(t.sockets); });
    return out;
}
