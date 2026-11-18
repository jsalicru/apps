# E36 cluster theme — design

Date: 2026-11-16. App: `apps/cluster_themes`. Theme id `e36`, shown as **E36**, page tag `'328i · 90s'`.

## Intent

A pure, as-it-was recreation of the BMW E36 328i instrument cluster (1990s) on the 1920x720 cluster. The owner's
words: "max pure e36 mode, just as it was" and "pure e36 as much as possible". Success = someone who knew the car
recognises it at a glance, day and night, and the needles move like the real ones. Where the car's data or the
app's rules force a departure, keep it inside an element the E36 really had.

## Goals

- Trace the E36 328i cluster from the reference photos at **true proportions** and draw it full screen: fuel gauge,
  speedometer, tachometer with the economy gauge inset, coolant gauge, the grey face and black bezel, turn arrows,
  top-centre lamp window, trip-reset knob, ASC square, light sensor, the three warning-lamp strips, and the LCD
  window under the speedo.
- Live needles: speed, rpm, fuel, coolant, economy (estimated).
- **Day look:** white markings and numbers on black dial faces, cream needles, dark-grey hubs, grey face.
- **Night look:** after sunset the markings, numbers, needles and LCD glow orange-red (the night photos), not the
  usual 60 % dim.
- **Two faces by the Units setting:** metric → the **EU** face, mph → the **US** face (the default, since `units`
  defaults to `us`).

## Non-goals

- No shift lights, rev bar, readout slots, Waze map window, model badge, G-meter or drive mode in this theme.
- No E36 M3 variant (280 km/h / 8000 rpm / oil temp). The M3 photo is a night-lighting reference only.
- No JPN km/l face. The JPN photo is a detail reference only (lamp-strip symbols, knob, close-ups).
- No HUD Widgets counterpart.

## Anti-goals (would count as failure even if it works)

- Anything that reads as "modern theme with E36 colours": modern fonts or layouts, flat tiles, extra readouts, made-up
  windows.
- Invented scale markings. Every number and tick comes from a photo.
- Lamps lighting for no reason. The app can't read them, so they stay dark, as on a healthy car.
- BMW's black gear box appearing because the theme covers BMW's gear letter.

## References

Kept out of the repo (some are third-party, with watermarks) in `../design/photos/e36/`, next to the repo like the
other design photos:

- `eu-kmh-day-face.png`: **tracing source for the metric face**, face-on EU (EG) 328i.
- `us-mph-day-face.png`: **tracing source for the mph face**, face-on US 328i, LCD lit.
- `328i-face-kmh-jpn.png`, `fuel-speedo-closeup.png`, `tach-econ-closeup.png`: detail references, mainly the
  lamp-strip symbols, the ASC square, the knob, the hubs and the needle shape.
- `lcd-odometer.png`: the LCD digits close up (red-orange seven-segment `149494 km   000.0`).
- `us-mph-night-bench.png`, `us-mph-night-driving.png`, `m3-night-reference.png`: night lighting colour.

## The two faces (left to right)

**EU (metric), from `eu-kmh-day-face.png`:**

1. **Fuel gauge:** `0 ½ 1/1`, red reserve block just past 0, pump icon; the needle pivots below the centre.
2. **Speedometer:** `20 … 240` km/h every 20 (long ticks every 20, short every 10), `km/h` with `EG` under it above
   the hub. The LCD window sits in the dial's lower cut-off.
3. **Tachometer:** `0 … 7` x1000, `1/min x1000`, red from about 6 (stepped bars) to solid red to 7. The economy
   gauge is in the flat-topped cut-out at the bottom: `0 10 20 30` **L/100km**, left to right, with minor ticks.
   The small dark square between the speedo and the tach at the bottom is the ASC lamp.
4. **Coolant gauge:** blue block, thermometer icon, red block.

**US (mph), from `us-mph-day-face.png`:**

