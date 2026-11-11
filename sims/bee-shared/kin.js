// Mellis HB-7, the math. Real dimensions in metres, no three.js in here. One clock drives everything: the wing
// stroke is a sine at the crank frequency scaled by how much power the operator gives the flight motor, the body
// lifts with that power from standing to its 144 mm hover, and every leg is solved by two-link IK from its hip
// to a foot target (on the floor when standing, hanging when airborne). The console reads the same functions.

export const SPEC = {
  bodyL: 0.135, // nose of the head to the stinger tip, m
  headR: 0.0195, // about as wide as the thorax, as on a honeybee
  headZ: 0.044,
  headK: 1.16, // the head is an egg: stretched this much nose to back
  lens: 18, // optic lens, mm
  eyeR: 0.0105,
  neckSeg: 10,
  neckZ0: 0.019,
  neckZ1: 0.032,
  thoraxR: 0.019,
  gears: 3,
  actuators: 12,
  hinges: 4,
  beatHz: 7.5, // wing crank frequency (shown at playback 1.0x)
  amp: 45, // fore-aft stroke amplitude, degrees each way: a honeybee's stroke is about 90 deg in all
  foreL: 0.096, // a honeybee's forewing is about 0.7 of its body length
  foreC: 0.03,
  hindL: 0.066,
  hindC: 0.021,
  coxa: 0.011,
  femur: 0.032,
  tibia: 0.034,
  tarsus: 0.016,
  standH: 0.04, // body centre above the floor when standing, m: a bee sits low on bent legs
  hoverAlt: 0.144, // hover altitude, m AGL (body centre)
  abdZ0: -0.027, // the abdomen hangs off a narrow petiole behind the thorax
  petiole: [-0.0185, -0.028],
  abdZ1: -0.09,
  cell: 3.7,
  scale: 10, // scene units per metre: the bee is drawn ten times life size
};

export const LEG_NAMES = ['L1', 'L2', 'L3', 'R1', 'R2', 'R3'];
const D2R = Math.PI / 180;
export const smooth = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// hips on the thorax underside: three pairs, front to back; side -1 is the bee's left (+x is its right... we keep
// L on -x so the hero view from the front-left shows L legs nearest)
export const LEGS = LEG_NAMES.map((name, i) => {
  const side = name[0] === 'L' ? -1 : 1;
  const k = i % 3;
  return {
    name,
    side,
    k,
    hip: [side * 0.011, -0.012, 0.009 - k * 0.01],
    // insect proportions: short forelegs, long hind legs (the pollen legs)
    len: [0.82, 1.0, 1.22][k],
    // where the foot stands, body frame at stance height: splayed out, front legs forward, hind legs back
    stand: [side * (0.04 + 0.005 * (k === 1)), 0, [0.04, 0.003, -0.042][k]],
    // in flight, as a bee carries them: forelegs folded up under the head, middle legs out to the side, hind legs
    // trailing back and low
    hang: [[side * 0.014, -0.028, 0.034], [side * 0.032, -0.046, -0.002], [side * 0.022, -0.066, -0.058]][k],
    ph: i * 1.13,
  };
});

/**
 * Insect wing kinematics, P is flight power 0..1. The wing sweeps fore and aft in a near-horizontal stroke plane
 * (stroke, + forward), the tip traces a figure-eight (elevation at twice the beat), and the wing flips its angle
 * of attack at each end of the stroke (pronation / supination), quickly, then holds it through the stroke.
 * fold is how far the wings lie back over the abdomen: 1 at rest, 0 in flight.
 */
export function wingAt(t, P) {
  const ph = t * SPEC.beatHz * Math.PI * 2;
  const A = SPEC.amp * D2R * P;
  const c = Math.cos(ph);
  return {
    phase: ph,
    stroke: A * Math.sin(ph),
    elev: P * (0.1 + 0.16 * Math.sin(2 * ph)),
    // a squared-off flip: steep near reversal, flat mid-stroke
    feather: P * 0.85 * Math.tanh(2.6 * c),
    fold: 1 - smooth(0.02, 0.35, P),
    hz: P > 0.04 ? SPEC.beatHz : 0,
    ampDeg: SPEC.amp * P,
  };
}

/** The head scans: small saccades (quick turns, then a hold) in yaw and pitch, eased so nothing snaps. */
export function headAt(t, k) {
  const sac = (rate, seed, amp) => {
    const n = Math.floor(t * rate + seed);
    const f = t * rate + seed - n;
    const h = (x) => Math.sin(x * 12.9898 + seed * 78.233) * 43758.5453 % 1;
    const a = h(n);
    const b = h(n + 1);
    return amp * (a + (b - a) * smooth(0.0, 0.18, f));
  };
  return {yaw: sac(0.55, 0.3, 0.16) * k, pitch: (sac(0.4, 2.1, 0.08) - 0.02) * k};
}

/** Antennae: each sways on its own, a damped spring behind the head's saccades. */
export function antennaAt(t, side, k) {
  const s = side > 0 ? 0 : 1.7;
  return {
    a: (0.09 * Math.sin(t * 2.3 + s) + 0.05 * Math.sin(t * 5.1 + s * 2) + 0.03 * Math.sin(t * 9.7 + s)) * k,
    b: (0.07 * Math.sin(t * 1.7 + s * 1.3) + 0.04 * Math.sin(t * 4.3 + s)) * k,
  };
}

