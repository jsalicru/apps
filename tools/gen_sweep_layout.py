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
# with the map off the gauges take the room: a thicker sweep (shorter, so its slanted end clears BMW's PARK light) and wide bars
ARC_OFF = [10, 960, 2985, 120]
SPAN_OFF = [125, 1760]
BIG_C = [60, 488, 560, 25]
BIG_B = [60, 603, 560, 25]
BIG_A = [1300, 488, 560, 25]
BIG_D = [1300, 603, 560, 25]


def f_to_c(f):
    return round((f - 32) * 5 / 9, 2)


def cell(font):
    return json.load(open(os.path.join(APP, 'fonts', font + '.json')))['cellHeight']


def text(id, x, y, w, s, font, color='fg', align='left', **kw):
    """x is the left, middle or right edge by align, y the middle of the text."""
    h = cell(font)
    left = x if align == 'left' else x - w // 2 if align == 'center' else x - w
    return dict(id=id, type='text', z=5, x=round(left), y=round(y - h / 2), w=w, h=h, text=s, font=font, color=color, align=align, **kw)


def bottom(x, arc=ARC):
    dx = x - arc[1]
    return arc[0] + dx * dx / (2 * arc[2]) + arc[3]


widgets = [dict(id='dash', type='sweepdash', **{'class': 'ambient'}, z=-10, x=0, y=0, w=1920, h=720, arc=ARC, span=SPAN, max=8000, revCurves={k: round(v, 4) for k, v in REV_CURVES.items()},
                barA=BAR_A, signalA='oil', rangeA=[f_to_c(100), f_to_c(280)], barB=BAR_B, signalB='fuel', rangeB=[0, 1],
                zonesA=[dict(signal='oil', above=f_to_c(250), color='hot'), dict(signal='oil', above=f_to_c(235), color='warn'),
                        dict(signal='oil', below=f_to_c(140), color='cold')],
                zonesB=[dict(signal='range', below=round(50 * 1.609344, 2), color='low')],
                barC=BAR_C, signalC='boost', rangeC=[0, 2.0684], toggleC='showBoost',
                barD=BAR_D, signalD='coolant', rangeD=[f_to_c(100), f_to_c(260)],
                zonesD=[dict(signal='coolant', above=f_to_c(230), color='hot'), dict(signal='coolant', below=f_to_c(140), color='cold')],
                coldLimit=[f_to_c(120), f_to_c(160), 4000], yellowLines=2, waveFrom=6000,
                hex=HEX, tab=TAB, holeWhen='mapWindow',
                noMap=dict(arc=ARC_OFF, span=SPAN_OFF, barA=BIG_A, barB=BIG_B, barC=BIG_C, barD=BIG_D))]
for i in range(9):
    for name, curve in [('even', 1)] + list(REV_CURVES.items()):
        x = SPAN[0] + (SPAN[1] - SPAN[0]) * (i / 8) ** curve
        widgets.append(text('n%s_%d' % (name, i), x + 24, bottom(x + 24) + 23, 50, str(i), 't_mini', 'hot' if i == 8 else 'fg', 'center',
                            toggle='revScale=' + name, toggle2='mapWindow'))
        x = SPAN_OFF[0] + (SPAN_OFF[1] - SPAN_OFF[0]) * (i / 8) ** curve + ARC_OFF[3] * 0.45
        widgets.append(text('b%s_%d' % (name, i), x, bottom(x, ARC_OFF) + 31, 60, str(i), 't_num', 'hot' if i == 8 else 'fg', 'center',
                            toggle='revScale=' + name, toggle2='!mapWindow'))
widgets += [
    # no speed of ours with the map on: in Map view BMW's own speed shows in the map window
    text('speed_hero', 960, 505, 430, '{{speed}}', 'u_hero', align='center', toggle='!mapWindow', color2='chrome'),
    text('hero_unit', 960, 625, 140, '{{u:speedLc}}', 't_label', 'dim', 'center', toggle='!mapWindow'),
    text('gear_top', 960, 245, 240, '{{gear}}', 'u_gear', align='center', hotWhen='now', color2='chrome', toggle='!mapWindow'),
    text('ambient', 1820, 682, 100, '{{ambient}}', 't_label', align='right'),
    text('ambient_unit', 1825, 682, 40, '{{u:temp}}', 't_label', 'dim'),
    text('gear', 1880, 300, 270, '{{gear}}', 'u_gear', align='right', hotWhen='now', color2='chrome', toggle='mapWindow'),
]
for id, label, val, unit, small, big, cond in (
        ('boost', 'BOOST', '{{boost}}', '{{u:boost}}', (60, 530), (60, 460), 'showBoost'),
        ('fuel', 'FUEL', '{{range}}', '{{u:distLc}}', (60, 610), (60, 575), None),
        ('oil', 'OIL', '{{oil}}', '{{u:temp}}', (1540, 530), (1300, 460), None),
        ('water', 'WATER', '{{coolant}}', '{{u:temp}}', (1540, 610), (1300, 575), None)):
    on = lambda m: dict(toggle=cond, toggle2=m) if cond else dict(toggle=m)
    x, y = small
    widgets += [text(id + '_label', x, y, 140, label, 't_label', 'dim', **on('mapWindow')),
                text(id + '_val', x + 272 + (8 if cond is None and x > 60 else 0), y, 100, val, 't_label', align='right', **on('mapWindow')),
                text(id + '_unit', x + 277 + (8 if cond is None and x > 60 else 0), y, 48, unit, 't_label', 'dim', **on('mapWindow'))]
    x, y = big
    widgets += [text(id + '_big_label', x, y, 220, label, 't_label', 'dim', **on('!mapWindow')),
                text(id + '_big_val', x + 500, y - 3, 150, val, 'u_val', align='right', **on('!mapWindow')),
                text(id + '_big_unit', x + 506, y, 58, unit, 't_label', 'dim', **on('!mapWindow'))]
layout = dict(schemaVersion=2, name='Sweep', theme='sweep',
              _about='A digital dash with a rev sweep along the hood line and a map window. Written by tools/gen_sweep_layout.py.',
              widgets=widgets)
with open(os.path.join(APP, 'layouts', 'sweep.json'), 'w', encoding='utf8') as f:
    json.dump(layout, f, indent=2, ensure_ascii=False)
    f.write('\n')
print(len(widgets), 'widgets')
