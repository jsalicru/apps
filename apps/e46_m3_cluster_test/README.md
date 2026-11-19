# E46 M3 Cluster Test — experimental G80 beta

**Target:** 2022 BMW M3 G80 (S58), iDrive 7, 1920×720 cluster. Standalone app ID: `e46_m3_cluster_test`.

This is a functional *E46-inspired first-pass rendering beta*, not a verified OEM-accurate replica. It uses existing twin-dial rendering infrastructure with E46-style gauge placement, separate fuel/coolant dials, oil-temperature inset, custom 7200 RPM warning and seven embedded tach lamps. It has **not been tested on the car**. BMW's original warnings and ECU limiter are not modified.

## Install using MGU Store — PARKED TEST ONLY

1. Park safely, maintain stable power, and ensure **cluster-render** is installed.
2. In **MGU Store → Settings → Add source**, enter `jsalicru/apps`.
3. Select **Branches → feature/e46-m3-cluster-test** (not main), then refresh.
4. Install **E46 M3 Cluster Test** only. Do not update your existing P3 Clusters or E36 test app.
5. Disable/stop P3 Clusters and E36 Cluster Test before activating this test app: they share the same cluster-render display.
6. Start E46 M3 Cluster Test; the default display is **Off**. While parked, select **E46 M3 Beta** in its Theme setting.
7. Confirm speed, RPM, fuel, oil and coolant readings against the car's OEM displays/diagnostics. Confirm warm-up LEDs at oil <=110°F, progressive extinguishing to 160°F, and shift LEDs from 6000–7200 RPM **only on a simulator/bench**, not by revving a stationary engine to redline.

## Restore OEM cluster

Set **E46 M3 Cluster Test → Theme → Off**; stop/disable this app before restarting P3 Clusters. If needed, uninstall E46 M3 Cluster Test. Do not depend on this beta for safety-critical instrumentation.

## Important limitations

- The layout is a first-pass implementation, not the final photorealistic OEM face. Secondary telltales, warning lights, precise dial typography, and shift LED physical geometry need on-car visual validation.
- `coolantFraction` maps 170/210/230°F to 25/50/75% of the coolant needle sweep. Missing sensor values park at zero; this is NOT an indication of safe temperature.
- Warm-up LEDs are **off** if oil temperature is unavailable; never substitute coolant for oil. Seven lamps are a beta approximation.
- The custom 7200 RPM redline is a display cue, not the S58's ECU rev limiter.
- The E46 LED shader and app packaging have not yet been validated against the actual head unit.
- GitHub Actions runs Node logic tests and checks manifests, assets and JS syntax. Packaging requires proprietary `oap-sdk` and is skipped in CI if unavailable. MGU Store is expected to supply it during on-car build, but this is not guaranteed.

## Developer testing

`node tools/test_e46_m3.js` for calibration logic; `node bench/server.js e46_m3_cluster_test` for local browser bench. See `docs/e46-m3-beta-checklist.md` for outstanding release gates.
