// Deterministic size gate: poses the suit standing, measures each target group's world bounds in metres and checks
// them against targets.json. Exit 0 pass, 1 fail. Usage: node img2/freedom/size-gate.mjs [--json out.json]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../../.claude/skills/teardown/node_modules/playwright/index.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = JSON.parse(fs.readFileSync(path.join(HERE, 'targets.json'), 'utf8')).targets;
const b = await chromium.launch({args: ['--use-angle=metal']});
const p = await b.newPage({viewport: {width: 800, height: 450}});
await p.goto('file://' + path.resolve(HERE, '../../teardown-out/dist/freedom-film.html'));
await p.waitForFunction(() => window.SIM && window.SIM.ready, null, {timeout: 60000});
const SLICES = [...new Set(T.filter((t) => t.widthAtY !== undefined).map((t) => t.widthAtY))];
const groups = await p.evaluate((SLICES) => {
  const st = window.SUIT;
  st.frame(2.5, {tx: 0, ty: 0.9, tz: 0, az: 0, el: 0, d: 8}, {lift: 0, ps: 1});
  const g = st.robot.group;
  g.updateMatrixWorld(true);
  const box = () => ({min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9]});
  const G = {};
  const V = {};
  const add = (k, bb) => {
    G[k] ??= box();
    for (let i = 0; i < 3; i++) {
      G[k].min[i] = Math.min(G[k].min[i], ['x', 'y', 'z'].map((a) => bb.min[a])[i]);
      G[k].max[i] = Math.max(G[k].max[i], ['x', 'y', 'z'].map((a) => bb.max[a])[i]);
    }
  };
  // the shoulder line: z of the shoulder joints
  let shoulderZ = 0;
  g.traverse((o) => { if (o.name === 'shoulder') shoulderZ = o.getWorldPosition(new o.position.constructor()).z; });
  const named = new Set(['head', 'chest', 'waist', 'hip', 'knee', 'ankle', 'shoulder', 'elbow', 'wrist', 'pack', 'xiphias', 'neck']);
  g.traverse((o) => {
    if (!o.isMesh || o.material?.transparent) return;
    let vis = true;
    for (let q = o; q; q = q.parent) vis = vis && q.visible;
    if (!vis || !o.geometry.attributes.position) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    bb.min.multiplyScalar(10); bb.max.multiplyScalar(10);
    bb.min.z -= shoulderZ * 10; bb.max.z -= shoulderZ * 10;
    let bone = '';
    for (let q = o.parent; q; q = q.parent) if (named.has(q.name)) { bone = q.name; break; }
    let asm = o.userData.asm || '';
    for (let q = o; !asm && q; q = q.parent) asm = q.userData?.asm || '';
    const side = (bb.min.x + bb.max.x) / 2 > 0.3 ? '+' : (bb.min.x + bb.max.x) / 2 < -0.3 ? '-' : '0';
    // world vertices (metres, z from the shoulder line), sampled, for slice widths
    // every triangle edge crossing a slice height contributes its crossing point (exact slice, any tessellation)
    const P = o.geometry.attributes.position;
    const I = o.geometry.index;
    const n = I ? I.count : P.count;
    const W = [];
    const v = new o.position.constructor();
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); W.push([v.x * 10, v.y * 10, v.z * 10 - shoulderZ * 10]); }
    const pts = [];
    for (const Y of SLICES) {
      for (let t = 0; t < n; t += 3) {
        const ids = [0, 1, 2].map((k) => (I ? I.getX(t + k) : t + k));
        for (let e = 0; e < 3; e++) {
          const A = W[ids[e]];
          const B = W[ids[(e + 1) % 3]];
          if ((A[1] - Y) * (B[1] - Y) <= 0 && A[1] !== B[1]) {
            const k = (Y - A[1]) / (B[1] - A[1]);
            pts.push([A[0] + (B[0] - A[0]) * k, Y, A[2] + (B[2] - A[2]) * k]);
          }
        }
      }
    }
    const addPts = (k) => { (V[k] ??= []).push(...pts); };
    add('all', bb);
    if (asm) add(asm, bb), add(`${asm}:${side}`, bb), add(`${asm}@${bone}:${side}`, bb), addPts(asm), addPts(`${asm}:${side}`), addPts(`${asm}@${bone}:${side}`);
    add(`@${bone}:${side}`, bb);
    addPts(`@${bone}:${side}`);
    if (asm === 'skirt') add(bb.max.z > 1.2 ? 'skirt-front' : bb.min.z < -0.6 ? 'skirt-rear' : 'skirt-side', bb);
  });
  return {G, V};
}, SLICES);
const {G: groupsB, V: verts} = groups;
await b.close();
const out = [];
let fails = 0;
for (const t of T) {
  const B = groupsB[t.group];
  if (!B) { out.push({id: t.id, error: `no group ${t.group}`}); fails++; continue; }
  const m = {
    top: B.max[1], bottom: B.min[1], width: B.max[0] - B.min[0], depth: B.max[2] - B.min[2],
    front: B.max[2], back: B.min[2], centerX: Math.abs((B.min[0] + B.max[0]) / 2), centerZ: (B.min[2] + B.max[2]) / 2,
    outerX: Math.max(Math.abs(B.min[0]), Math.abs(B.max[0])),
  };
  if (t.widthAtY !== undefined && verts[t.group]) {
    // the x extent of the group's vertices within ±0.25 m of the slice height
    const xs = verts[t.group].filter((q) => Math.abs(q[1] - t.widthAtY) < 1e-6).map((q) => q[0]);
    if (xs.length) m.width = Math.max(...xs) - Math.min(...xs);
  }
  for (const [k, v] of Object.entries(t.check)) {
    const err = m[k] - v;
    const ok = Math.abs(err) <= t.tol;
    if (!ok) fails++;
    out.push({id: t.id, metric: k, target: v, measured: +m[k].toFixed(2), error: +err.toFixed(2), ok});
  }
}
const w = (s, n) => String(s).padEnd(n);
for (const r of out) console.log(r.error && r.metric === undefined ? `FAIL ${r.id}: ${r.error}` : `${r.ok ? ' ok ' : 'FAIL'} ${w(r.id, 20)} ${w(r.metric, 8)} target ${w(r.target, 6)} measured ${w(r.measured, 6)} err ${r.error > 0 ? '+' : ''}${r.error}`);
console.log(`${fails ? 'GATE FAIL' : 'GATE PASS'}: ${fails} of ${out.length} checks out of tolerance`);
const j = process.argv.indexOf('--json');
if (j > 0) fs.writeFileSync(process.argv[j + 1], JSON.stringify({checks: out, fails}, null, 1));
process.exit(fails ? 1 : 0);
