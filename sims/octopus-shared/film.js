// Pelagos OC-8, the console film: the drone in the tank (stage.js) under the lab sheet (console.js). An operator
// checks the optics, opens the mantle down to the pump core, pulls arm R2 apart link by link, fires the siphon,
// opens the beak, explodes every assembly, spins it on the turntable and resets to the hero view. Eight actions,
// 25 seconds, everything a pure function of t.
import {runSim} from 'teardown-kit/runtime.js';
import {ARM_NAMES, ARMS, bodyPose, COUNTS, curlAt, JET_HZ, jetAt, LINK_R, SPEC} from './kin.js';
import {createConsole, FOCUS_KEYS} from './console.js';
import {createOctoStage} from './stage.js';

export const SCRIPT = [
  {t: 0, focus: 'hero'},
  {t: 2.2, focus: 'optics'},
  {t: 4.6, focus: 'mantle'},
  {t: 8.6, focus: 'arm'},
  {t: 12.4, focus: 'siphon'},
  {t: 15.4, focus: 'beak'},
  {t: 17.8, display: 'exploded', on: 1},
  {t: 20.0, display: 'turn', on: 1},
  {t: 22.2, focus: 'hero', reset: 1},
];
export const DURATION = 25;
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'Pelagos OC-8', subtitle: ''}, director: {enabled: false}, watermark: ''};
export const ACTIONS = SCRIPT.filter((e) => e.t > 0).map((e) => e.t);
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ the operator's state at t
const lastBefore = (t, pred) => {
  let e = null;
  for (const x of SCRIPT) if (x.t <= t && pred(x)) e = x;
  return e;
};
// a 0..1 level that follows a boolean of the script with an ease of `dur` seconds each way
const level = (t, on, dur = 1.2) => {
  let v = 0;
  let prev = false;
  for (const e of SCRIPT) {
    if (e.t > t) break;
    const now = on(e, prev);
    if (now !== prev) {
      const from = v;
      const to = now ? 1 : 0;
      v = from + (to - from) * ss(e.t, e.t + dur, t);
      prev = now;
    }
  }
  return v;
};
const focusIs = (k) => (e, prev) => (e.focus ? e.focus === k : prev);
const displayIs = (k) => (e, prev) => (e.reset ? false : e.display === k ? !!e.on : prev);
// the turntable's heading: 0.42 rad/s while on, eased back to the front on reset
const TURN_ON = SCRIPT.find((e) => e.display === 'turn')?.t ?? Infinity;
const RESET = SCRIPT.find((e) => e.reset)?.t ?? Infinity;
const turnAt = (t) => {
  const ramp = (x) => (x <= 0 ? 0 : x < 1 ? 0.5 * x * x : x - 0.5);
  const a = 0.42 * (ramp(t - TURN_ON) - ramp(t - RESET));
  return a * (1 - ss(RESET, RESET + 2, t));
};

/** Everything the frame needs from the script: focus, eased mechanism levels, display toggles. */
export function stateAt(t) {
  t = Math.max(0, t);
  const f = lastBefore(t, (e) => e.focus);
  const v = lastBefore(t, (e) => e.focus || e.display);
  const S = {
    focus: f.focus,
    since: t - v.t,
    view: v.display === 'exploded' ? 'wide' : v.display === 'turn' ? 'turn' : f.focus,
    mantle: level(t, focusIs('mantle'), 1.6),
    apartR2: level(t, focusIs('arm'), 1.8),
    jet: level(t, focusIs('siphon'), 0.8),
    beak: level(t, focusIs('beak'), 0.9),
    optic: level(t, focusIs('optics'), 0.8),
    display: {labels: level(t, displayIs('labels'), 0.5), exploded: level(t, displayIs('exploded'), 1.6), wake: level(t, displayIs('wake'), 0.5), turn: level(t, displayIs('turn'), 0.4)},
    turnA: turnAt(t),
    action: v.t === 0 ? 'HOLD STATION' : v.reset ? 'RESET · HERO' : v.display ? (v.display === 'exploded' ? 'EXPLODE ALL' : 'TURNTABLE ON') : `ISOLATE ${{optics: 'OPTICS', mantle: 'MANTLE', arm: 'ARM R2', siphon: 'SIPHON', beak: 'BEAK', hero: 'HERO'}[v.focus]}`,
  };
  return S;
}

