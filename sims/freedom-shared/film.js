// Freedom, the console film: the suit stands grey on the pad, the operator throws the phase shift and the armor
// takes its colours, it lifts off into high-mobility flight with the wings fanning open, then the tour: head
// sensors, a wing pulled from its binder, the core opened to the reactor, an x-ray of the power lines, the rail
// cannons, a full burst (five guns, one volley), the teardown on the turntable, reassembly, landing, armor grey.
// The last frame matches the first, so it loops. Everything is a function of t.
import {runSim} from 'teardown-kit/runtime.js';
import {GUNS, machineAt, SPEC} from './kin.js';
import {createConsole, DISPLAY_TXT, FOCUS_KEYS, FOCUS_TXT} from './console.js';
import {createStage} from './stage.js';

export const SCRIPT = [
  {t: 0, focus: 'hero'},
  {t: 1.2, display: 'ps', on: 1},
  {t: 6.0, focus: 'head'},
  {t: 8.6, focus: 'pack'},
  {t: 11.2, focus: 'reactor'},
  {t: 13.6, display: 'xray', on: 1},
  {t: 15.6, display: 'xray', on: 0},
  {t: 16.6, focus: 'railgun'},
  {t: 19.2, focus: 'burst'},
  {t: 24.0, display: 'exploded', on: 1, focus: 'hero'},
  {t: 26.0, display: 'turn', on: 1},
  {t: 28.0, display: 'exploded', on: 0},
  {t: 29.6, focus: 'hero', reset: 1},
  {t: 33.6, display: 'ps', on: 0},
];
export const DURATION = 35;
const TAKEOFF = [2.6, 5.0];
const LANDING = [31.0, 33.0];
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'Freedom', subtitle: ''}, director: {enabled: false}, watermark: ''};
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
const displayIs = (k) => (e, prev) => (e.reset && k !== 'ps' && k !== 'labels' ? false : e.display === k ? !!e.on : prev);
const TURN_ON = SCRIPT.find((e) => e.display === 'turn')?.t ?? Infinity;
const RESET = SCRIPT.find((e) => e.reset)?.t ?? Infinity;
const turnAt = (t) => {
  const ramp = (x) => (x <= 0 ? 0 : x < 1 ? 0.5 * x * x : x - 0.5);
  const a = 0.5 * (ramp(t - TURN_ON) - ramp(t - RESET));
  return a * (1 - ss(RESET, RESET + 1.8, t));
};
export const liftAt = (t) => ss(TAKEOFF[0], TAKEOFF[1], t) * (1 - ss(LANDING[0], LANDING[1], t));
const ACT_TXT = {...FOCUS_TXT};

/** Everything the frame needs from the script: focus, eased levels, display toggles. */
export function stateAt(t) {
  t = Math.max(0, t);
  const f = lastBefore(t, (e) => e.focus);
  const v = lastBefore(t, (e) => e.focus || e.display);
  const exOn = lastBefore(t, (e) => e.reset || e.display === 'exploded');
  const tOn = lastBefore(t, (e) => e.reset || e.display === 'turn');
  const exploding = !!(exOn && !exOn.reset && exOn.on);
  const turning = !!(tOn && !tOn.reset && tOn.on);
  const bOn = lastBefore(t, (e) => e.focus === 'burst');
  const S = {
    focus: f.focus,
    view: turning ? 'turn' : exploding ? 'wide' : f.focus,
    lift: liftAt(t),
    dLift: (liftAt(t + 0.05) - liftAt(t)) / 0.05,
    head: level(t, focusIs('head'), 0.8),
    pack: level(t, focusIs('pack'), 1.0),
    reactor: level(t, focusIs('reactor'), 1.4),
    rail: level(t, focusIs('railgun'), 1.6),
    burst: level(t, focusIs('burst'), 1.4),
    bt: bOn ? t - bOn.t : 0,
    display: {
      labels: level(t, displayIs('labels'), 0.5),
      ps: level(t, displayIs('ps'), 1.4),
      xray: level(t, displayIs('xray'), 0.6),
      exploded: level(t, displayIs('exploded'), 2.2),
      turn: level(t, displayIs('turn'), 0.4),
    },
    turnA: turnAt(t),
    landing: t >= LANDING[0] - 0.5,
    action: v.t === 0 ? 'GROUND STANDBY' : v.reset ? 'HERO · RELEASE' : v.display ? `${DISPLAY_TXT[v.display]} ${v.on ? 'ON' : 'OFF'}${v.display === 'exploded' && !v.on ? ' · REASSEMBLE' : ''}` : `ISOLATE ${ACT_TXT[v.focus]}`,
  };
  const vEv = lastBefore(t, (e) => e.focus || e.display === 'exploded' || e.display === 'turn');
  S.since = t - vEv.t;
  return S;
}

