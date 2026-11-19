# E46 M3 cluster — on-car beta release gates

Target: 1920×720 iDrive 7 panel, standalone app `e46_m3_cluster_test`, custom 7200 RPM redline. Branch `feature/e46-m3-cluster-test`; do not merge to main before on-car validation.

## Target vehicle
- 2022 BMW M3 G80, S58, iDrive 7; 7200 RPM is a display-only warning, not ECU limiter.
- Existing app manifest subscribes to CDS engine speed/engine temperature, Vehicle2 car speed, and KombiIF tank range. Verify exact oil vs coolant mapping in shared vehicle state before using either signal for warm-up LEDs.
- Current shared renderer uses `d.oil` for shift calculations, but this alone does not prove its live source or units on this car. Require a parked signal diagnostic before enabling LED temperature behavior.

## 1. Visual renderer — BLOCKED
- [ ] Dedicated E46 shader/gauge-face renderer, not E36 imagery.
- [ ] 180 MPH and 0–9000 RPM scales, redline at 7200.
- [ ] Seven warm-up/shift segments physically INSIDE tachometer.
- [ ] Oil-temperature sub-gauge at bottom of tach; coolant gauge at far right.
- [ ] Coolant calibration: 170/210/230°F white marks; day/night color fidelity.
- [ ] OEM-style amber LCDs and needles.

## 2. Real data integration — BLOCKED
- [ ] Live RPM, speed, fuel, oil temp, coolant temp verified on target car.
- [ ] E46 coolantFraction() connected to coolant needle, with no-data park behavior.
- [ ] tachLights(oilF,rpm) connected to LED renderer; oil-temp sensor not silently replaced by coolant.
- [ ] Confirm LED order, temperature thresholds and 7200 RPM shift progression on simulator.
- [ ] Sensor disconnect/NaN and mode-change behavior verified.

## 3. Independent app packaging — BLOCKED
- [ ] Create `apps/e46_m3_cluster_test/` with unique ID, main.js, manifest, icon, HUD assets and README.
- [ ] Default layout OFF in all modes; never run alongside P3 Clusters or E36 Cluster Test.
- [ ] Add app to MGU Store branch source; check manifest shared-file dependencies.
- [ ] Build with real SDK provided by Store on head unit (never ship bench stub SDK).

## 4. Verification — PARTIAL
- [x] Pure Node E46 calibration/LED module in `shared/e46_m3.js`.
- [x] E46 logic tests in `tools/test_e46_m3.js` and CI workflow.
- [ ] Generated layout schema, font and preview validation.
- [ ] Browser bench render with mock signals, including cold/warm/redline transitions.
- [ ] CI install manifest check and package build where genuine SDK is available.
- [ ] First parked, supervised on-car test; verify fail-safe return to OEM display.

## Installation
Do NOT install as E46 until the above renderer, independent app, and packaging gates are complete. Existing E36 test app is not an E46 beta. No claim of hardware validation until owner reports results.
