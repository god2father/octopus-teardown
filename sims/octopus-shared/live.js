// Pelagos OC-8 as a page you drive: the film's console over the stage, in real time. ASSEMBLIES isolate a part
// (keys 1-6), DISPLAY toggles labels (L), exploded (E), jet wake (J) and the turntable (T), the round button or
// space pauses, drag orbits, the wheel zooms. Left alone it plays the film's script as an auto tour with the
// operator's cursor; any click, drag, wheel or key hands control over, and 25 s of quiet hands it back.
import {warmComposer} from 'teardown-kit/warm.js';
import {createConsole, DISPLAY_KEYS, FOCUS_KEYS} from './console.js';
import {DURATION, makeConsoleFrame, makeCursor, opsOf, stateAt, VIEW_FN} from './film.js';
import {createOctoStage, BG} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrapDeg = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const ACTION = {hero: 'ISOLATE HERO', optics: 'ISOLATE OPTICS', mantle: 'ISOLATE MANTLE', arm: 'ISOLATE ARM R2', siphon: 'ISOLATE SIPHON', beak: 'ISOLATE BEAK', labels: 'LABELS', exploded: 'EXPLODE ALL', wake: 'JET WAKE', turn: 'TURNTABLE'};

const CSS = `
html,body{background:${BG};overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.bt{pointer-events:auto;cursor:pointer}
.bt:hover{filter:brightness(.95)}
.tourchip{position:absolute;left:800px;top:112px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:22px;padding:0 11px;border:1px solid rgba(40,36,30,.2);border-radius:3px;background:rgba(251,250,248,.92);color:#2a2a2c;font:700 8.5px 'JetBrains Mono',monospace;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#ec4b1c}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
`;

