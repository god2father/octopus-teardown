// Pelagos OC-8, the geometry, all built from code: a riveted shell of eight petals over a pump core of tangled
// hydraulic lines, two optic ports, a telescoping siphon, a twin-jaw beak, and eight arms of 35 tapered links
// riding on 552 suction wheels (instanced). update(t, ops) poses everything from kin.js.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ARMS, armPose, bodyPose, jetAt, SPEC} from './kin.js';
import {rng} from 'teardown-kit/util.js';

const V3 = THREE.Vector3;
const R = SPEC.mantleR;
const PI = Math.PI;
const TH_TOP = 0.085 * PI; // cap / petal boundary
const TH_EQ = 0.47 * PI; // petal / hull boundary
const TH_COL = Math.acos(SPEC.collarY / R); // hull / collar boundary: exactly the arm-root ring

export const COLORS = {white: '#f4f3f0', orange: '#ec4b1c', black: '#1c1c1f', steel: '#8d9299', inner: '#8f8b85', glass: '#0e1013'};

// ------------------------------------------------------------ painted shell textures: seams, rivets, ports
// Every shell texture is drawn twice by the same function: once in colour (map) and once as a height field
// (bumpMap) where seams are sunk grooves, rivets raised domes and paint flat. The palette is swapped per pass.
const INK = {paper: '#f4f2ee', seam: '#55555a', rivet: '#1d1d20', ink: '#1d1d20', orange: '#ec4b1c', glass: '#16181b', grey: '#3a3d42', label: '#f4f2ee'};
const HGT = {paper: '#808080', seam: '#2a2a2a', rivet: '#ffffff', ink: '#808080', orange: '#868686', glass: '#5a5a5a', grey: '#5a5a5a', label: '#808080', bump: true};
let C = INK;
function shellTexture(w, h, draw) {
  const out = {};
  for (const [key, pal] of [['map', INK], ['bump', HGT]]) {
    C = pal;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = C.paper;
    g.fillRect(0, 0, w, h);
    draw(g, w, h);
    if (!pal.bump) {
      // faint mottling so large white panels are not a perfect flat fill
      const n = rng(w + h);
      g.globalAlpha = 0.035;
      for (let i = 0; i < (w * h) / 900; i++) {
        g.fillStyle = n() < 0.5 ? '#000' : '#fff';
        g.fillRect(n() * w, n() * h, 2 + n() * 6, 2 + n() * 6);
      }
      g.globalAlpha = 1;
    }
    const tex = new THREE.CanvasTexture(c);
    if (!pal.bump) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    out[key] = tex;
  }
  C = INK;
  return out;
}
const rivets = (g, x0, y0, x1, y1, step, rad = 2.4) => {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = y0 + ((y1 - y0) * i) / n;
    if (C.bump) {
      const gr = g.createRadialGradient(x, y, 0, x, y, rad * 1.3);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(1, '#808080');
      g.fillStyle = gr;
    } else g.fillStyle = C.rivet;
    g.beginPath();
    g.arc(x, y, rad * (C.bump ? 1.3 : 1), 0, PI * 2);
    g.fill();
  }
};
const seam = (g, x0, y0, x1, y1, lw) => {
  g.strokeStyle = C.seam;
  g.lineWidth = C.bump ? lw * 1.6 : lw;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
};
function petalTexture(k) {
  return shellTexture(512, 768, (g, w, h) => {
    const r = rng(101 + k * 7);
    // panel edges, a horizontal seam a little above the middle, and a second sub-panel seam
    seam(g, 4, 0, 4, h, 4);
    seam(g, w - 4, 0, w - 4, h, 4);
    seam(g, 0, h - 4, w, h - 4, 4);
    const ys = h * (0.42 + 0.08 * r());
    seam(g, 0, ys, w, ys, 4);
    seam(g, w * 0.5, ys, w * 0.5, h, 2.5);
    // dense rivet rows along every seam, as on the reference shell
    rivets(g, 22, 20, 22, h - 20, 26, 4.2);
    rivets(g, w - 22, 20, w - 22, h - 20, 26, 4.2);
    rivets(g, 40, ys + 18, w - 40, ys + 18, 26, 3.6);
    rivets(g, 40, ys - 18, w - 40, ys - 18, 26, 3.6);
    rivets(g, 40, h - 22, w - 40, h - 22, 26, 3.6);
    if (k === 0 || k === 4) {
      // a glass port with the core's orange showing through, framed by a raised bezel
      g.fillStyle = C.seam;
      g.beginPath();
      g.roundRect(w * 0.2 - 6, h * 0.1 - 6, w * 0.6 + 12, h * 0.28 + 12, 22);
      g.fill();
      g.fillStyle = C.glass;
      g.beginPath();
      g.roundRect(w * 0.2, h * 0.1, w * 0.6, h * 0.28, 18);
      g.fill();
      g.fillStyle = C.orange;
      g.fillRect(w * 0.3, h * 0.3, w * 0.4, h * 0.04);
      g.fillStyle = C.grey;
      g.fillRect(w * 0.26, h * 0.13, w * 0.05, h * 0.21);
      g.fillRect(w * 0.6, h * 0.16, w * 0.12, h * 0.02);
      rivets(g, w * 0.2 + 12, h * 0.1 - 16, w * 0.8 - 12, h * 0.1 - 16, 22, 3);
    } else if (k % 2 === 1) {
      g.fillStyle = C.ink;
      g.fillRect(w * (0.3 + 0.2 * r()), h * 0.6, w * 0.18, h * 0.04);
      g.fillStyle = C.orange;
      g.fillRect(w * 0.2, h * 0.7, w * 0.42, h * 0.07);
      g.fillStyle = C.label;
      g.font = '700 30px monospace';
      g.fillText(`P-0${k + 1}`, w * 0.23, h * 0.755);
    } else {
      g.fillStyle = C.ink;
      for (let i = 0; i < 3; i++) g.fillRect(w * 0.3, h * (0.56 + i * 0.05), w * (0.4 - i * 0.1), h * 0.016);
      g.fillStyle = C.orange;
      g.fillRect(w * 0.72, h * 0.6, w * 0.08, h * 0.08);
    }
  });
}
function hullTexture() {
  return shellTexture(2048, 384, (g, w, h) => {
    for (let k = 0; k < 8; k++) {
      const x = (k / 8) * w;
      seam(g, x + 3, 0, x + 3, h, 4);
      rivets(g, x + 22, 26, x + 22, h - 20, 26, 4);
    }
    seam(g, 0, 6, w, 6, 5);
    seam(g, 0, h * 0.62, w, h * 0.62, 3);
    rivets(g, 16, 24, w - 16, 24, 24, 3.6);
    rivets(g, 16, h * 0.62 + 18, w - 16, h * 0.62 + 18, 24, 3.2);
    // marks around the band (the optics sit in the front quarter, u ~ 0.25 is +z)
    g.fillStyle = C.ink;
    for (const u of [0.06, 0.46, 0.56, 0.68, 0.94]) g.fillRect(u * w, h * 0.42, 92, 18);
    g.fillStyle = C.orange;
    for (const u of [0.1, 0.5, 0.62, 0.88]) g.fillRect(u * w, h * 0.7, 60, 40);
  });
}

