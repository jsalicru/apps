<h1 align="center">bimmer-lab apps</h1>

<p align="center">Apps for BMW iDrive 7 head units (MGU), installed through the community MGU Store.</p>

## P3 Clusters

<img src="apps/cluster_themes/icon.png" width="72" align="left" alt="P3 Clusters icon">

Redraws the whole instrument cluster in a theme of your choice. Pick the theme on the center screen, or let it follow the SPORT / COMFORT / ECO PRO buttons. Every theme leaves BMW's gear and drive programme display at the bottom right uncovered, so BMW draws no black boxes over it. [Read more](apps/cluster_themes/README.md)

### Themes

<table align="center">
  <tr>
    <th align="center">E46 M3</th>
    <th align="center">E46 M3 at night</th>
  </tr>
  <tr>
    <td><img src="docs/images/p3-e46m3.png" width="440" alt="E46 M3 theme"></td>
    <td><img src="docs/images/p3-e46m3-night.png" width="440" alt="E46 M3 theme at night"></td>
  </tr>
  <tr>
    <td colspan="2">The E46 M3's cluster: chrome-ringed dials, an mph speedometer with km/h inside, the oil temperature gauge in the rev counter, orange warm-up lights that go out as the oil warms, and shift lights that blink at the shift point. Warm amber lighting at night, like the real car.</td>
  </tr>
  <tr>
    <th align="center">E36</th>
    <th align="center">Sweep</th>
  </tr>
  <tr>
    <td><img src="docs/images/p3-e36.png" width="440" alt="E36 theme"></td>
    <td><img src="docs/images/p3-sweep.png" width="440" alt="Sweep theme"></td>
  </tr>
  <tr>
    <td>A pure 90s E36 cluster: the M3 face with its oil gauge and red needles, redlined at 7200 rpm, in mph or km/h. Orange-red lighting at night.</td>
    <td>A digital dash: a rev sweep across the top, the gear, boost, fuel, oil and water bars, and a window over BMW's map view.</td>
  </tr>
  <tr>
    <th align="center">Dyno</th>
    <th align="center">Ribbon</th>
  </tr>
  <tr>
    <td><img src="docs/images/p3-dyno.png" width="440" alt="Dyno theme"></td>
    <td><img src="docs/images/p3-ribbon.png" width="440" alt="Ribbon theme"></td>
  </tr>
  <tr>
    <td>A safety dash for hard pulls in BMW M colours: twelve readout tiles plus power and torque, each flashing red over its warning limit.</td>
    <td>Calm and premium: one ribbon of light fills with the revs over a big thin speed. Holiday editions for Christmas, Thanksgiving, New Year and the Fourth of July.</td>
  </tr>
</table>

## HUD Widgets

<img src="apps/idrive_hud_widgets/icon.png" width="72" align="left" alt="HUD Widgets icon">

Puts your own readouts on the windshield HUD: gear, shift lights, boost, oil, coolant and intake temperatures, a G-meter and trip figures. Ten layouts, in Classic, M and Night colours (Cruise and Retro bring their own). [Read more](apps/idrive_hud_widgets/README.md)

<p align="center"><img src="docs/images/hud-redline.gif" width="600" alt="Redline layout on the HUD"></p>

<table align="center">
  <tr>
    <th align="center">Daily</th>
    <th align="center">Sport</th>
    <th align="center">Redline</th>
  </tr>
  <tr>
    <td><img src="docs/images/hud-daily.png" width="300" alt="Daily layout"></td>
    <td><img src="docs/images/hud-sport.png" width="300" alt="Sport layout"></td>
    <td><img src="docs/images/hud-redline.png" width="300" alt="Redline layout at the shift point"></td>
  </tr>
</table>

## Setting up

Each app has its own page on the center screen, opened from the apps menu. Pick a theme or layout there, give each drive mode its own, choose what every readout shows, and set your time zone and units.

<p align="center"><img src="docs/images/page-hud-layouts.png" width="900" alt="HUD Widgets page on the center screen"></p>

## Install

1. Install **cluster-render** first. Both apps draw through it. It comes from the `robertnisipeanu/idrive-apps` Store source. With version 0.5.1 or newer, a cluster theme and a HUD layout can show at the same time.
2. In the Store, go to **Settings, Add source**, enter **`bimmer-lab/apps`**, and install the apps you want.
3. Open the app from the apps menu on the center screen to pick a theme or layout.
4. The head unit's clock runs on UTC, so set **Settings, Time zone (clock)** to your zone once (for example US Eastern). Named zones change for daylight saving by themselves.

The Store builds each app on the car from this repo. No BMW code is in it. Both apps are tested on a 2020 X3 M40i; each app's page says what has been checked on the car and what is still open. Version history is in [CHANGELOG.md](CHANGELOG.md).

## Use at your own risk

These are unofficial apps made by hobbyists. They are not made, approved or supported by BMW, and the people who wrote them are not responsible for anything that happens to your car or to you while using them.

- Installing apps that don't come from BMW on your head unit is done at your own risk and may affect your warranty.
- The apps only read data from the car. They never write to or change any control unit.
- A cluster theme or HUD layout draws over BMW's own displays. Readouts are for information only: don't rely on them for safety, and always follow BMW's own warnings. If anything looks wrong, pick Off and BMW's display comes back.
- Don't set up or change the apps while driving. Keep your eyes on the road.
- The apps are provided as is, without any warranty, under the MIT licence. You use them entirely at your own risk.

## Credits

- [cauliflowermossgrape/idrive7-apps](https://github.com/cauliflowermossgrape/idrive7-apps): the MGU App Kit (MIT) these apps are built on, and the Redline app the shift scoring comes from (Redline's HUD by [@biscotit](https://github.com/biscotit)).
- [robertnisipeanu/idrive-apps](https://github.com/robertnisipeanu/idrive-apps): cluster-render, which draws on the HUD and the cluster.
- Barlow, Michroma and Orbitron typefaces (SIL Open Font License).

## Licence

MIT. Third-party parts are listed in each app's `NOTICE`. To work on the apps, see [docs/DEVELOPING.md](docs/DEVELOPING.md).
