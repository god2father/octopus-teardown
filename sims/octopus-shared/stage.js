// The OC-8's stage: a pale warm test tank. PBR under a soft key with PCF shadows, GTAO for contact (the floor kept
// out of it), an unlit floor that fades into the backdrop, thin survey rings around the drone, and the jet wake as
// points streaming out of the siphon. frame(t, cam, ops) poses the robot and draws one frame.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildRobot} from './robot.js';
import {JET_HZ} from './kin.js';

const V3 = THREE.Vector3;
export const BG = '#f3f0eb';

const FLOOR_VERT = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FLOOR_FRAG = /* glsl */ `uniform vec3 uFloor; uniform vec3 uBg; uniform vec3 uLine; varying vec3 vW;
  void main(){
    float d = length(vW.xz);
    // faint survey circles every metre, a finer one at 0.5 m
    float ring = abs(fract(d + 0.5) - 0.5);
    float w = fwidth(d);
    float line = (1.0 - smoothstep(0.0, w * 1.4, ring)) * 0.35;
    vec3 col = mix(uFloor, uLine, line * (1.0 - smoothstep(1.5, 5.5, d)));
    float fade = smoothstep(2.6, 9.0, d);
    gl_FragColor = vec4(mix(col, uBg, fade), 1.0);
  }`;

// the jet wake: bubbles born at the nozzle on a loop, pushed out along the siphon's axis and drifting up
const WAKE_VERT = /* glsl */ `attribute vec4 aSeed; uniform float uT; uniform vec3 uO; uniform vec3 uD; uniform float uPr; uniform float uAmt; uniform float uHz;
  varying float vA;
  void main(){
    float life = 1.6 + aSeed.w * 1.2;
    float age = mod(uT + aSeed.x * 7.0, life);
    float k = age / life;
    vec3 side = normalize(cross(uD, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(side, uD);
    float pulse = 0.6 + 0.4 * sin((uT - age) * 6.2831 * uHz);
    vec3 p = uO + uD * (age * (1.6 * pulse) - age * age * 0.25) + side * (aSeed.y - 0.5) * age * 0.5 + up * ((aSeed.z - 0.5) * age * 0.4 + age * age * 0.12);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPr * (2.0 + 4.0 * aSeed.z) * (0.5 + k) * clamp(8.0 / -mv.z, 0.4, 2.0);
    vA = 0.7 * uAmt * smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.55, 1.0, k));
  }`;
const WAKE_FRAG = /* glsl */ `uniform vec3 uCol; varying float vA;
  void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); float a = (smoothstep(0.5, 0.36, r) - 0.65 * smoothstep(0.34, 0.12, r)) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uCol, a); }`;

