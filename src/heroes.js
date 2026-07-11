import * as THREE from 'three';
import { G, COLORS } from './state.js';
import * as audio from './audio.js';
import * as hud from './hud.js';

// 四名跑者 —— 生物合成体作战单元
export const HEROES = {
  glitch: {
    id: 'glitch', name: 'GLITCH', cn: '骇 影', color: '#c9f24b', glyph: 'G',
    q: { name: '相位冲刺', cd: 7, icon: '⚡', desc: '向移动方向瞬间突进' },
    e: { name: '残影诱饵', cd: 18, icon: '⧉', desc: '投放全息残影吸引火力' },
  },
  locus: {
    id: 'locus', name: 'LOCUS', cn: '壁 垒', color: '#37e1e8', glyph: 'L',
    q: { name: '动能壁垒', cd: 24, icon: '▬', desc: '展开可拦弹的能量墙' },
    e: { name: '过载装甲', cd: 26, icon: '⬡', desc: '立即获得 50 点护甲' },
  },
  blackbird: {
    id: 'blackbird', name: 'BLACKBIRD', cn: '黑 鸫', color: '#ff2e7e', glyph: 'B',
    q: { name: '声呐脉冲', cd: 22, icon: '◎', desc: '短暂透视全场敌人' },
    e: { name: '猎杀标记', cd: 15, icon: '✛', desc: '长时间标记最近的敌人' },
  },
  void: {
    id: 'void', name: 'VOID', cn: '虚 无', color: '#8f7bff', glyph: 'V',
    q: { name: '虚空烟幕', cd: 20, icon: '●', desc: '在准星处布下遮蔽力场' },
    e: { name: '相位隐形', cd: 26, icon: '◌', desc: '短暂对 AI 隐形，开火解除' },
  },
};

export function initAbilities() {
  G.player.abil = { q: { readyAt: 0 }, e: { readyAt: 0 } };
}

export function useAbility(slot) {
  const p = G.player;
  if (!p.alive || G.phase === 'end' || G.state !== 'playing') return;
  const hero = HEROES[p.hero];
  const ab = p.abil[slot];
  if (G.time < ab.readyAt) return;
  const def = hero[slot];

  const fns = {
    glitch: { q: dash, e: decoy },
    locus: { q: barrier, e: overshield },
    blackbird: { q: sonar, e: mark },
    void: { q: smoke, e: cloak },
  };
  const ok = fns[p.hero][slot]();
  if (ok !== false) {
    ab.readyAt = G.time + def.cd;
    hud.announceSub(`${def.name} 已激活`);
  }
}

/* ---- GLITCH ---- */
function dash() {
  const p = G.player;
  const dir = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
  // 有移动输入时沿输入方向冲
  if (p.moveDir && p.moveDir.lengthSq() > 0.01) dir.copy(p.moveDir).normalize();
  p.dashDir = dir;
  p.dashUntil = G.time + 0.16;
  audio.dashSnd();
}

function decoy() {
  const p = G.player;
  const dir = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.36, 0.85, 4, 12),
    new THREE.MeshStandardMaterial({ color: COLORS.acid, transparent: true, opacity: 0.55, emissive: 0x3a4a00 })
  );
  const pos = p.pos.clone().addScaledVector(dir, 1.2);
  mesh.position.set(pos.x, 1.0, pos.z);
  G.scene.add(mesh);
  G.decoys.push({ kind: 'decoy', team: 'ally', mesh, pos: mesh.position, hp: 80, alive: true, until: G.time + 6 });
  audio.decoySnd();
}

