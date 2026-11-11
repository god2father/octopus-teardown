// Mellis HB-7, the console film: the bee in the studio (stage.js) under the lab sheet (console.js). It takes off,
// the operator checks the optics, releases the right forewing at its hinge, pulls leg L2 apart joint by joint,
// opens the thorax drive and the abdomen capsule, tears the whole drone down on the turntable, reassembles it and
// hands it back hovering with motion blur on; then it lands, so the loop closes. Everything is a function of t.
import {runSim} from 'teardown-kit/runtime.js';
import {bodyPose, legLoad, LEG_NAMES, SPEC, strokeHist, wingAt} from './kin.js';
import {createConsole, FOCUS_KEYS} from './console.js';
import {createBeeStage} from './stage.js';

export const SCRIPT = [
  {t: 0, focus: 'hero'},
  {t: 2.6, focus: 'optics'},
  {t: 5.0, focus: 'wing'},
  {t: 7.6, focus: 'leg'},
  {t: 10.2, focus: 'thorax'},
  {t: 12.8, focus: 'abdomen'},
  {t: 15.4, display: 'exploded', on: 1},
  {t: 17.4, display: 'turn', on: 1},
  {t: 19.4, display: 'exploded', on: 0},
  {t: 21.0, focus: 'hero', reset: 1},
  {t: 21.5, display: 'blur', on: 1},
];
export const DURATION = 24;
const TAKEOFF = [0.4, 2.4];
const LANDING = [22.9, 23.9];
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'Mellis HB-7', subtitle: ''}, director: {enabled: false}, watermark: ''};
export const ACTIONS = SCRIPT.filter((e) => e.t > 0).map((e) => e.t);
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));

const lastBefore = (t, pred) => {
  let e = null;
  for (const x of SCRIPT) if (x.t <= t && pred(x)) e = x;
  return e;
};
const level = (t, on, dur = 1.2) => {
  let v = 0;
  let prev = false;
  for (const e of SCRIPT) {
    if (e.t > t) break;
    const now = on(e, prev);
    if (now !== prev) {
      const from = v;
      v = from + ((now ? 1 : 0) - from) * ss(e.t, e.t + dur, t);
      prev = now;
    }
  }
  return v;
};
const focusIs = (k) => (e, prev) => (e.focus ? e.focus === k : prev);
const displayIs = (k) => (e, prev) => (e.reset ? false : e.display === k ? !!e.on : prev);
const TURN_ON = SCRIPT.find((e) => e.display === 'turn')?.t ?? Infinity;
const RESET = SCRIPT.find((e) => e.reset)?.t ?? Infinity;
const turnAt = (t) => {
  const ramp = (x) => (x <= 0 ? 0 : x < 1 ? 0.5 * x * x : x - 0.5);
  const a = 0.5 * (ramp(t - TURN_ON) - ramp(t - RESET));
  return a * (1 - ss(RESET, RESET + 1.8, t));
};
export const liftAt = (t) => ss(TAKEOFF[0], TAKEOFF[1], t) * (1 - ss(LANDING[0], LANDING[1], t));
const ACT_TXT = {optics: 'OPTICS', wing: 'WING', leg: 'LEG L2', thorax: 'THORAX', abdomen: 'ABDOMEN', hero: 'HERO'};

/** Everything the frame needs from the script: focus, eased levels, display toggles. */
export function stateAt(t) {
  t = Math.max(0, t);
  const f = lastBefore(t, (e) => e.focus);
  const v = lastBefore(t, (e) => e.focus || e.display);
  const exOn = lastBefore(t, (e) => e.reset || e.display === 'exploded');
  const tOn = lastBefore(t, (e) => e.reset || e.display === 'turn');
  const exploding = !!(exOn && !exOn.reset && exOn.on);
  const turning = !!(tOn && !tOn.reset && tOn.on);
  const S = {
    focus: f.focus,
    since: t - v.t,
    view: exploding ? 'wide' : turning ? 'turn' : f.focus,
    lift: liftAt(t),
    optic: level(t, focusIs('optics'), 0.8),
    wing: level(t, focusIs('wing'), 1.2),
    leg: level(t, focusIs('leg'), 1.4),
    thorax: level(t, focusIs('thorax'), 1.4),
    abdomen: level(t, focusIs('abdomen'), 1.4),
    display: {labels: level(t, displayIs('labels'), 0.5), exploded: level(t, displayIs('exploded'), 1.8), blur: level(t, displayIs('blur'), 0.5), turn: level(t, displayIs('turn'), 0.4)},
    turnA: turnAt(t),
    landing: t >= LANDING[0],
    action:
      v.t === 0 ? 'TAKE-OFF' : v.reset ? 'HERO · RELEASE' : v.display ? `${{exploded: 'EXPLODED', turn: 'TURNTABLE', blur: 'MOTION BLUR'}[v.display]} ${v.on ? 'ON' : 'OFF'}${v.display === 'exploded' && !v.on ? ' · REASSEMBLE' : ''}` : `ISOLATE ${ACT_TXT[v.focus]}`,
  };
  // the view changes when the exploded/turn displays do; since counts from that event
  const vEv = lastBefore(t, (e) => e.focus || e.display === 'exploded' || e.display === 'turn');
  S.since = t - vEv.t;
  return S;
}