export function createOctoStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  // Neutral keeps the cream backdrop cream (ACES greys it); the contrast comes from the lighting instead
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 12, 30);
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.05, 200);
  const rt = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 4});
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 1.0;
  gtao.updateGtaoMaterial({radius: 0.16, distanceExponent: 1.6, thickness: 1.2, scale: 1.15, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
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
    shade.visible = v;
    rings.visible = v;
    wake.visible = v && wakeOn;
  };
  composer.addPass(new Toggle(hideForAO(false)));
  let aoOn = true;
  const gtaoRender = gtao.render.bind(gtao);
  gtao.render = (...a) => (aoOn ? gtaoRender(...a) : undefined);
  composer.addPass(gtao);
  composer.addPass(new Toggle(hideForAO(true)));
  composer.addPass(new OutputPass());

  // a warm studio: three soft boxes over a pale floor, prefiltered
  {
    // a darker room than the backdrop, so the clear coat reflects distinct soft boxes (the highlights that make
    // the shell read as lacquered) and the undersides fall off instead of glowing
    const env = new THREE.Scene();
    env.background = new THREE.Color('#8f8a83');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 0.985, 0.96).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(12, 6, new V3(-10, 10, 9), 4.2); // key soft box, upper left front
    box(8, 8, new V3(10, 12, -6), 2.4); // rim from behind right
    box(18, 2.2, new V3(2, 4, 15), 2.2); // a long strip in front: the horizontal highlight along each sleeve
    box(26, 26, new V3(0, 16, 0), 1.25); // overhead
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#b3aca2', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -1.5;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.03).texture;
    scene.environmentIntensity = 0.85;
    pm.dispose();
  }
  const SUN = new V3(-0.45, 0.8, 0.4).normalize();
  const sun = new THREE.DirectionalLight('#fff6ea', 2.4);
  sun.castShadow = true;
  const EXT = 3.4;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 0.5, far: 24});
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.004;
  sun.position.copy(SUN).multiplyScalar(10);
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#fbf8f3', '#a99d8e', 0.3));

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.ShaderMaterial({vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG, toneMapped: false, uniforms: {uFloor: {value: new THREE.Color('#eeeae4')}, uBg: {value: new THREE.Color(BG)}, uLine: {value: new THREE.Color('#bdb5aa')}}}),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({color: '#3d3229', opacity: 0.32, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}));
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.0004;
  shade.receiveShadow = true;
  scene.add(shade);

  // survey rings: thin lines around the drone, a dashed one tilted through it, small station markers
  const rings = new THREE.Group();
  {
    const lineMat = new THREE.LineBasicMaterial({color: '#7d756b', transparent: true, opacity: 0.4, fog: false});
    const dashMat = new THREE.LineDashedMaterial({color: '#7d756b', transparent: true, opacity: 0.38, dashSize: 0.05, gapSize: 0.04, fog: false});
    const circle = (r, n = 160) => new THREE.BufferGeometry().setFromPoints(Array.from({length: n + 1}, (_, i) => new V3(Math.cos((i / n) * Math.PI * 2) * r, 0, Math.sin((i / n) * Math.PI * 2) * r)));
    const a = new THREE.Line(circle(2.9), lineMat);
    a.position.y = 0.002;
    const b = new THREE.Line(circle(2.2), dashMat);
    b.computeLineDistances();
    b.position.y = 1.05;
    b.rotation.set(0.42, 0, 0.22);
    const c = new THREE.Line(circle(3.3), lineMat);
    c.position.y = 1.0;
    c.rotation.set(Math.PI / 2 - 0.25, 0.35, 0);
    const d = new THREE.Line(circle(1.35), dashMat);
    d.computeLineDistances();
    d.position.y = 0.003;
    rings.add(a, b, c, d);
    const dot = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.04, 24), new THREE.MeshBasicMaterial({color: '#6c655c', side: THREE.DoubleSide, fog: false}));
    for (const [x, z] of [[2.05, 1.95], [-2.6, 1.3], [1.2, -2.6]]) {
      const m = dot.clone();
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.004, z);
      rings.add(m);
    }
  }
  scene.add(rings);

  const robot = buildRobot();
  scene.add(robot.group);

  // the wake
  const NW = 900;
  const wakeGeo = new THREE.BufferGeometry();
  {
    const s = new Float32Array(NW * 4);
    let r = 29;
    for (let i = 0; i < NW * 4; i++) s[i] = (r = (r * 16807) % 2147483647) / 2147483647;
    wakeGeo.setAttribute('aSeed', new THREE.BufferAttribute(s, 4));
    wakeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NW * 3), 3));
  }
  const wakeMat = new THREE.ShaderMaterial({
    vertexShader: WAKE_VERT,
    fragmentShader: WAKE_FRAG,
    uniforms: {uT: {value: 0}, uO: {value: new V3()}, uD: {value: new V3(0, 0, -1)}, uPr: {value: 1}, uAmt: {value: 0}, uHz: {value: JET_HZ}, uCol: {value: new THREE.Color('#8fa6b3')}},
    transparent: true,
    depthWrite: false,
  });
  const wake = new THREE.Points(wakeGeo, wakeMat);
  wake.frustumCulled = false;
  wake.renderOrder = 4;
  scene.add(wake);
  let wakeOn = false;

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    wakeMat.uniforms.uPr.value = pr;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const nozzle = new V3();
  const ndir = new V3();
  /** cam: {tx, ty, tz, az, el, d (radians for az/el), sx, sy}; ops: mantle, apart[8], spread, jet, wake, beak, optic, turn */
  const frame = (t, cam, ops = {}) => {
    robot.group.rotation.y = ops.turn ?? 0;
    const info = robot.update(t, ops);
    // wake from the nozzle along the siphon's axis
    robot.siphon.children[2].getWorldPosition(nozzle);
    robot.siphon.getWorldDirection(ndir);
    nozzle.addScaledVector(ndir, 0.12);
    wakeMat.uniforms.uO.value.copy(nozzle);
    wakeMat.uniforms.uD.value.copy(ndir);
    wakeMat.uniforms.uT.value = t;
    const amt = Math.max(ops.jet ?? 0, (ops.wake ?? 0) * 0.55);
    wakeMat.uniforms.uAmt.value = amt;
    wakeOn = amt > 0.01;
    wake.visible = wakeOn;

    const {tx, ty, tz, az, el, d} = cam;
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
