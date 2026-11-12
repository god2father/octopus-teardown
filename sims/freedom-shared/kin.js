// Freedom, the math. A personal fan tribute to the ZGMF-X10A: real height and mass from the published spec, every
// other number is ours but held in one place. Metres, seconds, megawatts; no three.js in here. The operator gives
// levels (lift, wing spread, burst, phase shift); every joint angle, every wing and cannon pivot, the reactor's
// output and its share on each bus line are functions of those levels and the clock. The console reads the same.

export const SPEC = {
  height: 18.03, // m, to the tip of the V-fin
  mass: 71.5, // t
  scale: 0.1, // scene units per metre
  // skeleton, rest pose, feet on the floor (y = 0 under the soles). Read off the reference sheet at 17.4 mm/px.
  hipX: 1.15,
  hipY: -0.45, // hip joint below the pelvis centre
  thigh: 2.75,
  shin: 5.45, // 5.15 m straight; the extra 0.09 m pays for the bent knee so the fin tip stays at 18.03 m
  ankle: 2.45, // ankle joint above the sole (ankle-guard top 3.1 m on the reference)
  waistY: 0.65, // waist joint above the pelvis centre
  shoulderX: 2.5,
  shoulderY: 3.06, // above the waist joint
  neckY: 3.99,
  upperArm: 1.7, // the elbow block sits 13.1 m up on the reference front view
  foreArm: 2.8,
  hand: 2.0,
  packY: 2.75,
  packZ: -0.9,
  // weapons
  xiphiasL: 7.2, // rail cannon, stowed length
  xiphiasExt: 1.0,
  // flight
  hoverAlt: 5.2, // m, soles above the floor when hovering
  // power, ours: rated output and the draw of every line at full use
  rated: 12.0, // MW
  draw: {ps: 1.4, thrust: 5.2, xiphias: 1.6, actuators: 0.5, ciws: 0.12, sensors: 0.2},
  burstPeriod: 3.0, // s, one charge-and-fire cycle
  deployT: 1.6, // s, cannons from stowed to locked
  chargeT: 1.85, // s, capacitors from empty to full
  fireT: 0.55, // s, the volley
};

SPEC.pelvisY = SPEC.ankle + SPEC.shin + SPEC.thigh - SPEC.hipY; // 10.85 m

export const BUS = ['PS ARMOR', 'THRUSTERS', 'XIPHIAS L', 'XIPHIAS R', 'ACTUATORS', 'CIWS · SENSORS'];
export const GUNS = ['XIPHIAS L', 'XIPHIAS R'];

const D2R = Math.PI / 180;
export const smooth = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
const lerp = (a, b, k) => a + (b - a) * k;
const lerpArr = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));

/** The rail cannons' deploy fraction from the operator's levels; the arms brace as the burst comes up. */
export function deployOf(burst, rail = 0) {
  return {xiphias: Math.max(smooth(0, 0.85, burst), smooth(0, 1, rail)), aim: smooth(0.2, 1.0, burst)};
}

/**
 * The volley: bt is seconds since the burst order. Cannons deploy for deployT, then every burstPeriod the
 * capacitors charge for chargeT and both rails fire inside fireT, 60 ms apart.
 */
export function burstCycle(bt, burst) {
  const live = smooth(0.92, 1, burst);
  if (bt < SPEC.deployT || live <= 0) return {charge: 0, fire: [0, 0], firing: false, phase: 'DEPLOYING', cycle: 0, shots: 0, recoil: 0};
  const u = bt - SPEC.deployT;
  const n = Math.floor(u / SPEC.burstPeriod);
  const c = u - n * SPEC.burstPeriod;
  const charge = c < SPEC.chargeT ? smooth(0, 1, c / SPEC.chargeT) : Math.max(0, 1 - (c - SPEC.chargeT) / SPEC.fireT);
  const fire = [0, 1].map((i) => {
    const f0 = SPEC.chargeT + i * 0.06;
    const k = (c - f0) / (SPEC.fireT - 0.16);
    return k >= 0 && k <= 1 ? Math.sin(Math.PI * Math.pow(k, 0.6)) * live : 0;
  });
  const firing = c >= SPEC.chargeT && c < SPEC.chargeT + SPEC.fireT;
  const rk = c - SPEC.chargeT;
  return {
    charge: charge * live,
    fire,
    firing,
    phase: firing ? 'FIRING' : c < SPEC.chargeT ? 'CHARGING' : 'COOLING',
    cycle: c,
    shots: (n + (c >= SPEC.chargeT ? 1 : 0)) * 2,
    recoil: rk >= 0 ? Math.exp(-rk * 5) * (1 - Math.exp(-rk * 40)) * live : 0,
  };
}

