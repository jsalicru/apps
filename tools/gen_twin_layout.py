#!/usr/bin/env python3
"""Writes apps/cluster_themes/hud/layouts/twin.json. The dial positions and scales live here, so moving a
dial moves its numerals too. Run it after changing anything below, then check the theme on the bench."""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'apps', 'cluster_themes', 'hud')
START, SWEEP = 225, 270   # degrees clockwise from 12 o'clock: 0 at lower left, the top of the scale at lower right
SPEEDO = (405, 365, 320)  # cx, cy, r: clears the hood and BMW's gear box (shared/visible.js)
TACH = (1060, 365, 320)
FUEL = (1500, 560, 110)
OIL = (1760, 530, 125)


def cell(font):
    return json.load(open(os.path.join(APP, 'fonts', font + '.json')))['cellHeight']


def text(id, cx, y, w, s, font, color='fg', align='center', **kw):
    """y is the middle of the text; cx the middle, left or right edge by align."""
    h = cell(font)
    x = cx - w // 2 if align == 'center' else cx if align == 'left' else cx - w
    return dict(id=id, type='text', z=5, x=round(x), y=round(y - h / 2), w=w, h=h, text=s, font=font, color=color, align=align, **kw)


def ring(prefix, dial, labels, font, rf, w=110, toggle=None, hot=()):
    """Numerals round a dial, evenly spread over the sweep."""
    cx, cy, r = dial
    out = []
    for i, s in enumerate(labels):
        a = math.radians(START + SWEEP * i / (len(labels) - 1))
        kw = {'toggle': toggle} if toggle else {}
        out.append(text('%s%d' % (prefix, i), cx + r * rf * math.sin(a), cy - r * rf * math.cos(a), w, s, font,
                        'hot' if i in hot else 'fg', **kw))
    return out


def dial(d, **kw):
    return dict(cx=d[0], cy=d[1], r=d[2], start=START, sweep=SWEEP, **kw)


def needle(d, signal, lo, hi, tip, tail, width, hub, **kw):
    return dict(cx=d[0], cy=d[1], len=round(d[2] * tip), tail=round(d[2] * tail), start=START, sweep=SWEEP,
                width=width, hub=hub, signal=signal, min=lo, max=hi, **kw)


widgets = [
    dict(id='face', type='twinface', **{'class': 'ambient'}, z=-10, x=0, y=0, w=1920, h=720, dials=[
        dial(SPEEDO, minor=20, major=2, metricMinor=32, metricMajor=4),
        dial(TACH, minor=40, major=5, redline=8000),
        dial(FUEL, minor=8, major=4),
        dial(OIL, minor=10, major=5),
    ]),
]
widgets += ring('mph', SPEEDO, [str(v) for v in range(0, 201, 20)], 't_num', 0.72, toggle='units=us')
widgets += ring('kmh', SPEEDO, [str(v) for v in range(0, 321, 40)], 't_num', 0.72, toggle='units=metric')
widgets += ring('rpm', TACH, [str(v) for v in range(0, 9)], 't_num', 0.72, hot=(8,))
widgets += ring('fuel', FUEL, ['0', '1/2', '1'], 't_mini', 0.60, w=70)
widgets += ring('oil', OIL, ['{{temp:50}}', '{{temp:100}}', '{{temp:150}}'], 't_mini', 0.58, w=80)
widgets += [
    text('speed_unit', SPEEDO[0], SPEEDO[1] - 92, 120, '{{u:speedLc}}', 't_label', 'dim'),
    text('speed', SPEEDO[0], SPEEDO[1] + 125, 240, '{{speed}}', 't_speed'),
    text('rpm_unit', TACH[0], TACH[1] - 92, 160, 'x1000 rpm', 't_label', 'dim'),
    text('gear', TACH[0], TACH[1] + 125, 240, '{{gear}}', 't_gear', hotWhen='now'),
    text('fuel_label', FUEL[0], FUEL[1] + 66, 90, 'FUEL', 't_label', 'dim'),
    text('oil_label', OIL[0], OIL[1] + 94, 120, 'OIL {{u:temp}}', 't_label', 'dim'),
    text('time', 1800, 215, 190, '{{time}}', 'm_val', align='right'),
    text('ampm', 1806, 222, 50, '{{ampmLc}}', 'm_unit', 'dim', align='left'),
    text('range', 1760, 295, 110, '{{range}}', 'm_val', align='right'),
    text('range_unit', 1766, 302, 50, '{{u:distLc}}', 'm_unit', 'dim', align='left'),
    text('ambient', 1520, 295, 90, '{{ambient}}', 'm_val', align='right'),
    text('ambient_unit', 1524, 302, 40, '{{u:temp}}', 'm_unit', 'dim', align='left'),
    dict(id='needles', type='twinneedle', z=10, x=85, y=45, w=1800, h=650, needles=[
        needle(SPEEDO, 'speed', 0, 200, 0.90, 0.17, 7, 34, metricMax=320),
        needle(TACH, 'rpm', 0, 8000, 0.90, 0.17, 7, 34),
        needle(FUEL, 'fuel', 0, 1, 0.84, 0.15, 4, 13),
        needle(OIL, 'oil', 50, 150, 0.84, 0.15, 4, 15),
    ]),
]
layout = dict(schemaVersion=2, name='Twin Dial', theme='twin',
              _about='Two round dials and two small gauges with orange needles. Written by tools/gen_twin_layout.py.',
              widgets=widgets)
with open(os.path.join(APP, 'layouts', 'twin.json'), 'w', encoding='utf8') as f:
    json.dump(layout, f, indent=2, ensure_ascii=False)
    f.write('\n')
print(len(widgets), 'widgets')
