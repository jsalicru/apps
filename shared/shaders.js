'use strict';
/**
 * The HUD's GLSL ES 1.00 fragment shaders for cluster-render "effect" layers, drawn on the
 * car's GPU. Kept as JS strings because the kit's build ships an app's top-level .js files
 * as they are (a data folder becomes a JSON-only pack). hud.js sends the uniforms.
 */
const SHIFTBAR = `// Segmented shift bar for a cluster-render "effect" layer (GLSL ES 1.00).
// v_uv is 0..1 across the layer, (0,0) at the top-left as on the car. Uniforms come from hud.js:
//   u_value   0..1, how much of the bar is lit (rpm / bar max)
//   u_size    layer size in px (w, h), for round corners and gaps in pixels
//   u_segs    segment count
//   u_low, u_mid, u_high   zone colours (rgb 0..1)
//   u_midAt, u_highAt      where the mid and high zones start (0..1 of the bar)
//   u_track   unlit segment colour (rgba, straight alpha)
//   u_flash   1 = at the redline: every lit segment shows the high colour
//   u_skip    driver camera wings: px from the layer's left (from, to) left empty; then u_segs segments on each
//             side, mirrored, filling from the outer ends in towards the gap. to <= from: one bar as usual
// Output is straight alpha. Whether cluster-render blends effect layers as
// straight or premultiplied alpha is not confirmed yet: check the edges on the car.
precision mediump float;
varying vec2 v_uv;
uniform float u_value;
uniform vec2 u_size;
uniform float u_segs;
uniform vec3 u_low;
uniform vec3 u_mid;
uniform vec3 u_high;
uniform float u_midAt;
uniform float u_highAt;
uniform vec4 u_track;
uniform float u_flash;
uniform vec2 u_skip;

void main() {
    float gapPx = 3.0;
    float px = v_uv.x * u_size.x;
    float slot = u_size.x / u_segs;                 // px per segment incl. gap
    float local = px;                               // px from where the fill starts
    if (u_skip.y > u_skip.x) {                      // wings: left from its left end, right mirrored from its right end
        if (px >= u_skip.x && px < u_skip.y) { gl_FragColor = vec4(0.0); return; }
        if (px < u_skip.x) slot = u_skip.x / u_segs;
        else { slot = (u_size.x - u_skip.y) / u_segs; local = u_size.x - px; }
    }
    float idx = floor(local / slot);
    float inSeg = local - idx * slot;               // px into this slot
    float segW = slot - gapPx;
    float py = v_uv.y * u_size.y;           // px from the top

    // rounded-rect coverage for this segment, radius 2px, 1px soft edge
    vec2 hs = vec2(segW, u_size.y) * 0.5;
    vec2 p = vec2(inSeg, py) - hs;
    vec2 q = abs(p) - (hs - vec2(2.0));
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 2.0;
    float cover = clamp(0.5 - d, 0.0, 1.0);
    if (inSeg > segW) cover = 0.0;
    if (cover <= 0.0) { gl_FragColor = vec4(0.0); return; }

    float pos = (idx + 0.5) / u_segs;               // segment centre, 0..1
    bool lit = pos <= u_value;
    vec3 c = pos >= u_highAt ? u_high : (pos >= u_midAt ? u_mid : u_low);
    if (u_flash > 0.5) c = u_high;
    gl_FragColor = lit ? vec4(c, cover) : vec4(u_track.rgb, u_track.a * cover);
}
`;

const ARC = `// Thin open arc gauge for a cluster-render "effect" layer (GLSL ES 1.00).
// u_start / u_sweep (radians, clockwise from 12 o'clock; a negative sweep runs anticlockwise), round
// ends, filled from the start. hud.js default: 270 degrees from the lower left, the gap at the bottom.
// Uniforms from hud.js:
//   u_value  0..1 of the sweep
//   u_size   layer size in px (w, h)
//   u_color  lit arc (rgb 0..1)
//   u_track  unlit arc (rgba, straight alpha)
//   u_width  stroke width in px
// Output is straight alpha (same open question as the shift bar shader above).
precision mediump float;
varying vec2 v_uv;
uniform float u_value;
uniform vec2 u_size;
uniform vec3 u_color;
uniform vec4 u_track;
uniform float u_width;
uniform float u_start;
uniform float u_sweep;
uniform float u_peak;    // peak hold 0..1 of the sweep, a bright dot on the stroke (below 0: none)
uniform vec3 u_peakC;

const float PI = 3.14159265359;

// distance from point p (centred, px) to the arc from angle a0 sweeping s, radius r
float arcDist(vec2 p, float r, float a0, float s) {
    float a = atan(p.x, p.y);           // clockwise from 12 o'clock, -PI..PI
    float rel = mod(a - a0 + 4.0 * PI, 2.0 * PI);
    if (rel <= s) return abs(length(p) - r);
    vec2 e0 = r * vec2(sin(a0), cos(a0));
    vec2 e1 = r * vec2(sin(a0 + s), cos(a0 + s));
    return min(length(p - e0), length(p - e1));   // round end caps
}

void main() {
    vec2 p = vec2(v_uv.x - 0.5, 0.5 - v_uv.y) * u_size;   // px from centre, +y up (v_uv is top-left)
    float start = u_start, sweep = u_sweep;
    if (sweep < 0.0) { p.x = -p.x; start = -start; sweep = -sweep; }   // anticlockwise = mirrored clockwise
    float r = min(u_size.x, u_size.y) * 0.5 - u_width * 0.5 - 1.0;
    float hw = u_width * 0.5;
    float dTrack = arcDist(p, r, start, sweep) - hw;
    float lit = clamp(u_value, 0.0, 1.0) * sweep;
    float dLit = lit > 0.001 ? arcDist(p, r, start, lit) - hw : 1e5;
    float cLit = clamp(0.5 - dLit, 0.0, 1.0);
    float cTrack = clamp(0.5 - dTrack, 0.0, 1.0);
    if (u_peak >= 0.0) {
        float pa = start + clamp(u_peak, 0.0, 1.0) * sweep;
        float dp = length(p - r * vec2(sin(pa), cos(pa))) - hw * 1.35;
        float cp = clamp(0.5 - dp, 0.0, 1.0);
        if (cp > 0.0) { gl_FragColor = vec4(u_peakC, cp); return; }
    }
    if (cLit > 0.0) gl_FragColor = vec4(u_color, cLit);
    else gl_FragColor = vec4(u_track.rgb, u_track.a * cTrack);
}
`;

const REVBAR = `// G20 Live Cockpit style rev bar for a cluster-render "effect" layer (GLSL ES 1.00), after
// cauliflowermossgrape's Redline app (MIT). From the top of the layer: u_top px for the shift-point and
// redline marks, then the bar (u_barH px, slanted: its top edge is u_slant px right of its bottom
// edge), then the scale ticks. The bar fills left to right in 500 rpm segments; each lit segment
// takes the ramp colour of its position up to the shift point (u_from -> u_to), all u_hot from the
// shift point on. Unlit: u_track, and u_hot faint past the redline. A white needle leads the fill;
// a thin slanted line holds the peak. Uniforms (rpm values are rpm, not 0..1):
//   u_size, u_top, u_barH, u_slant   px
//   u_max, u_value, u_shift, u_red, u_peak   rpm
//   u_from, u_to, u_hot   rgb 0..1;  u_track, u_tick, u_fg   rgba (straight alpha)
//   u_shiftNow   1 = at or past the shift point
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform float u_top;
uniform float u_barH;
uniform float u_slant;
uniform float u_max;
uniform float u_value;
uniform float u_shift;
uniform float u_red;
uniform float u_peak;
uniform vec3 u_from;
uniform vec3 u_to;
uniform vec3 u_hot;
uniform vec4 u_track;
uniform vec4 u_tick;
uniform vec4 u_fg;
uniform float u_shiftNow;

vec4 over(vec4 top, vec4 under) {           // straight-alpha "top over under"
    float a = top.a + under.a * (1.0 - top.a);
    if (a <= 0.0) return vec4(0.0);
    return vec4((top.rgb * top.a + under.rgb * under.a * (1.0 - top.a)) / a, a);
}

void main() {
    float px = v_uv.x * u_size.x;
    float py = v_uv.y * u_size.y;   // px from the top
    float bw = u_size.x - u_slant;            // bar length along the bottom edge
    float perRpm = bw / u_max;
    vec4 c = vec4(0.0);

    // marks above the bar: shift point (amber) and redline (red), at the bar's top edge
    if (py < u_top - 2.0) {
        float ds = abs(px - (u_shift * perRpm + u_slant));
        float dr = abs(px - (u_red * perRpm + u_slant));
        if (ds < 2.0) c = vec4(1.0, 0.76, 0.1, clamp(2.0 - ds, 0.0, 1.0));
        if (dr < 2.0) c = vec4(u_hot, clamp(2.0 - dr, 0.0, 1.0));
        gl_FragColor = c; return;
    }

    float by = py - u_top;                    // px down from the bar's top edge
    if (by <= u_barH) {
        float off = u_slant * (u_barH - by) / u_barH;
        float s = px - off;                   // px along the bar at this height
        float rpm = s / perRpm;
        float inside = clamp(s + 0.5, 0.0, 1.0) * clamp(bw - s + 0.5, 0.0, 1.0)
            * clamp(by + 0.5, 0.0, 1.0) * clamp(u_barH - by + 0.5, 0.0, 1.0);
        // slanted 3 px gap every 500 rpm
        float seg = floor(rpm / 500.0);
        float dGap = abs(s - floor(rpm / 500.0 + 0.5) * 500.0 * perRpm);
        float gap = rpm > 250.0 && rpm < u_max - 250.0 ? clamp(dGap - 1.0, 0.0, 1.0) : 1.0;
        vec4 bar;
        if (rpm <= u_value) {
            float f = clamp((seg * 500.0 + 250.0) / u_shift, 0.0, 1.0);
            vec3 col = u_shiftNow > 0.5 ? u_hot : mix(u_from, u_to, f);
            bar = vec4(col, 1.0);
        } else if (rpm >= u_red) bar = vec4(u_hot, 0.3);
        else bar = u_track;
        c = vec4(bar.rgb, bar.a * inside * gap);
        // peak: a thin slanted line where the rpm last peaked (only above the current rpm)
        if (u_peak > u_value + 60.0) {
            float dp = abs(s - u_peak * perRpm);
            vec3 pc = u_peak >= u_shift ? u_hot : mix(u_from, u_to, clamp(u_peak / u_shift, 0.0, 1.0));
            c = over(vec4(pc, clamp(1.5 - dp, 0.0, 1.0) * inside), c);
        }
        // needle: the bright leading edge of the fill
        if (u_value > 50.0) {
            float dn = abs(s - min(u_value, u_max) * perRpm);
            c = over(vec4(1.0, 1.0, 1.0, clamp(2.5 - dn, 0.0, 1.0) * clamp(by + 2.5, 0.0, 1.0) * clamp(u_barH - by + 2.5, 0.0, 1.0)), c);
        }
        gl_FragColor = c; return;
    }

    // scale ticks under the bar: every 500 rpm, longer every 1000, red from the redline
    float ty = by - u_barH - 4.0;
    if (ty >= 0.0) {
        float rpm = px / perRpm;
        float k = floor(rpm / 500.0 + 0.5);
        float d = abs(px - k * 500.0 * perRpm);
        bool major = mod(k, 2.0) < 0.5;
        float len = major ? 10.0 : 5.0;
        float hw = major ? 1.25 : 0.75;
        float a = clamp(hw + 0.5 - d, 0.0, 1.0) * (ty <= len ? 1.0 : 0.0);
        vec4 tc = k * 500.0 >= u_red ? vec4(u_hot, 1.0) : (major ? u_fg : u_tick);
        c = vec4(tc.rgb, tc.a * a);
    }
    gl_FragColor = c;
}
`;

const LIGHTS = `// Shift lights for a cluster-render "effect" layer (GLSL ES 1.00), after cauliflowermossgrape's Redline
// app (MIT): u_n rounded lights in a row, green -> yellow -> red from left to right. u_lit of them are
// on (they fill from a start rpm up to the shift point); u_strobe 1 = at the shift point: all red.
// The last u_tail lights are blue instead (the GT3 dash look; 0 = none). u_round 1 = round lights; 2 = a string of
// holiday bulbs: round, coloured red, green, yellow (gold), blue in turn by their own uniforms (hud_holiday.js).
//   u_size px, u_n count, u_lit count (0..u_n), u_tail count, u_strobe 0/1, u_green/u_yellow/u_red/u_blue rgb,
//   u_off (alpha when off), u_skip driver camera wings: px from the layer's left (from, to) left empty, then u_n
//   lights on each side, mirrored, filling from the outer ends in towards the gap (to <= from: one row as usual)
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform float u_n;
uniform float u_lit;
uniform float u_tail;
uniform float u_round;
uniform float u_strobe;
uniform vec3 u_green;
uniform vec3 u_yellow;
uniform vec3 u_red;
uniform vec3 u_blue;
uniform float u_off;
uniform vec2 u_skip;

void main() {
    float gapPx = 6.0;
    float slot = (u_size.x + gapPx) / u_n;
    float px = v_uv.x * u_size.x;
    float py = v_uv.y * u_size.y;
    float local = px;                               // px from where the fill starts
    if (u_skip.y > u_skip.x) {                      // wings: left from its left end, right mirrored from its right end
        if (px >= u_skip.x && px < u_skip.y) { gl_FragColor = vec4(0.0); return; }
        if (px < u_skip.x) slot = (u_skip.x + gapPx) / u_n;
        else { slot = (u_size.x - u_skip.y + gapPx) / u_n; local = u_size.x - px; }
    }
    float idx = floor(local / slot);
    float inSeg = local - idx * slot;
    float segW = slot - gapPx;
    if (inSeg > segW || idx >= u_n) { gl_FragColor = vec4(0.0); return; }
    vec2 hs = vec2(segW, u_size.y) * 0.5;
    vec2 p = vec2(inSeg, py) - hs;
    float r = u_round > 0.5 ? min(hs.x, hs.y) : min(4.0, hs.y);
    if (u_round > 0.5) hs = vec2(r);
    p = vec2(inSeg, py) - vec2(segW, u_size.y) * 0.5;
    vec2 q = abs(p) - (hs - vec2(r));
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    float cover = clamp(0.5 - d, 0.0, 1.0);
    float nMain = max(1.0, u_n - u_tail);
    float f = idx / max(1.0, nMain - 1.0);
    vec3 col = idx >= nMain ? u_blue : (f < 0.42 ? u_green : (f < 0.75 ? u_yellow : u_red));
    if (u_round > 1.5) {
        float b = mod(idx, 4.0);
        col = b < 0.5 ? u_red : (b < 1.5 ? u_green : (b < 2.5 ? u_yellow : u_blue));
    }
    bool on = idx < u_lit;
    if (u_strobe > 0.5) { col = u_red; on = true; }
    gl_FragColor = vec4(col, cover * (on ? 1.0 : u_off));
}
`;

const FILL = `// Solid fill for a cluster-render "effect" layer (GLSL ES 1.00): u_color everywhere, except a
// see-through rounded hole u_hole (x, y, w, h px from the layer's top left; w = 0: no hole), radius u_holeR.
// On the cluster, an opaque fill hides BMW's own gauges under it; the hole lets the map window show.
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_color;
uniform vec4 u_hole;
uniform float u_holeR;

void main() {
    vec2 p = vec2(v_uv.x * u_size.x, v_uv.y * u_size.y);
    float a = u_color.a;
    if (u_hole.z > 0.0) {
        vec2 hs = u_hole.zw * 0.5;
        vec2 q = abs(p - (u_hole.xy + hs)) - (hs - vec2(u_holeR));
        float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - u_holeR;
        a *= clamp(d + 0.5, 0.0, 1.0);
    }
    gl_FragColor = vec4(u_color.rgb, a);
}
`;

const BOX = `// Framed box for a cluster-render "effect" layer (GLSL ES 1.00), the race-dash readout box: a rounded
// frame u_border px wide in u_line, filled u_fill, with a header strip u_headH px tall in u_head across the
// top (0 = none). Colours rgba, straight alpha. u_size, u_border, u_headH, u_radius in px.
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_fill;
uniform vec4 u_line;
uniform vec4 u_head;
uniform float u_headH;
uniform float u_border;
uniform float u_radius;

void main() {
    vec2 p = vec2(v_uv.x * u_size.x, v_uv.y * u_size.y);
    vec2 hs = u_size * 0.5;
    vec2 q = abs(p - hs) - (hs - vec2(u_radius));
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - u_radius;   // < 0 inside
    float outer = clamp(0.5 - d, 0.0, 1.0);
    if (outer <= 0.0) { gl_FragColor = vec4(0.0); return; }
    vec4 c = p.y < u_headH ? u_head : u_fill;
    float edge = clamp(d + u_border + 0.5, 0.0, 1.0);                       // 1 within the frame
    vec4 col = mix(c, u_line, edge);
    gl_FragColor = vec4(col.rgb, col.a * outer);
}
`;

const BOXES = `// The GT3 race dash's frame in one cluster-render "effect" layer (GLSL ES 1.00): the background u_bg over the
// whole layer, a see-through rounded hole for BMW's map (u_hole x, y, w, h in layer px, already inset; w 0 = none;
// corner radius u_holeR) and up to 12 framed readout boxes from the layout: each a rounded frame in u_line, filled
// u_fill, with a header strip across its top in u_head (or u_accent). Array uniforms (sent with type vec4):
//   u_box[i]       x, y, w, h in layer px
//   u_boxStyle[i]  header height px, border px, corner radius px, header kind (0 u_head, 1 u_accent)
//   u_n            boxes in use (the rest are skipped). Boxes must not overlap each other or the hole.
// Colours rgba, straight alpha. The loop bound is constant and the arrays are indexed by the loop counter only,
// as GLSL ES 1.00 requires.
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_bg;
uniform vec4 u_hole;
uniform float u_holeR;
uniform float u_n;
uniform vec4 u_box[12];
uniform vec4 u_boxStyle[12];
uniform vec4 u_fill;
uniform vec4 u_line;
uniform vec4 u_head;
uniform vec4 u_accent;

// signed distance to the rounded rect r (x, y, w, h), radius rad; < 0 inside
float sdBox(vec2 p, vec4 r, float rad) {
    vec2 hs = r.zw * 0.5;
    vec2 q = abs(p - (r.xy + hs)) - (hs - vec2(rad));
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
}
vec4 over(vec4 top, vec4 under) {           // straight-alpha "top over under"
    float a = top.a + under.a * (1.0 - top.a);
    if (a <= 0.0) return vec4(0.0);
    return vec4((top.rgb * top.a + under.rgb * under.a * (1.0 - top.a)) / a, a);
}

void main() {
    vec2 p = v_uv * u_size;
    vec4 c = u_bg;
    if (u_hole.z > 0.0) c.a *= clamp(sdBox(p, u_hole, u_holeR) + 0.5, 0.0, 1.0);
    for (int i = 0; i < 12; i++) {
        if (float(i) >= u_n) break;
        vec4 b = u_box[i];
        vec4 s = u_boxStyle[i];
        if (p.x < b.x - 1.0 || p.x > b.x + b.z + 1.0 || p.y < b.y - 1.0 || p.y > b.y + b.w + 1.0) continue;
        float d = sdBox(p, b, s.z);
        float outer = clamp(0.5 - d, 0.0, 1.0);
        if (outer <= 0.0) continue;
        vec4 inner = p.y < b.y + s.x ? (s.w > 0.5 ? u_accent : u_head) : u_fill;
        float edge = clamp(d + s.y + 0.5, 0.0, 1.0);               // 1 within the frame
        vec4 col = mix(inner, u_line, edge);
        c = over(vec4(col.rgb, col.a * outer), c);
    }
    gl_FragColor = c;
}
`;

const GRID = `// Calibration grid for a cluster-render "effect" layer (GLSL ES 1.00): a line every u_step px, a brighter
// one every u_major steps, a frame round the edge. v_uv (0,0) is the top-left.
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform float u_step;
uniform float u_major;
uniform vec4 u_minor;
uniform vec4 u_majorC;

void main() {
    vec2 p = v_uv * u_size;
    vec2 m = mod(p, u_step);
    vec2 big = mod(p, u_step * u_major);
    bool edge = p.x < 2.0 || p.y < 2.0 || p.x > u_size.x - 2.0 || p.y > u_size.y - 2.0;
    if (edge || big.x < 2.0 || big.y < 2.0) gl_FragColor = u_majorC;
    else if (m.x < 1.0 || m.y < 1.0) gl_FragColor = u_minor;
    else gl_FragColor = vec4(0.0);
}
`;

const SEGBAR = `// Segmented level bar for a cluster-render "effect" layer (GLSL ES 1.00): u_segs segments, the first
// u_lit of them lit (brightening left to right), each slanted u_slant px. v_uv (0,0) is the top-left.
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform float u_segs;
uniform float u_lit;
uniform vec4 u_on;
uniform vec4 u_offC;
uniform float u_slant;

void main() {
    vec2 p = v_uv * u_size;
    float x = p.x - u_slant * (1.0 - v_uv.y);
    float gap = 8.0;
    float slot = (u_size.x - u_slant + gap) / u_segs;
    float i = floor(x / slot);
    float fx = x - i * slot;
    float a = clamp(fx + 0.5, 0.0, 1.0) * clamp(slot - gap - fx + 0.5, 0.0, 1.0);
    if (i < 0.0 || i >= u_segs || a <= 0.0) { gl_FragColor = vec4(0.0); return; }
    vec4 col = i < u_lit ? vec4(u_on.rgb * mix(0.72, 1.0, fx / (slot - gap)), u_on.a) : u_offC;
    gl_FragColor = vec4(col.rgb, col.a * a);
}
`;

