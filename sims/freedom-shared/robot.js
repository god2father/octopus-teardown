// Freedom, the geometry. All of it from code, in metres (the stage scales the suit by SPEC.scale). The parts follow
// a model kit's breakdown: head unit, core block (chest, cockpit hatch, reactor), waist and five skirts, arms with
// shoulder blocks, legs with knee guards, the backpack with ten wings on two binders, two plasma cannons, two rail
// cannons, the beam rifle and the shield. Under the armor runs a grey inner frame with joint drums and pistons, and
// power lines from the reactor to every consumer. Bones are a hierarchy (mirrored for the right side); armor
// pieces ride their bone and carry a teardown direction, so the exploded view is one function of one number.
import * as THREE from 'three';
import {rng} from 'teardown-kit/util.js';
import {machineAt, poseAt, SPEC} from './kin.js';

const V3 = THREE.Vector3;
const PI = Math.PI;
export const COLORS = {white: '#d9dadc', grey: '#b4b7bb', navy: '#2b335c', blue: '#2e54b6', red: '#c3232c', yellow: '#e2b21f', dark: '#3a3d43', frame: '#55595f', ink: '#22252b'};
const PS_OFF = {white: '#83868b', grey: '#6f7277', navy: '#5d6066', blue: '#686b71', red: '#5c5f64', yellow: '#76797e', dark: '#3a3d42'};

const ss = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// ------------------------------------------------------------ geometry helpers
/** a hard-surface block: every one of its 12 edges cut by a flat chamfer of c metres */
function rbox(w, h, d, r = 0.06) {
  const c = Math.min(r, w / 2.4, h / 2.4, d / 2.4);
  const x = w / 2 - c;
  const y = h / 2 - c;
  const s = new THREE.Shape([new THREE.Vector2(-x, -y), new THREE.Vector2(x, -y), new THREE.Vector2(x, y), new THREE.Vector2(-x, y)]);
  const g = new THREE.ExtrudeGeometry(s, {depth: Math.max(0.001, d - 2 * c), bevelEnabled: true, bevelThickness: c, bevelSize: c, bevelSegments: 1});
  g.translate(0, 0, -(d - 2 * c) / 2);
  g.computeVertexNormals();
  return g;
}
/** taper a geometry along y: x and z scale from (bx, bz) at its bottom to (tx, tz) at its top; dz shears the top */
function taper(g, tx, tz, bx = 1, bz = 1, dz = 0) {
  g.computeBoundingBox();
  const {min, max} = g.boundingBox;
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = (p.getY(i) - min.y) / (max.y - min.y || 1);
    p.setX(i, p.getX(i) * (bx + (tx - bx) * k));
    p.setZ(i, p.getZ(i) * (bz + (tz - bz) * k) + dz * k);
  }
  g.computeVertexNormals();
  return g;
}
/** a flat polygon (x, y) extruded along z, centred on z = 0 */
function prism(pts, depth, bevel = 0.03) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, {depth: Math.max(0.001, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 8});
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  g.computeVertexNormals();
  return g;
}
/** a limb shell: side profile [z, y] extruded across x (width w), its 12-ish edges chamfered */
const hull = (pts, w, bevel = 0.08) => prism(pts, w, bevel).rotateY(-PI / 2);
/** the red toe: x narrows toward the tip, 2.1 m wide at the ankle and about 1.45 m at the point */
function narrowToe(g) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (1 - 0.3 * Math.min(1, Math.max(0, (p.getZ(i) - 0.7) / 2.5))));
  g.computeVertexNormals();
  return g;
}
/** a simple polygon inset by d: each vertex moves inward along its corner bisector (convex-ish outlines) */
function inset(pts, d) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  const sgn = a > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const q = pts[(i + pts.length - 1) % pts.length];
    const r = pts[(i + 1) % pts.length];
    const n = (ax, ay, bx, by) => {
      const l = Math.hypot(bx - ax, by - ay) || 1;
      return [(-(by - ay) / l) * sgn, ((bx - ax) / l) * sgn];
    };
    const [n1x, n1y] = n(q[0], q[1], p[0], p[1]);
    const [n2x, n2y] = n(p[0], p[1], r[0], r[1]);
    let bx = n1x + n2x;
    let by = n1y + n2y;
    const bl = Math.hypot(bx, by) || 1;
    bx /= bl;
    by /= bl;
    const k = d / Math.max(0.35, bx * n1x + by * n1y);
    return [p[0] + bx * k, p[1] + by * k];
  });
}
const cyl = (r0, r1, h, seg = 20) => new THREE.CylinderGeometry(r1, r0, h, seg);
const cylX = (r, h, seg = 20) => new THREE.CylinderGeometry(r, r, h, seg).rotateZ(PI / 2);
const cylZ = (r, h, seg = 20) => new THREE.CylinderGeometry(r, r, h, seg).rotateX(PI / 2);
const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

// a stripe texture for the power lines: bright dashes on a dim core, scrolled along the tube by the reactor's flow
function flowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 8;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 64, 0);
  gr.addColorStop(0, '#5a1a08');
  gr.addColorStop(0.55, '#ff6a2a');
  gr.addColorStop(0.7, '#ffd7a8');
  gr.addColorStop(0.85, '#ff6a2a');
  gr.addColorStop(1, '#5a1a08');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 8);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// One tile is TILE metres of armor: panel seams from a recursive split, rivet rows along some seams, hatches, fine