/** The suit's ops for a state. */
export const opsOf = (S) => ({
  lift: S.lift,
  dLift: S.dLift ?? 0,
  burst: S.burst,
  bt: S.bt,
  rail: S.rail,
  head: S.head,
  reactor: S.reactor,
  ps: S.display.ps,
  xray: S.display.xray,
  explode: S.display.exploded,
  turn: S.turnA,
});

// ------------------------------------------------------------ views, degrees; scene units (the suit is drawn at 1/10)
export const VIEW_FN = {
  // the hero camera rides with the suit: low while it stands, rising and backing off as it lifts
  hero: (u, t) => {
    const L = t === undefined ? 1 : liftAt(t);
    return {tx: 0, ty: 0.95 + 0.55 * L, tz: 0, az: 24 + 1.2 * u, el: 4 + 3 * (1 - L), d: 5.4 + 0.6 * L, sx: 0, sy: -16};
  },
  head: (u) => ({tx: 0, ty: 2.2, tz: 0.05, az: 26 + 1.4 * u, el: 5, d: 2.3, sx: 0, sy: -12}),
  pack: (u) => ({tx: 0, ty: 1.95, tz: -0.2, az: 152 + 1.5 * u, el: 14, d: 4.2, sx: 0, sy: -12}),
  reactor: (u) => ({tx: 0, ty: 1.95, tz: 0.15, az: 22 + 1.2 * u, el: 8, d: 3.0, sx: 0, sy: -10}),
  railgun: (u) => ({tx: 0.1, ty: 1.45, tz: 0.3, az: 62 + 1.3 * u, el: 5, d: 4.6, sx: 0, sy: -12}),
  burst: (u) => ({tx: -0.3, ty: 1.8, tz: 0.4, az: 58 + 0.8 * u, el: 8, d: 6.6, sx: 0, sy: -10}),
  wide: (u) => ({tx: 0, ty: 1.6, tz: 0, az: 34 + 2 * u, el: 14, d: 10.5, sx: 0, sy: -14}),
  turn: (u) => ({tx: 0, ty: 1.6, tz: 0, az: 40, el: 12, d: 10.2, sx: 0, sy: -14}),
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
  o.d += 1.6 * swing * Math.sin(Math.PI * k);
  return o;
};
export const toCam = (c) => ({...c, az: c.az * D2R, el: c.el * D2R});

