'use strict';
/**
 * art_probe.js - looks for where the head unit keeps album art (jsalicru, Nov 28 2026: "import album art like OEM").
 *
 * Read-only discovery, nothing on the car is changed. Two looks, both written to <data>/art-probe.txt (and a short line
 * each in the app's log):
 *
 * 1. Once per app start: the unit's SOME/IP catalog (/etc/oap/someip/someip-interfaces.json, the file the installer
 *    generates our interfaces from). Every interface whose name or members mention cover / art / album / image /
 *    picture / thumbnail is listed, and all of HmiMediaState's members, so we know whether the cover can be asked for.
 * 2. On each of the first MAX_TRACKS new songs (title changes while playing), a few seconds later: a walk of the places a
 *    Linux head unit keeps temporary and cached files, listing image files written in the last WINDOW_S seconds and
 *    any file whose path mentions cover / art / album. The walk is bounded (depth, entries, time) and yields often, so it
 *    can't stall the cluster.
 *
 * Node 8 (the car's): callbacks wrapped with util.promisify, no newer syntax.
 */
const fs = require('fs');
const path = require('path');
const util = require('util');

const readdir = util.promisify(fs.readdir), lstat = util.promisify(fs.lstat), readFile = util.promisify(fs.readFile);
const CATALOG = '/etc/oap/someip/someip-interfaces.json';
const ROOTS = ['/tmp', '/var/tmp', '/run', '/var/run', '/var/cache', '/var/opt', '/var/lib', '/var/volatile', '/data',
    '/persistence', '/mnt', '/media', '/opt/bmw', '/opt/car', '/var/app', '/var/data', '/userdata'];
const SKIP = /^\/(proc|sys|dev)(\/|$)/;
const ARTWORD = /cover|artwork|albumart|album_art|album-art|thumbnail|thumb|picture|bitmap|\bart\b|_art|art_|image/i;
const IMG_EXT = /\.(jpe?g|png|bmp|webp|gif|jfif|tiff?|raw|rgba?|argb)$/i;
const WINDOW_S = 45;            // "just written": modified this many seconds before the walk
const MAX_TRACKS = 4;           // walks per app start
const MAX_ENTRIES = 60000, MAX_DEPTH = 9, MAX_MS = 20000, MAX_HITS = 60;

class ArtProbe {
    constructor(log, dataDir) {
        this.log = log;
        this.out = path.join(dataDir || process.cwd(), 'art-probe.txt');
        this.tracks = 0;
        this.busy = false;
        this.lastTitle = '';
        try { fs.writeFileSync(this.out, new Date().toISOString() + ' album art probe started (app start)\n'); } catch (e) { this.out = null; }
        setTimeout(() => this._catalog().catch((e) => this._note('catalog: ' + e)), 15000);
    }

    _write(s) { if (this.out) try { fs.appendFileSync(this.out, s + '\n'); } catch (e) { /* read-only */ } }
    _note(s) { this.log.info('art probe: ' + s); this._write(new Date().toISOString() + ' ' + s); }

    /** A new song (title / artist changed while playing): walk once, a few seconds on, for the first MAX_TRACKS. */
    track(title, artist) {
        if (!title || title === this.lastTitle) return;
        this.lastTitle = title;
        if (this.tracks >= MAX_TRACKS || this.busy) return;
        this.tracks++;
        const n = this.tracks;
        setTimeout(() => this._walk(n, title, artist).catch((e) => this._note('walk: ' + e)), 6000);
    }

    /** Raw media values the head unit sends: their keys and anything art-like (first few of each kind). */
    raw(kind, v) {
        this.rawSeen = this.rawSeen || {};
        const k = this.rawSeen[kind] = (this.rawSeen[kind] || 0) + 1;
        if (k > 3) return;
        let s;
        try { s = JSON.stringify(v); } catch (e) { s = String(v); }
        this._write(new Date().toISOString() + ' media ' + kind + ' #' + k + ' keys ' + Object.keys(v || {}).join(',') + ': ' + s.slice(0, 2000));
    }