const MDASH = `// The M theme's whole backdrop in one cluster-render "effect" layer (GLSL ES 1.00), traced off a photo of a current
// M8's cluster (design/photos/ref-m8-cluster.png, warped to 1920x720): black, with a near-black card either side whose
// inner edge follows the rev blade, whose top edge is the photo's curve and whose bottom outer corner is a big round;
// the centre line with its bright end caps, the tyre block's car glyph and dividers (the eight values are text widgets),
// the two side dials over the cards (the photo's thin glass bracket, hatched bezel, red level line), the tricolour mark
// and the four setup level bars (slanted segments, the one at the level red, the rest grey, as the M8 draws them).
// Positions in target px from the layout (hud.js). v_uv (0,0) is the top-left.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_card;      // left card: outer edge x, bottom y, bottom-outer corner radius, top-outer corner rounding (the right card is its mirror)
uniform vec3 u_cardCutR;  // the right card's lower outer corner, cut back on a circle (mirrored frame: cx, cy, r; r 0 = none): the M8's
                          // right card is cut further than its left one, so the oil dial's numbers sit on black
uniform vec3 u_cardTop;   // the left card's top edge, y = a x^2 + b x + c (traced off the M8 photo)
uniform float u_cardFill; // the card's grey level 0..1 (0 = black, outline only)
uniform vec4 u_blade;     // the left rev blade's outer edge: x at the bend, y of the bend, x per y px above / below it
uniform vec2 u_bladeB;    // the bend's roundness px, the card's gap from the blade px
uniform vec4 u_line;      // centre line x0, y, x1, cap length
uniform vec3 u_tyre;      // the tyre block's car glyph: centre x, y, scale (0 = none)
uniform vec4 u_gaugeL;    // left gauge centre x, y, radius, value 0..1
uniform vec4 u_gaugeR;    // right gauge
uniform vec3 u_mark;      // tricolour mark x, y, scale (0 = none)
uniform vec3 u_red;
uniform vec4 u_seg0;      // setup level bars x, y, w, h (a height of 0: none)
uniform vec4 u_seg1;
uniform vec4 u_seg2;
uniform vec4 u_seg3;
uniform vec4 u_segLit;    // the level per bar (1-based; 0 = none lit)
uniform vec4 u_segMax;    // segments per bar
uniform float u_segSlant; // px each segment leans
uniform vec4 u_hole;      // the map window x, y, w, h px, already inset (w 0 = none): cut see-through over the map
uniform float u_holeR;    // its corner radius px

const float PI = 3.14159265;

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec4 over(vec4 top, vec4 under) {
    float a = top.a + under.a * (1.0 - top.a);
    if (a <= 0.0) return vec4(0.0);
    return vec4((top.rgb * top.a + under.rgb * under.a * (1.0 - top.a)) / a, a);
}
float segD(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }

float sdRoundBox(vec2 p, vec4 r, float rad) {
    vec2 c = r.xy + r.zw * 0.5;
    vec2 q = abs(p - c) - r.zw * 0.5 + rad;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
}
float angOf(vec2 d) { float a = atan(d.x, -d.y); return a < 0.0 ? a + 2.0 * PI : a; }
// the left blade's outer edge x at y (mtach's curve)
float bladeX(float y) {
    float dy = y - u_blade.y;
    float k = dy < 0.0 ? u_blade.z : u_blade.w;
    return u_blade.x + k * (sqrt(dy * dy + u_bladeB.x * u_bladeB.x) - u_bladeB.x);
}
// smooth intersection of two signed distances (rounds the corner where they meet)
float smax(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (a - b) / k, 0.0, 1.0); return mix(b, a, h) + k * h * (1.0 - h); }
// the left card as the M8 draws it: a wedge whose top edge is the traced curve, outer edge at u_card.x, bottom at
// u_card.y, inner side along the blade; the bottom-outer corner is a big round (the fuel dial sits over it); < 0 inside
float cardD(vec2 p, float right) {
    float fx = u_cardTop.x * p.x * p.x + u_cardTop.y * p.x + u_cardTop.z;
    float slope = 2.0 * u_cardTop.x * p.x + u_cardTop.y;
    float dTop = (fx - p.y) / sqrt(1.0 + slope * slope);
    float dLeft = u_card.x - p.x;
    float dBot = p.y - u_card.y;
    float d = smax(dTop, dLeft, u_card.w);
    d = max(d, dBot);
    vec2 cc = vec2(u_card.x + u_card.z, u_card.y - u_card.z);
    if (p.x < cc.x && p.y > cc.y) d = max(d, length(p - cc) - u_card.z);
    d = max(d, p.x - (bladeX(p.y) - u_bladeB.y));
    if (right > 0.5 && u_cardCutR.z > 0.0) d = max(d, length(p - u_cardCutR.xy) - u_cardCutR.z);
    return d;
}
// the card: near-black (the panel brightens every dark tint, so the fill stays tiny), a shade lighter and bluer at
// the top, with a faint lighter rim
vec4 card(vec2 p, vec2 dial, float right, vec4 c) {
    float d = cardD(p, right);
    if (d > 2.0) return c;
    float top = u_cardTop.z - u_cardTop.y * u_cardTop.y / (4.0 * u_cardTop.x);   // the curve's lowest y (its vertex)
    float fy = clamp((p.y - top) / max(u_card.y - top, 1.0), 0.0, 1.0);
    float grey = u_cardFill * mix(1.3, 0.75, fy);
    c = over(vec4(vec3(grey, grey, grey * 1.18), cov(d)), c);
    // the rim stops inside the dial's area (as on the M8, where the dial covers the card's edge), so no label sits on it;
    // 118..130 px at the photo's dial size (r 120), scaled with the layout's
    float kd = u_gaugeL.z / 120.0;
    float hide = 1.0 - smoothstep(118.0 * kd, 130.0 * kd, length(p - dial));
    c = over(vec4(0.5, 0.53, 0.58, 0.3 * cov(abs(d + 1.2) - 0.9) * (1.0 - hide)), c);
    return c;
}
// the tyre block: the car seen from above (outline body, four wheels) between the four readouts,
// a divider under each front pair, a tick above and below the car
vec4 tyreBlock(vec2 p, vec4 c) {
    if (u_tyre.z <= 0.0) return c;
    vec2 q = (p - u_tyre.xy) / u_tyre.z;
    if (abs(q.x) > 80.0 || abs(q.y) > 70.0) return c;
    float body = abs(sdRoundBox(q, vec4(-11.0, -20.0, 22.0, 40.0), 7.0)) - 1.1;
    vec2 a = vec2(abs(q.x) - 13.5, abs(q.y) - 11.0);
    float wheel = max(abs(a.x) - 2.2, abs(a.y) - 4.5);
    float hl = min(segD(q, vec2(-68.0, 0.0), vec2(-28.0, 0.0)), segD(q, vec2(28.0, 0.0), vec2(68.0, 0.0))) - 0.9;
    float vt = min(segD(q, vec2(0.0, -62.0), vec2(0.0, -42.0)), segD(q, vec2(0.0, 42.0), vec2(0.0, 62.0))) - 0.9;
    c = over(vec4(0.72, 0.76, 0.82, cov(min(body, min(hl, vt)) * u_tyre.z)), c);
    c = over(vec4(0.36, 0.78, 0.42, cov(wheel * u_tyre.z)), c);
    return c;
}
// a setup level bar: s.y segments slanted, number lit (1-based) red, the rest grey
vec4 segbar(vec2 p, vec4 b, vec2 s, vec4 c) {
    if (b.w <= 0.0 || p.y < b.y - 1.0 || p.y > b.y + b.w + 1.0 || p.x < b.x - 1.0 || p.x > b.x + b.z + 1.0) return c;
    float fy = (p.y - b.y) / b.w;
    float x = p.x - b.x - u_segSlant * (1.0 - fy);
    float gap = 10.0;
    float slot = (b.z - u_segSlant + gap) / s.y;
    float i = floor(x / slot);
    float fx = x - i * slot;
    float a = clamp(fx + 0.5, 0.0, 1.0) * clamp(slot - gap - fx + 0.5, 0.0, 1.0) * clamp(p.y - b.y + 0.5, 0.0, 1.0) * clamp(b.y + b.w - p.y + 0.5, 0.0, 1.0);
    if (i < 0.0 || i >= s.y || a <= 0.0) return c;
    bool on = abs(i + 1.0 - s.x) < 0.5;
    vec3 col = on ? u_red * mix(0.85, 1.0, fx / (slot - gap)) : vec3(0.5, 0.53, 0.58);
    return over(vec4(col, (on ? 1.0 : 0.8) * a), c);
}

// a side dial as the M8 draws it, traced off the photo: not a round gauge but a tall thin bracket cut from big
// circles. The glass lies inside a circle of radius 120 round the anchor g.xy and outside one of radius 180 round
// (57, -68), so it is ~6 px wide at the top and widens to ~12 at the bottom end; a hatched chrome bezel (an arc between
// radii 113 and 124 round (-13, 11)) runs down its outer side. The level reads by height: the glass is lit from the
// bottom up to the level, a faint glass with a thin outline above it, and a crisp red line across the glass marks the
// level (Nov 14 2026 clean-up after car close-ups: the glowing streaks stuck out past the glass, the unlit glass was a
// sliver, the glass and the bezel ended on different cuts). Both end on the same lines: y -10 at the top, a ray from
// the bezel's centre at the bottom (fuel 75 degrees, through the glass's old end at x 14; oil 100, shorter), corners
// rounded 2 px. Units are the photo's px with g.z = 120 there. Drawn in the left frame; the right dial comes through
// the mirror.
float rIn(float a, float b, float r) {          // two "inside" distances (positive inside) intersected, corner rounded r
    return -(min(-r, max(-a, -b)) + length(max(vec2(r - a, r - b), 0.0)));
}
vec4 gauge(vec2 p, vec4 g, float zones, vec4 c) {
    float k = g.z / 120.0;
    vec2 q = (p - g.xy) / k;
    if (q.x < -140.0 || q.x > 70.0 || q.y < -22.0 || q.y > 140.0) return c;
    float v = clamp(g.w, 0.0, 1.0);
    // the shared end cuts: the top at y -10, the bottom along a ray from the bezel's centre
    vec2 qb = q - vec2(-13.0, 11.0);
    float ae = radians(zones > 0.5 ? 100.0 : 75.0);
    float ends = min(q.y + 10.0, dot(qb, vec2(-sin(ae), cos(ae))));            // positive on the dial's side of both cuts
    // the bezel: double-edged and hatched
    float rb = length(qb);
    float bez = rIn(min(rb - 112.5, 124.0 - rb), ends, 2.0);
    if (bez > -1.5) {
        float ab = atan(qb.y, qb.x);
        float hatch = step(0.5, fract(ab * 30.0));
        float edge = cov(abs(bez) * k - 0.8);
        c = over(vec4(0.8, 0.82, 0.88, min(1.0, cov(-bez * k) * (0.4 + 0.35 * hatch) + 0.7 * edge)), c);
    }
    // the glass
    float dOut = 120.0 - length(q);
    float dIn = length(q - vec2(57.0, -68.0)) - 180.0;
    float inside = rIn(min(dOut, dIn), ends, 2.0);
    if (inside > -1.5) {
        float f = clamp(dOut / max(dOut + max(dIn, 0.0), 1.0), 0.0, 1.0);        // 0 at the outer edge, 1 at the inner
        float yv = zones > 0.5 ? mix(97.0, 7.0, v) : mix(100.0, 2.0, v);
        float lit = clamp((q.y - yv) * k + 0.5, 0.0, 1.0);                        // below the level line
        vec4 dark = vec4(0.55, 0.57, 0.63, 0.16);
        vec4 bright = vec4(mix(vec3(0.96, 0.97, 0.99), vec3(0.55, 0.57, 0.63), f), mix(1.0, 0.55, f));
        vec4 glass = mix(dark, bright, lit);
        float a = cov(-inside * k);
        c = over(vec4(glass.rgb, glass.a * a), c);
        c = over(vec4(0.85, 0.87, 0.92, 0.45 * cov(abs(inside * k) - 0.6) * (1.0 - lit)), c);   // the unlit glass's outline
        c = over(vec4(u_red, a * cov(abs(q.y - yv) * k - 1.2)), c);                              // the level, inside the glass only
    }
    return c;
}

void main() {
    vec2 p = v_uv * u_size;
    vec2 pm = vec2(u_size.x - p.x, p.y);        // the right half, mirrored into the left frame
    vec4 c = vec4(0.0, 0.0, 0.0, 1.0);           // black, as the M8

    // the two cards: the left one as laid out, the right one its mirror
    c = card(p, u_gaugeL.xy, 0.0, c);
    c = card(pm, vec2(u_size.x - u_gaugeR.x, u_gaugeR.y), 1.0, c);

    // centre line, bright caps at both ends
    if (abs(p.y - u_line.y) < 6.0) {
        c = over(vec4(0.62, 0.66, 0.73, 0.8 * cov(segD(p, u_line.xy, u_line.zy) - 1.6)), c);
        float l = segD(p, u_line.xy + vec2(6.0, 0.0), u_line.xy + vec2(u_line.w, 0.0)) - 2.0 - 1.2 * clamp((p.x - u_line.x) / u_line.w, 0.0, 1.0);
        float r = segD(p, u_line.zy - vec2(u_line.w, 0.0), u_line.zy - vec2(6.0, 0.0)) - 2.0 - 1.2 * clamp((u_line.z - p.x) / u_line.w, 0.0, 1.0);
        c = over(vec4(0.95, 0.96, 0.98, cov(min(l, r))), c);
    }

    c = tyreBlock(p, c);

    // the side dials, traced off the M8 photo: the glass crescent, the fuel one as laid out, the oil one its mirror
    c = gauge(p, u_gaugeL, 0.0, c);
    c = gauge(pm, vec4(u_size.x - u_gaugeR.x, u_gaugeR.yzw), 1.0, c);

    c = segbar(p, u_seg0, vec2(u_segLit.x, u_segMax.x), c);
    c = segbar(p, u_seg1, vec2(u_segLit.y, u_segMax.y), c);
    c = segbar(p, u_seg2, vec2(u_segLit.z, u_segMax.z), c);
    c = segbar(p, u_seg3, vec2(u_segLit.w, u_segMax.w), c);

    // the map window between the rev blades ("Show Waze map inside the theme"): a rounded see-through hole
    if (u_hole.z > 0.0) {
        vec2 hs = u_hole.zw * 0.5;
        vec2 q = abs(p - (u_hole.xy + hs)) - (hs - vec2(u_holeR));
        float hd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - u_holeR;
        c.a *= clamp(hd + 0.5, 0.0, 1.0);
    }

    // tricolour mark: three slanted bars
    if (u_mark.z > 0.0) {
        vec2 m = (p - u_mark.xy) / u_mark.z;
        if (m.y > -1.0 && m.y < 21.0 && m.x > -2.0 && m.x < 60.0) {
            float lx = m.x - 7.0 * (1.0 - m.y / 20.0);
            float i = floor(lx / 16.0);
            float fx = lx - i * 16.0;
            float inside = cov((max(abs(fx - 6.5) - 6.5, abs(m.y - 10.0) - 10.0)) * u_mark.z);
            vec3 mc = i < 0.5 ? vec3(0.31, 0.71, 1.0) : (i < 1.5 ? vec3(0.17, 0.29, 0.78) : vec3(0.9, 0.13, 0.17));
            if (i >= 0.0 && i <= 2.0) c = over(vec4(mc, inside), c);
        }
    }
    gl_FragColor = c;
}
`;
const MTACH = `// The M theme's rev bar (GLSL ES 1.00), after the M8's: a bowed glass blade (the curve bends at u_geoA.z with a
// large roundness, so it reads as one arc), wide at 0 rpm and narrow at the top, with a bright silver outer
// edge and bright ticks running in from it every 1000 rpm. The part below the rpm is lit dim grey, a glowing red
// block rides the blade at the rpm (the M8's marker), an outlined grey foot block fills the bottom 20 px, orange dashes sit before
// the redline and a solid red line past it. Drawn as the left bar; u_side 1 mirrors it. v_uv (0,0) is the top-left.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform float u_side;
uniform vec4 u_geoA;      // y at 0 rpm, y at max, y of the bend, outer-edge x at the bend (layer px, left frame)
uniform vec3 u_geoB;      // slope above the bend, slope below it, bend roundness px
uniform vec3 u_wid;       // blade width at 0 rpm, at max, extra at the bend
uniform float u_ticks;    // max / 1000
uniform float u_value;    // 0..1
uniform float u_orange;   // 0..1, orange dashes from here
uniform float u_redFrom;  // 0..1, red dashes from here (the redline)
uniform float u_shiftNow;
uniform vec3 u_red;

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec4 over(vec4 top, vec4 under) {
    float a = top.a + under.a * (1.0 - top.a);
    if (a <= 0.0) return vec4(0.0);
    return vec4((top.rgb * top.a + under.rgb * under.a * (1.0 - top.a)) / a, a);
}
float segD(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }

void main() {
    vec2 p = v_uv * u_size;
    if (u_side > 0.0) p.x = u_size.x - p.x;
    float y0 = u_geoA.x, y8 = u_geoA.y, ym = u_geoA.z, xm = u_geoA.w;
    float dy = p.y - ym;
    float k = dy < 0.0 ? u_geoB.x : u_geoB.y;
    float sq = sqrt(dy * dy + u_geoB.z * u_geoB.z);
    float xo = xm + k * (sq - u_geoB.z);
    float slope = k * dy / sq;
    float d = (p.x - xo) / sqrt(1.0 + slope * slope);      // + = into the blade, towards the middle
    float t = (y0 - p.y) / (y0 - y8);
    float w = mix(u_wid.x, u_wid.y, clamp(t, 0.0, 1.0)) + u_wid.z * exp(-dy * dy / 22000.0);
    vec4 c = vec4(0.0);
    if (t >= 0.0 && t <= 1.0) {
        float inBand = clamp(d + 0.5, 0.0, 1.0) * clamp(w - d + 0.5, 0.0, 1.0);
        float across = clamp(d / w, 0.0, 1.0);
        float yn = y0 - u_value * (y0 - y8);
        vec4 g = vec4(0.62, 0.67, 0.74, mix(0.42, 0.06, across));          // empty glass (bright at the outer edge, as the M8's)
        if (p.y > yn) g = u_shiftNow > 0.5 ? vec4(u_red * 0.8, 0.6) : vec4(mix(vec3(0.86, 0.88, 0.92), vec3(0.6, 0.63, 0.68), across), mix(0.34, 0.22, across));
        // the foot: the bottom 20 px as an outlined grey block, as the M8 draws it
        if (p.y > y0 - 20.0) g = over(vec4(0.7, 0.72, 0.78, 0.22), g);
        g = over(vec4(0.9, 0.92, 0.95, 0.7 * cov(min(abs(p.y - (y0 - 19.0)), abs(p.y - (y0 - 1.5))) - 0.8)), g);
        // the marker: a red block at the rpm with a glow either side of it
        float dm = abs(p.y - yn);
        g = over(vec4(u_red, 0.5 * exp(-dm / 26.0)), g);
        g = over(vec4(mix(u_red, vec3(1.0, 0.45, 0.4), 0.35 * cov(dm - 5.0)), cov(dm - 14.0)), g);
        c = vec4(g.rgb, g.a * inBand);
        c = over(vec4(0.93, 0.95, 0.98, cov(abs(d) - 1.6)), c);               // outer edge
        c = over(vec4(1.0, 1.0, 1.0, 0.3 * cov(abs(d - 4.0) - 0.6)), c);       // its bevel
        c = over(vec4(0.66, 0.7, 0.76, 0.75 * cov(abs(d - w) - 0.8)), c);      // inner edge
        // BMW's marks: a solid red line from the redline, a few orange dashes in the run-up to it
        bool redM = t >= u_redFrom && d > 6.0 && d < 11.0;
        bool orM = t >= u_orange && t < u_redFrom - 0.01 && d > 6.0 && d < 11.0 && mod(p.y, 20.0) < 7.0;
        if (redM || orM) {
            c = over(vec4(redM ? u_red : vec3(1.0, 0.6, 0.1), 0.95), c);
        }
    }
    // ticks every 1000 rpm: bright, from the outer edge 24 px into the glass, as the M8 draws them
    float kk = floor(t * u_ticks + 0.5);
    float yk = y0 - kk / u_ticks * (y0 - y8);
    if (kk >= 0.0 && kk <= u_ticks && d > -2.0 && d < 24.0) {
        float ty = abs(p.y - yk) - 1.5;
        c = over(vec4(0.93, 0.95, 0.98, cov(ty)), c);
    }
    gl_FragColor = c;
}
`;
const SDASH = `// The Sport theme in one cluster-render "effect" layer (GLSL ES 1.00), after BMW's Live Cockpit Sport view:
// a blue speed bracket left and a red rev bracket right (the left one mirrored). Each is a thin bright outer
// line, a band that fills from the bottom (white marker at the value), a dark gap and a thin inner line round a
// black middle: plain black, or the map through a see-through rounded hole (u_hole; only the bottom strip draws
// over it, the fuel and oil bars are off while it is open). Two-tone fuel and oil bars inside the brackets, a blue / red strip at the bottom. v_uv (0,0) is
// the top-left. The backdrop is pure black: the car brightens dark tints (seen Nov 5 2026), so no dark panels.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_geo;       // outer line: y at the top, y at the bend, y at the bottom, x at the bend (left side)
uniform vec3 u_k;         // x per y px above the bend, below it, bend roundness px
uniform float u_w;        // band width
uniform float u_inner;    // the inner line's distance from the outer line
uniform vec2 u_scale;     // y of the scale's 0 and of its top mark
uniform vec2 u_ticks;     // marks left (speed), right (rpm)
uniform float u_speed;    // 0..1 along the scale
uniform float u_rpm;      // 0..1
uniform float u_redFrom;  // 0..1 (the redline)
uniform float u_orange;   // 0..1, yellow marks from here to the redline
uniform float u_fuel;     // 0..1
uniform float u_oil;      // 0..1
uniform vec4 u_fuelSeg;   // full end x, y, empty end x, y
uniform vec4 u_oilSeg;
uniform vec4 u_hole;      // map window x, y, w, h, already inset (w 0 = none)
uniform float u_holeR;    // the hole's corner radius px
uniform vec4 u_strip;     // bottom strip: left end x, top y, height, slant px
uniform float u_topEnd;   // the top lines run from the bracket to this x (left; mirrored on the right)
uniform vec4 u_road;      // the road in the middle (BMW's own Sport view draws one): horizon y, px scale, dash phase 0..1, on

const vec3 BLUE_LINE = vec3(0.36, 0.62, 1.0);
const vec3 BLUE_BAND = vec3(0.13, 0.3, 0.78);
const vec3 BLUE_LIT = vec3(0.62, 0.86, 1.0);
const vec3 BLUE_IN = vec3(0.2, 0.45, 0.98);
const vec3 RED_LINE = vec3(0.95, 0.12, 0.16);
const vec3 RED_BAND = vec3(0.33, 0.06, 0.1);
const vec3 RED_LIT = vec3(0.93, 0.1, 0.15);
const vec3 RED_IN = vec3(0.86, 0.08, 0.13);

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec4 over(vec4 top, vec4 under) {
    float a = top.a + under.a * (1.0 - top.a);
    if (a <= 0.0) return vec4(0.0);
    return vec4((top.rgb * top.a + under.rgb * under.a * (1.0 - top.a)) / a, a);
}
float segD(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float segH(vec2 p, vec2 a, vec2 b) { vec2 ba = b - a; return clamp(dot(p - a, ba) / dot(ba, ba), 0.0, 1.0); }

float outerX(float y) {
    float dy = y - u_geo.y;
    float k = dy < 0.0 ? u_k.x : u_k.y;
    return u_geo.w + k * (sqrt(dy * dy + u_k.z * u_k.z) - u_k.z);
}
float outerSlope(float y) {
    float dy = y - u_geo.y;
    float k = dy < 0.0 ? u_k.x : u_k.y;
    return k * dy / sqrt(dy * dy + u_k.z * u_k.z);
}
// px from the outer line, inwards (perpendicular)
float dIn(vec2 q) { return (q.x - outerX(q.y)) / sqrt(1.0 + outerSlope(q.y) * outerSlope(q.y)); }

// one bracket in the left frame (q mirrored for the right one)
vec4 bracket(vec2 q, float val, float redFrom, float orange, float ticks, vec3 line, vec3 band, vec3 lit, vec3 inner, vec4 c) {
    float d = dIn(q);
    float yTopI = u_geo.x + 8.0;                              // the inner line's top run
    float t = (u_scale.x - q.y) / (u_scale.x - u_scale.y);    // 0 at the scale's 0
    bool inY = q.y > u_geo.x + 5.0 && q.y < u_geo.z - 4.0;
    // the band: lit up to the value, white marker on top
    float inB = (inY ? 1.0 : 0.0) * cov(-(d - 5.0)) * cov(d - 5.0 - u_w);
    if (inB > 0.0) {
        vec3 col = band;
        float a = 0.96;
        if (t <= val) col = mix(lit, mix(lit, vec3(1.0), 0.25), clamp((d - 5.0) / u_w, 0.0, 1.0)) * mix(0.8, 1.0, clamp(t / max(val, 0.01), 0.0, 1.0));
        c = over(vec4(col, a * inB), c);
        float yv = u_scale.x - val * (u_scale.x - u_scale.y);
        if (val > 0.002) c = over(vec4(1.0, 1.0, 1.0, inB * cov(abs(q.y - yv) - 2.0)), c);
        // marks at every label, on the band's outer half
        float kk = floor(t * ticks + 0.5);
        float yk = u_scale.x - kk / ticks * (u_scale.x - u_scale.y);
        if (kk >= 0.0 && kk <= ticks && d > 7.0 && d < 19.0) c = over(vec4(line, 0.9 * cov(abs(q.y - yk) - 1.2)), c);
        // redline: yellow dashes, then a solid red line, on the outer edge of the band
        if (redFrom < 1.5 && d > 8.0 && d < 13.0) {
            if (t >= redFrom && t <= 1.02) c = over(vec4(1.0, 0.2, 0.2, 1.0), c);
            else if (t >= orange && t < redFrom && mod(q.y, 16.0) < 7.0) c = over(vec4(1.0, 0.85, 0.1, 1.0), c);
        }
    }
    // the outer line, its top run and its bottom run
    float o = inY || abs(q.y - u_geo.x) < 6.0 || abs(q.y - u_geo.z) < 6.0 ? cov(abs(d - 1.0) - 1.8) : 0.0;
    vec2 tl = vec2(outerX(u_geo.x), u_geo.x), bl = vec2(outerX(u_geo.z), u_geo.z);
    o = max(o, cov(segD(q, tl, vec2(u_topEnd, u_geo.x)) - 2.2));
    o = max(o, cov(segD(q, bl, bl + vec2(u_inner + 40.0, 0.0)) - 2.2));
    c = over(vec4(line, 0.35 * exp(-abs(d) / 5.0) * (inY ? 1.0 : 0.0) * step(d, 0.0)), c);
    c = over(vec4(line, o), c);
    // the inner line: down the bracket from its top run to the bottom
    float il = (q.y > yTopI && q.y < u_geo.z - 6.0) ? cov(abs(d - u_inner) - 1.6) : 0.0;
    float xi = outerX(yTopI) + u_inner * sqrt(1.0 + outerSlope(yTopI) * outerSlope(yTopI));
    il = max(il, cov(segD(q, vec2(xi, yTopI), vec2(u_topEnd - 14.0, yTopI)) - 1.6));
    c = over(vec4(inner, 0.95 * il), c);
    return c;
}

// a two-tone slanted bar from the empty end b to the full end a, with a thin rail beside it
vec4 bar(vec2 p, vec4 s, float val, float zones, vec4 c) {
    vec2 a = s.xy, b = s.zw;
    float h = 1.0 - segH(p, a, b);
    vec2 dir = normalize(a - b), nrm = vec2(-dir.y, dir.x);
    float side = dot(p - b, nrm);
    float along = segD(p, a, b);
    if (along > 26.0) return c;
    float body = cov(abs(side) - 7.0) * cov(segD(p, a, b) - 7.5);
    vec3 col = vec3(0.92, 0.94, 0.97);
    if (zones > 0.5 && h > 0.88) col = vec3(1.0, 0.2, 0.22);
    if (zones > 0.5 && h < 0.1) col = vec3(0.25, 0.5, 1.0);
    c = over(vec4(0.36, 0.38, 0.44, 0.9 * body), c);
    c = over(vec4(col, body * step(h, val) * step(0.001, val)), c);
    c = over(vec4(0.5, 0.52, 0.58, 0.8 * cov(abs(side + 12.0) - 1.0) * cov(segD(p, a, b) - 13.0)), c);
    return c;
}

void main() {
    vec2 p = v_uv * u_size;
    vec2 pm = vec2(u_size.x - p.x, p.y);
    vec4 c = vec4(0.0, 0.0, 0.0, 1.0);

    c = bracket(p, u_speed, 2.0, 2.0, u_ticks.x, BLUE_LINE, BLUE_BAND, BLUE_LIT, BLUE_IN, c);
    c = bracket(pm, u_rpm, u_redFrom, u_orange, u_ticks.y, RED_LINE, RED_BAND, RED_LIT, RED_IN, c);
    // the map window: a rounded hole cut out of the backdrop and brackets, so the map shows clean; the fuel and
    // oil bars come off while it is open (they ran across the map, car photos Nov 7 2026), the bottom strip stays
    if (u_hole.z > 0.0) {
        vec2 hs = u_hole.zw * 0.5;
        vec2 q = abs(p - (u_hole.xy + hs)) - (hs - vec2(u_holeR));
        float hd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - u_holeR;
        c.a *= clamp(hd + 0.5, 0.0, 1.0);
    } else {
        // the road while no map shows: a soft blue surface, solid outer lines and dashed lane lines in perspective
        // from the horizon to the bottom line; the dashes run towards the driver with the speed (u_road.z)
        if (u_road.w > 0.5 && p.y > u_road.x + 1.0 && p.y < u_geo.z - 3.0) {
            float dy = p.y - u_road.x;
            float xw = (p.x - u_size.x * 0.5) * u_road.y / dy;          // across, lanes 1 wide
            float px = dy / u_road.y;                                   // screen px per lane
            float fade = smoothstep(0.0, 70.0, dy) * (1.0 - smoothstep(-30.0, 0.0, p.y - u_geo.z + 3.0) * 0.5);
            c = over(vec4(0.16, 0.36, 0.95, 0.5 * fade * cov((abs(xw) - 1.75) * px) * mix(0.55, 1.0, dy / (u_geo.z - u_road.x))), c);
            float hw = 1.2 + dy * 0.012;                                // line half width px, wider nearer
            float edge = cov(abs(abs(xw) - 1.5) * px - hw);
            float dash = step(fract(u_road.y * 120.0 / dy + u_road.z), 0.5);
            float lane = cov(abs(abs(xw) - 0.5) * px - hw) * dash;
            c = over(vec4(0.85, 0.93, 1.0, fade * max(edge, lane)), c);
        }
        c = bar(p, u_fuelSeg, u_fuel, 0.0, c);
        c = bar(p, u_oilSeg, u_oil, 1.0, c);
    }
    // the bottom line between the brackets
    if (abs(p.y - u_geo.z) < 3.0 && abs(p.x - u_size.x * 0.5) < u_size.x * 0.5 - outerX(u_geo.z))
        c = over(vec4(mix(BLUE_LINE, RED_LINE, step(u_size.x * 0.5, p.x)) * 0.8, cov(abs(p.y - u_geo.z) - 1.2)), c);

    // bottom strip: slanted ends, blue left of the middle, red right, thin dividers
    float sy = p.y - u_strip.y;
    if (sy > -2.0 && sy < u_strip.z + 2.0) {
        float xl = u_strip.x + (u_strip.z - sy) / u_strip.z * u_strip.w;     // left end leans in at the top
        float dx = abs(p.x - u_size.x * 0.5), xe = u_size.x * 0.5 - xl;
        float inside = cov(dx - xe) * cov(-sy) * cov(sy - u_strip.z);
        float f = dx / xe;
        vec3 sc = p.x < u_size.x * 0.5 ? mix(vec3(0.06, 0.2, 0.62), vec3(0.15, 0.36, 0.92), f) : mix(vec3(0.4, 0.05, 0.1), vec3(0.85, 0.1, 0.16), f);
        c = over(vec4(sc, 0.95 * inside), c);
        float div = cov(abs(mod(p.x - (u_strip.z - sy) * 0.45, 150.0) - 75.0) - 73.8);
        c = over(vec4(0.02, 0.03, 0.08, 0.5 * inside * div), c);
        c = over(vec4(1.0, 1.0, 1.0, 0.25 * inside * cov(abs(sy) - 1.0)), c);
    }
    gl_FragColor = c;
}
`;


const ATEXT = `// Atlas text for a cluster-render "effect" layer (GLSL ES 1.00): u_cells equal cells across the layer, each
// showing one glyph of the R8 glyph atlas bound to u_font (u_grid.x columns by u_grid.y rows of cells), picked
// by the codes in u_text (32 codes, 4 to a vec4; below 0 = empty). A new value is one uniform message, no
// pixels. After robertnisipeanu/idrive-apps js/showcase.js (TEXT_FS). v_uv (0,0) is the top-left.
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_font;
uniform vec4 u_text[8];
uniform float u_cells;
uniform vec2 u_grid;
uniform vec4 u_color;

float code(float cell) {
    float slot = floor(cell / 4.0), lane = cell - slot * 4.0;
    vec4 v = u_text[0];
    for (int i = 1; i < 8; i++) if (float(i) == slot) v = u_text[i];
    return lane < 0.5 ? v.x : lane < 1.5 ? v.y : lane < 2.5 ? v.z : v.w;
}

void main() {
    float x = v_uv.x * u_cells;
    float c = code(floor(x));
    float col = mod(c, u_grid.x), row = floor(c / u_grid.x);
    vec2 uv = vec2((col + fract(x)) / u_grid.x, (row + v_uv.y) / u_grid.y);
    float ink = c < 0.0 ? 0.0 : texture2D(u_font, uv).r;
    gl_FragColor = vec4(u_color.rgb, u_color.a * ink);
}
`;

const METER = `// A segmented bar meter for a cluster-render "effect" layer (GLSL ES 1.00): u_segs segments along the layer's
// width (or its height when u_vertical is 1, filling upward), the first u_value of the way lit. A lit segment takes
// u_c1 below u_at.x of the bar, u_c2 up to u_at.y, u_c3 from there (the retro green / amber / red, or warm-up blue /
// white / red); unlit ones u_track. u_peak 0..1 lights the segment it falls in u_peakC (below 0: none). u_gap px
// between segments. v_uv (0,0) is the top-left.
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform float u_value;
uniform float u_segs;
uniform float u_gap;
uniform float u_vertical;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec2 u_at;
uniform vec4 u_track;
uniform float u_peak;
uniform vec3 u_peakC;

void main() {
    vec2 p = v_uv * u_size;
    float len = u_vertical > 0.5 ? u_size.y : u_size.x;
    float x = u_vertical > 0.5 ? u_size.y - p.y : p.x;
    float slot = (len + u_gap) / u_segs;
    float i = floor(x / slot);
    float fx = x - i * slot;
    float a = clamp(fx + 0.5, 0.0, 1.0) * clamp(slot - u_gap - fx + 0.5, 0.0, 1.0);
    if (i < 0.0 || i >= u_segs || a <= 0.0) { gl_FragColor = vec4(0.0); return; }
    float f = (i + 0.5) / u_segs;
    vec3 c = f < u_at.x ? u_c1 : (f < u_at.y ? u_c2 : u_c3);
    float lit = (i + 0.5) / u_segs <= u_value + 0.5 / u_segs ? 1.0 : 0.0;
    if (u_value <= 0.0) lit = 0.0;
    if (u_peak >= 0.0 && i == floor(min(u_peak, 0.9999) * u_segs) && lit < 0.5) { gl_FragColor = vec4(u_peakC, a); return; }
    if (lit > 0.5) gl_FragColor = vec4(c, a);
    else gl_FragColor = vec4(u_track.rgb, u_track.a * a);
}
`;

const GMETER = `// A G-meter for a cluster-render "effect" layer (GLSL ES 1.00): a bezel with ticks every 30 degrees, rings every
// u_geo.w g out to u_geo.z (each 0.5 g a little brighter), a crosshair, the grip envelope (the furthest g reached in
// each of 48 directions, as an outline round a faint fill), a fading trail of the last moments, and the dot,
// white (u_c1), then amber from 0.5 g, then red (u_c3) from 0.8 g (pinned to the bezel past u_geo.z). Positions in g
// as drawn: + x right, + y down (hud.js maps the car's signs).
// 14 uniform vectors (HUD rule: 20 at most; it was 32 before Nov 13 2026): scalars packed into vec4s, the amber and
// its two thresholds are constants here, and the envelope is an R8 asset instead of 12 vec4s:
//   u_geo       layer w, h px, range u_max g, ring step g
//   u_dot       the dot's g (x, y), trail points in use (0..16), envelope on (0 / 1)
//   u_trail[i]  two trail points (x, y, x, y), newest first (sent with type vec4)
//   u_env       64 x 1 R8 asset: texel k (0..47) = sector k's radius / u_max, sector k centred on k * 7.5 degrees
//               counter-clockwise from + x; read at texel centres, so nearest or bilinear sampling reads the same
// The loops have constant bounds and the arrays are indexed by the loop counter only, as GLSL ES 1.00 requires.
// The dial fills the smaller side of the layer. v_uv (0,0) is the top-left.
precision mediump float;
varying vec2 v_uv;
uniform vec4 u_geo;
uniform vec4 u_dot;
uniform vec4 u_line;
uniform vec3 u_c1;
uniform vec3 u_c3;
uniform vec3 u_envC;
uniform vec4 u_trail[8];
uniform sampler2D u_env;

const float TAU = 6.2831853;
const vec3 AMBER = vec3(1.0, 0.6901961, 0.1568627);      // [255, 176, 40]: the dot between 0.5 and 0.8 g
const vec2 AT = vec2(0.5, 0.8);                           // amber from, red from (g)

float envAt(float k) {
    return texture2D(u_env, vec2((k + 0.5) / 64.0, 0.5)).r * u_geo.z;
}
vec2 trailAt(float j) {
    float slot = floor(j / 2.0);
    vec4 v = u_trail[0];
    for (int i = 1; i < 8; i++) if (float(i) == slot) v = u_trail[i];
    return j - slot * 2.0 < 0.5 ? v.xy : v.zw;
}
vec3 heat(float g) {
    vec3 c = mix(u_c1, AMBER, smoothstep(AT.x - 0.1, AT.x, g));
    return mix(c, u_c3, smoothstep(AT.y - 0.08, AT.y, g));
}
vec4 over(vec4 top, vec4 under) {
    float a = top.a + under.a * (1.0 - top.a);
    if (a <= 0.0) return vec4(0.0);
    return vec4((top.rgb * top.a + under.rgb * under.a * (1.0 - top.a)) / a, a);
}

void main() {
    vec2 size = u_geo.xy;
    float u_max = u_geo.z, u_step = u_geo.w;
    vec2 p = vec2(v_uv.x - 0.5, 0.5 - v_uv.y) * size;     // px from the centre, +y up
    float R = min(size.x, size.y) * 0.5 - 2.0;
    float d = length(p);
    if (d > R + 1.5) { gl_FragColor = vec4(0.0); return; }
    float k = (R - 5.0) / u_max;                           // px per g (the scale ends inside the bezel)
    vec4 col = vec4(0.0);
    // the bezel and its ticks (longer at 12, 3, 6 and 9 o'clock)
    float bez = clamp(1.8 - abs(d - (R - 1.0)), 0.0, 1.0);
    float ang = atan(p.y, p.x);
    float t30 = abs(fract(ang / (TAU / 12.0) + 0.5) - 0.5) * (TAU / 12.0) * d;   // px from the nearest tick line
    float t90 = abs(fract(ang / (TAU / 4.0) + 0.5) - 0.5) * (TAU / 4.0) * d;
    float tick = d > R - 9.0 ? clamp(1.3 - t30, 0.0, 1.0) * 0.8 : 0.0;
    if (d > R - 15.0) tick = max(tick, clamp(1.6 - t90, 0.0, 1.0));
    col = vec4(u_line.rgb, u_line.a * max(bez, tick));
    // rings every u_step g; the 0.5 g ones brighter
    for (int i = 1; i <= 10; i++) {
        float g = float(i) * u_step;
        if (g > u_max - 0.01) break;
        float half_ = abs(fract(g / 0.5 + 0.5) - 0.5) < 0.01 ? 1.0 : 0.0;
        float c = clamp(1.0 - abs(d - g * k), 0.0, 1.0) * (half_ > 0.5 ? 0.7 : 0.38);
        col = max(col, vec4(u_line.rgb, u_line.a * c));
    }
    // the crosshair, with a gap round the centre
    float cx = clamp(1.2 - abs(p.x), 0.0, 1.0), cy = clamp(1.2 - abs(p.y), 0.0, 1.0);
    if (d > 6.0) col = max(col, vec4(u_line.rgb, u_line.a * 0.4 * max(cx, cy)));
    // the grip envelope: radius between the two nearest sectors
    if (u_dot.w > 0.5) {
        float f = fract(ang / TAU + 1.0) * 48.0;
        float k0 = floor(f), k1 = k0 + 1.0;
        if (k1 > 47.5) k1 = 0.0;
        float r0 = envAt(k0), r1 = envAt(k1);          // stored capped at u_max
        if (r0 > 0.04 || r1 > 0.04) {
            // a direction not reached yet is 0 g, so the outline runs in towards the centre there (a radar
            // chart); the distance is divided by the slope so the steep parts keep their width
            float re = mix(r0, r1, f - k0) * k;
            float slope = (r1 - r0) * k * 48.0 / TAU / max(d, 1.0);
            float dist = abs(d - re) / sqrt(1.0 + slope * slope);
            float edge = clamp(1.4 - dist, 0.0, 1.0) * 0.9;
            float fill = clamp(re - d + 0.5, 0.0, 1.0) * 0.10;
            col = over(vec4(u_envC, max(edge, fill)), col);
        }
    }
    // the trail: fading, thinning segments from the dot back
    float tA = 0.0;
    for (int j = 0; j < 15; j++) {
        float fj = float(j);
        if (fj + 1.0 >= u_dot.z) break;
        vec2 a = clamp(trailAt(fj), vec2(-u_max), vec2(u_max)) * vec2(k, -k);
        vec2 b = clamp(trailAt(fj + 1.0), vec2(-u_max), vec2(u_max)) * vec2(k, -k);
        vec2 ab = b - a;
        float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.001), 0.0, 1.0);
        float dd = length(p - a - ab * h);
        float age = (fj + h) / 15.0;
        float wdt = mix(3.2, 0.8, age);
        tA = max(tA, clamp(wdt - dd, 0.0, 1.0) * mix(0.85, 0.08, age));
    }
    vec2 g = u_dot.xy;
    float gm = length(g);
    if (tA > 0.0) col = over(vec4(heat(gm), tA), col);
    // the dot with a soft glow, pinned to the bezel past u_max
    if (gm > u_max) g = g * (u_max / gm);
    vec2 dp = g * vec2(k, -k);
    float dd = length(p - dp);
    vec3 dc = heat(gm);
    float glow = clamp(1.0 - (dd - 7.0) / 13.0, 0.0, 1.0) * 0.4;
    float dt = clamp(8.0 - dd, 0.0, 1.0);
    col = over(vec4(dc, glow), col);
    col = over(vec4(mix(dc, vec3(1.0), clamp(3.5 - dd, 0.0, 1.0) * 0.6), dt), col);
    gl_FragColor = col;
}
`;

const REVARC = `// A segmented rev arc for a cluster-render "effect" layer (GLSL ES 1.00), the Rally theme's: a band from u_r - u_w
// to u_r round u_center (layer px, y down), from u_start sweeping u_sweep (radians, clockwise from 12 o'clock), in
// u_segs segments, the first u_value of it lit: u_low below u_midAt, u_mid up to u_highAt, u_high past it;
// unlit u_track. u_flash 1: everything lit flashes white (at the redline). v_uv (0,0) is the top-left.
// u_wing > 0: driver camera wings: the middle 2 x u_wing radians stay empty and u_segs segments sit on each side,
// mirrored, filling from the two ends in towards the middle.
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec2 u_center;
uniform float u_r;
uniform float u_w;
uniform float u_start;
uniform float u_sweep;
uniform float u_segs;
uniform float u_value;
uniform vec3 u_low;
uniform vec3 u_mid;
uniform vec3 u_high;
uniform float u_midAt;
uniform float u_highAt;
uniform vec4 u_track;
uniform float u_flash;
uniform float u_wing;

const float PI = 3.14159265359;

void main() {
    vec2 d = v_uv * u_size - u_center;
    float rr = length(d);
    float inner = u_r - u_w;
    float edge = clamp(rr - inner + 0.5, 0.0, 1.0) * clamp(u_r - rr + 0.5, 0.0, 1.0);
    if (edge <= 0.0) { gl_FragColor = vec4(0.0); return; }
    float a = atan(d.x, -d.y);                      // clockwise from 12 o'clock
    float rel = mod(a - u_start + 4.0 * PI, 2.0 * PI);
    if (rel > u_sweep) { gl_FragColor = vec4(0.0); return; }
    float slot = u_sweep / u_segs;
    if (u_wing > 0.0) {
        float mid = u_sweep * 0.5;
        if (abs(rel - mid) < u_wing) { gl_FragColor = vec4(0.0); return; }
        if (rel > mid) rel = u_sweep - rel;         // the right wing, mirrored
        slot = (mid - u_wing) / u_segs;
    }
    float i = floor(rel / slot);
    float gap = 5.0 / rr;                           // a 5 px gap between segments at this radius
    float fx = rel - i * slot;
    float a1 = clamp((fx) * rr + 0.5, 0.0, 1.0) * clamp((slot - gap - fx) * rr + 0.5, 0.0, 1.0);
    float fc = (i + 0.5) / u_segs;
    vec3 c = fc < u_midAt ? u_low : (fc < u_highAt ? u_mid : u_high);
    bool lit = u_value > 0.0 && fc <= u_value + 0.5 / u_segs;
    if (lit && u_flash > 0.5) c = vec3(1.0);
    if (lit) gl_FragColor = vec4(c, edge * a1);
    else gl_FragColor = vec4(u_track.rgb, u_track.a * edge * a1);
}
`;

const TILES = `// The Dyno theme's tiles in one cluster-render "effect" layer (GLSL ES 1.00): the background u_bg and up to 14
// rounded readout tiles, each filled u_fill (u_warn while its readout is over its warning limit), framed u_line,
// with a thin u_accent strip along the top and an optional bar along the bottom: track u_track, lit from the left
// to the tile's value, coloured by where along the bar it is (u_c1 below u_at.x, u_c2 to u_at.y, u_c3 past it) or
// all u_c1 for a plain bar. Array uniforms (sent with type vec4):
//   u_tile[i]   x, y, w, h in layer px
//   u_tileV[i]  bar value 0..1 (< 0: no bar), warning (0 / 1), zoned bar (0 / 1), unused
//   u_n         tiles in use. u_geo: corner radius, border px, accent strip px, bar height px.
// Colours rgba (fills) or rgb, straight alpha. The loop bound is constant and the arrays are indexed by the loop
// counter only, as GLSL ES 1.00 requires. v_uv (0,0) is the top-left.
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_bg;
uniform float u_n;
uniform vec4 u_tile[14];
uniform vec4 u_tileV[14];
uniform vec4 u_geo;
uniform vec4 u_fill;
uniform vec4 u_warn;
uniform vec4 u_line;
uniform vec4 u_track;
uniform vec3 u_accent;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec2 u_at;

float sdBox(vec2 p, vec4 r, float rad) {
    vec2 hs = r.zw * 0.5;
    vec2 q = abs(p - (r.xy + hs)) - (hs - vec2(rad));
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
}
vec4 over(vec4 top, vec4 under) {
    float a = top.a + under.a * (1.0 - top.a);
    if (a <= 0.0) return vec4(0.0);
    return vec4((top.rgb * top.a + under.rgb * under.a * (1.0 - top.a)) / a, a);
}

void main() {
    vec2 p = v_uv * u_size;
    vec4 c = u_bg;
    for (int i = 0; i < 14; i++) {
        if (float(i) >= u_n) break;
        vec4 b = u_tile[i];
        if (p.x < b.x - 1.0 || p.x > b.x + b.z + 1.0 || p.y < b.y - 1.0 || p.y > b.y + b.w + 1.0) continue;
        vec4 v = u_tileV[i];
        float d = sdBox(p, b, u_geo.x);
        float outer = clamp(0.5 - d, 0.0, 1.0);
        if (outer <= 0.0) continue;
        vec4 col = v.y > 0.5 ? u_warn : u_fill;
        // the accent strip along the top, inside the frame
        if (p.y < b.y + u_geo.z + u_geo.y) col = vec4(v.y > 0.5 ? vec3(1.0) : u_accent, 1.0);
        // the bar: inset 16 px a side, its bottom 12 px over the tile's
        if (v.x >= 0.0) {
            float bx0 = b.x + 16.0, bw = b.z - 32.0, by1 = b.y + b.w - 12.0, by0 = by1 - u_geo.w;
            if (p.x >= bx0 && p.x <= bx0 + bw && p.y >= by0 && p.y <= by1) {
                float f = (p.x - bx0) / bw;
                vec3 lit = v.z > 0.5 ? (f < u_at.x ? u_c1 : (f < u_at.y ? u_c2 : u_c3)) : u_c1;
                if (v.y > 0.5) lit = vec3(1.0);
                col = f <= v.x ? vec4(lit, 1.0) : over(u_track, col);
            }
        }
        float edge = clamp(d + u_geo.y + 0.5, 0.0, 1.0);
        col = mix(col, v.y > 0.5 ? vec4(1.0, 1.0, 1.0, 0.85) : u_line, edge);
        c = over(vec4(col.rgb, col.a * outer), c);
    }
    gl_FragColor = c;
}
`;