/** The bee's ops for a state. */
export const opsOf = (S) => ({
  lift: S.lift,
  power: S.lift,
  optic: S.optic,
  wing: S.wing,
  leg: S.leg,
  thorax: S.thorax,
  abdomen: S.abdomen,
  spread: S.display.exploded,
  blur: S.display.blur,
  turn: S.turnA,
});

// ------------------------------------------------------------ views, degrees; scene units (the bee is drawn 10x)
export const VIEW_FN = {
  // the hero camera rides with the bee: low and close while it stands, rising and backing off as it lifts
  hero: (u, t) => {
    const L = t === undefined ? 1 : liftAt(t);
    return {tx: 0.05, ty: 0.62 + 0.6 * L, tz: -0.05, az: 30 + 1.2 * u, el: 9 + 3 * (1 - L), d: 3.7 + 1.5 * L, sx: 0, sy: -16 + 10 * (1 - L)};
  },
  optics: (u) => ({tx: 0, ty: 1.58, tz: 0.42, az: 16 + 1.4 * u, el: 9, d: 2.9, sx: 0, sy: -14}),
  wing: (u) => ({tx: 0.4, ty: 1.5, tz: -0.1, az: 60 + 1.5 * u, el: 58, d: 3.3, sx: 0, sy: -10}),
  leg: (u) => ({tx: -0.3, ty: 1.2, tz: 0.05, az: -66 + 1.2 * u, el: 8, d: 3.9, sx: 0, sy: -14}),
  thorax: (u) => ({tx: 0, ty: 1.55, tz: 0, az: 38 + 1.4 * u, el: 30, d: 3.5, sx: 0, sy: -12}),
  abdomen: (u) => ({tx: 0, ty: 1.4, tz: -0.4, az: 128 + 1.3 * u, el: 14, d: 3.4, sx: 0, sy: -14}),
  wide: (u) => ({tx: 0, ty: 1.42, tz: -0.05, az: 34 + 2 * u, el: 14, d: 5.6, sx: 0, sy: -14}),
  turn: (u) => ({tx: 0, ty: 1.42, tz: -0.05, az: 40, el: 12, d: 5.2, sx: 0, sy: -14}),
};
const VIEWS = (() => {
  const out = [];
  for (const e of SCRIPT) {
    if (!(e.focus || e.display === 'exploded' || e.display === 'turn')) continue;
    const v = stateAt(e.t + 1e-6).view;
    if (!out.length || out[out.length - 1][1] !== v) out.push([e.t, v]);
  }
  return out;
})();
const lerpDeg = (a, b, k) => a + ((((b - a + 540) % 360) - 180) * k);
export const viewAt = (t) => {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const cur = VIEW_FN[VIEWS[i][1]](t - VIEWS[i][0], t);
  if (i === 0) return cur;
  const prev = VIEW_FN[VIEWS[i - 1][1]](t - VIEWS[i - 1][0], t);
  const k = ss(VIEWS[i][0], VIEWS[i][0] + 1.8, t);
  const o = {};
  for (const key in cur) o[key] = key === 'az' ? lerpDeg(prev.az, cur.az, k) : prev[key] + (cur[key] - prev[key]) * k;
  const swing = Math.min(1, Math.abs(((cur.az - prev.az + 540) % 360) - 180) / 90);
  o.el += 10 * Math.sin(Math.PI * k) * swing;
  o.d += 1.2 * swing * Math.sin(Math.PI * k);
  return o;
};
export const toCam = (c) => ({...c, az: c.az * D2R, el: c.el * D2R});

// ------------------------------------------------------------ the operator's pointer
const REST = [[860, 600], [760, 260], [980, 520], [700, 480], [1000, 300]];
export function makeCursor(ui) {
  const EV = SCRIPT.filter((e) => e.t > 0).map((e) => ({t: e.t, spot: ui.spots[e.focus || e.display]}));
  const WP = [[0, 900, 620]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.75, ...REST[i % REST.length]]);
    WP.push([e.t - 0.12, ...e.spot]);
    WP.push([e.t + 0.3, ...e.spot]);
  });
  WP.push([DURATION, 900, 620]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const k = ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bow = Math.sin(Math.PI * k) * Math.min(30, len * 0.08);
    let press = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of EV) {
      if (t >= e.t - 0.07 && t < e.t + 0.1) press = true;
      if (t >= e.t && t < e.t + 0.55) {
        ring = 1 - (t - e.t) / 0.55;
        [rx, ry] = e.spot;
      }
    }
    return {x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0), y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0), press, ring, ringX: rx, ringY: ry};
  };
}