    async _catalog() {
        let txt;
        try { txt = await readFile(CATALOG, 'utf8'); } catch (e) { this._note('catalog not readable (' + e.code + ')'); return; }
        let cat;
        try { cat = JSON.parse(txt); } catch (e) { this._note('catalog not JSON, ' + txt.length + ' bytes'); return; }
        // whatever its layout: find every object with a name that looks like an interface, and the member names inside
        const hits = [];
        let media = null, count = 0;
        const names = (o, acc, depth) => {
            if (!o || typeof o !== 'object' || depth > 8 || acc.length > 4000) return acc;
            if (Array.isArray(o)) { o.forEach((x) => names(x, acc, depth + 1)); return acc; }
            Object.keys(o).forEach((k) => {
                const v = o[k];
                if ((k === 'name' || k === 'Name') && typeof v === 'string') acc.push(v);
                else if (v && typeof v === 'object') { if (!Array.isArray(o) && /^[A-Za-z_][\w]*$/.test(k) && depth > 0) acc.push(k); names(v, acc, depth + 1); }
            });
            return acc;
        };
        const walkIf = (o, key, depth) => {
            if (!o || typeof o !== 'object' || depth > 4) return;
            if (Array.isArray(o)) { o.forEach((x, i) => walkIf(x, key, depth + 1)); return; }
            Object.keys(o).forEach((k) => {
                const v = o[k];
                const ifName = /^(de|com)\.bmw/.test(k) ? k : (v && typeof v === 'object' && typeof v.name === 'string' && /^(de|com)\.bmw/.test(v.name) ? v.name : null);
                if (ifName && v && typeof v === 'object') {
                    count++;
                    const mem = names(v, [], 0).filter((x) => x !== ifName);
                    if (/hmimediastate/i.test(ifName)) media = { ifName, mem };
                    const art = mem.filter((x) => ARTWORD.test(x));
                    if (ARTWORD.test(ifName) || art.length) hits.push(ifName + ': ' + (art.length ? art.slice(0, 40).join(', ') : '(name)'));
                } else walkIf(v, key, depth + 1);
            });
        };
        walkIf(cat, null, 0);
        this._note('catalog: ' + count + ' interfaces, ' + hits.length + ' mention art / cover / image');
        this._write('--- interfaces mentioning art / cover / album / image ---\n' + (hits.join('\n') || '(none)'));
        this._write('--- HmiMediaState members ---\n' + (media ? media.ifName + ': ' + Array.from(new Set(media.mem)).join(', ') : '(not found in the catalog)'));
        if (!count) {
            // a layout this walk doesn't know: keep the lines around the words instead
            const lines = txt.split(/\n/).filter((l) => ARTWORD.test(l) || /hmimediastate/i.test(l)).slice(0, 200);
            this._write('--- catalog lines mentioning art / media (layout not recognised) ---\n' + lines.join('\n'));
        }
    }

    async _walk(n, title, artist) {
        this.busy = true;
        const t0 = Date.now(), since = t0 - WINDOW_S * 1000;
        let entries = 0, denied = 0, stopped = '';
        const fresh = [], named = [];
        const visit = async (dir, depth) => {
            if (stopped || SKIP.test(dir)) return;
            let list;
            try { list = await readdir(dir); } catch (e) { denied++; return; }
            for (const f of list) {
                if (stopped) return;
                if (++entries > MAX_ENTRIES) { stopped = 'entry limit'; return; }
                if (Date.now() - t0 > MAX_MS) { stopped = 'time limit'; return; }
                if (entries % 200 === 0) await new Promise((r) => setImmediate(r));
                const p = path.join(dir, f);
                let st;
                try { st = await lstat(p); } catch (e) { continue; }
                if (st.isSymbolicLink()) continue;
                if (st.isDirectory()) { if (depth < MAX_DEPTH) await visit(p, depth + 1); continue; }
                if (!st.isFile()) continue;
                const recent = st.mtime.getTime() >= since, img = IMG_EXT.test(f);
                const line = p + '  ' + st.size + ' B  ' + st.mtime.toISOString();
                if (recent && (img || ARTWORD.test(p)) && fresh.length < MAX_HITS) fresh.push(line);
                else if (img && ARTWORD.test(p) && named.length < MAX_HITS) named.push(line);
            }
        };
        for (const r of ROOTS) await visit(r, 0);
        this.busy = false;
        this._note('song ' + n + ' ("' + String(title).slice(0, 40) + '"): ' + fresh.length + ' image files written in the last ' + WINDOW_S
            + ' s, ' + named.length + ' older ones named like art; ' + entries + ' entries in ' + (Date.now() - t0) + ' ms'
            + (denied ? ', ' + denied + ' folders not readable' : '') + (stopped ? ', stopped at the ' + stopped : ''));
        this._write('--- song ' + n + ': ' + title + ' / ' + artist + ' ---\nwritten just now:\n' + (fresh.join('\n') || '(none)')
            + '\nnamed like art (older):\n' + (named.join('\n') || '(none)'));
    }
}

module.exports = ArtProbe;
