#!/usr/bin/env python3
"""bake_e46_fonts.py - the E46 M3 theme's fonts (layout e46test2.json, tools/gen_e46.py).

    python3 tools/bake_e46_fonts.py

Each printed font is FITTED to the reference render (design/e46m3-reference.png): FIT below gives a sample text's ink
height and width as measured off the render (render px, tools/gen_e46.py's scale S carries them to the cluster); the
size is chosen so the sample's ink is that tall, then the letters' spacing so it is that wide. Printed figures and
labels get proportional spacing (each glyph's advance its own ink plus the fitted gap), as a printed dial has; the LCD
keeps tabular digits (they change). Roboto Condensed Bold for the print (as Univers 67), DSEG7 for the LCD. DSEG7 has no '+', which the
outside temperature needs ({{ambient}}: "+72"): it is made from the font's own '-' and the same bar stood upright.
Uses tools/bake_fonts.py's bake() (the atlas format every font in apps/cluster_themes/hud/fonts/ has).
"""
import base64
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bake_fonts as bf  # noqa: E402

OUT = os.path.join(HERE, '..', 'apps', 'cluster_themes', 'hud', 'fonts')
# the print in Roboto Condensed Bold (SIL OFL), standing in for the real cluster's Univers 67 Bold Condensed (a licensed
# font that can't ship here); tools/fonts-src/RobotoCondensed-Bold.ttf is the variable Roboto at wdth 75, wght 700
SEMI = SEMIBOLD = 'RobotoCondensed-Bold.ttf'
D, U, L = bf.DIGITS, bf.UPPER, bf.LOWER
S = 0.943          # render px -> cluster px (tools/gen_e46.py S)

# name, file, characters, sample, its ink height and width in the render (render px); the fuel and oil gauges'
# print 30 % under the render's (Nov 22 2026)
FIT = [
    ('e4_big', SEMI, D, '100', 35, 62),                  # the MPH figures (a touch under the render's 38 x 67: on the car they read large)
    ('e4_rpm', SEMI, D, '4', 40, 26),                    # the rev counter's 0 .. 9
    ('e4_km', SEMI, D, '260', 20, 38),                   # the inner km/h ring
    ('e4_mph', SEMI, 'MPH', 'MPH', 17, 44),              # MPH under the badge: spaced out, well under the render's 25 x 64
    ('e4_lab', SEMI, U + L + D + ' /', 'x1000', 25, 78), # 1/min, x1000: set tight
    ('e4_sm', SEMI, U + L + D + ' /°', 'km/h', 21, 52),  # km/h, miles, the LCD's units (°F / °C)
    ('e4_gl', SEMIBOLD, D + '/', '0', 19.6, 11.9),           # the fuel gauge's 0, 1/2, 1/1 (width from 1/1 below)
    ('e4_oil', SEMI, D, '210', 20.3, 35.7),                  # the oil gauge's 120 210 300
    ('e4_degf', SEMI, '°F', '°F', 17.5, 17.5),               # its °F
]
WIDTH_ALSO = {'e4_gl': ('1/1', 25.9)}                    # fit the gap on this sample instead
FIXED = [('e4_lcd', 'DSEG7Classic-Bold.ttf', 40, D + '-.: ')]


def load(name):
    with open(os.path.join(OUT, name + '.json')) as f:
        return json.load(f)


def save(name, fnt):
    with open(os.path.join(OUT, name + '.json'), 'w') as f:
        json.dump(fnt, f, separators=(',', ':'))


def ink_cols_rows(fnt, ch):
    aw, a, g = fnt['width'], base64.b64decode(fnt['alpha']), fnt['glyphs'][ch]
    on = [(x, y) for y in range(g['h']) for x in range(g['w']) if a[(g['y'] + y) * aw + g['x'] + x] > 100]
    if not on:
        return None
    xs, ys = [p[0] for p in on], [p[1] for p in on]
    return min(xs), max(xs), min(ys), max(ys)