// ------------------------------------------------------------ callouts per view
const CALLS = {
  hero: [
    ['OPTIC HEAD', `2 × ${SPEC.lens} MM LENS`, (P) => P.opticHead(1)],
    ['WING HINGE', 'QUICK RELEASE', (P) => P.wingHinge()],
    ['ABDOMEN CAPSULE', 'GEAR TRAIN', (P) => P.abdomen()],
    ['POLLEN POD', 'HIND TIBIA', (P) => P.pollen()],
  ],
  optics: [
    ['OPTIC HEAD · L', 'COMPOUND SENSOR', (P) => P.opticHead(0)],
    ['SCAPE JOINT', 'ELBOWED ANTENNA', (P) => P.scape()],
    ['OCELLI', '3 LENSES', (P) => P.ocelli()],
    ['NECK BEARING', `${SPEC.neckSeg} SEGMENTS`, (P) => P.neck()],
  ],
  wing: [
    ['WING HINGE', 'QUICK RELEASE', (P) => P.wingHinge()],
    ['FOREWING', `${Math.round(SPEC.foreL * 1000)} MM SPAN`, (P) => P.forewing()],
    ['HINDWING', `${Math.round(SPEC.hindL * 1000)} MM SPAN`, (P) => P.hindwing()],
    ['CRANK GEAR', `${SPEC.beatHz} HZ`, (P) => P.crank()],
  ],
  leg: [
    ['COXA SERVO', 'HIP · 1 OF 3', (P) => P.leg(1, 'coxa')],
    ['KNEE JOINT', 'SERVO · 2 OF 3', (P) => P.leg(1, 'knee')],
    ['ANKLE JOINT', 'SERVO · 3 OF 3', (P) => P.leg(1, 'ankle')],
    ['TARSUS PAD', 'GRIP FOOT', (P) => P.leg(1, 'foot')],
  ],
  thorax: [
    ['DRIVE GEARS', `${SPEC.gears} GEARS`, (P) => P.driveGears()],
    ['ACTUATORS', `${SPEC.actuators} LINEAR`, (P) => P.actuator()],
    ['CRANK GEAR', `${SPEC.beatHz} HZ`, (P) => P.crank()],
    ['THORAX SHELL', 'LIFT-OFF', (P) => P.shell()],
  ],
  abdomen: [
    ['GEAR TRAIN', '3 GEARS', (P) => P.gearTrain()],
    ['RETURN SPRING', 'STEEL', (P) => P.spring()],
    ['STINGER', 'PROBE TIP', (P) => P.stinger()],
  ],
  wide: [
    ['WING HINGE', 'QUICK RELEASE', (P) => P.wingHinge()],
    ['NECK BEARING', `${SPEC.neckSeg} SEGMENTS`, (P) => P.neck()],
    ['OPTIC HEAD', `2 × LENS`, (P) => P.opticHead(1)],
    ['DRIVE GEARS', 'SPINNING FREE', (P) => P.driveGears()],
    ['ABDOMEN CAPSULE', 'GEAR TRAIN', (P) => P.abdomen()],
  ],
};
CALLS.turn = [];

const pct = (x) => Math.round(x * 100);
const modeOf = (S) => {
  const ex = S.display.exploded;
  if (S.view === 'wide' || S.view === 'turn') {
    const reass = S.view === 'turn' || (S.view === 'wide' && S.action.includes('OFF'));
    const deg = String(Math.round(((((S.turnA * 180) / Math.PI) % 360) + 360) % 360)).padStart(1, '0');
    return [reass ? 'REASSEMBLY' : 'TEARDOWN', `TURNTABLE ${deg}° · ${pct(ex)}% APART`];
  }
  if (S.lift < 0.97 && S.focus === 'hero') return [S.landing ? 'LANDING' : 'TAKE-OFF', `ALT ${(bodyPose(0, S.lift).y * 1000).toFixed(0)} MM AGL`];
  return {
    hero: ['HOVER', `STATION KEEPING · ${SPEC.hoverAlt * 1000} MM AGL`],
    optics: ['OPTICS TRACKING', `IRIS · ${Math.round(S.optic * 30)}% STOPPED`],
    wing: ['WING RELEASE', `R FOREWING · ${pct(S.wing)}% OUT`],
    leg: ['LEG L2 APART', `LEG L2 · ${pct(S.leg)}% APART`],
    thorax: ['THORAX OPEN', `SHELL · ${pct(S.thorax)}% APART`],
    abdomen: ['ABDOMEN OPEN', `CAPSULE · ${pct(S.abdomen)}% APART`],
  }[S.focus];
};