/** The robot's ops for a state: what the mechanism is doing. */
export const opsOf = (S) => ({
  mantle: S.mantle,
  apart: [0, S.apartR2, 0, 0, 0, 0, 0, 0],
  jet: S.jet,
  beak: S.beak,
  optic: S.optic,
  spread: S.display.exploded,
  wake: S.display.wake,
  turn: S.turnA,
});

// ------------------------------------------------------------ views, degrees; u = seconds since the view began
export const VIEW_FN = {
  hero: (u) => ({tx: 0.05, ty: 0.78, tz: 0, az: 24 + 1.1 * u, el: 13, d: 6.4, sx: 0, sy: -12}),
  optics: (u) => ({tx: 0, ty: 0.9, tz: 0.25, az: 6 + 1.2 * u, el: 12, d: 3.8, sx: 0, sy: -10}),
  mantle: (u) => ({tx: 0, ty: 1.0, tz: 0, az: -28 + 1.6 * u, el: 28, d: 5.6, sx: 0, sy: -10}),
  arm: (u) => ({tx: -0.75, ty: 0.85, tz: 0.3, az: 36 - 1.2 * u, el: 15, d: 6.0, sx: 0, sy: -18}),
  siphon: (u) => ({tx: 0, ty: 0.8, tz: -0.4, az: 152 + 1.4 * u, el: 9, d: 5.4, sx: 0, sy: -14}),
  beak: (u) => ({tx: 0, ty: 0.55, tz: 0.1, az: 34 + 1.5 * u, el: 9, d: 5.0, sx: 0, sy: -20}),
  wide: (u) => ({tx: 0, ty: 0.9, tz: 0, az: 40 + 1.8 * u, el: 21, d: 7.6, sx: 0, sy: -12}),
  turn: (u) => ({tx: 0, ty: 0.85, tz: 0, az: 44, el: 16, d: 7.0, sx: 0, sy: -12}),
};
const VIEWS = SCRIPT.filter((e) => e.focus || e.display).map((e) => [e.t, stateAt(e.t + 1e-6).view]);
const lerpDeg = (a, b, k) => a + ((((b - a + 540) % 360) - 180) * k);
export const viewAt = (t) => {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const cur = VIEW_FN[VIEWS[i][1]](t - VIEWS[i][0]);
  if (i === 0) {
    // loop seam: ease in from where the last view ended
    return cur;
  }
  const prev = VIEW_FN[VIEWS[i - 1][1]](t - VIEWS[i - 1][0]);
  const k = ss(VIEWS[i][0], VIEWS[i][0] + 1.8, t);
  const o = {};
  for (const key in cur) o[key] = key === 'az' ? lerpDeg(prev.az, cur.az, k) : prev[key] + (cur[key] - prev[key]) * k;
  // a move through a wide swing backs off and climbs so the camera never passes through the drone
  const swing = Math.min(1, Math.abs(((cur.az - prev.az + 540) % 360) - 180) / 90);
  o.el += 10 * Math.sin(Math.PI * k) * swing;
  o.d += 1.5 * swing * Math.sin(Math.PI * k);
  return o;
};
export const toCam = (c) => ({...c, az: c.az * D2R, el: c.el * D2R});

// ------------------------------------------------------------ the operator's pointer, moving between buttons
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