const RIBBON = `// The Ribbon theme's rev line (GLSL ES 1.00): one smooth curve under the hood line that fills with the revs, glowing.
// In panel px (y down; u_org is the layer's top-left on the panel): y(x) = a u^2 + b u + c + dip (1 - u^2), u = (x - cx) / half,
// u_curve (a, b, c, dip), u_span (x0, x1, cx, half). dip > 0 (the driver camera setting) lowers the middle under the camera
// and keeps the ends. Lit from x0 up to u_value of the span, coloured by the five-stop gradient u_c0..u_c4 (u_at: where
// stops 1..4 sit, 0..1), with a soft glow; unlit u_track. Under it u_n + 1 dots at every thousand rpm (the last two in
// u_red). u_bulbs 1: a string of Christmas bulbs on a wire (u_wire) instead, every 40 px, cycling u_c0..u_c3, the ones
// past u_at.z in u_red, lit up to u_value. u_flash 1: everything lit in u_red (at the redline).
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec2 u_org;
uniform vec4 u_curve;
uniform vec4 u_span;
uniform float u_value;
uniform float u_flash;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_c4;
uniform vec4 u_at;
uniform vec4 u_track;
uniform vec3 u_dot;
uniform vec3 u_red;
uniform vec3 u_wire;
uniform float u_n;
uniform float u_bulbs;

float cy(float x) {
    float u = (x - u_span.z) / u_span.w;
    return u_curve.x * u * u + u_curve.y * u + u_curve.z + u_curve.w * (1.0 - u * u);
}
// distance from p to the curve between x0 and x1 (round ends)
float dist(vec2 p, float x0, float x1) {
    float x = clamp(p.x, x0, x1);
    if (x != p.x) return length(p - vec2(x, cy(x)));
    float u = (x - u_span.z) / u_span.w;
    float s = (2.0 * (u_curve.x - u_curve.w) * u + u_curve.y) / u_span.w;
    return abs(p.y - cy(x)) / sqrt(1.0 + s * s);
}
vec3 grad(float t) {
    if (t < u_at.x) return mix(u_c0, u_c1, t / u_at.x);
    if (t < u_at.y) return mix(u_c1, u_c2, (t - u_at.x) / (u_at.y - u_at.x));
    if (t < u_at.z) return mix(u_c2, u_c3, (t - u_at.y) / (u_at.z - u_at.y));
    return mix(u_c3, u_c4, clamp((t - u_at.z) / (u_at.w - u_at.z), 0.0, 1.0));
}
vec4 over(vec4 dst, vec3 c, float a) { return vec4(mix(dst.rgb, c, a), a + dst.a * (1.0 - a)); }

void main() {
    vec2 p = v_uv * u_size + u_org;
    float x0 = u_span.x, x1 = u_span.y, len = x1 - x0;
    float xe = x0 + u_value * len;
    vec4 o = vec4(0.0);
    // thousand dots under the line
    float k = floor((p.x - x0) / len * u_n + 0.5);
    if (k >= 0.0 && k <= u_n) {
        float xk = x0 + k / u_n * len;
        float dd = length(p - vec2(xk, cy(xk) + 28.0));
        o = over(o, k >= u_n - 1.0 ? u_red : u_dot, clamp(3.5 - dd, 0.0, 1.0));
    }
    if (u_bulbs > 0.5) {
        o = over(o, u_wire, clamp(2.5 - dist(p, x0, x1), 0.0, 1.0));
        float j = floor((p.x - x0) / 40.0 + 0.5), bx = x0 + j * 40.0;
        if (j >= 0.0 && bx <= x1) {
            float f = (bx - x0) / len, by = cy(bx);
            bool on = u_value > 0.0 && f <= u_value;
            vec3 c = j - 4.0 * floor(j / 4.0) < 0.5 ? u_c0 : (j - 4.0 * floor(j / 4.0) < 1.5 ? u_c1 : (j - 4.0 * floor(j / 4.0) < 2.5 ? u_c2 : u_c3));
            if (f > u_at.z || u_flash > 0.5) c = u_red;
            vec2 q = p - vec2(bx, by + 12.0);
            if (on) o = over(o, c, 0.5 * exp(-dot(q, q) / 98.0));
            if (abs(q.x) < 4.0 && p.y >= by && p.y <= by + 5.0) o = over(o, vec3(0.29, 0.35, 0.31), 1.0);
            float e = length(q / vec2(6.0, 9.0));
            o = over(o, on ? c : u_track.rgb, clamp((1.0 - e) * 6.0, 0.0, 1.0));
        }
        gl_FragColor = o;
        return;
    }
    // the track, then the glow and the lit core up to xe
    o = over(o, u_track.rgb, u_track.a * clamp(7.5 - dist(p, x0, x1), 0.0, 1.0));
    if (u_value > 0.0) {
        float dl = dist(p, x0, xe);
        vec3 c = u_flash > 0.5 ? u_red : grad(clamp((p.x - x0) / len, 0.0, u_value));
        o = over(o, c, 0.55 * exp(-dl * dl / 242.0));
        o = over(o, c, clamp(5.5 - dl, 0.0, 1.0));
    }
    gl_FragColor = o;
}
`;

const DECO = `// The Ribbon theme's backdrop (GLSL ES 1.00), one whole-panel layer: u_bg everywhere (it covers BMW's gauges), the
// gear's rounded frame u_pill (x, y, w, h; 2 px in u_pc), and a holiday's art by u_mode, all static, no loops:
//   1 snow (white flakes), 2 unused (was Halloween), 3 Fourth of July (three
//   fireworks: u_a, u_b, u_c), 4 New Year (bubbles in u_a, confetti u_a / u_b / u_c), 5 Thanksgiving (leaves u_a,
//   u_b, u_c). Flakes, bubbles, confetti and leaves sit in a grid of cells (one each at most, placed by a hash); one
//   whose centre is within its size of the u_k0..u_k3 rects (x0, y0, x1, y1: the readouts and BMW's gear box) or of
//   BMW's bottom strip (y 660) is left out whole. Leaves also stay below the rev line (y 215).
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform float u_mode;
uniform vec4 u_bg;
uniform vec3 u_a;
uniform vec3 u_b;
uniform vec3 u_c;
uniform vec4 u_pill;
uniform vec3 u_pc;
uniform vec4 u_k0;
uniform vec4 u_k1;
uniform vec4 u_k2;
uniform vec4 u_k3;

float h1(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
bool inR(vec2 p, vec4 r, float m) { return p.x > r.x - m && p.x < r.z + m && p.y > r.y - m && p.y < r.w + m; }
bool keep(vec2 c, float m) { return inR(c, u_k0, m) || inR(c, u_k1, m) || inR(c, u_k2, m) || inR(c, u_k3, m) || c.y > 660.0 - m; }
// one firework burst at c, radius r: 28 rays from 0.25 r out to 0.8..1.05 r, a dot at each tip, a faint glow
float burst(vec2 p, vec2 c, float r) {
    vec2 d = p - c;
    float rr = length(d), st = 6.2831853 / 28.0;
    float i = floor(atan(d.y, d.x) / st + 0.5);
    float tip = r * (0.8 + 0.25 * h1(vec2(i, r)));
    float a = 0.0;
    if (rr > 0.25 * r && rr < tip) a = 0.45 * clamp(1.6 - abs(atan(d.y, d.x) - i * st) * rr, 0.0, 1.0);
    vec2 t = c + tip * vec2(cos(i * st), sin(i * st)) + vec2(0.0, 4.0);
    a = max(a, 0.6 * clamp(2.9 - length(p - t), 0.0, 1.0));
    return max(a, 0.08 * exp(-rr * rr / (0.18 * r * r)));
}

void main() {
    vec2 p = v_uv * u_size;
    vec3 col = u_bg.rgb;
    if (u_mode > 0.5 && u_mode < 1.5) {                              // snow
        vec2 cell = floor(p / 48.0), f = p - cell * 48.0;
        float h = h1(cell), r = 1.0 + 2.2 * h1(cell + 7.0);
        vec2 c = 6.0 + 36.0 * vec2(h1(cell + 3.0), h1(cell + 5.0));
        if (h < 0.45 && !keep(cell * 48.0 + c, r)) col = mix(col, vec3(1.0), (0.25 + 0.5 * h1(cell + 9.0)) * clamp(r + 0.5 - length(f - c), 0.0, 1.0));
    } else if (u_mode > 2.5 && u_mode < 3.5) {                       // Fourth of July
        col = mix(col, u_a, burst(p, vec2(250.0, 470.0), 110.0));
        col = mix(col, u_b, burst(p, vec2(1760.0, 500.0), 100.0));
        col = mix(col, u_c, burst(p, vec2(1500.0, 560.0), 60.0));
    } else if (u_mode > 3.5 && u_mode < 4.5) {                       // New Year: bubbles and confetti
        vec2 cell = floor(p / 64.0), f = p - cell * 64.0;
        float r = 2.0 + 6.0 * h1(cell + 2.0);
        vec2 c = 10.0 + 44.0 * vec2(h1(cell + 3.0), h1(cell + 4.0));
        if (h1(cell) < 0.45 && !keep(cell * 64.0 + c, r + 2.0)) col = mix(col, u_a, (0.2 + 0.35 * h1(cell + 6.0)) * clamp(1.2 - abs(length(f - c) - r), 0.0, 1.0));
        vec2 cl = floor((p + 31.0) / 70.0), cc = cl * 70.0 - 31.0 + 10.0 + 50.0 * vec2(h1(cl + 8.0), h1(cl + 1.0)), g = p - cc;
        float an = 3.14159 * h1(cl + 5.0), ca = cos(an), sa = sin(an);
        vec2 q = vec2(ca * g.x + sa * g.y, -sa * g.x + ca * g.y);
        float pick = h1(cl + 11.0);
        if (h1(cl + 12.0) < 0.5 && !keep(cc, 6.0) && abs(q.x) < 2.0 && abs(q.y) < 5.0)
            col = mix(col, pick < 0.34 ? u_a : (pick < 0.67 ? u_b : u_c), 0.35 + 0.3 * h1(cl + 13.0));
    } else if (u_mode > 4.5 && u_mode < 5.5) {                       // Thanksgiving: maple leaves (five pointed lobes)
        vec2 lc = floor(p / 120.0) * 120.0 + 60.0 + 30.0 * vec2(h1(floor(p / 120.0) + 1.0) - 0.5, h1(floor(p / 120.0) + 2.0) - 0.5);
        vec2 cell = floor(p / 120.0), f = p - lc;
        float sz = 18.0 + 16.0 * h1(cell + 3.0), th = atan(f.y, f.x) + 6.2831853 * h1(cell + 4.0);
        float edge = sz * (0.55 + 0.45 * pow(abs(cos(2.5 * th)), 1.6)) * (1.0 - 0.18 * pow(abs(sin(7.5 * th)), 8.0));
        float pick = h1(cell + 5.0);
        if (h1(cell) < 0.5 && lc.y > 215.0 && !keep(lc, sz)) col = mix(col, pick < 0.34 ? u_a : (pick < 0.67 ? u_b : u_c), 0.5 * clamp(edge - length(f), 0.0, 1.0));
    }
    // the gear's frame
    vec2 hs = u_pill.zw * 0.5, q = abs(p - u_pill.xy - hs) - (hs - hs.y);
    float dp = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - hs.y;
    if (u_pill.z > 0.0) col = mix(col, u_pc, clamp(1.5 - abs(dp + 1.0), 0.0, 1.0));
    gl_FragColor = vec4(col, u_bg.a);
}
`;

const MVIEW = `// The M view theme in one cluster-render "effect" layer (GLSL ES 1.00), after the Live Cockpit's M view: black
// everywhere (opaque), the speed scale on the left and the rev scale on the right (its mirror): a white outer line with
// rounded corners (u_path, the left one, from its bottom end to its top end), marks inside it, the band inside the line
// lit from 0 up to the value with red dots by the needle, a red needle across the line, red / yellow marks outside the
// rev line from the redline; a fuel dial in the lower left corner and an oil temperature dial in the lower right one (its
// mirror); a line under the speed and under the gear, and the bottom lines towards the middle. The middle is cut
// see-through for the Waze map while u_hole is set ("mapLive": only u_hole changes, no rebuild). v_uv (0,0) is the
// top-left. Ported from Asksket's f90 branch of this repo (MIT, issue #15).
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec2 u_path[32];   // the left scale's line, layer px
uniform float u_cum[32];   // arc length at each point
uniform float u_n;         // points used
uniform vec4 u_scale;      // arc length at 0 and at the top mark, -, the line's whole length
uniform vec4 u_ticks;      // speed: numbered marks, steps per number; rpm: the same
uniform float u_speed;     // 0..1
uniform float u_rpm;       // 0..1
uniform float u_redFrom;   // 0..1 of the rev scale
uniform float u_orange;    // 0..1, orange marks from here to the redline
uniform vec4 u_dial;       // fuel dial: centre x, y, radius (the oil dial is its mirror)
uniform vec2 u_dialAng;    // its angle (degrees, 0 = right, 90 = down) at full and at empty
uniform float u_fuel;      // 0..1
uniform float u_oil;       // 0..1 (50..150 C)
uniform vec4 u_line;       // the line under the speed: from x, to x, y; the bottom line runs on to x
uniform vec4 u_hole;       // the map window x, y, w, h (w 0 = none)
uniform float u_holeR;
uniform vec4 u_panel;      // the dark panel's inner edge: its top point x, y and its point at the middle x, y
uniform vec4 u_panelB;     // its bottom point x, y; z: how far inside the line the panel starts (0 = no panel)
uniform float u_oval;      // > 0: the map window is an oval inside u_hole, feathered over this many px

const vec3 WHITE = vec3(0.92, 0.93, 0.95);
const vec3 GREY = vec3(0.55, 0.57, 0.6);
const vec3 PANEL = vec3(0.105, 0.11, 0.12);
const vec3 RED = vec3(0.95, 0.1, 0.12);
const vec3 ORANGE = vec3(1.0, 0.6, 0.1);
const vec3 BLUE = vec3(0.25, 0.55, 1.0);

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec3 put(vec3 c, vec3 col, float a) { return mix(c, col, clamp(a, 0.0, 1.0)); }

void main() {
    vec2 p = v_uv * u_size;
    bool right = p.x > u_size.x * 0.5;
    vec2 q = right ? vec2(u_size.x - p.x, p.y) : p;
    vec3 c = vec3(0.0);

    // the nearest point of the line: its arc length s and the signed distance sd (+ inside the scale)
    float best = 1e6, s = 0.0, sd = 0.0;
    for (int i = 0; i < 31; i++) {
        if (float(i) >= u_n - 1.0) break;
        vec2 a = u_path[i], b = u_path[i + 1], ba = b - a;
        float L = max(length(ba), 0.001);
        float h = clamp(dot(q - a, ba) / (L * L), 0.0, 1.0);
        vec2 d = q - (a + ba * h);
        float dist = length(d);
        if (dist < best) { best = dist; s = u_cum[i] + h * L; sd = (ba.x * d.y - ba.y * d.x) / L; }
    }
    float total = u_scale.w, s0 = u_scale.x, s1 = u_scale.y;
    float v = right ? u_rpm : u_speed;
    float sv = mix(s0, s1, v);
    float f = (s - s0) / (s1 - s0);

    // the dark panel inside the scale: from a little inside the line to the chevron edge facing the middle
    if (u_panelB.z > 0.0 && sd > 0.0) {
        vec2 t = u_panel.xy, m = u_panel.zw, b = u_panelB.xy;
        float ex, slope;
        if (q.y < m.y) { float h = (q.y - t.y) / (m.y - t.y); ex = mix(t.x, m.x, h); slope = (m.x - t.x) / (m.y - t.y); }
        else { float h = (q.y - m.y) / (b.y - m.y); ex = mix(m.x, b.x, h); slope = (b.x - m.x) / (b.y - m.y); }
        float inner = (ex - q.x) / sqrt(1.0 + slope * slope);
        float pm = clamp(inner + 0.5, 0.0, 1.0) * smoothstep(u_panelB.z, u_panelB.z + 3.0, sd) * step(t.y, q.y);
        // a touch lighter towards the line, like BMW's
        c = put(c, PANEL * (1.0 + 0.35 * exp(-(sd - u_panelB.z) / 90.0)), pm);
    }

    if (best < 140.0) {
        // from 0 up to the value the band inside the line is lit: grey, brightest by the line and towards the needle
        if (s >= s0 - 6.0 && s <= sv && sd > 0.0 && sd < 100.0) {
            float toward = 0.18 + 0.82 * exp(-(sv - s) / 320.0);
            float inward = pow(1.0 - sd / 100.0, 1.6);
            float lit = toward * inward * smoothstep(s0 - 6.0, s0 + 10.0, s);
            c = put(c, vec3(0.86, 0.87, 0.9), lit * 0.8);
            // red dots right behind the needle
            vec2 cell = mod(p, 6.0) - 3.0;
            float spot = cov(length(cell) - 1.4);
            float near = exp(-(sv - s) / 55.0) * (1.0 - smoothstep(40.0, 95.0, sd));
            c = put(c, RED, spot * near * 0.9);
        }
        // BMW's red glow by the needle, at any value (also at 0, parked): red dots fading along and inwards
        if (u_panelB.z > 0.0 && sd > 0.0 && sd < 120.0 && s > s0 - 90.0) {
            vec2 cell = mod(p, 6.0) - 3.0;
            float spot = cov(length(cell) - 1.5);
            float glow = exp(-abs(s - sv) / 60.0) * (1.0 - smoothstep(20.0, 120.0, sd)) * smoothstep(s0 - 90.0, s0 - 30.0, s);
            c = put(c, RED, spot * glow * 0.85);
            c = put(c, RED * 0.35, glow * 0.35);
        }
        // the line: white, fading out at both ends, with a faint second line inside it
        float ends = smoothstep(0.0, 40.0, s) * smoothstep(0.0, 30.0, total - s);
        c = put(c, WHITE, cov(abs(sd) - 1.6) * ends);
        c = put(c, GREY, cov(abs(sd - 7.0) - 0.8) * ends * 0.5);
        // the marks inside it: a long one at each number and a short one between two
        vec2 tk = right ? u_ticks.zw : u_ticks.xy;
        float stp = (s1 - s0) / (tk.x * tk.y);
        float t = (s - s0) / stp, k = floor(t + 0.5);
        float along = abs(t - k) * stp;
        bool major = mod(k, tk.y) < 0.5;
        float len = major ? 26.0 : 14.0;
        if (k >= 0.0 && k <= tk.x * tk.y && sd > 0.0) {
            float a = cov(along - (major ? 1.7 : 1.1)) * cov(sd - len) * smoothstep(2.0, 4.0, sd);
            c = put(c, major ? WHITE : GREY, a);
        }
        // the rev scale: red then orange dashes outside the line, from the redline on
        if (right && f >= u_orange && f <= 1.0 && sd < -5.0 && sd > -15.0) {
            float gap = cov(abs(mod(s - s0, 46.0) - 23.0) - 19.0);
            c = put(c, f >= u_redFrom ? RED : vec3(1.0, 0.82, 0.1), cov(abs(sd + 10.0) - 3.5) * gap);
        }
        // the needle: a red bar across the line, stopping short of the numbers (centred 56 px in)
        float nb = cov(abs(s - sv) - 3.0) * smoothstep(-14.0, -8.0, sd) * (1.0 - smoothstep(30.0, 36.0, sd));
        c = put(c, RED, nb);
    }

    // the corner dial: fuel (left) or oil temperature (right), its value as a red mark
    vec2 dp = q - u_dial.xy;
    float r = length(dp);
    float ang = degrees(atan(dp.y, dp.x));
    float a0 = u_dialAng.x, a1 = u_dialAng.y;
    float df = (ang - a1) / (a0 - a1);          // 0 empty / cold .. 1 full / hot
    float arcLen = radians(abs(a0 - a1)) * u_dial.z;
    if (df > -0.03 && df < 1.03 && abs(r - u_dial.z) < 40.0) {
        float inArc = smoothstep(-0.02, 0.0, df) * (1.0 - smoothstep(1.0, 1.02, df));
        vec3 rim = WHITE;
        if (!right && df < 0.12) rim = RED;
        if (right && df < 0.15) rim = BLUE;
        if (right && df > 0.85) rim = RED;
        c = put(c, rim, cov(abs(r - u_dial.z) - 1.5) * inArc);
        float dv = right ? u_oil : u_fuel;
        float mk = cov(abs(df - dv) * arcLen - 3.0) * cov(abs(r - u_dial.z + 12.0) - 12.0);
        c = put(c, RED, mk);
        for (int j = 0; j < 3; j++) {
            float tf = float(j) * 0.5;
            c = put(c, WHITE, cov(abs(df - tf) * arcLen - 1.2) * cov(abs(r - u_dial.z + 8.0) - 8.0) * 0.9);
        }
    }

    // the line under the speed (left) and under the gear (right), fading in from the outer end
    if (q.x >= u_line.x && q.x <= u_line.y) {
        float x0 = u_line.x + 56.0;
        if (q.x < x0 - 8.0) {
            // the double dash at the outer end
            c = put(c, WHITE, cov(abs(abs(q.y - u_line.z) - 4.0) - 1.6));
        } else if (q.x >= x0) {
            float fade = smoothstep(x0, x0 + 60.0, q.x) * (1.0 - smoothstep(u_line.y - 4.0, u_line.y, q.x));
            c = put(c, WHITE, cov(abs(q.y - u_line.z) - 1.2) * (0.35 + 0.65 * fade));
        }
    }
    // the bottom line, on from the scale's bottom end towards the middle
    vec2 b0 = u_path[0];
    if (q.x >= b0.x && q.x <= u_line.w) {
        float fade = 1.0 - smoothstep(u_line.w - 140.0, u_line.w, q.x);
        c = put(c, GREY, cov(abs(q.y - b0.y) - 1.0) * fade);
    }

    float alpha = 1.0;
    if (u_hole.z > 0.0 && u_oval > 0.0) {
        // an oval window, its edge feathered into the black like BMW's map
        vec2 hs = u_hole.zw * 0.5;
        vec2 e = (p - (u_hole.xy + hs)) / hs;
        float ed = (length(e) - 1.0) * min(hs.x, hs.y);     // about px outside the oval
        alpha = smoothstep(-u_oval, 0.0, ed);
    } else if (u_hole.z > 0.0) {
        vec2 hs = u_hole.zw * 0.5;
        vec2 hq = abs(p - (u_hole.xy + hs)) - (hs - vec2(u_holeR));
        float hd = length(max(hq, 0.0)) + min(max(hq.x, hq.y), 0.0) - u_holeR;
        alpha = clamp(hd + 0.5, 0.0, 1.0);
        // a thin grey frame round the window
        c = put(c, GREY, cov(abs(hd - 2.0) - 1.0) * 0.8);
        alpha = max(alpha, cov(abs(hd - 2.0) - 1.0) * 0.8);
    }
    gl_FragColor = vec4(c, alpha);
}
`;

const VDASH = `// The Vector theme in one cluster-render "effect" layer (GLSL ES 1.00): black, angled bracket lines (u_seg), a round
// segmented rev counter (u_tach), four ring gauges (u_ring), three bars in the middle while no map shows (u_bar), and the
// music panel on the right (u_panel: its backdrop; u_vinyl: a record that turns red while something plays; u_prog: the
// track's progress). The middle is cut see-through, an octagon (u_hole, u_holeC), while the Waze map shows ("mapLive").
// v_uv (0,0) is the top-left.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_seg[20];    // the bracket lines: from x, y, to x, y
uniform float u_segW[20];  // each one's width (whole px) + brightness (the fraction: 0 grey .. 0.99 white)
uniform float u_nseg;
uniform vec4 u_tach;       // the rev counter: centre x, y, inner and outer radius of its segments
uniform vec4 u_tachA;      // its start angle (deg, clockwise from 3 o'clock), sweep (deg), segments, revs 0..1
uniform float u_redFrom;   // 0..1 of the rev counter
uniform vec2 u_zone;       // fixed zones (Supercar): yellow from, red from, 0..1 of the rev counter (y 0 = red from u_redFrom)
uniform vec4 u_face;       // Supercar: x backdrop (0 black, 1 graphite, 2 carbon), y drop shadow px round the dial, z dial face on
uniform vec4 u_ring[4];    // the ring gauges: centre x, y, radius, value 0..1 (radius 0 = none)
uniform vec3 u_ringC[4];   // their colours
uniform vec4 u_bar[3];     // the middle bars: left x, y, width (0 = none), value 0..1
uniform vec4 u_panel;      // the music panel's backdrop x, y, w, h (w 0 = none)
uniform vec4 u_vinyl;      // the record: centre x, y, radius; w: 1 while something plays
uniform vec4 u_prog;       // the progress line: left x, y, width, value 0..1
uniform vec4 u_hole;       // the map window x, y, w, h (w 0 = none)
uniform float u_holeC;     // its corners cut this far

const vec3 WHITE = vec3(0.93, 0.94, 0.96);
const vec3 GREY = vec3(0.5, 0.53, 0.58);
const vec3 TRACK = vec3(0.15, 0.16, 0.19);
const vec3 RED = vec3(0.95, 0.12, 0.14);
const vec3 AMBER = vec3(1.0, 0.7, 0.05);

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec3 put(vec3 c, vec3 col, float a) { return mix(c, col, clamp(a, 0.0, 1.0)); }
float segd(vec2 p, vec2 a, vec2 b) {
    vec2 ba = b - a;
    float h = clamp(dot(p - a, ba) / max(dot(ba, ba), 0.001), 0.0, 1.0);
    return length(p - a - ba * h);
}
// signed distance (about px) to a box with its corners cut at 45 degrees
float octd(vec2 p, vec4 r, float ch) {
    vec2 hs = r.zw * 0.5;
    vec2 q = abs(p - (r.xy + hs));
    return max(max(q.x - hs.x, q.y - hs.y), (q.x + q.y - (hs.x + hs.y - ch)) * 0.70710678);
}

void main() {
    vec2 p = v_uv * u_size;
    vec3 c = vec3(0.0);
    // Supercar's backdrop: graphite (a soft top-down gradient with a glow behind the dial) or carbon weave, then a drop
    // shadow round the dial and its dark face, so the dial stands off the backdrop
    if (u_face.x > 0.5) {
        float gy = v_uv.y;
        c = mix(vec3(0.13, 0.14, 0.16), vec3(0.0), smoothstep(0.0, 1.0, gy));
        float glow = 1.0 - smoothstep(0.0, u_tach.w * 1.9, length(p - u_tach.xy));
        c += vec3(0.05, 0.055, 0.065) * glow;
        if (u_face.x > 1.5) {
            vec2 q = p / 7.0;
            vec2 cell = floor(q), fq = fract(q);
            float dir = mod(cell.x + cell.y, 2.0);
            float w = dir > 0.5 ? fq.x : fq.y;
            float shade = 0.75 + 0.5 * (0.5 - abs(w - 0.5)) + 0.1 * sin((dir > 0.5 ? fq.y : fq.x) * 3.14159);
            c *= mix(1.0, shade, 0.55);
        }
        c *= 1.0 - 0.35 * smoothstep(0.55, 1.1, abs(v_uv.x - 0.5) * 2.0);
    }
    if (u_face.y > 0.0) {
        float rs = length(p - u_tach.xy - vec2(0.0, u_face.y * 0.3));
        float sh = 1.0 - smoothstep(u_tach.w + 4.0, u_tach.w + u_face.y, rs);
        c *= 1.0 - 0.9 * sh;
    }
    if (u_face.z > 0.5) {
        float rf = length(p - u_tach.xy);
        vec3 face = mix(vec3(0.0), vec3(0.03, 0.032, 0.036), smoothstep(0.0, u_tach.w, rf));
        c = put(c, face, cov(rf - u_tach.w - 10.0));
        c = put(c, vec3(0.42, 0.44, 0.48), cov(abs(rf - u_tach.w - 10.0) - 1.2));
    }
    bool playing = u_vinyl.w > 0.5;

    // the music panel: a dark plate with cut corners and a thin edge
    if (u_panel.z > 0.0) {
        float d = octd(p, u_panel, 26.0);
        c = put(c, vec3(0.05, 0.053, 0.06), cov(d));
        c = put(c, vec3(0.2, 0.21, 0.24), cov(abs(d) - 0.8));
    }
    // the record: grooves, a sheen, the label red while something plays
    if (u_vinyl.z > 0.0) {
        vec2 d = p - u_vinyl.xy;
        float r = length(d), R = u_vinyl.z;
        if (r < R + 2.0) {
            vec3 vc = vec3(0.025);
            float groove = 0.5 + 0.5 * sin(r * 0.9);
            vc = mix(vc, vec3(0.1, 0.105, 0.12), groove * smoothstep(R * 0.38, R * 0.42, r) * 0.8);
            float sheen = pow(abs(cos(atan(d.y, d.x) - 0.8)), 12.0) * 0.16 * smoothstep(R * 0.4, R * 0.5, r);
            vc += vec3(sheen);
            vc = mix(vc, playing ? RED * 0.85 : GREY * 0.45, cov(r - R * 0.36));
            vc = mix(vc, vec3(0.0), cov(r - 5.0));
            c = put(c, vc, cov(r - R));
            c = put(c, GREY * 0.7, cov(abs(r - R) - 0.8));
        }
    }
    // the progress line, with a dot at the position
    if (playing && u_prog.z > 0.0) {
        float t = (p.x - u_prog.x) / u_prog.z;
        float on = step(0.0, t) * step(t, 1.0);
        float line = cov(abs(p.y - u_prog.y) - 2.0) * on;
        c = put(c, TRACK, line);
        c = put(c, WHITE, line * step(t, u_prog.w));
        c = put(c, WHITE, cov(length(p - vec2(u_prog.x + u_prog.z * u_prog.w, u_prog.y)) - 6.0));
    }

    // the rev counter: segments round the dial, lit up to the revs, red from the redline
    {
        vec2 d = p - u_tach.xy;
        float r = length(d);
        if (r < u_tach.w + 30.0 && r > u_tach.z - 24.0) {
            float rel = mod(degrees(atan(d.y, d.x)) - u_tachA.x + 720.0, 360.0);
            float f = rel / u_tachA.y;
            if (f <= 1.0) {
                float n = u_tachA.z, k = floor(f * n), within = fract(f * n);
                float edge = min(within, 1.0 - within) * radians(u_tachA.y) / n * r;     // px to the segment's side
                float m = cov(-min(r - u_tach.z, u_tach.w - r)) * clamp(edge - 1.5 + 0.5, 0.0, 1.0);
                float mid = (k + 0.5) / n;
                float redF = u_zone.y > 0.0 ? u_zone.y : u_redFrom;
                bool red = mid >= redF;
                bool amber = u_zone.y > 0.0 && !red && mid >= u_zone.x;
                vec3 off = red ? vec3(0.3, 0.05, 0.06) : amber ? vec3(0.3, 0.21, 0.02) : TRACK;
                vec3 lit = red ? RED : amber ? AMBER : mix(GREY, WHITE, mid);
                c = put(c, mid <= u_tachA.w ? lit : off, m);
                // a thin ring inside, and a mark outside at every 1000
                c = put(c, GREY * 0.8, cov(abs(r - (u_tach.z - 14.0)) - 0.7));
                float per = u_tachA.y / 8.0;
                float tk = abs(radians(mod(rel + per * 0.5, per) - per * 0.5)) * r;
                c = put(c, f >= (u_zone.y > 0.0 ? u_zone.y : u_redFrom) - 0.01 ? RED : (u_zone.y > 0.0 && f >= u_zone.x - 0.01) ? AMBER : WHITE, cov(tk - 1.5) * cov(abs(r - (u_tach.w + 9.0)) - 5.0));
            }
        }
    }

    // the ring gauges: a 300 degree track open at the bottom, filled to the value in the ring's colour
    for (int i = 0; i < 4; i++) {
        vec4 g = u_ring[i];
        if (g.z <= 0.0) continue;
        vec2 d = p - g.xy;
        float r = length(d);
        if (r > g.z + 8.0) continue;
        float f = mod(degrees(atan(d.y, d.x)) - 120.0 + 720.0, 360.0) / 300.0;
        float on = step(f, 1.0);
        float ring = cov(abs(r - g.z) - 4.0) * on;
        c = put(c, TRACK, ring);
        c = put(c, u_ringC[i], ring * step(f, g.w));
        c = put(c, GREY * 0.55, cov(abs(r - g.z + 11.0) - 0.6) * on);
    }

    // the middle bars, with a mark every 10 %
    for (int i = 0; i < 3; i++) {
        vec4 b = u_bar[i];
        if (b.z <= 0.0) continue;
        float t = (p.x - b.x) / b.z;
        float on = step(0.0, t) * step(t, 1.0);
        float bar = cov(abs(p.y - b.y) - 4.0) * on;
        c = put(c, TRACK, bar);
        c = put(c, mix(GREY, WHITE, t), bar * step(t, b.w));
        float mk = abs(fract(t * 10.0 + 0.5) - 0.5) * b.z / 10.0;
        c = put(c, GREY * 0.7, cov(mk - 0.6) * on * cov(abs(p.y - b.y - 13.0) - 3.0));
    }

    // the bracket lines
    for (int i = 0; i < 20; i++) {
        if (float(i) >= u_nseg) break;
        vec4 s = u_seg[i];
        float w = floor(u_segW[i]), br = fract(u_segW[i]);
        c = put(c, mix(GREY, WHITE, br), cov(segd(p, s.xy, s.zw) - w * 0.5));
    }

    float alpha = 1.0;
    if (u_hole.z > 0.0) alpha = clamp(octd(p, u_hole, u_holeC) + 0.5, 0.0, 1.0);
    gl_FragColor = vec4(c, alpha);
}
`;

