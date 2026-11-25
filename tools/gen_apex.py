"""gen_apex.py - writes apps/cluster_themes/hud/layouts/apex.json

Apex: a mid-engine supercar style needle dash on the 1920x720 cluster, drawn by one cdash effect layer (shaders.js):
- a carbon backdrop with red-glow side panels;
- a round rev counter in the middle, 0..8, its band lit white up to the revs over fixed amber-to-red zones, a red
  needle; the gear big in the middle, the drive mode under it, the speed in the open quarter at the bottom right;
- left: boost and oil temperature, each a value over a line bar with a marker, min / max under it and a red end zone;
  coolant along the bottom;
- right: a G-meter (gmeter) under a "Performance" header; fuel along the bottom;
- the theme's own clock, range and outside temperature in the strip below, BMW's gear letter left uncovered.

    python3 tools/gen_apex.py .
"""
import json
import math
import sys

W, H = 1920, 660
CX, CY, R, BAND = 960, 332, 318, 46
START, SWEEP, THOUSANDS = 100, 260, 8
HEAD_H = 43                   # a_head's cell height
HEAD_DY = -1                  # headings sit on the rule as v_title did
GLOW = [0, 0, 0, 0]   # the glow outward from the gear's ring when the app has no dialGlow setting: r, g, b, strength (0 = none)
CAR = [1570, 360, 50, 112]   # the tyre panel's car: centre x, y, half width, half length
PERF, TYRES, POWER = 'rightPanel=performance', 'rightPanel=tyres', 'rightPanel=power'
LBARS, LGAUGE = '!leftStyle=gauges', 'leftStyle=gauges'   # the left side's two styles
LX0, LX1 = 110, 590            # the left panel's content
FAST = 45                     # ms: the speed, gear and boost redraw on every 50 ms tick (other text every 200)
FAST_IDS = ()   # Fast numbers withdrawn in 0.21.4: the GPU text (gtext) took the car's displays down (Nov 22 2026)
OWN_IDS = ('gear', 'gear_s', 'gear_m', 'gear_ms', 'speed', 'speed_m', 'gear_c', 'gear_s_c', 'gear_m_c', 'gear_ms_c', 'speed_c', 'speed_m_c') + \
    tuple('%s%d%s_v' % (st, sp, k) for st in 'rg' for sp in (0, 1) for k in ('boost', 'oil', 'intake', 'oilP', 'coolant'))   # every pick's value alike (in-place switch)   # each on its own small image layer (0.21.5): a change uploads only that
                                                        # small picture's changed rect, not a rect of a big shared sheet
MAP_FEATHER = 80              # the window's edge fades into the dial over this many px (inward), under the numbers
MAP_R = 262                   # the map window's radius, to the tick marks (Waze draws its map in this square: hud.js _mapHost)
ZONES = [6500, 7000]          # amber from 6500 rpm, red from 7000
# "Leave room for the driver camera" (cameraNotch; visible.CAMERA 760..1160 x 0..110): the tach smaller and lower, clear
# of the camera at the top and above the bottom strip; everything in it moves with it (a second set, toggled)
CAM = 'cameraNotch'
CCX, CCY, CR = 960, 388, 258
CS = CR / float(R)            # how much smaller (0.81)
CAM_FONTS = {'a_gear': ('a_gear_c', 133), 'a_gear_s': ('a_gear_s_c', 123), 'a_speed': ('a_speed_c', 63),
             'a_unit': ('a_unit_c', 31), 'a_tach': ('a_tach_c', 40)}   # font: (its 0.81 copy, cell height)


def both(t, extra):
    return extra if not t else extra + '&' + t


def cam_copy(ws):
    """The tach's own widgets twice: as they are while the camera setting is off, and scaled round the dial's centre to
    the smaller dial (CCX, CCY, CR) while it is on. Each box keeps its size (the same fonts); its centre moves."""
    out = []
    for w in ws:
        a = dict(w); a['toggle'] = both(w.get('toggle'), '!' + CAM)
        b = dict(w); b['id'] = w['id'] + '_c'; b['toggle'] = both(w.get('toggle'), CAM)
        if w.get('font') in CAM_FONTS:            # the dial's own big text: its 0.81 font, its box to match
            b['font'], b['h'] = CAM_FONTS[w['font']]
            b['w'] = int(round(w['w'] * CS))
            if 'dx' in w:
                b['dx'] = int(round(w['dx'] * CS))
        mx, my = w['x'] + w['w'] / 2.0, w['y'] + w['h'] / 2.0
        b['x'] = int(round(CCX + (mx - CX) * CS - b['w'] / 2.0))
        b['y'] = int(round(CCY + (my - CY) * CS - b['h'] / 2.0))
        out += [a, b]
    return out

