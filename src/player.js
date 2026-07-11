import * as THREE from 'three';
import { G, COLORS } from './state.js';
import { WEAPONS, falloff } from './weapons.js';
import { SPAWNS, inSite } from './world.js';
import * as audio from './audio.js';
import * as fx from './fx.js';
import * as hud from './hud.js';
import * as bots from './bots.js';
import * as rounds from './rounds.js';
import { useAbility } from './heroes.js';

const keys = new Set();
let viewmodel = null, muzzle = null;
const EYE = 1.62, EYE_CROUCH = 1.15, RADIUS = 0.42;

export function initPlayer() {
  const p = {
    pos: new THREE.Vector3(0, 0, 25),
    vel: new THREE.Vector3(),
    yaw: 0, pitch: 0,
    hp: 100, armor: 0, alive: true,
    hero: 'glitch',
    primary: null,
    current: 'secondary',
    ammo: {},
    firing: false, ads: false,
    bloom: 0, nextShot: 0, reloadEndsAt: 0,
    recoilPitch: 0, vmKick: 0,
    dashUntil: 0, dashDir: new THREE.Vector3(),
    cloakUntil: 0,
    moveDir: new THREE.Vector3(),
    crouch: false, walk: false,
    onGround: true,
    eyeH: EYE, fov: 74,
    interactProgress: 0,
    diedThisRound: false,
    kills: 0,
    specTarget: null, deadAt: 0,
  };
  G.player = p;
  resetAmmo();

  window.addEventListener('keydown', (e) => {
    if (G.state !== 'playing') return;
    keys.add(e.code);
    if (e.code === 'KeyR') startReload();
    if (e.code === 'Digit1' && p.primary) switchTo('primary');
    if (e.code === 'Digit2') switchTo('secondary');
    if (e.code === 'Digit3') switchTo('knife');
    if (e.code === 'KeyQ') useAbility('q');
    if (e.code === 'KeyE') useAbility('e');
    if (e.code === 'KeyB') hud.toggleBuy();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  window.addEventListener('mousemove', (e) => {
    if (G.state !== 'playing' || G.paused || !p.alive) return;
    const locked = document.pointerLockElement === G.renderer.domElement;
    // 未锁定指针时也直接用鼠标移动转向；购买菜单打开时例外（需要光标点选）
    if (!locked && G.ui && G.ui.buyOpen) return;
    const s = G.sens * 0.0021;
    p.yaw -= (e.movementX || 0) * s;
    p.pitch = Math.max(-1.45, Math.min(1.45, p.pitch - (e.movementY || 0) * s));
  });
  window.addEventListener('mousedown', (e) => {
    if (G.state !== 'playing' || G.paused) return;
    if (!p.alive) {
      // 观战中左键切换队友
      if (e.button === 0 && G.time - p.deadAt > 1.2) switchSpectate(1);
      return;
    }
    if (e.button === 0) p.firing = true;
    if (e.button === 2) p.ads = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) p.firing = false;
    if (e.button === 2) p.ads = false;
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  buildViewmodel();
}

function resetAmmo() {
  const p = G.player;
  for (const id of ['pistol', 'smg', 'shotgun', 'rifle', 'sniper']) {
    p.ammo[id] = { mag: WEAPONS[id].mag, res: WEAPONS[id].reserve };
  }
}

export function currentWeapon() {
  const p = G.player;
  if (p.current === 'knife') return WEAPONS.knife;
  if (p.current === 'primary') return WEAPONS[p.primary] || WEAPONS.pistol;
  return WEAPONS.pistol;
}

function switchTo(slot) {
  const p = G.player;
  if (slot === 'primary' && !p.primary) return;
  if (p.current === slot) return;
  p.current = slot;
  p.reloadEndsAt = 0; p.firing = false;
  buildViewmodel();
  audio.uiClick();
}

export function buyWeapon(id) {
  const p = G.player;
  const w = WEAPONS[id];
  if (G.phase !== 'buy' || !w || G.credits < w.price) return false;
  if (p.primary === id) return false;
  G.credits -= w.price;
  p.primary = id;
  p.ammo[id] = { mag: w.mag, res: w.reserve };
  p.current = 'primary';
  buildViewmodel();
  audio.buySnd();
  return true;
}

export function buyArmor() {
  const p = G.player;
  if (G.phase !== 'buy' || G.credits < 1000 || p.armor >= 50) return false;
  G.credits -= 1000;
  p.armor = 50;
  audio.buySnd();
  return true;
}

/* ---------------- 视角模型 ---------------- */
function buildViewmodel() {
  if (viewmodel) { G.camera.remove(viewmodel); }
  viewmodel = new THREE.Group();
  const w = currentWeapon();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd8dcd4, roughness: 0.5, metalness: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1f1a, roughness: 0.6 });
  const acidMat = new THREE.MeshStandardMaterial({ color: COLORS.acid, emissive: 0x55661a, roughness: 0.4 });

  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); viewmodel.add(m); return m;
  };

  if (w.type === 'melee') {
    add(new THREE.BoxGeometry(0.02, 0.16, 0.30), bodyMat, 0, 0.02, -0.12);
    add(new THREE.BoxGeometry(0.035, 0.09, 0.13), darkMat, 0, -0.07, 0.05);
    add(new THREE.BoxGeometry(0.04, 0.012, 0.30), acidMat, 0, 0.1, -0.12);
  } else {
    const len = { pistol: 0.34, smg: 0.46, shotgun: 0.55, rifle: 0.58, sniper: 0.72 }[w.id] || 0.4;
    add(new THREE.BoxGeometry(0.075, 0.11, len), bodyMat, 0, 0, -len / 2);
    add(new THREE.BoxGeometry(0.05, 0.06, len * 0.5), darkMat, 0, 0.055, -len * 0.66);
    add(new THREE.BoxGeometry(0.045, 0.045, 0.22), darkMat, 0, 0.01, -len - 0.08);
    add(new THREE.BoxGeometry(0.05, 0.16, 0.09), darkMat, 0, -0.12, 0.02);
    add(new THREE.BoxGeometry(0.045, 0.13, 0.05), darkMat, 0, -0.11, -len * 0.45);
    add(new THREE.BoxGeometry(0.08, 0.02, len * 0.8), acidMat, 0, -0.045, -len / 2);
    if (w.zoom) add(new THREE.BoxGeometry(0.035, 0.05, 0.2), acidMat, 0, 0.09, -len * 0.4);
  }
  muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.01, -((w.type === 'melee' ? 0.3 : 0.9)));
  viewmodel.add(muzzle);
  viewmodel.position.set(0.26, -0.24, -0.45);
  G.camera.add(viewmodel);
  applyCloakVisual();
}