def text_ink(fnt, text):
    """The ink box of a text set with the font's advances: (width, height) px."""
    pen, x0, x1, y0, y1 = 0, 1e9, -1e9, 1e9, -1e9
    for ch in text:
        g = fnt['glyphs'][ch]
        b = ink_cols_rows(fnt, ch)
        if b:
            x0, x1 = min(x0, pen + g['ox'] + b[0]), max(x1, pen + g['ox'] + b[1])
            y0, y1 = min(y0, b[2]), max(y1, b[3])
        pen += g['advance']
    return x1 - x0 + 1, y1 - y0 + 1


def proportional(fnt, gap):
    for ch, g in fnt['glyphs'].items():
        if ch == ' ':
            continue
        b = ink_cols_rows(fnt, ch)
        if b:
            g['ox'] = -b[0]
            g['advance'] = b[1] - b[0] + 1 + gap


def fit(name, file, chars, sample, h, w):
    want_h, want_w = h * S, w * S
    size = 40
    for _ in range(6):                                   # the size whose sample is want_h tall
        bf.bake(OUT, name, file, size, chars)
        got = text_ink(load(name), sample)[1]
        new = max(8, round(size * want_h / got))
        if new == size:
            break
        size = new
    wsample, ww = WIDTH_ALSO.get(name, (sample, w))
    want_w = ww * S
    fnt = load(name)
    best = None
    for gap10 in range(-30, 81):                         # the spacing (0.1 px steps, whole px advances) that fits the width
        gap = round(gap10 / 10)
        f2 = json.loads(json.dumps(fnt))
        proportional(f2, gap)
        err = abs(text_ink(f2, wsample)[0] - want_w)
        if best is None or err < best[0]:
            best = (err, gap, f2)
    save(name, best[2])
    fw, fh = text_ink(best[2], sample)
    print('  %-7s size %d gap %+d: %s %dx%d px (render %dx%d)' % (name, size, best[1], sample, fw, fh, round(w * S), round(h * S)))


def add_plus(name):
    """Give a DSEG7 font a '+': its '-' bar, and the same bar turned upright through its middle."""
    fnt = load(name)
    aw = fnt['width']
    alpha = bytearray(base64.b64decode(fnt['alpha']))
    g = fnt['glyphs']['-']
    ink = [(x, y, alpha[(g['y'] + y) * aw + g['x'] + x]) for y in range(g['h']) for x in range(g['w'])
           if alpha[(g['y'] + y) * aw + g['x'] + x] > 0]
    xs, ys = [p[0] for p in ink], [p[1] for p in ink]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    half = (max(xs) - min(xs)) / 2
    w, h = g['w'], g['h']
    plus = bytearray(w * h)
    for x, y, a in ink:
        plus[y * w + x] = max(plus[y * w + x], a)
        rx, ry = int(round(cx + (y - cy))), int(round(cy + (x - cx)))
        if 0 <= rx < w and 0 <= ry < h and abs(ry - cy) <= half:
            plus[ry * w + rx] = max(plus[ry * w + rx], a)
    x0 = max(c['x'] + c['w'] for c in fnt['glyphs'].values()) + bf.PAD
    if x0 + w > aw:
        raise SystemExit('no room in the atlas for +')
    for y in range(h):
        for x in range(w):
            alpha[(g['y'] + y) * aw + x0 + x] = plus[y * w + x]
    fnt['glyphs']['+'] = dict(g, x=x0)
    fnt['alpha'] = base64.b64encode(bytes(alpha)).decode()
    save(name, fnt)


if __name__ == '__main__':
    import contextlib, io
    for spec in FIT:
        with contextlib.redirect_stdout(io.StringIO()):
            pass
        fit(*spec)
    for spec in FIXED:
        bf.bake(OUT, *spec)
    add_plus('e4_lcd')
