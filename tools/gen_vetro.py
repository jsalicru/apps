"""gen_vetro.py - writes apps/cluster_themes/hud/layouts/vetro.json

Vetro: an Italian GT style cluster on the 1920x720 panel (Nov 24 2026, after photos of a Ferrari's dash), drawn by one
rdash effect layer (shaders.js) with text layers over it:
- the floor: a perforated metal plate seen low, lit in front, black toward the horizon, the dash's shadows and a soft
  reflection of the dial on it;
- the rev counter in the middle under glass: 0 at six o'clock, clockwise to 8 at half past one; a ladder of ticks with
  a dot at each thousand, red past the redline; silver Michroma numbers (a free face after Microgramma) with a soft
  shadow; a red needle with a glow and a centre cap; the face black, red or yellow (setting "vetroDial"); see-through
  navy boxes for the speed (mph / km/h) and the gear (AUTO / MANUAL under it) in its lower right;
- on the left a borderless blue panel fading into the dial: four recessed bars (boost, or intake with "Show boost" off;
  oil temperature; water temperature; oil pressure) with their readings, the fuel cells and the range under it;
- on the right a framed glass panel: the drive mode, "Tires", the car as an x-ray from above, each tyre's pressure and
  temperature in a box, its wheel green or red (under 33 psi).
With "Show Waze map inside the theme" on, Waze's map takes the left panel while it shows; the right panel then has all four
bars, stacked as on the left (jsalicru, Nov 25 2026: gauges by the map, not the tyres).
Without the map the right panel shows the setting "vetroRight": now playing (the song, the artist, its progress; the
default) or the tyres. No HV battery gauge (the M3 has none).
Nothing in the strip (covered, BMW's gear letter left clear, as Circuit).

    python3 tools/gen_vetro.py .
"""
import json
import math
import sys

W, H = 1920, 660
CX, CY, R = 960, 330, 300
START, SWEEP, THOUSANDS, RED = 180, 225, 8, 7200
FAST = 45
LEFT = [200, CY - 0.56 * R, CY + 0.80 * R, 26]          # the left panel: its end x, top, bottom, bow
RIGHT = [CY - 0.60 * R, CY + 0.86 * R, 1890, 1846]      # the right panel: top, bottom, right x at the top, at the bottom
CAR = [1560, 400, 175, 90]
BAR_R, BAR_W = 602, 320                                # the left bars: one column, its right edge clear of the dial
# the Waze map in the left panel (setting "Show Waze map inside the theme"): the window, and the right panel meanwhile:
# the car a bit smaller and higher, two of the bars (boost or intake, oil) side by side under it
MAP = [178, LEFT[1] + 14, CX - 40 - 178, LEFT[2] - 14 - (LEFT[1] + 14)]   # its left end is cut along the panel's bow
# the four bars in the right panel while the map shows (as on the left, clear of the dial's curve)
RBAR_X, RBAR_W, RBAR_Y, RBAR_DY = 1430, 360, 296, 80
# Waze's arrow sits a little right of its map's centre: the map's centre at 26 % across the window puts the arrow in the
# middle of the part that shows (the window runs on under the dial, where it fades out)
MAP_BARS = [{'of': i, 'x': RBAR_X, 'y': RBAR_Y + i * RBAR_DY, 'w': RBAR_W} for i in range(4)]
FACES = {                                                # the numbers' colours per face: (0..7, 8)
    'black': (('num', 'numLow'), ('numRed', 'numRedLow')),
    'red': (('num', 'numLow'), ('numBlack', 'numBlackLow')),
    'yellow': (('numDark', 'numDarkLow'), ('numRed', 'numRedLow')),
}
# the left bars: icon, value, unit, signal, min, max (+ the boost row's stand-in while "Show boost" is off)
ROWS = [
    ('gauge', '{{boost}}', '{{u:boostLc}}', 'vt_small', 'boost', 0, 2.758),
    ('oilcan', '{{oil}}', '{{u:temp}}', 'vt_deg', 'oil', 50, 150),
    ('therm', '{{coolant}}', '{{u:temp}}', 'vt_deg', 'coolant', 50, 130),
    ('oilcan', '{{oilP}}', '{{u:boostLc}}', 'vt_small', 'oilP', 0, 5.516),
]


