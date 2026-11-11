// Mellis HB-7, the geometry, all from code, in metres (the stage scales the whole bee by SPEC.scale). A white
// optic head with two ringed lenses and orange-tipped antennae, a 10-segment neck bearing, a black thorax drive
// under a white shell (3 gears, 12 actuators), four veined wings on quick-release hinges, six servo legs and an
// abdomen capsule with a glass section over its gear train. Every part is a direct child of the body with a home
// pose and a teardown direction, so the exploded view is one function of a single number.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng} from 'teardown-kit/util.js';
import {abdomenAt, antennaAt, bodyPose, headAt, legPose, LEGS, SPEC, wingAt} from './kin.js';

const V3 = THREE.Vector3;
const PI = Math.PI;
const UP = new V3(0, 1, 0);
export const COLORS = {white: '#f4f3f0', orange: '#ec4b1c', black: '#1c1c1f', steel: '#a4a9b0'};

const ss = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
const cylZ = (r, h, seg = 24) => new THREE.CylinderGeometry(r, r, h, seg).rotateX(PI / 2);
const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
function gearGeo(rOut, teeth, thick) {
  const s = new THREE.Shape();
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * PI * 2;
    const a1 = ((i + 1) / (teeth * 2)) * PI * 2;
    const rr = i % 2 ? rOut * 0.84 : rOut;
    if (i === 0) s.moveTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
    else s.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
    s.lineTo(Math.cos(a1) * rr, Math.sin(a1) * rr);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, rOut * 0.28, 0, PI * 2, true);
  s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, {depth: thick, bevelEnabled: false, curveSegments: 3}).translate(0, 0, -thick / 2);
}

// ------------------------------------------------------------ a wing, as a honeybee's: clear membrane, brown veins
// local frame: span along +x from the hinge, chord in z (leading edge +z), membrane in y = 0. The veins sit in the
// inner 60% of the wing (costa, subcosta, the marginal cell and three submarginal cells); the outer third is bare
// membrane, which is what makes a bee wing read as a bee wing.
function wingParts(L, c, seed, hind = false) {
  const r = rng(seed);
  const edge = (s) => {
    const w = c * (0.3 + 0.7 * Math.sin(Math.min(1, s * 1.04) * PI * 0.94)) * (s < 0.985 ? 1 : 0.5);
    return {lead: w * 0.3, trail: -w * 0.7};
  };
  const N = 48;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.0012);
  for (let i = 1; i <= N; i++) shape.lineTo((i / N) * L, edge(i / N).lead);
  for (let i = N; i >= 0; i--) shape.lineTo((i / N) * L, edge(i / N).trail);
  const membrane = new THREE.ShapeGeometry(shape, 1).rotateX(PI / 2);
  const v = [];
  const P = (x, z) => [x, 0, z];
  const seg = (a, b) => v.push(...a, ...b);
  const at = (f, s) => {
    const e = edge(s);
    return P(s * L, f >= 0 ? e.lead * f : e.trail * -f);
  };
  const line = (f, s0, s1, n = 12) => {
    for (let i = 0; i < n; i++) seg(at(f, s0 + ((s1 - s0) * i) / n), at(f, s0 + ((s1 - s0) * (i + 1)) / n));
  };
  const cross = (f0, f1, s0, s1) => seg(at(f0, s0), at(f1, s1));
  if (!hind) {
    line(0.55, 0.03, 0.6); // subcosta
    line(-0.15, 0.04, 0.52); // radius / media
    line(-0.45, 0.05, 0.5);
    line(-0.75, 0.08, 0.36); // cubitus
    // the marginal cell: a long closed loop along the leading edge beyond the stigma
    seg(at(0.95, 0.6), at(0.5, 0.68));
    seg(at(0.5, 0.68), at(0.35, 0.76));
    seg(at(0.35, 0.76), at(0.85, 0.84));
    // three submarginal cells behind it
    for (const [s0, s1] of [[0.4, 0.44], [0.48, 0.53], [0.56, 0.62]]) cross(0.55, -0.15, s0, s1);
    seg(at(-0.15, 0.52), at(0.35, 0.72));
    for (const s of [0.3, 0.42]) cross(-0.15, -0.45, s, s + 0.03 * r());
    cross(-0.45, -0.75, 0.33, 0.36);
    cross(-0.45, -0.95, 0.5, 0.56);
  } else {
    line(0.5, 0.04, 0.5);
    line(-0.3, 0.05, 0.45);
    cross(0.5, -0.3, 0.3, 0.33);
    cross(-0.3, -0.85, 0.4, 0.46);
  }
  // the outline: a fine vein round the edge
  for (let i = 0; i < N; i++) {
    seg(P((i / N) * L, edge(i / N).lead), P(((i + 1) / N) * L, edge((i + 1) / N).lead));
    seg(P((i / N) * L, edge(i / N).trail), P(((i + 1) / N) * L, edge((i + 1) / N).trail));
  }
  const veins = new THREE.BufferGeometry();
  veins.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  // the costa: the thick leading vein out to the stigma
  const spar = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({length: 10}, (_, i) => {
    const s = 0.01 + (i / 9) * (hind ? 0.5 : 0.6);
    return new V3(s * L, 0.0003, edge(s).lead * 0.97);
  })), 40, c * (hind ? 0.012 : 0.016), 5, false);
  // the stigma: a small dark thickening where the costa ends
  const nodes = new THREE.SphereGeometry(c * 0.05, 10, 6).scale(2.2, 0.35, 0.8).translate(0.6 * L, 0.0003, edge(0.6).lead * 0.85);
  // the motion-blur streak: leading edge, a mid vein and the trailing edge, coloured from the backdrop at the root
  // (so it fades in) to ink at the tip, as a long exposure of a wing sweeping round its hinge looks
  const st = [];
  const sc = [];
  const bg = new THREE.Color('#f3f0eb');
  const ink = new THREE.Color('#5a5047');
  const col = (s) => {
    const c = bg.clone().lerp(ink, Math.pow(s, 0.8));
    sc.push(c.r, c.g, c.b);
  };
  for (let i = 0; i < 16; i++) {
    const s0 = 0.06 + (i / 16) * 0.92;
    const s1 = 0.06 + ((i + 1) / 16) * 0.92;
    for (const [a, b] of [[P(s0 * L, edge(s0).lead), P(s1 * L, edge(s1).lead)], [at(-0.3, s0), at(-0.3, s1)], [P(s0 * L, edge(s0).trail), P(s1 * L, edge(s1).trail)]]) {
      st.push(...a, ...b);
      col(s0);
      col(s1);
    }
  }
  const streak = new THREE.BufferGeometry();
  streak.setAttribute('position', new THREE.Float32BufferAttribute(st, 3));
  streak.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  // the outline, for the released wing's highlight
  const ol = [];
  for (let i = 0; i < N; i++) {
    ol.push(...P((i / N) * L, edge(i / N).lead), ...P(((i + 1) / N) * L, edge((i + 1) / N).lead));
    ol.push(...P((i / N) * L, edge(i / N).trail), ...P(((i + 1) / N) * L, edge((i + 1) / N).trail));
  }
  ol.push(...P(L * 0.985, edge(0.985).lead), ...P(L * 0.985, edge(0.985).trail));
  const outline = new THREE.BufferGeometry();
  outline.setAttribute('position', new THREE.Float32BufferAttribute(ol, 3));
  return {membrane, veins, spar, nodes, streak, outline};
}

