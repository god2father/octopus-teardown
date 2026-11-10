// Pelagos OC-8, the math. Real dimensions in metres, no three.js in here. One clock drives everything: the body's
// sway, the jet cycle and each arm's curl are functions of t, and every arm's 35 links are posed by integrating a
// curvature profile along the arm (a planar spiral that tightens as the arm thins, plus a little yaw). The console
// reads the same functions, so a gauge can never disagree with what the arms are doing.

export const SPEC = {
  mantleR: 0.42, // mantle shell radius, m
  petals: 8, // shell petals
  rideH: 1.02, // body centre above the floor, m
  collarY: -0.32, // arm roots: the ring where the hull meets the bowl, height in the body frame
  bossL: 0.07, // each root socket stands this far proud of the hull
  links: 18, // links per arm
  r0: 0.12, // first link radius
  rTip: 0.035, // last link radius
  lenK: 2.0, // link length / radius
  lens: 92, // optic lens, mm
  rim: 28, // optic rim, mm
  pistons: 7,
  sleeves: 3,
  flaps: 4,
  cell: 3.72, // V
  cells: 8,
};

// the root ring is ON the hull sphere: everything that touches it (collar, sockets, link 0) derives from these
SPEC.collarR = Math.sqrt(SPEC.mantleR ** 2 - SPEC.collarY ** 2); // hull radius at the collar, 0.272 m
SPEC.rootR = SPEC.collarR + SPEC.bossL; // socket face: link 0's back end sits here

export const ARM_NAMES = ['R1', 'R2', 'R3', 'R4', 'L1', 'L2', 'L3', 'L4'];
const D2R = Math.PI / 180;
export const smooth = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// ------------------------------------------------------------ link sizes: a geometric taper from root to tip
const N = SPEC.links;
const Q = Math.pow(SPEC.rTip / SPEC.r0, 1 / (N - 1));
export const LINK_R = Float32Array.from({length: N}, (_, i) => SPEC.r0 * Math.pow(Q, i));
export const LINK_L = LINK_R.map((r) => r * SPEC.lenK);
export const ARM_LEN = LINK_L.reduce((a, b) => a + b, 0);
// two pairs of suction wheels on every link but the root one, which sits in the collar
export const WHEELS_PER_ARM = (N - 1) * 4;
export const COUNTS = {links: N * 8, wheels: WHEELS_PER_ARM * 8, arms: 8};

// ------------------------------------------------------------ the eight arms
// az from the front (+z), counter-clockwise seen from above; R arms on -x, L arms on +x
const AZ = [-24, -66, -114, -156, 24, 66, 114, 156];
// per arm: root pitch (deg), droop under its own weight (rad/m over the first half), the curl it rests at, its yaw
// curvature and a phase for its slow breathing. Front arms lift and curl high, side arms reach out and touch down.
const SHAPE = [
  {p0: -3, droop: 1.3, curl: 0.86, yaw: 0.5, ph: 0.0},
  {p0: 0, droop: 1.65, curl: 0.72, yaw: -0.2, ph: 1.7},
  {p0: 0, droop: 1.6, curl: 0.82, yaw: 0.25, ph: 3.1},
  {p0: 2, droop: 1.45, curl: 0.78, yaw: -0.3, ph: 4.4},
  {p0: -3, droop: 1.25, curl: 0.92, yaw: -0.5, ph: 0.9},
  {p0: 0, droop: 1.6, curl: 0.76, yaw: 0.2, ph: 2.4},
  {p0: 0, droop: 1.7, curl: 0.84, yaw: -0.25, ph: 3.8},
  {p0: 2, droop: 1.5, curl: 0.8, yaw: 0.3, ph: 5.2},
];
export const ARMS = ARM_NAMES.map((name, i) => ({name, az: AZ[i] * D2R, ...SHAPE[i]}));

/** The body's sway: a slow heave, pitch and roll from holding station in the current. */
export function bodyPose(t) {
  return {
    y: SPEC.rideH + 0.018 * Math.sin(t * 0.83) + 0.008 * Math.sin(t * 2.1 + 0.4),
    pitch: (1.4 * Math.sin(t * 0.52) + 0.4 * Math.sin(t * 1.37 + 2)) * D2R,
    roll: (1.8 * Math.sin(t * 0.37 + 1) + 0.3 * Math.sin(t * 1.9)) * D2R,
    yaw: 0,
  };
}

/** The jet: J is how hard the operator asks (0 idle, 1 full). A pulse contracts the mantle and pushes water out. */
export const JET_HZ = 0.9;
export function jetAt(t, J) {
  const ph = t * JET_HZ * Math.PI * 2;
  const s = Math.max(0, Math.sin(ph));
  const pulse = J * s * s;
  return {
    pulse,
    phase: ph,
    kPa: 15 + 2.4 * Math.sin(t * 0.61) + 1.1 * Math.sin(t * 1.7) + 46 * pulse,
    thrust: 6 + 84 * pulse,
    hz: J > 0.05 ? JET_HZ : 0,
    squeeze: 1 - 0.045 * pulse, // mantle radius factor
    load: 0.12 + 0.6 * J * (0.55 + 0.45 * s),
  };
}