function applyCloakVisual() {
  if (!viewmodel) return;
  const cloaked = G.time < G.player.cloakUntil;
  viewmodel.traverse((o) => {
    if (o.isMesh) { o.material.transparent = cloaked; o.material.opacity = cloaked ? 0.25 : 1; }
  });
}

/* ---------------- 射击 ---------------- */
function startReload() {
  const p = G.player, w = currentWeapon();
  if (w.type === 'melee' || p.reloadEndsAt > 0) return;
  const a = p.ammo[w.id];
  if (!a || a.res <= 0 || a.mag >= w.mag) return;
  p.reloadEndsAt = G.time + (w.id === 'sniper' ? 3 : 2.2);
  audio.reloadSnd();
}

function fire() {
  const p = G.player, w = currentWeapon();
  const a = p.ammo[w.id];
  if (a.mag <= 0) { audio.dryfire(); startReload(); p.firing = false; return; }
  a.mag--;
  p.nextShot = G.time + 60 / w.rpm;
  if (!w.auto) p.firing = false;

  const moveFactor = p.vel.length() > 2 ? 2.1 : 1;
  const airFactor = p.onGround ? 1 : 2.6;
  const crouchFactor = p.crouch ? 0.7 : 1;
  const adsFactor = p.ads ? 0.45 : 1;
  const spread = w.spread * (1 + p.bloom) * moveFactor * airFactor * crouchFactor * adsFactor;
  p.bloom = Math.min(3, p.bloom + 0.35);

  const muzzlePos = new THREE.Vector3();
  muzzle.getWorldPosition(muzzlePos);

  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const dir = new THREE.Vector3();
    G.camera.getWorldDirection(dir);
    dir.x += (Math.random() - 0.5) * 2 * spread;
    dir.y += (Math.random() - 0.5) * 2 * spread;
    dir.z += (Math.random() - 0.5) * 2 * spread;
    dir.normalize();

    const rc = new THREE.Raycaster(G.camera.position.clone(), dir, 0.1, 200);
    const hits = rc.intersectObjects(G.shootables, true);
    let end = G.camera.position.clone().addScaledVector(dir, 120);
    for (const h of hits) {
      const bot = h.object.userData.bot;
      if (bot && (!bot.alive || bot.team === 'ally')) continue;
      end = h.point;
      if (bot) {
        const isHead = h.object.name === 'head';
        const dmg = w.dmg * (isHead ? w.hsMul : 1) * falloff(w, h.distance);
        bots.damageBot(bot, dmg, { name: '你', isPlayer: true }, isHead, w.name);
        hud.hitmarker(isHead);
        audio.hitmark(isHead);
        fx.impact(h.point, true);
      } else if (h.object.userData.barrier) {
        h.object.userData.barrierRef.hp -= w.dmg;
        fx.impact(h.point, false);
      } else {
        fx.impact(h.point, false);
      }
      break;
    }
    fx.tracer(muzzlePos, end);
  }

  fx.muzzleFlash(muzzlePos);
  audio.shot(w.kind);
  p.recoilPitch += w.kick * (0.8 + Math.random() * 0.4);
  p.vmKick = 0.07;
  p.cloakUntil = 0; applyCloakVisual();
  bots.alertNear(p.pos, 30);
}