const E36DASH = `// The E36 theme (layouts e36.json, made by tools/gen_e36.py) in one cluster-render "effect" layer (GLSL ES 1.00): the
// BMW E36 328i cluster of the 90s. The black bezel and the dark grey face (a rounded box under a wide arch), four black
// dials (fuel, speed, revs, coolant) with their ticks, coloured zones (the red rev zone, the fuel and coolant blocks),
// the LCD and lamp windows (BMW draws its own turn arrows over the cluster). The printed figures are text widgets on top; the economy gauge is
// its own small layer (e36econ) and the needles another on top of everything (e36needles), as on the car where they
// sweep over the print. Under the face, in BMW's bottom row, the black warning-light strips: drawn by the same shader
// in pieces round the holes where BMW's own items show (gen_e36.py HOLES). Every position is in target px;
// u_origin is this layer's own top-left. v_uv (0,0) is the top-left.
// Kept light for the cluster's GPU (tools/shader_budget.js): no lookups inside loops, each loop skips what is far away.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec2 u_origin;
uniform vec3 u_col[12];    // bezel, face, dial, mark, needle, hub, red, blue, orange, well, strip, bg (yellow: from orange)
uniform vec4 u_face;       // the face's box: x0, y0, x1, y1
uniform vec4 u_faceB;      // its corner radius, the arch's centre x, y and radius
uniform float u_bezel;     // the black bezel round the face, px
uniform vec4 u_dial[4];    // fuel, speed, revs, coolant: centre x, y, radius, flat cut y below (0 = none)
uniform vec4 u_piv[4];     // their needles' pivots (the ticks and zones turn round them); z, w: the dial's foot under its
                           // cut (E46): the flat's half width (0 none), the shoulders' slope (0: the circle widened down
                           // to the flat, the hull; else the circle cut flat with sloped shoulders)
uniform vec4 u_tick[10];   // tick groups: first angle, last angle, count (0 = none), outer radius
uniform vec4 u_tickB[10];  // length, width, dial index (they turn round its pivot); w: 0 bars, 1 round dots (the E46's),
                           // 2.f bars and dots taking turns (the first a bar): a dot 0.8 x width round, its centre 0.f x length in
uniform vec4 u_zone[6];    // zones: from angle, to angle, inner radius, outer radius
uniform vec2 u_zoneB[6];   // dial index (round its pivot); colour 0 red, 1 blue, 2 orange, 3 the warm-up lamps (orange too; the
                           // shader puts them out by u_e46.z), 4 an unlit lamp, 5 the print (-1 none)
                           // + 8 x stripes
uniform vec4 u_win[3];     // windows (LCD, top lamp, ASC or the M3's /M plate): x, y, w, h (w 0 = none)
uniform vec3 u_winR;       // their corner radii
uniform float u_light;     // daylight: 1 by day, 0 at night (the glass's glare goes, the depth stays)
uniform vec4 u_strip[3];   // the warning-light strips: x, y, w, h (w 0 = none)
uniform float u_stripR;    // their corner radius
uniform vec3 u_e46;        // the E46's extras (0, 0, 0 for the E36): a chrome ring round every dial, px wide; striped zones as
                           // lamps (1: rounded, the lit ones glowing), and then the lamp windows black, not the LCD's colour;
                           // how many of the yellow lamps are out, from the lowest (hud.js: the oil warming them out, the
                           // revs lighting them from the top); -1: every lamp out (the shift blink's dark half)

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec3 put(vec3 c, vec3 col, float a) { return mix(c, col, clamp(a, 0.0, 1.0)); }
// a fixed noise per pixel (no sin: it loses precision at screen coordinates)
float hash(vec2 p) { vec3 q = fract(p.xyx * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float boxd(vec2 p, vec4 r, float rad) {
    vec2 hs = r.zw * 0.5;
    vec2 q = abs(p - (r.xy + hs)) - hs + rad;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
}
vec2 dir(float a) { float r = radians(a); return vec2(sin(r), -cos(r)); }

void main() {
    vec2 p = v_uv * u_size + u_origin;
    vec3 c = u_col[11];
    vec3 BEZEL = u_col[0], FACE = u_col[1], MARK = u_col[3];

    // the bezel and the face: a rounded box under a wide arch. The face is grained plastic, in the hood's shadow under
    // the arch and a little along every edge (it sits below the bezel)
    float ad = length(p - u_faceB.yz) - u_faceB.w;
    float fd = max(boxd(p, vec4(u_face.xy, u_face.zw - u_face.xy), u_faceB.x), ad);
    c = put(c, BEZEL, cov(fd - u_bezel));
    float hood = smoothstep(-110.0, 0.0, ad);
    float grain = hash(p) * 0.6 + hash(floor(p * 0.5)) * 0.4 - 0.5;
    c = put(c, FACE * (1.0 + 0.14 * grain) * (1.0 - 0.5 * hood * hood) * (1.0 - 0.3 * smoothstep(-14.0, 0.0, fd)), cov(fd));

    // the dials: black discs with a dark rim, cut flat at the bottom where the LCD and the economy gauge sit. They never
    // overlap, so the one this pixel is in (if any) is found once and only its ticks and zones are drawn.
    float K = -1.0;
    vec2 V = vec2(0.0);
    vec4 G = vec4(0.0), FT = vec4(0.0);
    float best = 1e5;
    // the LCD sits in the speedometer (the E36) only when it is centred under it; else it is a window of its own (the E46)
    vec4 w = u_win[0];
    bool lcdIn = w.z > 0.0 && abs(w.x + w.z * 0.5 - u_dial[1].x) < u_dial[1].z * 0.5;
    for (int i = 0; i < 4; i++) {
        vec4 g = u_dial[i];
        float gd = length(p - g.xy) - g.z;
        if (gd > 9.0 + u_e46.x + (u_piv[i].z > 0.0 ? 40.0 : 0.0) || gd > best) continue;
        vec4 pv = u_piv[i];
        best = gd; K = float(i); V = pv.xy; G = g;
        FT = vec4(pv.z, pv.w, pv.z <= 0.0 ? 0.0 : pv.w > 0.0 ? 1.0 : 2.0, 0.0);
    }
    if (K >= 0.0) {
        float dc = length(p - G.xy) - G.z;
        // a cut dial ends flat, its rim along the flat (the rev counter just under the economy gauge's ticks);
        // the speedometer ends just under the LCD (u_win[0])
        bool lcd = K == 1.0 && lcdIn;
        float bot = w.y + w.w;
        float fc = p.y - G.w;
        if (FT.z > 0.5 && FT.z < 1.5) fc = max(fc, (fc + (abs(p.x - G.x) - FT.x) * FT.y) / sqrt(1.0 + FT.y * FT.y));
        float cut = lcd ? p.y - bot - 4.0 : G.w > 0.0 ? fc : -1.0;
        if (FT.z > 1.5) {
            // the hull of the circle and the flat (half width FT.x at the cut): sides tangent to the circle down to the
            // flat's ends, the circle above where they touch it
            vec2 B = vec2(FT.x, G.w - G.y);
            float th = atan(B.y, B.x) - acos(clamp(G.z / length(B), -1.0, 1.0));
            vec2 n = vec2(cos(th), sin(th));
            vec2 q = vec2(abs(p.x - G.x), p.y - G.y);
            float hull = max(dot(q, n) - G.z, p.y - G.w);
            dc = q.y < G.z * n.y ? dc : hull;
            cut = -1.0;
        }
        // the dial sits in a well: its wall dark at the top (facing down), lit at the bottom (facing up); the black dial
        // a shade lighter below its centre, where the light reaches
        float low = clamp((p.y - G.y) / G.z * 0.7 + 0.5, 0.0, 1.0);
        float edge = max(dc, cut);
        c = put(c, mix(BEZEL * 0.5, FACE * 0.9, low * low), cov(edge - 4.0));
        if (u_e46.x > 0.0) {
            // a polished ring just outside the rim: bright along its middle, lit from above
            float t = clamp((edge - 3.0) / u_e46.x, 0.0, 1.0);
            float sheen = 1.0 - abs(2.0 * t - 1.0);
            // by day polished steel; after sunset (u_light 0) a thin ring lit in the theme's "orange", glowing round it
            float rd = abs(edge - 3.0 - u_e46.x * 0.5) - u_e46.x * 0.5;
            vec3 steel = vec3(0.93, 0.93, 0.95) * (0.38 + 0.62 * sqrt(sheen)) * (0.78 + 0.22 * low);
            vec3 lit = u_col[8] * (0.12 + 0.95 * sheen * sheen * sheen);      // a thin bright line along the middle
            c = put(c, mix(lit, steel, u_light), cov(rd));
            c += u_col[8] * (0.16 * (1.0 - u_light) * exp(-max(rd, 0.0) / 4.0));
        }
        float inDial = cov(edge);
        c = put(c, u_col[2] + 0.03 * (1.0 - smoothstep(0.0, G.z, length(p - G.xy - vec2(0.0, G.z * 0.3)))), inDial);
        if (lcd) {
            // the LCD's window cut up into the speedometer: level over the LCD, then shoulders sloping down to the
            // rim, grey either side of the LCD
            float hx = max(abs(p.x - w.x - w.z * 0.5) - w.z * 0.5, 0.0);
            c = put(c, FACE * 1.15, cov(max(max(dc + 3.0, p.y - bot), (w.y - 3.0 + hx * 0.42 - p.y) * 0.92)));
        }

        vec2 d = p - V;
        float r = length(d), a = degrees(atan(d.x, -d.y));

        // the zones (the red rev zone and its stripes or lamps, the fuel and coolant blocks): the loop only finds the one
        // this pixel belongs to (the nearest; of equal ones the later, so a lit lamp covers the unlit one under it), then
        // it is drawn once
        float zd = 1e5;
        vec4 z = vec4(0.0);
        vec2 b = vec2(-1.0);
        for (int i = 0; i < 6; i++) {
            vec2 bi = u_zoneB[i];
            if (bi.x != K || bi.y < 0.0) continue;
            vec4 zi = u_zone[i];
            float di = max(radians(max(zi.x - a, a - zi.y)) * r, max(zi.z - r, r - zi.w));
            if (di < 10.0 && di <= zd + 0.001) { zd = di; z = zi; b = bi; }
        }
        if (b.y >= 0.0) {
            float dd = zd;
            float n = floor(b.y / 8.0), k = b.y - n * 8.0;
            vec3 zc = k < 0.5 ? u_col[6] : k < 1.5 ? u_col[7] : k < 2.5 ? u_col[8]
                : k < 3.5 ? u_col[8] : k < 4.5 ? mix(u_col[2], MARK, 0.22) : MARK;
            if (n > 0.0 && u_e46.y > 0.5) {
                // a lamp in the middle of each of the n steps: a capsule along the arc, 40 % of a step long; a yellow
                // (warm-up) lamp below the count that is out is drawn unlit
                float st = (z.y - z.x) / n;
                float li = floor(clamp((a - z.x) / st, 0.0, n - 0.001));
                if ((k > 2.5 && k < 3.5 && li < u_e46.z) || u_e46.z < -0.5) { k = 4.0; zc = mix(u_col[2], MARK, 0.22); }
                float ac = z.x + st * (li + 0.5);
                float hw = (z.w - z.z) * 0.5;
                vec2 q = vec2(abs(radians(a - ac)) * r, r - (z.z + z.w) * 0.5);
                if (u_e46.y > 1.5) {
                    // blocks, as the real E46 M3's (photo, Nov 24 2026): each lamp fills its step but for a thin gap at each
                    // end (where the marks pass), slightly rounded, soft-edged like light through smoked glass. Unlit: a
                    // smoky grey a little lighter than the face; lit: a warm glow, brightest in its middle, bleeding out
                    float hl = min(radians(st) * r * 0.36, hw * 1.3);       // about square, a clear gap between
                    vec2 e = abs(q) - vec2(hl, hw) + 4.0;
                    float dp = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - 4.0;
                    float body = clamp(0.6 - dp / 1.8, 0.0, 1.0);
                    if (k > 3.5) {
                        vec3 smoke = mix(u_col[2], vec3(0.62, 0.6, 0.58), 0.3) * (0.88 + 0.24 * smoothstep(-hw, hw, -q.y));
                        c = put(c, smoke, body * 0.9);
                    } else {
                        float core = 1.0 - 0.35 * smoothstep(0.0, 1.0, length(q / vec2(hl + 2.0, hw + 2.0)));
                        c = mix(c, zc, 0.32 * (1.0 - smoothstep(0.0, 8.0, dp)));      // the glow round it
                        c = put(c, mix(zc, vec3(1.0, 0.92, 0.82), 0.18 * (1.0 - core) + 0.0) * (0.75 + 0.35 * core), body);
                        c = put(c, mix(zc, vec3(1.0, 0.85, 0.7), 0.4), body * 0.35 * (1.0 - smoothstep(0.0, hw * 0.9, abs(q.y + hw * 0.2))) * core);
                    }
                } else {
                float dp = length(vec2(max(q.x - max(radians(st) * r * 0.2 - hw, 0.0), 0.0), q.y)) - hw;
                if (k < 3.5) c = mix(c, zc, 0.38 * (1.0 - smoothstep(0.0, 9.0, dp)));       // a lit lamp's glow
                c = put(c, zc * (1.0 + 0.25 * cov(abs(q.y + hw * 0.35) - hw * 0.3)), cov(dp));
                }
            } else {
                // n stripes, each in the middle 60 % of its step, so both ends of the zone fall in a gap (no sliver at the end)
                if (n > 0.0) dd = max(dd, (abs(fract((a - z.x) / (z.y - z.x) * n) - 0.5) - 0.3) * radians(z.y - z.x) / n * r);
                c = put(c, zc, cov(dd));
            }
        }

        // the ticks, evenly spaced in each group
        for (int i = 0; i < 10; i++) {
            vec4 g = u_tick[i], h = u_tickB[i];
            if (h.z != K || g.z <= 0.0) continue;
            float sp = g.z > 1.0 ? (g.y - g.x) / (g.z - 1.0) : 1.0;
            float k = g.z > 1.0 ? clamp(floor((a - g.x) / sp + 0.5), 0.0, g.z - 1.0) : 0.0;
            float ta = radians(a - (g.x + k * sp)) * r;
            float alt = step(1.5, h.w), dt = step(0.5, h.w) * (1.0 - alt + alt * mod(k, 2.0));    // 1: this one a dot
            float rc = g.w - h.x * mix(0.5, fract(h.w), alt);
            float td = dt > 0.5 ? length(vec2(ta, r - rc)) - h.y * (0.5 - 0.1 * alt)
                                : max(abs(ta) - h.y * 0.5, max(g.w - h.x - r, r - g.w));
            c = put(c, MARK, cov(td));
        }

        // the rim's shadow on the dial and its print, the light from above: where the point a little above is under the
        // face, this one is in its shade (a crescent under the top rim)
        c *= 1.0 - 0.55 * inDial * smoothstep(-24.0, 4.0, length(p - vec2(0.0, 16.0) - G.xy) - G.z);
    }

    // the windows (LCD, top lamp, ASC), over the dials' bevels; the LCD inside the speedometer's rim (it clips a corner)
    float dsp = length(p - u_dial[1].xy) - u_dial[1].z + 3.0;
    for (int i = 0; i < 3; i++) {
        float rad = i == 0 ? u_winR.x : i == 1 ? u_winR.y : u_winR.z;
        float d = boxd(p, u_win[i], rad);
        if (i == 0 && lcdIn) d = max(d, dsp);
        float on = step(0.5, u_win[i].z);
        // sunk like the dials: the frame dark at the top, lit at the bottom, the top edge's shade inside
        float low = clamp((p.y - u_win[i].y) / max(u_win[i].w, 1.0), 0.0, 1.0);
        c = put(c, mix(BEZEL * 0.6, FACE * 0.9, low), cov(d - 2.0) * on);
        c = put(c, (i == 0 || u_e46.y < 0.5 ? u_col[9] : BEZEL * 2.0) * (1.0 - 0.5 * smoothstep(-10.0, 2.0, boxd(p - vec2(0.0, 7.0), u_win[i], rad))), cov(d) * on);
    }

    // the cluster is lit from the middle: its ends fall off a little
    c *= 1.0 - 0.18 * smoothstep(560.0, 1000.0, abs(p.x - u_faceB.y));
    // the glass over it all, by day: a broad soft band of sky across it, a narrow one on the right, brighter under the
    // hood's arch, a thin bright line where the glass meets the bezel's top
    float bx = p.x + 0.55 * p.y;
    float b1 = (bx - 560.0) / 240.0, b2 = (bx - 1560.0) / 110.0;
    float sky = 0.055 * exp(-b1 * b1) + 0.03 * exp(-b2 * b2) + 0.045 * smoothstep(-240.0, 0.0, ad);
    sky += 0.12 * cov(abs(fd - u_bezel + 2.0) - 0.8) * smoothstep(420.0, 80.0, p.y);
    c = mix(c, vec3(0.86, 0.9, 0.96), sky * u_light * cov(fd - u_bezel));

    // the warning-light strips, last: flat black like BMW's own row that shows through their holes (no glare, no
    // grain, or the holes' edges would show), in a dark rim sunk into the face
    if (p.y > u_strip[0].y - 4.0) {
        for (int i = 0; i < 3; i++) {
            float d = boxd(p, u_strip[i], u_stripR), on = step(0.5, u_strip[i].z);
            c = put(c, BEZEL * 0.6, cov(d - 2.0) * on);
            c = put(c, u_col[10], cov(d) * on);
        }
    }

    gl_FragColor = vec4(c, 1.0);
}
`;

const E36ECON = `// The E36 theme's economy gauge, or the M3's oil temperature gauge (widget e36econ, tools/gen_e36.py): its own small
// layer over the rev counter's lower cut, so its tick loop runs over that window only. See-through except the window's top line (level, its two corners
// cut off down to the dial's rim) and the ticks (as printed, end to end: the right-hand ones lean over); its needle is
// e36needles'. Positions in target px, u_origin the layer's top-left. v_uv (0,0) is the top-left.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec2 u_origin;
uniform vec3 u_mark;       // the ticks' colour
uniform vec3 u_line;       // the window's top line
uniform vec4 u_econ;       // (unused), (unused), (unused), the window's top y
uniform vec4 u_cham;       // the window's top corners: left corner x, its slope down to the left, right corner x, its slope
uniform vec4 u_tach;       // the rev counter's centre x, y, radius, flat cut y (the window ends at its edge and cut)
uniform vec4 u_econT[16];  // the ticks: x0, y0, x1, y1 (width 0 = none)
uniform vec4 u_econW[4];   // their widths, four to a vec4 (negative: a round dot that wide at the segment's middle)

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }

void main() {
    vec2 p = v_uv * u_size + u_origin;
    float inDial = cov(length(p - u_tach.xy) - u_tach.z + 5.0) * cov(p.y - u_tach.w);
    // the window's top edge at this x, and how far below it this pixel is (px, square to the edge)
    float kl = u_cham.y * step(p.x, u_cham.x), kr = u_cham.w * step(u_cham.z, p.x);
    float top = u_econ.w + (u_cham.x - p.x) * kl + (p.x - u_cham.z) * kr;
    float below = (p.y - top) / sqrt(1.0 + kl * kl + kr * kr);
    vec3 c = u_mark;
    float al = 0.0;
    float line = cov(abs(below) - 1.2);
    c = mix(c, u_line, line); al = max(al, line);
    for (int j = 0; j < 4; j++) {
        vec4 W = u_econW[j];
        for (int k = 0; k < 4; k++) {
            vec4 t = u_econT[j * 4 + k];
            float w = k == 0 ? W.x : k == 1 ? W.y : k == 2 ? W.z : W.w;
            vec2 ba = t.zw - t.xy, pa = p - t.xy;
            float len = length(ba);
            vec2 u = ba / max(len, 0.001);
            float along = dot(pa, u), across = abs(pa.x * u.y - pa.y * u.x);
            float m = w < 0.0 ? cov(length(pa - ba * 0.5) + w * 0.5)
                              : cov(max(across - w * 0.5, max(-along, along - len))) * step(0.01, w);
            c = mix(c, u_mark, m); al = max(al, m);
        }
    }
    gl_FragColor = vec4(c, al * inDial);
}
`;

const E36NEEDLES = `// The E36 theme's needles (widget e36needles, tools/gen_e36.py), a see-through layer over the face (e36dash), the
// economy gauge (e36econ) and the printed figures and icons, as on the car where the needles sweep over the print: the
// economy (or the M3's oil) needle first, kept inside its window, then the four dials' needles with their dark
// counterweights and hubs (the rev counter's over the economy one). The dials' needles move by the renderer's own clock
// (u_time, layer "time" 1) along paths the app sends (shared/e36.js nextPath), so they move on every display frame.
// Positions in target px, u_origin the layer's top-left. v_uv (0,0) is the top-left.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec2 u_origin;
uniform vec3 u_col[3];     // needle, hub, bezel (the dark ring round the hub)
uniform vec4 u_piv[4];     // fuel, speed, revs, coolant: pivot x, y, hub radius, counterweight length
uniform vec2 u_ndl[4];     // needle length, width (length 0 = none)
uniform vec4 u_path[8];    // per needle (fuel, speed, revs, coolant) a path: its keys' times (the first in u_time's
                           // seconds, the others after it), then their angles (degrees clockwise from 12 o'clock)
uniform float u_time;      // the renderer's clock: seconds since the layer was attached, 0 .. 3600 and again
uniform vec4 u_econ;       // the economy needle: pivot x, y, length (0 = none), its window's top y
uniform vec2 u_econB;      // its angle, width
uniform vec4 u_cham;       // the window's top corners: left corner x, its slope down to the left, right corner x, its slope
uniform vec4 u_tach;       // the rev counter's centre x, y, radius, flat cut y (the window ends at its edge and cut)
uniform float u_light;     // daylight: 1 by day, 0 at night (softer shadows)
uniform float u_econH;     // the economy (oil) needle's hub radius, cut off with the window (0 = none: the E36's)
uniform float u_e46n;      // 1: the E46 M3's look (gen_e46.py): glowing needles with a bright core, hubs a black rim round a
                           // domed cap, the big dials' hubs with their square tab (u_piv.w < 0: its size); 0: the E36's;
                           // 2: the same hubs, the needles flat matte paint by day as the real car's (photo, Nov 24 2026),
                           // glowing only at night (u_light 0)

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec2 dir(float a) { float r = radians(a); return vec2(sin(r), -cos(r)); }
// a path's angle now (shared/e36.js pathAt): straight between its keys, held after the last, back along the first leg
// before the first (up to 0.25 s; further back the clocks disagree: the first key); across the clock's wrap at 3600 s
float ang(vec4 T, vec4 A) {
    float s = u_time - T.x;
    s -= 3600.0 * floor((s + 1800.0) / 3600.0);
    if (s < -0.25) return A.x;
    if (s < T.y) return A.x + (A.y - A.x) * s / max(T.y, 0.0001);
    if (s < T.z) return A.y + (A.z - A.y) * (s - T.y) / max(T.z - T.y, 0.0001);
    return A.z + (A.w - A.z) * min(1.0, (s - T.z) / max(T.w - T.z, 0.0001));
}
// a fixed noise per pixel (no sin: it loses precision at screen coordinates)
float hash(vec2 p) { vec3 q = fract(p.xyx * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
// the E46's needle colour: a bright core, deeper red at the edges (x: 0 the middle, 1 the edge)
vec3 glowc(vec3 n, float x) { return mix(min(n * vec3(1.0, 1.3, 1.6) + vec3(0.0, 0.03, 0.01), vec3(1.0)), n * vec3(0.92, 0.38, 0.3), x * x); }
// a domed cap: lit from the upper left
vec3 dome(vec3 h, vec2 d, float r) { return h * (1.0 + 1.1 * clamp(0.6 - length(d / r + vec2(0.35, 0.45)), 0.0, 1.0)); }
// a dial's needle at d from its pivot, pointing u: the distances to its counterweight, its bar (tapered) and its hub
vec3 parts(vec2 d, vec2 u, vec4 V, vec2 N) {
    float t = dot(d, u), side = abs(d.x * u.y - d.y * u.x);
    float wt = mix(N.y, N.y * 0.55, clamp(t / N.x, 0.0, 1.0)) * 0.5;
    return vec3(max(side - N.y * 1.1, max(t, -t - max(V.w, 0.0))), max(side - wt, max(-t, t - N.x)), length(d) - V.z);
}

void main() {
    vec2 p = v_uv * u_size + u_origin;
    vec3 c = u_col[0];
    float al = 0.0;

    // the economy needle, under the window's top line only
    if (u_econ.z > 0.0) {
        float kl = u_cham.y * step(p.x, u_cham.x), kr = u_cham.w * step(u_cham.z, p.x);
        float top = u_econ.w + (u_cham.x - p.x) * kl + (p.x - u_cham.z) * kr;
        float below = (p.y - top) / sqrt(1.0 + kl * kl + kr * kr);
        float inWin = cov(2.0 - below) * cov(length(p - u_tach.xy) - u_tach.z + 5.0) * cov(p.y - u_tach.w);
        vec2 ed = p - u_econ.xy;
        vec2 u = dir(u_econB.x);
        float t = dot(ed, u), side = abs(ed.x * u.y - ed.y * u.x);
        // the E46's flat needles (u_e46n 2): tapered, shadowed and edged as the dials' own (parts(), below)
        bool flat46 = u_e46n > 1.5 && u_light > 0.5;
        float ew = u_e46n > 1.5 ? mix(u_econB.y, u_econB.y * 0.55, clamp(t / u_econ.z, 0.0, 1.0)) * 0.5 : u_econB.y * 0.5;
        float nd = max(side - ew, max(-t, t - u_econ.z));
        if (u_e46n > 1.5) {   // its shadow, 3, 8 px off, as the dials' needles cast
            vec2 sd = ed - vec2(3.0, 8.0);
            float st = dot(sd, u), ss = abs(sd.x * u.y - sd.y * u.x);
            float sw = mix(u_econB.y, u_econB.y * 0.55, clamp(st / u_econ.z, 0.0, 1.0)) * 0.5;
            float m = clamp(0.5 - max(ss - sw, max(-st, st - u_econ.z)) / 7.0, 0.0, 1.0) * (0.3 + 0.2 * u_light) * inWin;
            float o = m + al * (1.0 - m);
            c = c * al * (1.0 - m) / max(o, 0.0001); al = o;
        }
        float n = cov(nd) * inWin;
        bool glowE = u_e46n > 0.5 && (u_e46n < 1.5 || u_light < 0.5);
        vec3 nc = glowE ? glowc(u_col[0], clamp(side / ew, 0.0, 1.0))
            : flat46 ? mix(u_col[0], u_col[0] * 0.82, smoothstep(0.6, 1.0, side / max(ew, 0.5))) : u_col[0];
        if (glowE) { float g = 0.4 * exp(-max(nd, 0.0) / 4.0) * inWin; c = mix(c, u_col[0], g * (1.0 - al)); al = max(al, g); }
        c = mix(c, nc, n); al = max(al, n);
        if (u_econH > 0.0) {
            float under = p.y - u_tach.w + 1.0;
            float hb = cov(max(length(ed) - u_econH, under));
            vec3 hc = u_e46n > 0.5 ? u_col[2] : u_col[1];
            c = mix(c, hc, hb); al = max(al, hb);
            if (u_e46n > 0.5) {
                float hi = cov(max(length(ed) - u_econH * 0.82, under + 2.0));
                c = mix(c, dome(u_col[1], ed, u_econH), hi);
            }
        }
    }

    // the dials' needles never reach each other: the one this pixel is near (if any) is found once, then drawn
    float K = -1.0;
    vec4 V = vec4(0.0), PT = vec4(0.0), PA = vec4(0.0);
    vec2 N = vec2(0.0);
    for (int i = 0; i < 4; i++) {
        vec4 v = u_piv[i];
        vec2 n = u_ndl[i];
        if (n.x <= 0.0 || length(p - v.xy) > max(n.x, v.w) + n.y + 16.0) continue;
        K = float(i); V = v; N = n; PT = u_path[2 * i]; PA = u_path[2 * i + 1];
    }
    vec2 d = p - V.xy, u = vec2(0.0, -1.0);
    if (K >= 0.0) {
        // most of the dial's circle is far from its needle: only pixels within 30 px of the needle's line (its glow, its
        // shadow 3, 8 px off) or of its hub and tab do the work below. Saves most of this layer's work on every frame
        u = dir(ang(PT, PA));
        if (abs(d.x * u.y - d.y * u.x) > N.y + 30.0 && length(d) > V.z + abs(V.w) + 30.0) K = -1.0;
    }
    if (K >= 0.0) {
        // its shadow first (over the economy needle, which lies lower): the needle stands off the dial, the light from
        // above and a little left. "Over" in straight alpha: what is drawn next covers what is under it
        vec3 s = parts(d - vec2(3.0, 8.0), u, V, N);
        float m = clamp(0.5 - min(min(s.x, s.y), s.z - 1.5) / 7.0, 0.0, 1.0) * (0.3 + 0.2 * u_light);
        float o = m + al * (1.0 - m);
        c = c * al * (1.0 - m) / max(o, 0.0001); al = o;
        // a tapered bar from the pivot, a counterweight (tail) behind it, the hub over both: hub and tail one flat piece of fine-grained
        // plastic, as on the car
        vec3 q = parts(d, u, V, N);
        vec3 cap = u_col[1] * (1.0 + 0.3 * (hash(p) * 0.6 + hash(floor(p * 0.5)) * 0.4 - 0.5));
        bool e46 = u_e46n > 0.5;
        vec3 ndc = u_col[0];
        if (e46) {
            // the big hubs' square tab at 45 degrees (in the rim's black), and the needle's glow and bright core
            if (V.w < 0.0) {
                // the counterweight tab, behind the needle: it turns with it
                vec2 tc = d + u * V.z * 0.93;
                q.x = max(abs(dot(tc, u)), abs(tc.x * u.y - tc.y * u.x)) + V.w * 0.5;
            }
            float t = dot(d, u), side = abs(d.x * u.y - d.y * u.x);
            float wt = mix(N.y, N.y * 0.55, clamp(t / N.x, 0.0, 1.0)) * 0.5;
            if (u_e46n > 1.5 && u_light > 0.5) {
                // flat matte paint: one colour, a touch darker along the very edges
                ndc = mix(u_col[0], u_col[0] * 0.82, smoothstep(0.6, 1.0, side / max(wt, 0.5)));
            } else {
                ndc = glowc(u_col[0], clamp(side / max(wt, 0.5), 0.0, 1.0));
                float g = 0.45 * exp(-max(q.y, 0.0) / 5.0) * (1.0 - cov(q.y));
                o = g + al * (1.0 - g);
                c = (u_col[0] * g + c * al * (1.0 - g)) / max(o, 0.0001); al = o;
            }
        }
        for (int j = 0; j < 4; j++) {
            m = cov(j == 0 ? q.x : j == 1 ? q.y : j == 2 ? (e46 ? q.z : q.z - 1.5) : (e46 ? q.z + V.z * 0.17 : q.z));
            vec3 col = j == 0 ? (e46 ? cap * 1.5 : cap) : j == 1 ? ndc : j == 2 ? u_col[2] : (e46 ? dome(cap, d, V.z * 0.83) : cap);
            o = m + al * (1.0 - m);
            c = (col * m + c * al * (1.0 - m)) / max(o, 0.0001); al = o;
        }
    }
    gl_FragColor = vec4(c, al);
}
`;

const TWINFACE = `// The Classic theme's backdrop in one cluster-render "effect" layer (GLSL ES 1.00): black, up to 4 round dials and
// up to 2 recessed readout windows. A main dial has a chrome bezel lit from above, a gray face with a fine spun
// grain, a soft shadow under the bezel, three tick sizes with a printed shadow, and an orange-to-red zone. An
// inset dial (u_red[i].y 1) sits recessed in its parent: no bezel, a dark lip lit on its lower edge.
// The numerals are text widgets on top and the needles a second effect layer (TWINNEEDLE) above those.
// Uniforms from hud.js (positions in target px, v_uv (0,0) is the top-left):
//   u_dial[i]   cx, cy, r, 1 when in use
//   u_scale[i]  start, sweep (radians clockwise from 12 o'clock), minor divisions, a major tick every N minors
//   u_red[i]    x: the 0..1 of the sweep where the red zone starts (above 1 = none), y: 1 = inset dial,
//               z: a middle tick every N minors (0 = none)
//   u_win[i]    a readout window: x, y, w, h (w 0 = none)
//   u_gap       x, y, w, h left see-through (BMW's gear letter; w 0 = none)
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_dial[4];
uniform vec4 u_scale[4];
uniform vec4 u_red[4];
uniform vec4 u_win[2];
uniform vec4 u_gap;
uniform vec3 u_face;
uniform vec3 u_ink;
uniform vec3 u_hot;

const float PI = 3.14159265359;
float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }

// a chrome torus: t 0..1 across the ring (0 outside), dir the outward direction; lit from above and a little left
vec3 chrome(float t, vec2 dir) {
    float a = (t - 0.5) * PI;                                   // -90..90 degrees across the profile
    vec3 n = normalize(vec3(-dir * sin(a), cos(a)));           // y down: dir.y > 0 is the lower half
    vec3 L = normalize(vec3(-0.30, -0.80, 0.52));
    float d = max(dot(n, L), 0.0);
    float horizon = smoothstep(-0.08, 0.08, -n.y);              // the sky above, the dark below, as in a real reflection
    vec3 base = mix(vec3(0.10, 0.105, 0.11), vec3(0.78, 0.80, 0.83), horizon);
    vec3 c = base * (0.35 + 0.75 * d) + vec3(1.0) * pow(d, 28.0) * 0.9;
    c += vec3(0.25) * pow(max(dot(n, normalize(vec3(0.45, 0.70, 0.55))), 0.0), 12.0);   // a weaker bounce from below
    return c;
}

void main() {
    vec2 p = v_uv * u_size;
    vec3 c = vec3(0.0);
    for (int i = 0; i < 4; i++) {
        if (u_dial[i].w < 0.5) continue;
        vec2 q = p - u_dial[i].xy;
        float R = u_dial[i].z, r = length(q);
        bool inset = u_red[i].y > 0.5;
        float outer = inset ? R + 6.0 : R;
        if (r > outer + 3.0) continue;
        vec2 dir = q / max(r, 0.001);
        float bw = inset ? 0.0 : R * 0.055;                     // the bezel's width
        float Rf = R - bw - (inset ? 0.0 : 2.0);                // the face's radius
        // the gap between the dial and the black around it, and the bezel
        if (!inset) {
            c = mix(c, vec3(0.012), cov(r - (R + 2.5)));
            float t = clamp((R - r) / bw, 0.0, 1.0);
            c = mix(c, chrome(t, dir), cov(r - R) * cov(Rf - r));
        } else {
            // a recessed lip: dark, with its lower edge catching the light
            float lip = cov(r - (R + 5.0)) * cov(R - r);
            float lit = smoothstep(0.1, 0.9, dir.y);
            c = mix(c, mix(vec3(0.06), vec3(0.55), lit * smoothstep(R + 5.0, R + 1.5, r)), lip);
        }
        if (!inset) c = mix(c, vec3(0.02), cov(abs(r - Rf) - 1.6));   // a thin dark gasket between bezel and face
        if (r > Rf - 1.0) continue;
        // the face: gray, a touch lighter in the middle, a fine spun grain and a few faint rings
        float ang = atan(q.x, -q.y);
        float grain = (hash(floor(r * 1.7)) - 0.5) * 0.035 + (hash(floor(r * 0.35) + 7.0) - 0.5) * 0.02;
        float sheen = 0.06 * pow(0.5 + 0.5 * cos(2.0 * (ang + 0.6)), 4.0);
        vec3 face = u_face * (inset ? 0.82 : 1.0) * (1.05 - 0.16 * (r / Rf) * (r / Rf) + grain + sheen);
        // the shadow the bezel (or the lip) casts, deeper at the top where the light comes from
        float sd = Rf - r, top = clamp(-dir.y * 0.5 + 0.5, 0.0, 1.0);
        face *= 1.0 - (0.55 * top + 0.18) * exp(-sd / (R * (inset ? 0.07 : 0.045)));
        c = mix(c, face, cov(r - Rf));
        // the scale
        float sweep = u_scale[i].y, n = u_scale[i].z, every = u_scale[i].w, mid = u_red[i].z;
        float rel = mod(ang - u_scale[i].x + 4.0 * PI, 2.0 * PI);
        if (rel > PI + sweep * 0.5) rel -= 2.0 * PI;
        float f = rel / sweep;
        float rOut = Rf * 0.965;
        float redStart = u_red[i].x;
        if (redStart <= 1.0) {                                  // the zone: orange into red, printed behind the ticks
            float along = min(f - redStart, 1.0 - f) * sweep * r;
            float band = cov(abs(r - (rOut - R * 0.045)) - R * 0.045) * clamp(0.5 + along, 0.0, 1.0);
            float g = smoothstep(redStart, redStart + 0.06, f);
            c = mix(c, mix(vec3(1.0, 0.55, 0.05), u_hot, g), band * 0.95);
        }
        for (int s = 0; s < 2; s++) {                           // the ticks' printed shadow, then the ticks
            vec2 qq = s == 0 ? q - vec2(1.2, 1.8) : q;
            float rr = length(qq), aa = atan(qq.x, -qq.y);
            float rl = mod(aa - u_scale[i].x + 4.0 * PI, 2.0 * PI);
            if (rl > PI + sweep * 0.5) rl -= 2.0 * PI;
            float ff = rl / sweep;
            float k = clamp(floor(ff * n + 0.5), 0.0, n);
            bool major = mod(k + 0.25, every) < 0.5;
            bool middle = !major && mid > 0.5 && mod(k + 0.25, mid) < 0.5;
            float dt = abs(rl - k / n * sweep) * rr;
            float len = major ? R * 0.11 : middle ? R * 0.075 : R * 0.045;
            float hw = major ? max(1.8, R * 0.011) : middle ? max(1.3, R * 0.0065) : max(0.9, R * 0.004);
            float tick = cov(dt - hw) * cov(rr - rOut) * cov(rOut - len - rr) * step(-0.02, ff) * step(ff, 1.02);
            if (s == 0) c = mix(c, c * 0.55, tick * 0.6);
            else c = mix(c, k / n >= redStart - 0.001 && redStart <= 1.0 ? vec3(1.0) : u_ink, tick);
        }
    }
    for (int i = 0; i < 2; i++) {                               // the readout windows: a dark recess with a lit lower edge
        if (u_win[i].z <= 0.0) continue;
        vec2 hs = u_win[i].zw * 0.5, m = p - u_win[i].xy - hs;
        vec2 e = abs(m) - hs + 9.0;
        float d = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - 9.0;
        c = mix(c, c * 0.5, cov(d - 3.0) * 0.6);                 // a soft shadow round it
        c = mix(c, vec3(0.025) + vec3(0.03) * clamp(-m.y / hs.y, 0.0, 1.0), cov(d));
        c = mix(c, m.y > 0.0 ? vec3(0.62) : vec3(0.02), cov(abs(d) - 0.9) * 0.8);
    }
    float a = 1.0;
    if (u_gap.z > 0.0) {
        vec2 g = p - u_gap.xy;
        if (g.x >= 0.0 && g.y >= 0.0 && g.x < u_gap.z && g.y < u_gap.w) a = 0.0;
    }
    gl_FragColor = vec4(c * a, a);
}
`;