// ------------------------------------------------------------ small builders
const cylX = (r, h, seg = 24) => new THREE.CylinderGeometry(r, r, h, seg).rotateZ(PI / 2);
const cylZ = (r, h, seg = 24) => new THREE.CylinderGeometry(r, r, h, seg).rotateX(PI / 2);
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
  hole.absarc(0, 0, rOut * 0.3, 0, PI * 2, true);
  s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, {depth: thick, bevelEnabled: false, curveSegments: 4}).translate(0, 0, -thick / 2);
}

export function buildRobot() {
  // Painted composite under a clear coat: a satin base with a glossy lacquer on top, so every curved part carries a
  // soft broad sheen plus a tight highlight, the way the reference's white shell does. Rubber tyres stay dull.
  const paint = (color, o = {}) => new THREE.MeshPhysicalMaterial({color, roughness: 0.42, metalness: 0, clearcoat: 0.75, clearcoatRoughness: 0.14, envMapIntensity: 1, ...o});
  const M = {
    white: paint(COLORS.white, {roughness: 0.38}),
    orange: paint(COLORS.orange, {roughness: 0.4, clearcoat: 0.6}),
    black: paint(COLORS.black, {roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3}),
    rubber: new THREE.MeshStandardMaterial({color: '#18181a', roughness: 0.82, metalness: 0}),
    steel: new THREE.MeshStandardMaterial({color: '#a4a9b0', roughness: 0.28, metalness: 1, envMapIntensity: 1.1}),
    inner: new THREE.MeshStandardMaterial({color: '#6f6b66', roughness: 0.8, metalness: 0, side: THREE.BackSide}),
    glass: new THREE.MeshPhysicalMaterial({color: COLORS.glass, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.45, depthWrite: false, envMapIntensity: 1.4}),
    lensRing: new THREE.MeshStandardMaterial({color: '#2c2f34', roughness: 0.3, metalness: 0.8}),
  };
  const shellMat = (tex) => {
    const m = M.white.clone();
    m.map = tex.map;
    m.bumpMap = tex.bump;
    m.bumpScale = 1.6;
    return m;
  };
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const shadowy = (m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  // ------------------------------------------------------------ mantle: 8 petals hinged at the equator, and a cap
  const mantle = new THREE.Group();
  body.add(mantle);
  const petals = [];
  const PH = (2 * PI) / SPEC.petals;
  for (let k = 0; k < SPEC.petals; k++) {
    // three's sphere: x = -cos(phi) sin(theta), z = sin(phi) sin(theta); petal 0 centred on the front (+z), phi = 90°
    const phi0 = PI / 2 + k * PH - PH / 2 + 0.006;
    const geo = new THREE.SphereGeometry(R, 28, 24, phi0, PH - 0.012, TH_TOP, TH_EQ - TH_TOP);
    const mat = shellMat(petalTexture(k));
    const outer = shadowy(new THREE.Mesh(geo, mat));
    const inner = new THREE.Mesh(new THREE.SphereGeometry(R * 0.975, 20, 16, phi0, PH - 0.012, TH_TOP, TH_EQ - TH_TOP), M.inner);
    // hinge on the bottom edge, at the petal's centre
    const pm = phi0 + (PH - 0.012) / 2;
    const radial = new V3(-Math.cos(pm), 0, Math.sin(pm));
    const hinge = radial.clone().multiplyScalar(R * Math.sin(TH_EQ)).setY(R * Math.cos(TH_EQ));
    const pivot = new THREE.Group();
    pivot.position.copy(hinge);
    outer.position.copy(hinge).negate();
    inner.position.copy(hinge).negate();
    pivot.add(outer, inner);
    mantle.add(pivot);
    petals.push({pivot, radial, hinge, axis: new V3(0, 1, 0).cross(radial).normalize()});
  }
  const cap = new THREE.Group();
  {
    const mat = M.white.clone();
    cap.add(shadowy(new THREE.Mesh(new THREE.SphereGeometry(R, 64, 8, 0, PI * 2, 0, TH_TOP), mat)));
    const knob = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.05, 32), M.black));
    knob.position.y = R * Math.cos(TH_TOP) + 0.01;
    cap.add(knob);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.006, 8, 40).rotateX(PI / 2), M.steel);
    ring.position.y = knob.position.y - 0.02;
    cap.add(ring);
  }
  mantle.add(cap);

  // ------------------------------------------------------------ hull band (fixed), collar, bowl
  const hullMat = shellMat(hullTexture());
  const hull = shadowy(new THREE.Mesh(new THREE.SphereGeometry(R, 128, 20, 0, PI * 2, TH_EQ, TH_COL - TH_EQ), hullMat));
  body.add(hull);
  body.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.975, 48, 8, 0, PI * 2, TH_EQ, TH_COL - TH_EQ), M.inner));
  const lower = new THREE.Group();
  body.add(lower);
  const collarY = R * Math.cos(TH_COL);
  {
    // the collar band sits on the hull/bowl seam, the same ring the arm roots are on
    const collar = shadowy(new THREE.Mesh(new THREE.TorusGeometry(SPEC.collarR, 0.035, 16, 96).rotateX(PI / 2), M.black));
    collar.position.y = collarY;
    lower.add(collar);
    const bowl = shadowy(new THREE.Mesh(new THREE.SphereGeometry(SPEC.collarR, 48, 14, 0, PI * 2, PI / 2, PI / 2), M.black));
    bowl.position.y = collarY;
    lower.add(bowl);
    const ring = shadowy(new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.02, 12, 56).rotateX(PI / 2), M.orange));
    ring.position.y = collarY - 0.17;
    lower.add(ring);
    // eight sockets on the collar ring, each a boss coaxial with link 0: it runs from inside the hull out to
    // SPEC.rootR, where link 0's back end (its joint disc) starts. Built along +x, then turned to the arm's azimuth.
    const rb = SPEC.r0 * 1.12;
    const inset = 0.05;
    const bossLen = SPEC.bossL + inset;
    const bossGeo = new THREE.LatheGeometry(
      [[0, 0], [rb * 0.96, 0], [rb, 0.012], [rb, bossLen - 0.016], [rb * 0.97, bossLen - 0.004], [rb * 0.86, bossLen], [rb * 0.72, bossLen - 0.012], [0, bossLen - 0.012]].map(([x, y]) => new THREE.Vector2(x, y)),
      40,
    ).rotateZ(-PI / 2);
    const bandGeo = cylX(rb * 1.025, 0.018, 40).translate(bossLen - 0.03, 0, 0);
    const lipGeo = new THREE.TorusGeometry(rb * 0.8, 0.008, 8, 40).rotateY(PI / 2).translate(bossLen - 0.006, 0, 0);
    for (const a of ARMS) {
      const g = new THREE.Group();
      g.position.set(Math.sin(a.az) * (SPEC.collarR - inset), SPEC.collarY, Math.cos(a.az) * (SPEC.collarR - inset));
      g.rotation.y = a.az - PI / 2;
      g.add(shadowy(new THREE.Mesh(bossGeo, M.white)), shadowy(new THREE.Mesh(bandGeo, M.orange)), new THREE.Mesh(lipGeo, M.black));
      lower.add(g);
    }
  }

  // ------------------------------------------------------------ the pump core: tangled lines, reactor ring, pistons, gears
  const core = new THREE.Group();
  body.add(core);
  {
    core.add(shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.23, 32, 20), M.black)));
    const r = rng(7);
    const tubes = [];
    for (let i = 0; i < 46; i++) {
      const pts = [];
      const c = new V3(r() - 0.5, r() - 0.3, r() - 0.5).normalize();
      for (let j = 0; j < 7; j++) {
        const d = c.clone().add(new V3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.4)).normalize();
        pts.push(d.multiplyScalar(0.24 + r() * 0.12));
      }
      tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 48, 0.0075 + r() * 0.005, 5, true));
    }
    core.add(shadowy(new THREE.Mesh(mergeGeometries(tubes), new THREE.MeshStandardMaterial({color: '#151517', roughness: 0.35, metalness: 0.2}))));
    const ring = shadowy(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.022, 14, 72).rotateX(PI / 2), M.orange));
    ring.position.y = -0.08;
    core.add(ring);
    const g1 = shadowy(new THREE.Mesh(gearGeo(0.075, 16, 0.025), M.steel));
    g1.position.set(0.3, 0.02, 0.08);
    g1.rotation.y = PI / 2;
    const g2 = shadowy(new THREE.Mesh(gearGeo(0.05, 11, 0.025), M.orange));
    g2.position.set(0.3, 0.1, -0.03);
    g2.rotation.y = PI / 2;
    core.add(g1, g2);
    core.userData.gears = [g1, g2];
  }
  const pistons = [];
  for (let i = 0; i < SPEC.pistons; i++) {
    const a = (i / SPEC.pistons) * PI * 2 + 0.3;
    const g = new THREE.Group();
    g.position.set(Math.sin(a) * 0.29, -0.14, Math.cos(a) * 0.29);
    g.rotation.y = a;
    const barrel = shadowy(new THREE.Mesh(cylZ(0.026, 0.08, 16), M.black));
    const rod = shadowy(new THREE.Mesh(cylZ(0.012, 0.1, 12), M.steel));
    rod.position.z = 0.04;
    g.add(barrel, rod);
    core.add(g);
    pistons.push(rod);
  }

  // ------------------------------------------------------------ optics: two ports on the hull, front left and right
  const eyes = [];
  for (const side of [-1, 1]) {
    const az = side * 32 * (PI / 180);
    const th = 0.555 * PI; // high enough that the front arm roots pass under the housing
    const dir = new V3(Math.sin(az) * Math.sin(th), Math.cos(th), Math.cos(az) * Math.sin(th));
    const mount = new THREE.Group();
    mount.position.copy(dir).multiplyScalar(R * 0.93);
    mount.lookAt(dir.clone().multiplyScalar(2));
    const eye = new THREE.Group();
    mount.add(eye);
    eye.scale.setScalar(0.9);
    // housing: a lathed bezel with a rolled lip, so it catches a highlight instead of reading as a flat disc
    eye.add(shadowy(new THREE.Mesh(new THREE.LatheGeometry([[0.15, -0.08], [0.165, -0.06], [0.165, 0.05], [0.16, 0.07], [0.148, 0.08], [0.128, 0.078], [0.12, 0.04], [0, 0.04]].map(([x, y]) => new THREE.Vector2(x, y)), 64).rotateX(PI / 2), M.white)));
    // a deep black cavity with a toothed ring, as in the reference
    const cav = new THREE.Mesh(cylZ(0.12, 0.03, 48), M.black);
    cav.position.z = 0.055;
    eye.add(cav);
    const teeth = new THREE.Mesh(gearGeo(0.112, 28, 0.02), M.black);
    teeth.position.z = 0.072;
    eye.add(teeth);
    const ring = shadowy(new THREE.Mesh(new THREE.TorusGeometry(0.138, 0.018, 16, 64), M.orange));
    ring.position.z = 0.08;
    const lens = new THREE.Mesh(cylZ(0.125, 0.02, 48), M.glass);
    lens.position.z = 0.078;
    const iris = new THREE.Group();
    iris.position.z = 0.09;
    for (const [rr, tt] of [[0.095, 0.008], [0.068, 0.007], [0.042, 0.006]]) iris.add(new THREE.Mesh(new THREE.TorusGeometry(rr, tt, 10, 48), M.lensRing));
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.014, 24), new THREE.MeshBasicMaterial({color: '#ff6a3a'}));
    pupil.position.z = 0.003;
    iris.add(pupil);
    eye.add(ring, lens, iris);
    body.add(mount);
    eyes.push({mount, eye, iris, dir, home: mount.position.clone()});
  }

  // ------------------------------------------------------------ siphon: three telescoping sleeves and a 4-flap nozzle
  const siphon = new THREE.Group();
  {
    const th = 0.64 * PI;
    const dir = new V3(0, Math.cos(th), -Math.sin(th));
    siphon.position.copy(dir).multiplyScalar(R * 0.9);
    siphon.lookAt(siphon.position.clone().add(new V3(0, -0.45, -1)));
    body.add(siphon);
  }
  const sleeves = [];
  [[0.08, 0.1], [0.066, 0.1], [0.053, 0.1]].forEach(([r, h], i) => {
    const m = shadowy(new THREE.Mesh(cylZ(r, h, 32), i === 1 ? M.black : M.white));
    siphon.add(m);
    const b = new THREE.Mesh(cylZ(r * 1.04, 0.015, 32), M.orange);
    b.position.z = h / 2 - 0.01;
    m.add(b);
    sleeves.push(m);
  });
  const flaps = [];
  for (let i = 0; i < SPEC.flaps; i++) {
    const hinge = new THREE.Group();
    hinge.rotation.z = (i / SPEC.flaps) * PI * 2;
    const arm = new THREE.Group();
    arm.position.y = 0.045;
    hinge.add(arm);
    const f = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.006, 0.07).translate(0, 0, 0.035), M.black));
    arm.add(f);
    sleeves[2].add(hinge);
    hinge.position.z = 0.05;
    flaps.push(arm);
  }

  // ------------------------------------------------------------ beak: twin jaws and the radula ring, under the bowl
  const beak = new THREE.Group();
  beak.position.y = collarY - 0.24;
  lower.add(beak);
  const jaws = [];
  for (const s of [-1, 1]) {
    const h = new THREE.Group();
    const j = shadowy(new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.15, 24, 1, false, s < 0 ? 0 : PI, PI).rotateX(PI).translate(0, -0.075, 0), M.black));
    h.add(j);
    beak.add(h);
    jaws.push({h, s});
  }
  const radula = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 10, 40).rotateX(PI / 2), M.orange);
  beak.add(radula);

  // ------------------------------------------------------------ arms: instanced parts over all 280 links
  const NL = SPEC.links * 8;
  const NW = (SPEC.links - 1) * 4 * 8;
  const part = (geo, mat, n) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    body.add(m);
    return m;
  };
  // unit link: radius 1, length lenK (2.0) along x, normal +y, wheels on -y. The sleeve is lathed with rolled
  // rims and a hollow mouth at each end, so the joint gap between links reads dark and each sleeve end catches a
  // highlight, as in the reference; the band, plate and joint are separate instanced parts.
  const sleeveProfile = [[0.84, -0.74], [0.9, -0.8], [0.97, -0.8], [1, -0.77], [1, 0.77], [0.97, 0.8], [0.9, 0.8], [0.84, 0.74]];
  const shellGeo = new THREE.LatheGeometry(sleeveProfile.map(([r, x]) => new THREE.Vector2(r, x)), 40).rotateZ(-PI / 2);
  const tread = (() => {
    // a tyre with a toothed tread, like the suction wheels in the reference
    const sh = new THREE.Shape();
    const T = 14;
    for (let i = 0; i < T * 2; i++) {
      const a = (i / (T * 2)) * PI * 2;
      const rr = i % 2 ? 0.4 : 0.44;
      i ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.3, 0, PI * 2, true);
    sh.holes.push(hole);
    return new THREE.ExtrudeGeometry(sh, {depth: 0.18, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2, curveSegments: 3}).translate(0, 0, -0.09);
  })();
  const P = {
    shell: part(shellGeo, M.white, NL),
    band: part(cylX(1.02, 0.16, 40).translate(0.52, 0, 0), M.orange, NL),
    plate: part(mergeGeometries([new THREE.BoxGeometry(0.5, 0.26, 0.06).translate(-0.22, 0.3, 0.985), new THREE.BoxGeometry(0.5, 0.26, 0.06).translate(-0.22, 0.3, -0.985), new THREE.BoxGeometry(0.9, 0.05, 0.03).translate(-0.05, 0.98, 0).rotateX(0)]), M.black, NL),
    joint: part(mergeGeometries([cylX(0.72, 0.36, 24).translate(-0.98, 0, 0), new THREE.TorusGeometry(0.66, 0.09, 10, 28).rotateY(Math.PI / 2).translate(-0.98, 0, 0), cylX(0.8, 0.06, 28).translate(-0.86, 0, 0)]), M.black, NL),
    core: part(cylX(0.52, 1.7, 16), M.steel, NL),
    tire: part(tread, M.rubber, NW),
    hub: part(mergeGeometries([cylZ(0.31, 0.2, 24), cylZ(0.12, 0.26, 14)]), M.orange, NW),
  };
  const mat4 = new THREE.Matrix4();
  const basis = new THREE.Matrix4();
  const vT = new V3();
  const vN = new V3();
  const vB = new V3();
  const pos = new V3();
  const scl = new V3();
  const quat = new THREE.Quaternion();
  const set = (mesh, idx, p, r) => {
    pos.set(p[0], p[1], p[2]);
    scl.set(r, r, r);
    mat4.compose(pos, quat, scl);
    mesh.setMatrixAt(idx, mat4);
  };
  // last pose of every arm, for callouts and the console
  const armOut = [];

  const update = (t, ops = {}) => {
    const mantleOpen = ops.mantle ?? 0;
    const spread = ops.spread ?? 0;
    const J = ops.jet ?? 0;
    const beakOpen = ops.beak ?? 0;
    const optic = ops.optic ?? 0;
    const bp = bodyPose(t);
    body.position.set(0, bp.y + 0.1 * spread, 0);
    body.rotation.set(bp.pitch, bp.yaw, bp.roll, 'YXZ');
    const jet = jetAt(t, J);

    // mantle: squeeze with the jet, petals swing out on their hinges, the cap lifts clear
    mantle.scale.setScalar(jet.squeeze);
    const open = mantleOpen;
    petals.forEach((p, k) => {
      const wob = open * 0.04 * Math.sin(t * 1.3 + k);
      p.pivot.position.copy(p.hinge).addScaledVector(p.radial, 0.1 * open + 0.12 * spread).setY(p.hinge.y + 0.1 * open);
      p.pivot.quaternion.setFromAxisAngle(p.axis, (52 * PI) / 180 * open + wob);
    });
    cap.position.y = 0.36 * open + 0.22 * spread;
    cap.rotation.y = 0.6 * open;
    // the core turns its gears with the pump, its pistons stroke with each jet pulse
    core.position.y = 0.05 * open;
    core.rotation.y = t * 0.15;
    core.userData.gears[0].rotation.z = t * 1.2 * (0.4 + J);
    core.userData.gears[1].rotation.z = -t * 1.2 * (0.4 + J) * (16 / 11);
    pistons.forEach((rod, i) => (rod.position.z = 0.03 + 0.035 * (0.5 + 0.5 * Math.sin(jet.phase + (i * 2 * PI) / SPEC.pistons)) * (0.25 + J)));
    // optics: the iris breathes, focus mode stops it down; the ports scan slowly
    eyes.forEach((e, i) => {
      const s = 1 - 0.28 * optic * (0.6 + 0.4 * Math.sin(t * 2.2 + i));
      e.iris.scale.setScalar(s + 0.03 * Math.sin(t * 0.9 + i));
      e.eye.rotation.set(0.06 * Math.sin(t * 0.43 + i), 0.09 * Math.sin(t * 0.31 + i * 2), 0);
      e.mount.position.copy(e.home).addScaledVector(e.dir, 0.14 * spread + 0.03 * optic);
    });
    // siphon: sleeves telescope out and the flaps open with the jet
    const ext = 0.25 + 0.75 * J * (0.4 + 0.6 * jet.pulse / Math.max(J, 1e-3));
    sleeves[0].position.z = 0.04 + 0.1 * spread;
    sleeves[1].position.z = sleeves[0].position.z + 0.04 + 0.05 * ext;
    sleeves[2].position.z = sleeves[1].position.z + 0.04 + 0.05 * ext;
    flaps.forEach((f) => (f.rotation.x = -(0.15 + 0.55 * jet.pulse + 0.2 * J)));
    // beak
    beak.position.y = collarY - 0.24 - 0.16 * spread;
    jaws.forEach(({h, s}) => (h.rotation.x = s * (0.05 + 0.42 * beakOpen * (0.75 + 0.25 * Math.sin(t * 3)))));
    radula.rotation.y = t * (0.5 + 3 * beakOpen);
    lower.position.y = -0.06 * spread;

    // arms
    let li = 0;
    let wi = 0;
    for (let a = 0; a < 8; a++) {
      const apart = ops.apart?.[a] ?? 0;
      const {links, curl} = armPose(a, t, {apart, spread, h: bp.y + 0.1 * spread});
      armOut[a] = {links, curl};
      for (let k = 0; k < links.length; k++) {
        const L = links[k];
        vT.set(...L.T);
        vN.set(...L.N);
        vB.crossVectors(vT, vN);
        basis.makeBasis(vT, vN, vB);
        quat.setFromRotationMatrix(basis);
        const r = L.r;
        const up = 1.5 * apart * r;
        const dn = 0.95 * apart * r;
        const at = (dy) => [L.p[0] + L.N[0] * dy, L.p[1] + L.N[1] * dy - 0.06 * spread, L.p[2] + L.N[2] * dy];
        set(P.shell, li, at(up), r);
        set(P.band, li, at(up), r);
        set(P.plate, li, at(up), r);
        set(P.joint, li, at(0), r);
        set(P.core, li, at(0), apart > 0.01 ? r : 0.0001);
        if (k > 0)
          for (const along of [-0.42, 0.42])
            for (const s of [-1, 1]) {
              const o = at(-1.0 * r - dn);
              const w = [o[0] + vB.x * 0.6 * r * s + vT.x * along * r, o[1] + vB.y * 0.6 * r * s + vT.y * along * r, o[2] + vB.z * 0.6 * r * s + vT.z * along * r];
              set(P.tire, wi, w, r);
              set(P.hub, wi, w, r);
              wi++;
            }
        li++;
      }
    }
    for (const m of Object.values(P)) m.instanceMatrix.needsUpdate = true;
    body.updateMatrixWorld(true);
    return {jet, body: bp};
  };

  // named points in world space, for callouts
  const wp = (obj, x = 0, y = 0, z = 0) => obj.localToWorld(new V3(x, y, z));
  const bw = (p) => body.localToWorld(new V3(p[0], p[1], p[2]));
  const points = {
    glassPort: () => wp(petals[0].pivot.children[0], 0, R * 0.78, R * 0.5),
    shellPetal: () => wp(petals[2].pivot.children[0], -R * 0.62, R * 0.45, 0),
    pumpCore: () => wp(core, -0.18, 0.12, 0.12),
    reactorRing: () => wp(core, 0.22, -0.08, 0.2),
    driveGears: () => wp(core.userData.gears[0]),
    optic: (i = 0) => wp(eyes[i].eye, 0, 0, 0.09),
    siphon: () => wp(sleeves[2], 0, 0, 0.06),
    beak: () => wp(beak, 0, -0.1, 0),
    collar: () => wp(lower, 0, collarY, R * 0.6),
    link: (a, k) => bw(armOut[a].links[k].p),
    wheel: (a, k) => {
      const L = armOut[a].links[k];
      return bw([L.p[0] - L.N[0] * L.r * 1.6, L.p[1] - L.N[1] * L.r * 1.6, L.p[2] - L.N[2] * L.r * 1.6]);
    },
    tip: (a) => bw(armOut[a].links[SPEC.links - 1].p),
  };
  return {group, body, mantle, core, eyes, siphon, beak, update, points, armOut, parts: P, materials: M};
}
