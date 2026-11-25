'use strict';
/**
 * car_top.js - the tyre panel's car seen from above (Apex, Nov 23 2026): a two-door sports coupe in the M4's
 * proportions, drawn here on the CPU once (no image file): a dark body with a light outline, the glass darker, hood
 * creases, headlights, tail lights, the trunk's lip and the mirrors. The tyres are not in it: the dash shader draws
 * them under it, coloured by their pressure, so only their outer part shows past the body, as on a real car.
 *
 *   paintCarTop(w, h)   straight RGBA, w x h; the car fills the box (its own shape is about 0.45 wide to 1 long)
 *
 * Shapes are in car units: x -1..1 across the body's half width (the mirrors reach a little past it), y -1 (nose)
 * .. 1 (tail). Plain Node 8: no dependencies.
 */

// the body's half width along its length (y, half width), nose to tail; mirrored for the other side
const PROFILE = [
    [-1.0, 0.0], [-0.998, 0.25], [-0.99, 0.46], [-0.97, 0.63], [-0.935, 0.76], [-0.88, 0.86], [-0.8, 0.93],
    [-0.7, 0.98], [-0.6, 1.0], [-0.5, 0.99], [-0.4, 0.94], [-0.28, 0.88], [-0.1, 0.86], [0.08, 0.87], [0.22, 0.9],
    [0.36, 0.96], [0.5, 0.995], [0.62, 1.0], [0.72, 0.985], [0.81, 0.95], [0.88, 0.89], [0.93, 0.8], [0.97, 0.66],
    [0.99, 0.46], [0.998, 0.25], [1.0, 0.0],
];
function mirrored(half) {
    const right = half.map((p) => [p[1], p[0]]);                       // [x, y]
    const left = half.slice().reverse().map((p) => [-p[1], p[0]]);
    return right.concat(left);
}
const BODY = mirrored(PROFILE);
// the greenhouse: windscreen, roof, rear window (each a closed shape, x mirrored)
const sym = (pts) => pts.concat(pts.slice().reverse().map((p) => [-p[0], p[1]]));
const WINDSCREEN = sym([[0.0, -0.33], [0.5, -0.31], [0.66, -0.26], [0.64, -0.06], [0.5, -0.07], [0.0, -0.08]]);
const ROOF = sym([[0.0, -0.08], [0.5, -0.07], [0.64, -0.06], [0.63, 0.2], [0.5, 0.21], [0.0, 0.21]]);
const REARGLASS = sym([[0.0, 0.21], [0.5, 0.21], [0.63, 0.2], [0.56, 0.42], [0.4, 0.45], [0.0, 0.46]]);
const SIDEGLASS_R = [[0.68, -0.24], [0.76, -0.18], [0.78, 0.04], [0.74, 0.2], [0.67, 0.22], [0.66, -0.06]];
const MIRROR_R = [[0.84, -0.3], [1.12, -0.27], [1.14, -0.21], [0.86, -0.2]];
const HEAD_R = [[0.42, -0.972], [0.66, -0.935], [0.82, -0.875], [0.85, -0.835], [0.68, -0.885], [0.45, -0.945]];
const TAIL_R = [[0.46, 0.972], [0.7, 0.935], [0.88, 0.86], [0.91, 0.815], [0.7, 0.9], [0.48, 0.945]];
const flipX = (pts) => pts.map((p) => [-p[0], p[1]]);
// lines: hood creases (the power dome), the hood's shut line, the trunk lip, the doors' shut lines
const LINES = [
    [[0.22, -0.9], [0.3, -0.42]], [[-0.22, -0.9], [-0.3, -0.42]],
    [[0.08, -0.93], [0.1, -0.5]], [[-0.08, -0.93], [-0.1, -0.5]],
    [[0.8, -0.38], [0.5, -0.36], [0.0, -0.355]], [[-0.8, -0.38], [-0.5, -0.36], [0.0, -0.355]],
    [[0.66, 0.7], [0.3, 0.72], [0.0, 0.725]], [[-0.66, 0.7], [-0.3, 0.72], [0.0, 0.725]],
    [[0.62, 0.9], [0.0, 0.915]], [[-0.62, 0.9], [0.0, 0.915]],
];

function inside(pts, x, y) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i], b = pts[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
}
function segDist(px, py, a, b) {
    const bx = b[0] - a[0], by = b[1] - a[1], ax = px - a[0], ay = py - a[1];
    const l2 = bx * bx + by * by;
    const h = l2 > 0 ? Math.max(0, Math.min(1, (ax * bx + ay * by) / l2)) : 0;
    return Math.hypot(ax - bx * h, ay - by * h);
}
function edgeDist(pts, px, py, closed) {
    let d = Infinity;
    const n = pts.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) d = Math.min(d, segDist(px, py, pts[i], pts[(i + 1) % n]));
    return d;
}

