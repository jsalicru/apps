# E36 Cluster Test — experimental

This is a **separate app** to try the E36 instrument-cluster theme without replacing P3 Clusters. The branch is **feature/e36-test-app** and the app ID is `e36_cluster_test`.

## Install with MGU Store

1. Park the vehicle, keep it on stable power, and ensure the MGU Store has internet.
2. Make sure **cluster-render** is installed (version 0.5.1 or newer is recommended by the repository).
3. Open **MGU Store → Settings → Add source**.
4. Enter `jsalicru/apps` (or `https://github.com/jsalicru/apps`).
5. When asked what to follow, select **Branches → feature/e36-test-app**. Do **not** select `main` for this test.
6. Refresh the source, find **E36 Cluster Test**, and install **only that app**. Do not update/reinstall P3 Clusters from the test branch.
7. Open **E36 Cluster Test** from the apps menu. Its initial layout is **Off**.
8. Stop/disable the existing P3 Clusters app before enabling E36 in the test app; both use the same cluster-render output. Set the E36 test app's layout to **E36 (test)** only while parked.

## Returning to the original cluster

Set **E36 Cluster Test → Layout → Off**. Stop/disable the test app before restarting P3 Clusters. If needed, uninstall E36 Cluster Test in MGU Store. The original P3 Clusters app is not replaced by this test app.

## Validation and limitations

- GitHub Actions: 36/36 E36 unit tests pass, and app manifest/layout/font checks pass.
- The package build on GitHub is intentionally skipped because the proprietary `oap-sdk/` is not checked in. MGU Store is expected to provide the on-car SDK when building from this repository, but the actual install has **not** been verified.
- This is **not a simulator**. When E36 is selected it draws on the real instrument cluster. Test while parked, preferably on a bench first. Never rely on experimental graphics for safety-critical indications.
- If the Store reports an install/build error, capture the exact message; do not attempt to repair the vehicle's stock software.

## Development

Run `node tools/test_e36.js` for unit tests, or `node bench/server.js e36_cluster_test` for a browser-based rendering bench on a computer.
