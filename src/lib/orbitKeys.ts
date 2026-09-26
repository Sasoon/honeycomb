// Keyed tiles: word order drawn with the tiles' own outlines. Each selected
// tile grows a small key from the edge facing the next tile, and the next
// tile has a matching socket, so the dark seam between them bends into a
// chevron that points along the word. All coordinates are tile-local
// (70x80 pointy-top hex).

type Vec = [number, number];

const HEX: Vec[] = [[35, 0], [70, 20], [70, 60], [35, 80], [0, 60], [0, 20]];
const C: Vec = [35, 40];
// 11px deep, 20px wide on a 40px edge: sharp enough to read as a chevron on diagonal seams
const KEY = { depth: 11, width: 20 };

const f = (n: number) => +n.toFixed(1);
const unit = (a: Vec, b: Vec): Vec => {
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

export interface KeyedTile {
    k: number;
    isStart: boolean;
    isHead: boolean;
    key?: string; // SVG path for the key toward the next tile
    hex?: string; // clip-path with sockets for the steps entering this tile
}

// sel: ids in tap order, each touching the last; centre(id) -> board px
export function keyedTiles(sel: string[], centre: (id: string) => Vec): Map<string, KeyedTile> {
    const out = new Map<string, KeyedTile & { sockets: Vec[] }>();
    sel.forEach((id, k) => out.set(id, {
        k,
        isStart: k === 0 && sel.length > 1,
        isHead: k === sel.length - 1,
        sockets: [],
    }));
    for (let k = 0; k < sel.length - 1; k++) {
        const a = out.get(sel[k])!;
        const b = out.get(sel[k + 1])!;
        const d = unit(centre(sel[k]), centre(sel[k + 1]));
        a.key = keyPath(d);
        b.sockets.push(d);
    }
    out.forEach(t => { if (t.sockets.length) t.hex = keyedOutline(t.sockets); });
    return out;
}
