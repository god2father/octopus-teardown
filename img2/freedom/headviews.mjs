// Render the Freedom head at the reference close-up's scale (tile x3 = 1086x900, 388.5 px/m, eye line at y=570).
// usage: node headviews.mjs <outdir> [proj=1|0]
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {CHROMIUM, CHROMIUM_ARGS, DIST, playwright} from '/Users/congt/workspace/octopus-teardown/.claude/skills/teardown/paths.mjs';

const out = process.argv[2];
const proj = Number(process.argv[3] ?? 1);
fs.mkdirSync(out, {recursive: true});
const {chromium} = playwright();
const browser = await chromium.launch({executablePath: CHROMIUM, args: CHROMIUM_ARGS});
const page = await browser.newPage({viewport: {width: 1600, height: 900}, deviceScaleFactor: 1});
page.on('pageerror', (e) => console.error('[page error]', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()));
await page.addInitScript(() => { window.__CAPTURE = true; window.__SIM_CONFIG = {}; });
await page.goto(pathToFileURL(path.join(DIST, 'freedom-film.html')).href);
await page.waitForFunction(() => window.SIM && window.SIM.ready, null, {timeout: 60000});
await page.evaluate(() => window.SIM.render(0.5));
await page.waitForTimeout(400);
const VIEWS = {front: 0, q: 35, side: 90, rq: 140, back: 180, top: 0, low: 0};
for (const [name, az] of Object.entries(VIEWS)) {
  const url = await page.evaluate(([name, az, proj]) => {
    const st = window.SUIT;
    const W = 1086, H = 900, PXM = 388.5;
    st.resize(W, H, 1);
    st.frame(0, {tx: 0, ty: 1.6, tz: 0, az: 0, el: 0, d: 1}, {ps: 1, lift: 0});
    let head = null;
    st.robot.group.traverse((o) => { if (o.name === 'head') head = o; });
    if (!head) throw new Error('no head node');
    st.scene.traverse((o) => { const u = o.material && o.material.userData; });
    head.updateWorldMatrix(true, false);
    const V3 = st.camera.position.constructor;
    const c = head.localToWorld(new V3(0, 0.309, 0));
    st.camera.fov = 3.2; // a long lens: the reference tiles are near-orthographic
    st.camera.far = 4000;
    const D = 0.1 * H / PXM / 2 / Math.tan((st.camera.fov / 2) * Math.PI / 180);
    const el = name === 'top' ? 0.6 : name === 'low' ? -0.45 : 0;
    const a = (az * Math.PI) / 180;
    const dir = new V3(Math.sin(a) * Math.cos(el), Math.sin(el), Math.cos(a) * Math.cos(el));
    const q = head.getWorldQuaternion(new head.quaternion.constructor());
    dir.applyQuaternion(q);
    st.camera.position.copy(c).addScaledVector(dir, D);
    st.camera.up.set(0, 1, 0);
    st.camera.lookAt(c);
    st.camera.clearViewOffset();
    st.camera.aspect = W / H;
    st.camera.updateProjectionMatrix();
    st.camera.updateMatrixWorld();
    if (window.__HEADPROJ) window.__HEADPROJ.uProj.value = proj;
    st.composer.render();
    return st.renderer.domElement.toDataURL('image/png');
  }, [name, az, proj]);
  fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(url.split(',')[1], 'base64'));
}
await browser.close();
console.log('ok', out);
