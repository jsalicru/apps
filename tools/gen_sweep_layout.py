#!/usr/bin/env python3
"""Writes apps/cluster_themes/hud/layouts/sweep.json. Run it after changing anything below, then check the theme
on the bench. Fitted to a 2022 M3 from car photos (Nov 2026): BMW draws two black boxes over this theme, at about
x 811-1053, y 297-390 and x 1232-1320, y 330-400. The map window follows the black six-sided area in the middle of
BMW's own M layout, inset a little so its grey side panels and red marks stay covered."""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'apps', 'cluster_themes', 'hud')
ARC = [10, 960, 2985, 74]      # y of the top at the middle, centre x, curve radius, band height: clears the hood (shared/visible.js)
SPAN = [125, 1795]             # x at 0 rpm, x at 8000
HEX = [963, 141, 341, 580, 302, 438, 357]   # centre x, y top, widest, bottom; half widths at top, widest, bottom
TAB = [565, 312, 470, 385, 270, 94]   # right x, y, left x for one digit, for two, for three, height: BMW's speed, right-aligned at about x 630, stops above its line
# the race scales: the band's middle is at this rpm, and each thousand gets wider towards the top
REV_CURVES = {name: math.log(0.5) / math.log(rpm / 8000) for name, rpm in (('race', 5000), ('race55', 5500))}
BAR_C = [60, 553, 320, 13]     # boost, left
BAR_B = [60, 633, 320, 13]     # fuel, left
BAR_A = [1540, 553, 320, 13]   # oil, right
BAR_D = [1540, 633, 320, 13]   # water, right


def f_to_c(f):
    return round((f - 32) * 5 / 9, 2)


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


widgets = [dict(id='dash', type='sweepdash', **{'class': 'ambient'}, z=-10, x=0, y=0, w=1920, h=720, arc=ARC, span=SPAN, max=8000, revCurves={k: round(v, 4) for k, v in REV_CURVES.items()},
                barA=BAR_A, signalA='oil', rangeA=[0, 150], barB=BAR_B, signalB='fuel', rangeB=[0, 1],
                zonesA=[dict(signal='oil', above=f_to_c(250), color='hot'), dict(signal='oil', above=f_to_c(235), color='warn'),
                        dict(signal='oil', below=f_to_c(140), color='cold')],
                zonesB=[dict(signal='range', below=round(50 * 1.609344, 2), color='low')],
                barC=BAR_C, signalC='boost', rangeC=[0, 2.0684], toggleC='showBoost',
                barD=BAR_D, signalD='coolant', rangeD=[0, 150],
                zonesD=[dict(signal='coolant', above=f_to_c(230), color='hot'), dict(signal='coolant', below=f_to_c(140), color='cold')],
                hex=HEX, tab=TAB, holeWhen='mapWindow')]
for i in range(9):
    for name, curve in [('even', 1)] + list(REV_CURVES.items()):
        x = SPAN[0] + (SPAN[1] - SPAN[0]) * (i / 8) ** curve
        widgets.append(text('n%s_%d' % (name, i), x + 24, bottom(x + 24) + 23, 50, str(i), 't_mini', 'hot' if i == 8 else 'fg', 'center',
                            toggle='revScale=' + name))
widgets += [
    # no speed of ours with the map on: in Map view BMW's own speed shows in the map window
    text('speed_hero', 960, 505, 620, '{{speed}}', 'u_hero', align='center', toggle='!mapWindow', color2='chrome'),
    text('hero_unit', 960, 625, 140, '{{u:speedLc}}', 't_label', 'dim', 'center', toggle='!mapWindow'),
    text('gear_top', 960, 205, 240, '{{gear}}', 'u_gear', align='center', hotWhen='now', color2='chrome', toggle='!mapWindow'),
    text('boost_label', 60, 530, 140, 'BOOST', 't_label', 'dim', toggle='showBoost'),
    text('boost_val', 332, 530, 100, '{{boost}}', 't_label', align='right', toggle='showBoost'),
    text('boost_unit', 337, 530, 48, '{{u:boost}}', 't_label', 'dim', toggle='showBoost'),
    text('fuel_label', 60, 610, 140, 'FUEL', 't_label', 'dim'),
    text('range_val', 332, 610, 100, '{{range}}', 't_label', align='right'),
    text('range_unit', 337, 610, 48, '{{u:distLc}}', 't_label', 'dim'),
    text('oil_label', 1540, 530, 140, 'OIL', 't_label', 'dim'),
    text('oil_val', 1820, 530, 100, '{{oil}}', 't_label', align='right'),
    text('oil_unit', 1825, 530, 40, '{{u:temp}}', 't_label', 'dim'),
    text('water_label', 1540, 610, 140, 'WATER', 't_label', 'dim'),
    text('water_val', 1820, 610, 100, '{{coolant}}', 't_label', align='right'),
    text('water_unit', 1825, 610, 40, '{{u:temp}}', 't_label', 'dim'),
    text('ambient_label', 1540, 450, 140, 'OUTSIDE', 't_label', 'dim'),
    text('ambient', 1820, 450, 100, '{{ambient}}', 't_label', align='right'),
    text('ambient_unit', 1825, 450, 40, '{{u:temp}}', 't_label', 'dim'),
    text('gear', 1880, 300, 270, '{{gear}}', 'u_gear', align='right', hotWhen='now', color2='chrome', toggle='mapWindow'),
]
layout = dict(schemaVersion=2, name='Sweep', theme='sweep',
              _about='A digital dash with a rev sweep along the hood line and a map window. Written by tools/gen_sweep_layout.py.',
              widgets=widgets)
with open(os.path.join(APP, 'layouts', 'sweep.json'), 'w', encoding='utf8') as f:
    json.dump(layout, f, indent=2, ensure_ascii=False)
    f.write('\n')
print(len(widgets), 'widgets')
