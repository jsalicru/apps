# E36 Cluster Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new Cluster Themes theme `e36` that redraws the cluster as a pure BMW E36 328i cluster (EU face for metric,
US face for mph), with live needles, and orange-red lighting at night.

**Architecture:** One new effect widget `e36dash` (a GLSL ES 1.00 shader) draws the whole face, dials, ticks, zones and
needles from geometry written by a generator `tools/gen_e36.py`. Text widgets on top carry the printed numbers, the
labels and the LCD. Pure needle and economy maths lives in a small `shared/e36.js`, tested with plain-Node asserts. The
theme palette carries night roles, which replace the 60 % night dim for this theme.

**Tech Stack:** Node 8.16.2 (car runtime: no `?.`, no `??`), GLSL ES 1.00 (cluster-render effect layers),
Python 3 + Pillow (generator, font bake, previews), the Mac bench (`node bench/server.js cluster_themes`).

**Spec:** `docs/superpowers/specs/2026-11-16-e36-cluster-theme-design.md`. Reference photos:
`../design/photos/e36/` (`eu-kmh-day-face.png`, `us-mph-day-face.png` are the tracing sources).

## Global Constraints

- Theme id `e36`, label `E36`, page tag `'328i · 90s'`; Cluster Themes version **0.20.0**.
- True E36 proportions, one uniform scale per face; no invented markings: every number and tick comes from a photo.
- BMW's gear letter gap **x 1380–1460, y 660–720** stays uncovered (strip row split `l` / `r`, as in `vector.json`).
- Metric → EU face (`toggle: "units=metric"`), mph → US face (`toggle: "units=us"`). `units` defaults to `us`.
- Lamps, turn arrows, top-centre window and ASC square are always unlit; no drive mode; no holiday garland on E36.
- The LCD odometer field shows **range** (no odometer signal exists in this repo or the kit).
- Layer budget 8 per connection; effect widgets first in file order, text after.
- Commits on branch `e36-cluster-theme`; end messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **No data** (signals null right after start, or demo off while parked): every needle parks at its rest pin, the LCD
   shows `--`, and nothing throws. Test in Task 1 (`frac(null) → rest`).
2. **Out-of-range values** (speed 280 km/h, rpm 7600, coolant 135 °C, fuel 1.05, negative speed): needles clamp at
   the scale ends, never wrap round the dial. Test in Task 1.
3. **Units switched while driving:** the face swaps to the other one on the rebuild, and the speed needle reads the
   new unit (mph on the US face). Check on the bench in Task 5.
4. **Sunset while shown:** the minute timer rebuilds with the night roles, and the other themes still dim to 60 %.
   Test in Task 2.
5. **Standstill with the engine idling:** the economy needle reads the thirsty end (EU 30, US past 8) and doesn't
   flicker between ends at 0–3 km/h. Test in Task 1.

---

### Task 1: Needle and economy maths (`shared/e36.js`)

**Files:**
- Create: `shared/e36.js`
- Create: `tools/test_e36.js` (plain Node `assert`, Node 8 syntax; run with `node tools/test_e36.js`)
- Modify: `apps/cluster_themes/app.json` `"shared"`: add `"e36.js"`

**Interfaces:**
- Produces:
  - `frac(value, table) -> number|null`: `table` is `[[value, frac], ...]` ascending by value (or descending; both
    work); piecewise linear, clamped to the first/last frac; `null`/NaN value → `null` (the caller parks the needle).
  - `flowLph(powerKw) -> number`: `max(0.8, powerKw * 250 / 745)`; `null` power → `null`.
  - `economy(speedKmh, flow, us) -> number|null`: EU L/100km = `flow / speed * 100`, US MPG = `235.215 / L100`.
    Below 3 km/h → `Infinity` (EU) / `0` (US): the thirsty end. `null` input → `null`.
  - `class Smooth { constructor(ms); step(v, now) -> number }`: exponential smoothing with time constant `ms`
    (1000 for economy); a `null` v holds the last value.
  - `class Trip { add(speedKmh, now); km() -> number; }`: integrates speed over time; gaps over 2 s count as 0.