// ------------------------------------------------------------ callouts per focus
const mm = (m) => `${Math.round(m * 1000)} MM`;
const CALLS = {
  hero: [
    ['MANTLE SHELL', `${SPEC.petals} PETALS · Ø ${mm(SPEC.mantleR * 2)}`, (P) => P.shellPetal()],
    ['OPTIC PORT', `${SPEC.lens} MM LENS`, (P) => P.optic(1)],
    ['ARM CHAIN', `${SPEC.links} LINKS PER ARM`, (P) => P.link(4, 4)],
    ['SUCTION WHEEL', `${COUNTS.wheels} ON 8 ARMS`, (P) => P.wheel(5, 6)],
  ],
  optics: [
    ['OPTIC PORT · L', `${SPEC.lens} MM LENS · ${SPEC.rim} MM RIM`, (P) => P.optic(1)],
    ['OPTIC PORT · R', 'IRIS STOPPED DOWN', (P) => P.optic(0)],
  ],
  mantle: [
    ['REACTOR RING', 'PUMP DRIVE', (P) => P.reactorRing()],
    ['DRIVE GEARS', '16 : 11 TEETH', (P) => P.driveGears()],
    ['PUMP CORE', `${SPEC.pistons} PISTONS`, (P) => P.pumpCore()],
    ['SHELL PETAL', `1 OF ${SPEC.petals} · HINGED`, (P) => P.shellPetal()],
    ['GLASS PORT', 'ACRYLIC · 8 MM', (P) => P.glassPort()],
  ],
  arm: [
    ['ROLL JOINT', 'ONE PER LINK', (P) => P.link(1, 3)],
    ['BOOT ACTUATOR', `INNER CORE · ${mm(LINK_R[6] * 1.04)}`, (P) => P.link(1, 7)],
    ['SUCTION WHEEL', `4 PER LINK · Ø ${mm(LINK_R[9] * 0.68)}`, (P) => P.wheel(1, 9)],
    ['SPIRAL TIP', `Ø ${mm(LINK_R[SPEC.links - 1] * 2)}`, (P) => P.tip(1)],
  ],
  siphon: [
    ['SIPHON NOZZLE', `${SPEC.flaps} FLAPS · ${JET_HZ} HZ`, (P) => P.siphon()],
    ['MANTLE', 'SQUEEZE 4.5 %', (P) => P.shellPetal()],
  ],
  beak: [
    ['BEAK', 'TWIN JAW', (P) => P.beak()],
    ['COLLAR', `${COUNTS.arms} ARM SOCKETS`, (P) => P.collar()],
  ],
};
CALLS.wide = CALLS.hero;
CALLS.turn = [];

const MODE = {
  hero: ['HOLDING', () => 'MANTLE · 0% APART'],
  optics: ['OPTICS TRACKING', (S) => `IRIS · ${Math.round(S.optic * 28)}% STOPPED`],
  mantle: ['MANTLE OPEN', (S) => `MANTLE · ${Math.round(S.mantle * 100)}% APART`],
  arm: ['ARM R2 APART', (S) => `ARM R2 · ${Math.round(S.apartR2 * 100)}% APART`],
  siphon: ['JETTING', () => `SIPHON · ${JET_HZ} HZ PULSE`],
  beak: ['BEAK OPEN', (S) => `BEAK · ${Math.round(S.beak * 48)}° GAPE`],
  wide: ['EXPLODED', (S) => `ALL ASSEMBLIES · ${Math.round(S.display.exploded * 100)}% APART`],
  turn: ['TURNTABLE', (S) => `HEADING · ${String(Math.round(((((S.turnA * 180) / Math.PI) % 360) + 360) % 360)).padStart(3, '0')}°`],
};