function melee() {
  const p = G.player, w = WEAPONS.knife;
  p.nextShot = G.time + 60 / w.rpm;
  p.firing = false;
  audio.shot('knife');
  p.vmKick = 0.1;
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  const rc = new THREE.Raycaster(G.camera.position.clone(), dir, 0.1, w.range);
  const hits = rc.intersectObjects(G.shootables, true);
  for (const h of hits) {
    const bot = h.object.userData.bot;
    if (bot && bot.alive && bot.team === 'enemy') {
      const isHead = h.object.name === 'head';
      bots.damageBot(bot, w.dmg * (isHead ? w.hsMul : 1), { name: '你', isPlayer: true }, isHead, w.name);
      hud.hitmarker(isHead); audio.hitmark(isHead);
      break;
    }
    if (bot) continue;
    break;
  }
}

/* ---------------- 受击 / 死亡 / 重生 ---------------- */
export function damagePlayer(dmg, sourceName, weaponName) {
  const p = G.player;
  if (!p.alive || G.phase === 'end') return;
  const absorbed = Math.min(p.armor, dmg * 0.5);
  p.armor -= absorbed;
  p.hp -= (dmg - absorbed);
  hud.damageFlash(Math.min(1, dmg / 60));
  G.shake = Math.min(1, G.shake + 0.25);
  audio.hurt();
  if (p.hp <= 0) {
    p.hp = 0; p.alive = false; p.firing = false; p.diedThisRound = true;
    p.deadAt = G.time; p.specTarget = null;
    p.ads = false; p.fov = 74;
    G.camera.fov = 74; G.camera.updateProjectionMatrix();
    hud.killfeed(sourceName, weaponName, '你', false, true);
    hud.showDeath(true);
    fx.deathBurst(p.pos.clone().setY(1.2), false);
    if (G.spike.carrier === 'player' && G.spike.state === 'carried') {
      rounds.dropSpike(p.pos.clone());
    }
    // 短暂俯瞰死亡镜头，之后自动切入队友观战
    G.camera.position.set(0, 58, 6);
    G.camera.rotation.set(-Math.PI / 2 + 0.18, 0, 0);
    if (viewmodel) viewmodel.visible = false;
    rounds.onDeath();
  }
}

export function respawnPlayer() {
  const p = G.player;
  const side = G.attackingTeam === 'ally' ? 'attack' : 'defend';
  const [sx, sz] = SPAWNS[side][0];
  p.pos.set(sx, 0, sz);
  p.vel.set(0, 0, 0);
  p.yaw = side === 'attack' ? 0 : Math.PI;
  p.pitch = 0;
  p.hp = 100;
  p.alive = true;
  p.crouch = false;
  p.cloakUntil = 0; p.dashUntil = 0;
  p.bloom = 0; p.recoilPitch = 0;
  p.reloadEndsAt = 0; p.firing = false; p.ads = false;
  p.interactProgress = 0;
  if (p.specTarget) { p.specTarget.group.visible = true; p.specTarget = null; }
  p.deadAt = 0;
  hud.setSpectate(null);
  if (p.diedThisRound) { p.primary = null; p.current = 'secondary'; }
  p.diedThisRound = false;
  resetAmmo();
  buildViewmodel();
  if (viewmodel) viewmodel.visible = true;
  hud.showDeath(false);
}

/* ---------------- 阵亡观战 ---------------- */
function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