const TWINNEEDLE = `// The Classic theme's needles in one cluster-render "effect" layer (GLSL ES 1.00): up to 4 tapered needles with a
// bevelled ridge, a soft shadow on the face, a short dark tail and a domed black cap with a chrome edge; over each
// big dial a faint glass reflection. See-through everywhere else.
//   u_nd[i]    cx, cy (layer px), tip length, tail length (0 length = not in use)
//   u_na[i]    start, sweep (radians clockwise from 12 o'clock), half width at the hub, hub radius
//   u_value    the 4 needles' positions, 0..1 of the sweep
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_nd[4];
uniform vec4 u_na[4];
uniform vec4 u_value;
uniform vec3 u_color;
uniform vec3 u_rim;

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec4 over(vec4 top, vec4 under) {
    float a = top.a + under.a * (1.0 - top.a);
    if (a <= 0.0) return vec4(0.0);
    return vec4((top.rgb * top.a + under.rgb * under.a * (1.0 - top.a)) / a, a);
}

void main() {
    vec2 p = v_uv * u_size;
    vec4 c = vec4(0.0);
    for (int i = 0; i < 4; i++) {
        float tip = u_nd[i].z;
        if (tip <= 0.0) continue;
        vec2 q = p - u_nd[i].xy;
        float hub = u_na[i].w, tail = u_nd[i].w, w0 = u_na[i].z;
        if (dot(q, q) > (tip + 12.0) * (tip + 12.0)) continue;
        float a = u_na[i].x + clamp(u_value[i], 0.0, 1.0) * u_na[i].y;
        vec2 dir = vec2(sin(a), -cos(a));                        // y runs down
        vec2 nrm = vec2(-dir.y, dir.x);
        // the needle's soft shadow on the face, a little below and to the right
        vec2 qs = q - vec2(2.0, 4.0) * (tip > 150.0 ? 1.6 : 0.8);
        float sa = dot(qs, dir), sc = abs(dot(qs, nrm));
        float sw = mix(w0, 1.0, clamp(sa / tip, 0.0, 1.0)) * 1.15;
        float soft = tip > 150.0 ? 4.0 : 2.0;
        float shadow = clamp(0.5 - (sc - sw) / soft, 0.0, 1.0) * clamp(0.5 - (sa - tip) / soft, 0.0, 1.0) * clamp(0.5 + (sa + tail) / soft, 0.0, 1.0);
        c = over(vec4(0.0, 0.0, 0.0, 0.38 * shadow), c);
        float along = dot(q, dir), side = dot(q, nrm), across = abs(side);
        float t = clamp(along / tip, 0.0, 1.0);
        float hw = along >= 0.0 ? mix(w0, 0.9, pow(t, 0.9)) : w0 * 1.25;   // a slim taper, a wider tail
        float point = along > tip - w0 * 2.0 ? 1.0 - (along - (tip - w0 * 2.0)) / (w0 * 2.0) : 1.0;   // a sharp point
        hw *= max(point, 0.0);
        float body = cov(across - hw) * cov(along - tip) * cov(-tail - along);
        // the ridge: one side catches the light, the other is in shade, a bright line on top
        float lit = side / max(hw, 0.5) * sign(dir.x + 0.3);
        vec3 col = along >= 0.0 ? u_color * (0.92 + 0.22 * lit) : vec3(0.08) + 0.04 * lit;
        col = mix(col, min(u_color * 1.25 + vec3(0.18), vec3(1.0)), cov(across - max(hw * 0.18, 0.4)) * 0.6 * step(0.0, along));
        c = over(vec4(col, body), c);
        float r = length(q);
        float h = cov(r - hub);
        if (h > 0.0) {                                          // the cap: domed black, a highlight, a chrome edge
            vec2 hl = q / hub - vec2(-0.30, -0.38);
            vec3 hc = mix(vec3(0.015), vec3(0.11), clamp(0.6 - q.y / hub * 0.6, 0.0, 1.0));
            hc += vec3(0.55) * exp(-dot(hl, hl) * 9.0);
            float edge = cov(abs(r - (hub - 1.6)) - 1.4);
            vec3 ch = mix(vec3(0.85), vec3(0.25), clamp(q.y / hub * 0.5 + 0.5, 0.0, 1.0));
            hc = mix(hc, ch, edge * 0.9);
            c = over(vec4(hc, h), c);
        }
        if (tip > 150.0) {                                       // the glass over a big dial: a faint reflection
            float R = tip / 0.86;
            if (r < R) {
                vec2 g = q / R;
                float band = smoothstep(0.30, 0.0, abs(g.x * 0.55 + g.y + 0.45)) * smoothstep(1.0, 0.75, length(g));
                float rim = smoothstep(0.90, 1.0, length(g)) * clamp(-g.y, 0.0, 1.0);
                c = over(vec4(vec3(1.0), 0.06 * band + 0.10 * rim), c);
            }
        }
    }
    gl_FragColor = c;
}
`;

const SWEEPDASH = `// The Sweep theme in one cluster-render "effect" layer (GLSL ES 1.00): black, a segmented rev sweep along the top
// of the cluster that follows the hood line, four level bars, and a see-through six-sided map window.
//   u_arc    y of the sweep's top at the middle, the centre x, the curve's radius, the band's height (target px)
//   u_span   x at 0 rpm, x at the top of the scale
//   u_segs   segments in the sweep
//   u_rpm, u_red, u_yel  the rpm now, the start of the red zone and of the yellow zone below it, 0..1 of the scale
//   u_metal  1: a machined look for the silver colour, a sheen across the segments and a bright leading edge
//   u_wave   lit segments from here up to the red zone are yellow, 0..1 of the scale: it falls from the red zone to 0 as the revs
//            climb to the redline, so the yellow spreads back down the sweep
//   u_flash  1: the lit segments turn red for this frame of the shift flash
//   u_tail   x: the top of the scale from here (0..1 of the rpm) is one solid block, squeezed to y times its width (x above 1 = none)
//   u_curve  how the scale is spread along the band: 1 = even, above 1 = the top of the rev range gets more of the band
//   u_barA, u_barB, u_barC, u_barD, u_lvl  the bars' x, y, w, h (w 0 = none) and their levels 0..1 (x: A, y: B, z: C, w: D)
//   u_colA, u_colB, u_colD  the colours of bars A, B and D (C is u_amber)
//   u_marks  1: thin brackets round the first and last 4 segments of each bar (A and D cold in u_cold, hot in u_hot; B in u_colB,
//            C in u_amber)
//   u_hex, u_hexW  the map window: centre x, y of its top, widest point and bottom; half widths there (top 0 = none)
//   u_gap    a see-through box over BMW's gear letter in its bottom strip: x, y, w, h (w 0 = none). BMW draws a black box
//            of its own while a theme covers that letter (bimmer-lab, issue #5)
//   u_tab    a soft tab joined to the window: x, y, w, h (w 0 = none). What shows through it is dimmed and fades out at
//            its edges, so BMW's grey panel under it has no hard edge.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_arc;
uniform vec2 u_span;
uniform float u_segs;
uniform float u_rpm;
uniform float u_red;
uniform float u_yel;
uniform float u_wave;
uniform float u_flash;
uniform vec3 u_yellow;
uniform float u_curve;
uniform vec2 u_tail;
uniform float u_metal;
uniform vec4 u_barA;
uniform vec4 u_barB;
uniform vec4 u_barC;
uniform vec4 u_barD;
uniform vec4 u_lvl;
uniform vec3 u_colA;
uniform vec3 u_colB;
uniform vec3 u_colD;
uniform float u_marks;
uniform float u_bHot;   // 1: bar B is a temperature (intake air): no cold mark, the hot one in u_hot
uniform vec3 u_cold;
uniform vec4 u_hex;
uniform vec3 u_hexW;
uniform vec4 u_tab;
uniform vec4 u_gap;
uniform vec3 u_amber;
uniform vec3 u_hot;

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
float smax(float a, float b, float k) {                       // rounds the corner where two edges meet
    float h = clamp(0.5 + 0.5 * (a - b) / k, 0.0, 1.0);
    return mix(b, a, h) + k * h * (1.0 - h);
}
float side(vec2 q, vec2 a, vec2 b) {                          // px outside the edge a -> b
    return dot(q - a, normalize(vec2(b.y - a.y, a.x - b.x)));
}
vec3 bar(vec3 c, vec2 p, vec4 b, float lvl, vec3 lit) {
    if (b.z <= 0.0 || p.x < b.x - 2.0 || p.x > b.x + b.z + 14.0 || p.y < b.y - 2.0 || p.y > b.y + b.w + 2.0) return c;
    float dy = p.y - b.y;
    float s = (p.x - b.x + (dy - b.w) * 0.35) / b.z;
    float n = 24.0, f = fract(s * n), w = b.z / n;
    float seg = cov((abs(f - 0.47) - 0.42) * w) * cov(-dy) * cov(dy - b.w) * cov(-s * b.z) * cov((s - 1.0) * b.z);
    bool on = (floor(s * n) + 0.5) / n < lvl;
    float g = clamp(dy / b.w, 0.0, 1.0);
    return mix(c, on ? lit * mix(1.08, 0.66, g) : vec3(0.11) * mix(1.25, 0.8, g), seg);
}

// a bar's cold and hot ends: a thin bracket round its first 4 segments (under them and up the bar's start) and its last 4 (over them
// and down the bar's end), the sides on the segments' slant
vec3 marks(vec3 c, vec2 p, vec4 b, vec3 cold, vec3 hot) {
    if (b.z <= 0.0 || p.y < b.y - 10.0 || p.y > b.y + b.w + 10.0 || p.x < b.x - 40.0 || p.x > b.x + b.z + 20.0) return c;
    float g = max(4.0, b.w * 0.22), L = b.z, k = 4.0 / 24.0 * L;
    float e = p.x - b.x + (p.y - b.y - b.w) * 0.35;           // px along the bar from its start, on the slant
    float lo = b.y + b.w + g, hi = b.y - g;
    // cold: along the bottom, then up the start
    float cb = cov(abs(p.y - lo) - 0.9) * cov(-g - e) * cov(e - k + 2.0);
    float cs = cov(abs(e + g) - 0.9) * cov(b.y - p.y) * cov(p.y - lo);
    if (cold.r >= 0.0) c = mix(c, cold, max(cb, cs));   // a negative colour: no cold mark
    // hot: along the top, then down the end
    float ht = cov(abs(p.y - hi) - 0.9) * cov(L - k + 2.0 - e) * cov(e - L - g);
    float hs = cov(abs(e - L - g) - 0.9) * cov(hi - p.y) * cov(p.y - b.y - b.w);
    return mix(c, hot, max(ht, hs));
}

void main() {
    vec2 p = v_uv * u_size;
    vec3 c = vec3(0.0);
    float u = (p.x - u_arc.y) / u_arc.z;
    float top = u_arc.x + 0.5 * u_arc.z * u * u;              // the curve as a parabola: no huge numbers in the shader
    float dy = p.y - top, h = u_arc.w;
    float s = (p.x - dy * 0.45 - u_span.x) / (u_span.y - u_span.x);
    float rpm = clamp(u_rpm, 0.0, 1.0);
    if (dy > -60.0 && dy < h + 60.0) {
        float span = u_span.y - u_span.x;
        float along = span * s;
        // the band's position s to the rpm v: P = v ^ curve spreads the scale, and the tail above u_tail.x is squeezed
        float tail = min(u_tail.x, 1.0), P0 = pow(tail, u_curve), s0 = 1.0 - (1.0 - P0) * u_tail.y;
        float sc = max(s, 0.001);
        float P = sc <= s0 ? sc * P0 / s0 : P0 + (sc - s0) / u_tail.y;
        float dP = sc <= s0 ? P0 / s0 : 1.0 / u_tail.y;
        float v = pow(max(P, 0.0001), 1.0 / u_curve);         // the rpm (0..1) at this point of the band
        float width = span / (u_segs * (1.0 / u_curve) * pow(max(P, 0.0001), 1.0 / u_curve - 1.0) * dP);   // this segment's width in px
        float f = fract(v * u_segs);
        float band = cov(-dy) * cov(dy - h) * cov(-along) * cov((s - 1.0) * span);
        // segments too narrow to show their gaps merge into a solid strip, and the tail is one solid block
        float gaps = u_tail.x <= 1.0 && v > tail ? 0.0 : smoothstep(3.0, 7.0, width);
        float seg = band * mix(1.0, cov((abs(f - 0.47) - 0.40) * width), gaps);
        float mid = (floor(v * u_segs) + 0.5) / u_segs;
        bool on = mid < rpm;
        bool hot = mid >= u_red;
        bool yel = !hot && mid >= u_yel;
        bool litYel = !hot && mid >= min(u_yel, u_wave);
        // glass: each segment lit deepest at the bottom, a bright lip along the top
        float glass = clamp(dy / h, 0.0, 1.0);
        vec3 base = hot ? u_hot : litYel ? u_yellow : mix(u_amber * 0.80, u_amber, smoothstep(0.0, u_red, mid));
        vec3 lit = base * mix(1.08, 0.58, glass) + vec3(0.42) * cov(dy - 2.0);
        if (u_metal > 0.5) {
            lit += vec3(0.20) * exp(-pow((glass - 0.24) / 0.13, 2.0));              // the sheen
            if (!hot && !litYel) lit = mix(lit, vec3(1.0), 0.5 * smoothstep(rpm - 3.0 / u_segs, rpm, mid));   // the leading edge
        }
        if (u_flash > 0.5) lit = u_hot * mix(1.15, 0.65, glass) + vec3(0.42) * cov(dy - 2.0);
        vec3 off = (hot ? vec3(0.23, 0.03, 0.035) : yel ? vec3(0.20, 0.155, 0.03) : vec3(0.075)) * mix(1.5, 0.75, glass) + vec3(0.07) * cov(dy - 1.5);
        c = mix(c, on ? lit : off, seg);
        // a soft glow off the lit part
        if (s > 0.0 && v < rpm) {
            float dg = max(max(-dy, dy - h), 0.0);
            c += (hot || u_flash > 0.5 ? u_hot : litYel ? u_yellow : u_amber) * 0.10 * exp(-dg / 8.0) * (1.0 - seg) * smoothstep(rpm, rpm - 0.012, v);
        }
        // a tick under the band every 1000 rpm, the caller gives the scale by u_segs (10 segments a tick)
        float t = v * u_segs / 10.0, dt = abs(fract(t + 0.5) - 0.5) * 10.0 * width;
        if (s > -0.002 && s < 1.002) c = mix(c, vec3(0.74), cov(dt - 0.8) * cov(h + 5.0 - dy) * cov(dy - h - 13.0));
        // a hairline rail under the band, fading at both ends
        float railFade = smoothstep(0.0, 0.10, s) * smoothstep(1.0, 0.90, s);
        c = mix(c, vec3(0.50, 0.51, 0.54), cov(abs(dy - h - 5.0) - 0.55) * railFade);
    }
    c = bar(c, p, u_barA, u_lvl.x, u_colA);
    c = bar(c, p, u_barB, u_lvl.y, u_colB);
    c = bar(c, p, u_barC, u_lvl.z, u_amber);
    c = bar(c, p, u_barD, u_lvl.w, u_colD);
    if (u_marks > 0.5) {
        c = marks(c, p, u_barA, u_cold, u_hot);
        c = marks(c, p, u_barD, u_cold, u_hot);
        if (u_bHot > 0.5) c = marks(c, p, u_barB, u_amber, u_hot);   // intake air: the bar's silver at the start, red at the hot end
        else c = marks(c, p, u_barB, u_colB, u_colB);              // fuel: its bar's colour, yellow when low
        c = marks(c, p, u_barC, u_amber, u_amber);            // boost: the bar colour
    }
    float a = 1.0;
    if (u_hexW.x > 0.0) {
        vec2 q = vec2(abs(p.x - u_hex.x), p.y);
        vec2 t = vec2(u_hexW.x, u_hex.y), m = vec2(u_hexW.y, u_hex.z), b = vec2(u_hexW.z, u_hex.w);
        float d = smax(smax(u_hex.y - p.y, p.y - u_hex.w, 16.0), smax(side(q, t, m), side(q, m, b), 40.0), 24.0);
        a = clamp(d + 0.5, 0.0, 1.0);
        if (u_tab.z > 0.0) {
            float right = u_tab.x + u_tab.z;
            float open = smoothstep(u_tab.x, u_tab.x + 60.0, p.x)
                * smoothstep(u_tab.y, u_tab.y + 10.0, p.y) * smoothstep(u_tab.y + u_tab.w, u_tab.y + u_tab.w - 10.0, p.y)
                * step(p.x, right);
            float dim = 0.5 * smoothstep(right, right - 40.0, p.x);   // none where it meets the window
            a = min(a, 1.0 - open * (1.0 - dim));
        }
    }
    if (u_gap.z > 0.0) {
        vec2 hs = u_gap.zw * 0.5, e = abs(p - u_gap.xy - hs) - hs + vec2(8.0);
        a = min(a, clamp(length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - 8.0 + 0.5, 0.0, 1.0));
    }
    gl_FragColor = vec4(c, a);
}
`;

const CDASH = `// The Apex theme in one cluster-render "effect" layer (GLSL ES 1.00), layout made by tools/gen_apex.py: a black backdrop with
// a faint carbon weave and red-glow side panels (u_panels), a round needle rev counter (u_tach, u_tachA) whose outer band
// lights white up to the revs over fixed amber-to-red zones (u_zone), a red needle, up to 6 line bars with a marker and a red
// end zone (u_bar, u_barZ), and up to 8 thin rule lines (u_line). v_uv (0,0) is the top-left.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_tach;       // centre x, y, outer radius, band width (px)
uniform vec4 u_tachA;      // start angle (deg, clockwise from 3 o'clock), sweep (deg), thousands on the scale, revs 0..1
uniform vec2 u_zone;       // amber from, red from (0..1 of the scale)
uniform vec4 u_panels;     // left panel's inner edge x, right panel's inner edge x, glow top y, glow bottom y
uniform vec4 u_bar[8];     // left x, y, width (0 = none), value 0..1
uniform float u_barZ[8];   // each bar's red zone from (0..1; 1 = none)
uniform float u_barH[8];   // each bar's half height (px)
uniform float u_barS[8];   // each bar's style: 0 a line with a marker, 1 a slanted striped gauge with a scale and a needle, 2 the
                           // same solid, 3 / 4 the striped / solid gauge without the scale (the small bottom ones)
uniform vec4 u_line[8];    // rule lines: from x, y, to x, y (all 0 = none)
uniform float u_bgStyle;   // the backdrop: 0 the side panels' red glow on a faint weave, 1 carbon twill lit from the dial out
uniform vec4 u_car;        // the tyre panel's car seen from above: centre x, y, half width, half length (0 = none)
uniform vec4 u_tyre;       // its tyres FL, FR, RL, RR: 0 no reading (grey), 1 fine (green), 2 low (red)
uniform vec4 u_mapHole;    // the Waze map's round window in the dial: centre x, y, radius (0 = none), how dark its foot gets 0..1
uniform vec2 u_mapEdge;    // x: how wide its edge fades into the dial, px inward from the radius (0: a hard edge);
                           // y: the top of Waze's picture (the panel's centred 1088x480: y 120), faded in below it (0: none)
uniform vec4 u_glow;       // a soft glow fading outward from the gear's ring (0.5 of the radius): r, g, b, strength (0 = none)
uniform float u_plain;     // 1: no backdrop (carbon, weave, side glow), plain black (the "Backgrounds" setting off)
uniform vec2 u_shift;      // the shift light: x the count towards the shift point 0..1, y 1 while it flashes on (hud.js _shiftNow)
uniform vec2 u_wave;       // the warm-up zones (y 1, "Red zone" on Warm-up, as Sweep's): lit band from x (0..1) up to the yellow zone
                           // is yellow; the zones are then yellow then red, and the shift flash turns only the lit band red
uniform float u_tachStyle; // the rev counter's finish ("tachStyle"): 0 flat, 1 machined (chrome bezel, bowl face, bevelled band, fine
                           // marks, needle shadow), 2 lit segments (the band in segments that glow, a glass sheen), 3 layered rings
                           // (the band sunk in a channel between chrome rings, a notched inner ring, fine marks), 4 lit segments in
                           // the layered rings (2 and 3 together)

const vec3 WHITE = vec3(0.95, 0.96, 0.97);
const vec3 TRACK = vec3(0.16, 0.16, 0.18);
const vec3 RED = vec3(0.93, 0.09, 0.1);
const vec3 AMBER = vec3(0.95, 0.78, 0.1);

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec3 put(vec3 c, vec3 col, float a) { return mix(c, col, clamp(a, 0.0, 1.0)); }
float rboxd(vec2 p, vec2 c, vec2 h, float rad) {   // signed distance to a rounded box (centre, half size, corner)
    vec2 q = abs(p - c) - h + rad;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
}
float segd(vec2 p, vec2 a, vec2 b) {
    vec2 ba = b - a;
    float h = clamp(dot(p - a, ba) / max(dot(ba, ba), 0.001), 0.0, 1.0);
    return length(p - a - ba * h);
}
vec3 zoneCol(float f) {   // amber at the zone's start, through orange, to red at the red line
    float t = clamp((f - u_zone.x) / max(u_zone.y - u_zone.x, 0.001), 0.0, 1.0);
    vec3 orange = vec3(0.97, 0.45, 0.08);
    return t < 0.5 ? mix(AMBER, orange, t * 2.0) : mix(orange, RED, (t - 0.5) * 2.0);
}

void main() {
    vec2 p = v_uv * u_size;
    vec3 c;
    if (u_bgStyle > 0.5) {
        // carbon: a 2 x 2 twill (7 px strands, the over-strand two cells long, stepping one cell a row), lit brightest
        // round the dial and fading to black at the screen's sides, a little darker towards the bottom
        vec2 q = p / 7.0;
        vec2 cell = floor(q), fq = fract(q);
        bool across = mod(cell.x + cell.y, 4.0) < 2.0;
        float lit = across ? 0.62 + 0.38 * sin(3.14159 * fq.y) : 0.3 + 0.22 * sin(3.14159 * fq.x);
        lit *= smoothstep(0.0, 0.12, across ? fq.y : fq.x) * smoothstep(1.0, 0.88, across ? fq.y : fq.x) * 0.55 + 0.45;
        // lit along the dial's row, fading to black at the top and the bottom, a little at the sides (as Circuit's)
        float vert = 1.0 - smoothstep(40.0, u_size.y * 0.5 + 8.0, abs(p.y - u_tach.y));
        float side = 1.0 - 0.45 * smoothstep(u_size.x * 0.3, u_size.x * 0.5, abs(p.x - u_tach.x));
        c = vec3(0.086, 0.088, 0.094) * lit * pow(vert, 1.3) * side;
    } else {
        // near black with a faint carbon weave
        vec2 q = p / 6.0;
        vec2 cell = floor(q), fq = fract(q);
        float dir = mod(cell.x + cell.y, 2.0);
        float w = dir > 0.5 ? fq.x : fq.y;
        c = vec3(0.045, 0.046, 0.05) * (0.7 + 0.6 * (0.5 - abs(w - 0.5)));
    }
    // the side panels: a muted red glow strongest at the screen's outer edges, fading in towards the dial (to the
    // panel's inner edge), and out just above the bottom strip
    float sideL = 1.0 - smoothstep(0.0, u_panels.x, p.x);
    float sideR = smoothstep(u_panels.y, u_size.x, p.x);
    float glowS = max(sideL, sideR);
    float foot = 1.0 - smoothstep(u_panels.w - 80.0, u_panels.w, p.y);
    c += vec3(0.13, 0.014, 0.02) * glowS * glowS * foot * (1.0 - u_bgStyle);
    c *= 1.0 - u_plain;

    vec2 d = p - u_tach.xy;
    float r = length(d), R = u_tach.z, B = u_tach.w;
    // the finish's parts (u_tachStyle): 1 machined, 2 lit segments, 3 layered rings, 4 segments in the layered rings
    float ts = floor(u_tachStyle + 0.5);
    bool fMach = ts == 1.0, fSeg = ts == 2.0 || ts == 4.0, fLay = ts == 3.0 || ts == 4.0;
    bool fFine = fMach || fLay, fShadow = fMach || fLay, fSheen = fSeg;
    // the dial: drop shadow, a black face, a thin bezel
    // the shift light's red halo round the dial while it flashes
    if (r > R) c += vec3(0.9, 0.06, 0.05) * 0.5 * u_shift.y * exp(-(r - R) / 22.0);
    if (u_mapHole.z <= 0.0)   // no drop shadow while the map shows
    c *= 1.0 - 0.85 * (1.0 - smoothstep(R + 6.0, R + (u_bgStyle > 0.5 ? 60.0 : 50.0), length(d - vec2(0.0, 14.0))));
    // everything of the dial itself (face, bezel, band, marks, needle, sheen) lies within R + 21 px: a pixel further out
    // skips it all (most of this full-width layer, on every frame it is drawn)
    if (r < R + 26.0) {
    {
        vec3 face = mix(vec3(0.0), vec3(0.035, 0.036, 0.04), smoothstep(R * 0.3, R, r));
        if (u_tachStyle > 0.5) {
            // a shallow bowl: darker in the middle, a lit rim towards the top-left light, fine concentric brushing
            float lightA = 0.5 + 0.5 * dot(normalize(d + vec2(0.001)), vec2(-0.6, -0.8));
            face = mix(vec3(0.006), vec3(0.06, 0.062, 0.068), pow(smoothstep(R * 0.15, R + 6.0, r), 1.6));
            face *= 0.8 + 0.4 * lightA * smoothstep(R * 0.6, R, r);
            if (u_tachStyle < 1.5) face += vec3(0.006) * sin(r * 2.1) * smoothstep(R * 0.5, R * 0.6, r);
        }
        c = put(c, face, cov(r - R - 8.0));
    }
    {   // the thin bezel: all round, or while the map shows only along the band (0 to the top of the scale)
        float mapCut = u_mapHole.z > 0.0 ? step(mod(degrees(atan(d.y, d.x)) - u_tachA.x + 720.0, 360.0), u_tachA.y) : 1.0;
        if (!fMach && !fLay) {
            c = put(c, vec3(0.45, 0.46, 0.5), cov(abs(r - R - 8.0) - 1.2) * mapCut);
        } else {
            // a chrome ring: lit from the top-left, its profile rounded (bright crest, dark edges)
            float bw = fLay ? 3.5 : 6.5, bc = R + 8.0 + bw * 0.5;
            float prof = clamp(1.0 - abs(r - bc) / bw, 0.0, 1.0);
            float la = dot(normalize(d + vec2(0.001)), vec2(-0.6, -0.8));
            vec3 chrome = mix(vec3(0.12, 0.12, 0.14), vec3(0.86, 0.87, 0.9), clamp(0.5 + 0.45 * la, 0.0, 1.0) * (0.35 + 0.65 * prof * prof));
            chrome += vec3(0.35) * pow(max(la, 0.0), 12.0) * prof;    // the hot spot
            c = put(c, chrome, cov(abs(r - bc) - bw) * mapCut);
            if (fLay) {   // layered: a second, finer ring on the inside of the band and a dark channel between
                c = put(c, chrome * 0.8, cov(abs(r - (R - B - 6.0)) - 1.6) * mapCut);
            }
        }
    }
    if (u_glow.w > 0.0 && r > R * 0.5 - 1.0) {
        float gl = 1.0 - smoothstep(R * 0.5, R * 0.86, r);
        c += u_glow.rgb * u_glow.w * gl * gl;
    }
    c = put(c, vec3(0.14, 0.14, 0.16), cov(abs(r - R * 0.5) - 0.8));
    if (r > R * 0.55 && r < R + 4.0) {
        float rel = mod(degrees(atan(d.y, d.x)) - u_tachA.x + 720.0, 360.0);
        float f = rel / u_tachA.y;
        float on = step(f, 1.0);
        // the band: track, the zone always shown (dim), lit up to the revs
        float band = cov(-min(r - (R - B), R - r)) * on;
        vec3 z = zoneCol(f);
        bool inZone = f >= u_zone.x;
        vec3 off = inZone ? z * 0.35 : TRACK;
        vec3 lit = inZone ? z : mix(vec3(0.46, 0.47, 0.5), vec3(0.62, 0.63, 0.66), f);
        bool dyn = u_wave.y > 0.5, isLit = f <= u_tachA.w;
        if (dyn) {   // Sweep's: yellow zone then red, the lit band yellow from the wave up
            bool hot = f >= u_zone.y;
            off = hot ? RED * 0.35 : inZone ? AMBER * 0.35 : TRACK;
            lit = hot ? RED : (f >= min(u_zone.x, u_wave.x)) ? AMBER : lit;
        }
        vec3 bc = isLit ? lit : off;
        // the shift light: the band reddens over the count-in, then the whole band flashes bright red (warm-up zones: only
        // the lit band flashes)
        bc = mix(bc, vec3(0.75, 0.08, 0.07), u_shift.x * 0.45 * step(u_shift.y, 0.5));
        bc = mix(bc, vec3(1.0, 0.13, 0.1), u_shift.y * (dyn && !isLit ? 0.0 : 1.0));
        if (fLay) c = put(c, vec3(0.012), cov(-min(r - (R - B - 4.0), R + 3.0 - r)) * on);   // the groove
        if (fSeg) {
            // lit segments: the band cut into blocks (ten per thousand), the lit ones glowing outward and inward
            float nseg = u_tachA.z * 10.0, sf = f * nseg, within = fract(sf);
            float gapPx = min(within, 1.0 - within) * radians(u_tachA.y) / nseg * r;
            float blk = clamp(gapPx - 1.2, 0.0, 1.0);
            float lit2 = step(f, u_tachA.w);
            vec3 sc = bc * (0.78 + 0.22 * smoothstep(R - B, R, r));      // a touch brighter towards the outside
            if (fLay) sc *= 0.7 + 0.3 * smoothstep(0.0, 0.35 * B, r - (R - B));   // its inner edge in the groove's shadow
            c = put(c, sc, band * blk);
            float outD = r > R ? r - R : (R - B) - r;
            c += bc * lit2 * on * 0.35 * exp(-max(outD, 0.0) / 9.0) * (1.0 - band);
        } else if (u_tachStyle > 0.5) {
            // bevelled: lighter along the outer edge, darker along the inner, a fine highlight line on the outer lip;
            // layered: sunk in a dark channel, its inner edge in shadow
            float t = clamp((r - (R - B)) / B, 0.0, 1.0);
            vec3 bv = bc * (0.72 + 0.4 * t);
            if (fLay) bv *= 0.65 + 0.35 * smoothstep(0.0, 0.35, t);
            c = put(c, bv, band);
            c = put(c, mix(bc, vec3(1.0), 0.45), band * cov(abs(r - (R - 1.5)) - 0.8));
        } else {
            c = put(c, bc, band);
        }
        // marks: a long one every 1000, a short one every 500, red / amber in the zone
        float per = u_tachA.y / u_tachA.z;
        float m1 = abs(radians(mod(rel + per * 0.5, per) - per * 0.5)) * r;
        float m2 = abs(radians(mod(rel + per * 0.25, per * 0.5) - per * 0.25)) * r;
        vec3 mc = inZone ? (u_wave.y > 0.5 ? (f >= u_zone.y ? RED : AMBER) : zoneCol(f)) : WHITE;
        c = put(c, mc, cov(m1 - 1.6) * cov(abs(r - (R - B - 20.0)) - 13.0) * on);
        c = put(c, mc * 0.8, cov(m2 - 1.0) * cov(abs(r - (R - B - 13.0)) - 6.0) * on);
        if (fFine) {   // fine marks every 100 rpm
            float p10 = per * 0.1;
            float m3 = abs(radians(mod(rel + p10 * 0.5, p10) - p10 * 0.5)) * r;
            c = put(c, mc * 0.55, cov(m3 - 0.6) * cov(abs(r - (R - B - 9.0)) - 3.0) * on);
        }
        if (fLay) {   // the notched inner ring: a dark ring with a notch every 250 rpm
            float p4 = per * 0.25;
            float m4 = abs(radians(mod(rel + p4 * 0.5, p4) - p4 * 0.5)) * r;
            float ring = cov(abs(r - (R - B - 44.0)) - 3.0) * on;
            c = put(c, vec3(0.1, 0.1, 0.11), ring);
            c = put(c, inZone ? zoneCol(f) * 0.8 : vec3(0.55, 0.56, 0.6), ring * cov(m4 - 1.0));
        }
    }
    // the needle: red, with a soft glow
    {
        float a = radians(u_tachA.x + u_tachA.y * u_tachA.w);
        vec2 dir2 = vec2(cos(a), sin(a));
        float nd = segd(p, u_tach.xy + dir2 * R * 0.56, u_tach.xy + dir2 * (R - 2.0));
        float along = clamp(dot(d, dir2) / R, 0.0, 1.0);
        float wdt = mix(2.0, 3.6, along);
        if (fShadow) {   // a soft shadow cast down and right
            float sd = segd(p - vec2(5.0, 7.0), u_tach.xy + dir2 * R * 0.56, u_tach.xy + dir2 * (R - 2.0));
            c *= 1.0 - 0.6 * clamp(1.0 - (sd - wdt) / 8.0, 0.0, 1.0);
            wdt += 0.8;
        }
        c = put(c, RED * 0.6, clamp(1.0 - (nd - wdt) / 9.0, 0.0, 1.0) * 0.45);
        c = put(c, mix(RED, vec3(1.0, 0.55, 0.5), 0.25), cov(nd - wdt));
        if (u_tachStyle > 0.5) {   // a bright ridge down the needle's middle
            float side = dot(p - u_tach.xy, vec2(-dir2.y, dir2.x));
            c = put(c, vec3(1.0, 0.72, 0.68), cov(nd - wdt) * cov(abs(side) - 0.6) * 0.8);
        }
    }
    // the glass (lit segments): a faint sheen over the dial's upper left
    if (fSheen && r < R + 8.0) {
        vec2 q = (d - vec2(-R * 0.35, -R * 0.55)) / vec2(R * 0.95, R * 0.5);
        c += vec3(0.05, 0.052, 0.058) * (1.0 - smoothstep(0.2, 1.0, length(q))) * smoothstep(R * 0.5, R * 0.62, r);
    }
    }   // the dial
    // the line bars: track, red end zone, white fill to the value, a marker
    for (int i = 0; i < 8; i++) {
        vec4 b = u_bar[i];
        if (b.z <= 0.0) continue;
        if (u_barS[i] > 0.5) {
            // hatched gauge: a parallelogram leaning right, slanted stripes (white to the value, grey past it, red in
            // the red zone), a scale line with ticks above it, a red needle along the slant at the value
            float hh = u_barH[i], k = 0.45, dy = p.y - b.y;
            float xs = p.x + dy * k;
            float t = (xs - b.x) / b.z;
            float rz = u_barZ[i];
            float inside = step(abs(dy), hh) * step(0.0, t) * step(t, 1.0);
            float st = u_barS[i];
            bool solid = abs(st - 2.0) < 0.5 || st > 3.5, scaled = st < 2.5;
            float stripe = solid ? 1.0 : smoothstep(0.42, 0.5, fract(xs / 9.0)) * (1.0 - smoothstep(0.92, 1.0, fract(xs / 9.0)));   // 2: solid
            vec3 on = t >= rz ? RED : WHITE;
            vec3 off = t >= rz ? RED * 0.55 : vec3(0.24, 0.24, 0.27);
            c = put(c, t <= b.w ? on : off, inside * stripe);
            float ly = b.y - hh - 14.0, x0 = b.x + hh * k;
            float ts = (p.x - x0) / b.z;
            float onScale = step(0.0, ts) * step(ts, 1.0);
            if (scaled) c = put(c, vec3(0.55, 0.56, 0.6), cov(abs(p.y - ly) - 0.7) * onScale);
            float tk = abs(fract(ts * 10.0 + 0.5) - 0.5) * b.z / 10.0;
            float major = step(abs(fract(ts * 2.0 + 0.5) - 0.5) * b.z / 2.0, 1.5);
            float tl = major > 0.5 ? 10.0 : 6.0;
            if (scaled) c = put(c, vec3(0.55, 0.56, 0.6), cov(tk - 0.8) * step(ly - tl, p.y) * step(p.y, ly) * step(-0.02, ts) * step(ts, 1.02));
            float nx = b.x + b.z * b.w - dy * k;
            float nOn = scaled ? step(-(hh + 30.0), dy) * step(dy, hh + 12.0) : step(-(hh + 7.0), dy) * step(dy, hh + 7.0);
            c = put(c, RED, cov(abs(p.x - nx) * 0.91 - 1.4) * nOn);
            continue;
        }
        float t = (p.x - b.x) / b.z;
        float in1 = step(0.0, t) * step(t, 1.0);
        float hh = u_barH[i];
        float bar = cov(abs(p.y - b.y) - hh) * in1;
        float rz = u_barZ[i];
        c = put(c, t >= rz ? RED * 0.8 : vec3(0.42, 0.42, 0.45), bar);
        c = put(c, WHITE, bar * step(t, b.w));
        c = put(c, WHITE, cov(abs(p.x - (b.x + b.z * b.w)) - 2.0) * cov(abs(p.y - b.y) - hh - 7.5));
    }
    // the tyre panel's tyres, coloured by pressure; the car itself is an image over them (car_top.js), so only
    // their outer part shows past its body
    if (u_car.z > 0.0) {
        vec2 cc = u_car.xy, hb = u_car.zw;
        for (int k = 0; k < 4; k++) {
            float sx = (k == 0 || k == 2) ? -1.0 : 1.0, sy = k < 2 ? -1.0 : 1.0;
            float st = k == 0 ? u_tyre.x : k == 1 ? u_tyre.y : k == 2 ? u_tyre.z : u_tyre.w;
            vec2 tc = cc + vec2(sx * (hb.x + 3.0), sy * hb.y * 0.6);
            float td = rboxd(p, tc, vec2(8.0, 22.0), 6.0);
            vec3 tcol = st > 1.5 ? vec3(0.86, 0.16, 0.16) : st > 0.5 ? vec3(0.22, 0.72, 0.36) : vec3(0.3, 0.3, 0.33);
            c = put(c, tcol, cov(td));
        }
    }
    // rule lines
    for (int i = 0; i < 8; i++) {
        vec4 s = u_line[i];
        if (s.x == 0.0 && s.z == 0.0) continue;
        c = put(c, vec3(0.5, 0.5, 0.53), cov(segd(p, s.xy, s.zw) - 0.8));
    }
    // the map window: see-through inside the circle, fading to black over its lower part (the gear sits there)
    float alpha = 1.0;
    if (u_mapHole.z > 0.0) {
        vec2 mh = p - u_mapHole.xy;
        float inside = u_mapEdge.x > 0.5 ? 1.0 - smoothstep(u_mapHole.z - u_mapEdge.x, u_mapHole.z, length(mh)) : clamp(u_mapHole.z - length(mh) + 0.5, 0.0, 1.0);
        if (u_mapEdge.y > 0.0) inside *= smoothstep(u_mapEdge.y + 2.0, u_mapEdge.y + 50.0, p.y);   // nothing of the map above its picture
        float foot = smoothstep(u_mapHole.z * 0.3, u_mapHole.z * 0.78, mh.y) * u_mapHole.w;   // w: how dark the foot gets (0: none)
        alpha = 1.0 - inside * (1.0 - foot);
        c = mix(c, vec3(0.0), inside);
    }
    gl_FragColor = vec4(c, alpha);
}
`;

