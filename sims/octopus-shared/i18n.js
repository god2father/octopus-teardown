// Bilingual labels: every English string on the console gets its Chinese beside it. One phrase table, matched
// longest-first on whole words, so strings that carry numbers ("MANTLE · 27% APART") translate around them.

const ZH = {
  // header and footer
  'ROBOTIC CEPHALOPOD': '机器头足类',
  'EIGHT-ARM SUBSEA DRONE': '八臂水下无人机',
  'SOFT-ARM MANIPULATOR': '软臂机械手',
  'FIELD SIMULATOR': '现场模拟器',
  'PROCEDURAL MODEL': '程序化模型',
  'PELAGOS MARINE ROBOTICS': '远洋海洋机器人',
  'DEEP LAB': '深海实验室',
  'JET LOAD': '喷射负载',
  'SIM ID': '仿真编号',
  RUNTIME: '运行时间',
  STATUS: '状态',
  OPERATOR: '操作员',
  MODEL: '型号',
  REV: '版本',
  IDLE: '空闲',
  CRUISE: '巡航',
  BURST: '爆发',
  // panels
  'MANTLE PRESSURE': '外套膜压力',
  'SIPHON JETTING': '虹吸喷射中',
  'SIPHON IDLE': '虹吸空闲',
  'ARM CURL': '臂卷曲',
  'CURL PER ARM': '各臂卷曲度',
  'TIP SPIRAL': '尖端螺旋',
  'OPERATION LOG': '操作日志',
  'OPERATOR ACTIONS': '次操作',
  'OPERATING MODE': '运行模式',
  ASSEMBLIES: '组件',
  SUBSYSTEMS: '子系统',
  DISPLAY: '显示',
  THRUST: '推力',
  PULSE: '脉冲',
  POWER: '电源',
  BATTERY: '电量',
  DRAW: '功耗',
  CELL: '电芯',
  MOTOR: '电机',
  DEPTH: '深度',
  'V/S': '升降速',
  PITCH: '俯仰',
  ROLL: '横滚',
  HOLD: '保持',
  STATION: '定点',
  SPEED: '航速',
  DIVE: '下潜',
  SURFACE: '上浮',
  NOW: '当前',
  // buttons
  HERO: '总览',
  OPTICS: '光学',
  MANTLE: '外壳',
  'ARM R2': 'R2 臂',
  SIPHON: '虹吸管',
  BEAK: '喙',
  LABELS: '标注',
  EXPLODED: '爆炸图',
  'JET WAKE': '尾流',
  TURNTABLE: '转台',
  // subsystems and pills
  'OPTIC ARRAY': '光学阵列',
  'MANTLE SHELL': '外壳',
  'PUMP CORE': '泵芯',
  'ARM CHAINS': '臂链',
  'REACTOR RING': '反应环',
  'GLASS PORT': '玻璃窗',
  'FLAP NOZZLE': '瓣喷嘴',
  'TWIN JAW': '双颚',
  'RADULA RING': '齿舌环',
  TRACKING: '跟踪中',
  SEALED: '密封',
  EXPOSED: '外露',
  RUNNING: '运行中',
  DETACHED: '已拆下',
  JETTING: '喷射中',
  CURLING: '卷曲中',
  COILED: '已盘卷',
  OPEN: '开启',
  LIVE: '在线',
  // modes, actions, tags
  'HOLD STATION': '定点悬停',
  'OPTICS TRACKING': '光学跟踪',
  'MANTLE OPEN': '外壳开启',
  'ARM R2 APART': 'R2 臂拆解',
  'BEAK OPEN': '喙张开',
  'ALL ASSEMBLIES': '全部组件',
  'EXPLODE ALL': '全部爆炸',
  'TURNTABLE ON': '转台开启',
  'FREE ORBIT': '自由环视',
  'AUTO TOUR': '自动巡演',
  'CLICK TO TAKE OVER': '点击接管',
  'RESUME TOUR': '恢复巡演',
  HOLDING: '悬停',
  ISOLATE: '单独查看',
  RESET: '复位',
  HEADING: '航向',
  APART: '拆开',
  STOPPED: '收缩',
  IRIS: '光圈',
  GAPE: '张角',
  ON: '开',
  OFF: '关',
  // callouts
  'SHELL PETAL': '外壳花瓣',
  'OPTIC PORT · L': '左光学端口',
  'OPTIC PORT · R': '右光学端口',
  'OPTIC PORT': '光学端口',
  'IRIS STOPPED DOWN': '光圈收小',
  'ARM CHAIN': '臂链',
  'LINKS PER ARM': '节/臂',
  'SUCTION WHEEL': '吸盘轮',
  'ON 8 ARMS': '分布于 8 臂',
  'DRIVE GEARS': '驱动齿轮',
  'PUMP DRIVE': '泵驱动',
  'ROOT ACTUATOR': '根部作动器',
  'IN COLLAR': '嵌入颈环',
  'BALL JOINT': '球关节',
  'ONE PER LINK': '每节一个',
  'PER LINK': '每节',
  'GLASS LINK': '玻璃节',
  'INNER CORE': '内芯',
  'SPIRAL TIP': '螺旋尖端',
  'SIPHON NOZZLE': '虹吸喷嘴',
  'ARM SOCKETS': '臂插座',
  COLLAR: '颈环',
  ACRYLIC: '亚克力',
  SQUEEZE: '收缩',
  HINGED: '铰接',
  PETALS: '花瓣',
  PISTONS: '活塞',
  LINKS: '节',
  WHEELS: '轮',
  LENS: '镜头',
  RIM: '镜圈',
  SLEEVES: '套管',
  TEETH: '齿',
  FLAPS: '瓣',
  ARMS: '臂',
  'OF': '/',
};

const KEYS = Object.keys(ZH).sort((a, b) => b.length - a.length);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const RX = KEYS.map((k) => [new RegExp(`(?<![A-Z0-9])${esc(k)}(?![A-Z])`, 'g'), ZH[k]]);
const cache = new Map();

/** The Chinese for an English label, or '' when nothing in it is known. */
export function zh(en) {
  if (!en) return '';
  if (cache.has(en)) return cache.get(en);
  let out = en;
  for (const [re, z] of RX) out = out.replace(re, z);
  out = /[一-鿿]/.test(out) ? out : '';
  cache.set(en, out);
  return out;
}

/** HTML: the English, then its Chinese in a smaller CJK face. */
export const bi = (en) => {
  const z = zh(en);
  return z ? `${en}<span class="zh">${z}</span>` : en;
};