function switchSpectate(dir) {
  const p = G.player;
  if (p.specTarget && !p.specTarget.alive) p.specTarget.group.visible = true;
  const allies = G.bots.filter(b => b.team === 'ally' && b.alive);
  if (!allies.length) { p.specTarget = null; hud.setSpectate(null); return; }
  const i = allies.indexOf(p.specTarget);
  const next = allies[(i + dir + allies.length) % allies.length];
  if (p.specTarget && p.specTarget !== next) p.specTarget.group.visible = true;
  p.specTarget = next;
  next.group.visible = false; // 第一人称观战，隐藏被观战者自身模型
  hud.setSpectate(next.name);
}

function updateSpectate(dt) {
  const p = G.player;
  if (G.phase !== 'live' && G.phase !== 'planted') return;
  if (G.time - p.deadAt < 1.2) return; // 先保留一段俯瞰死亡镜头
  if (!p.specTarget || !p.specTarget.alive) switchSpectate(1);
  const b = p.specTarget;
  if (!b) return; // 无存活队友时维持战术俯瞰
  const k = Math.min(1, 8 * dt);
  G.camera.position.lerp(new THREE.Vector3(b.pos.x, b.pos.y + 1.55, b.pos.z), k);
  G.camera.rotation.y = lerpAngle(G.camera.rotation.y, b.yaw, k);
  G.camera.rotation.x = lerpAngle(G.camera.rotation.x, 0, k);
  G.camera.rotation.z = 0;
}

/* ---------------- 主更新 ---------------- */
export function updatePlayer(dt) {
  const p = G.player;
  if (!p.alive) { updateSpectate(dt); return; }
  const t = G.time;
  const w = currentWeapon();

  // 装填完成
  if (p.reloadEndsAt > 0 && t >= p.reloadEndsAt) {
    const a = p.ammo[w.id];
    if (a) {
      const take = Math.min(w.mag - a.mag, a.res);
      a.mag += take; a.res -= take;
    }
    p.reloadEndsAt = 0;
  }

  // 输入
  p.walk = keys.has('ShiftLeft') || keys.has('ShiftRight');
  p.crouch = keys.has('KeyC') || keys.has('ControlLeft');
  const fwdAmt = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  const rightAmt = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  const F = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
  const R = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
  const wish = new THREE.Vector3().addScaledVector(F, fwdAmt).addScaledVector(R, rightAmt);
  if (wish.lengthSq() > 0) wish.normalize();
  p.moveDir.copy(wish);

  let speed = w.moveSpeed || 5.2;
  if (p.crouch) speed *= 0.55;
  else if (p.walk) speed *= 0.52;
  if (p.ads) speed *= 0.8;
  const frozen = G.phase === 'buy' || G.phase === 'end';

  const accel = p.onGround ? 1 - Math.exp(-14 * dt) : 1 - Math.exp(-3 * dt);
  p.vel.x += (wish.x * speed - p.vel.x) * accel;
  p.vel.z += (wish.z * speed - p.vel.z) * accel;

  if (t < p.dashUntil) {
    p.vel.x = p.dashDir.x * 22;
    p.vel.z = p.dashDir.z * 22;
  }

  if (keys.has('Space') && p.onGround && !frozen) { p.vel.y = 6.8; p.onGround = false; }
  p.vel.y -= 22 * dt;

  // 位移 + 碰撞（购买阶段锁在出生区附近仍可小范围移动）
  moveWithCollision(p, dt);

  // 相机
  p.eyeH += ((p.crouch ? EYE_CROUCH : EYE) - p.eyeH) * Math.min(1, 12 * dt);
  const speedRatio = Math.min(1, new THREE.Vector2(p.vel.x, p.vel.z).length() / 5.2);
  const bob = p.onGround ? Math.sin(t * 11) * 0.02 * speedRatio : 0;
  G.camera.position.set(p.pos.x, p.pos.y + p.eyeH + bob, p.pos.z);
  p.recoilPitch *= Math.exp(-8 * dt);
  G.camera.rotation.y = p.yaw;
  G.camera.rotation.x = p.pitch + p.recoilPitch;
  G.camera.rotation.z = -rightAmt * 0.006;
  if (G.shake > 0.01) {
    G.camera.rotation.x += (Math.random() - 0.5) * G.shake * 0.03;
    G.camera.rotation.y += (Math.random() - 0.5) * G.shake * 0.03;
    G.shake *= Math.exp(-4 * dt);
  }

  // FOV
  const targetFov = p.ads ? (w.zoom ? 27 : 60) : 74;
  if (Math.abs(p.fov - targetFov) > 0.1) {
    p.fov += (targetFov - p.fov) * Math.min(1, 12 * dt);
    G.camera.fov = p.fov;
    G.camera.updateProjectionMatrix();
  }

  // 散布回复
  p.bloom *= Math.exp(-5 * dt);

  // 开火
  if (!frozen && p.firing && t >= p.nextShot && p.reloadEndsAt === 0) {
    if (w.type === 'melee') melee();
    else fire();
  }

  // 视角模型动画
  if (viewmodel) {
    p.vmKick *= Math.exp(-10 * dt);
    const adsT = p.ads && w.type !== 'melee' ? 1 : 0;
    const tx = 0.26 * (1 - adsT), ty = -0.24 + 0.065 * adsT, tz = -0.45 + 0.08 * adsT;
    viewmodel.position.x += (tx - viewmodel.position.x) * Math.min(1, 10 * dt);
    viewmodel.position.y += (ty - viewmodel.position.y + Math.sin(t * 11) * 0.004 * speedRatio) * Math.min(1, 10 * dt);
    viewmodel.position.z = tz + p.vmKick;
    viewmodel.rotation.x = p.vmKick * 1.4;
    viewmodel.visible = !(p.ads && w.zoom); // 狙击开镜隐藏枪模
  }
  if (G.time < p.cloakUntil || (p.cloakUntil > 0 && G.time < p.cloakUntil + 0.1)) applyCloakVisual();

  // F 交互: 安放 / 拆除
  handleInteract(dt);
}