export function runLive() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  document.title = 'Pelagos OC-8 · teardown';
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const st = createOctoStage({canvas});
  const ui = createConsole(app);
  const tourCursorAt = makeCursor(ui);

  // ------------------------------------------------------------ quality tiers: integrated GPUs step down in a second or two
  const TIERS = [
    {samples: 4, shadow: 2048, ao: 12, pr: 2},
    {samples: 2, shadow: 1024, ao: 6, pr: 1.5},
    {samples: 0, shadow: 1024, ao: 0, pr: 1.1},
  ];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = light ? 2 : 0;
  let scale = 1;
  const fit = () => {
    scale = Math.min(innerWidth / W, innerHeight / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...q} = TIERS[tier];
    st.setQuality(q);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);

  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);

  // ------------------------------------------------------------ the visitor's state
  let T = 0;
  let simT = 0;
  let paused = false;
  const tgt = {focus: 'hero', display: {labels: 0, exploded: 0, wake: 0, turn: 0}};
  const cur = {mantle: 0, apartR2: 0, jet: 0, beak: 0, optic: 0, display: {labels: 0, exploded: 0, wake: 0, turn: 0}, turnA: 0};
  let view = 'hero';
  let viewAt0 = 0;
  let action = 'HOLD STATION';
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW_FN.hero(0)};
  let ring = {t: -9, x: 0, y: 0};
  const hist = [];
  const histAt = (t) => {
    if (!hist.length) return stateAt(0);
    let i = hist.length - 1;
    while (i > 0 && hist[i].t > t) i--;
    return hist[i].S;
  };
  const frameConsole = makeConsoleFrame(ui, st, histAt);
  const pulse = (key) => {
    ring = {t: T, x: ui.spots[key][0], y: ui.spots[key][1]};
  };
  const viewFor = () => (tgt.display.turn ? 'turn' : tgt.display.exploded ? 'wide' : tgt.focus);
  const setView = (v) => {
    if (v === view) return;
    view = v;
    viewAt0 = T;
  };

  // ------------------------------------------------------------ the tour
  const AP = {on: true, t0: 0};
  let lastInput = -99;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    if (paused) setPaused(false);
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    const S = stateAt(T - AP.t0);
    tgt.focus = S.focus;
    for (const k of DISPLAY_KEYS) tgt.display[k] = S.display[k] > 0.5 ? 1 : 0;
  };
  const setPaused = (p) => {
    paused = p;
  };
  tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', takeOver);
  for (const k of FOCUS_KEYS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      tgt.focus = tgt.focus === k && k !== 'hero' ? 'hero' : k;
      if (k === 'hero') {
        tgt.display.exploded = 0;
        tgt.display.turn = 0;
      }
      action = ACTION[tgt.focus];
      setView(viewFor());
      Object.assign(off, {az: 0, el: 0, k: 1});
    });
  for (const k of DISPLAY_KEYS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      tgt.display[k] = tgt.display[k] ? 0 : 1;
      action = `${ACTION[k]} ${tgt.display[k] ? 'ON' : 'OFF'}`;
      setView(viewFor());
    });
  ui.btn.pause.addEventListener('click', () => {
    takeOver();
    pulse('pause');
    setPaused(!paused);
  });
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const f = {1: 'hero', 2: 'optics', 3: 'mantle', 4: 'arm', 5: 'siphon', 6: 'beak'}[key];
    const d = {l: 'labels', e: 'exploded', j: 'wake', t: 'turn'}[key];
    if (f) ui.btn[f].click();
    else if (d) ui.btn[d].click();
    else if (key === ' ') ui.btn.pause.click();
    else return;
    e.preventDefault();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az -= ((e.clientX - drag.x) / scale) * 0.3;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -10, 60);
    drag = {x: e.clientX, y: e.clientY};
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.45, 2.2);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ the frame
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  let odd = false;
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 0.4) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.022 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= (perf.age < 6 ? 1 : 2)) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }
    if (!paused) simT += dt;

    let S;
    let cursor;
    let since;
    let logT;
    if (AP.on) {
      const cyc = (T - AP.t0) % DURATION;
      S = stateAt(cyc);
      view = S.view;
      since = S.since;
      viewAt0 = T - since;
      logT = cyc;
      cursor = tourCursorAt(cyc);
      // keep the visitor's eased levels where the tour is, so a takeover starts from here
      Object.assign(cur, {mantle: S.mantle, apartR2: S.apartR2, jet: S.jet, beak: S.beak, optic: S.optic, turnA: S.turnA, display: {...S.display}});
      action = S.action;
    } else {
      if (T - lastInput > IDLE) startTour();
      const ease = (k, to, tau) => (cur[k] += (to - cur[k]) * (1 - Math.exp(-dt / tau)));
      ease('mantle', tgt.focus === 'mantle' ? 1 : 0, 0.45);
      ease('apartR2', tgt.focus === 'arm' ? 1 : 0, 0.5);
      ease('jet', tgt.focus === 'siphon' ? 1 : 0, 0.25);
      ease('beak', tgt.focus === 'beak' ? 1 : 0, 0.3);
      ease('optic', tgt.focus === 'optics' ? 1 : 0, 0.25);
      for (const k of DISPLAY_KEYS) cur.display[k] += (tgt.display[k] - cur.display[k]) * (1 - Math.exp(-dt / (k === 'exploded' ? 0.45 : 0.15)));
      if (!paused) cur.turnA += 0.42 * cur.display.turn * dt;
      since = T - viewAt0;
      S = {focus: tgt.focus, since, view, ...cur, display: {...cur.display}, action};
      logT = simT % DURATION;
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
    }
    if (!paused || !hist.length) hist.push({t: simT, S});
    while (hist.length > 2 && hist[0].t < simT - 7) hist.shift();

    // camera: ease toward the view's own move plus the visitor's orbit; a wide swing backs off on the way
    const v = VIEW_FN[view](since);
    v.az += off.az;
    v.el = clamp(v.el + off.el, -4, 75);
    v.d *= off.k;
    const k = 1 - Math.exp(-dt / 0.5);
    const dAz = wrapDeg(v.az - cam.az);
    cam.az += dAz * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (v[key] - cam[key]) * k;
    const swing = Math.min(1, Math.abs(dAz) / 90);
    st.frame(simT, {...cam, el: (cam.el + 8 * swing) * D2R, az: cam.az * D2R, d: cam.d + 1.5 * swing}, opsOf(S));

    odd = !odd;
    if (tier > 0 && odd) ui.pointer(cursor);
    else frameConsole(simT, S, {cursor, runtime: T, logT, paused});

    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>AUTO TOUR · CLICK TO TAKE OVER' : '▶ RESUME TOUR';
    }
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    requestAnimationFrame(frame);
  };
  startTour();
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {st, cam, startTour, takeOver, get tier() {
    return tier;
  }};
}
