#!/usr/bin/env python3
"""Bake the HUD's bitmap font atlases from the TTFs in tools/fonts-src/ (Barlow, Michroma, Orbitron, DSEG7, Outfit).

    UV_CACHE_DIR=... uv run --no-project --with pillow python tools/bake_fonts.py [app_id ...]

Runs on the Mac only (needs Pillow). The car never rasterizes fonts: it blits
these pre-drawn glyphs (shared/hud_text.js). Each app has its own set (FONTS below); output per
font, in apps/<app_id>/hud/fonts/<name>.json: the metrics plus the atlas as
one alpha byte per pixel (coverage), base64 in "alpha". JSON because the kit's
build packs the app's data folders into hud.pack, which holds JSON only, and
because then the car needs no PNG decoder. Barlow is SIL OFL 1.1; the licence
ships in each app's NOTICE.

Metrics: every glyph cell is the same height, from the highest ink to the lowest
ink across the font's glyph set, so a widget's y is the top of its tallest
character. `ox` shifts a cell from the pen position (ink overhang), `advance`
moves the pen. Digits get one shared advance (tabular), so a changing number
doesn't shift sideways.
"""
import base64, json, os
from PIL import Image, ImageChops, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'fonts-src')
APPS = os.path.join(HERE, '..', 'apps')

UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
DIGITS = '0123456789'
LOWER = 'abcdefghijklmnopqrstuvwxyz'
# HUD Widgets, fitted to the part of the 800x480 HUD the driver can see (485x278 from the Nov 5 2026 grid
# photo; 560x280 since Nov 9, the sizes stayed): hero 140 -> 96, big 42 -> 34, mid 30 -> 24; label and small stay, BMW's own "mph" is that size.
HUD_FONTS = [
    # name, file, px size, characters
    ('hero', 'BarlowSemiCondensed-SemiBold.ttf', 96, DIGITS + 'PRND-'),
    ('big', 'BarlowSemiCondensed-Medium.ttf', 34, DIGITS + ':.-° PRNDSM'),
    ('mid', 'BarlowSemiCondensed-Medium.ttf', 24, DIGITS + ':.-° ' + UPPER),
    ('label', 'Barlow-Medium.ttf', 15, UPPER + DIGITS + '/.:-°%>· '),
    ('small', 'Barlow-Medium.ttf', 13, UPPER + DIGITS + '/.:-°%>· '),
    # Retro: seven-segment digits (DSEG7 Classic, SIL OFL; the unlit 8s behind are the same font in "track")
    ('d7_hero', 'DSEG7Classic-Bold.ttf', 76, DIGITS + 'PRN-', 0, None, {'R': 'r', 'N': 'n'}),   # r and n: seven segments can't draw R or N
    ('d7_mid', 'DSEG7Classic-Bold.ttf', 26, DIGITS + '-.:'),
    # Vector: now playing (any printable ASCII: a song's text is folded to it, hud.js mediaText)
    ('np_title', 'BarlowSemiCondensed-SemiBold.ttf', 22, ''.join(chr(i) for i in range(32, 127))),
    ('np_small', 'Barlow-Medium.ttf', 16, ''.join(chr(i) for i in range(32, 127))),
]
# Cluster Themes, 1920x720 LCD. GT3: the race-dash look, Barlow Condensed.
CLUSTER_FONTS = [
    ('gear', 'BarlowCondensed-Bold.ttf', 330, DIGITS + 'PRND-'),
    ('big', 'BarlowCondensed-Bold.ttf', 124, DIGITS + '.:-'),   # 124: "20.3 PSI" fits a 280 px box beside the hood; ':' for a clock in a readout slot
    ('small', 'BarlowCondensed-Bold.ttf', 50, DIGITS + '.:-° '),
    ('unit', 'BarlowCondensed-SemiBold.ttf', 34, UPPER + DIGITS + '/°%>·.: -'),
    ('head', 'BarlowCondensed-SemiBold.ttf', 24, UPPER + DIGITS + '/°%>·.: -'),
    ('scale', 'BarlowCondensed-SemiBold.ttf', 30, DIGITS),
    ('badge', 'BarlowCondensed-SemiBold.ttf', 30, UPPER + LOWER + DIGITS + ' -'),   # the model badge (shared/badges.js)
    # M: the wide squared numbers (Michroma, SIL OFL) and Barlow for the small print
    ('m_unit', 'Barlow-Medium.ttf', 30, LOWER + UPPER + '°/-.'),
    ('m_tiny', 'Barlow-Medium.ttf', 26, LOWER + DIGITS + 'CF./ -°'),
    # Sport: BMW Live Cockpit style, the wide numbers in Michroma like BMW's own
    # Apex: a light, upright condensed face for the needle dash
    ('a_gear', 'Outfit[wght].ttf', 200, DIGITS + 'PRNDSM-', 0, 'Bold', None, '', 0.2, 6),   # hollow italic (Nov 21 2026)
    ('a_gear_s', 'Outfit[wght].ttf', 200, DIGITS + 'PRNDSM-', 0, 'Bold', None, '', 0.2),   # the same, solid (the Gear setting)
    ('a_gear_m', 'Outfit[wght].ttf', 77, DIGITS + 'PRNDSM-', 0, 'Bold', None, '', 0.2, 4),   # the gear under the Waze map, hollow
    ('a_gear_ms', 'Outfit[wght].ttf', 77, DIGITS + 'PRNDSM-', 0, 'Bold', None, '', 0.2),   # the same, solid
    ('a_speed', 'Outfit[wght].ttf', 98, DIGITS + '-', 0, 'ExtraBold', None, '', 0.2),   # bold italic
    ('a_unit', 'Outfit[wght].ttf', 34, LOWER + '/', 0, 'Bold', None, '', 0.2),   # the speed's unit (mph, km/h)
    ('a_tach', 'Outfit[wght].ttf', 58, DIGITS, 0, 'ExtraBold', None, '', 0.2),   # the rev counter's numbers, as the speed
    ('a_speed_m', 'Outfit[wght].ttf', 70, DIGITS, 0, 'ExtraBold', None, '', 0.2),   # the speed in map view, 20 % bigger
    # the smaller tach for cars with the driver camera ("Leave room for the driver camera"), 0.81 of the above
    ('a_gear_c', 'Outfit[wght].ttf', 162, DIGITS + 'PRNDSM-', 0, 'Bold', None, '', 0.2, 5),
    ('a_gear_s_c', 'Outfit[wght].ttf', 162, DIGITS + 'PRNDSM-', 0, 'Bold', None, '', 0.2),
    ('a_speed_c', 'Outfit[wght].ttf', 79, DIGITS + '-', 0, 'ExtraBold', None, '', 0.2),
    ('a_unit_c', 'Outfit[wght].ttf', 28, LOWER + '/', 0, 'Bold', None, '', 0.2),
    ('a_tach_c', 'Outfit[wght].ttf', 47, DIGITS, 0, 'ExtraBold', None, '', 0.2),
    ('a_head', 'Outfit[wght].ttf', 40, UPPER + LOWER + ' ', 0, 'Bold', None, '', 0.2),   # the panel headings, as the speed
    ('a_tp', 'BarlowSemiCondensed-Medium.ttf', 48, DIGITS + '.-', 0),   # the readouts' numbers (tyres, boost, oil, hp, torque); no extra stroke since 0.21.5
    ('a_lim', 'BarlowSemiCondensed-SemiBold.ttf', 30, DIGITS + '.-', 0),   # the bars' end numbers, 25 % over r_label
    ('a_sm', 'Outfit[wght].ttf', 26, DIGITS + '.-', 0, 'SemiBold', None, '', 0.2),   # the hatched gauges' scale numbers, italic
    # Vector: the music panel's song title and artist (any printable ASCII: a song's text is folded to it, hud.js
    # mediaText), the ring gauges' numbers and labels, the track time
    ('v_title', 'BarlowSemiCondensed-SemiBold.ttf', 38, ''.join(chr(i) for i in range(32, 127))),
    ('v_label', 'BarlowSemiCondensed-SemiBold.ttf', 19, UPPER + LOWER + DIGITS + ' °%/.-'),
    # Minimal: one huge speed, the gear, small print
    # Cruise and Minimal labels (r_label: the Roadster theme's, kept when Roadster was removed in 0.17.8)
    ('r_label', 'BarlowSemiCondensed-SemiBold.ttf', 24, UPPER + LOWER + DIGITS + '/°%.: -'),
    # Drag: the 0-60 clock
    # Rally: the huge gear and the readouts in the arc
    # Retro 80s: seven-segment digits (DSEG7 Classic, SIL OFL; the unlit 8s behind are the same font in "track")
    # Cruise: calm, light numbers
    # Ribbon: Outfit (SIL OFL), thin and calm: the huge speed, the side readouts, small spaced labels
    ('b_unit', 'Outfit[wght].ttf', 26, UPPER + LOWER + '/', 0, 'Medium'),
    ('b_gear', 'Outfit[wght].ttf', 32, DIGITS + 'PRNDSM-', 0, 'SemiBold'),
    ('b_scale', 'Outfit[wght].ttf', 20, DIGITS, 0, 'Medium'),
    # Sweep: the big digital speed and gear
    ('u_hero', 'BarlowSemiCondensed-Medium.ttf', 270, DIGITS + '-'),
    ('u_speed', 'BarlowSemiCondensed-Medium.ttf', 150, DIGITS + '-'),
    ('u_gear', 'BarlowSemiCondensed-Medium.ttf', 112, DIGITS + 'PRND-'),
    ('u_gearbig', 'BarlowSemiCondensed-Medium.ttf', 270, 'PRND' + DIGITS + '-'),
    ('u_gearsm', 'BarlowSemiCondensed-Medium.ttf', 84, 'PRND' + DIGITS + '-'),
    ('u_val', 'BarlowSemiCondensed-Medium.ttf', 42, DIGITS + '.:+-'),
    ('u_bold', 'BarlowCondensed-Bold.ttf', 32, DIGITS + LOWER + UPPER + '-/. '),
    # Sweep's own wide set (Nov 16 2026): Michroma, given weight with a stroke for a bold extended look
    ('e_hero', 'Michroma-Regular.ttf', 190, DIGITS + '-', 7),
    ('e_speed', 'Michroma-Regular.ttf', 110, DIGITS + '-', 4),
    ('e_gear', 'Michroma-Regular.ttf', 80, DIGITS + 'PRND-', 3),
    ('e_gearbig', 'Michroma-Regular.ttf', 190, 'PRND' + DIGITS + '-', 7),
    ('e_gearsm', 'Michroma-Regular.ttf', 62, 'PRND' + DIGITS + '-', 2),
    ('e_val', 'Michroma-Regular.ttf', 30, DIGITS + '.:+-', 1),
    ('e_num', 'Michroma-Regular.ttf', 32, DIGITS, 1),
    ('e_label', 'Michroma-Regular.ttf', 20, UPPER + LOWER + DIGITS + '° /.-+', 1),
    ('e_mini', 'Michroma-Regular.ttf', 21, DIGITS + '/', 1),
    ('e_bold', 'Michroma-Regular.ttf', 20, DIGITS + LOWER + UPPER + '-/. ', 2),
    # Twin Dial: the dial numbers and the readouts in the dials
    ('t_num', 'BarlowSemiCondensed-SemiBold.ttf', 46, DIGITS),
    ('t_read', 'BarlowSemiCondensed-SemiBold.ttf', 50, DIGITS + 'PRND-'),
    ('t_mini', 'BarlowSemiCondensed-SemiBold.ttf', 30, DIGITS + '/'),
    ('t_label', 'BarlowSemiCondensed-Medium.ttf', 28, UPPER + LOWER + DIGITS + '° /.-+'),
]
FONTS = {'idrive_hud_widgets': HUD_FONTS, 'cluster_themes': CLUSTER_FONTS}
PAD = 2
ATLAS_W = 1024