// panelled enamel: seams, rivet rows and a vent grille, drawn once in colour and once as a height map (seams sunk,
// rivets raised); armour adds side seams and a rivet row along each plate's front edge
function panelTexture(kind, seed) {
  const r = rng(seed);
  const out = {};
  for (const pass of ['map', 'bump']) {
    const H = pass === 'bump';
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = H ? '#808080' : '#ffffff';
    g.fillRect(0, 0, 512, 256);
    const seam = (x0, y0, x1, y1) => {
      g.strokeStyle = H ? '#2a2a2a' : kind === 'armour' ? 'rgba(0,0,0,.35)' : '#9a9894';
      g.lineWidth = H ? 4 : 2.2;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
    };
    const rivets = (x0, y0, x1, y1, step) => {
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let i = 0; i <= n; i++) {
        g.fillStyle = H ? '#ffffff' : kind === 'armour' ? 'rgba(20,16,12,.7)' : '#2a2a2c';
        g.beginPath();
        g.arc(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, H ? 3.2 : 2.3, 0, Math.PI * 2);
        g.fill();
      }
    };
    if (kind === 'armour') {
      for (const x of [128, 384]) seam(x, 0, x, 256);
      rivets(8, 26, 504, 26, 21);
    } else {
      for (const x of [6, 256, 506]) seam(x, 0, x, 256);
      for (const y of [92, 180]) seam(0, y, 512, y);
      for (const x of [22, 240, 272, 490]) rivets(x, 14, x, 242, 22);
      rivets(30, 104, 480, 104, 24);
      // a vent grille on one panel
      const vx = 70 + r() * 80;
      g.fillStyle = H ? '#262626' : '#2a2a2c';
      for (let i = 0; i < 6; i++) g.fillRect(vx + i * 13, 128, 6, 34);
    }
    const t = new THREE.CanvasTexture(c);
    if (!H) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    out[pass] = t;
  }
  return out;
}

// compound-eye facets: a hex grid of domed cells, drawn as a height map
function facetTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#404040';
  g.fillRect(0, 0, 256, 256);
  const rr = 5.2;
  const dx = rr * Math.sqrt(3);
  for (let row = -1; row < 256 / (rr * 1.5) + 1; row++)
    for (let col = -1; col < 256 / dx + 1; col++) {
      const x = col * dx + (row % 2 ? dx / 2 : 0);
      const y = row * rr * 1.5;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.85, '#9a9a9a');
      gr.addColorStop(1, '#404040');
      g.fillStyle = gr;
      g.beginPath();
      for (let k = 0; k < 6; k++) g.lineTo(x + Math.cos(PI / 6 + (k * PI) / 3) * rr * 0.96, y + Math.sin(PI / 6 + (k * PI) / 3) * rr * 0.96);
      g.fill();
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(9, 6);
  return t;
}