/** The abdomen at its petiole: a slow breathing pump, a counter-sway against the body's drift. */
export function abdomenAt(t, k) {
  return {
    pitch: (0.035 * Math.sin(t * 2 * Math.PI * 1.1) + 0.02 * Math.sin(t * 0.47)) * k,
    yaw: 0.03 * Math.sin(t * 0.31 + 2) * k,
    pump: 0.025 * Math.sin(t * 2 * Math.PI * 1.1) * k,
  };
}

/** Body pose: lift 0 standing, 1 hovering; held is 1 while it is clamped on the bench (teardown) at hover height. */
// Hover drift: the body glides on a slow Lissajous loop (no motion at the wingbeat frequency, so the airframe
// reads as steady), banks into its sideways velocity and dips its nose into forward velocity, like a real hover
// holding station against a light draught. Every readout below is the derivative of the same path.
const DRIFT = {ax: 0.014, wx: 0.31, az: 0.01, wz: 0.23, pz: 1.1, ay: 0.004, wy: 0.47};
export function bodyPose(t, lift, held = 0) {
  const air = Math.max(lift, held);
  const h = SPEC.standH + (SPEC.hoverAlt - SPEC.standH) * air;
  const k = lift * (1 - held);
  const D = DRIFT;
  const vx = D.ax * D.wx * Math.cos(t * D.wx) * k;
  const vz = D.az * D.wz * Math.cos(t * D.wz + D.pz) * k;
  const vy = D.ay * D.wy * Math.cos(t * D.wy) * k;
  return {
    x: D.ax * Math.sin(t * D.wx) * k,
    y: h + D.ay * Math.sin(t * D.wy) * k,
    z: D.az * Math.sin(t * D.wz + D.pz) * k,
    pitch: -9 * D2R * k + vz * 10, // a hovering insect carries its body head-up
    roll: -vx * 12,
    yaw: 0,
    vs: vy,
    vel: [vx, vy, vz],
    speed: Math.hypot(vx, vz),
  };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / (len(a) || 1));
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/**
 * One leg in the body frame: hip, coxa end, knee, ankle, foot. lift 0..1 blends the stance (feet on the floor,
 * which sits at -bodyY in the body frame) into the hanging flight pose. Knee bends up and out, like the reference.
 */
export function legPose(i, t, lift, bodyY, vel = [0, 0, 0]) {
  const L = LEGS[i];
  const H = L.hip;
  const C = add(H, mul(norm([L.side * 0.85, -0.45, (1 - L.k) * 0.25]), SPEC.coxa));
  // hanging legs swing loosely and trail the body's drift (they lag ~0.8 s behind its velocity)
  const sway = 0.004 * Math.sin(t * 1.7 + L.ph) * lift;
  const lag = mul(vel, -0.8 * (0.7 + 0.3 * L.k) * lift);
  const standFoot = [L.stand[0], -bodyY, L.stand[2]];
  const F = lerp3(standFoot, add(add(L.hang, [0, sway, sway * (L.k === 2 ? 1.6 : 1)]), lag), smooth(0, 1, lift));
  // in flight the tarsus curls back under the foot; standing it plants flat
  const A = add(F, [L.side * -0.003, SPEC.tarsus * 0.9 * (1 - 0.3 * lift), SPEC.tarsus * 0.45 * lift]);
  const Lf = SPEC.femur * L.len;
  const Lt = SPEC.tibia * L.len;
  let d = sub(A, C);
  let D = len(d);
  D = Math.min(D, Lf + Lt - 1e-4);
  const u = norm(d);
  const a = (Lf * Lf - Lt * Lt + D * D) / (2 * D);
  const h = Math.sqrt(Math.max(0, Lf * Lf - a * a));
  // bend direction: up and away from the body
  let n = add([0, 1, 0], [L.side * 0.6, 0, 0]);
  n = norm(sub(n, mul(u, dot(n, u))));
  const K = add(add(C, mul(u, a)), mul(n, h));
  const A2 = add(C, mul(u, D));
  return {hip: H, coxa: C, knee: K, ankle: A2, foot: add(A2, sub(F, A))};
}

/** Knee torque per leg as a share of the servo's rating: standing carries the body, hovering only the leg. */
export function legLoad(i, t, lift) {
  const L = LEGS[i];
  const stand = 0.62 + 0.08 * (L.k === 1) + 0.05 * Math.sin(t * 0.8 + L.ph);
  const hang = 0.5 + 0.18 * Math.sin(t * 1.3 + L.ph) + 0.06 * Math.sin(t * 3.1 + L.ph * 2);
  return stand + (hang - stand) * lift;
}

export const COUNTS = {legs: 6, wings: 4, optics: 2, joints: 18};

/** The stroke trace the WING BEAT panel draws: degrees over the last `span` seconds. */
export const strokeHist = (t, P, span = 1.5, n = 120) =>
  Array.from({length: n}, (_, i) => {
    const tt = t - span + (i / (n - 1)) * span;
    return wingAt(tt, P(tt)).stroke / D2R;
  });
