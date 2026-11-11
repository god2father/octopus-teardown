// The HB-7 console: the same pale lab sheet as the OC-8, re-panelled for a flapping-wing drone. Fixed 1600 x 900
// CSS layout; update(s) redraws every live part from the frame's state, so a captured frame depends only on t.
// Every label is bilingual (English + 中文, from ../octopus-shared/i18n.js).
import {LEG_NAMES, SPEC} from './kin.js';
import {bi, zh} from '../octopus-shared/i18n.js';

export const C = {ink: '#1d1d1f', mute: '#8d8981', faint: '#c9c4bc', line: 'rgba(40,36,30,.12)', paper: 'rgba(251,250,248,.88)', accent: '#ec4b1c', green: '#2e8a5a', dark: '#2a2a2c'};
export const FOCUS_KEYS = ['hero', 'optics', 'wing', 'leg', 'thorax', 'abdomen'];
export const FOCUS_TXT = {hero: 'HERO', optics: 'OPTICS', wing: 'WING', leg: 'LEG L2', thorax: 'THORAX', abdomen: 'ABDOMEN'};
export const DISPLAY_KEYS = ['labels', 'exploded', 'blur', 'turn'];
const DISPLAY_TXT = {labels: 'LABELS', exploded: 'EXPLODED', blur: 'MOTION BLUR', turn: 'TURNTABLE'};
export const SUBSYS = [
  ['optics', 'OPTIC HEAD', '2 × COMPOUND SENSOR · 3 OCELLI'],
  ['neck', 'NECK BEARING', `${SPEC.neckSeg}-SEGMENT COLLAR`],
  ['thorax', 'THORAX DRIVE', `${SPEC.gears} GEARS · ${SPEC.actuators} ACTUATORS`],
  ['wing', 'WING ROOTS', `${SPEC.hinges} HINGES · ${SPEC.beatHz} HZ CRANK`],
  ['leg', 'LEG SERVOS', '6 LEGS × 3 JOINTS'],
  ['abdomen', 'ABDOMEN CAPSULE', 'GEAR TRAIN · RETURN SPRING'],
];

