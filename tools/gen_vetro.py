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
With "Show Waze map inside the theme" on, Waze's map takes the right panel while it shows; the gauges stay on the left
always (jsalicru, Nov 28 2026).
Without the map the right panel shows the setting "vetroRight": now playing (the song, the artist, its progress; the
default) or the tyres. No HV battery gauge (the M3 has none).
Nothing in the strip (covered, BMW's gear letter left clear, as Circuit).

    python3 tools/gen_vetro.py .
"""
import json
import math
import sys

W, H = 1920, 660
# (jsalicru, Nov 28 2026: the tach bigger, down into BMW's strip: its foot runs on under y 660 left of the gear gap,
# drawn there by a small second dash layer, "dash_low"; was 960, 330, 300)
CX, CY, R = 960, 370, 340
NX = 628                                                # the needle layer's left end (its tip reaches x 632; BMW's belt light ends at 626)
STRIP_R = 1210                                          # the strip piece's right end: clear of BMW's gap (x 1214 to 1525)
START, SWEEP, THOUSANDS, RED = 180, 225, 8, 7200
FAST = 45
# (jsalicru, Nov 27 2026: the panels as big as the screen allows, near its top to just over BMW's strip)
# (jsalicru, Nov 28 2026: out to the screen's left edge, no bowed end, as the map runs out on the right; was 70 .. 26)
LEFT = [0, 36, 646, 0]                                 # the left panel: its end x, top, bottom, bow
RIGHT = [36, 646, 1890, 1862]                           # the right panel: top, bottom, right x at the top, at the bottom
CAR = [1560, 372, 175, 90]
LCURVE_R, LCURVE_GAP = R + 40, 24                      # the bars' right ends round the dial (Nov 28)
BAR_R, BAR_W = 640, 482                                # the left bars: one column, its right edge clear of the dial
# the Waze map (setting "Show Waze map inside the theme"; jsalicru, Nov 28 2026: in the right panel, the gauges on the left
# always; it was in the left panel to 0.25): the window from under the panel's header (the drive mode, the red line) to
# just over its foot, from under the dial's ring (where it fades out) to the panel's slanted right end
MAP = [1180, RIGHT[0] + 44, 1920 - 1180, RIGHT[1] - 10 - (RIGHT[0] + 44)]
MAP_AIM = round((1605 - MAP[0]) / float(MAP[2]), 3)                                        # the car's arrow in the middle of the part in view (x ~1340 to ~1870)
ROW_Y, ROW_DY = 130, 110                                # the bars' rows (always in the left panel); the fuel a row under the last
FACES = {                                                # the numbers' colours per face: (0..7, 8)
    'black': (('num', 'numLow'), ('numRed', 'numRedLow')),
    'red': (('num', 'numLow'), ('numBlack', 'numBlackLow')),
    'yellow': (('numDark', 'numDarkLow'), ('numRed', 'numRedLow')),
}
# the left bars: icon, value, unit, signal, min, max (+ the boost row's stand-in while "Show boost" is off)
# Sweep's temperature bands (jsalicru, Nov 26 2026), deg C: the bar and its reading cold blue, warm orange, hot red
F2C = lambda f: round((f - 32) * 5 / 9.0, 2)
ZONES = {
    'oil': [{'above': F2C(260), 'color': 'hot'}, {'above': F2C(235), 'color': 'warn'}, {'below': F2C(160), 'color': 'cold'}],
    'coolant': [{'above': F2C(240), 'color': 'hot'}, {'below': F2C(160), 'color': 'cold'}],
    'intake': [{'above': F2C(180), 'color': 'hot'}],
}
FUEL_LOW = 80.47                                         # km: the fuel and range amber under 50 miles
# Sweep's rev scales ("revScale"): even, or race (5000 rpm half way round), race55 (5500): the angle goes as
# (rpm / 8000) ^ spread
REV_CURVES = {name: round(math.log(0.5) / math.log(rpm / 8000.0), 4) for name, rpm in (('race', 5000), ('race55', 5500))}
# and on them, as Sweep's, the top squeezed: from 7400 rpm to 8000 in 3/8 of its width, 7 and 8 closer (jsalicru)
TAIL = [7400, 0.375]
REV_TAILS = {name: TAIL for name in REV_CURVES}


def rev_pos(v, curve, tail):
    """Where rpm v (0..1 of the scale) sits round the dial (0..1), as the shaders have it (u_curve)."""
    if not tail:
        return v ** curve
    p0, p = (tail[0] / 8000.0) ** curve, v ** curve
    s0 = 1 - (1 - p0) * tail[1]
    return p * s0 / p0 if p <= p0 else s0 + (p - p0) * tail[1]

# (jsalicru, Nov 28 2026: the two oil gauges together, the water temperature a row down)
ROWS = [
    ('gauge', '{{boost}}', '{{u:boostLc}}', 'vt_small', 'boost', 0, 2.758),
    ('oilcan', '{{oil}}', '{{u:temp}}', 'vt_deg', 'oil', 50, 150),
    ('oilcan', '{{oilP}}', '{{u:boostLc}}', 'vt_small', 'oilP', 0, 5.516),
    ('therm', '{{coolant}}', '{{u:temp}}', 'vt_deg', 'coolant', 50, 130),
]


def build(fonts):
    cell = lambda f: fonts[f]['cellHeight']
    base = lambda f: fonts[f]['baseline']
    widgets = []
    band = R + 36
    tx = CX + math.sqrt((band + 6) ** 2 - (RIGHT[0] + 18 - CY) ** 2) + 10
    MX, MW = CX + R + 70, 480                           # now playing: its left end (clear of the dial at mid height), its width

    def text(id_, x, baseline, w, t, font, color='fg', align='left', **kw):
        """A text box w wide whose glyphs sit on baseline; x is its left (align left), right (right) or middle (center)."""
        x0 = x if align == 'left' else x - w if align == 'right' else x - w / 2.0
        d = {'id': id_, 'type': 'text', 'z': 5, 'x': int(round(x0)), 'y': int(round(baseline - base(font))), 'w': int(w),
             'h': cell(font), 'text': t, 'font': font, 'color': color, 'align': align}
        d.update({k: v for k, v in kw.items() if v is not None})
        widgets.append(d)

    # now playing's progress track (the shader's): x, y (its middle), width
    MEDIA = [MX, 420, MW]
    # bars' boxes: right ends on a curve round the dial, so the stack leans with it
    bars, rows_y = [], [ROW_Y + i * ROW_DY for i in range(4)]
    # (jsalicru, Nov 28 2026) their right ends follow the curve of the panel's right edge round the dial: LCURVE_GAP px
    # left of a circle LCURVE_R round its centre at the track's height; the left ends stay put
    lend = lambda y: min(BAR_R, int(round(CX - math.sqrt(max(LCURVE_R ** 2 - (y + 15 - CY) ** 2, 0)) - LCURVE_GAP)))
    for (icon, tok, unit, ufont, sig, mn, mx), by in zip(ROWS, rows_y):
        b = {'x': BAR_R - BAR_W, 'y': by, 'w': lend(by) - (BAR_R - BAR_W), 'signal': sig, 'min': mn, 'max': mx}
        if sig in ZONES:
            b['zones'] = ZONES[sig]
        if sig == 'boost':
            b.update({'alt': 'intake', 'altMin': 0, 'altMax': 100, 'altWhen': 'showBoost', 'altZones': ZONES['intake']})
        bars.append(b)
    F = [BAR_R - BAR_W, ROW_Y + 4 * ROW_DY, lend(ROW_Y + 4 * ROW_DY) - (BAR_R - BAR_W)]                             # (Nov 28) a bar as the others, its reading over its right end
    widgets.append({'id': 'dash', 'type': 'rdash', 'class': 'content', 'z': 1, 'x': 0, 'y': 0, 'w': W, 'h': H,
                    'tach': [CX, CY, R, START, SWEEP, THOUSANDS], 'red': RED, 'left': [round(v, 1) for v in LEFT],
                    'right': [round(v, 1) for v in RIGHT], 'bars': bars, 'fuel': F, 'fuelLow': FUEL_LOW, 'car': CAR, 'tyresIf': 'vetroRight=tires',
                    'tbox': [68, 37, 69, 1], 'hole': MAP, 'holeWhen': 'mapUp', 'holeInset': 0, 'holeAim': [MAP_AIM, 0.5],
                    'media': MEDIA, 'mediaIf': 'vetroRight=music',
                    'coldLimit': [48.89, 71.11, 4000], 'yellowLines': 2, 'waveBelow': 1200, 'revCurves': REV_CURVES, 'revTails': REV_TAILS})

    # --- the dial's foot in BMW's strip (y 660 on): the same dash shader on a small layer left of the gear gap, plain
    #     black round the dial as the strip covers (jsalicru, Nov 28 2026: the tach bigger and lower)
    d0 = widgets[-1]
    lx = 740                                            # (the foot is x 771 to 1149 at y 660; BMW's belt light x 587 to 626 left clear)
    widgets.append({'id': 'dash_low', 'type': 'rdash', 'class': 'content', 'z': 1, 'x': lx, 'y': H, 'w': STRIP_R - lx, 'h': 720 - H,
                    'plain': True, 'tach': d0['tach'], 'red': RED, 'left': d0['left'], 'right': d0['right'], 'bars': d0['bars'],
                    'fuel': d0['fuel'], 'car': CAR, 'tyresIf': 'vetroRight=tires', 'tbox': d0['tbox'],
                    'coldLimit': d0['coldLimit'], 'yellowLines': 2, 'waveBelow': 1200, 'revCurves': REV_CURVES, 'revTails': REV_TAILS})

    # --- the needle and its cap on a layer of their own, over the numbers (z 6)
    widgets.append({'id': 'needle', 'type': 'rneedle', 'class': 'content', 'z': 6, 'x': NX, 'y': CY - R, 'w': STRIP_R - NX, 'h': 720 - (CY - R),
                    'tach': [CX, CY, R, START, SWEEP, THOUSANDS], 'conn': 1, 'toggle': 'vetroRev=needle|sweep',
                    'revCurves': REV_CURVES, 'revTails': REV_TAILS})
    # --- the rev counter's numbers: a soft shadow under each, the number per face (silver; the redline one red)
    nr = R - 77                                         # (the ladder 19 px wide)
    #     per rev scale ("revScale"), at their angle on it; the race scales leave out the 0 (no room for both; jsalicru: keep the 1)
    for scale, curve in [('even', 1)] + sorted(REV_CURVES.items()):
        sid = '' if scale == 'even' else '_' + scale
        for k in range(THOUSANDS + 1):
            if k == 0 and scale != 'even':
                continue
            a = math.radians(START + SWEEP * rev_pos(k / float(THOUSANDS), curve, REV_TAILS.get(scale)))
            x, y = CX + nr * math.sin(a), CY - nr * math.cos(a)
            top = y - cell('vt_num') / 2.0 + 2
            widgets.append({'id': 'n%d_sh%s' % (k, sid), 'type': 'text', 'z': 4, 'x': int(round(x - 50 + 1)), 'y': int(round(top + 4)),
                            'w': 100, 'h': cell('vt_num'), 'text': str(k), 'font': 'vt_num', 'color': 'shade', 'align': 'center',
                            'glow': True, 'rate': 60000, 'toggle': 'revScale=' + scale})
            for face, (lo, hi) in FACES.items():
                c1, c2 = hi if k * 1000 >= RED else lo
                widgets.append({'id': 'n%d_%s%s' % (k, face, sid), 'type': 'text', 'z': 5, 'x': int(round(x - 50)), 'y': int(round(top)),
                                'w': 100, 'h': cell('vt_num'), 'text': str(k), 'font': 'vt_num', 'color': c1, 'color2': c2,
                                'align': 'center', 'toggle': 'vetroDial=' + face + '&revScale=' + scale, 'rate': 60000})
    # --- the speed (right-aligned, its unit after it) and the gear (AUTO / MANUAL under it), in their glass boxes
    text('speed', CX + 0.66 * R, CY - 0.08 * R + 0.36 * cell('vt_speed'), 220, '{{speed}}', 'vt_speed', 'fg', 'right', rate=FAST, own=True)
    text('speed_u', CX + 0.687 * R, CY - 0.033 * R + 7, 80, '{{u:speedLc}}', 'vt_unit', 'dim', 'left')
    text('gear', CX + 0.30 * R, CY + 0.327 * R + 0.36 * cell('vt_gear'), 120, '{{gearnum}}', 'vt_gear', 'fg', 'center', rate=FAST, own=True)
    text('prog', CX + 0.30 * R - 32, CY + 0.513 * R, 140, '{{progWord}}', 'vt_word', 'dim', 'left')

    # --- the bars: the reading over the right end (the number, the unit small after it), the icon before the track; in
    #     the left panel, or the first two under the car while the map shows
    J = lambda *ts: '&'.join(t for t in ts if t) or None
    places = [(b['x'], b['y'], b['w'], i, None, '') for i, b in enumerate(bars)]     # always on the left (Nov 28)
    for x0, by, bw, i, mt, sfx in places:
        icon, tok, unit, ufont, sig, mn, mx = ROWS[i]
        rx = x0 + bw
        if sig == 'boost':
            for tg, t2, ic in (('showBoost', tok, 'gauge'), ('!showBoost', '{{intake}}', 'therm')):
                k = '' if tg == 'showBoost' else 'i'
                text('b%d_v%s%s' % (i, k, sfx), rx - 44, by - 8, 160, t2, 'vt_val', 'fg', 'right', toggle=J(tg, mt),
                     rate=FAST if tg == 'showBoost' else None, own=True,
                     lowWhen=None if tg == 'showBoost' else [dict(z, signal='intake') for z in ZONES['intake']])
                text('b%d_u%s%s' % (i, k, sfx), rx - 38, by - 8, 44, unit if tg == 'showBoost' else '{{u:temp}}',
                     ufont if tg == 'showBoost' else 'vt_deg', 'dim', 'left', toggle=J(tg, mt))
                widgets.append({'id': 'b%d_icon%s%s' % (i, k, sfx), 'type': 'icon', 'icon': ic, 'z': 5,
                                'x': int(x0 - 45), 'y': int(by - 5), 'w': 35, 'h': 35, 'color': 'fg', 'toggle': J(tg, mt)})
            continue
        text('b%d_v%s' % (i, sfx), rx - 44, by - 8, 160, tok, 'vt_val', 'fg', 'right', own=True, toggle=mt,
             lowWhen=[dict(z, signal=sig) for z in ZONES[sig]] if sig in ZONES else None)
        text('b%d_u%s' % (i, sfx), rx - 38, by - 8, 44, unit, ufont, 'dim', 'left', toggle=mt)
        widgets.append({'id': 'b%d_icon%s' % (i, sfx), 'type': 'icon', 'icon': icon, 'z': 5, 'x': int(x0 - 45), 'y': int(by - 5),
                        'w': 35, 'h': 35, 'color': 'fg', 'toggle': mt})
        if sig == 'oilP':
            text('b%d_p%s' % (i, sfx), x0 - 14, by + 5, 14, 'P', 'vt_p', 'fg', 'center', toggle=mt)
    # --- the peak boost (setting "vetroPeak"): PEAK and its reading in amber over the boost bar's left end (the marker on
    #     the bar is the shader's); in the left panel, or under the car while the map shows
    for x0, by, mt, sfx in ((bars[0]['x'], bars[0]['y'], None, ''),):
        tg = J('vetroPeak&showBoost', mt)
        text('pk_l' + sfx, x0, by - 9, 44, '{{pullPeakLabel}}', 'vt_tiny', 'accent', 'left', toggle=tg)
        text('pk_v' + sfx, x0 + 48, by - 9, 80, '{{pullPeak}}', 'vt_pk', 'accent', 'left', toggle=tg)
    # --- the fuel with the gauges (left; right under them while the map shows): the pump icon before the cells, the
    #     range after them, white, amber under 50 miles as the cells (jsalicru)
    low = {'signal': 'range', 'below': FUEL_LOW, 'color': 'accent'}
    for (fx, fy, fw), mt, sfx in ((F, None, ''),):
        widgets.append({'id': 'fuel_icon' + sfx, 'type': 'icon', 'icon': 'fuel', 'z': 5, 'x': fx - 44, 'y': fy - 4, 'w': 32, 'h': 32,
                        'color': 'fg', 'toggle': mt})
        # the range over the bar's right end, as the gauges' readings (jsalicru, Nov 28 2026)
        text('range' + sfx, fx + fw - 44, fy - 8, 160, '{{range}}', 'vt_val', 'fg', 'right', toggle=mt, lowWhen=low)
        text('range_u' + sfx, fx + fw - 38, fy - 8, 50, '{{u:distLc}}', 'vt_small', 'dim', 'left', toggle=mt, lowWhen=low)

    # --- the right panel: the drive mode by its stroke, the heading, the car, the tyres' readings in their boxes
    text('mode', tx + 30, RIGHT[0] + 24, 400, '{{mode}}', 'vt_mode', 'accent', 'left')
    # the heading: the tyres or now playing (none over the gauges while the map shows)
    hx = MX
    text('tyre_head', hx, RIGHT[0] + 86, 200, 'Tires', 'vt_head', 'head', 'left', toggle='vetroRight=tires&!mapUp')
    text('music_head', hx, RIGHT[0] + 86, 260, 'Now Playing', 'vt_head', 'head', 'left', toggle='vetroRight=music&!mapUp')
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
    text('np_title', MX, 300, MW, '{{mediaTitle}}', 'v_title', 'fg', 'left', toggle=tg, showWhen='media', ellipsis=True)
    text('np_artist', MX, 348, MW, '{{mediaArtist}}', 'vt_artist', 'dim', 'left', toggle=tg, showWhen='media', ellipsis=True)
    text('np_at', MX, 462, 120, '{{mediaElapsed}}', 'vt_time', 'dim', 'left', toggle=tg, showWhen='media')
    text('np_left', MX + MW, 462, 120, '{{mediaLeft}}', 'vt_time', 'dim', 'right', toggle=tg, showWhen='media')
    text('np_none', MX, 300, MW, 'Nothing playing', 'vt_head', 'dim', 'left', toggle=tg, showWhen='!media')

    # --- the strip: covered, nothing in it; BMW's gear and programme area (x 1214 to 1525 on the G80) left clear, as this
    #     repo's other themes (jsbaughman's 1380 / 1460 gave the M3 black boxes) ------------------------------------------------
    widgets += [
        {'id': 'strip_cover_l', 'type': 'fill', 'class': 'content', 'z': 0, 'x': 0, 'y': 660, 'w': 1214, 'h': 60,
         'color': 'bg', 'stripRow': 'l'},
        {'id': 'strip_cover_r', 'type': 'fill', 'class': 'content', 'z': 0, 'x': 1525, 'y': 660, 'w': 395, 'h': 60,
         'color': 'bg', 'stripRow': 'r'},
    ]
    # connections (8 layers each): the right panel on 1, the left side on 2, the dial and the strip on 0
    for w in widgets:
        if w['id'] in ('dash', 'dash_low', 'needle') or w['id'].startswith('strip'):
            continue
        if w['x'] >= 1250:
            w['conn'] = 1
        elif w['x'] + w['w'] <= 800:
            w['conn'] = 2
    # slow texts checked less often (as Circuit)
    for w in widgets:
        if w['type'] == 'text' and 'rate' not in w and not w.get('own'):
            toks = [t.split('}}')[0] for t in w['text'].split('{{')[1:]]
            if w.get('lowWhen') or any(t in ('oil', 'intake', 'oilP', 'mode', 'coolant', 'progWord', 'pullPeak', 'pullPeakLabel') for t in toks):
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