export function buildBee() {
  const paint = (color, o = {}) => new THREE.MeshPhysicalMaterial({color, roughness: 0.4, metalness: 0, clearcoat: 0.75, clearcoatRoughness: 0.14, envMapIntensity: 1, ...o});
  // a honeybee's palette: glossy dark-brown chitin, amber abdominal plates, tawny pile on the thorax (sheen does the
  // velvet), faceted near-black compound eyes; the robot's insides keep their steel, black and orange
  const fur = (color, sheen, o = {}) => new THREE.MeshPhysicalMaterial({color, roughness: 0.92, metalness: 0, sheen: 1, sheenColor: new THREE.Color(sheen), sheenRoughness: 0.5, envMapIntensity: 0.7, ...o});
  const M = {
    white: paint('#c88a2c', {roughness: 0.42, clearcoat: 0.55}),
    orange: paint(COLORS.orange, {roughness: 0.4, clearcoat: 0.6}),
    black: paint('#18181b', {roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.22}),
    steel: new THREE.MeshStandardMaterial({color: COLORS.steel, roughness: 0.3, metalness: 1, envMapIntensity: 1.1}),
    chitin: paint('#22170f', {roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.12}),
    amber: paint('#c9871f', {roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.12, sheen: 0.4, sheenColor: new THREE.Color('#f3c46a')}),
    margin: paint('#2b1b0f', {roughness: 0.36, clearcoat: 0.7}),
    thoraxFur: fur('#8c5f2c', '#f0c98a'),
    headFur: fur('#2f2116', '#9d7b53'),
    legFur: fur('#2a1d13', '#8a6a48', {roughness: 0.75}),
    clypeus: paint('#5b3a1b', {roughness: 0.4}),
    eye: paint('#2a2421', {roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04, bumpScale: 2.4}),
    ocellus: paint('#120d0a', {roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02}),
    pollen: fur('#e2a128', '#ffd77a', {roughness: 0.85}),
    hairPale: new THREE.MeshStandardMaterial({color: '#d9b57f', roughness: 0.9}),
    hairDark: new THREE.MeshStandardMaterial({color: '#6e5136', roughness: 0.9}),
    glass: new THREE.MeshPhysicalMaterial({color: '#e8eef0', roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.5}),
    lens: new THREE.MeshPhysicalMaterial({color: '#0b0c0e', roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4}),
    amberGlow: new THREE.MeshBasicMaterial({color: '#ff7a3a'}),
    // a bee's wing: clear, faintly smoky, with thin-film colour at a grazing angle
    membrane: new THREE.MeshPhysicalMaterial({color: '#efe6d6', roughness: 0.12, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.3, iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [220, 620]}),
    vein: new THREE.LineBasicMaterial({color: '#2e2219', transparent: true, opacity: 0.95}),
    ghost: new THREE.LineBasicMaterial({color: '#ffffff', vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false}),
    highlight: new THREE.LineBasicMaterial({color: COLORS.orange, transparent: true, opacity: 0, depthWrite: false}),
    arc: new THREE.LineBasicMaterial({color: '#b9aea2', transparent: true, opacity: 0, depthWrite: false}),
  };
  M.eye.bumpMap = facetTexture();
  // a machine in a bee's shape: every organic surface is a painted part. White enamel shells, glossy black
  // structure, orange joints and bezels, amber-and-black armour bands for the abdomen's stripes. No fur.
  M.white = paint(COLORS.white, {roughness: 0.36});
  M.headFur = M.white;
  M.thoraxFur = M.white;
  M.legFur = M.white;
  M.chitin = paint('#18181b', {roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.18});
  M.clypeus = paint('#2a2a2e', {roughness: 0.45, clearcoat: 0.4});
  M.amber = paint('#e39a26', {roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.1});
  M.margin = M.chitin;
  const withPanels = (base, kind, seed, k = 1.4) => {
    const m = base.clone();
    const tx = panelTexture(kind, seed);
    m.map = tx.map;
    m.bumpMap = tx.bump;
    m.bumpScale = k;
    return m;
  };
  M.headShell = withPanels(M.white, 'shell', 3);
  M.thoraxShell = withPanels(M.white, 'shell', 7);
  M.amberPlate = withPanels(M.amber, 'armour', 11, 1.1);
  M.darkPlate = withPanels(M.chitin, 'armour', 13, 1.1);
  M.pollen = M.amber;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const shadowy = (m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const R = rng(17);

  // every exploding part: home pose in the body frame, a teardown direction and distance, a spin, a delay
  const parts = [];
  const reg = (o, asm, opt = {}) => {
    o.updateMatrixWorld(true);
    body.attach(o);
    const home = {p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone()};
    const from = opt.from ?? new V3(0, 0, -0.01);
    const out = home.p.clone().sub(from);
    if (out.lengthSq() < 1e-8) out.set(R() - 0.5, R() - 0.3, R() - 0.5);
    const dir = out.normalize().add(new V3(R() - 0.5, R() - 0.4, R() - 0.5).multiplyScalar(opt.jitter ?? 0.7)).normalize();
    const p = {o, asm, home, dir, dist: (opt.dist ?? 0.05) * (0.7 + 0.6 * R()), spin: new V3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), ang: (opt.spin ?? 1.2) * (R() - 0.5) * 2, delay: R(), hidden: !!opt.hidden, iso: new V3()};
    parts.push(p);
    return p;
  };
  const tmp = new THREE.Group(); // build space for parts made inside a sub-frame; reg() reparents them to body
  body.add(tmp);

  // pile: thin tapered hairs, instanced, planted along surface normals and combed back toward the tail
  const hairGeo = new THREE.CylinderGeometry(0.25, 1, 1, 3, 1).translate(0, 0.5, 0);
  const hr = rng(91);
  const FUR = false; // the machine is enamelled, not furred
  const hairs = (n, sample, mat, len, rad) => {
    if (!FUR) return new THREE.Group();
    const m = new THREE.InstancedMesh(hairGeo, mat, n);
    const q = new THREE.Quaternion();
    const s = new V3();
    const d = new V3();
    const mx = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const [p, nrm] = sample(hr);
      d.copy(nrm).add(new V3((hr() - 0.5) * 0.7, (hr() - 0.5) * 0.4, -0.45 + (hr() - 0.5) * 0.4)).normalize();
      q.setFromUnitVectors(UP, d);
      s.set(rad, len * (0.55 + 0.7 * hr()), rad);
      m.setMatrixAt(i, mx.compose(p, q, s));
    }
    m.frustumCulled = false;
    return m;
  };
  // a point and normal on an ellipsoid of radii (a, b, c) about the origin, within polar band th0..th1, azimuth ph0..ph1
  const onEllipsoid = (a, b, c, th0, th1, ph0 = 0, ph1 = PI * 2, lift = 0) => (rr) => {
    const th = Math.acos(Math.cos(th0) + (Math.cos(th1) - Math.cos(th0)) * rr());
    const ph = ph0 + (ph1 - ph0) * rr();
    const u = new V3(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th));
    const p = new V3(u.x * a, u.y * b, u.z * c);
    const nrm = new V3(u.x / a, u.y / b, u.z / c).normalize();
    return [p.addScaledVector(nrm, lift), nrm];
  };

  // ------------------------------------------------------------ head: a flattened triangle, compound eyes, antennae
  const HZ = SPEC.headZ;
  const HR = SPEC.headR;
  const head = [];
  // the capsule: wide at the crown, narrowing to the mouth, flat front to back; split in halves for the teardown
  const HS = [1.02, 1.08, 0.7];
  const headGeo = (p0) => {
    const g = new THREE.SphereGeometry(HR, 48, 32, p0 + 0.004, PI - 0.008);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / HR;
      pos.setX(i, pos.getX(i) * HS[0] * (1 + 0.32 * Math.min(0, y) + 0.06 * Math.max(0, y)));
      pos.setY(i, pos.getY(i) * HS[1]);
      pos.setZ(i, pos.getZ(i) * HS[2]);
    }
    g.computeVertexNormals();
    return g;
  };
  for (const [p0, side] of [[-PI / 2, -1], [PI / 2, 1]]) {
    const g = new THREE.Group();
    g.position.set(0, 0.002, HZ);
    g.add(shadowy(new THREE.Mesh(headGeo(p0), M.headShell)));
    g.add(hairs(260, (rr) => {
      const [p, n] = onEllipsoid(HR * HS[0], HR * HS[1], HR * HS[2], 0.05, 1.4, side < 0 ? -PI / 2 : PI / 2, side < 0 ? PI / 2 : PI * 1.5)(rr);
      return [p, n];
    }, M.hairDark, 0.0032, 0.00022));
    tmp.add(g);
    head.push(reg(g, 'head', {from: new V3(-side * 0.02, 0, HZ - 0.01), dist: 0.06}));
  }
  {
    // the clypeus: a smooth brown plate on the lower face; the mandibles below it; the folded proboscis under the head
    const cl = shadowy(new THREE.Mesh(new THREE.SphereGeometry(HR * 0.42, 32, 16, 0, PI * 2, 0, PI / 2).rotateX(PI / 2).scale(1.1, 0.95, 0.35), M.clypeus));
    cl.position.set(0, -0.006, HZ + HR * HS[2] - 0.0012);
    head.push(reg(cl, 'head', {from: new V3(0, 0, HZ), dist: 0.05}));
    for (const side of [-1, 1]) {
      const c = new THREE.CatmullRomCurve3([[0.0042, -0.0155, 0.011], [0.0048, -0.0205, 0.0128], [0.0028, -0.0235, 0.0136], [0.0006, -0.0238, 0.0124]].map(([x, y, z]) => new V3(side * x, y, HZ + z)));
      const md = shadowy(new THREE.Mesh(new THREE.TubeGeometry(c, 20, 0.0013, 6, false), M.clypeus));
      tmp.add(md);
      head.push(reg(md, 'head', {from: new V3(0, 0, HZ), dist: 0.05}));
    }
    const pc = new THREE.CatmullRomCurve3([[0, -0.019, 0.009], [0, -0.026, 0.002], [0, -0.025, -0.008], [0, -0.019, -0.016]].map(([x, y, z]) => new V3(x, y, HZ + z)));
    const prob = shadowy(new THREE.Mesh(new THREE.TubeGeometry(pc, 20, 0.0011, 6, false), M.chitin));
    tmp.add(prob);
    head.push(reg(prob, 'head', {from: new V3(0, 0, HZ), dist: 0.05}));
    // three ocelli on the crown
    const oc = new THREE.Group();
    for (const [x, y, z] of [[0, HR * 1.05, 0.002], [-0.0042, HR * 0.98, -0.0018], [0.0042, HR * 0.98, -0.0018]]) {
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.0013, 14, 10), M.ocellus);
      o.position.set(x, y + 0.002, HZ + z);
      oc.add(o);
    }
    tmp.add(oc);
    head.push(reg(oc, 'head', {from: new V3(0, 0, HZ), dist: 0.05}));
  }
  // compound eyes: big kidney shapes wrapping each side of the head, faceted
  const eyes = [];
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(side * HR * 0.8, 0.0035, HZ + 0.0015);
    g.lookAt(g.position.clone().add(new V3(side, 0, 0.35)));
    tmp.add(g);
    const eye = shadowy(new THREE.Mesh(new THREE.SphereGeometry(HR, 40, 28), M.eye));
    eye.scale.set(0.5, 0.9, 0.34);
    eye.rotation.z = side * 0.18;
    g.add(eye);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(HR, 40, 28), M.glass);
    dome.scale.set(0.54, 0.94, 0.4);
    dome.rotation.z = side * 0.18;
    dome.renderOrder = 3;
    g.add(dome);
    // an orange bezel ring round the sensor's rim
    const bez = shadowy(new THREE.Mesh(new THREE.TorusGeometry(HR, 0.0011 / 0.7, 10, 64), M.orange));
    bez.scale.set(0.5, 0.9, 1);
    bez.rotation.z = side * 0.18;
    bez.position.z = -0.0006;
    g.add(bez);
    const iris = new THREE.Group();
    g.add(iris);
    eyes.push({p: reg(g, 'head', {from: new V3(0, 0, HZ), dist: 0.07, spin: 0.6}), iris});
  }
  // antennae: elbowed, as an insect's: a straight scape up from a socket in the face, then a bead-segmented
  // flagellum bent forward and out
  for (const side of [-1, 1]) {
    const sock = new V3(side * 0.0034, 0.0045, HZ + HR * HS[2] * 0.92);
    const elbow = sock.clone().add(new V3(side * 0.0022, 0.0105, 0.0032));
    const fl = new THREE.CatmullRomCurve3([elbow, elbow.clone().add(new V3(side * 0.0035, 0.0045, 0.0075)), elbow.clone().add(new V3(side * 0.0075, 0.0055, 0.0165)), elbow.clone().add(new V3(side * 0.0105, 0.0015, 0.0245))]);
    const ant = new THREE.Group();
    const scape = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.00095, 0.0008, 1, 10).translate(0, 0.5, 0), M.chitin));
    scape.position.copy(sock);
    const sd = elbow.clone().sub(sock);
    scape.scale.set(1, sd.length(), 1);
    scape.quaternion.setFromUnitVectors(UP, sd.normalize());
    ant.add(scape);
    ant.add(shadowy(new THREE.Mesh(new THREE.TubeGeometry(fl, 40, 0.00085, 6, false), M.chitin)));
    for (let i = 1; i <= 10; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.00098, 8, 6), M.chitin);
      b.position.copy(fl.getPoint(i / 10.5));
      ant.add(b);
    }
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.0018, 12, 8), M.orange);
    base.position.copy(sock);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.0014, 12, 8), M.orange);
    knee.position.copy(elbow);
    const tend = fl.getPoint(1);
    const ttan = fl.getTangent(1);
    const tip = shadowy(new THREE.Mesh(new THREE.CapsuleGeometry(0.0012, 0.004, 4, 12), M.orange));
    tip.position.copy(tend).addScaledVector(ttan, 0.0022);
    tip.quaternion.setFromUnitVectors(UP, ttan);
    ant.add(base, knee, tip);
    tmp.add(ant);
    const pa = reg(ant, 'head', {from: new V3(0, 0, HZ), dist: 0.05, spin: 0.5});
    pa.ant = {side, base: sock.clone(), elbow: elbow.clone()};
    head.push(pa);
  }

  // ------------------------------------------------------------ neck bearing: 10 slim rings, hidden in the bee's narrow neck
  const neck = [];
  for (let i = 0; i < SPEC.neckSeg; i++) {
    const z = SPEC.neckZ0 + ((i + 0.5) / SPEC.neckSeg) * (SPEC.neckZ1 - SPEC.neckZ0);
    const r = 0.0072 - 0.0012 * Math.sin((i / (SPEC.neckSeg - 1)) * PI);
    const m = shadowy(new THREE.Mesh(cylZ(r, i % 2 ? 0.0004 : 0.0011, 32), i % 2 ? M.steel : M.chitin));
    m.position.set(0, 0.001, z);
    neck.push(reg(m, 'neck', {from: new V3(0, 0.001, z - 0.004), jitter: 1.4, dist: 0.04}));
  }

  // ------------------------------------------------------------ thorax: the drive inside, a furred shell outside
  const TR = SPEC.thoraxR;
  const TS = [1, 0.95, 1.12];
  const thorax = {shell: [], gears: [], act: []};
  {
    const core = shadowy(new THREE.Mesh(new THREE.SphereGeometry(TR * 0.86, 40, 28), M.black));
    core.scale.set(1, 0.92, 1.12);
    reg(core, 'core', {dist: 0.0});
    // the shell plates carry the tawny pile; hairs ride on the plates, so they lift off with them
    // a bee's thorax is not a ball: the scutum rises at the front and the scutellum makes a rounded hump at the back
    const hump = (geo) => {
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const ny = pos.getY(i) / TR;
        const nz = pos.getZ(i) / TR;
        const up = Math.max(0, ny);
        const lift = 0.11 * Math.exp(-((nz + 0.6) ** 2) / 0.035) * up + 0.07 * up * Math.min(1, Math.max(0, (nz + 0.2) / 0.8));
        pos.setY(i, pos.getY(i) + TR * lift);
      }
      geo.computeVertexNormals();
      return geo;
    };
    const plate = (geo, n, th0, th1, ph0, ph1) => {
      const g = new THREE.Group();
      const m = shadowy(new THREE.Mesh(hump(geo), M.thoraxShell));
      m.scale.set(...TS);
      g.add(m, hairs(n, onEllipsoid(TR * TS[0], TR * TS[1], TR * TS[2], th0, th1, ph0, ph1), M.hairPale, 0.0042, 0.00026));
      tmp.add(g);
      return g;
    };
    thorax.shell.push(reg(plate(new THREE.SphereGeometry(TR, 48, 16, 0, PI * 2, 0, 0.95), 1300, 0, 0.95), 'thorax', {from: new V3(0, -0.02, 0), dist: 0.07}));
    for (const side of [-1, 1]) {
      const ph0 = side < 0 ? PI + 0.5 : 0.5;
      thorax.shell.push(reg(plate(new THREE.SphereGeometry(TR, 32, 16, ph0, PI - 1, 0.95, 1.05), 420, 0.95, 2.0, ph0, ph0 + PI - 1), 'thorax', {from: new V3(-side * 0.02, 0, 0), dist: 0.06}));
    }
    // the scutellum ridge: a dark seam across the back of the thorax
    const band = shadowy(new THREE.Mesh(new THREE.TorusGeometry(TR * 0.9, 0.0011, 8, 48, PI).rotateX(PI / 2).rotateY(PI), M.orange));
    band.scale.set(1, 1, 1.12);
    band.position.set(0, TR * 0.45, -0.004);
    thorax.shell.push(reg(band, 'thorax', {from: new V3(0, -0.01, 0), dist: 0.07}));
    const belly = shadowy(new THREE.Mesh(new THREE.SphereGeometry(TR * 0.92, 32, 12, 0, PI * 2, PI * 0.62, PI * 0.38), M.chitin));
    belly.scale.set(1, 0.95, 1.1);
    reg(belly, 'core', {from: new V3(0, 0.02, 0), dist: 0.04});
    // hydraulic hoses wound round the drive, between the core and the shell
    const hq = rng(41);
    for (let i = 0; i < 9; i++) {
      const side = i % 2 ? 1 : -1;
      const a0 = -0.4 + hq() * 0.8;
      const pts = Array.from({length: 6}, (_, j) => {
        const u = j / 5;
        const th = 0.7 + u * 1.5 + 0.2 * (hq() - 0.5);
        const ph = a0 + side * (0.9 + 0.5 * Math.sin(u * PI));
        const rr = TR * (0.9 + 0.03 * Math.sin(u * PI) + 0.02 * hq());
        return new V3(Math.sin(th) * Math.sin(ph) * rr, Math.cos(th) * rr * 0.95, Math.sin(th) * Math.cos(ph) * rr * 1.12 - 0.002);
      });
      const hose = shadowy(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0009 + 0.0003 * hq(), 6, false), M.black));
      tmp.add(hose);
      thorax.shell.push(reg(hose, 'hose', {from: new V3(0, 0, 0), dist: 0.07, spin: 1.5}));
    }
    // the drive: three gears inside the flanks, a crank gear under the crown
    for (const [x, y, z, rO, n] of [[-0.0128, 0.003, 0.003, 0.0062, 14], [0.0128, 0.003, 0.003, 0.0062, 14], [0, 0.0118, -0.003, 0.005, 11]]) {
      const g = shadowy(new THREE.Mesh(gearGeo(rO, n, 0.002), n === 11 ? M.orange : M.steel));
      g.position.set(x, y, z);
      if (x) g.rotation.y = PI / 2;
      else g.rotation.x = PI / 2;
      tmp.add(g);
      thorax.gears.push(reg(g, 'gears', {dist: 0.08, spin: 2}));
    }
    // twelve actuators round the core, two rings of six, all under the shell
    for (let i = 0; i < SPEC.actuators; i++) {
      const a = (i % 6) / 6 * PI * 2 + (i < 6 ? 0.25 : 0.75);
      const y = i < 6 ? -0.004 : 0.005;
      const m = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.0017, 0.0017, 0.0055, 12), M.orange));
      m.position.set(Math.sin(a) * TR * 0.8, y, Math.cos(a) * TR * 0.9);
      m.lookAt(m.position.clone().multiplyScalar(2));
      m.rotateX(PI / 2);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0019, 0.0019, 0.0015, 12), M.black);
      cap.position.y = 0.0028;
      m.add(cap);
      tmp.add(m);
      thorax.act.push(reg(m, 'act', {from: new V3(0, y, 0), dist: 0.09, spin: 2.5}));
    }
  }

  // ------------------------------------------------------------ wings: hinge blocks, membranes, motion-blur ghosts
  const wings = [];
  const GHOSTS = 26;
  const ARC = 33;
  {
    const fore = wingParts(SPEC.foreL, SPEC.foreC, 3);
    const hind = wingParts(SPEC.hindL, SPEC.hindC, 9, true);
    for (const [kind, g, rootZ, sweep] of [['fore', fore, 0.005, 0.38], ['hind', hind, -0.006, 0.7]])
      for (const side of [-1, 1]) {
        const root = new V3(side * 0.0095, 0.0125, rootZ);
        // the hinge, under a tegula: the small brown scale that covers a bee's wing base
        const hb = new THREE.Group();
        hb.position.copy(root);
        hb.add(shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.0034, 16, 10).scale(1, 0.55, 1.3), M.chitin)));
        const pin = shadowy(new THREE.Mesh(cylZ(0.0008, 0.0065, 10), M.orange));
        pin.position.y = 0.0012;
        hb.add(pin);
        tmp.add(hb);
        const hinge = reg(hb, 'hinge', {dist: 0.07, spin: 1.5});
        const wing = new THREE.Group();
        const mem = new THREE.Mesh(g.membrane, M.membrane);
        mem.renderOrder = 3;
        const hl = new THREE.LineSegments(g.outline, M.highlight);
        hl.renderOrder = 4;
        hl.visible = side > 0 && kind === 'fore';
        wing.add(mem, new THREE.LineSegments(g.veins, M.vein), new THREE.Mesh(g.spar, M.chitin), new THREE.Mesh(g.nodes, M.chitin), hl);
        wing.scale.x = side; // the left wings are mirrored
        wing.position.copy(root);
        body.add(wing);
        const ghosts = [];
        for (let k = 0; k < GHOSTS; k++) {
          const gh = new THREE.LineSegments(g.streak, M.ghost);
          gh.renderOrder = 2;
          gh.scale.x = side;
          gh.visible = false;
          body.add(gh);
          ghosts.push(gh);
        }
        // the tip's path through one beat: the figure-eight a long exposure draws
        const arcGeo = new THREE.BufferGeometry();
        arcGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(ARC * 3), 3));
        const arc = new THREE.Line(arcGeo, M.arc);
        arc.visible = false;
        arc.frustumCulled = false;
        body.add(arc);
        // in the teardown each wing slides out flat to its own side, whole, so it still reads as a wing
        const p = {o: wing, asm: 'wing', home: {p: root.clone()}, dir: new V3(side, 0.22, kind === 'fore' ? 0.12 : -0.3).normalize(), dist: 0.045 + R() * 0.01, spin: new V3(0, 0, 1), ang: side * 0.12, delay: R() * 0.4, iso: new V3()};
        wings.push({p, hinge, side, kind, sweep, root, ghosts, arc, L: kind === 'fore' ? SPEC.foreL : SPEC.hindL});
      }
  }

  // ------------------------------------------------------------ legs: dark furred segments, hind legs with pollen loads
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 14).translate(0, 0.5, 0);
  const legs = LEGS.map((L, i) => {
    const mk = (mat) => {
      const m = shadowy(new THREE.Mesh(unitCyl, mat));
      body.add(m);
      return m;
    };
    const ball = (r, mat) => {
      const m = shadowy(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat));
      body.add(m);
      return m;
    };
    const ring = (r, mat) => {
      const m = shadowy(new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.28, 8, 24), mat));
      body.add(m);
      return m;
    };
    // a bee's leg: coxa and trochanter (the hip), a furred femur, a tibia (flattened and widened on the hind leg,
    // where the pollen basket carries its load), a long basitarsus and claw. Key names kept from the robot build.
    const segs = {coxa: mk(M.chitin), femur: mk(M.white), fStripe: mk(M.chitin), hipServo: mk(M.chitin), tibia: mk(L.k === 2 ? M.chitin : M.white), tStripe: mk(M.chitin), kneeServo: mk(M.chitin), tarsus: mk(M.chitin), hipJ: ring(0.0028, M.orange), kneeJ: ring(0.0026, M.orange), ankleJ: ring(0.002, M.orange), kneeHub: ball(0.0021, M.chitin), pad: ball(0.0015, M.chitin), pollen: ball(0.0048, M.pollen)};
    segs.pollen.scale.set(0.8, 0.8, 1.25);
    const ex = Object.fromEntries(Object.keys(segs).map((k) => [k, {dir: new V3(L.side * (0.6 + R()), -0.2 - R() * 0.8, (R() - 0.5) * 1.2).normalize(), dist: 0.05 + R() * 0.06, spin: new V3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), ang: (R() - 0.5) * 3, delay: R()}]));
    return {L, i, segs, ex};
  });

  // ------------------------------------------------------------ petiole: the narrow waist the abdomen pivots on
  {
    const [z0, z1] = SPEC.petiole;
    const w = shadowy(new THREE.Mesh(lathe([[0.0062, 0], [0.0042, -0.002], [0.0036, (z1 - z0) / 2], [0.0042, z1 - z0 + 0.002], [0.0062, z1 - z0]].reverse(), 32).rotateX(PI / 2), M.chitin));
    w.position.set(0, -0.001, z0);
    reg(w, 'petiole', {from: new V3(0, 0, -0.01), dist: 0.05});
    const ring = shadowy(new THREE.Mesh(new THREE.TorusGeometry(0.0041, 0.0007, 8, 32), M.steel));
    ring.position.set(0, -0.001, (z0 + z1) / 2);
    reg(ring, 'petiole', {from: new V3(0, 0, -0.01), dist: 0.06});
  }

  // ------------------------------------------------------------ abdomen: six overlapping striped tergites over the gear train
  const abd = [];
  const abdTrain = [];
  const abdN = {};
  {
    const frame = new THREE.Group();
    frame.position.set(0, -0.001, SPEC.abdZ0);
    frame.rotation.x = 0.1; // hangs a touch, tail down, as a bee carries it
    tmp.add(frame);
    // the abdomen's outline: from the petiole it swells fast, is widest a third of the way back, tapers to the tip
    const LA = 0.06;
    const prof = (u) => {
      const w = Math.sin(Math.min(1, u * 1.05) * PI * 0.9 + 0.12);
      return 0.0168 * Math.pow(Math.max(0, w), 0.8) * (1 - 0.25 * u) + 0.002;
    };
    const piece = (geo, mat, z, k) => {
      const m = shadowy(new THREE.Mesh(geo, mat));
      m.position.z = z;
      frame.add(m);
      return [m, k];
    };
    const bands = [];
    const NB = 6;
    // honeybee colouring: the first tergites amber, the rear ones dark; each with a dark rear margin and a pale
    // hair band at its front edge
    const tone = [M.amberPlate, M.amberPlate, M.amberPlate, M.darkPlate, M.darkPlate, M.darkPlate];
    for (let b = 0; b < NB; b++) {
      const u0 = b / NB;
      const u1 = (b + 1) / NB + 0.035; // overlap onto the next plate
      const pts = [];
      for (let j = 0; j <= 10; j++) {
        const u = u0 + ((u1 - u0) * j) / 10;
        // each plate bulges a little at its front and tucks under the one ahead at its back
        const bulge = 1.03 - 0.05 * (j / 10);
        pts.push([prof(u) * bulge, -(u - u0) * LA]);
      }
      const k = Math.min(3, Math.floor((b * 4) / NB));
      const plateGeo = lathe(pts.slice().reverse(), 56).rotateX(PI / 2); // reversed: the profile runs tail-ward, faces outward
      bands.push(piece(plateGeo, tone[b], -u0 * LA, k));
      // the dark rear margin of the plate
      const mp = pts.slice(7).map(([r, y]) => [r * 1.004, y]);
      bands.push(piece(lathe(mp.reverse(), 56).rotateX(PI / 2), M.darkPlate, -u0 * LA, k));
      // the pale hair band along its front edge
      if (b > 0 && b < 5) {
        const zf = -u0 * LA;
        const rf = prof(u0) * 1.03;
        const hb = new THREE.Group();
        hb.position.z = zf;
        hb.add(shadowy(new THREE.Mesh(new THREE.TorusGeometry(rf * 0.985, 0.00055, 6, 64), M.steel)));
        hb.add(hairs(170, (rr) => {
          const a = rr() * PI * 2;
          const p = new V3(Math.cos(a) * rf, Math.sin(a) * rf, -rr() * 0.003);
          return [p, new V3(Math.cos(a), Math.sin(a), -0.6).normalize()];
        }, M.hairPale, 0.0028, 0.0002));
        frame.add(hb);
        bands.push([hb, k]);
      }
    }
    // the sting at the tip, mostly sheathed
    const sting = piece(new THREE.ConeGeometry(0.0012, 0.0065, 12).rotateX(-PI / 2), M.chitin, -LA - 0.0055, 3);
    // the tail cap: three stepped steel rings closing the armour, like a machined end fitting
    for (const u of [0.86, 0.91, 0.955]) bands.push(piece(new THREE.TorusGeometry(prof(u) * 1.02, 0.00055, 6, 48), M.steel, -u * LA, 3));
    // the robot inside: a shaft, a stack of gears, the return spring
    const shaft = piece(cylZ(0.0014, 0.03, 12), M.steel, -0.026, 1);
    const tg = [[0.0092, 16, -0.016, M.black], [0.011, 20, -0.0205, M.black], [0.006, 10, -0.025, M.orange], [0.011, 20, -0.0295, M.black], [0.0092, 16, -0.034, M.black]].map(([r, n, z, mat]) => piece(gearGeo(r, n, 0.0026), mat, z, 1));
    const helix = new THREE.CatmullRomCurve3(Array.from({length: 80}, (_, i) => new V3(Math.cos(i * 0.55) * 0.0102, Math.sin(i * 0.55) * 0.0102, -0.015 - (i / 79) * 0.022)));
    const spring = piece(new THREE.TubeGeometry(helix, 200, 0.0005, 5, false), M.steel, 0, 1);
    frame.updateMatrixWorld(true);
    for (const [m, k] of [...bands, sting, shaft, ...tg, spring]) {
      const p = reg(m, 'abdomen', {from: new V3(0, 0, -0.02), dist: 0.05 + 0.02 * k, spin: 0.8});
      p.seg = k;
      abd.push(p);
      if (tg.some(([g]) => g === m)) abdTrain.push(p);
      if (m === bands[4][0]) abdN.mid = p;
      if (m === sting[0]) abdN.sting = p;
      if (m === spring[0]) abdN.spring = p;
    }
  }

  // ------------------------------------------------------------ fasteners and caps: hidden inside, scattered in teardown
  const debris = [];
  {
    const screwGeo = new THREE.SphereGeometry(0.0011, 8, 6);
    const capGeo = new THREE.CylinderGeometry(0.0018, 0.0018, 0.005, 12);
    const plateGeo = new THREE.SphereGeometry(0.012, 10, 6, 0, 0.9, 0.8, 0.7);
    for (let i = 0; i < 110; i++) {
      const kind = i < 70 ? 0 : i < 96 ? 1 : 2;
      const m = shadowy(new THREE.Mesh(kind === 0 ? screwGeo : kind === 1 ? capGeo : plateGeo, kind === 0 ? M.black : kind === 1 ? M.orange : M.amber));
      const inAbd = R() < 0.4;
      m.position.set((R() - 0.5) * 0.016, (R() - 0.5) * 0.014, inAbd ? -0.03 - R() * 0.03 : (R() - 0.5) * 0.02);
      m.rotation.set(R() * 6, R() * 6, R() * 6);
      const p = reg(m, 'debris', {from: new V3(0, 0, -0.012), jitter: 1.2, dist: 0.06 + 0.07 * R(), spin: 4, hidden: true});
      debris.push(p);
    }
  }
  // the teardown reads as an exploded drawing, not a cloud: the head assembly moves forward along the body axis,
  // the abdomen back, everything packs 30% tighter, and the loose fasteners stay close to where they came from
  for (const p of parts) {
    if (p.asm === 'head' || p.asm === 'neck') p.dir.add(new V3(0, 0, p.asm === 'head' ? 1.4 : 0.8)).normalize();
    if (p.asm === 'abdomen' || p.asm === 'petiole') p.dir.add(new V3(0, 0, -1.4)).normalize();
    p.dist *= p.asm === 'debris' ? 0.5 : 0.7;
  }
  body.remove(tmp);

  // ------------------------------------------------------------ posing
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const v1 = new V3();
  const v2 = new V3();
  const place = (m, a, b, r) => {
    v1.set(a[0], a[1], a[2]);
    v2.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const l = v2.length() || 1e-6;
    m.position.copy(v1);
    m.quaternion.setFromUnitVectors(UP, v2.multiplyScalar(1 / l));
    m.scale.set(r, l, r);
  };
  const stagger = (E, d) => ss(d * 0.35, d * 0.35 + 0.65, E);
  const applyExplode = (p, E, extraQ = null) => {
    const e = stagger(E, p.delay);
    p.o.position.copy(p.baseP ?? p.home.p).add(p.iso).addScaledVector(p.dir, p.dist * e);
    p.o.quaternion.copy(p.baseQ ?? p.home.q);
    if (extraQ) p.o.quaternion.premultiply(extraQ);
    if (p.ang) p.o.quaternion.multiply(qa.setFromAxisAngle(p.spin, p.ang * e));
    if (p.hidden) p.o.scale.copy(p.home.s).multiplyScalar(Math.max(1e-4, ss(0.04, 0.2, E)));
    return e;
  };
  const out = {wing: null, legs: []};
  const arcQ = new THREE.Quaternion();
  const qHead = new THREE.Quaternion();
  const qAbd = new THREE.Quaternion();
  const eHead = new THREE.Euler();
  const eAnt = new THREE.Euler();
  const eAbd = new THREE.Euler();
  const pHead = new V3();
  const pAbd = new V3();
  const fa = new V3();
  const fb = new V3();
  const bn = new V3();
  const ZAX = new V3(0, 0, 1);
  const spinQ = new THREE.Quaternion();
  const axle = new V3();

  const update = (t, ops = {}) => {
    const lift = ops.lift ?? 1;
    const E = ops.spread ?? 0;
    const held = Math.max(E, ops.held ?? 0);
    const P = (ops.power ?? lift) * Math.max(0, 1 - 4 * E); // the crank stops as the teardown starts
    const bp = bodyPose(t, lift, held);
    body.position.set(bp.x, bp.y, bp.z);
    body.rotation.set(bp.pitch, bp.yaw, bp.roll, 'YXZ');
    group.rotation.y = ops.turn ?? 0;

    // isolation offsets
    const opt = ops.optic ?? 0;
    for (const p of head) p.iso.set(0, 0.004 * opt, 0.012 * opt);
    eyes.forEach((e, i) => {
      e.p.iso.set(0, 0.004 * opt, 0.012 * opt).add(v1.set((i ? 1 : -1) * 0.006 * opt, 0, 0.004 * opt));
      e.iris.scale.setScalar(1 - 0.3 * opt * (0.6 + 0.4 * Math.sin(t * 2.2 + i)) + 0.03 * Math.sin(t * 0.9 + i));
    });
    neck.forEach((p, i) => p.iso.set(0, 0, 0.0016 * i * opt));
    const th = ops.thorax ?? 0;
    thorax.shell.forEach((p, i) => p.iso.copy(p.asm === 'hose' ? v1.set(0, 0.012, 0) : i === 0 ? v1.set(0, 0.02, 0) : i === 3 ? v1.set(0, 0.025, 0) : v1.set((i === 1 ? -1 : 1) * 0.018, 0.003, 0)).multiplyScalar(th));
    const gearSpin = t * (2 + 10 * P + 6 * th);
    thorax.gears.forEach((p, i) => p.iso.set(0, 0.004 * th * (i === 2), 0));
    thorax.act.forEach((p) => p.iso.copy(p.home.p).setY(0).normalize().multiplyScalar(0.006 * th));
    const ab = ops.abdomen ?? 0;
    for (const p of abd) p.iso.set(0, -0.004 * p.seg * ab, -0.011 * p.seg * ab);
    const wi = ops.wing ?? 0;

    // the living parts: the head scans on its neck, the antennae sway on their sockets, the abdomen breathes and
    // sways on the petiole. All of it stills on the bench (teardown) and when isolated.
    const alive = Math.max(lift, 0.4) * (1 - held) * (1 - 0.8 * opt);
    const hd = headAt(t, alive);
    qHead.setFromEuler(eHead.set(hd.pitch, hd.yaw, 0, 'YXZ'));
    pHead.set(0, 0.001, SPEC.neckZ1);
    for (const p of head) {
      p.baseP ??= new V3();
      p.baseQ ??= new THREE.Quaternion();
      if (p.ant) {
        const an = antennaAt(t, p.ant.side, alive);
        qa.setFromEuler(eAnt.set(-an.b, an.a * p.ant.side, 0, 'YXZ'));
        p.baseP.copy(p.home.p).sub(p.ant.base).applyQuaternion(qa).add(p.ant.base);
        p.baseQ.copy(qa).multiply(p.home.q);
      } else {
        p.baseP.copy(p.home.p);
        p.baseQ.copy(p.home.q);
      }
      p.baseP.sub(pHead).applyQuaternion(qHead).add(pHead);
      p.baseQ.premultiply(qHead);
    }
    for (const e of eyes) {
      const p = e.p;
      p.baseP ??= new V3();
      p.baseQ ??= new THREE.Quaternion();
      p.baseP.copy(p.home.p).sub(pHead).applyQuaternion(qHead).add(pHead);
      p.baseQ.copy(p.home.q).premultiply(qHead);
    }
    const am = abdomenAt(t, Math.max(lift, 0.3) * (1 - held) * (1 - ab));
    qAbd.setFromEuler(eAbd.set(am.pitch, am.yaw, 0, 'YXZ'));
    pAbd.set(0, -0.001, SPEC.petiole[1]);
    for (const p of abd) {
      p.baseP ??= new V3();
      p.baseQ ??= new THREE.Quaternion();
      p.baseP.copy(p.home.p).sub(pAbd);
      p.baseP.z *= 1 + am.pump; // the segments telescope a little with each breath
      p.baseP.applyQuaternion(qAbd).add(pAbd);
      p.baseQ.copy(p.home.q).premultiply(qAbd);
    }

    for (const p of parts) {
      let extra = null;
      // gears turn about their own axle (local z, in the body frame)
      if (p.asm === 'gears') extra = spinQ.setFromAxisAngle(axle.set(0, 0, 1).applyQuaternion(p.home.q), (thorax.gears.indexOf(p) === 1 ? -1 : 1) * gearSpin);
      else if (abdTrain.includes(p)) extra = spinQ.setFromAxisAngle(axle.set(0, 0, 1).applyQuaternion(p.home.q), gearSpin * 0.6 * (abdTrain.indexOf(p) === 1 ? -1.4 : 1));
      applyExplode(p, E, extra);
    }

    // wings: stroke about the body's long axis, feather about the span, swept back; R forewing pulls out on WING
    const w = wingAt(t, P * (1 - 0.6 * wi));
    const blur = (ops.blur ?? 0) * (P > 0.3 ? 1 : 0);
    // under motion blur the crisp wing fades into its own streaks
    M.membrane.opacity = 0.2 * (1 - 0.6 * blur);
    M.vein.opacity = 0.95 * (1 - 0.6 * blur);
    M.highlight.opacity = ss(0.1, 0.6, wi);
    M.ghost.opacity = 0.6 * blur;
    M.arc.opacity = 0.55 * blur;
    wings.forEach((W, j) => {
      const iso = W.side > 0 && W.kind === 'fore' ? wi : 0;
      W.hinge.iso.set(W.side * 0.022 * iso, 0.012 * iso, 0);
      applyExplode(W.hinge, E);
      // stroke fore-aft about the body's vertical, the figure-eight's elevation about the long axis, the flip about
      // the span; at rest the wings fold back flat over the abdomen, hindwing tucked under the forewing
      const hind = W.kind === 'hind';
      const pose = (wv, q, isoK = 0) => {
        const fold = wv.fold * (1 - isoK);
        const sweep = W.sweep * (1 - fold) + (hind ? 1.5 : 1.38) * fold;
        const elev = (wv.elev + (hind ? -0.02 : 0)) * (1 - isoK) + 0.3 * isoK - (hind ? 0.16 : 0.1) * fold;
        q.setFromAxisAngle(UP, W.side * (sweep - wv.stroke * (1 - isoK)));
        q.multiply(qa.setFromAxisAngle(v1.set(0, 0, 1), W.side * elev));
        q.multiply(qb.setFromAxisAngle(v2.set(1, 0, 0), wv.feather * (1 - isoK) * (hind ? 0.9 : 1)));
        return q;
      };
      // the hindwing is hooked to the forewing and follows it a moment late
      const wv = hind ? wingAt(t - 0.006, P * (1 - 0.6 * wi)) : w;
      const q = pose(wv, new THREE.Quaternion(), iso);
      const e = stagger(E, W.p.delay);
      W.p.o.position.copy(W.root).add(W.hinge.iso).addScaledVector(W.p.dir, W.p.dist * e);
      W.p.o.quaternion.copy(q).multiply(qa.setFromAxisAngle(W.p.spin, W.p.ang * e));
      W.ghosts.forEach((gh, k) => {
        gh.visible = blur > 0.02 && iso < 0.05;
        if (!gh.visible) return;
        const tt = t - ((k + 1) / GHOSTS) / SPEC.beatHz; // one full beat behind the wing: a fan, as a long exposure
        const wg = wingAt(tt - (hind ? 0.006 : 0), P);
        gh.position.copy(W.p.o.position);
        pose(wg, gh.quaternion);
      });
      W.arc.visible = blur > 0.02 && iso < 0.05;
      if (W.arc.visible) {
        const pos = W.arc.geometry.attributes.position;
        for (let k = 0; k < ARC; k++) {
          const wg = wingAt(t - (k / (ARC - 1)) / SPEC.beatHz - (hind ? 0.006 : 0), P);
          v1.set(W.side * W.L * 0.97, 0, 0).applyQuaternion(pose(wg, arcQ)).add(W.p.o.position);
          pos.setXYZ(k, v1.x, v1.y, v1.z);
        }
        pos.needsUpdate = true;
      }
      if (j === 1) out.wing = w;
    });

    // legs: IK in the body frame, then each segment takes its own teardown path; L2 comes apart on LEG L2
    const lg = ops.leg ?? 0;
    legs.forEach((G) => {
      const k = legPose(G.i, t, lift * (1 - held) + held, bp.y, bp.vel);
      out.legs[G.i] = k;
      const apart = G.L.name === 'L2' ? lg : 0;
      const S = G.segs;
      const gap = (a, b, n) => {
        // pull a segment out along the leg by n gaps when the leg is isolated
        const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const l = Math.hypot(...d) || 1;
        return [d[0] / l * 0.006 * n * apart, d[1] / l * 0.006 * n * apart + 0.004 * n * apart, d[2] / l * 0.006 * n * apart];
      };
      const sh = (p, o) => [p[0] + o[0], p[1] + o[1], p[2] + o[2]];
      const o1 = gap(k.hip, k.foot, 1);
      const o2 = gap(k.hip, k.foot, 2);
      const o3 = gap(k.hip, k.foot, 3);
      const at = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
      // the bend plane's normal: joint rings face along it, the stripes run on the leg's outer face
      fa.set(k.knee[0] - k.coxa[0], k.knee[1] - k.coxa[1], k.knee[2] - k.coxa[2]).normalize();
      fb.set(k.ankle[0] - k.knee[0], k.ankle[1] - k.knee[1], k.ankle[2] - k.knee[2]).normalize();
      bn.crossVectors(fa, fb);
      if (bn.lengthSq() < 1e-8) bn.set(1, 0, 0);
      bn.normalize();
      const face = G.L.side * Math.sign(bn.x || 1);
      const off = (r) => [bn.x * r * face, bn.y * r * face, bn.z * r * face];
      const hindLeg = G.L.k === 2;
      place(S.coxa, k.hip, k.coxa, 0.0032);
      place(S.hipServo, sh(at(k.coxa, k.knee, 0.0), o1), sh(at(k.coxa, k.knee, 0.16), o1), 0.0027); // trochanter
      place(S.femur, sh(k.coxa, o1), sh(k.knee, o1), hindLeg ? 0.0026 : 0.0023);
      place(S.fStripe, sh(sh(at(k.coxa, k.knee, 0.3), o1), off(0.0022)), sh(sh(at(k.coxa, k.knee, 0.85), o1), off(0.0022)), 0.0007);
      place(S.tibia, sh(k.knee, o2), sh(k.ankle, o2), hindLeg ? 0.0031 : 0.0019);
      if (hindLeg) place(S.tStripe, sh(k.knee, o2), sh(k.knee, o2), 1e-5);
      else place(S.tStripe, sh(sh(at(k.knee, k.ankle, 0.2), o2), off(0.0018)), sh(sh(at(k.knee, k.ankle, 0.88), o2), off(0.0018)), 0.0006);
      place(S.kneeServo, sh(at(k.knee, k.ankle, 0.0), o2), sh(at(k.knee, k.ankle, 0.08), o2), hindLeg ? 0.0033 : 0.0022);
      place(S.tarsus, sh(k.ankle, o3), sh(k.foot, o3), hindLeg ? 0.0016 : 0.0011);
      // the pollen load packed on the outer face of each hind tibia
      if (hindLeg) {
        S.pollen.position.set(...sh(sh(at(k.knee, k.ankle, 0.6), o2), off(0.0034)));
        S.pollen.quaternion.setFromUnitVectors(ZAX, fb);
      } else S.pollen.scale.setScalar(1e-5);
      S.hipJ.position.set(...sh(k.coxa, o1));
      S.kneeJ.position.set(...sh(k.knee, o2));
      S.kneeHub.position.set(...sh(k.knee, o2));
      S.ankleJ.position.set(...sh(k.ankle, o3));
      S.pad.position.set(...sh(k.foot, o3));
      for (const j of [S.hipJ, S.kneeJ, S.ankleJ]) j.quaternion.setFromUnitVectors(ZAX, bn);
      for (const key in S) {
        const x = G.ex[key];
        const e = stagger(E, x.delay);
        S[key].position.addScaledVector(x.dir, x.dist * e);
        if (e > 0) S[key].quaternion.multiply(qa.setFromAxisAngle(x.spin, x.ang * e));
      }
    });
    body.updateMatrixWorld(true);
    return {body: bp, wing: w};
  };

  const wp = (o, x = 0, y = 0, z = 0) => o.localToWorld(new V3(x, y, z));
  const points = {
    opticHead: (i = 0) => wp(eyes[i].p.o, 0, 0, 0.006),
    scape: () => {
      const a = head.find((p) => p.ant && p.ant.side > 0);
      return a.o.localToWorld(a.ant.elbow.clone());
    },
    ocelli: () => wp(head.find((p) => p.o.children.length === 3 && !p.ant).o, 0, SPEC.headR * 1.05 + 0.002, SPEC.headZ),
    pollen: () => body.localToWorld(legs[2].segs.pollen.position.clone()),
    head: () => wp(head[0].o, 0, 0, 0),
    neck: () => wp(neck[5].o),
    wingHinge: () => wp(wings[1].hinge.o),
    forewing: () => wings[1].p.o.localToWorld(new V3(SPEC.foreL * 0.6, 0, 0)),
    hindwing: () => wings[3].p.o.localToWorld(new V3(SPEC.hindL * 0.6, 0, 0)),
    driveGears: () => wp(thorax.gears[0].o),
    crank: () => wp(thorax.gears[2].o),
    actuator: () => wp(thorax.act[1].o),
    shell: () => wp(thorax.shell[0].o, 0, SPEC.thoraxR * 0.8, 0),
    abdomen: () => wp(abdN.mid.o, 0, 0.012, -0.006),
    gearTrain: () => wp(abdTrain[1].o),
    spring: () => wp(abdN.spring.o, 0, 0.0102, -0.026),
    stinger: () => wp(abdN.sting.o, 0, 0, -0.003),
    leg: (i, part) => body.localToWorld(new V3(...out.legs[i][part])),
  };
  return {group, body, update, points, out, materials: M, wings};
}