/** How tightly an arm's tip is spiralled, 0 straight to 1 a full tight coil. */
export function curlAt(i, t, apart = 0) {
  const a = ARMS[i];
  const c = a.curl + 0.08 * Math.sin(t * 0.7 + a.ph) + 0.04 * Math.sin(t * 1.9 + a.ph * 2);
  return Math.min(1, Math.max(0, c)) * (1 - apart);
}

/** A unit vector in the arm's own frame (radial, up, lateral) to the body frame. */
const toBody = (az, r, u, l) => [Math.sin(az) * r + Math.cos(az) * l, u, Math.cos(az) * r - Math.sin(az) * l];

/**
 * Poses one arm in the body frame. ops: apart (this arm exploded 0..1), spread (the whole robot exploded 0..1),
 * t. Returns per link: centre p, tangent T, normal N (the side away from the wheels), radius r, length l, and the
 * extra gap opened in front of it.
 */
export function armPose(i, t, ops = {}) {
  const A = ARMS[i];
  const apart = ops.apart ?? 0;
  const spread = ops.spread ?? 0;
  // the body's height above the floor (the arm frame's y = 0 is the body centre)
  const floorY = ops.h ?? SPEC.rideH;
  const curl = curlAt(i, t, apart);
  // straightening for the teardown: a level arm pulled out radially
  const keep = 1 - apart;
  let pitch = (A.p0 + 1.5 * Math.sin(t * 0.5 + A.ph)) * D2R * keep + 4 * D2R * apart;
  let yaw = 0;
  const rootR = SPEC.rootR + 0.24 * spread + 0.1 * apart;
  let x = 0; // radial
  let y = SPEC.collarY - 0.05 * spread;
  let z = 0; // lateral
  const out = [];
  let s = 0;
  const SUB = 6;
  for (let k = 0; k < N; k++) {
    const r = LINK_R[k];
    const l = LINK_L[k];
    const gap = (0.01 + 0.5 * r) * apart + 0.25 * r * spread;
    // the gap: straight along the current heading
    {
      const cp = Math.cos(pitch);
      x += cp * Math.cos(yaw) * gap;
      y += Math.sin(pitch) * gap;
      z += cp * Math.sin(yaw) * gap;
    }
    let mid = null;
    for (let j = 0; j < SUB; j++) {
      const ds = l / SUB;
      const u = (s + ds * 0.5) / ARM_LEN;
      // droop over the first half, a recovery that lays the middle along the floor, then the spiral: curvature
      // grows as 1/r so the thin tip coils tighter than the thick base
      // (the reference holds its arms out from the body, so the droop is gentle: 0.62 of each arm's weight figure)
      const droop = -0.62 * A.droop * smooth(0.04, 0.16, u) * (1 - smooth(0.3, 0.46, u));
      const level = 1.25 * smooth(0.36, 0.46, u) * (1 - smooth(0.5, 0.6, u));
      const spiral = curl * smooth(0.5, 0.78, u) * (0.2 / r);
      const k1 = (droop + level) * keep + spiral;
      const k2 = A.yaw * Math.sin(u * Math.PI) * keep * 0.6;
      pitch += k1 * ds;
      yaw += k2 * ds;
      // the floor: an arm that reaches it lies along it, wheels down, until the spiral lifts the tip off
      const clear = y + floorY - r * 1.46; // wheel bottoms (tread 0.44 r below a hub 1.0 r down)
      if (clear < 0.004 && pitch < 0) pitch *= Math.max(0, clear / 0.004);
      const cp = Math.cos(pitch);
      x += cp * Math.cos(yaw) * ds;
      y += Math.sin(pitch) * ds;
      z += cp * Math.sin(yaw) * ds;
      s += ds;
      if (j === SUB / 2 - 1) mid = {x, y, z, pitch, yaw};
    }
    const {pitch: P, yaw: Y} = mid;
    const T = [Math.cos(P) * Math.cos(Y), Math.sin(P), Math.cos(P) * Math.sin(Y)];
    const Nn = [-Math.sin(P) * Math.cos(Y), Math.cos(P), -Math.sin(P) * Math.sin(Y)];
    out.push({
      p: toBody(A.az, mid.x + rootR, mid.y, mid.z),
      T: toBody(A.az, T[0], T[1], T[2]),
      N: toBody(A.az, Nn[0], Nn[1], Nn[2]),
      r,
      l,
      gap,
    });
  }
  return {links: out, curl};
}

/** The pressure trace the JET panel draws: kPa over the last `span` seconds. */
export const pressureHist = (t, J, span = 6, n = 90) => Array.from({length: n}, (_, i) => jetAt(t - span + (i / (n - 1)) * span, J(t - span + (i / (n - 1)) * span)).kPa);