def bake(out, name, file, size, chars, stroke=0, weight=None, subs=None, tuck='', slant=0.0, outline=0):
    """stroke: px of extra weight round every glyph (Michroma has one weight). weight: a named instance of a
    variable font (Orbitron: Regular .. Black), for the M theme's squared BMW-style gear, speed and numbers.
    subs: {char: glyph drawn for it} (Orbitron's zero is slashed; the M8's is plain, so its O stands in).
    tuck: characters added to a font after layouts were built on its cell height (° on value / y_val, Nov 7 2026):
    they don't count towards the cell, and one that rises above it is drawn lower so its top meets the cell's.
    slant: an italic made by shearing (x shift per px above the baseline, 0.2 = about 11 degrees; the fonts have no italics).
    outline: px; the glyph drawn hollow, only a ring that wide round its outline (Apex's gear)."""
    font = ImageFont.truetype(os.path.join(SRC, file), size)
    if weight: font.set_variation_by_name(weight)
    subs = subs or {}
    glyph = lambda c: subs.get(c, c)
    ink = [c for c in chars if c != ' ']
    stroke = stroke + outline
    boxes = {c: font.getbbox(glyph(c), anchor='ls', stroke_width=stroke) for c in ink}
    top = min(b[1] for c, b in boxes.items() if c not in tuck)
    bottom = max(b[3] for c, b in boxes.items() if c not in tuck)
    drop = {c: max(0, top - boxes[c][1]) for c in tuck if c in boxes}
    height = bottom - top + 2 * PAD
    tab = (max(font.getlength(glyph(d)) for d in DIGITS if d in chars) + 2 * stroke) if any(d in chars for d in DIGITS) else 0

    cells = []
    for c in chars:
        adv = font.getlength(glyph(c)) + (2 * stroke if c != ' ' else 0)
        if c == ' ':
            cells.append((c, None, 0, round(adv if adv else size * 0.25)))
            continue
        l, _, r, _ = boxes[c]
        lean = int(round(slant * (PAD - top))) if slant else 0      # the sheared top's extra width
        w = r - l + 2 * PAD + lean
        img = Image.new('L', (w, height), 0)
        at = (PAD - l, PAD - top + drop.get(c, 0))
        ImageDraw.Draw(img).text(at, glyph(c), font=font, fill=255, anchor='ls', stroke_width=stroke, stroke_fill=255)
        if outline:
            inner = Image.new('L', (w, height), 0)
            ImageDraw.Draw(inner).text(at, glyph(c), font=font, fill=255, anchor='ls', stroke_width=stroke - outline, stroke_fill=255)
            img = ImageChops.subtract(img, inner)
        if slant:
            base = PAD - top
            img = img.transform(img.size, Image.AFFINE, (1, slant, -slant * base, 0, 1, 0), resample=Image.BICUBIC)
        shift = (tab - adv) / 2 if c in DIGITS else 0
        cells.append((c, img, round(l - PAD + shift), round(tab if c in DIGITS else adv)))

    # simple row packing
    x = y = 0
    placed = {}
    for c, img, ox, adv in cells:
        if img is None:
            continue
        if x + img.width > ATLAS_W:
            x, y = 0, y + height
        placed[c] = (x, y)
        x += img.width
    atlas_h = y + height
    atlas = Image.new('L', (ATLAS_W, atlas_h), 0)
    glyphs = {}
    for c, img, ox, adv in cells:
        if img is None:
            glyphs[c] = {'x': 0, 'y': 0, 'w': 0, 'h': 0, 'ox': 0, 'advance': adv}
            continue
        gx, gy = placed[c]
        atlas.paste(img, (gx, gy))
        glyphs[c] = {'x': gx, 'y': gy, 'w': img.width, 'h': img.height, 'ox': ox, 'advance': adv}
    meta = {'source': file, 'size': size, 'cellHeight': height, 'baseline': PAD - top, 'glyphs': glyphs,
            'width': ATLAS_W, 'height': atlas_h, 'alpha': base64.b64encode(atlas.tobytes()).decode('ascii')}
    with open(os.path.join(out, name + '.json'), 'w') as f:
        json.dump(meta, f, separators=(',', ':'), ensure_ascii=False)
    print('%-6s %3dpx  cell height %3d  atlas %dx%d  %d glyphs' % (name, size, height, ATLAS_W, atlas_h, len(glyphs)))


if __name__ == '__main__':
    import sys
    for app in sys.argv[1:] or sorted(FONTS):
        out = os.path.join(APPS, app, 'hud', 'fonts')
        os.makedirs(out, exist_ok=True)
        print(app)
        for spec in FONTS[app]:
            bake(out, *spec)