/** The rail cannons' pivots: stowed they hang down the legs, deployed they are level and forward, slid out. */
export function cannonAt(dep) {
  const x = smooth(0, 0.8, dep.xiphias);
  return {xiphiasPitch: -lerp(0, 90, x) * D2R, xiphiasExt: SPEC.xiphiasExt * smooth(0.75, 1, dep.xiphias)};
}

// ------------------------------------------------------------ the body's three poses (degrees), blended
// shoulder [pitch fwd, roll out], elbow, hip [pitch fwd, roll out], knee, ankle (toe down), waist [pitch, yaw]
// stand is the reference's A-pose: legs splayed 13 degrees, arms out 23 degrees, hands open
const POSE = {
  stand: {sh: [[2, 23], [2, 23]], el: [9, 9], hip: [[13, 13], [13, 13]], kn: [24, 24], an: [-11, -11], waist: [0, 0], head: [0, 0]},
  fly: {sh: [[-6, 22], [-2, 24]], el: [26, 32], hip: [[24, 11], [-4, 13]], kn: [50, 20], an: [26, 30], waist: [4, 0], head: [-4, 0]},
  burst: {sh: [[26, 26], [26, 26]], el: [48, 48], hip: [[12, 15], [-6, 15]], kn: [26, 14], an: [14, 18], waist: [6, 0], head: [-6, 0]},
};
// index 0 is the suit's right side, 1 its left
export function poseAt(t, lift, aim, head = 0) {
  const mix = (k) => {
    const a = POSE.stand;
    const b = POSE.fly;
    const c = POSE.burst;
    const v = (pa, pb, pc) => lerp(lerp(pa, pb, lift), pc, aim);
    return {
      sh: [0, 1].map((i) => [v(a.sh[i][0], b.sh[i][0], c.sh[i][0]), v(a.sh[i][1], b.sh[i][1], c.sh[i][1])]),
      el: [0, 1].map((i) => v(a.el[i], b.el[i], c.el[i])),
      hip: [0, 1].map((i) => [v(a.hip[i][0], b.hip[i][0], c.hip[i][0]), v(a.hip[i][1], b.hip[i][1], c.hip[i][1])]),
      kn: [0, 1].map((i) => v(a.kn[i], b.kn[i], c.kn[i])),
      an: [0, 1].map((i) => v(a.an[i], b.an[i], c.an[i])),
      waist: [v(a.waist[0], b.waist[0], c.waist[0]), v(a.waist[1], b.waist[1], c.waist[1])],
      head: [v(a.head[0], b.head[0], c.head[0]), v(a.head[1], b.head[1], c.head[1])],
    };
  };
  const p = mix();
  // alive: a slow breathing sway in the arms and legs while flying, a scan in the head
  const air = lift * (1 - aim);
  p.sh[0][0] += 3 * Math.sin(t * 0.9) * air;
  p.sh[1][0] += 3 * Math.sin(t * 0.9 + 1.4) * air;
  p.kn[0] += 4 * Math.sin(t * 0.7) * air;
  p.kn[1] += 3 * Math.sin(t * 0.7 + 2) * air;
  // head saccades: quick turns then holds
  const sac = (rate, seed, amp) => {
    const n = Math.floor(t * rate + seed);
    const f = t * rate + seed - n;
    const h = (x) => ((Math.sin(x * 12.9898 + seed * 78.233) * 43758.5453) % 1);
    return amp * (h(n) + (h(n + 1) - h(n)) * smooth(0, 0.2, f));
  };
  p.head[1] += sac(0.5, 0.3, 14) * (0.4 + head);
  p.head[0] += sac(0.4, 2.1, 6) * (0.4 + head);
  const r = (a) => a * D2R;
  return {
    sh: p.sh.map((x) => x.map(r)),
    el: p.el.map(r),
    hip: p.hip.map((x) => x.map(r)),
    kn: p.kn.map(r),
    an: p.an.map(r),
    waist: p.waist.map(r),
    head: p.head.map(r),
  };
}

