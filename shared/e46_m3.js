'use strict';
/**
 * E46 M3 cluster calibration and LED state logic.
 * Pure, Node 8 compatible functions. Renderer integration is a separate step.
 *
 * LED order is low-RPM to high-RPM along the tachometer's INNER arc.
 * oilF must be an actual oil-temperature measurement in degrees Fahrenheit.
 */
const LED_COUNT = 7;
const REDLINE_RPM = 7200;
const SHIFT_START_RPM = 6000;
const WARM_START_F = 110;
const WARM_END_F = 160;
function finite(v) { return typeof v === 'number' && isFinite(v); }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

/** Map coolant temperature to the reference marks, expressed in dial fractions.
 * 170°F=first white mark, 210°F=middle white mark, 230°F=last white mark.
 * End stops are intentionally separate from the three calibration marks.
 */
function coolantFraction(f) {
    if (!finite(f)) return null;
    if (f <= 170) return clamp(0.25 + (f - 170) * 0.25 / 50, 0, 0.25);
    if (f <= 210) return 0.25 + (f - 170) * 0.25 / 40;
    if (f <= 230) return 0.5 + (f - 210) * 0.25 / 20;
    return clamp(0.75 + (f - 230) * 0.25 / 30, 0.75, 1);
}

/** Returns {mode, lights}, seven booleans in low-to-high RPM order.
 * Unknown oil temp never implies warm: no RPM shift mode without valid oil temp.
 * At exactly 160°F the final warm-up LED is still on; above 160°F shift mode begins.
 */
function tachLights(oilF, rpm) {
    let count, mode;
    if (!finite(oilF)) return {mode:'sensor-unavailable', lights: Array(LED_COUNT).fill(false)};
    if (oilF <= WARM_END_F) {
        mode = 'warmup';
        // 110F -> 7 LEDs, 160F -> 1 LED, extinguishing high-RPM end first.
        count = oilF <= WARM_START_F ? LED_COUNT :
            Math.max(1, LED_COUNT - Math.ceil((oilF - WARM_START_F) / (WARM_END_F - WARM_START_F) * (LED_COUNT - 1)));
    } else {
        mode = 'shift';
        count = !finite(rpm) || rpm < SHIFT_START_RPM ? 0 :
            clamp(Math.floor((rpm - SHIFT_START_RPM) / ((REDLINE_RPM - SHIFT_START_RPM) / (LED_COUNT - 1))) + 1, 0, LED_COUNT);
    }
    return {mode:mode, lights:Array.from({length:LED_COUNT}, (_, i) => i < count)};
}
module.exports = {LED_COUNT, REDLINE_RPM, SHIFT_START_RPM, coolantFraction, tachLights};