const BODY_FILL = [20, 20, 23], OUTLINE = [205, 207, 214], GLASS = [6, 7, 9], GLASS_EDGE = [120, 122, 130],
    ROOF_FILL = [30, 30, 34], DETAIL = [92, 94, 102], HEAD = [176, 180, 190], TAIL = [190, 28, 34];

// painted once per size and kept: drawing it costs about a second of the head unit's CPU (car log, Nov 23 2026: every
// rebuild painted it again, a large part of a setting change's wait)
const CACHE = new Map();

/** The car, w x h RGBA (transparent round it); the same Buffer for the same size (callers must not change it). */
function paintCarTop(w, h) {
    const key = w + 'x' + h;
    if (!CACHE.has(key)) CACHE.set(key, paint(w, h));
    return CACHE.get(key);
}

function bboxOf(pts, pad) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach((p) => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

function paint(w, h) {
    const out = Buffer.alloc(w * h * 4, 0);
    // car units to px: the body's half width spans 0.5 * w / (the mirrors' reach), its half length h / 2
    const reach = 1.16, sx = (w / 2) / reach, sy = (h / 2) / 1.0;
    const px1 = 1 / Math.min(sx, sy);                     // one pixel in car units (for line widths)
    const shapes = [
        { pts: BODY, fill: BODY_FILL },
        { pts: MIRROR_R, fill: BODY_FILL }, { pts: flipX(MIRROR_R), fill: BODY_FILL },
        { pts: WINDSCREEN, fill: GLASS }, { pts: ROOF, fill: ROOF_FILL }, { pts: REARGLASS, fill: GLASS },
        { pts: SIDEGLASS_R, fill: GLASS }, { pts: flipX(SIDEGLASS_R), fill: GLASS },
        { pts: HEAD_R, fill: HEAD }, { pts: flipX(HEAD_R), fill: HEAD },
        { pts: TAIL_R, fill: TAIL }, { pts: flipX(TAIL_R), fill: TAIL },
    ];
    const strokes = [
        { pts: BODY, closed: true, col: OUTLINE, wpx: 1.4 },
        { pts: MIRROR_R, closed: true, col: OUTLINE, wpx: 1.1 }, { pts: flipX(MIRROR_R), closed: true, col: OUTLINE, wpx: 1.1 },
        { pts: WINDSCREEN, closed: true, col: GLASS_EDGE, wpx: 1.0 }, { pts: REARGLASS, closed: true, col: GLASS_EDGE, wpx: 1.0 },
        { pts: SIDEGLASS_R, closed: true, col: GLASS_EDGE, wpx: 0.9 }, { pts: flipX(SIDEGLASS_R), closed: true, col: GLASS_EDGE, wpx: 0.9 },
    ].concat(LINES.map((l) => ({ pts: l, closed: false, col: DETAIL, wpx: 0.9 })));
    shapes.forEach((s) => { s.bb = bboxOf(s.pts, 0); });
    strokes.forEach((s) => { s.bb = bboxOf(s.pts, s.wpx * px1 + px1); });
    const SS = 2;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0, g = 0, b = 0, a = 0;
            for (let j = 0; j < SS; j++) {
                for (let i = 0; i < SS; i++) {
                    const cx = (x + (i + 0.5) / SS - w / 2) / sx, cy = (y + (j + 0.5) / SS - h / 2) / sy;
                    let col = null;
                    for (let k = 0; k < shapes.length; k++) {
                        const b = shapes[k].bb;
                        if (cx >= b[0] && cx <= b[2] && cy >= b[1] && cy <= b[3] && inside(shapes[k].pts, cx, cy)) col = shapes[k].fill;
                    }
                    for (let k = 0; k < strokes.length; k++) {
                        const s = strokes[k], b = s.bb;
                        if (cx < b[0] || cx > b[2] || cy < b[1] || cy > b[3]) continue;
                        if (edgeDist(s.pts, cx, cy, s.closed) < s.wpx * px1 * 0.5 + px1 * 0.25) col = s.col;
                    }
                    if (col) { r += col[0]; g += col[1]; b += col[2]; a++; }
                }
            }
            if (!a) continue;
            const o = (y * w + x) * 4;
            out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a);
            out[o + 3] = Math.round(255 * a / (SS * SS));
        }
    }
    return out;
}

module.exports = { paintCarTop };