/** The suit's flight path: soles from the floor to hoverAlt, a slow Lissajous drift, banking into it. */
const DRIFT = {ax: 0.32, wx: 0.29, az: 0.22, wz: 0.21, pz: 1.1, ay: 0.14, wy: 0.43};
export function bodyPose(t, lift, held = 0, recoil = 0) {
  const air = Math.max(lift, held);
  const k = lift * (1 - held);
  const D = DRIFT;
  const vx = D.ax * D.wx * Math.cos(t * D.wx) * k;
  const vz = D.az * D.wz * Math.cos(t * D.wz + D.pz) * k;
  const vy = D.ay * D.wy * Math.cos(t * D.wy) * k;
  const alt = SPEC.hoverAlt * smooth(0, 1, air) + D.ay * Math.sin(t * D.wy) * k;
  return {
    x: D.ax * Math.sin(t * D.wx) * k,
    alt,
    z: D.az * Math.sin(t * D.wz + D.pz) * k - 0.55 * recoil,
    pitch: (6 * k - 7 * recoil) * D2R + vz * 0.3,
    roll: -vx * 0.35,
    vs: vy,
    speed: Math.hypot(vx, vz),
  };
}

/** Thrust, share of rated: hover needs the suit's weight, lift-off and the volley's recoil a little more. */
export function thrustOf(lift, dLift, recoil) {
  return Math.min(1, lift * 0.58 + Math.max(0, dLift) * 0.35 + 0.2 * recoil);
}

/** The reactor and its bus: draw per line in MW, output, load and core temperature. */
export function powerAt({ps, thrust, dep, cyc, head = 0, t}) {
  const D = SPEC.draw;
  const hold = 0.12; // a deployed cannon keeps its rails and capacitors warm
  const chargeRate = cyc.charge > 0 && !cyc.firing && cyc.cycle < SPEC.chargeT ? 1 : 0;
  const fireK = cyc.firing ? 1.6 : 0;
  const lines = [
    D.ps * ps * (1 + 0.05 * Math.sin(t * 3.3)),
    D.thrust * thrust + 0.25,
    D.xiphias * (hold * dep.xiphias + chargeRate * dep.xiphias + fireK * cyc.fire[0]),
    D.xiphias * (hold * dep.xiphias + chargeRate * dep.xiphias + fireK * cyc.fire[1]),
    D.actuators * (0.25 + 0.5 * thrust + 0.6 * dep.aim),
    D.ciws + D.sensors * (1 + head),
  ];
  const out = lines.reduce((a, b) => a + b, 0);
  const load = out / SPEC.rated;
  return {lines, out, load, temp: 310 + 290 * load};
}

/**
 * The whole machine at time t for the operator's levels: the single source the geometry poses from and the console
 * reads. ops: lift, burst, bt, rail, ps, head, explode, dLift (rate of lift, 1/s, for the climb thrust).
 */
export function machineAt(t, ops = {}) {
  const lift = ops.lift ?? 1;
  const E = ops.explode ?? 0;
  const E1 = smooth(0, 0.6, E);
  const burst = (ops.burst ?? 0) * (1 - E1);
  const dep = deployOf(burst, (ops.rail ?? 0) * (1 - E1));
  const cyc = burstCycle(ops.bt ?? 0, burst);
  const can = cannonAt(dep);
  const bp = bodyPose(t, lift, E, cyc.recoil);
  const thrust = thrustOf(lift * (1 - E), ops.dLift ?? 0, cyc.recoil) * (1 - E1);
  const ps = ops.ps ?? 1;
  const power = powerAt({ps, thrust, dep, cyc, head: ops.head ?? 0, t});
  return {lift, E, E1, burst, dep, cyc, can, bp, thrust, ps, power};
}

export const COUNTS = {guns: 2, joints: 22};
export {D2R, lerp, lerpArr};