// ------------------------------------------------------------ console data for a frame
export function makeConsoleFrame(ui, st, hist = stateAt) {
  return (t, S, extra = {}) => {
    const ops = opsOf(S);
    const P = ops.power * Math.max(0, 1 - 4 * ops.spread); // on the bench the crank stops at once
    const w = wingAt(t, P);
    const sHist = strokeHist(t, (tt) => {
      const h = hist(tt);
      return h.lift * (1 - h.display.exploded);
    });
    const held = ops.spread;
    const bp = bodyPose(t, ops.lift, held);
    const Pt = st.robot.points;
    const fade = ss(0.9, 1.5, S.since) * (S.view === 'hero' ? Math.max(S.display.labels, 0) : 1);
    const callouts = (CALLS[S.view] || []).map(([name, sub, at], i) => {
      if (fade < 0.02) return null;
      const p = st.project(at(Pt));
      if (!p || p[0] < 330 || p[0] > 1270 || p[1] < 140 || p[1] > 750 || ui.covered(p[0], p[1])) return null;
      const dx = (i % 2 ? 1 : -1) * (90 + 30 * Math.floor(i / 2));
      const dy = -70 + Math.floor(i / 2) * 56;
      if (ui.covered(p[0] + dx * 2.6, p[1] + dy, 0)) return null;
      return {name, sub, at: p, dx, dy, o: fade * ss(0.9 + i * 0.18, 1.3 + i * 0.18, S.since)};
    });
    const [mName, mSub] = modeOf(S);
    const exp = ops.spread > 0.5;
    const detached = LEG_NAMES.map((n) => (exp || (n === 'L2' && S.leg > 0.5) ? 1 : 0));
    const wingTxt = S.wing > 0.05 ? {txt: 'RELEASED', c: 'a', focus: true} : w.hz ? {txt: `${SPEC.beatHz} HZ`, c: 'g', focus: false} : {txt: 'IDLE', c: '', focus: false};
    const D = (o) => (exp ? {txt: 'DETACHED', c: 'a', focus: o.focus} : o);
    ui.update({
      runtime: extra.runtime ?? t,
      status: mName,
      load: 0.03 + 0.62 * P * (0.8 + 0.2 * Math.abs(Math.sin(w.phase))),
      isoTag: S.view === 'wide' || S.view === 'turn' ? 'ISOLATE · ALL' : S.focus === 'hero' ? 'ISOLATE · HERO' : `ISOLATE · ${ACT_TXT[S.focus]}`,
      hz: w.hz,
      amp: w.ampDeg,
      sHist,
      battery: 81 - t * 0.04,
      draw: 4.2 + 32 * P + 3 * S.thorax,
      motor: 40 + 1.2 * P + 0.02 * (extra.runtime ?? t),
      loads: LEG_NAMES.map((_, i) => legLoad(i, t, ops.lift)),
      detached,
      alt: bp.y * 1000,
      vs: bp.vs * 1000 + (S.lift > 0.02 && S.lift < 0.98 ? 60 * Math.sign(t < 12 ? 1 : -1) : 0),
      pitch: bp.pitch / D2R,
      roll: bp.roll / D2R,
      speed: bp.speed,
      held: held > 0.5,
      focus: S.focus,
      display: S.display,
      paused: !!extra.paused,
      subsys: {
        optics: D({txt: 'TRACKING', c: 'g', focus: S.focus === 'optics'}),
        neck: D({txt: S.optic > 0.05 ? 'EXTENDED' : 'LOCKED', c: S.optic > 0.05 ? 'a' : 'g', focus: S.focus === 'optics'}),
        thorax: D(S.thorax > 0.05 ? {txt: 'OPEN', c: 'a', focus: true} : P > 0.05 ? {txt: 'RUNNING', c: 'g', focus: false} : {txt: 'IDLE', c: '', focus: false}),
        wing: D(wingTxt),
        leg: D(S.leg > 0.05 ? {txt: 'DETACHED', c: 'a', focus: true} : {txt: 'HOLDING', c: 'g', focus: false}),
        abdomen: D(S.abdomen > 0.05 ? {txt: 'OPEN', c: 'a', focus: true} : {txt: 'SEALED', c: 'g', focus: false}),
      },
      action: S.action,
      logT: extra.logT ?? t,
      logDur: DURATION,
      actions: ACTIONS,
      mode: {name: mName, sub: mSub},
      callouts,
      cursor: extra.cursor,
    });
  };
}

export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = createBeeStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, st);
    window.BEE = st;
    return {
      resize,
      render(t) {
        const S = stateAt(t);
        st.frame(t, toCam(viewAt(t)), opsOf(S));
        frame(t, S, {cursor: cursorAt(t)});
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
export {FOCUS_KEYS};