/* ---- LOCUS ---- */
function barrier() {
  const p = G.player;
  const dir = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
  const c = p.pos.clone().addScaledVector(dir, 3);
  c.x = Math.max(-36, Math.min(36, c.x));
  c.z = Math.max(-28, Math.min(28, c.z));
  const alongX = Math.abs(dir.x) < Math.abs(dir.z); // 面朝 z 向 → 墙沿 x 展开
  const w = alongX ? 4.4 : 0.5, d = alongX ? 0.5 : 4.4;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, 2.4, d),
    new THREE.MeshStandardMaterial({ color: 0x37e1e8, transparent: true, opacity: 0.5, emissive: 0x0a3a3d })
  );
  mesh.position.set(c.x, 1.2, c.z);
  mesh.userData.barrier = true;
  G.scene.add(mesh);
  const collider = { minX: c.x - w / 2, maxX: c.x + w / 2, minZ: c.z - d / 2, maxZ: c.z + d / 2, h: 2.4, barrier: true };
  G.colliders.push(collider);
  G.wallMeshes.push(mesh);
  G.shootables.push(mesh);
  const b = { mesh, collider, hp: 400, until: G.time + 12 };
  mesh.userData.barrierRef = b;
  G.barriers.push(b);
  audio.barrierSnd();
}

export function removeBarrier(b) {
  G.scene.remove(b.mesh);
  G.colliders.splice(G.colliders.indexOf(b.collider), 1);
  G.wallMeshes.splice(G.wallMeshes.indexOf(b.mesh), 1);
  G.shootables.splice(G.shootables.indexOf(b.mesh), 1);
  G.barriers.splice(G.barriers.indexOf(b), 1);
}

function overshield() {
  G.player.armor = Math.min(100, G.player.armor + 50);
  audio.barrierSnd();
}

/* ---- BLACKBIRD ---- */
function sonar() {
  for (const b of G.bots) if (b.team === 'enemy' && b.alive) b.revealUntil = G.time + 4;
  audio.sonarSnd();
}

function mark() {
  const p = G.player;
  let best = null, bd = Infinity;
  for (const b of G.bots) {
    if (b.team !== 'enemy' || !b.alive) continue;
    const d = b.pos.distanceTo(p.pos);
    if (d < bd) { bd = d; best = b; }
  }
  if (!best) return false;
  best.revealUntil = G.time + 8;
  audio.sonarSnd();
}

/* ---- VOID ---- */
function smoke() {
  const p = G.player;
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  const rc = new THREE.Raycaster(G.camera.position.clone(), dir, 0.5, 24);
  const hits = rc.intersectObjects(G.wallMeshes, false);
  const point = hits.length ? hits[0].point : G.camera.position.clone().addScaledVector(dir, 22);
  point.y = 1.8;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(4.5, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0x9aa8b5, transparent: true, opacity: 0.86, roughness: 1, depthWrite: false })
  );
  mesh.position.copy(point);
  G.scene.add(mesh);
  G.smokes.push({ pos: point, r: 4.2, until: G.time + 11, mesh });
  audio.smokeSnd();
}

function cloak() {
  G.player.cloakUntil = G.time + 6;
  audio.cloakSnd();
}

/* ---- 每帧维护 ---- */
export function update() {
  const t = G.time;
  for (let i = G.decoys.length - 1; i >= 0; i--) {
    const d = G.decoys[i];
    if (t > d.until || d.hp <= 0 || !d.alive) {
      d.alive = false;
      G.scene.remove(d.mesh);
      G.decoys.splice(i, 1);
    }
  }
  for (let i = G.smokes.length - 1; i >= 0; i--) {
    const s = G.smokes[i];
    const left = s.until - t;
    if (left <= 0) { G.scene.remove(s.mesh); G.smokes.splice(i, 1); continue; }
    if (left < 1.5) s.mesh.material.opacity = 0.86 * (left / 1.5);
  }
  for (let i = G.barriers.length - 1; i >= 0; i--) {
    const b = G.barriers[i];
    if (t > b.until || b.hp <= 0) removeBarrier(b);
    else b.mesh.material.opacity = 0.25 + 0.25 * (b.hp / 400);
  }
}

export function clearAbilityObjects() {
  for (const d of [...G.decoys]) { G.scene.remove(d.mesh); }
  G.decoys.length = 0;
  for (const s of [...G.smokes]) { G.scene.remove(s.mesh); }
  G.smokes.length = 0;
  for (const b of [...G.barriers]) removeBarrier(b);
}
