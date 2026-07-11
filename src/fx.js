import * as THREE from 'three';
import { G, COLORS } from './state.js';

const items = []; // {obj, until, born, kind}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const sparkMat = new THREE.SpriteMaterial({ color: 0xffffb0, transparent: true });
const acidSparkMat = new THREE.SpriteMaterial({ color: COLORS.acid, transparent: true });

function add(obj, life, kind = '') {
  G.scene.add(obj);
  items.push({ obj, born: G.time, until: G.time + life, kind });
}

export function tracer(from, to, color = 0xfff6c8) {
  const len = from.distanceTo(to);
  if (len < 0.3) return;
  const m = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  m.scale.set(0.025, 0.025, len);
  m.position.copy(from).add(to).multiplyScalar(0.5);
  m.lookAt(to);
  add(m, 0.07, 'tracer');
}

export function impact(pos, acid = false) {
  const s = new THREE.Sprite((acid ? acidSparkMat : sparkMat).clone());
  s.position.copy(pos);
  s.scale.setScalar(0.3 + Math.random() * 0.2);
  add(s, 0.12, 'spark');
}

export function muzzleFlash(pos) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    color: 0xffefa0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.position.copy(pos);
  s.scale.setScalar(0.25 + Math.random() * 0.15);
  add(s, 0.045, 'spark');
}

export function deathBurst(pos, enemy) {
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      color: enemy ? 0xff5c66 : COLORS.acid, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    s.position.copy(pos).add(new THREE.Vector3((Math.random() - .5), Math.random() * 1.4, (Math.random() - .5)));
    s.scale.setScalar(0.4);
    add(s, 0.35 + Math.random() * 0.2, 'spark');
  }
}

export function explosion(pos) {
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({
    color: 0xfff2c0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  core.position.copy(pos);
  add(core, 1.0, 'boom');
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 8, 40), new THREE.MeshBasicMaterial({
    color: COLORS.acid, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  ring.position.copy(pos).setY(0.4);
  ring.rotation.x = Math.PI / 2;
  add(ring, 1.2, 'ring');
  const light = new THREE.PointLight(0xffe9a0, 300, 60, 1.8);
  light.position.copy(pos).setY(3);
  add(light, 0.5, 'light');
  G.shake = Math.min(1.6, G.shake + 1.4);
}

export function update() {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    const k = (G.time - it.born) / (it.until - it.born);
    if (k >= 1) {
      G.scene.remove(it.obj);
      if (it.obj.material) it.obj.material.dispose?.();
      items.splice(i, 1);
      continue;
    }
    if (it.kind === 'spark') it.obj.material.opacity = 1 - k;
    if (it.kind === 'tracer') it.obj.material.opacity = 0.85 * (1 - k);
    if (it.kind === 'boom') { it.obj.scale.setScalar(1 + k * 14); it.obj.material.opacity = 0.95 * (1 - k); }
    if (it.kind === 'ring') { it.obj.scale.setScalar(1 + k * 22); it.obj.material.opacity = 1 - k; }
    if (it.kind === 'light') it.obj.intensity = 300 * (1 - k);
  }
}