const LDASH = `// The Veloce theme in one cluster-render "effect" layer (GLSL ES 1.00), layout made by tools/gen_veloce.py: a hex-cell
// backdrop, a wide elliptical rev arc of bevelled blocks (u_arc, u_arcA) lit silver up to the revs and red from the redline
// (u_red), a grey band across the middle (u_band), and up to 4 small horizontal scales with a red end zone and a red needle
// (u_mini, u_miniZ). v_uv (0,0) is the top-left.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_arc;        // centre x, y, horizontal radius, vertical radius (outer edge of the blocks)
uniform vec4 u_arcA;       // start angle (deg, clockwise from 3 o'clock), sweep (deg), blocks, revs 0..1
uniform vec3 u_red;        // red from (0..1 of the scale), band thickness as a fraction of the radius, thousands
uniform vec4 u_band;       // the middle band: x, y, w, h (w 0 = none)
uniform vec4 u_mini[4];    // small scales: left x, y (the scale line), width (0 = none), value 0..1
uniform vec4 u_miniZ;      // each scale's red zone from (0..1; 1 = none)
uniform float u_plain;     // 1: no hex backdrop, plain black (the "Backgrounds" setting off)
uniform vec2 u_shift;      // the shift light: x the count towards the shift point 0..1, y 1 while it flashes on (hud.js _shiftNow)

const vec3 RED = vec3(0.95, 0.1, 0.1);

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec3 put(vec3 c, vec3 col, float a) { return mix(c, col, clamp(a, 0.0, 1.0)); }

// distance to the nearest hex cell edge (pointy-top hexagons, cell size s)
float hexEdge(vec2 p, float s) {
    vec2 r = vec2(1.0, 1.7320508);
    vec2 h = r * 0.5;
    vec2 a = mod(p / s, r) - h;
    vec2 b = mod(p / s - h, r) - h;
    vec2 g = dot(a, a) < dot(b, b) ? a : b;
    vec2 q = abs(g);
    float d = max(dot(q, normalize(vec2(1.0, 1.7320508))), q.x);
    return (0.5 - d) * s;           // px to the edge
}

void main() {
    vec2 p = v_uv * u_size;
    // backdrop: hex cells, their edges lit a little, brighter round the arc and fading to black at the sides and bottom
    float e = hexEdge(p, 34.0);
    vec2 an = (p - u_arc.xy) / u_arc.zw;
    float near = 1.0 - smoothstep(0.55, 1.45, length(an * vec2(0.85, 1.0)));
    float cell = 0.02 + 0.012 * near;
    vec3 c = vec3(cell) * vec3(0.95, 0.97, 1.0);
    c = put(c, vec3(0.085 + 0.07 * near) * vec3(0.95, 0.97, 1.0), cov(e - 1.1) * (0.3 + 0.6 * near));
    c *= 1.0 - 0.6 * smoothstep(0.6, 1.0, abs(v_uv.x - 0.5) * 2.0);
    c *= 1.0 - smoothstep(0.6, 0.95, v_uv.y);    // fading to black well above the bottom strip
    c *= 1.0 - u_plain;

    // the middle band: a grey strip, lighter in its middle, fading out at both ends
    if (u_band.z > 0.0) {
        float bx = (p.x - u_band.x) / u_band.z, by = (p.y - u_band.y) / u_band.w;
        if (bx > 0.0 && bx < 1.0 && by > 0.0 && by < 1.0) {
            float fade = smoothstep(0.0, 0.18, bx) * smoothstep(1.0, 0.82, bx);
            vec3 bc = mix(vec3(0.26, 0.27, 0.29), vec3(0.4, 0.41, 0.43), 1.0 - abs(by - 0.5) * 2.0);
            c = mix(c, bc, 0.85 * fade);
        }
    }

    // the rev arc: rounded "pillow" tiles round an ellipse in a dark trough, each with a light rim, a dark groove and a
    // face that darkens toward its edges; lit pale silver to the revs, muted red from the redline (glowing when lit), a
    // thin rail outside, a rail inside notched at each thousand, and a thin red needle across the tiles at the revs
    {
        float rn = length(an);
        float th = u_red.y;
        float ang = mod(degrees(atan(an.y, an.x)) - u_arcA.x + 720.0, 360.0);
        float f = ang / u_arcA.y;
        float onArc = step(f, 1.0);
        float n = u_arcA.z;
        float k = floor(f * n), within = fract(f * n);
        float mid = (k + 0.5) / n;
        bool red = mid >= u_red.x;
        bool lit = mid <= u_arcA.w;
        float rad = length(u_arc.zw * an / max(rn, 0.001));           // the ellipse's radius in px this way
        float pxA = radians(u_arcA.y) * rn * rad;                       // px along the arc for f 0..1 at this radius
        float rIn = 1.0 - th;
        // the trough: a dark bed under the tiles, 4 px wider each way
        float tr = max(rn - 1.0, rIn - rn) * rad;
        float ends = max(-f, f - 1.0) * pxA;
        float trough = max(tr, ends) - 4.0;
        c = put(c, vec3(0.018, 0.018, 0.022), cov(trough) * 0.92);
        // the tile: a rounded box in local px (along the arc, across the band)
        vec2 q = vec2((within - 0.5) * pxA / n, (rn - (1.0 - 0.5 * th)) * rad);
        vec2 hb = vec2(0.5 * pxA / n - 2.5, 0.5 * th * rad);
        float rr = 7.0;
        vec2 dq = abs(q) - hb + rr;
        float d = length(max(dq, 0.0)) + min(max(dq.x, dq.y), 0.0) - rr;   // < 0 inside
        float across = clamp((rn - rIn) / th, 0.0, 1.0);                 // 0 inner .. 1 outer edge
        float inTile = cov(d) * onArc * step(0.0, f);
        if (inTile > 0.0) {
            float depth = -d;                                            // px in from the tile's edge
            vec3 face, faceE, rim;
            if (red) {
                face = lit ? vec3(0.8, 0.14, 0.12) : vec3(0.38, 0.06, 0.065);
                faceE = lit ? vec3(0.5, 0.06, 0.06) : vec3(0.19, 0.03, 0.035);
                rim = lit ? vec3(0.92, 0.38, 0.32) : vec3(0.5, 0.15, 0.15);
                face *= 0.8 + 0.3 * across;
            } else if (lit) {
                face = mix(vec3(0.66, 0.66, 0.7), vec3(0.92, 0.92, 0.95), across);
                faceE = mix(vec3(0.42, 0.42, 0.47), vec3(0.62, 0.62, 0.67), across);
                rim = vec3(0.8, 0.8, 0.84);
            } else {
                face = mix(vec3(0.075, 0.075, 0.085), vec3(0.29, 0.29, 0.31), across * across);
                faceE = mix(vec3(0.045, 0.045, 0.05), vec3(0.15, 0.15, 0.165), across);
                rim = vec3(0.4, 0.4, 0.44);
            }
            // the shift light: every tile reddens over the count-in, then all of them flash bright red
            face = mix(face, vec3(0.75, 0.1, 0.08), u_shift.x * 0.4 * (1.0 - u_shift.y));
            face = mix(face, vec3(1.0, 0.16, 0.12), u_shift.y);
            faceE = mix(faceE, vec3(0.62, 0.06, 0.05), u_shift.y);
            rim = mix(rim, vec3(1.0, 0.5, 0.45), u_shift.y);
            vec2 ed = hb - abs(q) - 4.0;                                // px in from each pair of sides, past the groove
            float pil = smoothstep(0.0, 14.0, ed.x) * smoothstep(0.0, 18.0, ed.y);   // a soft pillow, no mitre creases
            vec3 tc = mix(faceE, face, sqrt(pil));
            tc = mix(tc, faceE * 0.45, cov(abs(depth - 3.3) - 0.9));     // the groove
            tc = mix(tc, rim, cov(depth - 1.8));                         // the rim
            c = put(c, tc, inTile);
        } else if (red && lit && f <= 1.0) {
            // a soft red glow round the lit redline tiles
            float away = max(rn - 1.0, rIn - rn) * rad;
            c += RED * 0.28 * (1.0 - smoothstep(0.0, 18.0, away));
        }
        vec3 rail = vec3(0.42, 0.42, 0.46);
        float inArc = onArc * step(0.0, f);
        // the outer rail
        c = put(c, rail, cov(abs((rn - 1.0) * rad - 9.0) - 0.8) * inArc);
        // the inner rail, notched inward at each thousand (a short step with slanted sides)
        float kk = f * u_red.z;
        float dk = abs(fract(kk + 0.5) - 0.5) / u_red.z * pxA;          // px along the arc to the nearest thousand
        float notch = 9.0 * (1.0 - smoothstep(10.0, 22.0, dk));
        float ri = (rn - rIn) * rad + 9.0 + notch;
        c = put(c, f >= u_red.x ? RED * 0.85 : rail, cov(abs(ri) - 0.8) * inArc);
        // the needle: a thin red line across the tiles at the revs
        if (u_arcA.w > 0.002) {
            float nd = abs(f - u_arcA.w) * pxA;
            float span = step(rIn - 12.0 / rad, rn) * step(rn, 1.0 + 12.0 / rad);
            c = put(c, vec3(1.0, 0.16, 0.12), cov(nd - 1.4) * span);
            c += RED * 0.25 * (1.0 - smoothstep(0.0, 8.0, nd)) * span;
        }
    }

    // the small scales: a line with ticks, a red end zone, a red needle at the value
    for (int i = 0; i < 4; i++) {
        vec4 m = u_mini[i];
        if (m.z <= 0.0) continue;
        float t = (p.x - m.x) / m.z;
        float on = step(-0.005, t) * step(t, 1.005);
        float rz = i == 0 ? u_miniZ.x : i == 1 ? u_miniZ.y : i == 2 ? u_miniZ.z : u_miniZ.w;
        c = put(c, vec3(0.75, 0.76, 0.8), cov(abs(p.y - m.y) - 0.9) * on);
        c = put(c, RED, cov(abs(p.y - m.y - 4.0) - 3.0) * step(rz, t) * on);
        float tk = abs(fract(t * 8.0 + 0.5) - 0.5) * m.z / 8.0;
        float major = step(abs(fract(t * 2.0 + 0.5) - 0.5) * m.z / 2.0, 1.5);
        c = put(c, t >= rz ? RED : vec3(0.75, 0.76, 0.8), cov(tk - 0.9) * step(m.y - (major > 0.5 ? 12.0 : 7.0), p.y) * step(p.y, m.y) * on);
        float nx = m.x + m.z * m.w;
        c = put(c, RED, cov(abs(p.x - nx) - 1.6) * step(m.y - 16.0, p.y) * step(p.y, m.y + 10.0));
    }
    gl_FragColor = vec4(c, 1.0);
}
`;

const GTEXT = `// GPU text with true spacing ("gtext", the "Fast numbers" setting), GLSL ES 1.00: each glyph of the R8 atlas bound to
// u_font (u_grid cells of u_cell px) drawn at its own x (u_xs, layer px, increasing), so italics keep their lean and a
// narrow "." its narrow place; a new value is one uniform message, no pixels. v_uv (0,0) is the top-left.
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_font;
uniform vec4 u_text[8];
uniform vec4 u_xs[8];
uniform float u_n;
uniform vec2 u_grid;
uniform vec2 u_cell;
uniform vec2 u_size;
uniform vec4 u_color;

float pick(vec4 v, float lane) { return lane < 0.5 ? v.x : lane < 1.5 ? v.y : lane < 2.5 ? v.z : v.w; }

void main() {
    vec2 p = v_uv * u_size;
    float ink = 0.0;
    for (int i = 0; i < 32; i++) {
        float fi = float(i);
        if (fi >= u_n) break;
        float slot = floor(fi / 4.0), lane = fi - slot * 4.0;
        vec4 tv = u_text[0], xv = u_xs[0];
        for (int j = 1; j < 8; j++) if (float(j) == slot) { tv = u_text[j]; xv = u_xs[j]; }
        float x0 = pick(xv, lane);
        if (x0 > p.x) break;
        float lx = p.x - x0;
        float c = pick(tv, lane);
        if (c < 0.0 || lx >= u_cell.x) continue;
        float col = mod(c, u_grid.x), row = floor(c / u_grid.x);
        vec2 uv = vec2((col * u_cell.x + lx) / (u_grid.x * u_cell.x), (row + p.y / u_cell.y) / u_grid.y);
        ink = max(ink, texture2D(u_font, uv).r);
    }
    gl_FragColor = vec4(u_color.rgb, u_color.a * ink);
}
`;

const GDASH = `// The Circuit theme in one cluster-render "effect" layer (GLSL ES 1.00), layout made by tools/gen_circuit.py: three round
// dials standing off a carbon backdrop (a cast shadow, a bevelled metal bezel): the rev counter in the middle (a tick track
// coloured blue to warm to red, a grooved red number band, a cream needle, the gear's red box), a two-scale gauge on the left
// (u_arc0 over the top, u_arc1 under the bottom, each a red band, ticks, a cream fill and pointer) and the tyres on the right
// (u_car, u_tyre: the car itself is an image over them). v_uv (0,0) is the top-left; angles are clockwise from 12 o'clock.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_tach;       // centre x, y, outer radius, revs 0..1
uniform vec4 u_tachA;      // start angle, sweep (deg), thousands on the scale, red from (0..1)
uniform float u_amber;     // amber from (0..1)
uniform vec4 u_left;       // the left dial: centre x, y, outer radius
uniform vec4 u_right;      // the right dial: centre x, y, outer radius
uniform vec4 u_arc0;       // the left dial's top scale: value 0..1, red from 0..1
uniform vec4 u_arc1;       // its bottom scale: value 0..1, red from 0..1
uniform vec4 u_gbox;       // the gear's box: centre x, y, half width, half height
uniform vec4 u_car;        // the right dial's car: centre x, y, half width, half length
uniform vec4 u_tyre;       // its tyres FL, FR, RL, RR: 0 no reading, 1 fine, 2 low
uniform float u_plain;     // 1: no backdrop, plain black (the "Backgrounds" setting off)
uniform vec3 u_bandCol;   // the number bands' colour (setting "circuitColor": red, yellow, blue)
uniform vec4 u_hole;       // the Waze map's window (w > 0 while it shows): the right dial's face, see-through
uniform vec2 u_shift;      // the shift light: x the count towards the shift point 0..1, y 1 while it flashes on (hud.js _shiftNow)

const vec3 CREAM = vec3(0.96, 0.91, 0.75);
const vec3 TICK = vec3(0.92, 0.92, 0.95);
const vec3 HOT = vec3(0.95, 0.12, 0.12);

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec3 put(vec3 c, vec3 col, float a) { return mix(c, col, clamp(a, 0.0, 1.0)); }
float ring(float r, float a, float b) { return cov(a - r) * cov(r - b); }
float rboxd(vec2 p, vec2 c, vec2 h, float rad) {
    vec2 q = abs(p - c) - h + rad;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
}
// a dial's body: what it does to the backdrop (shadow, rim light) and its bezel; returns the colour
vec3 body(vec3 c, vec2 d, float R) {
    float r = length(d), lit = 0.5 - 0.5 * d.y / max(r, 1.0), k = R / 322.0;
    float rs = length(d - vec2(0.0, 22.0 * k));
    if (r > R - 1.0) c *= 1.0 - 0.92 * exp(-max(rs - R + 10.0 * k, 0.0) / (55.0 * k));
    c += 0.22 * exp(-abs(r - R - 1.0) / 2.5) * clamp(-d.y / max(r, 1.0), 0.0, 1.0);
    float bz = 22.0 * k, inb = ring(r, R - bz, R);
    float cr = clamp((r - R + bz) / bz, 0.0, 1.0), crown = exp(-pow((cr - 0.45) / 0.22, 2.0));
    vec3 b = vec3(0.06 + 0.5 * pow(lit, 2.5) * crown + 0.08 * lit) * vec3(1.0, 1.0, 1.05);
    b *= 1.0 - 0.5 * (1.0 - lit) * (1.0 - crown * 0.5);
    c = put(c, vec3(0.0), cov(r - R));
    c = put(c, b, inb);
    c = put(c, vec3(0.32, 0.33, 0.36), ring(r, R - 1.2, R + 0.4) * 0.9);
    return c;
}
// the red band with fine machined grooves, lit from the top
vec3 redBand(float r, float lit) {
    float g = 0.86 + 0.14 * (0.5 + 0.5 * cos(r / 3.2 * 6.28318));
    return u_bandCol * g * (0.82 + 0.18 * lit);
}
// a tick across radius rr at angle a (rad) of length L and width w; p relative to the centre
float tick(vec2 d, float a, float ro, float L, float w) {
    vec2 u = vec2(sin(a), -cos(a));
    float t = clamp(dot(d, u), ro - L, ro);
    return cov(length(d - u * t) - w * 0.5);
}
// one scale of the left dial: a band from a0 sweeping sw (deg, sign = direction), 20 small steps, a big one every 5
vec3 arcScale(vec3 c, vec2 d, float R, float a0, float sw, vec4 v) {
    float r = length(d), lit = 0.5 - 0.5 * d.y / max(r, 1.0);
    float ang = degrees(atan(d.x, -d.y));
    float rel = sw > 0.0 ? mod(ang - a0 + 720.0, 360.0) : mod(a0 - ang + 720.0, 360.0);
    float f = rel / abs(sw);
    if (f > 1.5) f -= 360.0 / abs(sw);              // just before the start: a small negative fraction
    if (f < -0.03 || f > 1.03) return c;
    float on = step(0.0, f) * step(f, 1.0);
    float bandOn = on;                               // the band ends square at the first and the last number
    float inner = R - 22.0 * R / 322.0, tr1 = inner - 4.0, tr0 = inner - 40.0, rb1 = inner - 44.0, rb0 = inner - 98.0;
    c += vec3(0.3, 0.32, 0.36) * 0.07 * ring(r, tr0, tr1) * on;
    float mb = ring(r, rb0, rb1) * bandOn;
    c = put(c, redBand(r, lit), mb);
    c = put(c, mix(u_bandCol, vec3(1.0), 0.5), ring(r, rb1 - 1.5, rb1) * bandOn * 0.35);
    if (r > rb1 && r < tr1) c *= 1.0 - bandOn * 0.6 * exp(-(r - rb1) / 8.0);
    if (r < rb0) c *= 1.0 - bandOn * 0.6 * exp(-(rb0 - r) / 10.0);
    // ticks: the nearest of 21
    float i = floor(f * 20.0 + 0.5);
    float big = step(abs(mod(i, 5.0)), 0.5);
    float ta = radians(a0 + sw * i / 20.0);
    float m = i >= 0.0 && i <= 20.0 ? tick(d, ta, tr1 - 2.0, mix(12.0, 26.0, big), mix(1.6, 5.0, big)) : 0.0;
    c = put(c, i / 20.0 >= v.y - 0.001 && v.y < 0.999 ? HOT : TICK, m);   // red 1: no red zone
    c = put(c, vec3(0.85, 0.08, 0.1), ring(r, tr1 - 3.0, tr1 + 2.0) * on * step(v.y, f) * step(v.y, 0.999));
    c = put(c, CREAM, ring(r, tr0 - 1.0, tr0 + 4.0) * on * step(f, v.x));
    // the pointer: a cream wedge at the value
    float pa = radians(a0 + sw * v.x);
    vec2 u = vec2(sin(pa), -cos(pa)), n = vec2(-u.y, u.x);
    float t = dot(d, u), s = abs(dot(d, n));
    float tt = clamp((t - (rb1 - 4.0)) / (tr1 - rb1 + 2.0), 0.0, 1.0);
    float wdg = cov(s - mix(7.0, 2.0, tt)) * step(rb1 - 4.0, t) * step(t, tr1 - 2.0);
    c = put(c, CREAM, wdg);
    return c;
}

void main() {
    vec2 p = v_uv * u_size;
    // carbon fibre: a 2 x 2 twill of 7 px strands, lit brightest round the rev counter, darker at the sides and the foot
    vec2 q = p / 7.0;
    vec2 cell = floor(q), fq = fract(q);
    bool across = mod(cell.x + cell.y, 4.0) < 2.0;
    float wv = across ? fq.y : fq.x;
    float lc = across ? 0.62 + 0.38 * sin(3.14159 * fq.y) : 0.3 + 0.22 * sin(3.14159 * fq.x);
    lc *= smoothstep(0.0, 0.12, wv) * smoothstep(1.0, 0.88, wv) * 0.55 + 0.45;
    // lit along the dials' row, fading to black at the top and the bottom, a little at the sides
    float vert = 1.0 - smoothstep(40.0, u_size.y * 0.5 + 8.0, abs(p.y - u_tach.y));
    float side = 1.0 - 0.45 * smoothstep(u_size.x * 0.3, u_size.x * 0.5, abs(p.x - u_tach.x));
    vec3 c = vec3(0.086, 0.088, 0.094) * 1.35 * lc * pow(vert, 1.3) * side * (1.0 - u_plain);

    // --- the rev counter ---
    vec2 d = p - u_tach.xy;
    float R = u_tach.z, r = length(d), lit = 0.5 - 0.5 * d.y / max(r, 1.0);
    c = body(c, d, R);
    // the shift light: the bezel glows red and a red halo spreads round it while it flashes; the track reddens below
    {
        float bz = 22.0 * R / 322.0;
        c = mix(c, c * vec3(1.6, 0.35, 0.3) + vec3(0.55, 0.03, 0.02), ring(r, R - bz, R) * u_shift.y);
        if (r > R) c += vec3(0.9, 0.06, 0.05) * 0.55 * u_shift.y * exp(-(r - R) / 22.0);
    }
    // the left and right dials' bodies
    c = body(c, p - u_left.xy, u_left.z);
    c = body(c, p - u_right.xy, u_right.z);
    if (r < R - 21.0) {
        float k = R / 322.0, inner = R - 22.0 * k;
        float ang = degrees(atan(d.x, -d.y));
        float rel = mod(ang - u_tachA.x + 720.0, 360.0), f = rel / u_tachA.y, on = step(f, 1.0);
        float tr0 = R - 62.0 * k, tr1 = inner - 1.0, rb1 = R - 64.0 * k, rb0 = R - 150.0 * k;
        // the tick track's glow: blue low, warm high
        vec3 gc = mix(mix(vec3(0.05, 0.18, 0.6), vec3(0.25, 0.28, 0.35), smoothstep(0.0, 0.35, f)),
                      mix(vec3(0.45, 0.5, 0.2), vec3(0.6, 0.1, 0.05), smoothstep(0.8, 1.0, f)), smoothstep(0.35, 0.6, f));
        c += gc * ring(r, tr0, tr1) * on * (0.10 + 0.10 * clamp((r - tr0) / (tr1 - tr0), 0.0, 1.0));
        // the shift light on the track: a red wash growing over the count-in, bright red while it flashes
        c += vec3(0.85, 0.05, 0.04) * ring(r, tr0, tr1) * (u_shift.x * 0.22 * (1.0 - u_shift.y) + 0.75 * u_shift.y);
        // ticks every 100 rpm, longer every 500, bold every 1000
        float n = u_tachA.z * 10.0;
        float i = floor(f * n + 0.5);
        float big = step(mod(i, 10.0), 0.5), mid = step(abs(mod(i, 5.0)), 0.5);
        float L = big > 0.5 ? 34.0 * k : mid > 0.5 ? 16.0 * k : 9.0 * k;
        float w = big > 0.5 ? 5.5 * k : mid > 0.5 ? 1.8 * k : 1.2 * k;
        float fi = i / n;
        vec3 tc = fi >= u_tachA.w - 0.001 ? HOT : fi >= u_amber - 0.001 ? vec3(0.98, 0.82, 0.2) :
            mix(mix(vec3(0.45, 0.65, 1.0), vec3(0.9, 0.92, 0.95), smoothstep(0.0, 0.45, fi / u_amber)),
                vec3(0.8, 0.9, 0.35), smoothstep(0.75, 1.0, fi / u_amber));
        float tm = i >= 0.0 && i <= n ? tick(d, radians(u_tachA.x + u_tachA.y * fi), inner - 3.0 * k, L, w) : 0.0;
        c = put(c, tc, tm);
        c = put(c, vec3(0.85, 0.08, 0.1), ring(r, inner - 6.0 * k, inner - 1.0 * k) * on * step(u_tachA.w, f));
        // the bezel's lip shades the track's top
        if (r > rb1) c *= 1.0 - 0.6 * exp(-(inner - r) / 14.0) * lit;
        // the red number band, standing proud: its shadow on the track; the face sits down inside it
        c = put(c, redBand(r, lit), ring(r, rb0, rb1));
        c = put(c, mix(u_bandCol, vec3(1.0), 0.5), ring(r, rb1 - 1.5, rb1) * 0.35);
        if (r > rb1) c *= 1.0 - 0.75 * exp(-(r - rb1) / 10.0) * (0.6 + 0.4 * (1.0 - lit));
        if (r < rb0) {
            c = vec3(0.02, 0.02, 0.024) * clamp(1.0 - r / rb0, 0.0, 1.0);
            c = put(c, vec3(0.75, 0.76, 0.8), ring(r, rb0 - 2.6, rb0 - 0.6));
            if (r < rb0 - 2.6) c *= 1.0 - 0.75 * exp(-(rb0 - 2.6 - r) / 18.0) * (0.5 + 0.5 * lit);
            // the gear's red box
            float gb = rboxd(p, u_gbox.xy, u_gbox.zw, 5.0);
            c = put(c, vec3(0.86, 0.12, 0.14), cov(abs(gb) - 1.5));
        }
        // the needle: a soft shadow, the cream taper from a short tail to the track, the silver hub
        float na = radians(u_tachA.x + u_tachA.y * u_tach.w);
        vec2 u = vec2(sin(na), -cos(na)), nn = vec2(-u.y, u.x);
        float tip = R - 30.0 * k, tail = 42.0 * k;
        vec2 ds = d - vec2(4.0, 6.0);
        float ts = dot(ds, u), ss = abs(dot(ds, nn));
        float hw = mix(5.0, 1.6, clamp((ts + tail) / (tip + tail), 0.0, 1.0));
        c *= 1.0 - 0.55 * smoothstep(hw + 6.0, hw - 1.0, ss) * step(-tail, ts) * step(ts, tip);
        float t = dot(d, u), s = abs(dot(d, nn));
        hw = mix(5.0, 1.6, clamp((t + tail) / (tip + tail), 0.0, 1.0));
        c = put(c, vec3(0.957, 0.91, 0.745), cov(s - hw) * step(-tail, t) * step(t, tip));
        float hr = 26.0 * k;
        vec2 hd = d + vec2(3.0, 4.0) * (1.0 - r / hr);
        float hv = 70.0 + 150.0 * pow(clamp(1.0 - length(d + vec2(4.0, 5.0)) / hr, 0.0, 1.0), 0.7);
        c = put(c, vec3(hv, hv, hv + 6.0) / 255.0, cov(r - hr));
        c = put(c, vec3(0.16), cov(abs(r - hr) - 1.0));
    }

    // --- the left dial: two scales ---
    vec2 dl = p - u_left.xy;
    float rl = length(dl), inl = u_left.z - 22.0 * u_left.z / 322.0;
    if (rl < inl) {
        c *= 1.0 - 0.6 * exp(-(inl - rl) / 16.0) * (0.5 - 0.5 * dl.y / max(rl, 1.0));
        c = arcScale(c, dl, u_left.z, -68.0, 136.0, u_arc0);
        c = arcScale(c, dl, u_left.z, 248.0, -136.0, u_arc1);
        c = put(c, vec3(0.35, 0.36, 0.38), cov(abs(dl.y - 16.0) - 0.5) * step(abs(dl.x), 70.0));
    }
    // --- the right dial: the tyres, coloured by pressure (the car is an image over them) ---
    vec2 dr = p - u_right.xy;
    float rr = length(dr), inr = u_right.z - 22.0 * u_right.z / 322.0;
    if (rr < inr) {
        c = put(c, vec3(0.018 + 0.03 * clamp(1.0 - rr / inr, 0.0, 1.0)), 1.0);
        c *= 1.0 - 0.6 * exp(-(inr - rr) / 16.0) * (0.5 - 0.5 * dr.y / max(rr, 1.0));
        c = put(c, vec3(0.6, 0.61, 0.65), ring(rr, inr - 1.6, inr - 0.2) * 0.7);
        for (int k = 0; k < 4; k++) {
            float sx = (k == 0 || k == 2) ? -1.0 : 1.0, sy = k < 2 ? -1.0 : 1.0;
            float st = k == 0 ? u_tyre.x : k == 1 ? u_tyre.y : k == 2 ? u_tyre.z : u_tyre.w;
            vec2 tc2 = u_car.xy + vec2(sx * (u_car.z + 3.6), sy * u_car.w * 0.6);
            vec3 col = st > 1.5 ? vec3(0.86, 0.16, 0.16) : st > 0.5 ? vec3(0.24, 0.75, 0.36) : vec3(0.3, 0.3, 0.33);
            c = put(c, col, cov(rboxd(p, tc2, vec2(9.6, 26.4), 7.0)) * step(u_hole.z, 0.0));
        }
    }
    // the map in the right dial's face while it shows: see-through inside the inner ring (the map is a layer under this
    // one), its edge feathered over 14 px, its lower part a little darker
    float ma = u_hole.z > 0.0 ? clamp((inr - 3.0 - rr) / 14.0, 0.0, 1.0) * (1.0 - 0.35 * clamp(dr.y / inr, 0.0, 1.0)) : 0.0;
    float al = 1.0 - ma;
    gl_FragColor = vec4(c * (1.0 - ma) / max(al, 0.001), al);
}
`;

