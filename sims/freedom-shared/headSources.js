import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import agyGlb from '../../assets/freedom-head/web/head-agy-v7.glb';
import claudeGlb from '../../assets/freedom-head/web/head-claude-v10.glb';
import codexGlb from '../../assets/freedom-head/web/head-codex-v19.glb';

export const HEAD_SOURCE_KEYS = ['agy', 'claude', 'codex', 'orig'];
export const DEFAULT_HEAD_SOURCE = 'agy';

export const HEAD_SOURCES = {
  agy: {
    id: 'agy',
    label: 'AGY V7',
    zh: '本轮 v7',
    sub: 'ANTIGRAVITY · V7-POLISH',
    glb: agyGlb,
    targetH: 2.45,
    baseY: -1.12,
    offsetZ: -0.02,
  },
  claude: {
    id: 'claude',
    label: 'CLAUDE V10',
    zh: '重建 v10',
    sub: 'CLAUDE CODE · REBUILD V10',
    glb: claudeGlb,
    targetH: 2.62,
    baseY: -1.24,
    offsetZ: 0.06,
  },
  codex: {
    id: 'codex',
    label: 'CODEX V19',
    zh: '交接 V19',
    sub: 'CODEX · HEAD V19',
    glb: codexGlb,
    targetH: 2.50,
    baseY: -1.18,
    offsetZ: 0.02,
  },
  orig: {
    id: 'orig',
    label: 'ORIG 3D',
    zh: '原版程序化',
    sub: 'THREE.JS · PROCEDURAL',
    glb: null,
  },
};

function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function createHeadMount(headNode, origGroup) {
  const loader = new GLTFLoader();
  const slots = {orig: origGroup};
  const glbMaterials = [];
  let active = DEFAULT_HEAD_SOURCE;
  let lastPs = 1;
  let lastXr = 0;

  const applyVisibility = () => {
    for (const [id, group] of Object.entries(slots)) {
      if (group) group.visible = id === active;
    }
  };

  const applyEffectsToMat = (entry, ps, xr) => {
    const {mat, origColor, origOpacity, origTransparent, origDepthWrite, isEmissive} = entry;
    if (mat.color && origColor && !isEmissive) {
      const lum = origColor.r * 0.299 + origColor.g * 0.587 + origColor.b * 0.114;
      const grey = new THREE.Color(lum * 0.68, lum * 0.70, lum * 0.73);
      mat.color.lerpColors(grey, origColor, ps);
    }
    if (xr > 0.02) {
      mat.transparent = true;
      mat.opacity = Math.max(0.12, 1 - 0.85 * xr);
      mat.depthWrite = false;
    } else {
      mat.transparent = origTransparent;
      mat.opacity = origOpacity;
      mat.depthWrite = origDepthWrite;
    }
  };

  const loadSlot = (cfg) => {
    const container = new THREE.Group();
    container.name = `headSlot_${cfg.id}`;
    container.visible = cfg.id === active;
    headNode.add(container);
    slots[cfg.id] = container;

    if (!cfg.glb) return;
    const buf = base64ToArrayBuffer(cfg.glb);
    loader.parse(
      buf,
      '',
      (gltf) => {
        const root = gltf.scene;
        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const s = size.y > 1e-4 ? cfg.targetH / size.y : 1;
        root.scale.setScalar(s);
        root.position.set(
          -center.x * s,
          -box.min.y * s + cfg.baseY,
          -center.z * s + cfg.offsetZ,
        );

        root.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.castShadow = true;
          obj.receiveShadow = true;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const mat of mats) {
            if (!mat) continue;
            if ('envMapIntensity' in mat) mat.envMapIntensity = Math.max(mat.envMapIntensity ?? 1, 0.9);
            const isEmissive = Boolean(mat.emissive && (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0.25);
            const entry = {
              mat,
              origColor: mat.color ? mat.color.clone() : null,
              origOpacity: mat.opacity ?? 1,
              origTransparent: Boolean(mat.transparent),
              origDepthWrite: mat.depthWrite !== false,
              isEmissive,
            };
            glbMaterials.push(entry);
            applyEffectsToMat(entry, lastPs, lastXr);
          }
        });

        container.add(root);
        applyVisibility();
      },
      (err) => {
        console.error(`[headSources] Failed to parse ${cfg.id}:`, err);
      },
    );
  };

  origGroup.visible = active === 'orig';
  for (const k of HEAD_SOURCE_KEYS) {
    if (k !== 'orig') loadSlot(HEAD_SOURCES[k]);
  }

  return {
    setSource(id) {
      if (!HEAD_SOURCES[id]) return active;
      active = id;
      applyVisibility();
      return active;
    },
    getSource() {
      return active;
    },
    updateEffects(ps, xr) {
      if (Math.abs(ps - lastPs) < 1e-3 && Math.abs(xr - lastXr) < 1e-3) return;
      lastPs = ps;
      lastXr = xr;
      for (const entry of glbMaterials) applyEffectsToMat(entry, ps, xr);
    },
  };
}