# the min / max labels follow the Units setting (this engine's toggles take one setting; a separate temperature or
# pressure unit setting is not followed by these labels, only by the values)
# the left gauges' choices (settings leftTop / leftBottom; hud.js "left0" / "left1", boost off -> intake): heading, value,
# unit, the bar (signal, min, max, where red starts 0..1) and the scale's numbers per unit system (min, middle, max)
LEFT = [
    ('boost', 'Boost', '{{boost}}', '{{u:boostLc}}', {'signal': 'boost', 'min': 0, 'max': 2.758, 'red': 0.75},
     [(['uPress=us'], ('0', '20', '40')), (['uPress=metric'], ('0', '1.4', '2.8'))]),
    ('oil', 'Oil Temp', '{{oil}}', '{{u:temp}}', {'signal': 'oil', 'min': 50, 'max': 150, 'red': 0.8},
     [(['uTemp=us'], ('122', '212', '302')), (['uTemp=metric'], ('50', '100', '150'))]),
    ('intake', 'Intake Temp', '{{intake}}', '{{u:temp}}', {'signal': 'intake', 'min': 0, 'max': 100, 'red': 0.6},
     [(['uTemp=us'], ('32', '122', '212')), (['uTemp=metric'], ('0', '50', '100'))]),
    ('oilP', 'Oil Pressure', '{{oilP}}', '{{u:boostLc}}', {'signal': 'oilP', 'min': 0, 'max': 6.205, 'red': 1},
     [(['uPress=us'], ('0', '45', '90')), (['uPress=metric'], ('0', '3.1', '6.2'))]),
    ('coolant', 'Water Temp', '{{coolant}}', '{{u:temp}}', {'signal': 'coolant', 'min': 50, 'max': 130, 'red': 0.81},
     [(['uTemp=us'], ('122', '194', '266')), (['uTemp=metric'], ('50', '90', '130'))]),
]
PICKS = {k: {c[0]: c[4] for c in LEFT} for k in ('left0', 'left1')}

PSI = ['uPress=us']
BAR = ['uPress=metric']
DEGF = ['uTemp=us']
DEGC = ['uTemp=metric']


def text(id_, x, y, w, h, t, font, color='fg', align='center', **kw):
    d = {'id': id_, 'type': 'text', 'z': 5, 'x': int(round(x)), 'y': int(round(y)), 'w': int(w), 'h': int(h),
         'text': t, 'font': font, 'color': color, 'align': align}
    d.update({k: v for k, v in kw.items() if v is not None})
    return d


def unit_labels(id_, x, y, w, align, lo_hi_by_unit):
    """Min / max labels under a bar, one copy per unit condition."""
    out = []
    for j, (conds, label) in enumerate(lo_hi_by_unit):
        for i, cond in enumerate(conds):
            out.append(text('%s_%d%d' % (id_, j, i), x, y, w, 26, label, 'a_lim', 'dim', align, toggle=cond))
    return out


def readout(n, x0, x1, y, label, tok, unit_tok, bar, lo, hi, toggle=None, conn=None):
    """A left-panel block: label, a rule, the value and unit, the bar, min / max under it."""
    mid = (x0 + x1) / 2
    out = [text('r%s_l' % n, mid - 220, y + HEAD_DY, 440, HEAD_H, label, 'a_head', 'accent'),
           text('r%s_v' % n, mid - 190, y + 79, 220, 38, tok, 'a_tp', 'fg', 'right', rate=FAST if tok in ('{{boost}}', '{{power}}', '{{torque}}') else None),
           text('r%s_u' % n, mid + 38, y + 84, 120, 36, unit_tok, 'm_unit', 'fg', 'left')]
    out += unit_labels('r%s_lo' % n, bar['x'] - 2, bar['y'] + 16, 80, 'left', lo)
    out += unit_labels('r%s_hi' % n, bar['x'] + bar['w'] - 78, bar['y'] + 16, 80, 'right', hi)
    for w in out:                       # a panel shown by a setting (its min / max labels bring their own toggle)
        if toggle and 'toggle' not in w:
            w['toggle'] = toggle
        elif toggle and w['toggle'] != toggle:
            w['toggle'] = toggle + '&' + w['toggle']
        if conn is not None:
            w['conn'] = conn
    return out


