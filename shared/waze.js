'use strict';
/**
 * waze.js - "Show Waze map inside the theme" (Cluster Themes, page.js Map tab).
 *
 * robertnisipeanu's waze-on-cluster draws the phone's map on cluster-render's "map" target by default: the KOMBI
 * slot UNDER BMW's gauges, so BMW's own map-view readouts always sit over it and a see-through hole in a theme
 * shows them too. Since waze-on-cluster 0.14.5 (with a cluster-render release after 0.8.1) a theme that draws the
 * panel with layers HOSTS the map instead (cluster-render PROTOCOL.md "Hosting from layers"): hud.js _mapHost sends
 * {"op":"host","into":"panel","target":"map",x,y,w,h,src_*} on the connection whose backdrop has the map window,
 * waze-on-cluster then draws the map in that rect just under our frame and readouts, and reports target "panel".
 * The old {"cmd":"start","target":"panel"} on its control socket is gone (an unknown command now), so nothing is
 * sent there: that socket belongs to the Waze app's page.
 *
 * What this does (and nothing else):
 *  - reads waze-on-cluster's status file (/run/waze-on-cluster/status.json, 0644, rewritten about once a second:
 *    { state: idle|starting|showing|frozen|error|unsupported, target, reason, ... }) every second;
 *  - says "up" while the map is wanted and showing on the panel, held HOLD_MS through a short drop (a rebuild of
 *    our layers lets go of the host for a moment: without the hold, the map leaving would rebuild us, the rebuild
 *    would bring it back, and round again).
 * Facts from the waze-on-cluster 0.14.10 source (map_feed.cpp, main.cpp, control.cpp), read Nov 23 2026.
 * Plain Node 8 (the car's 8.16.2).
 */
const fs = require('fs');

const STATUS_PATH = '/run/waze-on-cluster/status.json';
const POLL_MS = 1000;
const STALE_MS = 10000;          // a status file older than this: the service isn't running
const HOLD_MS = 5000;            // "up" stays on this long through a drop of the map

class Waze {
    /**
     * opts: { status }; env WAZE_STATUS overrides the path (the bench's fake).
     * onChange(): called when "up" (the map is showing inside the theme) or the page's status text changes.
     */
    constructor(opts, log, onChange) {
        opts = opts || {};
        this.statusPath = process.env.WAZE_STATUS || opts.status || STATUS_PATH;
        this.log = log;
        this.onChange = onChange || (() => {});
        this.wanted = false;
        this.st = null;              // the last status read: { state, target, reason } or null (no file / stale)
        this.up = false;             // the map is showing on the panel (held through short drops)
        this.downSince = 0;          // when the map last left while "up" was on
        this.hostNote = null;        // from hud.js: why our host isn't live (cluster-render's "hosting" reason), or null
        this.lastText = null;
    }

    start() {
        this.timer = setInterval(() => this._poll(), POLL_MS);
        this._poll();
    }

    stop() { clearInterval(this.timer); }

    /** Whether the theme hosts the map now (the setting, and a layout with a map window). */
    want(on) {
        on = on === true;
        if (on === this.wanted) return;
        this.wanted = on;
        this._update(this.st);
    }

    /** hud.js: cluster-render's word on our host (null: live, or none sent). */
    note(text) {
        if (text === this.hostNote) return;
        this.hostNote = text;
        this._update(this.st);
    }

    /** For the page: { text, up, ok } (ok: false when something is wrong). */
    info() {
        const s = this.st;
        if (!s) return { text: 'Waze on Cluster isn\'t running', up: false, ok: false };
        if (s.state === 'unsupported') return { text: 'Waze on Cluster: this car isn\'t supported', up: false, ok: false };
        if (!this.wanted) return { text: 'Off. Waze shows the map in BMW\'s own map view', up: false, ok: true };
        if (this.hostNote) return { text: this.hostNote, up: false, ok: false };
        if (s.target === 'panel' && s.state === 'showing') return { text: 'Map showing in the theme', up: true, ok: true };
        if (s.state === 'frozen') return { text: 'Map frozen, waiting for the phone', up: false, ok: false };
        if (s.state === 'error') return { text: 'Waze on Cluster reports an error' + (s.reason ? ' (' + s.reason + ')' : ''), up: false, ok: false };
        if (s.target !== 'panel') return { text: 'Waiting for Waze to move its map into the theme' + (s.reason ? ' (' + s.reason + ')' : ''), up: false, ok: true };
        return { text: 'Waiting for the map' + (s.reason ? ' (' + s.reason + ')' : ''), up: false, ok: true };
    }

    _poll() {
        fs.stat(this.statusPath, (err, st) => {
            if (err || Date.now() - st.mtime.getTime() > STALE_MS) return this._update(null);
            fs.readFile(this.statusPath, 'utf8', (e, txt) => {
                let s = null;
                try {
                    if (!e) {
                        const j = JSON.parse(txt);
                        s = { state: String(j.state || ''), target: j.target == null ? null : String(j.target), reason: j.reason ? String(j.reason) : '' };
                    }
                } catch (x) { s = null; }
                this._update(s);
            });
        });
    }

    _update(s) {
        this.st = s;
        const now = Date.now();
        const raw = !!(this.wanted && s && s.target === 'panel' && s.state === 'showing');
        let up = this.up;
        if (raw) { up = true; this.downSince = 0; }
        else if (!this.wanted) { up = false; this.downSince = 0; }
        else if (up) {
            if (!this.downSince) this.downSince = now;
            if (now - this.downSince >= HOLD_MS) { up = false; this.downSince = 0; }
        }
        const text = this.info().text;
        const changed = up !== this.up || text !== this.lastText;
        if (up !== this.up) this.log.info('waze: map ' + (up ? 'showing in the theme' : 'gone from the theme') + ' (' + text + ')');
        this.up = up;
        this.lastText = text;
        if (changed) this.onChange();
    }
}

module.exports = Waze;