1. **Fuel gauge:** `0 ½ 1/1`, orange-red reserve block, pump icon, `UNLEADED GASOLINE` above the hub and `ONLY` below.
2. **Speedometer:** MPH `20 … 140` outer every 20 (ticks every 5), small inner km/h ring `20 … 240`, `km/h` small
   above the hub, `MPH` and `EG` below it.
3. **Tachometer:** as EU (trace its own red zone). Economy: `40 25 20 15 10 8` **MPG** left to right, with the white
   wedge blocks at the left end and `MPG` above.
4. **Coolant gauge:** as EU.

**Both:** green turn arrows above the fuel/speedo and tach/coolant gaps, the dark top-centre lamp window (high beam),
the trip-reset knob at the speedo's lower left, the light sensor right of the tach, and three dark lamp strips along
the bottom.

## Constraints

- **BMW's gear letter** shows through a see-through gap at **x 1380–1460, y 660–720**, as in every theme
  (`vector.json` `strip_cover_l` / `strip_cover_r`). Covering it brings BMW's black box back (issue #5; CHANGELOG
  0.17.6–0.18.1). The old x 1406–1597 box is no longer drawn (`shared/visible.js`).
- **Hood:** hides the top corners (`shared/visible.js` `HOOD`; `layouts.js` warns). **Seat-belt light** at x 587–626,
  y 663–700.
- **Layers:** 8 per connection; effect widgets first, text after. **Pixel memory:** 16 MiB shared with HUD Widgets.
- **No data** for the odometer (unless the car publishes it, see below), fuel flow, service interval, turn
  signals, high beam or any warning lamp.