// scratches and scuffs. Three maps from one layout: colour (grime in the seams, wear), bump (engraved seams, raised
// rivets) and roughness (seams and scuffs rougher, polished wear lighter), so the paint reads as worked metal.
const TILE = 2.4;
function panelMaps(seed) {
  const N = 1024;
  const r = rng(seed);
  const mk = (fill) => {
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    g.fillStyle = fill;
    g.fillRect(0, 0, N, N);
    return [c, g];
  };
  const [cc, cg] = mk('#ffffff');
  const [bc, bg] = mk('#808080');
  const [rc, rg] = mk('#6e6e6e');
  // scuffs and wear first, under the seams
  for (let i = 0; i < 900; i++) {
    const x = r() * N;
    const y = r() * N;
    const a = r() * Math.PI;
    const l = 4 + r() * 40;
    const g = r();
    cg.strokeStyle = g < 0.7 ? `rgba(60,62,68,${0.04 + 0.08 * r()})` : `rgba(255,255,255,${0.2 * r()})`;
    rg.strokeStyle = g < 0.7 ? `rgba(160,160,160,${0.25 * r()})` : `rgba(60,60,60,${0.3 * r()})`;
    for (const [ctx, w] of [[cg, 0.6 + r() * 1.2], [rg, 1.5]]) {
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 70; i++) {
    const x = r() * N;
    const y = r() * N;
    const rr = 6 + r() * 30;
    const gr = cg.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, `rgba(70,72,78,${0.05 + 0.07 * r()})`);
    gr.addColorStop(1, 'rgba(70,72,78,0)');
    cg.fillStyle = gr;
    cg.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  // panel seams: split the tile recursively, engrave every cut
  const seams = [];
  const split = (x0, y0, x1, y1, d) => {
    const w = x1 - x0;
    const h = y1 - y0;
    if (d > 4 || (d > 1 && r() < 0.25) || Math.max(w, h) < 120) {
      if (w > 90 && h > 90 && r() < 0.35) {
        // a small hatch with its own frame and four rivets
        const m = 14 + r() * 12;
        seams.push([x0 + m, y0 + m, x1 - m, y0 + m], [x1 - m, y0 + m, x1 - m, y1 - m], [x1 - m, y1 - m, x0 + m, y1 - m], [x0 + m, y1 - m, x0 + m, y0 + m]);
        for (const [px, py] of [[x0 + m + 8, y0 + m + 8], [x1 - m - 8, y0 + m + 8], [x1 - m - 8, y1 - m - 8], [x0 + m + 8, y1 - m - 8]]) rivet(px, py);
      }
      return;
    }
    if (w > h ? r() < 0.8 : r() < 0.2) {
      const x = x0 + w * (0.3 + 0.4 * r());
      seams.push([x, y0, x, y1]);
      if (r() < 0.4) for (let y = y0 + 16; y < y1 - 10; y += 26) rivet(x + 9, y);
      split(x0, y0, x, y1, d + 1);
      split(x, y0, x1, y1, d + 1);
    } else {
      const y = y0 + h * (0.3 + 0.4 * r());
      seams.push([x0, y, x1, y]);
      if (r() < 0.4) for (let x = x0 + 16; x < x1 - 10; x += 26) rivet(x, y + 9);
      split(x0, y0, x1, y, d + 1);
      split(x0, y, x1, y1, d + 1);
    }
  };
  const rivets = [];
  function rivet(x, y) {
    rivets.push([x, y]);
  }
  seams.push([0, 0, N, 0], [0, 0, 0, N]);
  split(0, 0, N, N, 0);
  for (const [x0, y0, x1, y1] of seams) {
    for (const [ctx, col, w] of [[cg, 'rgba(38,40,46,.62)', 2.2], [bg, '#2a2a2a', 3.2], [rg, '#b4b4b4', 3]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    // a lit lip on one side of each seam
    cg.strokeStyle = 'rgba(255,255,255,.35)';
    cg.lineWidth = 1;
    cg.beginPath();
    cg.moveTo(x0 + 2, y0 + 2);
    cg.lineTo(x1 + 2, y1 + 2);
    cg.stroke();
  }
  for (const [x, y] of rivets) {
    cg.fillStyle = 'rgba(50,52,58,.55)';
    cg.beginPath();
    cg.arc(x, y, 3.6, 0, Math.PI * 2);
    cg.fill();
    cg.fillStyle = 'rgba(255,255,255,.5)';
    cg.beginPath();
    cg.arc(x - 1, y - 1, 1.3, 0, Math.PI * 2);
    cg.fill();
    bg.fillStyle = '#d8d8d8';
    bg.beginPath();
    bg.arc(x, y, 3.4, 0, Math.PI * 2);
    bg.fill();
  }
  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return {map: tex(cc, true), bump: tex(bc, false), rough: tex(rc, false)};
}
// machined frame metal: fine brushed streaks and a few tool marks
function brushedMaps(seed) {
  const N = 512;
  const r = rng(seed);
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#7a7a7a';
  g.fillRect(0, 0, N, N);
  for (let i = 0; i < 2600; i++) {
    const y = r() * N;
    const v = 90 + r() * 70;
    g.strokeStyle = `rgba(${v},${v},${v},.35)`;
    g.lineWidth = 0.6 + r();
    const x = r() * N;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 30 + r() * 160, y + (r() - 0.5) * 2);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
/** box-projected UVs in metres: each face takes the two axes its normal does not point along */
function boxUV(g, tile = TILE, off = 0) {
  const p = g.attributes.position;
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    let u;
    let v;
    if (ax >= ay && ax >= az) [u, v] = [p.getZ(i), p.getY(i)];
    else if (ay >= az) [u, v] = [p.getX(i), p.getZ(i)];
    else [u, v] = [p.getX(i), p.getY(i)];
    uv[i * 2] = u / tile + off;
    uv[i * 2 + 1] = v / tile + off * 0.7;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export function buildFreedom() {
  const R = rng(23);
  // metallic paint over metal: a satin lacquer (clearcoat) on a base with some metal in it, the panel maps on top
  const PM = panelMaps(41);
  const BR = brushedMaps(7);
  const paint = (color, o = {}) =>
    new THREE.MeshPhysicalMaterial({color, map: PM.map, bumpMap: PM.bump, bumpScale: 2.2, roughnessMap: PM.rough, roughness: 0.62, metalness: 0.32, clearcoat: 0.55, clearcoatRoughness: 0.22, envMapIntensity: 1.0, ...o});
  const metal = (color, o = {}) => new THREE.MeshPhysicalMaterial({color, roughness: 0.42, roughnessMap: BR, bumpMap: BR, bumpScale: 0.6, metalness: 1, envMapIntensity: 1.1, clearcoat: 0.2, clearcoatRoughness: 0.4, ...o});
  const M = {
    white: paint(COLORS.white, {roughness: 0.58}),
    grey: paint(COLORS.grey, {metalness: 0.6, roughness: 0.55}),
    navy: paint(COLORS.navy, {metalness: 0.45}),
    blue: paint(COLORS.blue, {metalness: 0.4}),
    red: paint(COLORS.red, {metalness: 0.38}),
    yellow: paint(COLORS.yellow, {metalness: 0.55, roughness: 0.42}),
    dark: paint(COLORS.dark, {metalness: 0.7, roughness: 0.6}),
    frame: metal('#72767d', {metalness: 0.55}),
    joint: metal('#686c74', {roughness: 0.55, metalness: 0.35}),
    steel: metal('#b9bec5', {roughness: 0.22, bumpScale: 0.3}),
        eye: new THREE.MeshBasicMaterial({color: '#ffc23a'}),
        pocket: new THREE.MeshStandardMaterial({color: '#2c2f35', roughness: 0.7, metalness: 0.4, envMapIntensity: 0.4}),
        lens: new THREE.MeshPhysicalMaterial({color: '#3f6f8f', roughness: 0.08, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6}),
    glow: new THREE.MeshBasicMaterial({color: '#ffcf8a'}),
    nozzle: new THREE.MeshBasicMaterial({color: '#bfe0ff'}),
    plume: new THREE.MeshBasicMaterial({color: '#9fc6ff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide}),
    beamCore: new THREE.MeshBasicMaterial({color: '#fff4fb', transparent: true, opacity: 1, depthWrite: false}),
    beamHalo: new THREE.MeshBasicMaterial({color: '#ff3d9a', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide}),
    railHalo: new THREE.MeshBasicMaterial({color: '#ffb52e', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide}),
    flash: new THREE.MeshBasicMaterial({color: '#ffd1ec', transparent: true, opacity: 0, depthWrite: false}),
    line: new THREE.MeshBasicMaterial({map: flowTexture(), transparent: true, opacity: 0, depthWrite: false}),
    core: new THREE.MeshStandardMaterial({color: '#ffb35c', emissive: '#ff8a2a', emissiveIntensity: 0.9, roughness: 0.3}),
    highlight: new THREE.MeshBasicMaterial({color: '#e5452a', transparent: true, opacity: 0, depthWrite: false}),
  };
  const ink = new THREE.LineBasicMaterial({color: COLORS.ink, transparent: true, opacity: 0.28});
  const PAINTS = ['white', 'grey', 'navy', 'blue', 'red', 'yellow', 'dark'];
  const BASE = Object.fromEntries(PAINTS.map((k) => [k, {m: M[k].metalness, r: M[k].roughness}]));
  const ON = Object.fromEntries(PAINTS.map((k) => [k, new THREE.Color(COLORS[k])]));
  const OFF = Object.fromEntries(PAINTS.map((k) => [k, new THREE.Color(PS_OFF[k])]));
  // the x-ray twins: the same paint as clear glass, swapped in while X-RAY is on
  const GLASS = Object.fromEntries(PAINTS.map((k) => [k, M[k].clone()]));
  for (const k of PAINTS) Object.assign(GLASS[k], {transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide});

  const group = new THREE.Group();
  const body = new THREE.Group(); // the pelvis: everything hangs from here
  group.add(body);

  const parts = []; // armor pieces that fly off in the teardown
  const armorMeshes = []; // {mesh, key} for the PS and x-ray material swaps
  const shadowy = (m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  /** an armor piece: painted mesh with an ink panel line, registered for the teardown */
  const armor = (geo, key, parent, pos, rot = [0, 0, 0], asm = 'armor', opt = {}) => {
    boxUV(geo, TILE, R());
    const m = shadowy(new THREE.Mesh(geo, M[key]));
    m.userData.asm = asm;
    m.position.set(...pos);
    m.rotation.set(...rot);
    if (opt.edges !== false) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, opt.edgeAngle ?? 32), ink));
    parent.add(m);
    if (PAINTS.includes(key)) armorMeshes.push({mesh: m, key});
    if (opt.reg !== false) parts.push({o: m, asm, home: {p: m.position.clone(), q: m.quaternion.clone()}, dist: opt.dist ?? 1.0, dir: null, spin: new V3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), ang: (opt.spin ?? 0.5) * (R() - 0.5) * 2, delay: R(), iso: new V3()});
    return m;
  };
  /** an inner-frame piece: grey metal on a bone, stays with the skeleton */
  const frame = (geo, parent, pos, rot = [0, 0, 0], mat = M.frame) => {
    if (mat === M.frame || mat === M.joint || mat === M.steel) boxUV(geo, 1.2, R());
    const m = shadowy(new THREE.Mesh(geo, mat));
    m.position.set(...pos);
    m.rotation.set(...rot);
    parent.add(m);
    return m;
  };
  const node = (parent, pos = [0, 0, 0], name = '') => {
    const g = new THREE.Group();
    g.position.set(...pos);
    g.name = name;
    parent.add(g);
    return g;
  };
  /** a recessed slot: a dark pocket sunk into a plate, optionally with n metal slats across it (a vent) */
  const slot = (parent, pos, w, h, rot = [0, 0, 0], n = 0, depth = 0.1) => {
    const g = node(parent, pos);
    g.rotation.set(...rot);
    frame(rbox(w, h, depth, 0.02), g, [0, 0, 0], [0, 0, 0], M.pocket);
    armor(rbox(w + 0.1, 0.05, depth + 0.04, 0.015), 'dark', g, [0, h / 2 + 0.02, 0], [0, 0, 0], 'detail', {reg: false, edges: false});
    armor(rbox(w + 0.1, 0.05, depth + 0.04, 0.015), 'dark', g, [0, -h / 2 - 0.02, 0], [0, 0, 0], 'detail', {reg: false, edges: false});
    for (let k = 0; k < n; k++) frame(rbox(w - 0.04, (h / n) * 0.34, depth + 0.05, 0.012), g, [0, -h / 2 + ((k + 0.5) * h) / n, 0.02], [0.5, 0, 0], M.steel);
    return g;
  };
  /** a hex bolt head standing proud of a plate */
  const boltGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.05, 6).rotateX(PI / 2);
  const bolt = (parent, x, y, z, rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(boltGeo, M.joint);
    m.position.set(x, y, z);
    m.rotation.set(...rot);
    parent.add(m);
    return m;
  };
  // hydraulic pistons across the joints: sleeve on one bone, rod on the other, re-aimed every frame
  const pistons = [];
  const piston = (A, a, B, b, r = 0.11) => {
    const sleeve = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12).translate(0, 0.5, 0), M.joint));
    const rod = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 1, 10).translate(0, 0.5, 0), M.steel));
    const eyeA = shadowy(new THREE.Mesh(new THREE.SphereGeometry(r * 1.3, 10, 8), M.frame));
    const eyeB = eyeA.clone();
    body.add(sleeve, rod, eyeA, eyeB);
    pistons.push({A, a: new V3(...a), B, b: new V3(...b), sleeve, rod, eyeA, eyeB});
  };

  // power lines: a glowing tube from a to b in a bone's frame
  const lines = [];
  const powerLine = (parent, a, b, r = 0.07) => {
    const curve = new THREE.LineCurve3(new V3(...a), new V3(...b));
    const len = new V3(...a).distanceTo(new V3(...b));
    const g = new THREE.TubeGeometry(curve, 2, r, 6, false);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len * 0.8);
    const m = new THREE.Mesh(g, M.line);
    m.renderOrder = 6;
    parent.add(m);
    lines.push(m);
    return m;
  };

  // Every size below is read off the reference sheet (reference/freedom/sheet.webp), front and side views, at
  // 1 px = 17.4 mm so the V-fin tips stand at 18.03 m: head 1.8 m, shoulders 8.6 m across and swept up at the
  // outer corner, waist 1.9 m, hip joint at 9.9 m, thigh 2.75 m, shin 5.15 m, ankle 2 m above a 4.8 m foot.
  // ============================================================ pelvis, skirts
  frame(rbox(1.9, 1.3, 1.5, 0.12), body, [0, 0, 0]);
  frame(cylX(0.5, 2.9, 24), body, [0, SPEC.hipY, 0], [0, 0, 0], M.joint); // the hip axle
  frame(cyl(0.55, 0.6, 1.5, 18), body, [0, 0.9, 0]); // spine up to the waist joint
  for (let b = 0; b < 10; b++) {
    const a = (b / 10) * PI * 2;
    frame(rbox(0.46, 0.3, 0.16, 0.03), body, [Math.sin(a) * 0.86, 1.2, Math.cos(a) * 0.7], [0, a, 0], M.joint); // belt
  }
  // the centre block between the front skirts: long, gunmetal, slotted, as on the reference
  frame(prism([[-0.4, 0.5], [0.4, 0.5], [0.44, -1.2], [-0.44, -1.2]], 0.6, 0.08), body, [0, 0, 0.72], [-0.06, 0, 0], M.frame);
  armor(prism([[-0.44, -1.2], [0.44, -1.2], [0.2, -1.95], [-0.2, -1.95]], 0.6, 0.08), 'dark', body, [0, 0, 0.72], [-0.06, 0, 0], 'waist', {dist: 1.2});
  slot(body, [0, -0.75, 1.05], 0.34, 0.7, [-0.06, 0, 0], 0, 0.08);
  const skirts = {};
  for (const s of [-1, 1]) {
    // front skirts: 3.2 m long plates hung from the waist, cut to a point at the lower outer corner
    const fs = armor(prism([[0, 0], [1.05, 0], [1.3, -1.4], [1.1, -2.7], [0.5, -2.95], [0, -2.1]].map(([x, y]) => [x * s, y]), 0.26, 0.07), 'white', body, [s * 0.42, 1.25, 0.86], [-0.34, 0, s * 0.05], 'skirt', {dist: 1.6});
    armor(prism([[0.12, -0.85], [0.95, -0.85], [1.12, -1.5], [0.98, -2.45], [0.5, -2.67], [0.12, -2.0]].map(([x, y]) => [x * s, y]), 0.12, 0.04), 'white', fs, [0, 0, 0.16], [0, s * 0.14, 0], 'skirt', {reg: false}); // raised lower layer, a second facet angled out
    armor(rbox(0.08, 2.09, 0.06, 0.02), 'white', fs, [s * 0.61, -1.825, 0.26], [0, 0, Math.atan2(0.98 * s, 1.85)], 'skirt', {reg: false, edges: false}); // ridge
    armor(rbox(0.3, 0.16, 0.06, 0.02), 'red', fs, [s * 0.62, -1.3, 0.25], [0, 0, 0], 'skirt', {reg: false, edges: false});
    for (const [bx, by] of [[0.15, -0.15], [0.92, -0.15], [1.0, -2.5]]) bolt(fs, s * bx, by, 0.14);
    // side skirts over the hips: they carry the rail cannon mounts
    skirts[s] = armor(prism([[-0.9, 0], [0.8, 0], [0.9, -1.4], [0.3, -2.5], [-0.6, -2.3], [-0.95, -1.2]], 0.3, 0.07).rotateY(-PI / 2), 'white', body, [s * 1.62, 1.35, -0.05], [0, 0, s * -0.1], 'skirt', {dist: 1.5});
    armor(prism([[-0.6, -0.2], [0.5, -0.2], [0.6, -1.2], [0.15, -2.0], [-0.4, -1.85], [-0.65, -1.0]], 0.15, 0.04).rotateY(-PI / 2), 'white', skirts[s], [s * 0.2, 0, 0], [0, 0, 0], 'skirt', {reg: false}); // raised inner panel
    armor(rbox(0.12, 0.4, 0.25, 0.03), 'red', skirts[s], [s * 0.32, -0.6, 0.35], [0, 0, 0], 'skirt', {reg: false, edges: false});
    slot(skirts[s], [s * 0.3, -0.6, -0.15], 0.3, 0.5, [0, s * PI / 2, 0], 0, 0.06);
  }
  // rear skirt: two panels in a V either side of a dark centre slot; a white rear-waist plate above them
  for (const s of [-1, 1]) armor(prism([[0.12, 0], [1.25, 0], [1.4, -1.5], [0.7, -3.0], [0.12, -2.6]].map(([x, y]) => [x * s, y]), 0.28, 0.07), 'white', body, [0, 1.2, -0.86], [0.3, 0, 0], 'skirt', {dist: 1.5});
  frame(rbox(0.22, 2.4, 0.2, 0.04), body, [0, 0.05, -0.98], [0.3, 0, 0], M.pocket);
  armor(rbox(1.8, 0.7, 0.3, 0.08), 'white', body, [0, SPEC.waistY + 0.3, -0.75], [0, 0, 0], 'waist', {dist: 1.3});

  // ============================================================ legs (built on the suit's left, +x; mirrored for the right)
  const legs = [];
  const jets = [];
  for (const s of [-1, 1]) {
    const side = node(body);
    side.scale.x = s;
    const hip = node(side, [SPEC.hipX, SPEC.hipY, 0], 'hip');
    frame(new THREE.SphereGeometry(0.62, 22, 14), hip, [0, 0, 0], [0, 0, 0], M.joint);
    frame(cyl(0.36, 0.42, SPEC.thigh - 0.5, 14), hip, [0, -SPEC.thigh / 2, 0]);
    // thigh: short and deep, most of it under the skirts
    armor(taper(hull(inset([[0.6, -0.5], [1.0, -1.1], [0.98, -2.2], [0.7, -2.65], [-0.7, -2.65], [-1.0, -2.0], [-0.95, -0.9], [-0.55, -0.5]], 0.08), 1.3, 0.2), 1.0, 1, 0.9, 1), 'white', hip, [0.02, 0, 0], [0, 0, 0], 'leg', {dist: 1.4});
    armor(prism([[-0.5, 0.75], [0.5, 0.75], [0.56, -0.2], [0.4, -0.95], [-0.4, -0.95], [-0.56, -0.2]], 0.22, 0.06), 'white', hip, [0.02, -1.55, 1.04], [0, 0, 0], 'leg', {dist: 1.6});
    frame(rbox(0.6, 0.9, 0.08, 0.02), hip, [0, -1.9, -1.14], [0, 0, 0], M.frame);
    for (const y of [-1.7, -2.1]) frame(rbox(0.4, 0.12, 0.06, 0.015), hip, [0, y, -1.19], [0, 0, 0], M.pocket);
    frame(rbox(0.5, 0.5, 0.3, 0.05), hip, [0, -2.45, -0.95], [0, 0, 0], M.frame);
    slot(hip, [0.78, -1.6, 0], 0.45, 0.7, [0, PI / 2, 0], 3, 0.08);
    const knee = node(hip, [0, -SPEC.thigh, 0], 'knee');
    frame(cylX(0.58, 1.3, 24), knee, [0, 0, 0], [0, 0, 0], M.joint);
    frame(rbox(0.9, 0.55, 0.5, 0.06), knee, [0, 0.15, 0.75], [0, 0, 0], M.joint); // the dark knee block the reference shows above the guard
    for (const kx of [-0.62, 0.62]) {
      frame(cylX(0.55, 0.24, 28), knee, [kx, 0, 0], [0, 0, 0], M.frame);
      frame(cylX(0.34, 0.06, 24), knee, [kx + Math.sign(kx) * 0.13, 0, 0], [0, 0, 0], M.steel);
      for (let b = 0; b < 6; b++) bolt(knee, kx + Math.sign(kx) * 0.12, Math.cos((b / 6) * PI * 2) * 0.45, Math.sin((b / 6) * PI * 2) * 0.45, [0, PI / 2, 0]);
    }
    frame(cyl(0.38, 0.34, SPEC.shin - 0.9, 14), knee, [0, -SPEC.shin / 2, 0]);
    // the knee guard, as on the reference front view and knee close-up: a long shield, narrow at the top, widest
    // (2.1 m) a third of the way down, pointed at the bottom; a raised faceted plate on its front with a long slot
    armor(taper(prism([[-0.42, 0.4], [0.42, 0.4], [0.82, -0.35], [0.88, -1.3], [0.6, -2.15], [0.16, -2.5], [-0.16, -2.5], [-0.6, -2.15], [-0.88, -1.3], [-0.82, -0.35]], 1.5, 0.18), 1, 0.8, 1, 0.9), 'white', knee, [0, 0, 0.12], [0, 0, 0], 'knee', {dist: 1.8});
    armor(prism([[-0.3, 0.2], [0.3, 0.2], [0.62, -0.35], [0.64, -1.25], [0.4, -2.0], [0, -2.32], [-0.4, -2.0], [-0.64, -1.25], [-0.62, -0.35]], 0.3, 0.06), 'white', knee, [0, 0, 0.87], [-0.03, 0, 0], 'knee', {dist: 2.0});
    slot(knee, [0, -1.1, 1.07], 0.3, 1.1, [-0.03, 0, 0], 0, 0.1);
    for (const [bx, by] of [[-0.48, -0.3], [0.48, -0.3], [-0.5, -1.25], [0.5, -1.25]]) bolt(knee, bx, by, 1.04);
    // the shin below it: narrower, the calf thruster behind
    armor(taper(hull([[0.35, -2.0], [0.32, -3.6], [0.85, -4.45], [-0.75, -4.45], [-0.6, -3.3], [-0.95, -2.0]], 0.95, 0.1), 1.0, 1, 1.15, 1), 'white', knee, [0, 0, 0], [0, 0, 0], 'leg', {dist: 1.5});
    slot(knee, [0.6, -3.0, -0.1], 0.5, 0.45, [0, PI / 2, 0], 3, 0.08);
    frame(rbox(0.5, 1.0, 0.1, 0.03), knee, [0, -3.6, -0.86], [0, 0, 0], M.pocket); // calf recess, slatted, a small nozzle under it
    for (const cy of [-3.25, -3.6, -3.95]) armor(rbox(0.42, 0.06, 0.08, 0.015), 'grey', knee, [0, cy, -0.89], [0, 0, 0], 'leg', {reg: false, edges: false});
    for (const cx of [-0.32, 0.32]) frame(rbox(0.1, 1.0, 0.12, 0.03), knee, [cx, -3.6, -0.86], [0, 0, 0], M.frame);
    frame(lathe([[0.12, 0], [0.2, 0], [0.24, -0.2], [0.2, -0.22]]), knee, [0, -4.15, -0.92], [0, 0, 0], M.frame);
    frame(cyl(0.12, 0.12, 0.18, 12), knee, [0, -4.25, -0.92], [0, 0, 0], M.pocket);
    frame(rbox(0.9, 0.6, 0.4, 0.06), knee, [0, 0.1, -0.75], [0, 0, 0], M.frame); // knee-back block
    const calfJet = frame(lathe([[0.0, 0], [0.24, 0], [0.36, -0.4], [0.3, -0.45]]), knee, [0, -4.0, -0.75], [0.35, 0, 0], M.joint);
    {
      const plume = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.4, 14, 1, true).translate(0, 1.2, 0).rotateX(PI), M.plume);
      plume.position.set(0, -4.4, -0.9);
      plume.rotation.x = 0.35;
      plume.renderOrder = 5;
      knee.add(plume);
      jets.push({plume});
    }
    const ankle = node(knee, [0, -SPEC.shin, 0], 'ankle');
    const foot = node(ankle); // the foot and ankle guard, drawn to a 2.0 m ankle, scaled to the measured one
    foot.scale.y = SPEC.ankle / 2.0;
    foot.rotation.y = 0.2; // toes turned out 12 degrees, as on the reference front view
    frame(new THREE.SphereGeometry(0.5, 18, 12), ankle, [0, 0, 0], [0, 0, 0], M.joint);
    frame(rbox(0.9, 0.8, 1.6, 0.08), foot, [0, -0.7, 0.2], [0, 0, 0], M.frame); // ankle block between the guards
    // ankle guard, from the reference side view and ankle close-up: a faceted collar band round the shin, a front
    // flap that drops to a downward V over the instep, splayed side plates and a rear flap over the heel
    armor(taper(hull([[0.95, 0.42], [1.12, -0.12], [-1.12, -0.12], [-0.95, 0.42]], 2.3, 0.08), 0.85, 1, 1, 1), 'white', foot, [0, 0, 0], [0, 0, 0], 'foot', {dist: 1.5}); // collar band
    armor(prism([[-1.05, 0.05], [1.05, 0.05], [1.02, -0.42], [0.2, -1.0], [-0.2, -1.0], [-1.02, -0.42]], 0.32, 0.06), 'white', foot, [0, -0.08, 1.1], [-0.38, 0, 0], 'foot', {dist: 1.6}); // front chevron flap
    armor(prism([[-0.75, -0.2], [0.75, -0.2], [0.68, -0.5], [0.12, -0.84], [-0.12, -0.84], [-0.68, -0.5]], 0.1, 0.03), 'white', foot, [0, -0.06, 1.3], [-0.38, 0, 0], 'foot', {reg: false}); // its raised inner facet
    for (const kx of [-1.0, 1.0]) armor(hull([[1.15, -0.05], [-1.05, -0.05], [-1.3, -0.4], [0.05, -1.12], [0.4, -1.12], [1.45, -0.45]], 0.24, 0.06), 'white', foot, [kx * 1.0, 0, 0], [0, 0, kx * 0.1], 'foot', {dist: 1.5}); // side plates
    for (const kx of [-1.0, 1.0]) armor(hull([[0.9, -0.3], [-0.8, -0.3], [-0.95, -0.42], [0.15, -0.95], [1.1, -0.55]], 0.08, 0.02), 'white', foot, [kx * 1.15, 0, 0], [0, 0, kx * 0.1], 'foot', {reg: false}); // raised facet
    armor(hull([[-0.55, 0.25], [-1.35, -0.15], [-1.5, -0.45], [-0.9, -0.75], [-0.5, -0.5]], 2.15, 0.08), 'white', foot, [0, 0, 0], [0, 0, 0], 'foot', {dist: 1.5}); // rear flap
    for (const [bx, by] of [[-0.85, -0.35], [0.85, -0.35]]) bolt(foot, bx, by, 1.32, [-0.38, 0, 0]);
    // the foot: a long red toe wedge whose top slopes from the ankle to the floor, a white instep plate along that
    // slope with a dark slot, a red heel block, gunmetal between them
    armor(narrowToe(hull([[0.5, -2.0], [2.8, -2.0], [2.8, -1.9], [0.6, -1.05], [0.5, -1.05]], 2.0, 0.08)), 'red', foot, [0, 0, 0], [0, 0, 0], 'foot', {dist: 1.4});
    armor(narrowToe(hull([[0.62, -0.9], [2.35, -1.6], [2.27, -1.76], [0.62, -1.06]], 1.45, 0.04)), 'white', foot, [0, 0, 0], [0, 0, 0], 'foot', {dist: 1.6}); // instep
    slot(foot, [0, -1.18, 1.35], 0.42, 0.55, [-1.17, 0, 0], 0, 0.06);
    for (const z of [1.0, 2.25]) bolt(foot, 0.85 - (z - 0.7) * 0.12, -1.38 - (z - 0.6) * 0.42, z, [0, PI / 2, 0]);
    armor(hull([[-1.6, -2.0], [-0.3, -2.0], [-0.3, -1.25], [-1.2, -1.15], [-1.6, -1.5]], 1.8, 0.08), 'red', foot, [0, 0, 0], [0, 0, 0], 'foot', {dist: 1.4}); // heel
    frame(rbox(1.4, 0.4, 0.9, 0.05), foot, [0, -1.8, 0.1], [0, 0, 0], M.joint); // the gunmetal sole bridge between heel and toe
    frame(cylX(0.32, 1.3, 20), foot, [0, -1.45, 0.1], [0, 0, 0], M.frame); // the ankle mechanism's drum
    frame(rbox(1.2, 0.5, 1.0, 0.06), foot, [0, -1.55, 0.25], [0, 0, 0], M.joint); // arch
    piston(knee, [0.36, -SPEC.shin + 1.4, 0.3], ankle, [0.36, -0.3, 0.55], 0.12);
    piston(knee, [-0.36, -SPEC.shin + 1.4, 0.3], ankle, [-0.36, -0.3, 0.55], 0.12);
    piston(hip, [0.36, -1.2, -0.5], knee, [0.36, -1.0, -0.6], 0.13);
    piston(hip, [-0.36, -1.2, -0.5], knee, [-0.36, -1.0, -0.6], 0.13);
    powerLine(hip, [-0.25, 0, 0.3], [-0.25, -SPEC.thigh, 0.3]);
    powerLine(knee, [-0.25, 0, -0.25], [-0.25, -SPEC.shin + 0.2, -0.25]);
    legs.push({s, side, hip, knee, ankle, calfJet});
  }

  // ============================================================ rail cannons (MMI-M15 Xiphias): 7.2 m grey rails hung off the hips
  const xiph = [];
  for (const s of [-1, 1]) {
    const side = node(body);
    side.scale.x = s;
    const splay = node(side, [1.72, 1.15, 0.0]);
    splay.rotation.set(0.28, 0, 0.24); // they hang 14 degrees out from the legs, as on the reference
    const pivot = node(splay, [0, 0, 0], 'xiphias');
    frame(cylX(0.42, 0.7, 22), pivot, [0.1, 0, 0], [0, 0, 0], M.frame);
    frame(cylX(0.26, 0.08, 18), pivot, [0.5, 0, 0], [0, 0, 0], M.steel);
    const arm = node(pivot, [0.2, 0, 0]);
    armor(rbox(0.5, 1.5, 0.95, 0.07), 'grey', arm, [0, -0.85, 0], [0, 0, 0], 'xiphias', {dist: 1.2}); // breech
    slot(arm, [0.26, -0.9, 0], 0.5, 0.7, [0, PI / 2, 0], 0, 0.06);
    armor(rbox(0.18, 0.5, 0.3, 0.03), 'red', arm, [0.29, -0.9, 0], [0, 0, 0], 'xiphias', {reg: false, edges: false});
    const fore = node(arm, [0, -1.6, 0], 'xfore');
    armor(taper(rbox(0.46, 4.6, 0.9, 0.06), 1, 1, 1, 0.82), 'grey', fore, [0, -2.3, 0], [0, 0, 0], 'xiphias', {dist: 1.2});
    for (let b = 0; b < 5; b++) bolt(fore, 0.24, -0.5 - b * 0.9, 0.3, [0, PI / 2, 0]);
    const slide = node(fore, [0, 0, 0]);
    frame(rbox(0.3, 5.4, 0.5, 0.04), slide, [0, -2.7, 0], [0, 0, 0], M.joint);
    armor(rbox(0.5, 0.6, 0.8, 0.06), 'dark', slide, [0, -5.0, 0], [0, 0, 0], 'xiphias', {reg: false});
    armor(rbox(0.46, 0.4, 0.74, 0.05), 'red', slide, [0, -5.45, 0], [0, 0, 0], 'xiphias', {reg: false});
    const muzzle = node(slide, [0, -5.65, 0], 'xmuzzle');
    const railGlow = frame(rbox(0.5, 4.2, 0.08, 0.02), fore, [0, -2.3, 0.47], [0, 0, 0], M.highlight);
    railGlow.castShadow = false;
    powerLine(body, [s * 0.8, 1.0, 0], [s * 1.7, 1.15, 0], 0.06);
    xiph.push({s, pivot, arm, fore, slide, muzzle, railGlow});
  }

  // ============================================================ torso
  const waist = node(body, [0, SPEC.waistY, -0.25], 'waist'); // the hips sit 0.25 m ahead of the shoulder line (side view)
  frame(cyl(0.6, 0.7, 1.1, 16), waist, [0, 0.35, 0]);
  for (const x of [-0.5, 0.5]) frame(cyl(0.09, 0.09, 1.0, 8), waist, [x, 0.4, 0.5], [0, 0, 0], M.steel);
  // abdomen: gunmetal segments, the red cockpit block in front of them
  for (let i = 0; i < 2; i++) armor(rbox(1.5 + i * 0.2, 0.4, 1.3, 0.07), 'dark', waist, [0, 0.1 + i * 0.46, 0.05], [0, 0, 0], 'abdomen', {dist: 1.2});
  armor(prism([[-0.4, 0.45], [0.4, 0.45], [0.34, -0.45], [-0.34, -0.45]], 0.5, 0.07), 'red', waist, [0, 0.15, 0.95], [-0.05, 0, 0], 'abdomen', {dist: 1.4});
  for (const s of [-1, 1]) armor(rbox(0.75, 0.55, 1.3, 0.08), 'white', waist, [s * 0.85, 0.25, 0.1], [0, 0, -s * 0.08], 'abdomen', {dist: 1.3});
  // ---------------------------------------------------------------- chest, rebuilt from the reference chest close-up
  // Local frame: y 0 is 13.99 m above the sole, z 0 is the shoulder line. Two navy pec blocks, each carrying one big
  // vent in a thick light-grey frame, stand apart either side of a 1.1 m centre column. The column is a prow: a
  // navy collar plate sloping back to the neck, a red chevron at its front edge (the most forward point, 1.95 m ahead
  // of the shoulders), a dark column below it down to the red cockpit hatch. Two navy collar towers with gunmetal caps
  // rise beside the neck, so the head stands clear above the chest with the neck showing, as on the reference.
  const chest = node(waist, [0, 2.5, 0], 'chest');
  frame(rbox(2.3, 1.5, 2.0, 0.15), chest, [0, 0.15, -0.1], [0, 0, 0], M.frame); // the core block under the armor
  /** a chest vent: thick light-grey frame, dark interior, two slats; faces +z of its node */
  const chestVent = (parent, pos, rot, w, h) => {
    const g = node(parent, pos);
    g.rotation.set(...rot);
    const t = 0.13;
    frame(rbox(w - 0.1, h - 0.1, 0.16, 0.02), g, [0, 0, -0.02], [0, 0, 0], M.pocket);
    for (const y of [h / 2 - t / 2, -h / 2 + t / 2]) armor(rbox(w, t, 0.26, 0.04), 'grey', g, [0, y, 0.05], [0, 0, 0], 'chest', {reg: false});
    for (const x of [w / 2 - t / 2, -w / 2 + t / 2]) armor(rbox(t, h - 2 * t + 0.02, 0.26, 0.04), 'grey', g, [x, 0, 0.05], [0, 0, 0], 'chest', {reg: false});
    for (const y of [0.1, -0.12]) frame(rbox(w - 2 * t, 0.07, 0.12, 0.02), g, [0, y, 0.03], [0.35, 0, 0], M.frame);
    return g;
  };
  const pec = [];
  for (const s of [-1, 1]) {
    // each pec block hangs on a hinge at its outer front corner, so it can swing open on REACTOR
    const hinge = node(chest, [s * 1.8, 0, 1.6], 'pec');
    const yawN = node(hinge, [-s * 1.8 + s * 0.55, 0, 0.45]); // the pec face yaws outward about its inner front corner
    yawN.rotation.y = s * 0.35;
    const blk = node(yawN, [-s * 0.55, 0, -2.05]);
    const geo = hull(inset([[-0.7, 1.12], [0.6, 1.24], [1.95, 0.9], [2.05, -0.1], [1.7, -0.42], [-0.7, -0.42]], 0.1), 1.35, 0.1);
    armor(taper(geo, 0.92, 1, 1, 1), 'navy', blk, [s * 1.25, 0, 0], [0, 0, 0], 'chest', {dist: 1.8});
    // the vent on the slanted front face, centred 14.25 m up and 1.14 m out
    chestVent(blk, [s * 1.14, 0.13, 2.01], [0.05, 0, 0], 1.0, 0.74);
    for (const [bx, by] of [[0.62, 0.86], [1.66, 0.86]]) bolt(blk, s * bx, by, 1.2 + (1.2 - by) * 1.3, [-0.9, 0, 0]);
    // collar tower: a navy block with a gunmetal cap, beside the neck
    armor(rbox(0.7, 0.5, 0.75, 0.07), 'navy', chest, [s * 1.32, 1.25, 0.15], [0, 0, s * -0.26], 'chest', {dist: 1.6});
    frame(rbox(0.64, 0.12, 0.66, 0.03), chest, [s * 1.36, 1.53, 0.15], [0, 0, s * -0.26], M.frame);
    pec.push({s, hinge});
  }
  // the prow: one node, so the whole centre column can lift away from the reactor
  const prow = node(chest, [0, 0, 0], 'prow');
  // collar plate: navy, from the neck down and forward to the chevron, narrower at the top
  armor(taper(hull([[0.05, 1.25], [0.45, 1.25], [2.0, 0.82], [1.8, 0.7], [0.05, 0.75]], 1.3, 0.08), 1, 1, 0.92, 1), 'navy', prow, [0, 0, 0], [0, 0, 0], 'chest', {dist: 1.6});
  // the red chevron at the prow's front edge: two halves meeting low at the centre
  armor(taper(hull([[1.95, 0.82], [2.55, 0.66], [2.55, 0.48], [2.0, 0.5]], 1.25, 0.05), 1, 1, 0.85, 1), 'red', prow, [0, 0, 0], [0, 0, 0], 'chest', {dist: 1.8}); // the red band at the prow's front edge
  // the dark column below the chevron
  armor(taper(hull([[0.4, 0.5], [2.05, 0.48], [1.8, -0.55], [1.45, -1.0], [0.4, -1.0]], 0.75, 0.08), 1, 1, 0.8, 1), 'navy', prow, [0, 0, 0], [0, 0, 0], 'chest', {dist: 1.5});
  // lower chest: the bright blue V either side of the column, 1.15 m from the vents' bottom to its tip at 12.7 m
  for (const s of [-1, 1]) armor(prism([[0.38, -0.32], [1.25, -0.32], [0.62, -1.04], [0.38, -1.04]].map(([x, y]) => [x * s, y]), 1.4, 0.08), 'blue', chest, [0, 0, 0.75], [0.12, 0, 0], 'chest', {dist: 1.5});
  // the cockpit hatch: the red block at the foot of the column; it drops open on REACTOR
  const hatchHinge = node(chest, [0, -1.07, 1.25], 'hatch');
  armor(prism([[-0.3, 0.55], [0.3, 0.55], [0.26, 0], [-0.26, 0]], 0.5, 0.06), 'red', hatchHinge, [0, 0, 0], [0, 0, 0], 'chest', {dist: 1.8});
  // the reactor: a glowing core in three spinning rings, a coolant jacket, the N-jammer canceller as a ring stack
  const reactor = node(chest, [0, 0.2, 0.05], 'reactor');
  frame(cyl(0.4, 0.4, 1.3, 24), reactor, [0, 0, 0], [0, 0, 0], M.core);
  const rings = [0, 1, 2].map((i) => frame(new THREE.TorusGeometry(0.6 + i * 0.13, 0.055, 8, 40), reactor, [0, -0.36 + i * 0.36, 0], [PI / 2, 0, 0], i === 1 ? M.steel : M.joint));
  frame(cyl(0.64, 0.64, 0.12, 24), reactor, [0, 0.72, 0], [0, 0, 0], M.joint);
  frame(cyl(0.64, 0.64, 0.12, 24), reactor, [0, -0.72, 0], [0, 0, 0], M.joint);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    frame(rbox(0.06, 1.25, 0.22, 0.02), reactor, [Math.cos(a) * 0.86, 0, Math.sin(a) * 0.86], [0, -a, 0], M.frame);
  }
  for (const s of [-1, 1]) {
    powerLine(chest, [s * 0.45, 0.4, 0.1], [s * 2.4, 0.5, 0]);
    powerLine(chest, [s * 0.4, 0, -0.3], [s * 0.85, 0.3, -1.6]);
    powerLine(waist, [s * 0.4, 2.0, 0.1], [s * 0.6, -0.4, 0.0]);
  }
  powerLine(chest, [0, 0.8, 0], [0, 1.4, 0]);

  // ============================================================ head: 1.8 m tall and wide, 2.2 m front to back
  const neck = node(waist, [0, SPEC.neckY, 0.75], 'neck');
  frame(cyl(0.4, 0.46, 0.95, 16), neck, [0, 0.15, 0], [0, 0, 0], M.joint); // the neck, visible between the chin and the collar plate
  for (let k = 0; k < 2; k++) frame(cyl(0.5, 0.5, 0.09, 18), neck, [0, -0.25 + k * 0.15, 0], [0, 0, 0], M.frame); // neck rings, under the collar
  for (const s of [-1, 1]) frame(cyl(0.07, 0.07, 0.8, 8), neck, [s * 0.36, 0.1, -0.22], [0, 0, s * 0.15], M.steel); // neck pistons
  // Head, measured on the reference front view at 79 px/m: a tall shield, not a box. Eye line at 16.45 m (local y 0);
  // the helmet crown is 0.75 m wide at 17.25 m, the head is widest (1.72 m) across the temples, the cheeks close in
  // to a 0.45 m chin at 15.45 m; the camera housing tops out at 17.55 m. The long V-fin tips reach ±1.8 m at 17.9 m,
  // the two short inner blades carry the 18.03 m tip. Local z 0 is the head's centre, the face is at z ≈ 0.9.
  // Head, measured on the reference head close-up (259 px/m) and checked against the front and side views. Local
  // y 0 is the eye line, z forward, the face at z ≈ 0.85. Camera tower top +1.3, chin bottom -0.75, 1.72 m across the
  // side guards at the brow, the brow 0.6 m ahead of the mouth in side view, the fins swept back about 30 degrees.
  const head = node(neck, [0, 0.82, -0.08], 'head');
  // helmet dome: a faceted shell, narrow at the crown, widest just above the eyes, its lower front edge the brow
  {
    const g = new THREE.SphereGeometry(1, 14, 9, 0, PI * 2, 0, 1.92).toNonIndexed();
    g.scale(0.8, 0.82, 1.08);
    g.rotateX(0.12); // the crown slopes down toward the brow, as in the side view
    g.computeVertexNormals();
    armor(g, 'white', head, [0, 0.42, -0.25], [0, 0, 0], 'head', {dist: 1.4});
  }
  armor(rbox(0.16, 0.1, 1.1, 0.03), 'white', head, [0, 1.2, -0.2], [0.12, 0, 0], 'head', {reg: false}); // crown ridge
  armor(rbox(0.8, 0.5, 0.3, 0.08), 'white', head, [0, 0.3, -1.12], [0, 0, 0], 'head', {dist: 1.3}); // occiput
  frame(rbox(0.3, 0.18, 0.06, 0.02), head, [0, 0.3, -1.29], [0, 0, 0], M.lens); // rear sensor
  // camera tower on the forehead, above the crest, leaning back with the brow
  armor(rbox(0.44, 0.82, 0.6, 0.09), 'white', head, [0, 0.9, 0.6], [-0.25, 0, 0], 'head', {dist: 1.5});
  frame(rbox(0.3, 0.3, 0.08, 0.03), head, [0, 0.92, 0.92], [-0.25, 0, 0], M.pocket);
  frame(rbox(0.22, 0.2, 0.05, 0.02), head, [0, 0.92, 0.97], [-0.25, 0, 0], M.lens);
  // the face: a dark recess under the brow, amber eyes in a V, a white mouth plate with two slits, a red chin
  frame(prism([[-0.5, 0.14], [0.5, 0.14], [0.48, -0.16], [-0.48, -0.16]], 0.3, 0.03), head, [0, 0, 0.55], [0, 0, 0], M.pocket); // eye band recess
  for (const s of [-1, 1]) armor(prism([[0.1, -0.12], [0.5, -0.04], [0.46, -0.36], [0.26, -0.62], [0.12, -0.6]].map(([x, y]) => [x * s, y]), 0.3, 0.04), 'white', head, [0, 0, 0.62], [0.1, 0, s * 0.0], 'head', {dist: 1.3}); // face mask cheeks
  armor(prism([[-0.22, -0.09], [0.22, -0.09], [0.19, -0.3], [0.14, -0.44], [-0.14, -0.44], [-0.19, -0.3]], 0.28, 0.04), 'white', head, [0, 0, 0.78], [0.12, 0, 0], 'head', {dist: 1.2}); // mouth plate
  for (const y of [-0.19, -0.26]) frame(rbox(0.22, 0.03, 0.05, 0.01), head, [0, y, 0.93], [0.12, 0, 0], M.pocket);
  armor(prism([[-0.1, -0.42], [0.1, -0.42], [0.1, -0.62], [0.05, -0.74], [-0.05, -0.74], [-0.1, -0.62]], 0.24, 0.04), 'red', head, [0, 0, 0.66], [0.22, 0, 0], 'head', {dist: 1.2}); // chin
  // the red crest: a shield pointing down between the eyes, its top leaning back
  armor(prism([[-0.18, 0.56], [0.18, 0.56], [0.18, 0.18], [0, -0.1], [-0.18, 0.18]], 0.3, 0.03), 'red', head, [0, 0, 1.04], [-0.38, 0, 0], 'head', {dist: 1.4});
  const eyes = [];
  for (const s of [-1, 1]) {
    const brow = node(head, [s * 0.14, 0, 0.86]);
    brow.rotation.y = -s * 0.45;
    armor(prism([[0, 0.04], [s * 0.46, 0.2], [s * 0.48, 0.3], [0, 0.18]], 0.12, 0.02), 'white', brow, [0, 0, 0], [0, 0, 0], 'head', {dist: 1.4}); // brow visor
    const e = frame(prism([[s * 0.04, -0.01], [s * 0.44, 0.12], [s * 0.47, -0.02], [s * 0.1, -0.13]], 0.05, 0.01), head, [0, 0, 0.86], [0, 0, 0], M.eye);
    e.castShadow = false;
    eyes.push(e);
    // side guard: a tall plate from the temple to beside the chin, tilting in at the bottom
    const sideG = node(head, [s * 0.64, 0, 0]);
    sideG.rotation.z = -s * 0.16;
    armor(hull([[0.68, 0.3], [0.76, 0.0], [0.6, -0.4], [0.32, -0.66], [-0.2, -0.58], [-0.4, -0.1], [-0.35, 0.3]], 0.34, 0.05), 'white', sideG, [0, 0, 0], [0, 0, 0], 'head', {dist: 1.5});
    // five angled vent slats on its front-outer face, in a dark recess
    frame(rbox(0.3, 0.62, 0.06, 0.02), head, [s * 0.62, -0.08, 0.79], [0, 0, -s * 0.16], M.pocket);
    for (let k = 0; k < 4; k++) frame(rbox(0.04, 0.05, 0.38, 0.01), head, [s * (0.88 - k * 0.025), 0.08 - k * 0.12, 0.3], [0, 0, -s * 0.16], M.pocket); // side slits behind the eye
    for (let k = 0; k < 5; k++) frame(rbox(0.24, 0.045, 0.06, 0.01), head, [s * (0.63 - k * 0.03), 0.14 - k * 0.11, 0.82], [0, 0, s * 0.4], M.frame);
    // temple sensor: a dark disc in a ring on the dome
    const ts = node(head, [s * 0.55, 0.38, 0.62]);
    ts.rotation.y = s * 0.7;
    frame(cylZ(0.09, 0.06, 16), ts, [0, 0, 0], [0, 0, 0], M.pocket);
    frame(new THREE.TorusGeometry(0.09, 0.025, 6, 18), ts, [0, 0, 0.02], [0, 0, 0], M.steel);
    // temple pod with the CIWS muzzles, behind the sensor
    const pod = armor(rbox(0.18, 0.32, 0.5, 0.05), 'white', head, [s * 0.82, 0.32, -0.15], [0, 0, 0], 'head', {dist: 1.4});
    for (const y of [0.07, -0.07]) frame(cylZ(0.04, 0.1, 8), pod, [0, y, 0.24], [0, 0, 0], M.pocket);
    // V-fins, swept back about 30 degrees: the long blade to the side, the short one nearly vertical to 18.03 m
    armor(prism([[s * 0.0, -0.16], [s * 1.68, 1.53], [s * 1.64, 1.6], [s * 0.0, 0.2]], 0.1, 0.02), 'yellow', head, [s * 0.12, 0.42, 0.98], [-0.55, 0, 0], 'vfin', {dist: 1.6});
    armor(prism([[s * 0.0, -0.06], [s * 0.2, 1.52], [s * 0.13, 1.54], [s * -0.06, 0.06]], 0.07, 0.015), 'yellow', head, [s * 0.2, 0.5, 0.95], [-0.55, 0, 0], 'vfin', {dist: 1.6});
  }
  powerLine(neck, [0, -0.2, 0], [0, 0.7, 0], 0.05);

  // ============================================================ arms (built on the left, mirrored for the right)
  const arms = [];
  for (const s of [-1, 1]) {
    const side = node(waist);
    side.scale.x = s;
    const sh = node(side, [SPEC.shoulderX, SPEC.shoulderY, 0], 'shoulder');
    frame(new THREE.SphereGeometry(0.6, 20, 14), sh, [0, 0, 0], [0, 0, 0], M.joint);
    frame(cylX(0.4, 0.9, 18), sh, [-0.5, 0, 0], [0, 0, 0], M.frame);
    // shoulder armour, from the reference front view and close-up: a wing with a near-level top that rises slightly
    // to a pointed outer tip, the underside cut on a long diagonal back to the arm, a red stripe along the outer top,
    // a blue marker on the diagonal face, a raised inner plate. Counter-rolled by the stand pose's 19 degrees so the
    // outline holds its reference orientation when standing.
    const block = armor(prism([[-0.35, 1.25], [2.0, 1.5], [1.95, 0.95], [0.9, -0.3], [-0.3, -0.05]], 1.4, 0.12), 'white', sh, [0, 0, 0], [0, 0, -0.33], 'shoulder', {dist: 1.6});
    armor(prism([[0.75, 1.4], [2.02, 1.54], [1.98, 1.4], [0.75, 1.27]], 1.36, 0.03), 'red', block, [0, 0, 0], [0, 0, 0], 'shoulder', {dist: 1.8}); // red stripe along the outer top
    armor(rbox(0.12, 0.55, 0.42, 0.03), 'blue', block, [1.5, 0.45, 0.25], [0, 0, 0.85], 'shoulder', {dist: 1.8}); // blue marker on the diagonal face
    for (const z of [0.72, -0.72]) armor(prism([[-0.05, 1.05], [1.3, 1.2], [1.1, 0.25], [0.15, 0.1]], 0.06, 0.02), 'white', block, [0, 0, z], [0, 0, 0], 'shoulder', {reg: false}); // raised inner plates
    slot(block, [0.75, 0.62, 0.76], 0.7, 0.18, [0, 0, 0.1], 0, 0.04);
    slot(block, [0.75, 0.62, -0.76], 0.7, 0.18, [0, PI, -0.1], 0, 0.04);
    for (const [bx, by] of [[-0.15, 1.0], [1.6, 1.25], [1.05, 0.35], [0.15, 0.2]]) for (const z of [0.76, -0.76]) bolt(block, bx, by, z, z < 0 ? [0, PI, 0] : [0, 0, 0]);
    frame(cyl(0.32, 0.36, SPEC.upperArm - 0.3, 12), sh, [0.1, -SPEC.upperArm / 2, 0]);
    armor(taper(hull(inset([[0.52, -0.75], [0.6, -1.2], [0.56, -1.9], [-0.56, -1.9], [-0.62, -1.2], [-0.5, -0.75]], 0.11), 1.05, 0.2), 1, 1, 0.92, 1), 'white', sh, [0.1, 0, 0], [0, 0, 0], 'arm', {dist: 1.3});
    const elbow = node(sh, [0.1, -SPEC.upperArm, 0], 'elbow');
    frame(cylX(0.34, 0.7, 22), elbow, [0, 0, 0], [0, 0, 0], M.joint);
    frame(rbox(0.6, 0.55, 0.55, 0.08), elbow, [0, 0.0, -0.25], [0, 0, 0], M.frame); // the dark elbow block
    frame(cyl(0.3, 0.34, SPEC.foreArm - 0.5, 12), elbow, [0, -SPEC.foreArm / 2, 0]);
    // forearm: slim at the elbow, a deep cuff at the wrist
    armor(taper(hull(inset([[0.5, -0.45], [0.68, -0.95], [0.66, -1.6], [-0.62, -1.6], [-0.7, -1.05], [-0.52, -0.45]], 0.1), 1.15, 0.2), 0.85, 1, 1.05, 1), 'white', elbow, [0, 0, 0], [0, 0, 0], 'arm', {dist: 1.4});
    armor(rbox(1.45, 0.7, 1.35, 0.2), 'white', elbow, [0, -1.55, 0], [0, 0, 0], 'arm', {dist: 1.5}); // cuff
    slot(elbow, [0.5, -1.3, 0], 0.35, 0.6, [0, PI / 2, 0], 0, 0.06);
    piston(sh, [0.1, -1.3, 0.3], elbow, [0, -0.8, 0.32], 0.1);
    const wrist = node(elbow, [0, -SPEC.foreArm, 0], 'wrist');
    wrist.rotation.y = 0.5; // palm toward the thigh, fingers showing from the front
    frame(cyl(0.26, 0.26, 0.4, 14), wrist, [0, -0.05, 0], [0, 0, 0], M.joint);
    frame(rbox(0.42, 0.9, 1.0, 0.07), wrist, [0, -0.62, 0], [0, 0, 0], M.frame); // palm
    armor(rbox(0.14, 0.7, 0.9, 0.04), 'white', wrist, [0.26, -0.58, 0], [0, 0, 0], 'arm', {dist: 1.0, reg: false}); // back-of-hand plate
    frame(cylZ(0.12, 1.0, 10), wrist, [-0.02, -1.08, 0], [0, 0, 0], M.joint); // knuckle bar
    {
      const curl = 0.08; // open, splayed hands as on the reference
      for (let f = 0; f < 4; f++) {
        let g = node(wrist, [-0.02, -1.08, 0.36 - f * 0.24]);
        g.rotation.x = (f - 1.5) * 0.1;
        [0.45, 0.36, 0.3].forEach((len, j) => {
          if (j) g.rotation.z = -curl;
          else g.rotation.z = -0.05 - f * 0.04;
          frame(rbox(0.22, len - 0.04, 0.22, 0.04), g, [0, -len / 2, 0], [0, 0, 0], M.frame);
          frame(cylZ(0.1, 0.24, 8), g, [0, 0, 0], [0, 0, 0], M.joint);
          g = node(g, [0, -len, 0]);
        });
      }
      let t = node(wrist, [-0.12, -0.42, 0.52]);
      t.rotation.set(0.9, 0, -0.3);
      [0.42, 0.34].forEach((len) => {
        frame(rbox(0.22, len - 0.04, 0.22, 0.04), t, [0, -len / 2, 0], [0, 0, 0], M.frame);
        frame(cylZ(0.09, 0.2, 8), t, [0, 0, 0], [0, 0, 0], M.steel);
        t = node(t, [0, -len, 0]);
        t.rotation.z = -0.3;
      });
    }
    powerLine(sh, [-0.1, 0, 0.25], [0, -SPEC.upperArm, 0.25]);
    powerLine(elbow, [-0.15, 0, 0.25], [-0.1, -SPEC.foreArm + 0.3, 0.25]);
    arms.push({s, side, sh, elbow, wrist});
  }

  // ============================================================ backpack: navy, two thruster ports in hex mounts, a slatted centre vent
  const pack = node(waist, [0, SPEC.packY, SPEC.packZ], 'pack');
  armor(taper(rbox(2.6, 3.3, 1.2, 0.16), 1, 1, 0.6, 1), 'navy', pack, [0, -0.3, 0], [0, 0, 0], 'pack', {dist: 1.4});
  armor(rbox(1.4, 0.3, 0.6, 0.08), 'navy', pack, [0, 1.4, -0.1], [0, 0, 0], 'pack', {dist: 1.6});
  slot(pack, [0, -0.25, -0.6], 0.95, 1.75, [0, PI, 0], 6, 0.14);
  for (const y of [0.685, -1.185]) frame(rbox(1.19, 0.12, 0.12, 0.03), pack, [0, y, -0.63], [0, 0, 0], M.frame);
  for (const x of [-0.535, 0.535]) frame(rbox(0.12, 1.99, 0.12, 0.03), pack, [x, -0.25, -0.63], [0, 0, 0], M.frame);
  frame(rbox(2.0, 0.25, 1.0, 0.05), pack, [0, -1.85, 0], [0, 0, 0], M.frame);
  for (const hx of [-1.45, 1.45]) {
    // side housings carry the ports, set wide as on the reference; the ports are dark bores that light under thrust
    armor(rbox(0.8, 1.1, 1.0, 0.1), 'navy', pack, [hx, 0.45, -0.25], [0, 0, 0], 'pack', {dist: 1.5});
    frame(new THREE.CylinderGeometry(0.44, 0.44, 0.5, 6).rotateX(PI / 2), pack, [hx, 0.45, -0.8], [0, 0, 0], M.frame);
    frame(cylZ(0.28, 0.52, 20), pack, [hx, 0.45, -0.81], [0, 0, 0], M.pocket);
    frame(new THREE.TorusGeometry(0.29, 0.05, 10, 28), pack, [hx, 0.45, -1.06], [0, 0, 0], M.steel);
    const glow = frame(new THREE.CircleGeometry(0.22, 20), pack, [hx, 0.45, -0.95], [0, PI, 0], M.nozzle);
    glow.castShadow = false;
    for (let b = 0; b < 6; b++) bolt(pack, hx + Math.cos((b / 6) * PI * 2 + 0.52) * 0.38, 0.45 + Math.sin((b / 6) * PI * 2 + 0.52) * 0.38, -1.06);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.22, 2.6, 16, 1, true).translate(0, 1.3, 0).rotateX(PI), M.plume);
    plume.position.set(hx, 0.45, -1.06);
    plume.rotation.x = 1.15; // exhaust back and down
    plume.renderOrder = 5;
    pack.add(plume);
    jets.push({plume});
  }

  // ============================================================ beams: one per rail cannon, parented to its muzzle
  const beams = [];
  const beamOf = (muzzle, halo, r) => {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, 1, 10, 1, true).translate(0, -0.5, 0), M.beamCore);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 14, 1, true).translate(0, -0.5, 0), halo);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(r * 2.4, 14, 10), M.flash);
    for (const m of [core, glow, flash]) m.renderOrder = 7;
    g.add(core, glow, flash);
    muzzle.add(g);
    const b = {g, core, glow, flash};
    beams.push(b);
    return b;
  };
  for (const x of xiph) x.beam = beamOf(x.muzzle, M.railHalo, 0.26);

  // ============================================================ teardown directions, from the rest pose
  body.updateMatrixWorld(true);
  const centre = new V3(0, 2.0, 0);
  const wpos = new V3();
  const inv = new THREE.Matrix4().copy(body.matrixWorld).invert();
  for (const p of parts) {
    p.o.getWorldPosition(wpos).applyMatrix4(inv);
    const d = wpos.clone().sub(centre);
    d.x *= 1.35;
    d.z *= 1.35;
    if (p.asm === 'head' || p.asm === 'vfin') d.y += 1.5;
    if (p.asm === 'foot') d.y -= 1;
    if (d.lengthSq() < 1e-6) d.set(R() - 0.5, R(), R() - 0.5);
    p.dir = d.normalize().add(new V3(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(0.35)).normalize();
    p.dist *= 2.6 * (0.8 + 0.4 * R()); // metres on an 18 m suit: the pieces clear each other by a body width
  }

  // ============================================================ posing
  const tmpM = new THREE.Matrix4();
  const pa = new V3();
  const pb = new V3();
  const UPV = new V3(0, 1, 0);
  const ld = new V3();
  const qa = new THREE.Quaternion();
  const stagger = (E, d) => ss(d * 0.3, d * 0.3 + 0.7, E);
  let glassOn = false;
  // the bone gaps of the second teardown stage: limbs pull away from their sockets, in metres in each bone's frame
  const GAP = {hip: [1.6, -1.1, 0], knee: [0.3, -1.6, 0], ankle: [0, -1.4, 0.3], shoulder: [2.4, 0.7, 0], elbow: [0.3, -1.4, 0], wrist: [0, -1.0, 0], neck: [0, 2.0, 0.3], pack: [0, 0.5, -2.8], xiph: [1.8, 0, 0]};
  const home = new Map();
  const keep = (o) => {
    if (!home.has(o)) home.set(o, o.position.clone());
    return home.get(o);
  };
  const setGap = (o, g, e) => o.position.copy(keep(o)).add(ld.set(g[0] * e, g[1] * e, g[2] * e));
  const state = {};

  /**
   * ops: lift, spread (wings), burst, bt (s since burst order), rail (Xiphias alone), ps (phase shift), xray,
   * explode, head, wing (pull one wing), reactor (open the core), turn
   */
  const update = (t, ops = {}) => {
    const mc = machineAt(t, ops);
    const {lift, E, E1, burst, dep, cyc, can, bp} = mc;
    const E2 = ss(0.45, 1, E); // frame apart
    const held = E;
    body.position.set(bp.x, SPEC.pelvisY + bp.alt, bp.z); // corrected below once the legs are posed
    body.rotation.set(bp.pitch, 0, bp.roll, 'YXZ');
    group.rotation.y = ops.turn ?? 0;
    const pz = poseAt(t, Math.max(lift, 0) * (1 - held * 0.6), dep.aim, ops.head ?? 0);
    const thrust = mc.thrust;
    const load = mc.power.load;

    // joints
    waist.rotation.set(-pz.waist[0], pz.waist[1], 0, 'YXZ');
    head.rotation.set(-pz.head[0], pz.head[1], 0, 'YXZ');
    setGap(neck, GAP.neck, E2 + 0.5 * (ops.head ?? 0));
    legs.forEach((L, k) => {
      // k 0 is the suit's right (mirrored, x = -1), the same index the poses use
      L.hip.rotation.set(-pz.hip[k][0], 0, pz.hip[k][1], 'XZY');
      L.knee.rotation.set(pz.kn[k], 0, 0);
      L.ankle.rotation.set(pz.an[k], 0, -pz.hip[k][1]); // soles flat under the splayed legs
      setGap(L.hip, GAP.hip, E2);
      setGap(L.knee, GAP.knee, E2);
      setGap(L.ankle, GAP.ankle, E2);
    });
    arms.forEach((A, k) => {
      A.sh.rotation.set(-pz.sh[k][0], 0, pz.sh[k][1], 'XZY');
      A.elbow.rotation.set(-pz.el[k], 0, 0);
      setGap(A.sh, GAP.shoulder, E2);
      setGap(A.elbow, GAP.elbow, E2);
      setGap(A.wrist, GAP.wrist, E2);
    });
    setGap(pack, GAP.pack, E2);

    // stand on the soles: whatever the legs' pose, the lower ankle sits exactly SPEC.ankle above the altitude
    body.updateMatrixWorld(true);
    {
      let low = Infinity;
      for (const L of legs) low = Math.min(low, L.ankle.getWorldPosition(pa).y / SPEC.scale);
      body.position.y += bp.alt + SPEC.ankle - low - 1.6 * E2;
    }

    // the core opens: pectoral plates swing out on their outer hinges, the hatch drops, the reactor slides forward
    const rc = ops.reactor ?? 0;
    pec.forEach((P) => P.hinge.rotation.set(-0.2 * rc, P.s * 1.9 * rc, 0));
    hatchHinge.rotation.x = 1.6 * rc;
    prow.position.set(0, 0.9 * rc, 0.7 * rc);
    reactor.position.z = 0.05 + 1.3 * rc + 2.4 * E2;
    reactor.position.y = 0.2 + 0.1 * rc;
    const spin = t * (1.2 + 3.5 * load);
    rings.forEach((r, i) => (r.rotation.z = spin * (i === 1 ? -1.3 : 1)));
    M.core.emissiveIntensity = 0.6 + 0.8 * load + 0.15 * Math.sin(t * 9);

    // rail cannons swing forward off the hips and slide out
    xiph.forEach((X) => {
      X.pivot.rotation.x = can.xiphiasPitch;
      X.fore.rotation.z = 0;
      X.slide.position.y = -can.xiphiasExt;
      setGap(X.pivot, GAP.xiph, E2);
    });

    // beams and charge glow: every gun fires for its share of the volley
    xiph.forEach((X, i) => {
      const f = cyc.fire[i];
      const b = X.beam;
      b.g.visible = f > 0.01;
      b.g.scale.set(0.4 + 0.6 * f, 70 * ss(0, 0.25, f), 0.4 + 0.6 * f);
      b.flash.scale.set(1, 1 / Math.max(0.01, 70 * ss(0, 0.25, f)), 1);
    });
    const anyFire = Math.max(...cyc.fire);
    M.flash.opacity = 0.85 * anyFire;
    M.beamHalo.opacity = 0.45 * anyFire + 0.05;
    M.railHalo.opacity = 0.5 * anyFire + 0.05;
    M.highlight.opacity = Math.max(cyc.charge * 0.9, (ops.rail ?? 0) * 0.5 * (0.6 + 0.4 * Math.sin(t * 8)));

    // thrusters
    const th = thrust;
    M.plume.opacity = 0.3 * th;
    for (const J of jets) {
      J.plume.scale.set(1, 0.4 + 0.6 * th + 0.08 * Math.sin(t * 23 + J.plume.id), 1);
      J.plume.visible = th > 0.02;
    }
    M.nozzle.color.setRGB(0.12 + 0.63 * th, 0.13 + 0.74 * th, 0.15 + 0.85 * th); // a dark bore at idle
    // eyes light with the phase shift
    const ps = mc.ps;
    M.eye.color.setRGB(0.3 + 0.7 * ps, 0.16 + 0.42 * ps, 0.04 + 0.06 * ps); // glowing amber-orange, as on the reference

    // phase shift: the armor greys out when the PS power is off
    for (const k of PAINTS) {
      M[k].color.lerpColors(OFF[k], ON[k], ps);
      M[k].metalness = BASE[k].m + 0.25 * (1 - ps);
      M[k].roughness = BASE[k].r + 0.06 * (1 - ps);
      GLASS[k].color.copy(M[k].color);
    }
    const xr = ops.xray ?? 0;
    const glass = xr > 0.02;
    if (glass !== glassOn) {
      glassOn = glass;
      for (const a of armorMeshes) a.mesh.material = glass ? GLASS[a.key] : M[a.key];
    }
    for (const k of PAINTS) GLASS[k].opacity = 1 - 0.9 * xr;
    ink.opacity = 0.28 - 0.05 * xr;
    // power lines: visible in x-ray, with the core open and in the teardown; they flow at the reactor's load
    M.line.opacity = Math.max(xr, 0.85 * rc, 0.7 * E1);
    M.line.map.offset.x = -t * (0.8 + 2.5 * load);
    for (const l of lines) l.visible = M.line.opacity > 0.02;

    // pistons: each end follows its own bone
    body.updateMatrixWorld(true);
    for (const P of pistons) {
      pa.copy(P.a).applyMatrix4(P.A.matrixWorld).applyMatrix4(tmpM.copy(body.matrixWorld).invert());
      pb.copy(P.b).applyMatrix4(P.B.matrixWorld).applyMatrix4(tmpM);
      ld.subVectors(pb, pa);
      const len = ld.length() || 1e-6;
      ld.multiplyScalar(1 / len);
      P.sleeve.position.copy(pa);
      P.sleeve.quaternion.setFromUnitVectors(UPV, ld);
      P.sleeve.scale.set(1, len * 0.58, 1);
      P.rod.position.copy(pb);
      P.rod.quaternion.setFromUnitVectors(UPV, ld.negate());
      P.rod.scale.set(1, len * 0.6, 1);
      P.eyeA.position.copy(pa);
      P.eyeB.position.copy(pb);
    }

    // armor teardown: each piece slides out along its own direction (in its bone's frame) and tumbles a little
    body.updateMatrixWorld(true);
    for (const p of parts) {
      const e = stagger(E1, p.delay);
      p.o.position.copy(p.home.p);
      p.o.quaternion.copy(p.home.q);
      if (e > 0) {
        tmpM.copy(p.o.parent.matrixWorld).invert().multiply(body.matrixWorld);
        ld.copy(p.dir).transformDirection(tmpM);
        p.o.position.addScaledVector(ld, p.dist * e);
        p.o.quaternion.multiply(qa.setFromAxisAngle(p.spin, p.ang * e));
      }
    }
    body.updateMatrixWorld(true);
    Object.assign(state, mc, {pose: pz});
    return state;
  };

  const wp = (o, x = 0, y = 0, z = 0) => o.localToWorld(new V3(x, y, z));
  const points = {
    vfin: () => wp(head, 1.2, 1.2, 0.2),
    eye: () => wp(head, 0.3, 0.03, 0.85),
    ciws: () => wp(head, 0.82, 0.32, 0.1),
    camera: () => wp(head, 0, 0.92, 0.8),
    cheek: () => wp(head, 0.7, -0.08, 0.72),
    head: () => wp(head, 0, 0.3, 0.4),
    vent: () => wp(chest, 1.14, 0.13, 2.1),
    hatch: () => wp(hatchHinge, 0, 0.3, 0.3),
    core: () => wp(reactor, 0, 0.2, 0.45),
    line: () => wp(chest, 1.6, 0.48, 0.05),
    wedge: () => wp(prow, 0, 0.6, 2.55),
    pack: () => wp(pack, 0, 0.9, -0.6),
    port: (i = 1) => wp(pack, i ? 0.9 : -0.9, 0.35, -0.75),
    packVent: () => wp(pack, 0, -0.25, -0.65),
    calf: (i = 1) => wp(legs[i].knee, 0, -4.2, -0.95),
    xiphias: (i = 1) => wp(xiph[i].fore, 0.25, -2.0, 0),
    xMount: (i = 1) => wp(xiph[i].pivot, 0.5, 0, 0),
    xMuzzle: (i = 1) => wp(xiph[i].muzzle),
    shoulder: (i = 1) => wp(arms[i].sh, 1.4, 1.1, 0.6),
    elbow: (i = 1) => wp(arms[i].elbow, 0, 0, 0.3),
    knee: (i = 1) => wp(legs[i].knee, 0.9, 0, 0),
    ankle: (i = 1) => wp(legs[i].ankle, 0, -0.5, 1.0),
    foot: (i = 1) => wp(legs[i].ankle, 0, -2.0, 2.3),
    skirt: () => wp(body, 1.0, -0.8, 1.1),
  };
  return {group, body, update, points, materials: M, state};
}