const ZHF = `'PingFang SC','Hiragino Sans GB','Noto Sans SC','Microsoft YaHei',sans-serif`;
const CSS = `
#app{font-family:'JetBrains Mono',ui-monospace,monospace;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.ui *{box-sizing:border-box}
.pn{position:absolute;background:${C.paper};border:1px solid ${C.line};border-radius:3px;box-shadow:0 1px 2px rgba(40,30,20,.04);backdrop-filter:blur(4px)}
.hd{position:absolute;font-size:9.5px;font-weight:700;letter-spacing:1.4px;white-space:nowrap;padding-left:9px}
.hd:before{content:'';position:absolute;left:0;top:1px;width:3px;height:10px;background:${C.accent}}
.no{position:absolute;font-size:8.5px;color:${C.mute};letter-spacing:1px}
.lb{font-size:8px;font-weight:600;letter-spacing:1.3px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.vl{font-size:10.5px;font-weight:600;letter-spacing:.3px;white-space:nowrap}
.big{font-family:Inter,sans-serif;font-weight:500;letter-spacing:-.5px}
.bt{position:absolute;height:22px;padding:0 10px;display:flex;align-items:center;justify-content:center;font-size:8.5px;font-weight:700;letter-spacing:1.2px;border:1px solid rgba(40,36,30,.2);border-radius:3px;background:rgba(255,255,255,.7);color:${C.dark};white-space:nowrap}
.pill{display:inline-flex;align-items:center;justify-content:center;height:13px;padding:0 6px;font-size:7px;font-weight:700;letter-spacing:1px;border-radius:2px;color:#fff;background:${C.green};white-space:nowrap}
.call{position:absolute;white-space:nowrap}
.call b{display:block;font-size:8.5px;font-weight:700;letter-spacing:1.3px;color:${C.ink}}
.call span{display:block;font-size:7.2px;letter-spacing:1px;color:${C.mute};margin-top:2px}
.zh{font-family:${ZHF};letter-spacing:.4px;margin-left:.5em;text-transform:none;font-size:1.12em}
.lb .zh{font-weight:500}
.call span .zh{font-size:1.2em}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))}
.ring{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:1.6px solid ${C.accent};opacity:0;z-index:49}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const sgn = (v, d = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };
  const panel = (x, y, w, h, title, no) => {
    add(`<div class="pn" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
    add(`<div class="hd" style="left:${x + 12}px;top:${y + 12}px">${bi(title)}</div>`);
    add(`<div class="no" style="left:${x + w - 26}px;top:${y + 13}px">${no}</div>`);
  };

  // ------------------------------------------------------------ header
  add(`<div style="position:absolute;left:0;top:0;width:160px;height:88px;background:${C.accent};display:flex;align-items:center;gap:14px;padding-left:22px;color:#fff">
    <svg width="34" height="30" viewBox="0 0 34 30" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"><ellipse cx="17" cy="17" rx="5" ry="7"/><path d="M12 14h10M12 19h10"/><path d="M13 11c-4-6-10-6-11-2s5 6 10 4M21 11c4-6 10-6 11-2s-5 6-10 4"/><path d="M15 9l-2-5M19 9l2-5"/></svg>
    <span style="font-size:14px;font-weight:700;letter-spacing:2px">HB-7</span></div>`);
  add(`<div class="lb" style="position:absolute;left:182px;top:18px;letter-spacing:1.8px">${bi('ROBOTIC POLLINATOR')} · ${bi('MICRO AIR VEHICLE')}</div>`);
  add(`<div class="big" style="position:absolute;left:180px;top:32px;font-size:31px;font-weight:600;letter-spacing:-.3px">Mellis HB-7 <span style="color:${C.accent};font-weight:400">/</span></div>`);
  add(`<div class="lb" style="position:absolute;left:182px;top:76px;letter-spacing:1.8px">${bi('FLAPPING-WING DRONE')} / ${bi('FIELD SIMULATOR')}</div>`);
  add(`<div class="lb" style="position:absolute;left:700px;top:18px">${bi('LIFT LOAD')}</div>`);
  const loadPct = add(`<div class="vl" style="position:absolute;left:1000px;top:16px;width:44px;text-align:right;font-size:9px"></div>`);
  const loadBar = add(`<svg style="position:absolute;left:700px;top:32px" width="344" height="14"></svg>`);
  add(`<div style="position:absolute;left:700px;top:52px;width:344px;display:flex;justify-content:space-between" class="lb"><span>${bi('IDLE')}</span><span>${bi('HOVER')}</span><span>${bi('MAX')}</span></div>`);
  add(`<svg style="position:absolute;left:640px;top:82px" width="340" height="12">${Array.from({length: 14}, (_, i) => `<path d="M${i * 24 + 6} 6h6M${i * 24 + 9} 3v6" stroke="${C.accent}" stroke-width="1" opacity=".55"/>`).join('')}</svg>`);
  const hdrCols = [[1085, 'SIM ID', 'HB7-0412'], [1203, 'RUNTIME', ''], [1318, 'STATUS', ''], [1440, 'OPERATOR', 'LAB 3 · R.K.']];
  const H = {};
  for (const [x, k, v] of hdrCols) {
    add(`<div style="position:absolute;left:${x - 14}px;top:16px;width:1px;height:44px;background:${C.line}"></div>`);
    add(`<div class="lb" style="position:absolute;left:${x}px;top:18px">${bi(k)}</div>`);
    H[k] = add(`<div class="vl" style="position:absolute;left:${x}px;top:40px">${v}</div>`);
  }
  add(`<div class="lb" style="position:absolute;left:345px;top:120px">${bi('MODEL')} HB-7 · ${bi('REV')} C</div>`);
  const isoTag = add(`<div class="lb" style="position:absolute;left:1000px;width:256px;text-align:right;top:120px"></div>`);
  add(`<div class="lb" style="position:absolute;left:25px;top:878px;letter-spacing:1.6px">${bi('FIELD SIMULATOR')} &nbsp;·&nbsp; ${bi('PROCEDURAL MODEL')} &nbsp;·&nbsp; 6 ${bi('LEGS')} &nbsp;·&nbsp; 4 ${bi('WINGS')} &nbsp;·&nbsp; 2 ${bi('OPTICS')}</div>`);
  add(`<div class="lb" style="position:absolute;right:25px;top:878px;letter-spacing:1.6px">${bi('MELLIS ROBOTICS')} &nbsp;·&nbsp; ${bi('POLLINATION LAB')} <span style="color:${C.accent}">//////</span></div>`);

  // ------------------------------------------------------------ WING BEAT
  const LX = 25;
  const LW = 287;
  panel(LX, 108, LW, 227, 'WING BEAT', '01');
  const hz = add(`<div style="position:absolute;left:${LX + 12}px;top:132px;display:flex;align-items:baseline;gap:4px"><span class="big" style="font-size:34px" data-v></span><span class="lb" style="font-size:9px">HZ</span></div>`);
  const amp = add(`<div class="big" style="position:absolute;left:${LX + LW - 112}px;width:100px;text-align:right;top:138px;font-size:22px"></div>`);
  add(`<div class="lb" style="position:absolute;left:${LX + 12}px;top:178px">${bi('STROKE FREQUENCY')}</div>`);
  add(`<div class="lb" style="position:absolute;left:${LX + LW - 112}px;width:100px;text-align:right;top:178px">${bi('AMPLITUDE')}</div>`);
  const sChart = add(`<svg style="position:absolute;left:${LX + 12}px;top:198px" width="${LW - 24}" height="92"></svg>`);
  add(`<div style="position:absolute;left:${LX + 12}px;top:308px;width:${LW - 24}px;display:flex;justify-content:space-between"><span class="lb">${bi('PLAYBACK')} &nbsp;<b class="vl" style="color:${C.ink}">1.0×</b></span><span class="lb">${bi('SHUTTER')} 1/60</span></div>`);

  // ------------------------------------------------------------ POWER
  panel(LX, 348, LW, 142, 'POWER', '02');
  const batt = add(`<div style="position:absolute;left:${LX + 12}px;top:372px;display:flex;align-items:baseline;gap:3px"><span class="big" style="font-size:30px" data-v></span><span class="lb" style="font-size:9px">%</span></div>`);
  add(`<div class="lb" style="position:absolute;left:${LX + 12}px;top:410px">${bi('BATTERY')}</div>`);
  const cells = add(`<svg style="position:absolute;left:${LX + 120}px;top:380px" width="150" height="20"></svg>`);
  add(`<div style="position:absolute;left:${LX + 12}px;top:436px;width:${LW - 24}px;display:grid;grid-template-columns:1fr 1fr 1fr;row-gap:5px">
    <span class="lb">${bi('DRAW')}</span><span class="lb">${bi('CELL')}</span><span class="lb">${bi('MOTOR')}</span>
    <span class="vl" data-k="draw"></span><span class="vl">${SPEC.cell.toFixed(2)} V</span><span class="vl" data-k="motor"></span></div>`);

  // ------------------------------------------------------------ LEG SERVOS
  panel(LX, 505, LW, 240, 'LEG SERVOS', '03');
  add(`<div class="lb" style="position:absolute;left:${LX + 12}px;top:532px">${bi('LOAD PER LEG')}</div>`);
  const legPill = add(`<div class="pill" style="position:absolute;right:${1600 - (LX + LW - 12)}px;top:530px"></div>`);
  const legRows = LEG_NAMES.map((n, i) =>
    add(`<div style="position:absolute;left:${LX + 12}px;top:${556 + i * 29}px;width:${LW - 24}px;height:14px;display:flex;align-items:center;gap:10px">
      <span class="vl" style="width:18px;font-size:9.5px">${n}</span>
      <span style="flex:1;height:5px;position:relative;background:rgba(40,36,30,.08);border-radius:1px"><span data-r="bar" style="position:absolute;left:0;top:0;bottom:0;border-radius:1px"></span><span data-r="det" class="lb" style="position:absolute;right:0;top:-3px;color:${C.accent};display:none;background:${C.paper};padding-left:4px">${bi('DETACHED')}</span></span>
      <span class="vl" data-r="pct" style="width:30px;text-align:right;font-size:9.5px"></span></div>`),
  );

  // ------------------------------------------------------------ FLIGHT
  const RX = 1288;
  const RW = 287;
  panel(RX, 108, RW, 195, 'FLIGHT', '04');
  const dial = add(`<svg style="position:absolute;left:${RX + 14}px;top:138px" width="96" height="96"></svg>`);
  add(`<div style="position:absolute;left:${RX + 124}px;top:140px;width:${RW - 136}px;display:grid;grid-template-columns:1fr auto;row-gap:10px">
    <span class="lb">${bi('ALT AGL')}</span><span class="vl" data-k="alt"></span>
    <span class="lb">${bi('V/S')}</span><span class="vl" data-k="vs"></span>
    <span class="lb">${bi('PITCH')}</span><span class="vl" data-k="pitch"></span>
    <span class="lb">${bi('ROLL')}</span><span class="vl" data-k="roll"></span></div>`);
  add(`<div style="position:absolute;left:${RX + 12}px;top:262px;width:${RW - 24}px;height:1px;background:${C.line}"></div>`);
  add(`<div style="position:absolute;left:${RX + 12}px;top:274px;width:${RW - 24}px;display:flex;justify-content:space-between;align-items:center"><span class="lb">${bi('HOLD')}</span><span class="vl" data-k="hold"></span><span class="lb">${bi('AIRSPEED')}</span><span class="vl" data-k="speed"></span></div>`);

  // ------------------------------------------------------------ ASSEMBLIES and DISPLAY: the buttons
  const btn = {};
  const row = (keys, txt, x0, y, gap = 6) => {
    let x = x0;
    for (const k of keys) {
      const w = txt[k].length * 7.2 + zh(txt[k]).length * 9.8 + 24;
      btn[k] = add(`<div class="bt" style="left:${x}px;top:${y}px;width:${w}px">${bi(txt[k])}</div>`);
      x += w + gap;
    }
  };
  panel(RX, 316, RW, 140, 'ASSEMBLIES', '05');
  row(['hero', 'optics', 'wing'], FOCUS_TXT, RX + 12, 352);
  row(['leg', 'thorax'], FOCUS_TXT, RX + 12, 382);
  row(['abdomen'], FOCUS_TXT, RX + 12, 412);
  panel(RX, 468, RW, 108, 'DISPLAY', '06');
  row(['labels', 'exploded'], DISPLAY_TXT, RX + 12, 504);
  row(['blur', 'turn'], DISPLAY_TXT, RX + 12, 534);

  // ------------------------------------------------------------ SUBSYSTEMS
  panel(RX, 590, RW, 185, 'SUBSYSTEMS', '07');
  const subRows = SUBSYS.map(([k, name, sub], i) =>
    add(`<div style="position:absolute;left:${RX + 6}px;top:${618 + i * 25}px;width:${RW - 18}px;height:22px;display:flex;align-items:center;gap:8px;padding-left:6px;border-left:2px solid transparent" data-s="${k}">
      <span class="lb" style="width:14px">0${i + 1}</span>
      <span style="flex:1;min-width:0;overflow:hidden"><span class="vl" data-r="name" style="display:block;font-size:9px;letter-spacing:1px">${bi(name)}</span><span class="lb" style="display:block;font-size:6.6px;margin-top:1px;overflow:hidden;text-overflow:ellipsis">${sub}</span></span>
      <span class="pill" data-r="pill"></span></div>`),
  );

  // ------------------------------------------------------------ FLIGHT LOG
  const OL = {x: 330, y: 762, w: 938, h: 96};
  add(`<div class="pn" style="left:${OL.x}px;top:${OL.y}px;width:${OL.w}px;height:${OL.h}px"></div>`);
  add(`<div class="hd" style="left:${OL.x + 14}px;top:${OL.y + 12}px">${bi('FLIGHT LOG')}</div>`);
  add(`<div class="no" style="left:${OL.x + OL.w - 26}px;top:${OL.y + 13}px">08</div>`);
  btn.pause = add(`<div class="bt" style="left:${OL.x + 14}px;top:${OL.y + 36}px;width:40px;height:40px;border-radius:50%;background:${C.accent};border-color:${C.accent};color:#fff;font-size:12px;padding:0">❚❚</div>`);
  const TR = {x: OL.x + 76, y: OL.y + 56, w: OL.w - 104};
  add(`<div class="lb" style="position:absolute;left:${TR.x}px;top:${OL.y + 32}px">${bi('TAKE-OFF')}</div>`);
  add(`<div class="lb" style="position:absolute;left:${TR.x + TR.w - 100}px;width:100px;text-align:right;top:${OL.y + 32}px">${bi('LAND')}</div>`);
  const logLabel = add(`<div class="lb" style="position:absolute;left:${TR.x}px;width:${TR.w}px;text-align:center;top:${OL.y + 32}px;color:${C.accent};font-size:8.5px"></div>`);
  const track = add(`<svg style="position:absolute;left:${TR.x - 8}px;top:${TR.y - 10}px;overflow:visible" width="${TR.w + 16}" height="20"></svg>`);
  const logTime = add(`<div class="lb" style="position:absolute;left:${TR.x}px;top:${OL.y + 74}px"></div>`);
  const logCount = add(`<div class="lb" style="position:absolute;left:${TR.x + TR.w - 200}px;width:200px;text-align:right;top:${OL.y + 74}px"></div>`);

  // ------------------------------------------------------------ flight mode, over the scene
  const mode = add(`<div style="position:absolute;left:345px;top:640px">
    <div class="lb">${bi('FLIGHT MODE')}</div>
    <div class="big" data-m="name" style="font-size:31px;font-weight:600;color:${C.accent};margin-top:5px;letter-spacing:-.2px"></div>
    <div data-m="zh" style="font-family:${ZHF};font-size:15px;font-weight:600;color:${C.accent};margin-top:2px;letter-spacing:2px"></div>
    <div class="lb" data-m="sub" style="margin-top:4px"></div></div>`);

  // ------------------------------------------------------------ overlays
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#1d1a16" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);

  const K = {};
  for (const n of ui.querySelectorAll('[data-k]')) K[n.dataset.k] = n;
  const centre = (n) => {
    const r = n.getBoundingClientRect();
    const a = app.getBoundingClientRect();
    const s = a.width / 1600 || 1;
    return [(r.left - a.left + r.width / 2) / s, (r.top - a.top + r.height / 2) / s];
  };
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const trackX = (k) => TR.x + k * TR.w;
  const PANELS = [[0, 0, 1600, 98], [LX, 108, LX + LW, 745], [RX, 108, RX + RW, 775], [OL.x, OL.y, OL.x + OL.w, OL.y + OL.h], [340, 632, 640, 742]];
  const covered = (x, y, pad = 8) => PANELS.some(([a, b, c, d]) => x > a - pad && x < c + pad && y > b - pad && y < d + pad);

  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };
  const setBtn = (n, on) => {
    n.style.background = on ? C.accent : 'rgba(255,255,255,.7)';
    n.style.color = on ? '#fff' : C.dark;
    n.style.borderColor = on ? C.accent : 'rgba(40,36,30,.2)';
  };

  return {
    spots,
    btn,
    root: ui,
    covered,
    trackX,
    pointer,
    update(s) {
      // header
      H.RUNTIME.textContent = `00:${mmss(s.runtime)}`;
      H.STATUS.innerHTML = `<span style="color:${s.status === 'HOVER' ? C.green : C.accent}">●</span> ${s.status}<div class="zh" style="margin:3px 0 0 13px;font-size:10px;color:${C.mute}">${zh(s.status)}</div>`;
      loadPct.textContent = `${Math.round(s.load * 100)}%`;
      {
        let h = '';
        const n = 58;
        for (let i = 0; i < n; i++) h += `<rect x="${i * 5.93}" y="0" width="3.6" height="14" fill="${i / n < s.load ? C.ink : 'rgba(40,36,30,.12)'}"/>`;
        loadBar.innerHTML = h;
      }
      isoTag.innerHTML = bi(s.isoTag);

      // wing beat
      hz.querySelector('[data-v]').textContent = s.hz.toFixed(1);
      amp.textContent = `±${s.amp.toFixed(0)}°`;
      {
        const W = LW - 24;
        const Y = (v) => 38 - (v / 45) * 34;
        let p = '';
        s.sHist.forEach((v, i) => (p += `${i ? 'L' : 'M'}${((i / (s.sHist.length - 1)) * (W - 26)).toFixed(1)} ${Y(v).toFixed(1)}`));
        const last = s.sHist[s.sHist.length - 1];
        sChart.innerHTML = `${[-40, 0, 40].map((v) => `<line x1="0" x2="${W - 26}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.faint}" stroke-width=".6" stroke-dasharray="2 3"/><text x="${W}" y="${Y(v) + 2.5}" font-size="6.5" text-anchor="end" fill="${C.mute}" font-family="JetBrains Mono">${v > 0 ? '+' : ''}${v}°</text>`).join('')}
          <line x1="${W - 26}" x2="${W - 26}" y1="0" y2="78" stroke="${C.faint}" stroke-width=".6"/>
          <path d="${p}" fill="none" stroke="${C.accent}" stroke-width="1.5"/>
          <circle cx="${W - 26}" cy="${Y(last).toFixed(1)}" r="3" fill="${C.accent}"/>
          <text x="0" y="90" font-size="6.5" fill="${C.mute}" font-family="JetBrains Mono">−1.5 S</text><text x="${W - 26}" y="90" font-size="6.5" text-anchor="end" fill="${C.mute}" font-family="JetBrains Mono">NOW 当前</text>`;
      }

      // power
      batt.querySelector('[data-v]').textContent = s.battery.toFixed(0);
      {
        let h = '';
        const lit = Math.round(s.battery / 10);
        for (let i = 0; i < 10; i++) h += `<rect x="${i * 14.6}" y="2" width="11" height="16" rx="1" fill="${i >= lit ? 'rgba(40,36,30,.12)' : i < 2 ? C.accent : C.green}"/>`;
        cells.innerHTML = h;
      }
      K.draw.textContent = `${s.draw.toFixed(1)} W`;
      K.motor.textContent = `${s.motor.toFixed(0)} °C`;

      // leg servos
      const anyDet = s.detached.some((d) => d > 0.5);
      legPill.innerHTML = bi(anyDet ? 'DETACHED' : 'HOLDING');
      legPill.style.background = anyDet ? C.accent : C.green;
      legRows.forEach((r, i) => {
        const det = s.detached[i] > 0.5;
        const bar = r.querySelector('[data-r=bar]');
        bar.style.width = det ? '0%' : `${(s.loads[i] * 100).toFixed(1)}%`;
        bar.style.background = s.loads[i] > 0.6 ? C.accent : C.ink;
        r.querySelector('[data-r=det]').style.display = det ? 'block' : 'none';
        r.querySelector('[data-r=pct]').textContent = det ? '' : `${Math.round(s.loads[i] * 100)}%`;
      });

      // flight
      K.alt.textContent = `${s.alt.toFixed(1)} MM`;
      K.vs.textContent = `${sgn(s.vs, 1)} MM/S`;
      K.pitch.textContent = `${sgn(s.pitch)}°`;
      K.roll.textContent = `${sgn(s.roll)}°`;
      K.speed.textContent = `${s.speed.toFixed(2)} M/S`;
      K.hold.textContent = s.held ? 'BENCH' : 'POSITION';
      {
        const r = 44;
        const a = (-s.roll * 6 * Math.PI) / 180;
        const dy = s.pitch * 5;
        const x1 = 48 - Math.cos(a) * r;
        const y1 = 48 + dy - Math.sin(a) * r;
        const x2 = 48 + Math.cos(a) * r;
        const y2 = 48 + dy + Math.sin(a) * r;
        dial.innerHTML = `<defs><clipPath id="dc"><circle cx="48" cy="48" r="${r}"/></clipPath></defs>
          <circle cx="48" cy="48" r="${r}" fill="rgba(40,36,30,.03)" stroke="${C.faint}"/>
          <g clip-path="url(#dc)"><path d="M${x1 - 40} ${y1} L${x1} ${y1} L${x2} ${y2} L${x2 + 40} ${y2} L${x2 + 40} 120 L${x1 - 40} 120Z" fill="rgba(40,36,30,.07)"/></g>
          <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.ink}" stroke-width="1"/>
          ${[-20, -10, 10, 20].map((v) => `<line x1="40" x2="56" y1="${48 + v}" y2="${48 + v}" stroke="${C.faint}" stroke-width=".6"/>`).join('')}
          <path d="M36 48 h8 l4 3 l4 -3 h8" fill="none" stroke="${C.accent}" stroke-width="1.6"/>
          <circle cx="48" cy="4" r="2" fill="${C.accent}"/>`;
      }

      // buttons
      for (const k of FOCUS_KEYS) setBtn(btn[k], s.focus === k);
      for (const k of DISPLAY_KEYS) setBtn(btn[k], s.display[k] > 0.5);
      btn.pause.textContent = s.paused ? '▶' : '❚❚';

      // subsystems
      subRows.forEach((r) => {
        const st = s.subsys[r.dataset.s];
        const pill = r.querySelector('[data-r=pill]');
        pill.innerHTML = bi(st.txt);
        pill.style.background = st.c === 'a' ? C.accent : st.c === 'g' ? C.green : 'rgba(40,36,30,.14)';
        pill.style.color = st.c ? '#fff' : C.mute;
        r.style.borderLeftColor = st.focus ? C.accent : 'transparent';
        r.querySelector('[data-r=name]').style.color = st.focus ? C.accent : C.ink;
      });

      // flight log
      logLabel.innerHTML = `${bi('OPERATOR')} · ${bi(s.action)}`;
      {
        const k = Math.min(1, s.logT / s.logDur);
        let h = `<line x1="8" x2="${TR.w + 8}" y1="10" y2="10" stroke="rgba(40,36,30,.18)" stroke-width="1.5"/><line x1="8" x2="${8 + k * TR.w}" y1="10" y2="10" stroke="${C.accent}" stroke-width="2.2"/>`;
        for (const a of s.actions) h += `<line x1="${8 + (a / s.logDur) * TR.w}" x2="${8 + (a / s.logDur) * TR.w}" y1="5" y2="15" stroke="${a <= s.logT ? C.accent : C.mute}" stroke-width="1"/>`;
        h += `<circle cx="${8 + k * TR.w}" cy="10" r="5" fill="#fff" stroke="${C.accent}" stroke-width="1.8"/>`;
        track.innerHTML = h;
      }
      logTime.textContent = `${mmss(s.logT)} / ${mmss(s.logDur)}`;
      logCount.innerHTML = `${s.actions.length} OPERATOR ACTIONS<span class="zh">${s.actions.length} 次操作</span>`;

      // mode
      mode.querySelector('[data-m=name]').textContent = s.mode.name;
      mode.querySelector('[data-m=zh]').textContent = zh(s.mode.name);
      mode.querySelector('[data-m=sub]').innerHTML = bi(s.mode.sub);

      // callouts
      let lh = '';
      let ch = '';
      for (const c of s.callouts) {
        if (!c || c.o < 0.02) continue;
        const [ax, ay] = c.at;
        const lx = ax + c.dx;
        const ly = ay + c.dy;
        const ex = lx + (c.dx < 0 ? -18 : 18);
        lh += `<g opacity="${c.o.toFixed(2)}"><polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${lx.toFixed(1)},${ly.toFixed(1)} ${ex.toFixed(1)},${ly.toFixed(1)}" fill="none" stroke="${C.accent}" stroke-width=".9"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.4" fill="${C.accent}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="5" fill="none" stroke="${C.accent}" stroke-width=".6"/></g>`;
        ch += `<div class="call" style="left:${(ex + (c.dx < 0 ? -4 : 4)).toFixed(1)}px;top:${(ly - 8).toFixed(1)}px;opacity:${c.o.toFixed(2)};transform:translateX(${c.dx < 0 ? '-100%' : '0'});text-align:${c.dx < 0 ? 'right' : 'left'}"><b>${bi(c.name)}</b><span>${bi(c.sub)}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      pointer(s.cursor);
    },
  };
}