- **App-wide rule:** every theme shows the clock, range and outside temperature. The drive-mode rule is dropped for
  E36 (pure, owner's call).
- Night colours today only dim whites and greys to 60 % (`NIGHT_DIM`, `_nightDim()` in `shared/hud.js`).

## Approaches

- **A. One `e36dash` shader for the whole cluster, numbers as text on top (picked).** The shader draws the face,
  bezels, dial faces, ticks, coloured zones, economy cut-out, turn arrows, lamp strips, LCD window, hubs and all
  five needles. Needles move by uniforms only, with no pixel uploads, and night is a colour switch. It matches Sport
  (`sdash`), M (`mdash`), M view (`mview`) and Vector (`vdash`). A generator holds the traced geometry.
- **B. Traced faces as images plus a needle shader.** Rejected: a full-screen image takes about 10 MB of the 16 MiB
  shared pixel memory, day and night need two copies, a rebuild re-sends it, and it needs a new image widget.
- **C. Hand-written JSON, no generator.** Rejected: hundreds of tick and label positions by hand, hard to adjust.
- *Dropped along the way:* widening the tach-to-coolant gap for a gear window. That was based on the outdated
  gear-box note in `docs/DEVELOPING.md` and is no longer needed.

## Design (decided)

- **Geometry:** one uniform scale from each face photo, true proportions. **As big as the screen allows** (owner's
  call, Nov 16): the fuel and coolant dials reach the screen's left and right edges, so the bezel and hood outline go
  off-screen and the grey face fills behind; the **lamp strips' top sits at the strip row (y 660)**, cut by the screen's
  bottom edge. **BMW's gear letter shows through the right lamp strip** at x 1380–1460, as one more lamp cell. The shader
  leaves that rect see-through and covers everything else of the bottom row.
- **New effect widget `e36dash`** (`shared/shaders.js` `E36DASH`, wired in `shared/hud.js` like `vdash`: header doc,
  create and uniforms, the 20 Hz tick; required keys in `shared/layouts.js`). Uniforms: speed, rpm, fuel 0..1,
  coolant °C, economy (needle 0..1) and a night flag. All geometry comes from layout keys written by the generator:
  dial centres and radii, needle pivots, start and sweep angles, tick lists, zone arcs, face outline, windows, strips
  and the gear gap.
- **Text widgets** on top for the dial numbers and printed labels, in Barlow (the cut that best matches the photo's
  DIN-like figures). New sizes go in `CLUSTER_FONTS` in `tools/bake_fonts.py` with an `e_` prefix. The face's text
  is separate per face, shown with `toggle: "units=us"` / `"units=metric"`.
- **Generator `tools/gen_e36.py`** (in the repo, since the `../design/` generators aren't on this machine) writes
  `apps/cluster_themes/hud/layouts/e36.json` with both faces. Edit the generator, not the JSON.
- **Palette `e36`** in `shared/hud_themes.js`: day roles (face grey, dial black, marking white, needle cream, hub dark
  grey, red zone, blue block, orange reserve, green arrow, LCD orange-red, LCD green/yellow/red for the US service
  LEDs, lamp-strip dark) plus **night roles** that replace them after sunset. Small engine change: when the layout's
  theme defines night roles, `nightDim` Auto uses them instead of the 60 % dim. Other themes are unchanged.
- **LCD (under the speedo), DSEG7 orange-red, two rows as on the US face:**
  - Row 1: the odometer field, then `km` / `miles`, then the trip field (`000.0`, counted from speed this drive,
    reset when the app starts). The odometer field shows the car's own odometer if the car publishes it (the
    builder checks the head unit's signals, for example KombiIF; read only, nothing new is required). Otherwise it
    shows the **range**.
  - Row 2 (where the E36 put INSPECTION / OIL SERVICE): the **clock** and the **outside temperature**. The US face's
    service LEDs stay unlit. The app has no service data.
- **Economy needle (estimated):** fuel flow (L/h) ≈ power (kW) x 250 g/kWh ÷ 745 g/L, with an idle floor of about
  0.8 L/h. Power is `powerPct` x `config.engine`'s peak. EU face: L/100km = flow ÷ speed x 100, clamped at 30. US
  face: MPG from the same flow, mapped onto the traced, non-linear tick angles (interpolated), smoothed about 1 s.
  Stopped with the engine running, it reads the high-consumption end (EU 30, US past 8). With no data it parks at
  its rest pin.
- **Fuel needle:** the fraction full (`1/1` = full). **Coolant needle:** 50 °C at the blue block, 90 °C straight up,
  120 °C at the red block, linear between and clamped.
- **Speed and rpm needles:** speed rests at the pin below 20 and clamps at the face's top (240 km/h, 140 mph); rpm
  0–7000, clamped a little past 7. Smoothing as the other themes.
- **Lamps, turn arrows, top-centre window, ASC square:** drawn unlit (dark, with the symbols faint, as in the JPN
  close-ups), never lit.
- **Settings not used by E36:** Readouts, Waze map, Badge, shift lights and their test, Show boost, Leave room for
  the driver camera (the top-centre lamp window already sits there), and Holiday lights (off on E36).
- **Demo** works as is: the needles follow the demo data.
- **Registration:** `app.json` (the four theme lists, description, version 0.20.0), `main.js` `look.tags`, preview via
  `tools/previews.py`, README "E36" section with screenshots of both faces, CHANGELOG.
- **Docs fix:** remove the outdated gear-box sentence from `docs/DEVELOPING.md` ("Visibility check").

## Left to the builder

- Exact traced coordinates, angles, tick lists and red-zone extents for each face.
- Exact colours sampled from the photos (day) and the night photos.
- The Barlow cut, and the needle shape and length from the close-ups.
- The layer plan (shader first, then text sheets), within 8 layers on one connection if possible.
- Whether the car publishes an odometer signal (fallback: range).

## Verification

- `shared/layouts.js` accepts `e36.json` with no hood or seat-belt warnings, and BMW's gear-letter gap at
  x 1380–1460, y 660–720 is uncovered.
- Bench (`node bench/server.js cluster_themes`): screenshots of the US day, EU day and US night faces, each set
  side by side with its reference photo, plus a demo run with every needle moving.
- The layer count (≤ 8) and pixel memory on the status row. Other themes unchanged: spot-check GT3, M and Vector by
  day and night.
- `python3 kit/tools/build.py cluster_themes` builds.