def build(fonts):
    cell = lambda f: fonts[f]['cellHeight']
    base = lambda f: fonts[f]['baseline']
    widgets = []
    band = R + 36
    tx = CX + math.sqrt((band + 6) ** 2 - (RIGHT[0] + 18 - CY) ** 2) + 10
    MX, MW = tx + 34, 500                               # now playing: its left end, its width

    def text(id_, x, baseline, w, t, font, color='fg', align='left', **kw):
        """A text box w wide whose glyphs sit on baseline; x is its left (align left), right (right) or middle (center)."""
        x0 = x if align == 'left' else x - w if align == 'right' else x - w / 2.0
        d = {'id': id_, 'type': 'text', 'z': 5, 'x': int(round(x0)), 'y': int(round(baseline - base(font))), 'w': int(w),
             'h': cell(font), 'text': t, 'font': font, 'color': color, 'align': align}
        d.update({k: v for k, v in kw.items() if v is not None})
        widgets.append(d)

    # now playing's progress track (the shader's): x, y (its middle), width
    MEDIA = [MX, 474, MW]
    # bars' boxes: right ends on a curve round the dial, so the stack leans with it
    bars, rows_y = [], [LEFT[1] + 62 + i * 86 for i in range(4)]
    for (icon, tok, unit, ufont, sig, mn, mx), by in zip(ROWS, rows_y):
        b = {'x': BAR_R - BAR_W, 'y': by, 'w': BAR_W, 'signal': sig, 'min': mn, 'max': mx}
        if sig == 'boost':
            b.update({'alt': 'intake', 'altMin': 0, 'altMax': 100, 'altWhen': 'showBoost'})
        bars.append(b)
    F = [BAR_R - BAR_W, LEFT[2] + 30, 250]
    widgets.append({'id': 'dash', 'type': 'rdash', 'class': 'content', 'z': 1, 'x': 0, 'y': 0, 'w': W, 'h': H,
                    'tach': [CX, CY, R, START, SWEEP, THOUSANDS], 'red': RED, 'left': [round(v, 1) for v in LEFT],
                    'right': [round(v, 1) for v in RIGHT], 'bars': bars, 'fuel': F, 'car': CAR, 'tyresIf': 'vetroRight=tires',
                    'tbox': [68, 37, 69, 1], 'hole': MAP, 'holeWhen': 'mapUp', 'holeInset': 0, 'holeAim': [0.26, 0.5],
                    'mapBars': MAP_BARS, 'media': MEDIA, 'mediaIf': 'vetroRight=music'})

    # --- the needle and its cap on a layer of their own, over the numbers (z 6)
    widgets.append({'id': 'needle', 'type': 'rneedle', 'class': 'content', 'z': 6, 'x': CX - R, 'y': CY - R, 'w': 2 * R, 'h': 2 * R,
                    'tach': [CX, CY, R, START, SWEEP, THOUSANDS], 'conn': 1, 'toggle': 'vetroRev=needle'})
    # --- the rev counter's numbers: a soft shadow under each, the number per face (silver; the redline one red)
    nr = R - 77                                         # (the ladder 19 px wide)
    for k in range(THOUSANDS + 1):
        a = math.radians(START + SWEEP * k / float(THOUSANDS))
        x, y = CX + nr * math.sin(a), CY - nr * math.cos(a)
        top = y - cell('vt_num') / 2.0 + 2
        widgets.append({'id': 'n%d_sh' % k, 'type': 'text', 'z': 4, 'x': int(round(x - 50 + 1)), 'y': int(round(top + 4)),
                        'w': 100, 'h': cell('vt_num'), 'text': str(k), 'font': 'vt_num', 'color': 'shade', 'align': 'center',
                        'glow': True, 'rate': 60000})
        for face, (lo, hi) in FACES.items():
            c1, c2 = hi if k * 1000 >= RED else lo
            widgets.append({'id': 'n%d_%s' % (k, face), 'type': 'text', 'z': 5, 'x': int(round(x - 50)), 'y': int(round(top)),
                            'w': 100, 'h': cell('vt_num'), 'text': str(k), 'font': 'vt_num', 'color': c1, 'color2': c2,
                            'align': 'center', 'toggle': 'vetroDial=' + face, 'rate': 60000})
    # --- the speed (right-aligned, its unit after it) and the gear (AUTO / MANUAL under it), in their glass boxes
    text('speed', 1158, 306 + 0.36 * cell('vt_speed'), 220, '{{speed}}', 'vt_speed', 'fg', 'right', rate=FAST, own=True)
    text('speed_u', 1166, 320 + 7, 80, '{{u:speedLc}}', 'vt_unit', 'dim', 'left')
    text('gear', CX + 0.30 * R, 428 + 0.36 * cell('vt_gear'), 120, '{{gearnum}}', 'vt_gear', 'fg', 'center', rate=FAST, own=True)
    text('prog', CX + 0.30 * R - 32, 484, 140, '{{progWord}}', 'vt_word', 'dim', 'left')

    # --- the bars: the reading over the right end (the number, the unit small after it), the icon before the track; in
    #     the left panel, or the first two under the car while the map shows
    places = [(b['x'], b['y'], BAR_W, i, '!mapUp', '') for i, b in enumerate(bars)]
    places += [(m['x'], m['y'], m['w'], m['of'], 'mapUp', 'm') for m in MAP_BARS]
    for x0, by, bw, i, mt, sfx in places:
        icon, tok, unit, ufont, sig, mn, mx = ROWS[i]
        rx = x0 + bw
        if sig == 'boost':
            for tg, t2, ic in (('showBoost', tok, 'gauge'), ('!showBoost', '{{intake}}', 'therm')):
                k = '' if tg == 'showBoost' else 'i'
                text('b%d_v%s%s' % (i, k, sfx), rx - 44, by - 8, 160, t2, 'vt_val', 'fg', 'right', toggle=tg + '&' + mt,
                     rate=FAST if tg == 'showBoost' else None, own=True)
                text('b%d_u%s%s' % (i, k, sfx), rx - 38, by - 8, 44, unit if tg == 'showBoost' else '{{u:temp}}',
                     ufont if tg == 'showBoost' else 'vt_deg', 'dim', 'left', toggle=tg + '&' + mt)
                widgets.append({'id': 'b%d_icon%s%s' % (i, k, sfx), 'type': 'icon', 'icon': ic, 'z': 5,
                                'x': int(x0 - 45), 'y': int(by - 5), 'w': 35, 'h': 35, 'color': 'fg', 'toggle': tg + '&' + mt})
            continue
        text('b%d_v%s' % (i, sfx), rx - 44, by - 8, 160, tok, 'vt_val', 'fg', 'right', own=True, toggle=mt)
        text('b%d_u%s' % (i, sfx), rx - 38, by - 8, 44, unit, ufont, 'dim', 'left', toggle=mt)
        widgets.append({'id': 'b%d_icon%s' % (i, sfx), 'type': 'icon', 'icon': icon, 'z': 5, 'x': int(x0 - 45), 'y': int(by - 5),
                        'w': 35, 'h': 35, 'color': 'fg', 'toggle': mt})
        if sig == 'oilP':
            text('b%d_p%s' % (i, sfx), x0 - 14, by + 5, 14, 'P', 'vt_p', 'fg', 'center', toggle=mt)
    # --- the peak boost (setting "vetroPeak"): PEAK and its reading in amber over the boost bar's left end (the marker on
    #     the bar is the shader's); in the left panel, or under the car while the map shows
    for x0, by, mt, sfx in ((bars[0]['x'], bars[0]['y'], '!mapUp', ''), (MAP_BARS[0]['x'], MAP_BARS[0]['y'], 'mapUp', 'm')):
        tg = 'vetroPeak&showBoost&' + mt
        text('pk_l' + sfx, x0, by - 9, 44, '{{pullPeakLabel}}', 'vt_tiny', 'accent', 'left', toggle=tg)
        text('pk_v' + sfx, x0 + 48, by - 9, 80, '{{pullPeak}}', 'vt_pk', 'accent', 'left', toggle=tg)
    # --- the fuel: the pump icon before the cells, the range in amber after them
    widgets.append({'id': 'fuel_icon', 'type': 'icon', 'icon': 'fuel', 'z': 5, 'x': F[0] - 42, 'y': F[1] - 4, 'w': 32, 'h': 32,
                    'color': 'fg'})
    text('range', F[0] + F[2] + 114, F[1] + 22, 110, '{{range}}', 'vt_range', 'accent', 'right')
    text('range_u', F[0] + F[2] + 120, F[1] + 22, 50, '{{u:distLc}}', 'vt_small', 'accent', 'left')

    # --- the right panel: the drive mode by its stroke, the heading, the car, the tyres' readings in their boxes
    text('mode', tx + 30, RIGHT[0] + 24, 400, '{{mode}}', 'vt_mode', 'accent', 'left')
    # the heading: the tyres, now playing, or the gauges while the map shows
    hx = tx + 34
    text('tyre_head', hx, RIGHT[0] + 86, 200, 'Tires', 'vt_head', 'head', 'left', toggle='vetroRight=tires&!mapUp')
    text('music_head', hx, RIGHT[0] + 86, 260, 'Now Playing', 'vt_head', 'head', 'left', toggle='vetroRight=music&!mapUp')
    text('gauge_head', hx, RIGHT[0] + 86, 200, 'Gauges', 'vt_head', 'head', 'left', toggle='mapUp')
    # the car and the tyres' readings (setting "vetroRight" tires, the map down)
    cx_, cy_, dx_, dy_ = CAR
    cw, bh, pf, py, ty = 150, 37, 'vt_tp', 40, 64
    tg = 'vetroRight=tires&!mapUp'
    widgets.append({'id': 'tyre_car', 'type': 'icon', 'icon': 'carXray', 'z': 5, 'x': cx_ - cw // 2, 'y': cy_ - cw,
                    'w': cw, 'h': 2 * cw, 'toggle': tg})
    for pos, sx, sy in (('FL', -1, -1), ('FR', 1, -1), ('RL', -1, 1), ('RR', 1, 1)):
        bx, y0 = cx_ + sx * dx_, cy_ + sy * dy_ - bh
        text('tp_' + pos, bx + 12, y0 + py, 100, '{{tyreP:%s}}' % pos, pf, 'fg', 'right', toggle=tg)
        text('tpu_' + pos, bx + 17, y0 + py, 40, '{{u:pressure}}', 'vt_small', 'dim', 'left', toggle=tg)
        text('tt_' + pos, bx, y0 + ty, 110, '{{tyreT:%s}}{{u:temp}}' % pos, 'vt_tt', 'cool', 'center', toggle=tg)
    # now playing (setting "vetroRight" music, the map down): the song, the artist under it, the progress track (the
    # shader's) with the time gone and the time left under its ends; a quiet line while nothing plays
    tg = 'vetroRight=music&!mapUp'
    text('np_title', MX, 374, MW, '{{mediaTitle}}', 'v_title', 'fg', 'left', toggle=tg, showWhen='media', ellipsis=True)
    text('np_artist', MX, 422, MW, '{{mediaArtist}}', 'vt_artist', 'dim', 'left', toggle=tg, showWhen='media', ellipsis=True)
    text('np_at', MX, 516, 120, '{{mediaElapsed}}', 'vt_time', 'dim', 'left', toggle=tg, showWhen='media')
    text('np_left', MX + MW, 516, 120, '{{mediaLeft}}', 'vt_time', 'dim', 'right', toggle=tg, showWhen='media')
    text('np_none', MX, 374, MW, 'Nothing playing', 'vt_head', 'dim', 'left', toggle=tg, showWhen='!media')

    # --- the strip: covered, nothing in it; BMW's gear letter left clear ------------------------------------------------
    widgets += [
        {'id': 'strip_cover_l', 'type': 'fill', 'class': 'content', 'z': 0, 'x': 0, 'y': 660, 'w': 1380, 'h': 60,
         'color': 'bg', 'stripRow': 'l'},
        {'id': 'strip_cover_r', 'type': 'fill', 'class': 'content', 'z': 0, 'x': 1460, 'y': 660, 'w': 460, 'h': 60,
         'color': 'bg', 'stripRow': 'r'},
    ]
    # connections (8 layers each): the right panel on 1, the left side on 2, the dial and the strip on 0
    for w in widgets:
        if w['id'] in ('dash', 'needle') or w['id'].startswith('strip'):
            continue
        if w['x'] >= 1250:
            w['conn'] = 1
        elif w['x'] + w['w'] <= 800:
            w['conn'] = 2
    # slow texts checked less often (as Circuit)
    for w in widgets:
        if w['type'] == 'text' and 'rate' not in w and not w.get('own'):
            toks = [t.split('}}')[0] for t in w['text'].split('{{')[1:]]
            if any(t in ('oil', 'intake', 'oilP', 'mode', 'coolant', 'progWord', 'pullPeak', 'pullPeakLabel') for t in toks):
                continue
            w['rate'] = 2000 if all(t.startswith('u:') for t in toks) else 1000
    return {
        'schemaVersion': 2,
        'name': 'Vetro',
        'theme': 'vetro',
        '_about': 'An Italian GT style cluster, generated by tools/gen_vetro.py (edit that and regenerate): one rdash layer '
                  'draws a perforated floor, the rev counter under glass (its face black, red or yellow: "vetroDial"), a '
                  'blue panel with four bars and the fuel on the left and a glass tyre panel on the right; the numbers, '
                  'speed, gear and readings are text over it. Nothing in the strip.',
        'widgets': widgets,
    }


if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    fdir = root + '/apps/cluster_themes/hud/fonts/'
    fonts = {}
    for f in ('vt_num', 'vt_speed', 'vt_gear', 'vt_word', 'vt_unit', 'vt_small', 'vt_val', 'vt_tp', 'vt_range', 'vt_mode',
              'vt_deg', 'vt_tt', 'vt_head', 'vt_p', 'vt_tiny', 'vt_pk', 'vt_time', 'v_title', 'vt_artist'):
        j = json.load(open(fdir + f + '.json'))
        fonts[f] = {'cellHeight': j['cellHeight'], 'baseline': j['baseline']}
    path = root + '/apps/cluster_themes/hud/layouts/vetro.json'
    with open(path, 'w') as f:
        json.dump(build(fonts), f, indent=2)
    print('wrote ' + path)
