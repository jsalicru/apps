'use strict';
/**
 * Cluster Themes: redraws the iDrive 7 instrument cluster (the 1920x720 "panel" target) through cluster-render.
 *
 * The center screen is the app's own page (shared/page.js, a canvas screen): the themes with their
 * pictures, which drive mode shows which, and the settings. Each choice is saved in the app's data/settings.json
 * by the kit; the shared engine (hud.js) listens and redraws at once. It keeps running after the page is
 * closed (OAP apps stay up in the background), so the page is only needed for changes. The kit's own
 * settings list stays one tap away (the bar's All settings).
 */
const mgu = require('./kit/mgu');
const HudApp = require('./hud');
const Page = require('./page');

const fs = require('fs');
const path = require('path');

/**
 * One drawing on the cluster at a time (autostart, 0.22.0): each process that starts the drawing writes its pid to
 * data/running.json; an older one that sees a newer pid there stops drawing and stays idle (it never exits on its own:
 * an unexpected exit counts as a crash on the car). Covers the head unit starting a second copy when the app is opened
 * from the menu while the power-up copy still runs.
 */
function claimCluster(ctx, hud) {
    const file = path.join(ctx.dataDir, 'running.json');
    try { fs.writeFileSync(file, JSON.stringify({ pid: process.pid, at: Date.now() })); } catch (e) { ctx.log.warn('running.json: ' + e); return; }
    const t = setInterval(() => {
        try {
            const o = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (o && o.pid && o.pid !== process.pid) {
                ctx.log.info('a newer copy of the app (pid ' + o.pid + ') draws the cluster now: this one stops drawing');
                clearInterval(t);
                try { hud.stop(); } catch (e) { /* stopping anyway */ }
            }
        } catch (e) { /* no file for a moment: next time */ }
    }, 2000);
}

/** The cluster drawing: made and started once per process, whether the app started with its page or without. */
function startHud(ctx) {
    try {
        const hud = new HudApp(ctx);
        hud.start();
        claimCluster(ctx, hud);
        process.on('exit', () => { try { hud.stop(); } catch (e) { /* exiting anyway */ } });
        return hud;
    } catch (e) {
        // nothing drawn, but stay up: an exit here would count as a crash on the car
        ctx.log.error('Cluster failed to start: ' + (e && e.stack || e));
        return null;
    }
}

mgu.run({
    // app.json "autostart": the head unit starts the app at power-up without its page; the cluster is drawn from then on
    // (0.22.0). The same runs when the app is opened from the menu; start() then puts the page on that drawing.
    background(bg) {
        return startHud(bg);
    },
    start(ctx) {
        const hud = ctx.background || startHud(ctx);
        if (!hud) return;
        new Page(ctx, hud, {
            title: ctx.spec.title, what: 'cluster',
            look: { name: 'Themes', style: 'hero', tags: { e46test2: 'E46 M3 · orange', e36: '328i · 90s', sweep: 'rev sweep · map', dyno: 'safety tiles', ribbon: 'calm · holidays', apex: 'needle dash · G-meter' } },
            tabs: ['look', 'readouts', 'badge', 'map', 'alerts', 'gmeter', 'settings'],
            // the Settings tab lists these only while Apex is on the cluster (shared/page.js); not listed: every theme
            settingThemes: {
                tempUnits: ['apex'], pressureUnits: ['apex'], shiftLight: ['apex'], backdrops: ['apex'], apexBackdrop: ['apex'], apexDial: ['apex'], apexFont: ['apex'], tachStyle: ['apex'], apexZones: ['apex'], tachResponse: ['apex'],
                gearStyle: ['apex'], gearSource: ['apex'], tachSpeed: ['apex'], readingsCheck: ['apex'], dialGlow: ['apex'], leftStyle: ['apex'],
                leftTop: ['apex'], leftBottom: ['apex'], gaugeFill: ['apex'], rightPanel: ['apex'],
            },
            settings: ['units', 'tempUnits', 'pressureUnits', 'clock', 'timeZone', 'tankLitres', 'redline', 'shiftBefore', 'coldGuard', 'showBoost', 'gearGap', 'sweepColor', 'revScale', 'sweepCenter', 'intakeBar', 'showEthanol', 'shiftFlash', 'shiftLight', 'nightDim', 'smoothRevs', 'backdrops', 'apexBackdrop', 'apexDial', 'apexFont', 'tachStyle', 'apexZones', 'tachResponse', 'gearStyle', 'gearSource', 'tachSpeed', 'readingsCheck', 'dialGlow', 'leftStyle', 'leftTop', 'leftBottom', 'gaugeFill', 'rightPanel', 'cameraNotch', 'holiday', 'demo'],
            // the drive mode check's candidates this app's app.json listens to (issue #8; shared/hud.js modeDiagLines)
            modeCheck: ['HMI', 'MDrive', 'Engine', 'Sport2'],
        }).start();
    },
});
