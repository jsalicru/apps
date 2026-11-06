#!/usr/bin/env python3
"""Writes apps/cluster_themes/hud/layouts/sweep.json. Run it after changing anything below, then check the theme
on the bench. The map window is where BMW's map sits on an X3 (as in gt3.json and sport.json)."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'apps', 'cluster_themes', 'hud')
ARC = [10, 960, 2985, 58]      # y of the top at the middle, centre x, curve radius, band height: clears the hood (shared/visible.js)
SPAN = [125, 1795]             # x at 0 rpm, x at 8000
MAP = [416, 120, 1088, 480]
BAR_A = [60, 473, 320, 13]   # oil
BAR_C = [60, 553, 320, 13]   # boost
BAR_B = [60, 633, 320, 13]   # fuel


def cell(font):
    return json.load(open(os.path.join(APP, 'fonts', font + '.json')))['cellHeight']


def text(id, x, y, w, s, font, color='fg', align='left', **kw):
    """x is the left, middle or right edge by align, y the middle of the text."""
    h = cell(font)
    left = x if align == 'left' else x - w // 2 if align == 'center' else x - w
    return dict(id=id, type='text', z=5, x=round(left), y=round(y - h / 2), w=w, h=h, text=s, font=font, color=color, align=align, **kw)


def bottom(x):
    dx = x - ARC[1]
    return ARC[0] + dx * dx / (2 * ARC[2]) + ARC[3]


widgets = [dict(id='dash', type='sweepdash', **{'class': 'ambient'}, z=-10, x=0, y=0, w=1920, h=720, arc=ARC, span=SPAN, max=8000,
                barA=BAR_A, signalA='oil', rangeA=[50, 150], barB=BAR_B, signalB='fuel', rangeB=[0, 1],
                barC=BAR_C, signalC='boost', rangeC=[0, 2.0684], toggleC='showBoost',
                hole=MAP, holeWhen='mapWindow', holeInset=6, holeRadius=28)]
for i in range(9):
    x = SPAN[0] + (SPAN[1] - SPAN[0]) * i / 8
    widgets.append(text('n%d' % i, x + 24, bottom(x + 24) + 23, 50, str(i), 't_mini', 'hot' if i == 8 else 'fg', 'center'))
widgets += [
    text('speed', 385, 318, 330, '{{speed}}', 'u_speed', align='right', toggle='mapWindow', color2='chrome'),
    text('speed_unit', 385, 400, 120, '{{u:speedLc}}', 't_label', 'dim', 'right', toggle='mapWindow'),
    text('speed_hero', 960, 345, 620, '{{speed}}', 'u_hero', align='center', toggle='!mapWindow', color2='chrome'),
    text('hero_unit', 960, 510, 140, '{{u:speedLc}}', 't_label', 'dim', 'center', toggle='!mapWindow'),
    text('oil_label', 60, 450, 160, 'OIL', 't_label', 'dim'),
    text('oil_val', 340, 450, 100, '{{oil}}', 't_label', align='right'),
    text('oil_unit', 345, 450, 40, '{{u:temp}}', 't_label', 'dim'),
    text('boost_label', 60, 530, 140, 'BOOST', 't_label', 'dim', toggle='showBoost'),
    text('boost_val', 332, 530, 100, '{{boost}}', 't_label', align='right', toggle='showBoost'),
    text('boost_unit', 337, 530, 48, '{{u:boost}}', 't_label', 'dim', toggle='showBoost'),
    text('fuel_label', 60, 610, 160, 'FUEL', 't_label', 'dim'),
    text('gear', 1880, 300, 270, '{{gear}}', 'u_gear', align='right', hotWhen='now', color2='chrome'),
    text('time', 1800, 455, 190, '{{time}}', 'm_val', align='right'),
    text('ampm', 1806, 462, 50, '{{ampmLc}}', 'm_unit', 'dim'),
    text('range', 1800, 535, 150, '{{range}}', 'm_val', align='right'),
    text('range_unit', 1806, 542, 50, '{{u:distLc}}', 'm_unit', 'dim'),
    text('ambient', 1800, 615, 150, '{{ambient}}', 'm_val', align='right'),
    text('ambient_unit', 1806, 622, 40, '{{u:temp}}', 'm_unit', 'dim'),
]
layout = dict(schemaVersion=2, name='Sweep', theme='sweep',
              _about='A digital dash with a rev sweep along the hood line and a map window. Written by tools/gen_sweep_layout.py.',
              widgets=widgets)
with open(os.path.join(APP, 'layouts', 'sweep.json'), 'w', encoding='utf8') as f:
    json.dump(layout, f, indent=2, ensure_ascii=False)
    f.write('\n')
print(len(widgets), 'widgets')
