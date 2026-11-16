#!/usr/bin/env python3
"""Writes apps/cluster_themes/hud/layouts/classic.json: two big round dials (speed, revs), each with a small inset dial
(fuel, oil temperature) in its lower gap, chrome bezels, gray faces and red-orange needles. The positions and scales
live here, so moving a dial moves its numerals too. Run it after changing anything below, then check it on the bench."""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'apps', 'cluster_themes', 'hud')
START, SWEEP = 230, 260          # degrees clockwise from 12 o'clock: 0 at lower left, the top of the scale at lower right
SUB_START, SUB_SWEEP = 270, 180  # the inset dials swing over the top, left to right
SPEEDO = (560, 338, 300)         # cx, cy, r: the bottom (638) stays above the seat-belt light and BMW's gear letter
TACH = (1360, 338, 300)
FUEL = (SPEEDO[0], SPEEDO[1] + 170, 86)
OIL = (TACH[0], TACH[1] + 170, 86)
GEAR_GAP = [1405, 650, 125, 70]  # BMW's gear letter: covering it brings back the black boxes (as in Sweep)


def cell(font):
    return json.load(open(os.path.join(APP, 'fonts', font + '.json')))['cellHeight']


def text(id, cx, y, w, s, font, color='fg', align='center', **kw):
    """y is the middle of the text; cx the middle, left or right edge by align."""
    h = cell(font)
    x = cx - w // 2 if align == 'center' else cx if align == 'left' else cx - w
    return dict(id=id, type='text', z=5, x=round(x), y=round(y - h / 2), w=w, h=h, text=s, font=font, color=color, align=align, **kw)


def ring(prefix, dial, labels, font, rf, start, sweep, w=110, toggle=None, hot=()):
    cx, cy, r = dial
    out = []
    for i, s in enumerate(labels):
        a = math.radians(start + sweep * i / (len(labels) - 1))
        kw = {'toggle': toggle} if toggle else {}
        out.append(text('%s%d' % (prefix, i), cx + r * rf * math.sin(a), cy - r * rf * math.cos(a), w, s, font,
                        'hot' if i in hot else 'fg', **kw))
    return out


def dial(d, start=START, sweep=SWEEP, **kw):
    return dict(cx=d[0], cy=d[1], r=d[2], start=start, sweep=sweep, **kw)


def needle(d, signal, lo, hi, tip, tail, width, hub, start=START, sweep=SWEEP, **kw):
    return dict(cx=d[0], cy=d[1], len=round(d[2] * tip), tail=round(d[2] * tail), start=start, sweep=sweep,
                width=width, hub=hub, signal=signal, min=lo, max=hi, **kw)


F = lambda f: round((f - 32) * 5 / 9, 2)
OIL_LO, OIL_HI = F(120), F(300)
WIN_W, WIN_H = 150, 58
widgets = [
    dict(id='face', type='twinface', **{'class': 'ambient'}, z=-10, x=0, y=0, w=1920, h=720, gearGap=GEAR_GAP, dials=[
        dial(SPEEDO, minor=40, major=4, mid=2, metricMinor=32, metricMajor=4),
        dial(TACH, minor=32, major=4, mid=2, redline=8000),
        dial(FUEL, SUB_START, SUB_SWEEP, minor=8, major=4, mid=2, inset=True),
        dial(OIL, SUB_START, SUB_SWEEP, minor=12, major=6, mid=2, inset=True),
    ], windows=[[SPEEDO[0] - WIN_W // 2, SPEEDO[1] - 128, WIN_W, WIN_H], [TACH[0] - WIN_W // 2, TACH[1] - 128, WIN_W, WIN_H]]),
]
widgets += ring('mph', SPEEDO, [str(v) for v in range(0, 201, 20)], 't_num', 0.67, START, SWEEP, toggle='units=us')
widgets += ring('kmh', SPEEDO, [str(v) for v in range(0, 321, 40)], 't_num', 0.67, START, SWEEP, toggle='units=metric')
widgets += ring('rpm', TACH, [str(v) for v in range(0, 9)], 't_num', 0.67, START, SWEEP)
widgets += ring('fuel', FUEL, ['0', '1/2', '1'], 't_mini', 0.50, SUB_START, SUB_SWEEP, w=60)
widgets += ring('oil', OIL, ['{{temp:%d}}' % round(OIL_LO), '{{temp:%d}}' % round(F(210)), '{{temp:%d}}' % round(OIL_HI)], 't_mini', 0.50, SUB_START, SUB_SWEEP, w=70)
widgets += [
    text('speed', SPEEDO[0], SPEEDO[1] - 99, 140, '{{speed}}', 't_read'),
    text('speed_unit', SPEEDO[0], SPEEDO[1] - 52, 120, '{{u:speedLc}}', 't_label', 'dim'),
    text('gear', TACH[0], TACH[1] - 99, 140, '{{gear}}', 't_read', hotWhen='now'),
    text('rpm_unit', TACH[0], TACH[1] - 52, 160, 'x1000 rpm', 't_label', 'dim'),
    text('fuel_label', FUEL[0], FUEL[1] + 34, 90, 'FUEL', 't_label', 'dim'),
    text('oil_label', OIL[0], OIL[1] + 34, 120, 'OIL {{u:temp}}', 't_label', 'dim'),
    # left: boost; right: the clock, range and outside temperature (the hood hides the top corners)
    text('boost_label', 60, 400, 140, 'BOOST', 't_label', 'dim', align='left'),
    text('boost', 200, 452, 140, '{{boost}}', 'm_val', align='right'),
    text('boost_unit', 206, 460, 60, '{{u:boost}}', 'm_unit', 'dim', align='left'),
    text('time', 1810, 330, 190, '{{time}}', 'm_val', align='right'),
    text('ampm', 1816, 338, 50, '{{ampmLc}}', 'm_unit', 'dim', align='left'),
    text('range', 1810, 420, 130, '{{range}}', 'm_val', align='right'),
    text('range_unit', 1816, 428, 60, '{{u:distLc}}', 'm_unit', 'dim', align='left'),
    text('ambient', 1810, 510, 110, '{{ambient}}', 'm_val', align='right'),
    text('ambient_unit', 1816, 518, 50, '{{u:temp}}', 'm_unit', 'dim', align='left'),
    dict(id='needles', type='twinneedle', z=10, x=200, y=20, w=1520, h=640, needles=[
        needle(SPEEDO, 'speed', 0, 200, 0.86, 0.20, 6, 30, metricMax=320),
        needle(TACH, 'rpm', 0, 8000, 0.86, 0.20, 6, 30),
        needle(FUEL, 'fuel', 0, 1, 0.80, 0.18, 3, 10, SUB_START, SUB_SWEEP),
        needle(OIL, 'oil', OIL_LO, OIL_HI, 0.80, 0.18, 3, 10, SUB_START, SUB_SWEEP),
    ]),
]
layout = dict(schemaVersion=2, name='Classic', theme='classic',
              _about='Two big round dials with inset fuel and oil dials. Written by tools/gen_classic_layout.py.',
              widgets=widgets)
with open(os.path.join(APP, 'layouts', 'classic.json'), 'w', encoding='utf8') as f:
    json.dump(layout, f, indent=2, ensure_ascii=False)
    f.write('\n')
print(len(widgets), 'widgets')