// ------------------------------------------------------------ the operator's pointer
const REST = [[860, 600], [760, 260], [980, 520], [700, 480], [1000, 300]];
export function makeCursor(ui) {
  const EV = SCRIPT.filter((e) => e.t > 0).map((e) => ({t: e.t, spot: ui.spots[e.display || e.focus]}));
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
    ['V-FIN ANTENNA', 'HEAD UNIT', (P) => P.vfin()],
    ['SHOULDER ARMOR', 'INNER FRAME', (P) => P.shoulder(1)],
    ['XIPHIAS', 'RAIL CANNON', (P) => P.xiphias(1)],
    ['KNEE DRUM', 'KNEE JOINT', (P) => P.knee(1)],
  ],
  head: [
    ['V-FIN ANTENNA', 'SENSOR', (P) => P.vfin()],
    ['TWIN EYE', 'OPTICAL SENSOR', (P) => P.eye()],
    ['FOREHEAD CAMERA', 'OPTICAL', (P) => P.camera()],
    ['CHEEK VENT', 'CIWS · 2 × 76 MM', (P) => P.cheek()],
  ],
  pack: [
    ['THRUSTER PORT', 'MAIN', (P) => P.port(1)],
    ['CENTRE VENT', 'BACKPACK', (P) => P.packVent()],
    ['CALF JET', 'THRUSTERS', (P) => P.calf(1)],
    ['XIPHIAS', 'HIP MOUNT', (P) => P.xMount(0)],
  ],
  reactor: [
    ['CORE', 'REACTOR', (P) => P.core()],
    ['COCKPIT HATCH', 'OPEN', (P) => P.hatch()],
    ['CHEST VENT', '4 SLATS', (P) => P.vent()],
    ['POWER LINE', 'TO SHOULDER', (P) => P.line()],
  ],
  railgun: [
    ['HIP MOUNT', 'PIVOT', (P) => P.xMount(1)],
    ['XIPHIAS', `${SPEC.xiphiasL} M RAIL CANNON`, (P) => P.xiphias(1)],
    ['MUZZLE', `${SPEC.xiphiasExt} M SLIDE`, (P) => P.xMuzzle(1)],
    ['FRONT SKIRT', 'PS ARMOR', (P) => P.skirt()],
  ],
  burst: [
    ['XIPHIAS', 'RAIL CANNON', (P) => P.xMuzzle(1)],
    ['HIP MOUNT', 'PIVOT', (P) => P.xMount(1)],
    ['ELBOW PISTON', 'ACTUATORS', (P) => P.elbow(1)],
    ['ANKLE PISTON', 'ACTUATORS', (P) => P.ankle(1)],
  ],
  wide: [
    ['HEAD UNIT', 'V-FIN · TWIN EYE', (P) => P.head()],
    ['CORE', 'REACTOR', (P) => P.core()],
    ['SHOULDER ARMOR', 'INNER FRAME', (P) => P.shoulder(1)],
    ['KNEE DRUM', 'INNER FRAME', (P) => P.knee(1)],
    ['TOE WEDGE', 'PS ARMOR', (P) => P.foot(1)],
  ],
};
CALLS.turn = [];

const pct = (x) => Math.round(x * 100);
const modeOf = (S, mc) => {
  const ex = S.display.exploded;
  if (S.view === 'wide' || S.view === 'turn') {
    const reass = S.view === 'turn' || S.action.includes('OFF');
    const deg = Math.round(((((S.turnA * 180) / Math.PI) % 360) + 360) % 360);
    return [reass ? 'REASSEMBLY' : 'TEARDOWN', `TURNTABLE ${deg}° · ${pct(ex)}% APART`];
  }
  if (S.focus === 'hero' && S.lift < 0.02) return ['GROUND STANDBY', S.display.ps > 0.5 ? 'PS ARMOR ACTIVE' : 'PS ARMOR OFFLINE'];
  if (S.focus === 'hero' && S.lift < 0.98) return [S.landing ? 'LANDING' : 'LIFT-OFF', `ALT ${mc.bp.alt.toFixed(1)} M AGL`];
  return {
    hero: ['HI-MAT FLIGHT', `HOVER · ${mc.bp.alt.toFixed(1)} M AGL`],
    head: ['HEAD SENSORS', 'TWIN EYE TRACKING'],
    pack: ['BACKPACK', `THRUST ${pct(mc.thrust)}% · THRUSTERS LIT`],
    reactor: ['CORE OPEN', `CORE · ${pct(S.reactor)}% OPEN`],
    railgun: ['RAIL CANNON OUT', `XIPHIAS · ${pct(mc.dep.xiphias)}% DEPLOYED`],
    burst: ['RAIL FIRE', `${mc.cyc.phase} · ${pct(mc.cyc.charge)}% CHARGE`],
  }[S.focus];
};