def gauge(n, y, label, tok, unit_tok, bar, scale_by_unit, toggle=None):
    """A hatched-gauge block: the heading left and the value right on one row (the rule under them is the shader's),
    the scale's numbers above the gauge (min, middle, max in red)."""
    t = LGAUGE + ('&' + toggle if toggle else '')
    out = [text('g%s_l' % n, LX0, y + HEAD_DY, 300, HEAD_H, label, 'a_head', 'accent', 'left', toggle=t),
           text('g%s_v' % n, LX1 - 238, y + 3, 180, 38, tok, 'a_tp', 'fg', 'right', toggle=t, rate=FAST if tok == '{{boost}}' else None),
           text('g%s_u' % n, LX1 - 52, y + 8, 60, 36, unit_tok, 'm_unit', 'fg', 'left', toggle=t)]
    x0 = bar['x'] + bar['h'] / 2 * 0.45                       # the scale starts over the gauge's top-left corner
    ly = bar['y'] - bar['h'] / 2 - 14 - 10 - 27               # above the ticks
    for j, (conds, (lo, mid, hi)) in enumerate(scale_by_unit):
        for i, cond in enumerate(conds):
            c = t + '&' + cond
            out += [text('g%s_lo_%d%d' % (n, j, i), x0 - 4, ly, 90, 23, lo, 'a_sm', 'dim', 'left', toggle=c),
                    text('g%s_mid_%d%d' % (n, j, i), x0 + bar['w'] / 2 - 45, ly, 90, 23, mid, 'a_sm', 'dim', 'center', toggle=c),
                    text('g%s_hi_%d%d' % (n, j, i), x0 + bar['w'] - 86, ly, 90, 23, hi, 'a_sm', 'hot', 'right', toggle=c)]
    return out


