// Freedom's stage: the repo's pale warm studio (PBR, soft boxes, PCF shadows, GTAO, survey rings), the suit drawn at
// SPEC.scale so its 18 m stand at 1.8 units and its 5.2 m hover sits comfortably in frame.
// frame(t, cam, ops) poses the suit and draws one frame.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildFreedom} from './robot.js';
import {SPEC} from './kin.js';

const V3 = THREE.Vector3;
export const BG = '#f1efeb';
export const LENS = Math.tan((14 * Math.PI) / 180) / Math.tan((8 * Math.PI) / 180);

const FLOOR_VERT = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FLOOR_FRAG = /* glsl */ `uniform vec3 uFloor; uniform vec3 uBg; uniform vec3 uLine; varying vec3 vW;
  void main(){
    float d = length(vW.xz);
    float ring = abs(fract(d + 0.5) - 0.5);
    float w = fwidth(d);
    float line = (1.0 - smoothstep(0.0, w * 1.4, ring)) * 0.35;
    // a launch pad: a faint cross and a square under the suit
    vec2 a = abs(vW.xz);
    float cross = (1.0 - smoothstep(0.0, fwidth(a.x) * 1.5, a.x)) * step(a.y, 1.6) + (1.0 - smoothstep(0.0, fwidth(a.y) * 1.5, a.y)) * step(a.x, 1.6);
    float sq = (1.0 - smoothstep(0.0, fwidth(a.x) * 1.5, abs(max(a.x, a.y) - 1.1)));
    line = max(line, 0.28 * max(cross, sq));
    vec3 col = mix(uFloor, uLine, line * (1.0 - smoothstep(1.5, 6.5, d)));
    float fade = smoothstep(3.0, 11.0, d);
    gl_FragColor = vec4(mix(col, uBg, fade), 1.0);
  }`;

