# E46 M3 OEM-style cluster — implementation plan

Status: design and scaffolding only; **not installable as an E46 theme yet**.

## Goal
Build a separate `e46_m3_cluster_test` application, never replacing P3 Clusters or E36 Cluster Test. The target is a faithful US-market BMW E46 M3 cluster on the 1920×720 ID7 panel, with a deliberately customized **7200 RPM redline**.

## Visual specification
- 180 MPH US speedometer, 0–9000 RPM tachometer, original BMW E46 M3 dial geometry and typography.
- Black faces, fine white graduations, OEM red-orange needles, subtle amber night illumination.
- E46 M3-style variable-redline warm-up light segments integrated around the tachometer; cap the warm target at 7200 RPM rather than the stock S54 redline.
- OEM-positioned fuel and oil-temperature gauges and amber LCD windows.
- Distinguish cold-engine warm-up LEDs from the actual 7200 RPM limit; display an accurate, deterministic fallback if the required oil-temperature input is missing.
- Do not fake turn-signal or warning-lamp state: leave unsupported indicators dark.

## Functional requirements
- Reuse proven shared rendering primitives where possible, but create dedicated E46 layout, shaders, fonts, and signal interpolation rather than altering the E36 visual identity.
- Real vehicle speed, RPM, fuel and oil-temperature inputs where available; smooth needles, bounds and no-data fallbacks.
- Night/day theme with legible labels and gauge visibility.
- Initial cluster layout OFF; explicit E46 opt-in. Never run the E46 test app simultaneously with P3 Clusters or E36 test app.
- Independent app ID, settings namespace, icon and MGU Store listing.

## Acceptance gates
1. Confirm reference gauge geometry and indicator placement against reliable face-on OEM photos.
2. Generate and validate layout within 1920×720, including all assets and toggle conditions.
3. Unit-test the 7200 RPM limit, warm-up LED behavior, needle bounds, unsupported sensor fallbacks, and layout data.
4. Run bench/WebGL rendering tests and review day/night screenshots.
5. Verify packaging on a compatible SDK or via MGU Store before recommending on-car use.

The existing E36 and production apps must remain unchanged. Development stays on branch `feature/e46-m3-cluster-test` until reviewed.