// ------------------------------------------------------------ console data for a frame
const gunState = (dep, cyc, i) => {
  const d = dep.xiphias;
  if (cyc.fire[i] > 0.01) return {txt: 'FIRING', c: 'a'};
  if (d < 0.02) return {txt: 'STOWED', c: ''};
  if (d < 0.98) return {txt: 'DEPLOYING', c: 'b'};
  if (cyc.phase === 'CHARGING') return {txt: 'CHARGING', c: 'g'};
  if (cyc.phase === 'COOLING') return {txt: 'COOLING', c: 'b'};
  return {txt: 'READY', c: 'g'};
};
export function makeConsoleFrame(ui, st, hist = stateAt) {
  return (t, S, extra = {}) => {
    const mc = st.robot.state; // what the geometry was just posed from
    const ops = opsOf(S);
    const outHist = Array.from({length: 64}, (_, i) => {
      const tt = t - 4 + (i / 63) * 4;
      return machineAt(tt, opsOf(hist(tt))).power.out;
    });
    const Pt = st.robot.points;
    const fade = ss(0.9, 1.5, S.since) * (S.view === 'hero' ? Math.max(S.display.labels, 0) : 1);
    const callouts = (CALLS[S.view] || []).map(([name, sub, at], i) => {
      if (fade < 0.02) return null;
      const p = st.project(at(Pt));
      if (!p || p[0] < 330 || p[0] > 1270 || p[1] < 140 || p[1] > 750 || ui.covered(p[0], p[1])) return null;
      const dx = (i % 2 ? 1 : -1) * (120 + 30 * Math.floor(i / 2));
      const dy = -70 + Math.floor(i / 2) * 56;
      if (ui.covered(p[0] + dx * 2.6, p[1] + dy, 0)) return null;
      return {name, sub, at: p, dx, dy, o: fade * ss(0.9 + i * 0.18, 1.3 + i * 0.18, S.since)};
    });
    const [mName, mSub] = modeOf(S, mc);
    const exp = ops.explode > 0.5;
    const D = (o) => (exp ? {txt: 'DETACHED', c: 'a', focus: o.focus} : o);
    const dep = mc.dep;
    ui.update({
      runtime: extra.runtime ?? t,
      status: mName,
      statusOk: !['TEARDOWN', 'REASSEMBLY', 'RAIL FIRE'].includes(mName),
      load: mc.power.load,
      isoTag: S.view === 'wide' || S.view === 'turn' ? 'ISOLATE · ALL' : `ISOLATE · ${ACT_TXT[S.focus]}`,
      out: mc.power.out,
      temp: mc.power.temp,
      outHist,
      lines: mc.power.lines,
      guns: GUNS.map((_, i) => ({charge: mc.cyc.charge * dep.xiphias, state: gunState(dep, mc.cyc, i)})),
      shots: mc.cyc.shots,
      alt: mc.bp.alt,
      vs: mc.bp.vs + (S.dLift ?? 0) * SPEC.hoverAlt,
      pitch: mc.bp.pitch / D2R,
      roll: mc.bp.roll / D2R,
      thrust: mc.thrust,
      speed: mc.bp.speed,
      focus: S.focus,
      display: S.display,
      paused: !!extra.paused,
      subsys: {
        head: D(S.head > 0.05 ? {txt: 'TRACKING', c: 'a', focus: true} : {txt: 'ONLINE', c: 'g', focus: false}),
        core: D(S.reactor > 0.05 ? {txt: 'OPEN', c: 'a', focus: true} : S.display.xray > 0.5 ? {txt: 'X-RAY', c: 'a', focus: true} : {txt: 'NOMINAL', c: 'g', focus: false}),
        pack: D(mc.thrust > 0.05 ? {txt: 'THRUSTERS LIT', c: S.pack > 0.05 ? 'a' : 'g', focus: S.pack > 0.05} : {txt: 'STANDBY', c: '', focus: false}),
        xiphias: D(dep.xiphias > 0.05 ? {txt: mc.cyc.firing ? 'FIRING' : 'DEPLOYED', c: 'a', focus: true} : {txt: 'STOWED', c: '', focus: false}),
        joints: D(mc.thrust > 0.05 || dep.aim > 0.05 ? {txt: 'DRIVING', c: 'g', focus: false} : {txt: 'HOLDING', c: '', focus: false}),
        frame: D(S.display.ps > 0.5 ? {txt: 'ACTIVE', c: 'g', focus: false} : {txt: 'OFFLINE', c: '', focus: false}),
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
    const st = createStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, st);
    window.SUIT = st;
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