const ADASH = `// The Aero theme in one cluster-render "effect" layer (GLSL ES 1.00), layout made by tools/gen_aero.py: a deep navy
// backdrop; a full-width rev rail across the top (a silver top line over a four-band track, light to dark, a white line
// to the needle with an orange glow under it, outlined tabs at each thousand, a flat blade needle with a soft grey and a
// drop shadow, a red zone, fading at both sides); two small straight rails on the left (picked readings); four curved
// frame lines with a gradient and a drop shadow; the tyres round the car on the right; a slim curved fuel column.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_rail;       // the rail: top-line y at its middle, middle x, curve radius, track depth
uniform vec4 u_scale;      // x at 0 rpm, x at the top of the scale, thousands, revs 0..1
uniform vec2 u_zone;       // red from (0..1 of the scale), 0
uniform vec2 u_shift;      // the shift light: count 0..1, flash 0 / 1
uniform vec4 u_bars[2];    // the left rails: left x, top-line y, width, track depth
uniform vec4 u_barV;       // their values 0..1 (x, y), red from (z, w)
uniform vec4 u_frame[12];  // per frame: [x0, y0, x1, y1] the straight run, [cx, cy, r, 0] the bend, [x2, y2, x3, y3] the slant
uniform vec4 u_car;        // the car: centre x, y, tyre offset x, tyre offset y
uniform vec4 u_tyre;       // FL, FR, RL, RR: 0 no reading, 1 fine, 2 low
uniform vec4 u_fuel;       // the fuel column: bottom x, bottom y, top y, level 0..1
uniform float u_plain;     // 1: no backdrop (the "Backgrounds" setting off)
uniform vec4 u_hole;       // the Waze map window x, y, w, h (w 0 = none): see-through, its edge feathered over u_holeF px
uniform float u_holeF;
uniform float u_bgStyle;   // the backdrop (setting "aeroBackdrop"): 0 deep navy, 1 carbon, 2 brushed anthracite
uniform vec2 u_peakA;      // the peak boost (setting "vetroPeak"): its rail (0 / 1), its place 0..1 (< 0: none)

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec3 put(vec3 c, vec3 col, float a) { return mix(c, col, clamp(a, 0.0, 1.0)); }
float segd(vec2 p, vec2 a, vec2 b) {
    vec2 ba = b - a;
    float h = clamp(dot(p - a, ba) / max(dot(ba, ba), 0.001), 0.0, 1.0);
    return length(p - a - ba * h);
}
float rboxd(vec2 p, vec2 c, vec2 h, float r) { vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
// the four bands, lightest at the top: q 0..1 down the track; soft steps (a slight blur)
float bands(float q, float w) {
    return 0.34 - 0.12 * smoothstep(0.25 - w, 0.25 + w, q) - 0.08 * smoothstep(0.5 - w, 0.5 + w, q) - 0.06 * smoothstep(0.75 - w, 0.75 + w, q);
}
// a track: s px under its top line, T deep, lit to (behind, lead), red from (red 0/1); returns the colour over c
// mid: how near the middle of the screen (1 at it): the bar is lit from the middle, its top most, darkening outward
vec3 track(vec3 c, float s, float T, float behind, float lead, float red, float fade, float mid) {
    float q = clamp(s / T, 0.0, 1.0), w = 0.11;   // wide soft steps: the four bands blend into each other (looked rigid on the car)
    float inT = smoothstep(-1.0, 0.6, s) * smoothstep(T + 1.0, T - 0.6, s);
    float bv = bands(q, w) * (0.62 + 0.5 * mid) + 0.13 * mid * pow(1.0 - q, 2.0) + behind * (0.04 + 0.09 * lead) * (1.0 - 0.7 * q);
    vec3 tc = vec3(bv * 0.95, bv * 0.98, bv * 1.06);
    tc = mix(tc, tc * vec3(1.0, 0.4, 0.4) + vec3(0.32, 0.0, 0.0) * exp(-pow((q - 0.4) / 0.35, 2.0)), red);
    c = mix(c, tc, inT * fade);
    // the white line to the value, brightest at it; a faint halo
    float wl = clamp((0.13 * T - abs(s - 0.4 * T)) / 1.2, 0.0, 1.0) * behind * (0.1 + 0.9 * pow(lead, 0.9));
    c = mix(c, vec3(0.97, 0.98, 1.0), wl * fade);
    c += vec3(0.14) * exp(-pow((s - 0.4 * T) / (0.2 * T), 2.0)) * behind * lead * fade;
    // the orange glow under it
    float g = smoothstep(T, T + 2.0, s) * exp(-max(s - T, 0.0) / (T * 1.05)) * smoothstep(T * 2.9, T * 2.4, s);
    c += vec3(0.62, 0.2, 0.08) * g * behind * (0.25 + 0.75 * lead) * fade;
    // the silver top line, the dark lower edge
    c = mix(c, vec3(0.74, 0.76, 0.8) * (0.7 + 0.4 * mid), exp(-pow((s + 0.5) / 1.4, 2.0)) * fade);
    c *= 1.0 - 0.5 * exp(-pow((s - T) / 1.2, 2.0)) * fade;
    return c;
}
// an outlined tapered tab hanging from a top line: a along the line, b down; top bt, bottom bb, half widths w0, w1
vec3 tab(vec3 c, float a, float b, float bt, float bb, float w0, float w1, vec3 edge) {
    float hw = mix(w0, w1, clamp((b - bt) / (bb - bt), 0.0, 1.0));
    float d = max(abs(a) - hw, max(bt - b, b - bb));
    c = put(c, vec3(0.07, 0.078, 0.1), cov(d));
    return put(c, edge, cov(abs(d) - 0.9));
}

void main() {
    vec2 p = v_uv * u_size;
    // --- the backdrop: deep navy, lit behind the middle and along the rail, black at the corners and the foot
    vec2 X = vec2(p.x / 1920.0, p.y / 720.0);
    float gl = exp(-(pow((X.x - 0.5) / 0.42, 2.0) + pow((X.y - 0.42) / 0.55, 2.0)));
    vec3 c;
    if (u_bgStyle > 1.5) {
        // brushed anthracite: a fine horizontal grain (a hash per row, a little per 8 px along it), lit from the top middle
        float row = fract(sin(floor(p.y) * 12.9898) * 43758.55) - 0.5;
        float seg = fract(sin(floor(p.y) * 7.13 + floor(p.x / 8.0) * 3.71) * 24634.63) - 0.5;
        float gm = exp(-(pow((X.x - 0.5) / 0.55, 2.0) + pow((X.y - 0.3) / 0.6, 2.0)));
        float v = (0.02 + 0.075 * gm) * (1.0 + 0.06 * (row + 0.3 * seg));
        c = vec3(v * 0.96, v * 0.98, v * 1.04);
    } else if (u_bgStyle > 0.5) {
        // carbon: a 2 x 2 twill of 7 px strands, lit round the middle, fading to the edges
        vec2 q = p / 7.0;
        vec2 cell = floor(q), fq = fract(q);
        bool across = mod(cell.x + cell.y, 4.0) < 2.0;
        float wv = across ? fq.y : fq.x;
        float lc = across ? 0.62 + 0.38 * sin(3.14159 * fq.y) : 0.3 + 0.22 * sin(3.14159 * fq.x);
        lc *= smoothstep(0.0, 0.12, wv) * smoothstep(1.0, 0.88, wv) * 0.55 + 0.45;
        float gc = exp(-(pow((X.x - 0.5) / 0.5, 2.0) + pow((X.y - 0.45) / 0.5, 2.0)));
        float v = 0.11 * lc * gc;
        c = vec3(v, v * 1.02, v * 1.1);
    } else {
        float v = 0.012 + 0.10 * gl + 0.015 * exp(-pow((X.y - 0.2) / 0.16, 2.0));
        c = vec3(v * 0.45, v * 0.78, v * 1.25);
    }
    c *= 1.0 - u_plain;

    // --- the rev rail
    float T = u_rail.w, R = u_rail.z;
    float dx = p.x - u_rail.y, sl = dx / R;
    float yr = u_rail.x + dx * dx / (2.0 * R);
    float cs = inversesqrt(1.0 + sl * sl);
    float s = (p.y - yr) * cs;
    float f = (p.x - u_scale.x) / (u_scale.y - u_scale.x);
    float span = u_scale.y - u_scale.x;
    if (s > -30.0 && s < T + 150.0) {
        float fade = pow(clamp(min(p.x, u_size.x - p.x) / 220.0, 0.0, 1.0), 1.5);
        float behind = step(f, u_scale.w);
        float lead = pow(clamp(1.0 - (u_scale.w - f) * span / 700.0, 0.0, 1.0), 1.2);
        float red = smoothstep(u_zone.x, u_zone.x + 60.0 / span, f);
        c = track(c, s, T, behind, lead, red, fade, exp(-pow((p.x - u_size.x * 0.5) / 560.0, 2.0)));
        // the shift light: the track glows red over the count-in, bright red while it flashes
        float inT = step(0.0, s) * step(s, T) * fade;
        c = mix(c, vec3(0.95, 0.1, 0.08), inT * (0.35 * u_shift.x * (1.0 - u_shift.y) + 0.8 * u_shift.y));
        // the tab of the nearest thousand
        float k = clamp(floor(f * u_scale.z + 0.5), 0.0, u_scale.z);
        float xk = u_scale.x + span * k / u_scale.z, dk = xk - u_rail.y;
        vec2 Pk = vec2(xk, u_rail.x + dk * dk / (2.0 * R));
        vec2 tk = normalize(vec2(1.0, dk / R)), nk = vec2(-tk.y, tk.x);
        vec2 dp = p - Pk;
        bool redk = k / u_scale.z >= u_zone.x - 0.001;
        c = tab(c, dot(dp, tk), dot(dp, nk), -7.0, T + 12.0, 6.5, 3.5, redk ? vec3(0.8, 0.12, 0.12) : vec3(0.78, 0.8, 0.83));
        // the needle: a flat blade with a rounded head, centred on the revs from head to point, a soft grey down its right
        // side and to the point; its shadow
        float xn = u_scale.x + span * u_scale.w, dn = xn - u_rail.y;
        vec2 Pn = vec2(xn, u_rail.x + dn * dn / (2.0 * R));
        vec2 tn = normalize(vec2(1.0, dn / R)), nn = vec2(-tn.y, tn.x);
        float tip = T + 82.0;
        for (int i = 0; i < 2; i++) {
            vec2 q = p - Pn - (i == 0 ? vec2(7.0, 6.0) : vec2(0.0));
            float a = dot(q, tn), b = dot(q, nn);
            float t = clamp((b + 6.0) / (tip + 6.0), 0.0, 1.0);
            float ctr = 0.0, hw = mix(11.5, 1.2, t);
            float d = b < -6.0 ? length(vec2(a, (b + 6.0) / 0.9)) - 11.5 : max(abs(a - ctr) - hw, b - tip);
            if (i == 0) c *= 1.0 - 0.55 * smoothstep(7.0, -3.0, d);
            else {
                vec3 nc = vec3(0.886, 0.898, 0.922);
                nc = mix(nc, vec3(0.47, 0.486, 0.525), 0.55 * smoothstep(-0.2 * hw, hw, a - ctr) + 0.3 * smoothstep(0.55, 1.0, t));
                c = put(c, nc, cov(d));
            }
        }
    }

    // --- the left rails
    for (int i = 0; i < 2; i++) {
        vec4 B = u_bars[i];
        float bs = p.y - B.y, bx = p.x - B.x;
        if (bs < -20.0 || bs > B.w + 60.0 || bx < -40.0 || bx > B.z + 40.0) continue;
        float val = i == 0 ? u_barV.x : u_barV.y, rz = i == 0 ? u_barV.z : u_barV.w;
        float bf = bx / B.z;
        float fade = clamp(min(bx + 30.0, B.z + 30.0 - bx) / 30.0, 0.0, 1.0);
        float behind = step(0.0, bf) * step(bf, val);
        float lead = clamp(1.0 - (val - bf) * B.z / 260.0, 0.0, 1.0);
        c = track(c, bs, B.w, behind, lead, step(rz, bf) * step(bf, 1.03) * step(rz, 0.999), fade, 0.6 + 0.3 * exp(-pow((bf - 0.5) / 0.45, 2.0)));
        float kk = clamp(floor(bf * 4.0 + 0.5), 0.0, 4.0);
        c = tab(c, bx - B.z * kk / 4.0, bs, -4.0, B.w + 7.0, 4.0, 2.2, kk / 4.0 >= rz - 0.001 && rz < 0.999 ? vec3(0.8, 0.12, 0.12) : vec3(0.78, 0.8, 0.83));
        // the pointer: a small flat blade at the value, its shadow
        for (int j = 0; j < 2; j++) {
            vec2 q = vec2(bx - B.z * val, bs) - (j == 0 ? vec2(4.0, 4.0) : vec2(0.0));
            float t = clamp((q.y + 9.0) / (B.w + 24.0), 0.0, 1.0);
            float d = q.y < -9.0 ? length(q - vec2(0.0, -9.0)) - 5.5 : max(abs(q.x) - mix(5.5, 0.6, t), q.y - B.w - 15.0);
            if (j == 0) c *= 1.0 - 0.5 * smoothstep(5.0, -2.0, d);
            else c = put(c, mix(vec3(0.886, 0.898, 0.922), vec3(0.5, 0.51, 0.55), 0.5 * smoothstep(-2.0, 4.0, q.x)), cov(d));
        }
        // the peak boost: a hollow orange blade at the pull's peak (the same shape), a glow on the rail under it
        if (u_peakA.y >= 0.0 && abs(u_peakA.x - float(i)) < 0.5) {
            vec2 q = vec2(bx - B.z * u_peakA.y, bs);
            float t = clamp((q.y + 9.0) / (B.w + 24.0), 0.0, 1.0);
            float d = q.y < -9.0 ? length(q - vec2(0.0, -9.0)) - 5.5 : max(abs(q.x) - mix(5.5, 0.6, t), q.y - B.w - 15.0);
            c += vec3(1.0, 0.45, 0.1) * exp(-q.x * q.x / 20.0) * step(0.0, bs) * step(bs, B.w) * 0.35;
            c = put(c, vec3(1.0, 0.48, 0.1), cov(abs(d + 0.9) - 0.9));
        }
    }

    // --- the frame lines: a straight run, a bend, a slant; faint at the outer end, brightest from the bend on; a drop
    // shadow; a light core over a darker body
    for (int i = 0; i < 4; i++) {
        vec4 A = u_frame[i * 3], C = u_frame[i * 3 + 1], D = u_frame[i * 3 + 2];
        if (p.y < min(A.y, D.w) - 30.0 || p.y > max(A.y, D.w) + 30.0) continue;
        for (int j = 0; j < 2; j++) {
            vec2 q = p - (j == 0 ? vec2(3.0, 5.0) : vec2(0.0));
            float d = min(segd(q, A.xy, A.zw), segd(q, D.xy, D.zw));
            vec2 m = q - C.xy;
            vec2 e0 = A.zw - C.xy, e1 = D.xy - C.xy;
            if (e0.x * m.y - e0.y * m.x >= 0.0 == e0.x * e1.y - e0.y * e1.x >= 0.0 && m.x * e1.y - m.y * e1.x >= 0.0 == e0.x * e1.y - e0.y * e1.x >= 0.0)
                d = min(d, abs(length(m) - C.z));
            if (j == 0) c *= 1.0 - 0.6 * exp(-max(d - 2.0, 0.0) / 3.5);
            else {
                float run = clamp((q.x - A.x) / (A.z - A.x), 0.0, 1.0);
                float k = 0.12 + 0.88 * pow(run, 1.6);
                if (abs(q.x - A.x) > abs(A.z - A.x)) k = mix(1.0, 0.6, clamp(abs(q.x - A.z) / max(abs(D.z - A.z), 1.0), 0.0, 1.0));
                c = put(c, vec3(0.47, 0.486, 0.525) * k, cov(d - 2.0));
                c = put(c, vec3(0.92, 0.933, 0.96) * k, cov(d - 0.8) * 0.9);
            }
        }
    }

    // --- the tyres round the car (the car is an image over them): blue, red when low, grey without a reading
    for (int k = 0; k < 4; k++) {
        float sx = (k == 0 || k == 2) ? -1.0 : 1.0, sy = k < 2 ? -1.0 : 1.0;
        float st = k == 0 ? u_tyre.x : k == 1 ? u_tyre.y : k == 2 ? u_tyre.z : u_tyre.w;
        vec3 col = st > 1.5 ? vec3(0.88, 0.16, 0.16) : st > 0.5 ? vec3(0.27, 0.59, 1.0) : vec3(0.3, 0.3, 0.33);
        c = put(c, col, cov(rboxd(p, u_car.xy + vec2(sx * u_car.z, sy * u_car.w), vec2(9.0, 24.0), 6.0)));
    }

    // --- the fuel column: bowing a little, a dark track, a green fill with a glow, ticks every quarter reaching left
    {
        float t = (u_fuel.y - p.y) / (u_fuel.y - u_fuel.z);
        if (t > -0.2 && t < 1.1 && p.x > u_fuel.x - 60.0 && p.x < u_fuel.x + 40.0) {
            float tc = clamp(t, 0.0, 1.0);
            float xc = u_fuel.x - 12.0 * sin(3.14159 * tc) - 6.0 * tc;
            float dd = abs(p.x - xc), inCol = step(0.0, t) * step(t, 1.0);
            c *= 1.0 - 0.6 * exp(-max(abs(p.x - xc - 3.0) - 3.5, 0.0) / 4.0) * step(-0.02, t) * step(t, 1.02);
            c = put(c, vec3(0.149, 0.157, 0.18), cov(dd - 3.5) * inCol);
            c = put(c, vec3(0.275, 0.286, 0.314), cov(abs(p.x - xc + 1.5) - 1.0) * inCol);
            float on = inCol * step(t, u_fuel.w);
            c += vec3(0.16, 0.86, 0.31) * 0.35 * exp(-max(dd - 3.5, 0.0) / 6.0) * step(0.0, t) * step(t, u_fuel.w);
            c = put(c, vec3(0.18, 0.78, 0.3), cov(dd - 3.5) * on);
            c = put(c, vec3(0.59, 1.0, 0.67), cov(abs(p.x - xc + 0.5) - 1.0) * on);
            for (int k = 0; k < 5; k++) {
                float tk = float(k) * 0.25, yk = u_fuel.y - (u_fuel.y - u_fuel.z) * tk;
                float xk = u_fuel.x - 12.0 * sin(3.14159 * tk) - 6.0 * tk;
                float rx = k == 0 ? -12.0 : -26.0, lx = k == 0 ? 6.0 : 4.0;
                float al = k == 0 ? 1.0 : pow(clamp((p.x - xk - rx) / -rx, 0.0, 1.0), 1.4);
                c = put(c, vec3(0.92, 0.93, 0.95), cov(abs(p.y - yk) - 1.1) * step(xk + rx, p.x) * step(p.x, xk + lx) * al);
            }
        }
        // the filler side arrow beside the pump icon
        vec2 ar = p - vec2(u_fuel.x + 14.0, u_fuel.y + 32.0);
        c = put(c, vec3(0.92, 0.93, 0.95), cov(max(-ar.x, ar.x * 0.875 + abs(ar.y) - 7.0)));
    }
    // the map window: a rounded rect, see-through, its edge fading into the theme
    float alpha = 1.0;
    if (u_hole.z > 0.0) {
        vec2 hs = u_hole.zw * 0.5;
        float d = rboxd(p, u_hole.xy + hs, hs, 28.0);
        float inside = 1.0 - smoothstep(-u_holeF, 0.0, d);
        alpha = 1.0 - inside;
        c = mix(c, vec3(0.0), inside);
    }
    gl_FragColor = vec4(c, alpha);
}
`;

// Apex's dial as imported (0.20.0 .. 0.20.1, the last that ran on Jose's car without the cluster restarting): the default
// ("apexDial" Classic) while the crash with the newer one (0.21.0's finishes, CDASH) is looked into
const CDASH_CLASSIC = `// The Apex theme in one cluster-render "effect" layer (GLSL ES 1.00), layout made by tools/gen_apex.py: a black backdrop with
// a faint carbon weave and red-glow side panels (u_panels), a round needle rev counter (u_tach, u_tachA) whose outer band
// lights white up to the revs over fixed amber-to-red zones (u_zone), a red needle, up to 6 line bars with a marker and a red
// end zone (u_bar, u_barZ), and up to 8 thin rule lines (u_line). v_uv (0,0) is the top-left.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_tach;       // centre x, y, outer radius, band width (px)
uniform vec4 u_tachA;      // start angle (deg, clockwise from 3 o'clock), sweep (deg), thousands on the scale, revs 0..1
uniform vec2 u_zone;       // amber from, red from (0..1 of the scale)
uniform vec4 u_panels;     // left panel's inner edge x, right panel's inner edge x, glow top y, glow bottom y
uniform vec4 u_bar[8];     // left x, y, width (0 = none), value 0..1
uniform float u_barZ[8];   // each bar's red zone from (0..1; 1 = none)
uniform float u_barH[8];   // each bar's half height (px)
uniform float u_barS[8];   // each bar's style: 0 a line with a marker, 1 a slanted striped gauge with a scale and a needle, 2 the
                           // same solid, 3 / 4 the striped / solid gauge without the scale (the small bottom ones)
uniform vec4 u_line[8];    // rule lines: from x, y, to x, y (all 0 = none)
uniform float u_bgStyle;   // the backdrop: 0 the side panels' red glow on a faint weave, 1 carbon twill lit from the dial out
uniform vec4 u_car;        // the tyre panel's car seen from above: centre x, y, half width, half length (0 = none)
uniform vec4 u_tyre;       // its tyres FL, FR, RL, RR: 0 no reading (grey), 1 fine (green), 2 low (red)
uniform vec4 u_mapHole;    // the Waze map's round window in the dial: centre x, y, radius (0 = none), how dark its foot gets 0..1
uniform vec2 u_mapEdge;    // x: how wide its edge fades into the dial, px inward from the radius (0: a hard edge);
                           // y: the top of Waze's picture (the panel's centred 1088x480: y 120), faded in below it (0: none)
uniform vec4 u_glow;       // a soft glow fading outward from the gear's ring (0.5 of the radius): r, g, b, strength (0 = none)
uniform float u_plain;     // 1: no backdrop (carbon, weave, side glow), plain black (the "Backgrounds" setting off)
uniform vec2 u_shift;      // the shift light: x the count towards the shift point 0..1, y 1 while it flashes on (hud.js _shiftNow)

const vec3 WHITE = vec3(0.95, 0.96, 0.97);
const vec3 TRACK = vec3(0.16, 0.16, 0.18);
const vec3 RED = vec3(0.93, 0.09, 0.1);
const vec3 AMBER = vec3(0.95, 0.78, 0.1);

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec3 put(vec3 c, vec3 col, float a) { return mix(c, col, clamp(a, 0.0, 1.0)); }
float rboxd(vec2 p, vec2 c, vec2 h, float rad) {   // signed distance to a rounded box (centre, half size, corner)
    vec2 q = abs(p - c) - h + rad;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
}
float segd(vec2 p, vec2 a, vec2 b) {
    vec2 ba = b - a;
    float h = clamp(dot(p - a, ba) / max(dot(ba, ba), 0.001), 0.0, 1.0);
    return length(p - a - ba * h);
}
vec3 zoneCol(float f) {   // amber at the zone's start, through orange, to red at the red line
    float t = clamp((f - u_zone.x) / max(u_zone.y - u_zone.x, 0.001), 0.0, 1.0);
    vec3 orange = vec3(0.97, 0.45, 0.08);
    return t < 0.5 ? mix(AMBER, orange, t * 2.0) : mix(orange, RED, (t - 0.5) * 2.0);
}

void main() {
    vec2 p = v_uv * u_size;
    vec3 c;
    if (u_bgStyle > 0.5) {
        // carbon: a 2 x 2 twill (7 px strands, the over-strand two cells long, stepping one cell a row), lit brightest
        // round the dial and fading to black at the screen's sides, a little darker towards the bottom
        vec2 q = p / 7.0;
        vec2 cell = floor(q), fq = fract(q);
        bool across = mod(cell.x + cell.y, 4.0) < 2.0;
        float lit = across ? 0.62 + 0.38 * sin(3.14159 * fq.y) : 0.3 + 0.22 * sin(3.14159 * fq.x);
        lit *= smoothstep(0.0, 0.12, across ? fq.y : fq.x) * smoothstep(1.0, 0.88, across ? fq.y : fq.x) * 0.55 + 0.45;
        // lit along the dial's row, fading to black at the top and the bottom, a little at the sides (as Circuit's)
        float vert = 1.0 - smoothstep(40.0, u_size.y * 0.5 + 8.0, abs(p.y - u_tach.y));
        float side = 1.0 - 0.45 * smoothstep(u_size.x * 0.3, u_size.x * 0.5, abs(p.x - u_tach.x));
        c = vec3(0.086, 0.088, 0.094) * lit * pow(vert, 1.3) * side;
    } else {
        // near black with a faint carbon weave
        vec2 q = p / 6.0;
        vec2 cell = floor(q), fq = fract(q);
        float dir = mod(cell.x + cell.y, 2.0);
        float w = dir > 0.5 ? fq.x : fq.y;
        c = vec3(0.045, 0.046, 0.05) * (0.7 + 0.6 * (0.5 - abs(w - 0.5)));
    }
    // the side panels: a muted red glow strongest at the screen's outer edges, fading in towards the dial (to the
    // panel's inner edge), and out just above the bottom strip
    float sideL = 1.0 - smoothstep(0.0, u_panels.x, p.x);
    float sideR = smoothstep(u_panels.y, u_size.x, p.x);
    float glowS = max(sideL, sideR);
    float foot = 1.0 - smoothstep(u_panels.w - 80.0, u_panels.w, p.y);
    c += vec3(0.13, 0.014, 0.02) * glowS * glowS * foot * (1.0 - u_bgStyle);
    c *= 1.0 - u_plain;

    vec2 d = p - u_tach.xy;
    float r = length(d), R = u_tach.z, B = u_tach.w;
    // the dial: drop shadow, a black face, a thin bezel
    // the shift light's red halo round the dial while it flashes
    if (r > R) c += vec3(0.9, 0.06, 0.05) * 0.5 * u_shift.y * exp(-(r - R) / 22.0);
    if (u_mapHole.z <= 0.0)   // no drop shadow while the map shows
    c *= 1.0 - 0.85 * (1.0 - smoothstep(R + 6.0, R + (u_bgStyle > 0.5 ? 60.0 : 50.0), length(d - vec2(0.0, 14.0))));
    c = put(c, mix(vec3(0.0), vec3(0.035, 0.036, 0.04), smoothstep(R * 0.3, R, r)), cov(r - R - 8.0));
    {   // the thin bezel: all round, or while the map shows only along the band (0 to the top of the scale)
        float bz = cov(abs(r - R - 8.0) - 1.2);
        if (u_mapHole.z > 0.0) bz *= step(mod(degrees(atan(d.y, d.x)) - u_tachA.x + 720.0, 360.0), u_tachA.y);
        c = put(c, vec3(0.45, 0.46, 0.5), bz);
    }
    if (u_glow.w > 0.0 && r > R * 0.5 - 1.0) {
        float gl = 1.0 - smoothstep(R * 0.5, R * 0.86, r);
        c += u_glow.rgb * u_glow.w * gl * gl;
    }
    c = put(c, vec3(0.14, 0.14, 0.16), cov(abs(r - R * 0.5) - 0.8));
    if (r > R * 0.55 && r < R + 4.0) {
        float rel = mod(degrees(atan(d.y, d.x)) - u_tachA.x + 720.0, 360.0);
        float f = rel / u_tachA.y;
        float on = step(f, 1.0);
        // the band: track, the zone always shown (dim), lit up to the revs
        float band = cov(-min(r - (R - B), R - r)) * on;
        vec3 z = zoneCol(f);
        bool inZone = f >= u_zone.x;
        vec3 off = inZone ? z * 0.35 : TRACK;
        vec3 lit = inZone ? z : mix(vec3(0.46, 0.47, 0.5), vec3(0.62, 0.63, 0.66), f);
        vec3 bc = f <= u_tachA.w ? lit : off;
        // the shift light: the band reddens over the count-in, then the whole band flashes bright red
        bc = mix(bc, vec3(0.75, 0.08, 0.07), u_shift.x * 0.45 * step(u_shift.y, 0.5));
        bc = mix(bc, vec3(1.0, 0.13, 0.1), u_shift.y);
        c = put(c, bc, band);
        // marks: a long one every 1000, a short one every 500, red / amber in the zone
        float per = u_tachA.y / u_tachA.z;
        float m1 = abs(radians(mod(rel + per * 0.5, per) - per * 0.5)) * r;
        float m2 = abs(radians(mod(rel + per * 0.25, per * 0.5) - per * 0.25)) * r;
        vec3 mc = inZone ? zoneCol(f) : WHITE;
        c = put(c, mc, cov(m1 - 1.6) * cov(abs(r - (R - B - 20.0)) - 13.0) * on);
        c = put(c, mc * 0.8, cov(m2 - 1.0) * cov(abs(r - (R - B - 13.0)) - 6.0) * on);
    }
    // the needle: red, with a soft glow
    {
        float a = radians(u_tachA.x + u_tachA.y * u_tachA.w);
        vec2 dir2 = vec2(cos(a), sin(a));
        float nd = segd(p, u_tach.xy + dir2 * R * 0.56, u_tach.xy + dir2 * (R - 2.0));
        float along = clamp(dot(d, dir2) / R, 0.0, 1.0);
        float wdt = mix(2.0, 3.6, along);
        c = put(c, RED * 0.6, clamp(1.0 - (nd - wdt) / 9.0, 0.0, 1.0) * 0.45);
        c = put(c, mix(RED, vec3(1.0, 0.55, 0.5), 0.25), cov(nd - wdt));
    }
    // the line bars: track, red end zone, white fill to the value, a marker
    for (int i = 0; i < 8; i++) {
        vec4 b = u_bar[i];
        if (b.z <= 0.0) continue;
        if (u_barS[i] > 0.5) {
            // hatched gauge: a parallelogram leaning right, slanted stripes (white to the value, grey past it, red in
            // the red zone), a scale line with ticks above it, a red needle along the slant at the value
            float hh = u_barH[i], k = 0.45, dy = p.y - b.y;
            float xs = p.x + dy * k;
            float t = (xs - b.x) / b.z;
            float rz = u_barZ[i];
            float inside = step(abs(dy), hh) * step(0.0, t) * step(t, 1.0);
            float st = u_barS[i];
            bool solid = abs(st - 2.0) < 0.5 || st > 3.5, scaled = st < 2.5;
            float stripe = solid ? 1.0 : smoothstep(0.42, 0.5, fract(xs / 9.0)) * (1.0 - smoothstep(0.92, 1.0, fract(xs / 9.0)));   // 2: solid
            vec3 on = t >= rz ? RED : WHITE;
            vec3 off = t >= rz ? RED * 0.55 : vec3(0.24, 0.24, 0.27);
            c = put(c, t <= b.w ? on : off, inside * stripe);
            float ly = b.y - hh - 14.0, x0 = b.x + hh * k;
            float ts = (p.x - x0) / b.z;
            float onScale = step(0.0, ts) * step(ts, 1.0);
            if (scaled) c = put(c, vec3(0.55, 0.56, 0.6), cov(abs(p.y - ly) - 0.7) * onScale);
            float tk = abs(fract(ts * 10.0 + 0.5) - 0.5) * b.z / 10.0;
            float major = step(abs(fract(ts * 2.0 + 0.5) - 0.5) * b.z / 2.0, 1.5);
            float tl = major > 0.5 ? 10.0 : 6.0;
            if (scaled) c = put(c, vec3(0.55, 0.56, 0.6), cov(tk - 0.8) * step(ly - tl, p.y) * step(p.y, ly) * step(-0.02, ts) * step(ts, 1.02));
            float nx = b.x + b.z * b.w - dy * k;
            float nOn = scaled ? step(-(hh + 30.0), dy) * step(dy, hh + 12.0) : step(-(hh + 7.0), dy) * step(dy, hh + 7.0);
            c = put(c, RED, cov(abs(p.x - nx) * 0.91 - 1.4) * nOn);
            continue;
        }
        float t = (p.x - b.x) / b.z;
        float in1 = step(0.0, t) * step(t, 1.0);
        float hh = u_barH[i];
        float bar = cov(abs(p.y - b.y) - hh) * in1;
        float rz = u_barZ[i];
        c = put(c, t >= rz ? RED * 0.8 : vec3(0.42, 0.42, 0.45), bar);
        c = put(c, WHITE, bar * step(t, b.w));
        c = put(c, WHITE, cov(abs(p.x - (b.x + b.z * b.w)) - 2.0) * cov(abs(p.y - b.y) - hh - 7.5));
    }
    // the tyre panel's tyres, coloured by pressure; the car itself is an image over them (car_top.js), so only
    // their outer part shows past its body
    if (u_car.z > 0.0) {
        vec2 cc = u_car.xy, hb = u_car.zw;
        for (int k = 0; k < 4; k++) {
            float sx = (k == 0 || k == 2) ? -1.0 : 1.0, sy = k < 2 ? -1.0 : 1.0;
            float st = k == 0 ? u_tyre.x : k == 1 ? u_tyre.y : k == 2 ? u_tyre.z : u_tyre.w;
            vec2 tc = cc + vec2(sx * (hb.x + 3.0), sy * hb.y * 0.6);
            float td = rboxd(p, tc, vec2(8.0, 22.0), 6.0);
            vec3 tcol = st > 1.5 ? vec3(0.86, 0.16, 0.16) : st > 0.5 ? vec3(0.22, 0.72, 0.36) : vec3(0.3, 0.3, 0.33);
            c = put(c, tcol, cov(td));
        }
    }
    // rule lines
    for (int i = 0; i < 8; i++) {
        vec4 s = u_line[i];
        if (s.x == 0.0 && s.z == 0.0) continue;
        c = put(c, vec3(0.5, 0.5, 0.53), cov(segd(p, s.xy, s.zw) - 0.8));
    }
    // the map window: see-through inside the circle, fading to black over its lower part (the gear sits there)
    float alpha = 1.0;
    if (u_mapHole.z > 0.0) {
        vec2 mh = p - u_mapHole.xy;
        float inside = u_mapEdge.x > 0.5 ? 1.0 - smoothstep(u_mapHole.z - u_mapEdge.x, u_mapHole.z, length(mh)) : clamp(u_mapHole.z - length(mh) + 0.5, 0.0, 1.0);
        if (u_mapEdge.y > 0.0) inside *= smoothstep(u_mapEdge.y + 2.0, u_mapEdge.y + 50.0, p.y);   // nothing of the map above its picture
        float foot = smoothstep(u_mapHole.z * 0.3, u_mapHole.z * 0.78, mh.y) * u_mapHole.w;   // w: how dark the foot gets (0: none)
        alpha = 1.0 - inside * (1.0 - foot);
        c = mix(c, vec3(0.0), inside);
    }
    gl_FragColor = vec4(c, alpha);
}
`;

// The revs on the renderer's clock (the "smoothRevs" setting; hud.js REV_PATH): a layer made with "time" 1 gets u_time
// every display frame, and the app sends the revs as a path in that clock (u_revT its four keys' times, the first in
// u_time's seconds, the others after it; u_revV their values, 0..1 of the scale; shared/e36.js nextPathTo), so the
// band and needle move on every frame instead of at the app's 20 Hz. u_revOn 0 (the setting off, or no path yet): the
// tick's own value, as before. withRevPath(src, expr) adds this to a shader whose revs are the uniform expression
// expr: every other use of expr reads g_rv, worked out once at the top of main().
const REV_PATH = `
uniform float u_time;
uniform vec4 u_revT;
uniform vec4 u_revV;
uniform float u_revOn;
float g_rv;
float revPath(float tick) {
    if (u_revOn < 0.5) return tick;
    float s = u_time - u_revT.x;
    s -= 3600.0 * floor((s + 1800.0) / 3600.0);
    if (s < -0.25) return u_revV.x;
    if (s < u_revT.y) return u_revV.x + (u_revV.y - u_revV.x) * s / max(u_revT.y, 0.0001);
    if (s < u_revT.z) return u_revV.y + (u_revV.z - u_revV.y) * (s - u_revT.y) / max(u_revT.z - u_revT.y, 0.0001);
    return u_revV.z + (u_revV.w - u_revV.z) * min(1.0, (s - u_revT.z) / max(u_revT.w - u_revT.z, 0.0001));
}
`;
function withRevPath(src, expr) {
    const at = src.indexOf('void main() {');
    if (at < 0) throw new Error('withRevPath: no main()');
    const head = src.slice(0, at), body = src.slice(at + 'void main() {'.length);
    const esc = expr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const use = new RegExp('(^|[^A-Za-z0-9_])' + esc + '(?![A-Za-z0-9_])', 'g');
    // uses in the helper functions above main() too, but not the uniform's own declaration
    const head2 = head.split('\n').map((l) => (/^\s*uniform\b/.test(l) ? l : l.replace(use, '$1g_rv'))).join('\n');
    return head2 + REV_PATH + 'void main() {\n    g_rv = revPath(' + expr + ');' + body.replace(use, '$1g_rv');
}