// ------------------------------------------------------------ console data for a frame
// hist(t) gives the state at any recent time (the film's script, or the live page's history)
export function makeConsoleFrame(ui, st, hist = stateAt) {
  return (t, S, extra = {}) => {
    const ops = opsOf(S);
    const jet = jetAt(t, S.jet);
    const pHist = Array.from({length: 90}, (_, i) => {
      const tt = t - 6 + (i / 89) * 6;
      return jetAt(tt, hist(tt).jet).kPa;
    });
    const bp = bodyPose(t);
    const bp1 = bodyPose(t - 0.1);
    const was = hist(t - 0.15);
    const curls = ARMS.map((_, i) => curlAt(i, t, ops.apart[i]));
    const curling = Math.abs(was.apartR2 - S.apartR2) > 0.004 || Math.abs(was.display.exploded - S.display.exploded) > 0.004;
    const P = st.robot.points;
    const fade = ss(0.9, 1.5, S.since) * (S.view === 'hero' ? Math.max(S.display.labels, 0) : 1);
    const list = CALLS[S.view] || [];
    const callouts = list.map(([name, sub, at], i) => {
      if (fade < 0.02) return null;
      const p = st.project(at(P));
      if (!p || p[0] < 330 || p[0] > 1270 || p[1] < 140 || p[1] > 750 || ui.covered(p[0], p[1])) return null;
      // labels fan out: alternate sides, stacked, so no two land on each other
      const dx = (i % 2 ? 1 : -1) * (90 + 30 * Math.floor(i / 2));
      const dy = -70 + Math.floor(i / 2) * 56;
      if (ui.covered(p[0] + dx * 2.6, p[1] + dy, 0)) return null;
      return {name, sub, at: p, dx, dy, o: fade * ss(0.9 + i * 0.18, 1.3 + i * 0.18, S.since)};
    });
    const [mName, mSub] = MODE[S.view] || MODE.hero;
    const det = ops.apart;
    ui.update({
      runtime: extra.runtime ?? t,
      status: S.view === 'hero' ? 'HOLDING' : mName,
      load: jet.load,
      isoTag: S.focus === 'hero' ? 'FREE ORBIT' : `ISOLATE · ${{optics: 'OPTICS', mantle: 'MANTLE', arm: 'ARM R2', siphon: 'SIPHON', beak: 'BEAK'}[S.focus]}`,
      kPa: jet.kPa,
      thrust: jet.thrust,
      hz: jet.hz,
      jet: S.jet,
      pHist,
      battery: 86 - t * 0.045,
      draw: 9.4 + 14 * S.jet + 9 * S.mantle * (1 - S.mantle) * 4 + 6 * S.apartR2 + 3 * S.beak + 2 * S.display.exploded,
      motor: 24 + 0.05 * (extra.runtime ?? t) + 3 * S.jet,
      curls,
      detached: det,
      curling,
      depth: 12.42 + 0.05 * Math.sin(t * 0.21) - (bp.y - SPEC.rideH),
      vs: -((bp.y - bp1.y) / 0.1) + 0.02 * Math.cos(t * 0.21),
      pitch: bp.pitch / (Math.PI / 180),
      roll: bp.roll / (Math.PI / 180),
      speed: 0.01 + 0.35 * jet.pulse,
      focus: S.focus,
      display: S.display,
      paused: !!extra.paused,
      subsys: {
        optics: {txt: 'TRACKING', c: 'g', focus: S.focus === 'optics'},
        mantle: S.mantle > 0.05 ? {txt: 'OPEN', c: 'a', focus: S.focus === 'mantle'} : {txt: 'SEALED', c: 'g', focus: false},
        core: S.mantle > 0.3 ? {txt: 'EXPOSED', c: 'a', focus: S.focus === 'mantle'} : {txt: 'RUNNING', c: 'g', focus: false},
        arm: S.apartR2 > 0.05 ? {txt: 'DETACHED', c: 'a', focus: true} : {txt: '8 / 8 LIVE', c: 'g', focus: false},
        siphon: S.jet > 0.05 ? {txt: 'JETTING', c: 'a', focus: true} : {txt: 'IDLE', c: '', focus: false},
        beak: S.beak > 0.05 ? {txt: 'OPEN', c: 'a', focus: true} : {txt: 'SEALED', c: 'g', focus: false},
      },
      action: S.action,
      logT: extra.logT ?? t,
      logDur: DURATION,
      actions: ACTIONS,
      mode: {name: mName, sub: mSub(S), o: 1},
      callouts,
      cursor: extra.cursor,
    });
  };
}

export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = createOctoStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, st);
    window.OCTO = st;
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
export {ARM_NAMES, FOCUS_KEYS};
