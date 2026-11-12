// Render the whole Freedom at the reference sheet's scale (sheet x3 = 79 px/m) from the sheet's six angles.
// usage: node gridview.mjs <outdir> [t=0.5]
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {CHROMIUM, CHROMIUM_ARGS, DIST, playwright} from '/Users/congt/workspace/octopus-teardown/.claude/skills/teardown/paths.mjs';

const out = process.argv[2];
fs.mkdirSync(out, {recursive: true});
const {chromium} = playwright();
const browser = await chromium.launch({executablePath: CHROMIUM, args: CHROMIUM_ARGS});
const page = await browser.newPage({viewport: {width: 1600, height: 900}, deviceScaleFactor: 1});
page.on('pageerror', (e) => console.error('[page error]', e.message));
await page.addInitScript(() => { window.__CAPTURE = true; window.__SIM_CONFIG = {}; });
await page.goto(pathToFileURL(path.join(DIST, 'freedom-film.html')).href);
await page.waitForFunction(() => window.SIM && window.SIM.ready, null, {timeout: 60000});
await page.evaluate(() => window.SIM.render(0.5));
await page.waitForTimeout(400);
// name: [azimuth deg, width px, optional close-up {c:[x,y,z], pxm, w, h, el}]
const VIEWS = {front: [0, 990], left: [90, 600], right: [-90, 600], back: [180, 990], q: [35, 900], rq: [-145, 900],
  chest: [0, 0, {c: [0, 13.9, 1.2], pxm: 215, w: 920, h: 840, el: 0.3}],
  shoulder: [25, 0, {c: [3.3, 14.6, 0.3], pxm: 240, w: 860, h: 840, el: 0.12}],
  pack: [180, 0, {c: [0, 13.75, -1.0], pxm: 232, w: 1220, h: 840, el: 0.05}],
  foot: [-70, 0, {c: [-1.6, 1.3, 0.6], pxm: 190, w: 640, h: 640}],
  knee: [-35, 0, {c: [-1.5, 6.6, 0.4], pxm: 200, w: 640, h: 640}],
  legs: [0, 0, {c: [0, 4.4, 0], pxm: 150, w: 1100, h: 1400}],
  arm: [0, 0, {c: [4.2, 11.2, 0], pxm: 190, w: 700, h: 1300}],
};
const only = process.argv[3] ? process.argv[3].split(',') : Object.keys(VIEWS).slice(0, 6);
for (const name of only) {
  const [az, w, cu] = VIEWS[name];
  const url = await page.evaluate(([az, w, cu]) => {
    const st = window.SUIT;
    const W = cu ? cu.w : w, H = cu ? cu.h : 1500, PXM = cu ? cu.pxm : 79;
    st.resize(W, H, 1);
    st.frame(0, {tx: 0, ty: 1.6, tz: 0, az: 0, el: 0, d: 1}, {ps: 1, lift: 0});
    st.scene.traverse((o) => { if (o.isLine && !o.isLineSegments) o.visible = false; });
    const V3 = st.camera.position.constructor;
    st.scene.fog = null;
    const K = st.robot.group.scale.x;
    const c = (cu ? new V3(...cu.c) : new V3(0, 9.09, 0)).multiplyScalar(K);
    st.camera.fov = 3.2;
    st.camera.far = 8000;
    const D = K * H / PXM / 2 / Math.tan((st.camera.fov / 2) * Math.PI / 180);
    const a = (az * Math.PI) / 180, el = (cu && cu.el) || 0;
    st.camera.position.set(c.x + Math.sin(a) * Math.cos(el) * D, c.y + Math.sin(el) * D, c.z + Math.cos(a) * Math.cos(el) * D);
    st.camera.up.set(0, 1, 0);
    st.camera.lookAt(c);
    st.camera.clearViewOffset();
    st.camera.aspect = W / H;
    st.camera.updateProjectionMatrix();
    st.camera.updateMatrixWorld();
    st.composer.render();
    return st.renderer.domElement.toDataURL('image/png');
  }, [az, w, cu]);
  fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(url.split(',')[1], 'base64'));
}
await browser.close();
console.log('ok', out);