const RDASH = `// The Vetro theme in one cluster-render "effect" layer (GLSL ES 1.00), layout made by tools/gen_vetro.py: a perforated
// metal floor seen low (dots on a perspective grid, lit in front, black in the distance) with the dash's shadows, a soft
// reflection of the dial and the red lines' glow on it; the rev counter in the middle under glass (a raised metal bezel,
// a ladder of ticks with a dot at each thousand, red past the redline, guide lines, two inner rings, a recessed hub, a
// red needle with a glow and a centre cap; the face black, red or yellow by the "vetroDial" setting); see-through navy
// boxes for the speed and the gear; a borderless blue panel on the left, fading into the dial, with four recessed bars;
// the fuel cells under it; a framed glass panel on the right with red lines, the drive mode's stroke and the tyres'
// boxes. All numbers and words are text layers over it.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_tach;       // centre x, y, outer radius (to the bezel's inside), revs 0..1
uniform vec4 u_scale;      // 0 at this angle (deg clockwise from 12 o'clock), sweep deg, thousands, red from 0..1
uniform vec2 u_shift;      // the shift light: count 0..1, flash 0 / 1
uniform float u_dial;      // the face: 0 black, 1 red, 2 yellow
uniform vec4 u_left;       // the left panel: its left end x, top y, bottom y, how far that end bows out
uniform vec4 u_right;      // the right panel: top y, bottom y, its right end's x at the top, at the bottom
uniform vec4 u_bars[4];    // the left bars: x, y, width, value 0..1
uniform vec4 u_fuel;       // the fuel cells: x, y, width, level 0..1
uniform vec4 u_car;        // the tyres: the car's centre x, y, the boxes' x offset, the wheels' y offset
uniform vec4 u_tyre;       // FL, FR, RL, RR: 0 no reading, 1 fine, 2 low
uniform float u_plain;     // 1: no floor (the "Backgrounds" setting off)
uniform vec4 u_hole;       // the Waze map's window in the left panel while it shows: x, y, w, h (w 0: none)
uniform vec4 u_tbox;       // the tyre boxes' half width, half height, the wheels' x offset, the wheels' scale
uniform float u_bright;    // "vetroBright": 1 the brighter look (a lifted face, more sheen, lighter panels, full white)
uniform vec3 u_curve;      // the rev scale ("revScale", Sweep's): x the spread (the angle goes as (rpm / max) ^ x; 1 even); past y
                           // (that spread's value at the tail's start) the rest squeezed to z times its width (Sweep's tail; z 1: none)
uniform vec4 u_sweep;      // (jsalicru) x 1: the ticks light as Sweep's with the needle kept ("vetroRev" sweep); y the red zone's start (lower on a cold engine, every rev display), z the yellow zone's, w the wave (lit ticks yellow from here), 0..1 of the scale
uniform vec3 u_rev;        // "vetroRev": x 1 the lit ladder (no needle), 0 the needle; y the revs' peak 0..1, z its fade 1..0
uniform float u_peak;      // the peak boost on the first bar, 0..1 (< 0: none; setting "vetroPeak")
uniform vec4 u_media;      // now playing on the right ("vetroRight" music): the progress track's x, y (its middle), width, the song's position 0..1; width 0: none

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec3 put(vec3 c, vec3 col, float a) { return mix(c, col, clamp(a, 0.0, 1.0)); }
float rbox(vec2 p, vec2 c, vec2 h, float r) { vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float segd(vec2 p, vec2 a, vec2 b) {
    vec2 ba = b - a;
    float h = clamp(dot(p - a, ba) / dot(ba, ba), 0.0, 1.0);
    return length(p - a - ba * h);
}
// the lit ladder's colour at t (0..1 of the scale): cool blue-white, warm white, amber, orange, red
vec3 revCol(float t) {
    vec3 c = mix(vec3(0.45, 0.62, 0.95), vec3(0.85, 0.9, 1.0), smoothstep(0.0, 0.35, t));
    c = mix(c, vec3(1.0, 0.72, 0.3), smoothstep(0.35, 0.62, t));
    c = mix(c, vec3(1.0, 0.4, 0.1), smoothstep(0.62, 0.8, t));
    return mix(c, vec3(1.0, 0.1, 0.07), smoothstep(0.8, 0.92, t));
}

void main() {
    vec2 p = v_uv * u_size;
    vec2 C = u_tach.xy;
    float R = u_tach.z;
    vec2 q = p - C;
    float d = length(q);
    float up = clamp(-q.y / R, -1.0, 1.0);          // 1 at the dial's top, -1 at its foot
    vec3 BLUE = vec3(0.62, 0.70, 0.82);
    vec3 RED = vec3(0.92, 0.10, 0.08);

    // --- the floor: a perforated plate, dots on a perspective grid; lit in a pool in front, black toward the horizon
    float dy = max(p.y - 40.0, 1.0);
    float z = 700.0 / dy;
    vec2 g = vec2((p.x - 960.0) * z / 21.0, z * 24.0);
    vec2 ga = g - floor(g + 0.5), gb = g + 0.5 - floor(g + 1.0);
    vec2 e = dot(ga, ga) < dot(gb, gb) ? ga : gb;
    float r = length(e);
    float foot = max(z / 21.0, 16800.0 / (dy * dy));     // cells per px: past ~0.35 the dots fade to their average
    float aa = max(foot, 0.02);
    float dome = clamp((0.30 - r) / aa, 0.0, 1.0);
    float tone = dome * (0.35 + 0.65 * clamp(1.0 - r * r / 0.09, 0.0, 1.0)) * (0.55 + 0.45 * clamp(-e.y / 0.3, -1.0, 1.0)) + (1.0 - dome) * 0.10;
    tone *= 1.0 - 0.6 * exp(-pow((r - 0.335) / 0.03, 2.0)) * (1.0 - clamp(foot * 3.0, 0.0, 1.0));
    tone = mix(tone, 0.2, clamp((foot - 0.2) / 0.3, 0.0, 1.0));
    float yy = clamp((p.y - 40.0) / 680.0, 0.0, 1.0);
    float pool = pow(yy, 1.3) * exp(-pow((p.x - 960.0) / 1056.0, 2.0) * 1.2);
    float lum = tone * (0.045 + 0.38 * pool) * pow(clamp((p.y - 40.0) / 420.0, 0.0, 1.0), 1.6) * 1.25;
    vec3 c = vec3(0.78, 0.84, 0.95) * lum;
    // the dial's shadow straight down, and its soft reflection (the bezel mirrored under its foot, fading)
    float below = p.y - (C.y + R);
    c *= 1.0 - 0.7 * exp(-max(length(p - C - vec2(0.0, 16.0)) - R, 0.0) / 30.0) * clamp((q.y + 0.3 * R) / (0.6 * R), 0.0, 1.0);
    float dm = length(vec2(q.x, 2.0 * R - q.y));
    c += vec3(0.5, 0.52, 0.58) * exp(-pow((dm - R - 3.0) / 4.0, 2.0)) * exp(-max(below, 0.0) / 55.0) * step(0.0, below) * (0.35 + 0.65 * tone * 4.0) * 0.18;
    c *= 1.0 - u_plain;

    // --- the left panel: borderless, its left end a long bow with round corners; bluish, lighter low on the left
    float lt = u_left.y, lb = u_left.z, mid = (lt + lb) * 0.5, half_ = (lb - lt) * 0.5;
    float tt = clamp((p.y - lt) / (lb - lt), 0.0, 1.0);
    float xl = u_left.x - u_left.w * (1.0 - pow((p.y - mid) / half_, 2.0));
    float dl = max(max(xl - p.x, max(lt - p.y, p.y - lb)), p.x - C.x);
    vec2 cn = vec2(u_left.x + 22.0, clamp(p.y, lt + 22.0, lb - 22.0));
    if (p.x < cn.x && abs(p.y - mid) > half_ - 22.0) dl = max(dl, length(p - cn) - 22.0);
    // its shadow on the floor, straight down
    c *= 1.0 - 0.45 * clamp(1.0 - max(dl - 0.0, 0.0) / 12.0, 0.0, 1.0) * step(lb - 4.0, p.y) * step(d, 9999.0) * step(R + 1.0, d);
    float lin = cov(dl) * step(R + 1.0, d);
    if (lin > 0.0) {
        float k = smoothstep(R + 14.0, R + 54.0, d);
        vec3 pc = mix(vec3(0.085, 0.10, 0.14), vec3(0.13, 0.20, 0.30), clamp(tt / 0.62, 0.0, 1.0));
        pc = mix(pc, vec3(0.06, 0.085, 0.12), clamp((tt - 0.62) / 0.38, 0.0, 1.0));
        pc += vec3(0.03, 0.07, 0.12) * exp(-(pow((p.x - u_left.x - 110.0) / 260.0, 2.0) + pow((p.y - C.y - 0.3 * R) / 150.0, 2.0)));
        pc *= 1.0 - 0.45 * clamp((p.x - xl) / 460.0, 0.0, 1.0);
        c = put(c, pc * (1.0 + 0.35 * u_bright), lin * (0.35 + 0.6 * k));
        // the dark ring it ends against at the dial, a fine line at its edge
        c = put(c, vec3(0.012, 0.018, 0.03), lin * clamp(1.0 - (d - R - 34.0) / 16.0, 0.0, 1.0) * 0.92);
        c = put(c, vec3(0.45, 0.52, 0.62), lin * cov(abs(d - R - 40.0) - 0.6) * 0.35);
        // light borders in places: down the bowed end (brightest a little low), along the top and the foot from the left
        float wl = (0.25 + 0.75 * exp(-pow((tt - 0.6) / 0.3, 2.0))) * step(p.x, u_left.x + 30.0);
        float wt = max(cov(abs(p.y - lt) - 0.8) * clamp(1.0 - (p.x - u_left.x) / 300.0, 0.0, 1.0) * 0.55,
                       cov(abs(p.y - lb) - 0.8) * clamp(1.0 - (p.x - u_left.x) / 460.0, 0.0, 1.0) * 0.75);
        c = put(c, BLUE, max(cov(abs(dl + 0.8) - 0.7) * wl, wt) * 0.85);
    }

    // --- the right panel: navy glass framed by fine light lines, a darker ring band round the dial, red lines along the
    //     top (from the dial out, fading) and the foot (round the corner and up the right end)
    float rt = u_right.x, rb = u_right.y;
    float xr = mix(u_right.z, u_right.w, (p.y - rt) / (rb - rt));
    float BAND = R + 36.0;
    if (p.x > C.x && p.y > rt - 20.0 && p.y < rb + 40.0) {
        float inP = step(rt, p.y) * step(p.y, rb) * step(BAND, d) * step(p.x, xr);
        c *= 1.0 - 0.5 * exp(-max(p.y - rb, 0.0) / 10.0) * step(rb, p.y) * step(BAND, d) * step(p.x, xr);
        float tr = clamp((p.y - rt) / (rb - rt), 0.0, 1.0);
        vec3 gc = vec3(0.035 + 0.03 * (1.0 - tr), 0.06 + 0.045 * (1.0 - tr), 0.10 + 0.07 * (1.0 - tr));
        c = put(c, gc * (1.0 + 0.35 * u_bright), inP * 0.82);
        float inB = step(R + 2.0, d) * step(d, BAND) * step(rt, p.y) * step(p.y, rb) * step(C.x + 0.25 * R, p.x);
        c = put(c, vec3(0.02, 0.035, 0.06), inB * 0.7);
        float ok = step(rt, p.y) * step(p.y, rb) * step(C.x + 0.25 * R, p.x);
        c = put(c, vec3(0.55, 0.62, 0.72), (cov(abs(d - BAND) - 0.8) * 0.55 + cov(abs(d - R - 6.0) - 0.8) * 0.25) * ok);
        c = put(c, vec3(0.55, 0.62, 0.72), cov(abs(p.x - xr) - 0.8) * step(rt, p.y) * step(p.y, rb) * 0.45);
        c = put(c, vec3(0.70, 0.76, 0.86), cov(abs(p.y - rt) - 0.7) * step(BAND, d) * step(p.x, xr) * 0.6);
        float yl = rt + 34.0;
        float m = cov(abs(p.y - yl) - 1.1) * step(R + 4.0, d) * clamp((1760.0 - p.x) / 420.0, 0.0, 1.0);
        float m2 = max(cov(abs(p.y - rb + 2.0) - 1.3) * step(R + 4.0, d) * step(p.x, xr - 6.0) * clamp((p.x - C.x - 0.5 * R) / 300.0, 0.0, 1.0),
                       cov(abs(p.x - xr + 4.0) - 1.3) * step(rb - 200.0, p.y) * step(p.y, rb - 2.0) * clamp((p.y - rb + 200.0) / 160.0, 0.0, 1.0));
        c = put(c, RED, max(m, m2));
        c += RED * 0.5 * (exp(-pow((p.y - yl) / 3.5, 2.0)) * step(R + 4.0, d) * clamp((1760.0 - p.x) / 420.0, 0.0, 1.0) * 0.4
                          + exp(-max(p.y - rb, 0.0) / 14.0) * step(rb, p.y) * step(p.x, xr) * clamp((p.x - C.x - 0.5 * R) / 300.0, 0.0, 1.0) * 0.35);
        // the tyres: a box each out to the side (a bright edge toward the car), a leader to its wheel, the wheel outlined
        // green (fine) or red (low) beside the body
        for (int i = 0; i < 4; i++) {
            float sx_ = (i == 0 || i == 2) ? -1.0 : 1.0, sy_ = i < 2 ? -1.0 : 1.0;
            float st = i == 0 ? u_tyre.x : i == 1 ? u_tyre.y : i == 2 ? u_tyre.z : u_tyre.w;
            vec2 wc = u_car.xy + vec2(sx_ * u_tbox.z, sy_ * u_car.w);
            vec2 bc = vec2(u_car.x + sx_ * u_car.z, wc.y);
            float bd = rbox(p, bc, u_tbox.xy, 6.0);
            c = put(c, vec3(0.03, 0.063, 0.118), cov(bd));
            c = put(c, vec3(0.27, 0.35, 0.47), cov(abs(bd) - 0.6));
            float bx = bc.x - sx_ * (u_tbox.x - 1.0);
            c = put(c, vec3(0.78, 0.82, 0.88), cov(abs(p.x - bx) - 0.8) * step(abs(p.y - bc.y), u_tbox.y - 8.0));
            c = put(c, vec3(0.47, 0.59, 0.75), cov(abs(p.y - wc.y) - 0.6) * step(min(bx, wc.x - sx_ * 12.0), p.x) * step(p.x, max(bx, wc.x - sx_ * 12.0)));
            vec3 wcol = st > 1.5 ? vec3(0.92, 0.2, 0.16) : st > 0.5 ? vec3(0.31, 0.86, 0.47) : vec3(0.35, 0.38, 0.44);
            c = put(c, wcol, cov(abs(rbox(p, wc, vec2(9.0, 22.0) * u_tbox.w, 5.0)) - 1.0));
        }
    }

    // --- the fuel: a bar as the others (jsalicru, Nov 28 2026: it matches them now; the slanted cells are gone), drawn in
    //     the bars' loop below as a fifth; amber with the range low (the level sent 2 over)
    vec4 F = u_fuel;
    float lowF = step(1.5, F.w);
    F.w -= 2.0 * lowF;

    // --- now playing's progress: a fine recessed track, filled light to the song's position, a small round head there
    vec4 M = u_media;
    if (M.z > 0.0 && abs(p.y - M.y) < 9.0 && p.x > M.x - 9.0 && p.x < M.x + M.z + 9.0) {
        float md = rbox(p, vec2(M.x + M.z * 0.5, M.y), vec2(M.z * 0.5, 2.5), 2.5);
        float fx = M.x + M.z * M.w;
        c = put(c, vec3(0.008, 0.012, 0.02), cov(md));
        c = put(c, vec3(0.86, 0.91, 1.0) * mix(0.75, 1.0, clamp((p.x - M.x) / max(fx - M.x, 1.0), 0.0, 1.0)), cov(md) * step(p.x, fx));
        c = put(c, vec3(0.30, 0.50, 1.0), cov(md) * clamp(1.0 - (p.x - M.x) / 40.0, 0.0, 1.0) * 0.55);
        c = put(c, vec3(0.95, 0.96, 0.98), cov(length(p - vec2(fx, M.y)) - 6.0) * step(0.002, M.w));
    }
    // --- the bars (in the left panel; two under the car while the map shows): recessed tracks (an inset shadow along their top and left, a light lip along the foot and the
    //     right end), a crisp light fill from the left, a blue start, a small red mark at the end
    for (int i = 0; i < 5; i++) {
        vec4 B = i < 4 ? u_bars[i] : vec4(F.x, F.y, F.z, F.w + 4.0 * lowF);     // the fifth: the fuel (amber: band 2)
        if (i == 4 && F.z < 1.0) continue;
        // the value's whole part above 1 carries its band (jsalicru, Sweep's colours): 2 cold (blue), 4 warm (orange), 6 hot (red)
        float zn = floor(B.w * 0.5);
        B.w -= zn * 2.0;
        vec3 fc_ = zn > 2.5 ? vec3(1.0, 0.2, 0.14) : zn > 1.5 ? vec3(1.0, 0.54, 0.07) : zn > 0.5 ? vec3(0.25, 0.59, 1.0) : vec3(0.86, 0.91, 1.0);
        vec2 bh = vec2(B.z * 0.5, 13.0), bc = B.xy + bh;
        float bd = rbox(p, bc, bh, 4.0);
        if (bd > 3.0) continue;
        float m = cov(bd);
        vec3 bcol = vec3(0.008, 0.012, 0.02);
        float pos = (p.x - B.x) / B.z;
        float fl = step(pos, B.w) * step(B.y + 4.0, p.y) * step(p.y, B.y + 23.0) * step(B.x + 3.0, p.x);
        // (jsalicru, Nov 28 2026: a little texture) the track a fine dark weave, the fill brushed along its length with a
        // fine diagonal grain over it
        vec2 wv = floor(p / 3.0);
        bcol += vec3(0.010, 0.014, 0.022) * mod(wv.x + wv.y, 2.0) * (0.6 + 0.4 * mod(wv.x, 2.0));
        float brush = 0.93 + 0.07 * sin(p.y * 2.3 + sin(p.x * 0.05 + float(i) * 1.7) * 2.0);
        float grain = 1.0 - 0.10 * smoothstep(0.35, 0.5, abs(fract((p.x - p.y) / 6.0) - 0.5));
        bcol = mix(bcol, fc_ * (0.95 - 0.2 * clamp((B.y + 9.0 - p.y) / 5.0, 0.0, 1.0)) * clamp(1.0 - (B.w - pos) * 1.2, 0.82, 1.0) * brush * grain, fl);
        bcol = mix(bcol, vec3(0.30, 0.50, 1.0), clamp(1.0 - (p.x - B.x) / 40.0, 0.0, 1.0) * 0.55);
        bcol = mix(bcol, vec3(0.85, 0.12, 0.10), step(float(i), 3.5) * step(B.x + B.z - 18.0, p.x) * step(p.x, B.x + B.z - 4.0) * step(B.y + 19.0, p.y) * step(p.y, B.y + 22.0));
        bcol *= 1.0 - 0.75 * clamp(1.0 - min(p.y - B.y - 3.0, p.x - B.x - 2.0) / 4.0, 0.0, 1.0);
        c = put(c, bcol, m);
        c = put(c, BLUE * 0.85, cov(abs(p.y - B.y - 26.0) - 0.7) * step(B.x + 4.0, p.x) * step(p.x, B.x + B.z - 4.0) * 0.75);
        c = put(c, BLUE * 0.85, cov(abs(p.x - B.x - B.z) - 0.6) * step(B.y + 4.0, p.y) * step(p.y, B.y + 22.0) * 0.4);
        c = put(c, vec3(0.0), cov(abs(p.y - B.y) - 0.7) * step(B.x + 4.0, p.x) * step(p.x, B.x + B.z - 4.0) * 0.7);
        // the peak: an amber line across the first bar with a soft glow and a small arrow over it
        if (i == 0 && u_peak >= 0.0) {
            float px = p.x - B.x - u_peak * B.z, py = p.y - B.y;
            c += vec3(1.0, 0.6, 0.15) * exp(-px * px / 18.0) * step(abs(py - 13.0), 12.0) * 0.4;
            c = put(c, vec3(1.0, 0.73, 0.24), cov(abs(px) - 1.2) * step(abs(py - 13.0), 11.0) + cov(max(abs(px) - (py + 6.0), abs(py + 3.5) - 2.5)));
        }
    }

    // --- the dial
    if (d < R + 10.0) {
        float a = degrees(atan(q.x, -q.y));
        float fa = max(mod(a - u_scale.x + 720.0, 360.0) / u_scale.y, 0.0);       // 0..1 round the scale
        float s0 = 1.0 - (1.0 - u_curve.y) * u_curve.z;                              // where the tail starts round it
        float pv = fa <= s0 ? fa * u_curve.y / s0 : u_curve.y + (fa - s0) / u_curve.z;
        float k = u_scale.z * pow(pv, 1.0 / u_curve.x);                             // thousands there
        bool onScale = k <= u_scale.z + 0.02;
        float pxk = R * radians(u_scale.y) / u_scale.z * u_curve.x * pow(max(k / u_scale.z, 0.002), u_curve.x - 1.0)
                    * (fa <= s0 ? s0 / u_curve.y : u_curve.z);                    // px per thousand at the rim
        // the face: black, faintly lighter toward the rim; red or yellow from the inner ring out, lit from above
        float fv = 0.018 + 0.05 * pow(clamp((d / R - 0.5) / 0.5, 0.0, 1.0), 2.0) + u_bright * (0.035 + 0.05 * exp(-pow(d / (0.75 * R), 2.0)));
        vec3 fc = vec3(fv, fv, fv * 1.08);
        vec3 FC = u_dial > 1.5 ? vec3(0.96, 0.74, 0.04) : vec3(0.62, 0.04, 0.03);
        fc = mix(fc, FC * (0.78 + 0.28 * up - 0.18 * clamp((d / R - 0.75) / 0.25, 0.0, 1.0)), step(0.5, u_dial) * clamp(d - 0.5 * R + 0.5, 0.0, 1.0));
        // the shift light: the face warms red over the count-in and glows while it flashes
        fc = mix(fc, vec3(0.75, 0.05, 0.04), (0.18 * u_shift.x * (1.0 - u_shift.y) + 0.5 * u_shift.y) * clamp((d - 0.5 * R) / (0.4 * R), 0.0, 1.0));
        vec3 col = fc;
        // the hub: dark charcoal, recessed (a shadow inside its edge, deepest under its top), a fine grey edge
        float HUB = 0.43 * R;
        col = mix(col, vec3(0.040, 0.043, 0.052) * (1.0 + 0.6 * u_bright), cov(d - HUB));
        col *= 1.0 - pow(clamp(1.0 - (HUB - d) / 34.0, 0.0, 1.0), 1.6) * step(d, HUB) * (0.55 + 0.35 * clamp(up / 0.43, 0.0, 1.0));
        col += vec3(0.18 + 0.2 * clamp(up, 0.0, 1.0)) * cov(abs(d - HUB) - 0.6);
        col += vec3(0.9, 0.93, 1.0) * (0.16 + 0.14 * clamp(up, 0.0, 1.0)) * cov(abs(d - 0.5 * R) - 0.6);
        // the ticks: two fine rings with rungs every 100 rpm between them, a dot on the inner one at each thousand
        vec3 tick = u_dial > 1.5 ? vec3(0.16) : vec3(0.77, 0.78, 0.82);
        vec3 tickR = u_dial > 0.5 && u_dial < 1.5 ? vec3(0.08, 0.016, 0.016) : vec3(0.92, 0.14, 0.12);
        // the red zone from its start (lower on a cold engine, as Sweep's), a yellow zone just under it
        float kR = u_sweep.y * u_scale.z, kY = u_sweep.z * u_scale.z, kRev = u_tach.w * u_scale.z;
        float rz = smoothstep(kR - 0.03, kR + 0.03, k);      // (jsalicru: in every rev display)
        float yz = step(kY, k) * (1.0 - step(kR, k));
        float ro = R - 7.0, ri = R - 26.0;
        float inL = float(onScale) * step(ri, d) * step(d, ro);
        float lit = u_rev.x * step(k, u_tach.w * u_scale.z) * inL;            // the lit ladder: up to the revs
        float lead = clamp(1.0 - (u_tach.w * u_scale.z - k) / 3.0, 0.0, 1.0);
        float litS = u_sweep.x * step(k, kRev) * inL;                           // Sweep's way: lit up to the revs
        vec3 tc = mix(tick, tickR, rz) * (1.0 - 0.45 * max(u_rev.x, u_sweep.x) * (1.0 - max(lit, litS)));     // the unlit ladder dimmer with it
        float rng = min(abs(d - ro) - 0.85, abs(d - ri) - 0.75);
        float rung = abs(fract(k * 10.0 + 0.5) - 0.5) / 10.0 * pxk * (d / R) - 0.75;
        float lad = onScale ? min(rng, max(rung, max(ri - d, d - ro))) : 99.0;
        col = mix(col, tc, cov(lad));
        col = mix(col, tickR, rz * inL * 0.92 * (1.0 - lit));
        // Sweep's way: the yellow zone's rungs yellow; the lit rungs silver white, yellow in the yellow zone or once the
        // wave has spread down to them, red in the red zone, a white leading edge, all red while the shift light flashes;
        // a soft glow inward off the lit part
        vec3 YEL = vec3(1.0, 0.76, 0.12);
        col = mix(col, YEL * 0.85, yz * inL * cov(lad) * (1.0 - litS));
        vec3 sc = k >= kR ? vec3(1.0, 0.13, 0.09) : k >= min(kY, u_sweep.w * u_scale.z) ? YEL : vec3(0.90, 0.93, 0.98);
        sc = mix(sc, vec3(1.0), 0.55 * clamp(1.0 - (kRev - k) / 0.35, 0.0, 1.0) * step(k, kY));
        sc = mix(sc, vec3(1.0, 0.12, 0.08), u_shift.y);
        col = mix(col, sc * (1.0 + 0.35 * u_shift.y), litS * mix(0.75, 1.0, cov(lad)));
        col += sc * exp(-max(ri - d, 0.0) / 12.0) * step(d, ri) * step(ri - 40.0, d) * step(k, kRev) * u_sweep.x * float(onScale) * 0.16;
        // the lit ladder: the band filled in the revs' colour, brightest at the value, a white-hot tip, an orange glow
        // spilling inward; red and bright while the shift light flashes
        vec3 rc = mix(revCol(k / u_scale.z), vec3(1.0, 0.12, 0.08), u_shift.y);
        col = mix(col, rc * (1.0 + 0.6 * u_shift.y), lit * (0.55 + 0.45 * max(lead, u_shift.y)));
        float tipd = (k - u_tach.w * u_scale.z) * pxk * (d / R);
        col += u_rev.x * float(onScale) * (vec3(1.0) * exp(-tipd * tipd / 4.0) * 0.9 * step(ri - 4.0, d) * step(d, ro + 4.0)
               + mix(rc, vec3(1.0, 0.45, 0.12), 0.5) * exp(-max(ri - d, 0.0) / 16.0) * step(d, ri) * step(ri - 60.0, d)
                 * step(k, u_tach.w * u_scale.z) * lead * 0.6);
        // the revs' peak after a pull: a thin bright mark on the ladder, fading out
        float pkd = (k - u_rev.y * u_scale.z) * pxk * (d / R);
        col = mix(col, vec3(1.0, 0.92, 0.85), clamp(1.6 - abs(pkd), 0.0, 1.0) * inL * u_rev.z * u_rev.x);
        col += vec3(1.0, 0.5, 0.2) * exp(-pkd * pkd / 18.0) * inL * u_rev.z * u_rev.x * 0.5;
        float kk = floor(k + 0.5);
        float pk_ = pow(kk / u_scale.z, u_curve.x);
        float ak = radians(u_scale.x + u_scale.y * (pk_ <= u_curve.y ? pk_ * s0 / u_curve.y : s0 + (pk_ - u_curve.y) * u_curve.z));
        vec2 dot_ = C + ri * vec2(sin(ak), -cos(ak));
        col = mix(col, kk > 7.5 ? tickR : (u_dial > 1.5 ? vec3(0.1) : vec3(0.94, 0.95, 0.97)), cov(length(p - dot_) - 2.6) * step(kk, u_scale.z + 0.01));
        // the shift light on the ladder (needle): the ticks glow red while it flashes
        col = mix(col, vec3(1.0, 0.2, 0.15), cov(lad) * u_shift.y);
        // (the needle and its cap are a layer of their own over the numbers: rneedle)
        // the speed and gear boxes: navy glass (the face through it), round corners at the left, a bright border along
        // the curved right end, dim on the top and left
        for (int i = 0; i < 2; i++) {
            float y0 = C.y + (i == 0 ? -0.27 : 0.115) * R, y1 = C.y + (i == 0 ? 0.085 : 0.62) * R;
            float rr = R - (i == 0 ? 25.0 : 34.0);
            float bd = max(max(C.x - 1.0 - p.x, max(y0 - p.y, p.y - y1)), d - rr);
            vec2 cc = vec2(C.x + 8.0, clamp(p.y, y0 + 9.0, y1 - 9.0));
            if (p.x < cc.x && (p.y < y0 + 9.0 || p.y > y1 - 9.0)) bd = max(bd, length(p - cc) - 9.0);
            float bt = clamp((p.y - y0) / (y1 - y0), 0.0, 1.0);
            vec3 tint = mix(i == 0 ? vec3(0.06, 0.10, 0.17) : vec3(0.075, 0.11, 0.17), vec3(0.03, 0.055, 0.10), bt);
            tint += vec3(0.6, 0.85, 1.0) * 0.045 * exp(-pow(((p.x - C.x) * 0.35 + (p.y - y0)) / (y1 - y0) - 0.55, 2.0) / 0.048);
            col = mix(col, tint * (1.0 + 0.35 * u_bright), cov(bd) * 0.72);
            float edgeR = cov(abs(d - rr + 1.5) - 1.3) * step(y0 + 2.0, p.y) * step(p.y, y1 - 2.0) * step(C.x, p.x) * (0.35 + 0.65 * clamp(min(p.y - y0, y1 - p.y) / 14.0, 0.0, 1.0));
            // with the lit ladder, the right edges take the revs' colour as they climb
            vec3 ec = mix(vec3(0.80, 0.84, 0.90), revCol(u_tach.w), u_rev.x * smoothstep(0.45, 0.8, u_tach.w));
            col = mix(col, ec, edgeR * (i == 0 ? 0.95 : 0.9));
            col += revCol(u_tach.w) * exp(-pow((d - rr + 1.5) / 5.0, 2.0)) * step(y0 + 2.0, p.y) * step(p.y, y1 - 2.0) * step(C.x + 0.3 * R, p.x) * u_rev.x * smoothstep(0.55, 0.85, u_tach.w) * 0.35;
            float dim = max(cov(abs(p.y - y0 - 0.6) - 0.6) * 0.55, cov(abs(p.x - C.x + 0.4) - 0.6) * 0.35) * cov(bd);
            col = mix(col, vec3(0.35, 0.42, 0.52), dim * 0.5 * (1.0 - edgeR));
        }
        // the glass over it all: a faint diagonal sheen from the top left, a soft arc under the bezel's top, the lower
        // right a touch darker
        float u_ = (q.x + q.y) / R;
        col *= 1.0 - clamp(u_, 0.0, 1.4) * 0.12;
        col += vec3(0.85, 0.9, 1.0) * (1.0 + 1.2 * u_bright) * (exp(-pow((u_ + 0.55) / 0.22, 2.0)) * 0.055 + exp(-pow((u_ + 0.95) / 0.08, 2.0)) * 0.03
                                      + exp(-pow((d - R + 30.0) / 14.0, 2.0)) * clamp(up - 0.2, 0.0, 1.0) * 0.06);
        // the bezel's shadow inside, deepest under its top
        col *= 1.0 - pow(clamp(1.0 - (R - 4.0 - d) / 16.0, 0.0, 1.0), 2.0) * (0.35 + 0.45 * clamp(up, 0.0, 1.0));
        c = mix(c, col, cov(d - R + 4.0));
        // the bezel: a rounded metal ring lit from above, a bright lip outside, dark inside; red while the light flashes
        float qb = clamp((d - R + 4.0) / 10.0, 0.0, 1.0);
        float crown = sin(qb * 3.14159);
        vec3 metal = vec3(0.92, 0.94, 1.0) * (0.10 + 0.20 * crown + 0.30 * clamp(up, 0.0, 1.0) * crown + 0.06 * up);
        metal = mix(metal, vec3(0.95, 0.15, 0.1) * (0.4 + 0.6 * crown), u_shift.y * 0.8);
        c = mix(c, metal, cov(abs(d - R - 1.0) - 5.0));
        c += vec3(0.10 + 0.35 * clamp(up, 0.0, 1.0)) * cov(abs(d - R - 5.2) - 0.5);
        c *= 1.0 - 0.6 * cov(abs(d - R + 3.4) - 0.5);
    }

    // a fine grain, strongest in the darks (as a real screen: no visible banding in the gradients)
    float lumc = dot(c, vec3(0.333));
    c += (fract(sin(dot(floor(p), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * (0.024 + 0.02 * (1.0 - clamp(lumc / 0.5, 0.0, 1.0)));
    // the map's window: see-through in the left panel (the map is a layer under this one), its left end bowed and round,
    // fading out toward the dial; its lower part a little darker
    float ma = 0.0, mf = 1.0;
    if (u_hole.z > 0.0) {
        // its left end follows the panel's bow, 12 px in (so it keeps the panel's round corners), top and bottom straight
        float hd = max(abs(p.y - u_hole.y - u_hole.w * 0.5) - u_hole.w * 0.5, dl + 12.0);
        ma = cov(hd) * cov(dl) * pow(clamp((d - R - 20.0) / 90.0, 0.0, 1.0), 1.2);
        mf = 1.0 - 0.45 * clamp((p.y - u_hole.y - 0.55 * u_hole.w) / (0.45 * u_hole.w), 0.0, 1.0);
    }
    float al = 1.0 - ma * mf;
    gl_FragColor = vec4(clamp(c, 0.0, 0.965 + 0.035 * u_bright) * (1.0 - ma) / max(al, 0.001), al);
}
`;

const RNEEDLE = `// Vetro's needle on a layer of its own (over the rev counter's numbers): a soft glow along it, its shadow, the blade
// with a bright core, the centre cap; the rest see-through. The layer is the dial's square. highp where the GPU has
// it: the blade's squared length (288 px: 82944) is past mediump's range on the car (fp16, 65504), and drew nothing.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_tach;       // centre x, y (in this layer), radius, revs 0..1
uniform vec2 u_sweep;      // 0 at this angle (deg clockwise from 12 o'clock), sweep deg
uniform vec3 u_curve;      // the rev scale, as the dash's
uniform vec3 u_col;        // the blade's colour (red; white on the red face)
float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
float segd(vec2 p, vec2 a, vec2 b) { vec2 ba = b - a; float h = clamp(dot(p - a, ba) / dot(ba, ba), 0.0, 1.0); return length(p - a - ba * h); }
void main() {
    vec2 p = v_uv * u_size, C = u_tach.xy;
    float R = u_tach.z, d = length(p - C);
    float pw = pow(u_tach.w, u_curve.x), s0 = 1.0 - (1.0 - u_curve.y) * u_curve.z;
    float an = radians(u_sweep.x + u_sweep.y * (pw <= u_curve.y ? pw * s0 / u_curve.y : s0 + (pw - u_curve.y) * u_curve.z));
    vec2 un = vec2(sin(an), -cos(an));
    vec2 n0 = C + un * 0.04 * R, n1 = C + un * (R - 12.0);
    float t = clamp(dot(p - n0, un) / (R - 12.0 - 0.04 * R), 0.0, 1.0);
    float nd = segd(p, n0, n1) - mix(3.5, 1.2, t);
    float sd = segd(p - vec2(4.0), n0, n1) - 3.0;
    // shadow, glow, blade, core
    vec4 o = vec4(0.0, 0.0, 0.0, 0.6 * cov(sd) * step(36.0, d));
    float g = exp(-pow(max(nd, 0.0) / 6.0, 2.0)) * 0.45 * (1.0 - cov(nd));
    o = vec4(mix(o.rgb, u_col, g / max(o.a + g, 0.001)), max(o.a, g));
    o = mix(o, vec4(u_col, 1.0), cov(nd));
    o = mix(o, vec4(mix(u_col, vec3(1.0), 0.45), 1.0), cov(segd(p, n0 + un * 6.0, n1 - un * 8.0) - 0.4) * 0.8);
    // the cap: its shadow, a dark disc lit at the top, a grey edge, a red ring, a dark centre
    o = mix(o, vec4(0.0, 0.0, 0.0, 1.0), 0.6 * cov(length(p - C - vec2(0.0, 5.0)) - 26.0) * step(22.0, d) * (1.0 - o.a));
    float cd = d - 22.0;
    o = mix(o, vec4(vec3(0.07 + 0.12 * clamp(1.0 - length(p - C + vec2(0.0, 6.0)) / 22.0, 0.0, 1.0)), 1.0), cov(cd));
    o = mix(o, vec4(0.47, 0.49, 0.53, 1.0), cov(abs(cd) - 0.7));
    o = mix(o, vec4(0.78, 0.12, 0.09, 1.0), cov(abs(d - 11.0) - 1.0));
    o = mix(o, vec4(0.03, 0.03, 0.03, 1.0), cov(d - 5.0));
    gl_FragColor = o;
}
`;

module.exports = { shiftbar: SHIFTBAR, arc: ARC, revbar: REVBAR, lights: LIGHTS, fill: FILL, box: BOX, grid: GRID, segbar: SEGBAR, mdash: MDASH, mtach: MTACH, sdash: SDASH, boxes: BOXES, atext: ATEXT, meter: METER, gmeter: GMETER, revarc: REVARC, tiles: TILES, ribbon: withRevPath(RIBBON, 'u_value'), deco: DECO, mview: MVIEW, vdash: VDASH, e36dash: E36DASH, e36econ: E36ECON, e36needles: E36NEEDLES, twinface: TWINFACE, twinneedle: TWINNEEDLE, sweepdash: withRevPath(SWEEPDASH, 'u_rpm'), cdash: withRevPath(CDASH, 'u_tachA.w'), cdashClassic: CDASH_CLASSIC, ldash: LDASH, gdash: GDASH, adash: ADASH, gtext: GTEXT, rdash: RDASH, rneedle: RNEEDLE };