function moveWithCollision(p, dt) {
  // X 轴
  p.pos.x += p.vel.x * dt;
  for (const c of G.colliders) {
    if (p.pos.y >= c.h) continue;
    if (p.pos.x > c.minX - RADIUS && p.pos.x < c.maxX + RADIUS &&
        p.pos.z > c.minZ - RADIUS && p.pos.z < c.maxZ + RADIUS) {
      p.pos.x = p.vel.x > 0 ? c.minX - RADIUS : c.maxX + RADIUS;
      p.vel.x = 0;
    }
  }
  // Z 轴
  p.pos.z += p.vel.z * dt;
  for (const c of G.colliders) {
    if (p.pos.y >= c.h) continue;
    if (p.pos.x > c.minX - RADIUS && p.pos.x < c.maxX + RADIUS &&
        p.pos.z > c.minZ - RADIUS && p.pos.z < c.maxZ + RADIUS) {
      p.pos.z = p.vel.z > 0 ? c.minZ - RADIUS : c.maxZ + RADIUS;
      p.vel.z = 0;
    }
  }
  // Y 轴
  p.pos.y += p.vel.y * dt;
  if (p.pos.y <= 0) { p.pos.y = 0; p.vel.y = 0; p.onGround = true; }
  else p.onGround = false;
  // 场地边界
  p.pos.x = Math.max(-37.4, Math.min(37.4, p.pos.x));
  p.pos.z = Math.max(-29.4, Math.min(29.4, p.pos.z));
}

function handleInteract(dt) {
  const p = G.player;
  const holding = keys.has('KeyF');
  const still = new THREE.Vector2(p.vel.x, p.vel.z).length() < 1;
  let label = null, dur = 0, can = false;

  const playerAttacking = G.attackingTeam === 'ally';
  if (playerAttacking && G.spike.state === 'carried' && G.spike.carrier === 'player'
      && G.phase === 'live' && inSite(p.pos) && p.onGround) {
    label = '安放熵核'; dur = 4; can = true;
  } else if (!playerAttacking && G.spike.state === 'planted'
      && G.spike.pos && p.pos.distanceTo(G.spike.pos) < 2.6) {
    label = '拆除熵核'; dur = 7; can = true;
  }

  if (can && holding && still) {
    p.interactProgress += dt / dur;
    if (Math.floor(p.interactProgress * dur * 2) !== Math.floor((p.interactProgress - dt / dur) * dur * 2)) audio.plantTick();
    hud.setInteract(label, p.interactProgress);
    if (p.interactProgress >= 1) {
      p.interactProgress = 0;
      hud.setInteract(null, 0);
      if (label === '安放熵核') rounds.playerPlanted();
      else rounds.playerDefused();
    }
  } else {
    if (p.interactProgress > 0) p.interactProgress = Math.max(0, p.interactProgress - dt * 0.8);
    hud.setInteract(can ? label : null, can ? p.interactProgress : 0);
  }
}