export function createStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  // a long lens, as the reference photos are shot: 16 degrees, every view's distance scaled by LENS so the suit fills
  // the same share of the frame with far less perspective (a short lens shrinks the head and swells the feet)
  scene.fog = new THREE.Fog(BG, 14 * LENS, 34 * LENS);
  const camera = new THREE.PerspectiveCamera(16, 16 / 9, 0.05, 400);
  const rt = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 4});
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.9;
  gtao.updateGtaoMaterial({radius: 0.12, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12});
  class Toggle extends Pass {
    constructor(fn) {
      super();
      this.needsSwap = false;
      this.fn = fn;
    }
    render() {
      this.fn();
    }
  }
  const hideForAO = (v) => () => {
    floor.visible = v;
    blob.visible = v;
    shade.visible = v;
    rings.visible = v;
  };
  composer.addPass(new Toggle(hideForAO(false)));
  let aoOn = true;
  let aoAllowed = true;
  const gtaoRender = gtao.render.bind(gtao);
  gtao.render = (...a) => (aoOn && aoAllowed ? gtaoRender(...a) : undefined);
  composer.addPass(gtao);
  composer.addPass(new Toggle(hideForAO(true)));
  composer.addPass(new OutputPass());

  {
    const env = new THREE.Scene();
    // a dark room with hard-edged soft boxes: metal only reads as metal when it has something bright and something
    // dark to reflect, so the room is much darker than the backdrop the camera sees
    env.background = new THREE.Color('#3b3a39');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 0.985, 0.96).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(12, 6, new V3(-10, 10, 9), 7.0);
    box(8, 8, new V3(10, 12, -6), 4.5);
    box(18, 1.6, new V3(2, 4, 15), 5.0);
    box(1.6, 14, new V3(14, 5, 4), 4.0);
    box(1.6, 14, new V3(-14, 5, -3), 3.0);
    box(20, 20, new V3(0, 16, 0), 1.5);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#8d877f', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -1.5;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.03).texture;
    scene.environmentIntensity = 1.0;
    pm.dispose();
  }
  const SUN = new V3(-0.45, 0.8, 0.4).normalize();
  const sun = new THREE.DirectionalLight('#fff6ea', 2.5);
  sun.castShadow = true;
  const EXT = 2.6;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 0.5, far: 26});
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.006;
  sun.position.copy(SUN).multiplyScalar(11);
  sun.target.position.set(0, 1, 0);
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#fbf8f3', '#a99d8e', 0.35));

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.ShaderMaterial({vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG, toneMapped: false, uniforms: {uFloor: {value: new THREE.Color('#ece9e3')}, uBg: {value: new THREE.Color(BG)}, uLine: {value: new THREE.Color('#bdb5aa')}}}),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShadowMaterial({color: '#3d3229', opacity: 0.3, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}));
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.0004;
  shade.receiveShadow = true;
  scene.add(shade);

  const rings = new THREE.Group();
  {
    const lineMat = new THREE.LineBasicMaterial({color: '#7d756b', transparent: true, opacity: 0.4, fog: false});
    const dashMat = new THREE.LineDashedMaterial({color: '#7d756b', transparent: true, opacity: 0.38, dashSize: 0.06, gapSize: 0.05, fog: false});
    const circle = (r, n = 180) => new THREE.BufferGeometry().setFromPoints(Array.from({length: n + 1}, (_, i) => new V3(Math.cos((i / n) * Math.PI * 2) * r, 0, Math.sin((i / n) * Math.PI * 2) * r)));
    const a = new THREE.Line(circle(3.4), lineMat);
    a.position.y = 0.002;
    const b = new THREE.Line(circle(2.6), dashMat);
    b.computeLineDistances();
    b.position.y = 1.3;
    b.rotation.set(0.42, 0, 0.22);
    const c = new THREE.Line(circle(3.8), lineMat);
    c.position.y = 1.2;
    c.rotation.set(Math.PI / 2 - 0.25, 0.35, 0);
    const d = new THREE.Line(circle(1.7), dashMat);
    d.computeLineDistances();
    d.position.y = 0.003;
    rings.add(a, b, c, d);
    const dot = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.047, 24), new THREE.MeshBasicMaterial({color: '#6c655c', side: THREE.DoubleSide, fog: false}));
    for (const [x, z] of [[2.4, 2.3], [-3.0, 1.5], [1.4, -3.0]]) {
      const m = dot.clone();
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.004, z);
      rings.add(m);
    }
  }
  scene.add(rings);

  const blob = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(40,32,24,1)');
    gr.addColorStop(0.5, 'rgba(40,32,24,.45)');
    gr.addColorStop(1, 'rgba(40,32,24,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -10}));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.003;
    m.renderOrder = 1;
    return m;
  })();
  scene.add(blob);

  const robot = buildFreedom();
  robot.group.scale.setScalar(SPEC.scale);
  scene.add(robot.group);

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  /** cam: {tx, ty, tz, az, el, d (radians for az/el), sx, sy}; ops: see robot.update */
  const frame = (t, cam, ops = {}) => {
    const info = robot.update(t, ops);
    const alt = info.bp.alt * SPEC.scale;
    blob.position.set(info.bp.x * SPEC.scale, 0.003, info.bp.z * SPEC.scale);
    blob.scale.setScalar(1.6 + 1.1 * alt);
    blob.material.opacity = 0.42 / (1 + 1.4 * alt);
    // AO sees glass as solid; it is skipped while the armor is clear
    aoAllowed = (ops.xray ?? 0) < 0.05;
    gtao.needsSwap = aoOn && aoAllowed;
    const {tx, ty, tz, az, el} = cam;
    const d = cam.d * LENS;
    camera.position.set(tx + d * Math.cos(el) * Math.sin(az), ty + d * Math.sin(el), tz + d * Math.cos(el) * Math.cos(az));
    camera.lookAt(tx, ty, tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    composer.render();
    return info;
  };
  const pv = new V3();
  const project = (p) => {
    pv.copy(p).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({samples, shadow, ao}) => {
    if (samples !== undefined)
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    if (shadow !== undefined) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    if (ao !== undefined) {
      aoOn = ao > 0;
      gtao.needsSwap = aoOn;
      if (aoOn) {
        gtao.updateGtaoMaterial({samples: ao});
        gtao.updatePdMaterial({samples: Math.max(4, ao)});
      }
    }
  };
  return {renderer, scene, camera, composer, robot, resize, frame, project, size, setQuality};
}
