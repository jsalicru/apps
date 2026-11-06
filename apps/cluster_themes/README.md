# Cluster Themes

Redraws the whole instrument cluster with your own themes. Open **Cluster Themes** from the apps menu on the center screen and pick the theme there.

![GT3 race dash](../../docs/images/cluster-gt3.gif)

## Themes

**Sweep:** a digital dash with room for a map.

- **Top:** a segmented rev sweep along the hood line, amber or machined silver (the **Color** setting), 0 to 8, red from your Redline setting (7200 rpm by default). The **Rev scale** setting picks Even, or a Race scale where each thousand gets wider, with 5000 or 5500 rpm in the middle of the sweep.
- **Middle:** with "Leave room for the map" on (the default), a borderless six-sided map window the size of the black area in BMW's own M layout, with a soft tab on the left that opens as far as BMW's speed needs. Off, the gear above a large digital speed. The theme shows no speed of its own in the window layout: use Central display area > Map view, where BMW's speed shows in the window, or turn the window off. BMW also draws two black boxes in the middle of a 2022 M3's cluster, which this app can't remove.
- **Left:** oil temperature, boost and fuel bars. The boost bar runs from 0 to 30 psi (2.1 bar), and **Show boost** turns it off.
- **Right:** the clock, range and outside temperature, and the gear with the map on. The gear turns red at your shift point.
- **Waze:** the window shows whatever the cluster has there. For Waze, install `robertn_waze_cluster` from `robertnisipeanu/idrive-apps`, set Central display area to Map view, and start a route. Not yet tested together on a car.

**Twin Dial:** two round analog dials with dark silver faces, steel rings and orange needles.

- **Left:** a 0 to 200 mph speedometer (0 to 320 km/h in metric), with the digital speed in a small window.
- **Middle:** a 0 to 8 tachometer with its red zone from your Redline setting (7200 rpm by default), with the gear in a small window. The gear turns red at your shift point.
- **Right:** oil temperature and fuel gauges, the clock, range and outside temperature.
- The dials sit left of center to stay clear of BMW's black gear box. "Leave room for the map" doesn't apply to this theme.

**GT3:** a race dash.

- **Top:** 18 round shift lights (green, yellow, red, then blue) that fill over the last 2000 rpm before your shift point, and a segmented rev bar.
- **Left:** speed, rpm, and your last shift with its grade.
- **Middle:** the gear, with water and oil temperatures.
- **Right:** boost, your shift point, and the clock.
- **At the shift point,** the lights, the rev bar, the rpm and the gear all go red.

**M:** the look of a current M8's cluster, on black.

- **Middle:** two glass rev blades either side of the gear and speed, with a red needle line, orange and red marks before your redline, and the gear in chrome.
- **Left:** a G-meter (the red dot moves with your cornering, braking and acceleration) and a fuel gauge, on a card drawn as an outline.
- **Right:** what the engine, chassis, steering and gearbox are set to (the segment at the level lights red, as on the M8), and an oil temperature gauge. The rows change with the drive mode buttons: Comfort, Sport, Sport Plus (engine and gearbox go SPORT PLUS) and Eco Pro (engine and gearbox go EFFICIENT). The car only reports the overall mode, not each part, so an Individual setup shows as its base mode.
- **Bottom:** range, the clock, and the outside temperature.
- "Leave room for the map" works in GT3 and Sport, not in M yet.

<img src="../../docs/images/cluster-m.png" width="840" alt="M theme">

**Sport:** the look of BMW's newer Live Cockpit Sport view.

- **Left:** speed as a blue bracket on BMW's 0 to 200 mph scale (0 to 320 km/h), with the digital speed and a fuel bar inside it. The scale number nearest your speed lights up.
- **Right:** revs as a red bracket with yellow and red marks before and past your redline, with the gear and an oil temperature bar inside it.
- **Middle:** black. With "Leave room for the map" on, BMW's map shows there, framed by the brackets.
- **Bottom:** boost and coolant in the blue and red strip, plus the clock, range and outside temperature.

<img src="../../docs/images/cluster-sport.png" width="840" alt="Sport theme">

More themes are on the way.

| At the shift point | With room for the map |
| --- | --- |
| <img src="../../docs/images/cluster-gt3-shift.png" width="420" alt="GT3 at the shift point"> | <img src="../../docs/images/cluster-gt3-map.png" width="420" alt="GT3 with room for the map"> |

## Off and drive modes

