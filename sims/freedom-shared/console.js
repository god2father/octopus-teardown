// The Freedom console: the repo's pale lab sheet, re-panelled for a nuclear-powered mobile suit. Fixed 1600 x 900
// CSS layout; update(s) redraws every live part from the frame's state, so a captured frame depends only on t.
// Every label is bilingual (English + 中文).
import {BUS, GUNS, SPEC} from './kin.js';
import {bi, zh} from './i18n.js';

export const C = {ink: '#1d1d1f', mute: '#8d8981', faint: '#c9c4bc', line: 'rgba(40,36,30,.12)', paper: 'rgba(251,250,248,.88)', accent: '#e5452a', green: '#2e8a5a', blue: '#2b4ea6', dark: '#2a2a2c'};
export const FOCUS_KEYS = ['hero', 'head', 'pack', 'reactor', 'railgun', 'burst'];
export const FOCUS_TXT = {hero: 'HERO', head: 'HEAD', pack: 'BACKPACK', reactor: 'REACTOR', railgun: 'RAILGUN', burst: 'RAIL FIRE'};
export const DISPLAY_KEYS = ['labels', 'ps', 'xray', 'exploded', 'turn'];
export const DISPLAY_TXT = {labels: 'LABELS', ps: 'PHASE SHIFT', xray: 'X-RAY', exploded: 'EXPLODED', turn: 'TURNTABLE'};
export const SUBSYS = [
  ['head', 'HEAD UNIT', 'TWIN EYE · V-FIN · 2 × CIWS'],
  ['core', 'CORE BLOCK', 'REACTOR · N-JAMMER CANCELLER'],
  ['pack', 'BACKPACK', '2 THRUSTERS · CALF JETS'],
  ['xiphias', 'XIPHIAS', '2 × RAIL CANNON'],
  ['joints', 'ACTUATORS', 'KNEE · ANKLE · ELBOW PISTONS'],
  ['frame', 'INNER FRAME', '22 JOINTS · PS ARMOR'],
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
.call{position:absolute;white-space:nowrap;background:#fff;padding:6px 10px 7px;border-radius:3px;border:1px solid rgba(40,36,30,.2);box-shadow:0 3px 10px rgba(40,30,20,.16)}
.call b{display:block;font-size:12.5px;font-weight:700;letter-spacing:.9px;color:${C.ink};line-height:1.15}
.call>span{display:block;font-size:10px;font-weight:600;letter-spacing:.7px;color:#57534c;margin-top:4px;line-height:1.15}
.zh{font-family:${ZHF};letter-spacing:.4px;margin-left:.5em;text-transform:none;font-size:1.12em}
.lb .zh{font-weight:500}
.call span .zh{font-size:1.1em}
.call b .zh{font-weight:600}
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
const PILL = (st) => (st.c === 'a' ? C.accent : st.c === 'g' ? C.green : st.c === 'b' ? C.blue : 'rgba(40,36,30,.14)');

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
  add(`<div style="position:absolute;left:0;top:0;width:160px;height:88px;background:${C.accent};display:flex;align-items:center;gap:12px;padding-left:20px;color:#fff">
    <svg width="38" height="30" viewBox="0 0 38 30" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 22l-3-8h6z"/><path d="M17 14L6 3M21 14L32 3"/><path d="M15 18L2 14M15 20L3 22M15 22L6 28M23 18l13-4M23 20l12 2M23 22l9 6"/></svg>
    <span style="font-size:14px;font-weight:700;letter-spacing:2px">X10A</span></div>`);
  add(`<div class="lb" style="position:absolute;left:182px;top:18px;letter-spacing:1.8px">${bi('MOBILE SUIT')} · ${bi('NUCLEAR-POWERED')}</div>`);
  add(`<div class="big" style="position:absolute;left:180px;top:32px;font-size:31px;font-weight:600;letter-spacing:-.3px">Freedom <span style="color:${C.mute};font-weight:400;font-size:22px">ZGMF-X10A</span> <span style="color:${C.accent};font-weight:400">/</span></div>`);
  add(`<div class="lb" style="position:absolute;left:182px;top:76px;letter-spacing:1.8px">${bi('HIGH-MOBILITY')} / ${bi('TEARDOWN SIMULATOR')}</div>`);
  add(`<div class="lb" style="position:absolute;left:700px;top:18px">${bi('REACTOR LOAD')}</div>`);
  const loadPct = add(`<div class="vl" style="position:absolute;left:1000px;top:16px;width:44px;text-align:right;font-size:9px"></div>`);
  const loadBar = add(`<svg style="position:absolute;left:700px;top:32px" width="344" height="14"></svg>`);
  add(`<div style="position:absolute;left:700px;top:52px;width:344px;display:flex;justify-content:space-between" class="lb"><span>${bi('IDLE')}</span><span>${bi('CRUISE')}</span><span>${bi('PEAK')}</span></div>`);
  add(`<svg style="position:absolute;left:640px;top:82px" width="340" height="12">${Array.from({length: 14}, (_, i) => `<path d="M${i * 24 + 6} 6h6M${i * 24 + 9} 3v6" stroke="${C.accent}" stroke-width="1" opacity=".55"/>`).join('')}</svg>`);
  const hdrCols = [[1085, 'SIM ID', 'X10A-FT01'], [1203, 'RUNTIME', ''], [1318, 'STATUS', ''], [1440, 'PILOT', 'FAN BUILD']];
  const H = {};
  for (const [x, k, v] of hdrCols) {
    add(`<div style="position:absolute;left:${x - 14}px;top:16px;width:1px;height:44px;background:${C.line}"></div>`);
    add(`<div class="lb" style="position:absolute;left:${x}px;top:18px">${bi(k)}</div>`);
    H[k] = add(`<div class="vl" style="position:absolute;left:${x}px;top:40px">${v}</div>`);
  }
  add(`<div class="lb" style="position:absolute;left:345px;top:120px">${bi('MODEL')} ZGMF-X10A · ${SPEC.height} M · ${SPEC.mass} T</div>`);
  const isoTag = add(`<div class="lb" style="position:absolute;left:1000px;width:256px;text-align:right;top:120px"></div>`);
  add(`<div class="lb" style="position:absolute;left:25px;top:878px;letter-spacing:1.6px">${bi('FAN TRIBUTE')} &nbsp;·&nbsp; ${bi('PROCEDURAL MODEL')} &nbsp;·&nbsp; 2 ${bi('RAIL CANNON')} &nbsp;·&nbsp; 22 ${bi('JOINTS')}</div>`);
  add(`<div class="lb" style="position:absolute;right:25px;top:878px;letter-spacing:1.6px">${bi('PERSONAL BUILD')} &nbsp;·&nbsp; ${bi('NOT FOR DISTRIBUTION')} <span style="color:${C.accent}">//////</span></div>`);

  // ------------------------------------------------------------ REACTOR OUTPUT
  const LX = 25;
  const LW = 287;
  panel(LX, 108, LW, 227, 'REACTOR OUTPUT', '01');
  const mw = add(`<div style="position:absolute;left:${LX + 12}px;top:132px;display:flex;align-items:baseline;gap:4px"><span class="big" style="font-size:34px" data-v></span><span class="lb" style="font-size:9px">MW</span></div>`);
  const ldv = add(`<div class="big" style="position:absolute;left:${LX + LW - 112}px;width:100px;text-align:right;top:138px;font-size:22px"></div>`);
  add(`<div class="lb" style="position:absolute;left:${LX + 12}px;top:178px">RATED<span class="zh">额定</span> ${SPEC.rated} MW</div>`);
  add(`<div class="lb" style="position:absolute;left:${LX + LW - 112}px;width:100px;text-align:right;top:178px">${bi('REACTOR LOAD')}</div>`);
  const oChart = add(`<svg style="position:absolute;left:${LX + 12}px;top:194px" width="${LW - 24}" height="96"></svg>`);
  add(`<div style="position:absolute;left:${LX + 12}px;top:298px;width:${LW - 24}px;display:flex;justify-content:space-between"><span class="lb">${bi('CORE TEMP')}</span><b class="vl" data-k="temp"></b></div>`);
  add(`<div style="position:absolute;left:${LX + 12}px;top:314px;width:${LW - 24}px;display:flex;justify-content:space-between"><span class="lb">${bi('N-JAMMER CANCELLER')}</span><span class="pill">${bi('ONLINE')}</span></div>`);

  // ------------------------------------------------------------ POWER BUS
  panel(LX, 348, LW, 190, 'POWER BUS', '02');
  add(`<div class="lb" style="position:absolute;left:${LX + 12}px;top:374px">${bi('SHARE OF OUTPUT')} · MW</div>`);
  const busRows = BUS.map((n, i) =>
    add(`<div style="position:absolute;left:${LX + 12}px;top:${396 + i * 22}px;width:${LW - 24}px;height:14px;display:flex;align-items:center;gap:8px">
      <span class="vl" style="width:104px;font-size:8.2px;letter-spacing:.6px;overflow:hidden">${n.replace(' · SENSORS', '')}<span class="zh" style="font-size:8.6px;color:${C.mute}">${zh(n.replace(' · SENSORS', '')).replace(/ [LR]$/, '')}</span></span>
      <span style="flex:1;height:5px;position:relative;background:rgba(40,36,30,.08);border-radius:1px"><span data-r="bar" style="position:absolute;left:0;top:0;bottom:0;border-radius:1px"></span></span>
      <span class="vl" data-r="v" style="width:34px;text-align:right;font-size:9px"></span></div>`),
  );

  // ------------------------------------------------------------ WEAPON SYSTEMS
  panel(LX, 552, LW, 110, 'WEAPON SYSTEMS', '03');
  const shots = add(`<div class="lb" style="position:absolute;left:${LX + 175}px;width:${LW - 211}px;text-align:right;top:565px"></div>`);
  const gunRows = GUNS.map((n, i) =>
    add(`<div style="position:absolute;left:${LX + 12}px;top:${590 + i * 26}px;width:${LW - 24}px;height:14px;display:flex;align-items:center;gap:8px">
      <span class="vl" style="width:72px;font-size:8.2px;letter-spacing:.6px">${n}</span>
      <span style="flex:1;height:5px;position:relative;background:rgba(40,36,30,.08);border-radius:1px"><span data-r="bar" style="position:absolute;left:0;top:0;bottom:0;border-radius:1px"></span></span>
      <span class="pill" data-r="pill" style="width:74px"></span></div>`),
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
  add(`<div style="position:absolute;left:${RX + 12}px;top:274px;width:${RW - 24}px;display:flex;justify-content:space-between;align-items:center"><span class="lb">${bi('THRUST')}</span><span class="vl" data-k="thrust"></span><span class="lb">${bi('SPEED')}</span><span class="vl" data-k="span"></span></div>`);

  // ------------------------------------------------------------ ASSEMBLIES and DISPLAY
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
  row(['hero', 'head'], FOCUS_TXT, RX + 12, 352);
  row(['pack', 'reactor'], FOCUS_TXT, RX + 12, 382);
  row(['railgun', 'burst'], FOCUS_TXT, RX + 12, 412);
  panel(RX, 468, RW, 138, 'DISPLAY', '06');
  row(['labels', 'ps'], DISPLAY_TXT, RX + 12, 504);
  row(['xray', 'exploded'], DISPLAY_TXT, RX + 12, 534);
  row(['turn'], DISPLAY_TXT, RX + 12, 564);

  // ------------------------------------------------------------ SUBSYSTEMS
  panel(RX, 618, RW, 164, 'SUBSYSTEMS', '07');
  const subRows = SUBSYS.map(([k, name, sub], i) =>
    add(`<div style="position:absolute;left:${RX + 6}px;top:${644 + i * 22}px;width:${RW - 18}px;height:21px;display:flex;align-items:center;gap:8px;padding-left:6px;border-left:2px solid transparent" data-s="${k}">
      <span class="lb" style="width:14px">0${i + 1}</span>
      <span style="flex:1;min-width:0;overflow:hidden"><span class="vl" data-r="name" style="display:block;font-size:8.6px;letter-spacing:1px">${bi(name)}</span><span class="lb" style="display:block;font-size:6.4px;margin-top:1px;overflow:hidden;text-overflow:ellipsis">${sub}</span></span>
      <span class="pill" data-r="pill"></span></div>`),
  );

  // ------------------------------------------------------------ OPERATION LOG
  const OL = {x: 330, y: 762, w: 938, h: 96};
  add(`<div class="pn" style="left:${OL.x}px;top:${OL.y}px;width:${OL.w}px;height:${OL.h}px"></div>`);
  add(`<div class="hd" style="left:${OL.x + 14}px;top:${OL.y + 12}px">${bi('OPERATION LOG')}</div>`);
  add(`<div class="no" style="left:${OL.x + OL.w - 26}px;top:${OL.y + 13}px">08</div>`);
  btn.pause = add(`<div class="bt" style="left:${OL.x + 14}px;top:${OL.y + 36}px;width:40px;height:40px;border-radius:50%;background:${C.accent};border-color:${C.accent};color:#fff;font-size:12px;padding:0">❚❚</div>`);
  const TR = {x: OL.x + 76, y: OL.y + 56, w: OL.w - 104};
  add(`<div class="lb" style="position:absolute;left:${TR.x}px;top:${OL.y + 32}px">${bi('LAUNCH')}</div>`);
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
  const PANELS = [[0, 0, 1600, 98], [LX, 108, LX + LW, 662], [RX, 108, RX + RW, 782], [OL.x, OL.y, OL.x + OL.w, OL.y + OL.h], [340, 632, 640, 742]];
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
    pointer,
    update(s) {
      H.RUNTIME.textContent = `00:${mmss(s.runtime)}`;
      H.STATUS.innerHTML = `<span style="color:${s.statusOk ? C.green : C.accent}">●</span> ${s.status}<div class="zh" style="margin:3px 0 0 13px;font-size:10px;color:${C.mute}">${zh(s.status)}</div>`;
      loadPct.textContent = `${Math.round(s.load * 100)}%`;
      {
        let h = '';
        const n = 58;
        for (let i = 0; i < n; i++) h += `<rect x="${i * 5.93}" y="0" width="3.6" height="14" fill="${i / n < s.load ? (i / n > 0.75 ? C.accent : C.ink) : 'rgba(40,36,30,.12)'}"/>`;
        loadBar.innerHTML = h;
      }
      isoTag.innerHTML = bi(s.isoTag);

      // reactor
      mw.querySelector('[data-v]').textContent = s.out.toFixed(2);
      ldv.textContent = `${(s.load * 100).toFixed(0)}%`;
      K.temp.textContent = `${s.temp.toFixed(0)} °C`;
      {
        const W = LW - 24;
        const Y = (v) => 80 - (v / SPEC.rated) * 74;
        let p = '';
        s.outHist.forEach((v, i) => (p += `${i ? 'L' : 'M'}${((i / (s.outHist.length - 1)) * (W - 30)).toFixed(1)} ${Y(v).toFixed(1)}`));
        const last = s.outHist[s.outHist.length - 1];
        oChart.innerHTML = `${[0, 4, 8, 12].map((v) => `<line x1="0" x2="${W - 30}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.faint}" stroke-width=".6" stroke-dasharray="2 3"/><text x="${W}" y="${Y(v) + 2.5}" font-size="6.5" text-anchor="end" fill="${C.mute}" font-family="JetBrains Mono">${v} MW</text>`).join('')}
          <path d="${p} L${W - 30} 80 L0 80Z" fill="${C.accent}" opacity=".08"/>
          <path d="${p}" fill="none" stroke="${C.accent}" stroke-width="1.5"/>
          <circle cx="${W - 30}" cy="${Y(last).toFixed(1)}" r="3" fill="${C.accent}"/>
          <text x="0" y="93" font-size="6.5" fill="${C.mute}" font-family="JetBrains Mono">−4 S</text><text x="${W - 30}" y="93" font-size="6.5" text-anchor="end" fill="${C.mute}" font-family="JetBrains Mono">NOW 当前</text>`;
      }

      // bus
      const hot = Math.max(...s.lines);
      busRows.forEach((r, i) => {
        const v = s.lines[i];
        const bar = r.querySelector('[data-r=bar]');
        bar.style.width = `${Math.min(100, (v / 5.5) * 100).toFixed(1)}%`;
        bar.style.background = v === hot && v > 0.3 ? C.accent : C.ink;
        r.querySelector('[data-r=v]').textContent = v.toFixed(2);
      });

      // weapons
      shots.innerHTML = `${s.shots} SHOTS<span class="zh">${s.shots} 发</span>`;
      gunRows.forEach((r, i) => {
        const g = s.guns[i];
        const bar = r.querySelector('[data-r=bar]');
        bar.style.width = `${(g.charge * 100).toFixed(1)}%`;
        bar.style.background = g.state.txt === 'FIRING' ? C.accent : C.ink;
        const pill = r.querySelector('[data-r=pill]');
        pill.innerHTML = bi(g.state.txt);
        pill.style.background = PILL(g.state);
        pill.style.color = g.state.c ? '#fff' : C.mute;
      });

      // flight
      K.alt.textContent = `${s.alt.toFixed(2)} M`;
      K.vs.textContent = `${sgn(s.vs, 2)} M/S`;
      K.pitch.textContent = `${sgn(s.pitch)}°`;
      K.roll.textContent = `${sgn(s.roll)}°`;
      K.thrust.textContent = `${Math.round(s.thrust * 100)}%`;
      K.span.textContent = `${s.speed.toFixed(2)} M/S`;
      {
        const r = 44;
        const a = (-s.roll * 6 * Math.PI) / 180;
        const dy = s.pitch * 3;
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

      for (const k of FOCUS_KEYS) setBtn(btn[k], s.focus === k);
      for (const k of DISPLAY_KEYS) setBtn(btn[k], s.display[k] > 0.5);
      btn.pause.textContent = s.paused ? '▶' : '❚❚';

      subRows.forEach((r) => {
        const st = s.subsys[r.dataset.s];
        const pill = r.querySelector('[data-r=pill]');
        pill.innerHTML = bi(st.txt);
        pill.style.background = PILL(st);
        pill.style.color = st.c ? '#fff' : C.mute;
        r.style.borderLeftColor = st.focus ? C.accent : 'transparent';
        r.querySelector('[data-r=name]').style.color = st.focus ? C.accent : C.ink;
      });

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

      mode.querySelector('[data-m=name]').textContent = s.mode.name;
      mode.querySelector('[data-m=zh]').textContent = zh(s.mode.name);
      mode.querySelector('[data-m=sub]').innerHTML = bi(s.mode.sub);

      let lh = '';
      let ch = '';
      for (const c of s.callouts) {
        if (!c || c.o < 0.02) continue;
        const [ax, ay] = c.at;
        const lx = ax + c.dx;
        const ly = ay + c.dy;
        const ex = lx + (c.dx < 0 ? -18 : 18);
        const pts = `${ax.toFixed(1)},${ay.toFixed(1)} ${lx.toFixed(1)},${ly.toFixed(1)} ${ex.toFixed(1)},${ly.toFixed(1)}`;
        // a white halo under the leader and the anchor so they read over any armor colour
        lh += `<g opacity="${c.o.toFixed(2)}"><polyline points="${pts}" fill="none" stroke="#fff" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round" opacity=".9"/><polyline points="${pts}" fill="none" stroke="${C.accent}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="6.5" fill="#fff"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="4" fill="${C.accent}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="9" fill="none" stroke="${C.accent}" stroke-width="1.2"/></g>`;
        ch += `<div class="call" style="left:${ex.toFixed(1)}px;top:${ly.toFixed(1)}px;opacity:${c.o.toFixed(2)};transform:translate(${c.dx < 0 ? '-100%' : '0'},-50%);text-align:${c.dx < 0 ? 'right' : 'left'};border-${c.dx < 0 ? 'right' : 'left'}:3px solid ${C.accent}"><b>${bi(c.name)}</b><span>${bi(c.sub)}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      pointer(s.cursor);
    },
  };
}