- [x] **Step 1: Write the failing tests** in `tools/test_e36.js`:
  - `frac(130, [[20,0],[240,1]]) === 0.5`; `frac(5, …) === 0`; `frac(300, …) === 1`; `frac(null, …) === null`.
  - Descending table: `frac(10, [[40,0],[8,1]]) === 0.9375` (MPG face runs 40 → 8).
  - `flowLph(0) === 0.8`; `Math.abs(flowLph(100) - 33.56) < 0.01`.
  - `economy(100, 8, false) === 8`; `economy(1, 0.8, false) === Infinity`; `economy(2, 0.8, true) === 0`;
    `Math.abs(economy(100, 8, true) - 29.4) < 0.01`.
  - `Trip`: 100 km/h for 36 s (steps of 1 s) → `km()` ≈ 1.0 (±0.01); a 5 s gap adds nothing.
- [x] **Step 2:** `node tools/test_e36.js`. Expected: fails with `Cannot find module '../shared/e36'`.
- [x] **Step 3:** Implement `shared/e36.js` (header comment in the repo's style; `module.exports = { frac, flowLph,
  economy, Smooth, Trip }`).
- [x] **Step 4:** `node tools/test_e36.js`. Expected: `e36: all tests passed`.
- [x] **Step 5:** Create branch `e36-cluster-theme`; commit `shared/e36.js tools/test_e36.js apps/cluster_themes/app.json`
  ("E36: needle and economy maths").

### Task 2: E36 palette with night roles

**Files:**
- Modify: `shared/hud_themes.js`: add `e36` to `THEMES`; export `nightTheme(theme, k)`
- Modify: `shared/hud.js:1893`: `if (this.nightOn) this.theme = nightTheme(this.theme, NIGHT_DIM);`; move `dimTheme`
  (hud.js:2963) into `hud_themes.js` behind `nightTheme`
- Modify: `shared/hud.js:1329-1334` `_garlandHoliday`: return null when the base theme has `noGarland: true`
- Test: `tools/test_e36.js`

**Interfaces:**
- Produces: `THEMES.e36` with the roles `bg, face, bezel, dial, mark, needle, hub, red, blue, reserve, arrow, lcd,
  lcdGhost, strip, fg, dim` (fg = mark, dim = face print grey), `night: { …same keys… }` (markings, numbers, needle
  and lcd orange-red, sampled from `us-mph-night-bench.png`; face and bezel near black), `noGarland: true`,
  `name: 'E36'`. Day colours are sampled from `eu-kmh-day-face.png`.
- `nightTheme(theme, k)`: when `theme.night` exists, it returns `Object.assign({}, theme, theme.night, { name })`
  without `night`; otherwise it returns `dimTheme(theme, k)` unchanged.

- [x] **Step 1: Failing tests:** `nightTheme(THEMES.e36, 0.6).mark` deep-equals `THEMES.e36.night.mark`;
  `nightTheme(THEMES.classic, 0.6).fg` deep-equals `[146, 148, 150, 255]` (60 % of `[243, 246, 250]`, rounded).
- [x] **Step 2:** Run. Expected: FAIL (`nightTheme is not a function`).
- [x] **Step 3:** Implement as above.
- [x] **Step 4:** Run. Expected: PASS. Run `node bench/server.js cluster_themes`, set `hudLayout` to `vector` with
  `nightDim` on Auto after sunset (or force `_nightDim` in a scratch run): Vector still dims as before.
- [x] **Step 5:** Commit ("E36: palette with night roles").

### Task 3: `e36dash` shader and the EU face geometry

**Files:**
- Modify: `shared/shaders.js`: add `E36DASH`, export as `e36dash`
- Modify: `shared/hud.js`: header doc entry under "Widget types"; create-time uniforms next to `vdash` (~2158); tick
  update next to `vdash` (~2739)
- Modify: `shared/layouts.js` `TYPES`: `e36dash: ['face', 'dials']`
- Create: `tools/gen_e36.py` (writes `apps/cluster_themes/hud/layouts/e36.json`; usage
  `python3 tools/gen_e36.py apps/cluster_themes/hud/layouts/e36.json`)
- Test: `tools/test_e36.js` (layout check)

**Interfaces:**
- Consumes: `frac`, `flowLph`, `economy`, `Smooth` (Task 1); the `e36` roles (Task 2).
- Produces the widget keys (target px; the generator converts from photo px with one scale `s` and offset per face):
  - `face`: `{ outline: [[x, y], …] (≤ 24 points, the grey face's edge), bezel: px }`.
  - `dials`: four objects in order fuel, speed, tach, temp: `{ cx, cy, r, pivot: [x, y], needle: [len, tail, width],
    hub: r, ticks: [[a0, a1, count, len, width], …] (≤ 4 groups, evenly spaced, inclusive, degrees clockwise from
    12 o'clock), map: [[value, frac], …], a0, sweep }`. The needle angle is `a0 + sweep * frac`. Map values: km/h or
    mph, rpm, fuel 0..1, coolant °C (`[[50, 0], [90, 0.5], [120, 1]]`).
  - `zones`: `[[dial, a0, a1, inner, outer, role], …]` (≤ 8): the red rev zone, the stepped red bars, and the fuel
    and coolant blocks.
  - `econ`: `{ cut: [x0, y0, x1, y1, r], pivot: [x, y], needle: [len, width], angles: [deg…] (≤ 16), lens: [px…],
    map: [[value, frac], …] }`.
  - `windows`: `[[x, y, w, h, radius, role], …]` (≤ 4: LCD, top-centre lamp, ASC square).
  - `arrows`: `[[x, y, size, dir], …]`. `knob`: `[x, y, r]`. `sensor`: `[x, y, r]`.
  - Uniforms per tick: `u_need` vec4 (speed, rpm, fuel, temp fracs; −1 = park at rest), `u_econ` float.
- **The widget's rect is x 0, y 0, w 1920, h 660.** The bottom row belongs to Task 6.

- [x] **Step 1: Failing test** (`tools/test_e36.js`, layout section). Load `e36.json`, then:
  - `new Layouts(os.tmpdir(), log, [1920, 720])._validate(json, 'e36')` doesn't throw.
  - `visible.check(json.widgets, 'panel')` warns only for ids starting with `dash` or `strip_`.
  - No widget overlaps the rect `[1380, 660, 1460, 720]`.
- [x] **Step 2:** Run. Expected: FAIL (no `e36.json`).
- [x] **Step 3: Trace the EU face** from `eu-kmh-day-face.png`.
  - Measure the dial centres and radii, the needle pivots, the tick start/end angles and counts, the red zone, the
    blocks, the economy cut-out and its angles, the windows, arrows, knob and sensor.
  - Keep these in photo px in `gen_e36.py` under `FACES['metric']`.
  - Pick `s` and the offset so the face spans the full 1920 width, the lamp strips land at y ≈ 662–716, and the
    top stays below `visible.hoodY`.
- [x] **Step 4:** Write `E36DASH` and wire it.
  - The shader draws, in this order: bezel and face, the dial faces, ticks, zones, the econ cut-out and its ticks,
    windows, arrows (dark, never lit), knob and sensor, then the needles over the hubs.
  - Antialias with `fwidth`-free smoothstep on distance (GLSL ES 1.00 has no derivatives).
  - `hud.js` computes the fracs with `frac()` on each tick. Speed is converted to mph on the US face. Economy:
    `Smooth(1000)` of `economy(speed, flowLph(powerPct/100 * config.engine.powerKw), us)`.
- [x] **Step 5:** Run the test. Expected: PASS. On the bench, set `hudLayout` to `e36` and Units to metric, then
  screenshot with headless Chrome (`bench/README.md` "Screenshots", `?only=1&clean=1`). Compare side by side with
  `eu-kmh-day-face.png`: the dial positions, tick angles and red zone match by eye.
- [x] **Step 6:** Commit ("E36: e36dash shader and EU face").

### Task 4: EU face printing and fonts

**Files:**
- Modify: `tools/bake_fonts.py` `CLUSTER_FONTS`: add `e_num` (dial figures), `e_sm` (small print such as `1/min`,
  `x1000`, `km/h`, `EG`, `L/100km`, econ figures), and `e_lcd` (DSEG7 Classic, digits plus `.-: `). Pick the Barlow cut
  that matches the photo's DIN-like figures.
- Modify: `tools/gen_e36.py`: emit text widgets for every printed figure and label on the EU face (`toggle:
  "units=metric"`, color `mark`), placed from the traced photo positions.
- Run: `uv run --no-project --with pillow python tools/bake_fonts.py cluster_themes`

- [x] **Step 1:** Add the fonts and bake. Expected: `apps/cluster_themes/hud/fonts/e_*.json` written.
- [x] **Step 2:** Generate and run `node tools/test_e36.js`. Expected: PASS.
- [x] **Step 3:** Bench screenshot (metric). Every figure on the photo is present, in place, upright, and nothing
  else is added. The rebuild log line shows ≤ 8 layers on connection 0 (plus the strip row's).
- [x] **Step 4:** Commit ("E36: EU face printing").

### Task 5: US face

**Files:**
- Modify: `tools/gen_e36.py`: `FACES['us']` traced from `us-mph-day-face.png`, emitted as a second `e36dash` widget
  (id `dash_us`, `toggle: "units=us"`; the EU one becomes `dash_eu`, `toggle: "units=metric"`) and its text widgets.
- The US face has: MPH 20–140 outer (ticks every 5), the inner km/h ring 20–240, `MPH`/`EG`/`km/h`, `UNLEADED
  GASOLINE`/`ONLY`, and MPG `40 25 20 15 10 8`. Add any characters this needs to the `e_` fonts and re-bake.

- [x] **Step 1:** Generate; run `node tools/test_e36.js`. Expected: PASS.
- [x] **Step 2:** Bench screenshot with Units on US, side by side with `us-mph-day-face.png`: matches by eye.
- [x] **Step 3:** Switch Units while the demo plays. The face swaps on the rebuild, and at 100 km/h manual speed the
  needle reads 62 mph.
- [x] **Step 4:** Commit ("E36: US face").

### Task 6: Bottom row, LCD and trip

**Files:**
- Modify: `tools/gen_e36.py`:
  - Strip covers `strip_cover_l` (x 0–1380) and `strip_cover_r` (x 1460–1920), `fill`, role `face`, y 660–720,
    `stripRow` `l` / `r`.
  - The three dark lamp strips as `box` widgets (`fill` and `line` `strip`, radius from the photo), split at the gear
    gap, with `stripRow` set on each.
  - LCD text, both faces:
    - Row 1: `{{range}}`, `{{u:distLc}}` (`km` / `miles`), `{{trip}}`.
    - Row 2: `{{time}}{{ampmLc}}` and `{{ambient}}{{u:temp}}`.
    - Colour `lcd`, font `e_lcd`; unit words in `e_sm`.
- Modify: `shared/hud.js`:
  - New token `{{trip}}`: a `Trip` (Task 1) fed from `_raw('speed')` on each tick, formatted `000.0` in km or
    miles. The kit's demo drive counts too (as on the car while parked: the demo only runs below 5 km/h).
  - Document the token in the header.

- [x] **Step 1:** Generate; run `node tools/test_e36.js`. Expected: PASS, and the gear gap stays uncovered.
- [x] **Step 2:** Bench, both faces: the LCD shows range, trip `000.0`, then rising during the demo, the clock and
  outside temperature. BMW's gear letter (bench backdrop on, `?backdrop=1`) shows through the right strip.
- [x] **Step 3:** Night: force `nightDim` Auto after sunset (or set the bench clock), then screenshot. Compare with
  `us-mph-night-bench.png`: orange-red markings, needles and LCD.
- [x] **Step 4:** Commit ("E36: bottom row, LCD and trip").

### Task 7: Register, preview, docs, build

**Files:**
- Modify: `apps/cluster_themes/app.json`:
  - Add `["e36", "E36"]` to all four theme lists (after `vector`).
  - Add "E36 (a pure 328i cluster)" to the description.
  - Set version `0.20.0`.
- Modify: `apps/cluster_themes/main.js` `look.tags`: `e36: '328i · 90s'`
- Create: `apps/cluster_themes/hud/previews/e36.json` via `uv run -q --with pillow python -I tools/previews.py
  cluster_themes 8078`
- Modify: `apps/cluster_themes/README.md`:
  - Add an "E36" section after Vector, with the bench screenshots `docs/images/cluster-e36.png` (US) and
    `cluster-e36-eu.png`.
  - Settings list: E36 isn't affected by Readouts, the map or the badge.
- Modify: `CHANGELOG.md` (0.20.0) and the root `README.md` theme list.
- Modify: `docs/DEVELOPING.md`:
  - "Visibility check": drop the BMW gear box sentence.
  - "Layouts": add `e36dash` and the generator line.
- Mark this file's checkboxes and add a Review section at the end.

- [x] **Step 1:** Make the edits; run `node tools/test_e36.js`. Expected: PASS.
- [x] **Step 2:** `python3 kit/tools/build.py cluster_themes`. Expected: builds into `dist/` with no error.
- [x] **Step 3:** Regression: bench screenshots of GT3, M and Vector by day and night, compared with
  `../design/previews-src/cluster_themes/`. Expected: unchanged.
- [x] **Step 4:** Commit ("Cluster Themes 0.20.0: E36 theme").

---

## Review (Nov 16 2026)

Built on branch `e36-cluster-theme` (Cluster Themes 0.20.0), inline execution; ledger in `.superpowers/sdd/todo/progress.md`.

- **Done:** `e36dash` (whole cluster, plus the strip row's two pieces) and `e36econ` (fuel-use gauge) shaders; EU and US
  faces traced from the photos by `tools/gen_e36.py`; E36 palette with night roles (`nightTheme`); E36 fonts (incl. a
  built "1/1"); `e36cool` icon; `{{trip}}` token; registration, preview, README/CHANGELOG/DEVELOPING.
- **Verified:** `node tools/test_e36.js` (20 pass: maths, night colours, layout validity, gear-letter gap, both faces);
  `node tools/shader_budget.js --all` (no crash mark; main loop load 6049, between Sport 6017 and M view 6303 that run
  on the car); both shaders compile in Chrome's WebGL; bench overlays against `eu-kmh-day-face.png` and
  `us-mph-day-face.png` line up; 100 km/h reads 62 mph on the US face; night roles after sunset; 8 + 2 layers on two
  connections; `kit/tools/build.py cluster_themes` builds; other themes' previews differ only in live data (clock,
  last shift, G trail).
- **Deviations:** see the `Ruling:` lines in the ledger (economy gauge split into its own layer for the GPU budget,
  strip row drawn by the same shader, existing trip counter reused, fonts named per use).
- **Not verified:** anything on the car (GPU timing of `e36dash`, whether BMW's gear box stays away with the right
  strip drawn round its letter).

## Follow-up (Nov 17 2026): bottom row, economy window, figures

- [x] One cutout: the face ends at y 660 and BMW's whole bottom row shows (range, clock, gear letter, outside temp);
  the strip pieces and the shader's lamp strips are gone. The LCD keeps one row (range, unit, trip) as on the car.
- [x] Rev counter cut flat at 974 (photo px, was 985), just under the economy ticks, as both photos show.
- [x] Economy window: level top with both corners cut off (ECON_CHAM, measured on both photos), ticks drawn end to
  end as printed (the right-hand ones lean; they used to be forced radial round the needle pivot and shrank to dots).
- [x] Figures (speedometer, inner km/h ring, rev counter) placed on their tick's angle, ink 7 px from the nearest tick
  (true ink widths: tabular digits); the US MPH figures stay between the two rings (centred where the band is tight).
- [x] `node tools/test_e36.js` passes (bottom row open, LCD distances only); bench screenshots of both faces.
- [x] EU economy ticks rebuilt from geometry (Nov 17 2026): the hand-traced endpoints were off (20 .. 28 crossed the
  printed ticks, the left ones short). Fitted to the photo's tick pixels: all radial about one centre, evenly spaced,
  inner ends on one circle, outer ends on another and level at the bottom (`eu_econ_ticks()`); overlay on
  `eu-kmh-day-face.png` matches, `node tools/test_e36.js` passes, bench shot checked. US ticks overlaid: already right.

## Follow-up (Nov 17 2026): M3 face for the 7000 / 7500 redlines

Plan: ~/.claude/plans/hazy-wondering-planet.md. Photos: `design/photos/e36/m3-us-mph-day-face.png`,
`m3-kmh-jpn-day-face.png`.

- [x] `&` in toggles (hud.js `_toggleOn`, layouts.js validation); four faces: EU / US 328i (`!redline=7000|7500`), EU / US
  M3 (`redline=7000|7500`)
- [x] M3 speedometers traced from pixels: km/h 20..280 (27 ticks round one centre, linear to 1.5 degrees); MPH 10..170 with
  the inner km/h ring 20..280 (the US photo is shot from the left: its rings' ellipse mapped to a circle first; both rings
  give the same scale). Overlaid on both photos.
- [x] Oil temperature gauge in the economy window (50..150 °C / 120..300 °F, same ticks): 11 ticks fitted (one centre,
  11.1 degrees a step to 0.2, inner ends on one circle to 0.3 px, outer ends on the rim and the floor), `e36oil` icon,
  `signal: 'oil'` (hud.js converts to F on the mph face), the needle on its pin under 50 °C
- [x] Red needles (`needleColor: 'mneedle'`, day and night)
- [x] /M badge (`e36m`, a multi-colour icon, icons.js LOGOS) in the small window
- [x] Trip knob and light sensor gone from every face (gen, shader, hud.js uniforms)
- [x] Tests, shader budget, bench screenshots, build

### Review (Nov 17 2026)

- **Verified:** `node tools/test_e36.js` (27 pass, new: four faces by units and redline, M3 scales / oil map / badge,
  `&` toggles, no knob or sensor); overlays of the generated M3 faces on both M3 photos (km/h face and oil gauge on the
  printed ticks; MPH face within the photo's own distortion); `node tools/shader_budget.js --all` (no crash mark; e36dash
  loop load 5231, was 6049: the knob and sensor are gone, the tick loop is 10); bench shots EU / US x redline 6500 / 7000,
  day and night; `kit/tools/build.py cluster_themes` builds; previews regenerated (the E36 one at the bench's 6500: 328i).
- **Deviations:** the tick arrays grew from 9 to 10 (the MPH M3 face has four speedometer tick groups). The M3 rev
  counter is still rev_face()'s 0 .. 8, not re-traced against the M3 photos. The JPN photo's fuel gauge (0..60 L) is not
  used: the EU M3 face keeps 0, 1/2, 1/1.
- **Not verified:** anything on the car.

## Follow-up (Nov 17 2026): needles on top, symmetric EU economy window

- [x] Needles over everything: new `e36needles` layer (shaders.js, hud.js, layouts.js), z 6, see-through, drawing the four
  dials' needles, counterweights and hubs and the economy / oil needle (inside its window, under the rev needle).
  `e36dash` and `e36econ` no longer draw needles; their needle data moved to the new widget (gen_e36.py `build()`).
- [x] EU economy gauge symmetric: centred under the rev counter (the EU photo, shot at an angle, put it 21 px left and
  1 degree off; the face-on US photo and tach-econ-closeup.png have it centred), ticks mirrored, the print mirrored, the
  window's corners over the 5 and 25 L/100km marks (`eu_econ_cham()`), slope 0.46 both sides; the 0 and 30 figures 108 px
  out at 900, under the slopes. The US window is unchanged.

### Review (Nov 17 2026)

- **Verified:** `node tools/test_e36.js` (29 pass; new: needles on top of every other widget of their face, within
  their layer, none drawn by the face or the economy layer; the EU economy gauge mirrors about the rev counter);
  `node tools/shader_budget.js --all` (no crash mark; E36 loop load 4785 + 141 + 869 = 5795, was 5231 + ~150; under
  Sport's 6017); bench shots EU, US, EU M3 (needles over "140", "4", "1/min", the icons and the economy figures; red on
  the M3); 7 layers on one connection; `kit/tools/build.py cluster_themes` builds; the E36 preview regenerated alone.
- **Not verified:** anything on the car (the extra full-width see-through layer's GPU cost).