- **Off (BMW's own cluster):** pick it as the theme and the app draws nothing, so BMW's cluster comes back.
- **Change with SPORT / COMFORT / ECO PRO** (on by default): the cluster follows the drive mode buttons. Pick a theme for each mode. Out of the box, Sport shows GT3, and Comfort and Eco Pro show BMW's own cluster. Until the car reports a mode, the plain theme setting is used.
- **Works with HUD Widgets:** the cluster theme and the HUD can't show at the same time (cluster-render shares one screen slot between them). With the defaults, Sport gets the cluster theme and Comfort gets the HUD, so they take turns.

## Settings

- **Theme**, and one per drive mode
- **Leave room for the map:** cuts a window out of the dash so the map can show through (a rounded window, inset a few pixels so the stock cluster's corners don't peek out; `holeInset` and `holeRadius` in the layout), moves the gear and temperatures to the sides, and slims the rev bar.
- **Calibration grid:** a theme that draws lines every 50 px with x/y labels, for checking where things sit on the real screen, plus two probes for a photo: a grey swatch drawn twice (shader and pixels, to compare the two paths) and a row L1..L16 of single-layer labels where L1..L4 ride the app's own connection to cluster-render and L5..L16 two more connections (0.7.2). All sixteen in a photo means every connection gets its own 8 layers.
- **Units:** mph, °F, psi or km/h, °C, bar
- **Clock:** 12-hour or 24-hour
- **Redline**
- **Shift point before redline:** how far below the redline the shift lights peak (300 rpm by default)
- **Cold-engine rev guard:** until the oil reaches 80°C, the shift point starts at 4500 rpm and climbs as the oil warms up
- **Show boost**
- **Demo data:** fake data for trying it out parked

**Shift grades:** every upshift is graded on its peak rpm. EARLY means more than 250 rpm under the shift point, LATE more than 200 over it, COLD REV the same while the cold guard is on, LIMITER within 60 rpm of the redline, and anything in between is SPOT ON.

## Requirements

[cluster-render](https://github.com/robertnisipeanu/idrive-apps), installed from the `robertnisipeanu/idrive-apps` Store source.

## Status

Version 0.9.11 (0.9.11: a silver color option in Sweep; 0.9.10: a Race rev scale with 5500 rpm in the middle; 0.9.8: a Race rev scale option in Sweep; 0.9.7: Sweep's speed tab fades out, dims BMW's grey panel and opens only for the digits in use; 0.9.6: Sweep's map window loses its border and gains room for BMW's three-digit speed, and the clock follows US Central time (config.utcOffsetMinutes, config.usDst); 0.9.5: Sweep leaves the speed to BMW's own readout while the map window is on; 0.9.4: Sweep's map window matches the black area of a 2022 M3's own layout, after its first car test; 0.9.3: the fuel gauge set for a G80 M3, 59 liters; 0.9.2: a thicker rev sweep and a 30 psi boost scale; 0.9.1: a boost gauge in Sweep; 0.9.0: the Sweep theme; 0.8.1: Twin Dial gets dark silver faces; 0.8.0: the Twin Dial theme; neither tested on a car yet; 0.7.2: the engine can draw over several connections to cluster-render, 8 layers each, and the calibration grid probes that on the car; it counts the pixel memory a layout costs (16 MiB for every app together, each image twice) and text sends only the pixels that changed; 0.7.1: the shift lights come on from 3000 rpm instead of only over the last 2000 rpm before the shift point, which kept them dark when revving parked; 0.7.0 removes the Dials theme after the Nov 5 car test; 0.6.0 is the fix build below; 0.5.1 matched the M and Sport themes to BMW's own clusters). First car test done on 0.1.0 (Nov 2026): the shapes drew upside down (fixed), only part of the dash drew (the status row now says what's missing and why), and the map cut-out was in the wrong place (moved to where the map sits on an X3). Second car test (Nov 5 2026): the car drew only the first 8 layers (cluster-render's limit per connection; every theme now fits in 8: text is packed into a few image layers, the GT3 frame is one shader, the M setup bars are part of the backdrop), dark tints are plainly visible on the panel (every backdrop is now pure black; a measured grey swatch showed the shader and image paths draw identical colours), and the hood and BMW's own black gear box hid the top corners and x 1406..1597, y 342..419 (everything moved clear of both). Third test the same evening: GT3 drew complete. Fourth, pending: the 0.7.2 grid photo (does L5..L16 show on connections 2 and 3?). Still to be checked on a car:

- **Whether M and Sport draw complete** (GT3 does). If one doesn't, the first row of the app's page says how many parts are drawn and why the rest aren't.
- **Whether BMW's warning lights still show over the dash.** The GT3 theme is solid black and covers whatever is under it. Test it parked: start the car with a seat belt off and look for the warning.
- The drive mode switching, and the map cut-out's new position.
- How the colours and edges look on the real screen.