def build():
    widgets = []
    # --- the bars and rule lines the shader draws ---------------------------------------------------------------
    LX0, LX1 = 110, 590            # the left panel's content
    RX0, RX1 = 1330, 1810          # the right panel's content
    bars = [
        {'x': 140, 'y': 296, 'w': 420, 'pick': 'left0', 'signal': 'boost', 'min': 0, 'max': 2.758, 'red': 0.75, 'h': 9, 'toggle': LBARS},
        {'x': 140, 'y': 506, 'w': 420, 'pick': 'left1', 'signal': 'oil', 'min': 50, 'max': 150, 'red': 0.8, 'h': 9, 'toggle': LBARS},
        {'x': 300, 'y': 606, 'w': 200, 'signal': 'coolant', 'min': 40, 'max': 130, 'red': 0.85, 'mini': 18},
        {'x': 1420, 'y': 606, 'w': 200, 'signal': 'fuel', 'min': 0, 'max': 1, 'red': 1, 'mini': 18},
        {'x': 1360, 'y': 296, 'w': 420, 'signal': 'powerPct', 'min': 0, 'max': 100, 'red': 1, 'h': 9, 'toggle': POWER},
        {'x': 1360, 'y': 506, 'w': 420, 'signal': 'torquePct', 'min': 0, 'max': 100, 'red': 1, 'h': 9, 'toggle': POWER},
        # the left side's other style: slanted gauges
        {'x': 120, 'y': 284, 'w': 440, 'pick': 'left0', 'signal': 'boost', 'min': 0, 'max': 2.758, 'red': 0.75, 'h': 30, 'style': 'gauge', 'toggle': LGAUGE},
        {'x': 120, 'y': 494, 'w': 440, 'pick': 'left1', 'signal': 'oil', 'min': 50, 'max': 150, 'red': 0.8, 'h': 30, 'style': 'gauge', 'toggle': LGAUGE},
    ]
    lines = [[LX0, 192, LX1, 192], [LX0, 402, LX1, 402], [RX0, 192, RX1, 192],
             [LX0, 560, LX1, 560], [RX0, 560, RX1, 560], [RX0, 402, RX1, 402, POWER]]
    for cam in (False, True):
        cx, cy, r, sc = (CCX, CCY, CR, CS) if cam else (CX, CY, R, 1.0)
        mr = int(round(MAP_R * sc))
        widgets.append({'id': 'dash_c' if cam else 'dash', 'type': 'cdash', 'class': 'content', 'z': 1, 'x': 0, 'y': 0, 'w': W, 'h': H,
                        'tach': [cx, cy, r, int(round(BAND * sc)), START, SWEEP, THOUSANDS], 'zones': ZONES,
                        'panels': [640, 1280, 120, 660], 'bars': bars, 'lines': lines, 'glow': GLOW, 'car': CAR,
                        # the Waze map (Map tab): a round window in the dial, hosted there (hud.js _mapHost)
                        'hole': [cx - mr, cy - mr, 2 * mr, 2 * mr], 'holeWhen': 'mapUp', 'holeInset': 0,
                        'holeFeather': int(round(MAP_FEATHER * sc)), 'toggle': CAM if cam else '!' + CAM})
    # --- the G-meter --------------------------------------------------------------------------------------------
    widgets.append({'id': 'gmeter', 'type': 'gmeter', 'class': 'content', 'z': 2, 'x': 1435, 'y': 205, 'w': 330,
                    'h': 290, 'conn': 1, 'toggle': PERF})
    # --- rev counter numbers, inside the marks ------------------------------------------------------------------
    tach = []
    num_r = R - BAND - 64
    for k in range(THOUSANDS + 1):
        a = math.radians(START + SWEEP * k / float(THOUSANDS))
        x, y = CX + num_r * math.cos(a), CY + num_r * math.sin(a)
        col = 'hot' if k * 1000 >= ZONES[1] else 'fg'
        tach.append(text('rpm%d' % k, x - 40, y - 24, 80, 47, str(k), 'a_tach', col))
    # --- the middle: gear, drive mode, speed in the open quarter, the scale's unit ------------------------------
    tach += [
        text('gear', CX - 130, CY - 82, 260, 163, '{{gearnum}}', 'a_gear', 'hot', dx=-7, toggle='!gearStyle=solid&!mapUp', rate=FAST),   # ink centred on the dial (the slant leans it right)
        text('gear_s', CX - 130, CY - 76, 260, 151, '{{gearnum}}', 'a_gear_s', 'hot', dx=-12, toggle='gearStyle=solid&!mapUp', rate=FAST),   # the solid one
        # with the Waze map in the dial: the gear small under the speed in the open quarter (see the speed below)
        text('gear_m', CX + 6, CY + 222, 180, 69, '{{gearnum}}', 'a_gear_m', 'hot', dx=-2, toggle='!gearStyle=solid&mapUp', rate=FAST),
        text('gear_ms', CX + 6, CY + 226, 180, 61, '{{gearnum}}', 'a_gear_ms', 'hot', dx=-6, toggle='gearStyle=solid&mapUp', rate=FAST),
        text('mode', CX - 120, CY + 92, 240, 24, '{{mode}}', 'v_label', 'accent', toggle='!mapUp'),
        text('rpm_u1', CX + 170, CY + 30, 120, 30, 'RPM', 'r_label', 'hot', 'left'),
        text('rpm_u2', CX + 170, CY + 58, 120, 30, 'x1000', 'r_label', 'dim', 'left'),
        text('speed', CX - 60, CY + 105, 240, 76, '{{speed}}', 'a_speed', 'fg', 'right', dx=-24, rate=FAST, toggle='tachSpeed&!mapUp'),   # 16 px of room for the lean
        text('speed_u', CX + 178, CY + 142, 80, 37, '{{u:speedLc}}', 'a_unit', 'fg', 'left', toggle='tachSpeed&!mapUp'),
        # with the map: the speed smaller (the tach numbers' italic), just under RPM x1000, inside the outer ring
        text('speed_m', CX + 128, CY + 107, 200, 56, '{{speed}}', 'a_speed_m', 'fg', 'right', dx=-22, rate=FAST, toggle='tachSpeed&mapUp'),   # map mode: lower right, past the dial's edge (0.22.1)
        text('speed_um', CX + 316, CY + 132, 70, 37, '{{u:speedLc}}', 'a_unit', 'fg', 'left', toggle='tachSpeed&mapUp'),   # on the number's baseline
    ]
    widgets += cam_copy(tach)
    # --- left: boost and oil temperature ------------------------------------------------------------------------
    # each spot (top 0, bottom 1) has a block per choice, shown while hud.js "left0" / "left1" says that choice
    for k, (y, bb, gb) in enumerate(((140, bars[0], bars[6]), (350, bars[1], bars[7]))):
        for key, label, tok, unit, _bar, scale in LEFT:
            pick = 'left%d=%s' % (k, key)
            widgets += readout('%d%s' % (k, key), LX0, LX1, y, label, tok, unit, bb,
                               [(c, v[0]) for c, v in scale], [(c, v[2]) for c, v in scale], toggle=LBARS + '&' + pick)
            # --- the other style: heading and value on one row, a hatched gauge under a tick scale -----------------
            widgets += gauge('%d%s' % (k, key), y, label, tok, unit, gb, scale, toggle=pick)
    # --- the bottom row: coolant left, fuel right ---------------------------------------------------------------
    widgets += [
        text('cool_v', 100, 584, 140, 42, '{{coolant}}', 'v_title', 'fg', 'right'),
        text('cool_u', 246, 590, 50, 36, '{{u:temp}}', 'm_unit', 'fg', 'left'),
        {'id': 'cool_i', 'type': 'icon', 'z': 5, 'x': 520, 'y': 590, 'w': 32, 'h': 32, 'icon': 'therm', 'color': 'fg'},
        {'id': 'fuel_i', 'type': 'icon', 'z': 5, 'x': 1370, 'y': 590, 'w': 32, 'h': 32, 'icon': 'fuel', 'color': 'fg',
         'conn': 1},
        text('fuel_v', 1640, 584, 170, 42, '{{fuelPct}} %', 'v_title', 'fg', 'left', conn=1),
    ]
    # --- right: the G-meter's header and readouts ---------------------------------------------------------------
    widgets += [
        text('perf', RX0, 140 + HEAD_DY, RX1 - RX0, HEAD_H, 'Performance', 'a_head', 'fg', conn=1, toggle=PERF),
        text('tyre_head', RX0, 140 + HEAD_DY, RX1 - RX0, HEAD_H, 'Tires', 'a_head', 'fg', conn=1, toggle=TYRES),
        text('g_vals', 1370, 506, 460, 42, '{{gSide}}    {{gFwd}}', 'v_title', 'fg', conn=1, toggle=PERF),
    ]
    # --- right, the third choice: horsepower and torque, as the left side's blocks, over % of the engine's peak ---------
    widgets += readout(2, RX0, RX1, 140, 'Horsepower', '{{power}}', '{{u:powerLc}}', bars[4],
                       [([POWER], '0')], [([POWER], '{{powerPeak}}')], toggle=POWER, conn=1)
    widgets += readout(3, RX0, RX1, 350, 'Torque', '{{torque}}', '{{u:torque}}', bars[5],
                       [([POWER], '0')], [([POWER], '{{torquePeak}}')], toggle=POWER, conn=1)
    # --- right, the other choice: the four tyres round a car seen from above (pressure, temperature under it) -----
    cx, cy, hw, hl = CAR
    # the car: an image over the dash's tyres (car_top.js); its box is a little wider than the body for the mirrors
    widgets.append({'id': 'tyre_car', 'type': 'icon', 'icon': 'carTop', 'z': 5, 'x': cx - round(hw * 1.16), 'y': cy - hl,
                    'w': 2 * round(hw * 1.16), 'h': 2 * hl, 'conn': 1, 'toggle': TYRES})
    for pos, side, fy in (('FL', -1, -1), ('FR', 1, -1), ('RL', -1, 1), ('RR', 1, 1)):
        ty = cy + fy * hl * 0.6                       # the tyre's centre, as the shader draws it
        end = cx - hw - 96 if side < 0 else cx + hw + 122     # where the pressure's digits end
        widgets += [
            text('tp_' + pos, end - 140, ty + 7 - 40, 140, 38, '{{tyreP:%s}}' % pos, 'a_tp', 'fg', 'right', conn=1, toggle=TYRES),
            text('tpu_' + pos, end + 6, ty - 28, 50, 32, '{{u:pressure}}', 'm_tiny', 'fg', 'left', conn=1, toggle=TYRES),
            text('tt_' + pos, end - 140, ty + 10, 190, 30, '{{tyreT:%s}} {{u:temp}}' % pos, 'r_label', 'dim', 'right', conn=1,
                 toggle=TYRES),
        ]
    # --- the bottom strip: clock, range, outside temperature; BMW's whole gear / drive programme area (x 1214 to
    # 1525) left uncovered, so the G80 draws no black boxes (as every P3 Clusters theme, 0.19.0) ------------------
    widgets += [
        {'id': 'strip_cover_l', 'type': 'fill', 'class': 'content', 'z': 0, 'x': 0, 'y': 660, 'w': 1214, 'h': 60,
         'color': 'bg', 'stripRow': 'l'},
        {'id': 'strip_cover_r', 'type': 'fill', 'class': 'content', 'z': 0, 'x': 1525, 'y': 660, 'w': 395, 'h': 60,
         'color': 'bg', 'stripRow': 'r'},
        text('strip_time', 120, 670, 160, 42, '{{time}}', 'v_title', 'fg', 'right', z=3, stripRow='l'),
        text('strip_ampm', 284, 678, 50, 32, '{{ampmLc}}', 'm_tiny', 'fg', 'left', z=3, stripRow='l'),
        text('strip_range', 830, 670, 140, 42, '{{range}}', 'v_title', 'fg', 'right', z=3, stripRow='l'),
        text('strip_range_u', 974, 678, 50, 32, '{{u:distLc}}', 'm_tiny', 'fg', 'left', z=3, stripRow='l'),
        text('strip_out', 1640, 670, 110, 42, '{{ambientN}}', 'v_title', 'fg', 'right', z=3, stripRow='r'),
        text('strip_out_u', 1754, 678, 50, 32, '{{u:temp}}', 'm_tiny', 'fg', 'left', z=3, stripRow='r'),
    ]
    # "Fast numbers": the speed, gear and boost drawn by the GPU (gtext, a uniform message a change) while that setting
    # is on, the usual pixel text otherwise
    out = []
    for w in widgets:
        if w.get('id') in FAST_IDS and w['type'] == 'text':
            both = lambda base, cond: cond if not base else base + '&' + cond
            g = dict(w, id=w['id'] + '_gpu', type='gtext', toggle=both(w.get('toggle'), 'fastNumbers'), conn=2)
            w = dict(w, toggle=both(w.get('toggle'), '!fastNumbers'))
            out += [w, g]
        else:
            out.append(w)
    widgets = out
    for w in widgets:
        if w.get('id') in OWN_IDS:
            w['own'] = True
            w['conn'] = 2
    # how often each text is looked at (0.21.6): the slow readings once a second, fixed labels and units every 2 s; the
    # fast ones (speed, gear, boost, hp, torque: FAST), the drive mode, the G readings and anything that can flash over a
    # warning limit (oil, coolant: the flash is 300 ms) keep the default 200 ms
    for w in widgets:
        if w['type'] != 'text' or 'rate' in w:
            continue
        txt = w['text']
        if any(k in txt for k in ('{{oil}}', '{{coolant}}', '{{boost}}', '{{mode}}', '{{gSide}}', '{{gFwd}}', '{{rpm}}')):
            continue
        tokens = [x.split('}}')[0] for x in txt.split('{{')[1:]]
        w['rate'] = 2000 if all(tk.startswith('u:') for tk in tokens) else 1000
    return {
        'schemaVersion': 2,
        'name': 'Apex',
        'theme': 'apex',
        '_about': 'A needle dash in a mid-engine supercar style, generated by tools/gen_apex.py (edit that and regenerate): '
                  'one cdash layer draws the carbon backdrop with red-glow side panels, the rev counter (0..8, lit white to '
                  'the revs, amber from 6500 and red from 7000 rpm, a red needle), the line bars and rules. Gear in the '
                  'middle, speed in the open quarter, boost and oil temperature left, a G-meter right, coolant and fuel '
                  'along the bottom. No map window. Full screen: the theme\'s own clock, range and outside temperature in '
                  'the strip, BMW\'s gear letter left uncovered.',
        'picks': PICKS,
        'widgets': widgets,
    }


if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    if len(sys.argv) > 2:
        GLOW = [float(v) for v in sys.argv[2].split(',')]
    path = root + '/apps/cluster_themes/hud/layouts/apex.json'
    with open(path, 'w') as f:
        json.dump(build(), f, indent=2)
        f.write('\n')
    print('wrote', path)
