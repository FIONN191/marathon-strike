import * as THREE from 'three';
import { G, COLORS } from './state.js';
import { WEAPONS, falloff, botBaseAcc } from './weapons.js';
import { SITES, SPAWNS, findPath, losBlocked, inSite } from './world.js';
import * as audio from './audio.js';
import * as fx from './fx.js';
import * as hud from './hud.js';
import * as rounds from './rounds.js';
import { damagePlayer } from './player.js';

const ALLY_NAMES = ['ECHO-9', 'IRIS', 'NOVA', 'ROOK'];
const ENEMY_NAMES = ['HYDRA', 'SABLE', 'ONYX', 'VIPER', 'TALON'];

const EYE = 1.6;

/* ---------------- 模型 ---------------- */
function makeBotMesh(bot) {
  const g = new THREE.Group();
  const ally = bot.team === 'ally';
  const bodyMat = new THREE.MeshStandardMaterial({
    color: ally ? 0xe8ece6 : 0x272231, roughness: 0.45, metalness: 0.25,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: ally ? COLORS.acid : COLORS.orange,
    emissive: ally ? 0x3a4a08 : 0x51190a, roughness: 0.4,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: ally ? 0x37e1e8 : 0xff3040,
    emissive: ally ? 0x0e5558 : 0x661016,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.7 });

  const add = (geo, mat, x, y, z, name) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.userData.bot = bot;
    if (name) m.name = name;
    g.add(m); return m;
  };

  add(new THREE.CapsuleGeometry(0.34, 0.7, 4, 12), bodyMat, 0, 1.0, 0);
  add(new THREE.BoxGeometry(0.5, 0.14, 0.34), accentMat, 0, 1.34, 0);           // 肩甲
  add(new THREE.BoxGeometry(0.3, 0.34, 0.2), darkMat, 0, 1.1, 0.24);            // 背包
  add(new THREE.SphereGeometry(0.2, 14, 12), bodyMat, 0, 1.72, 0, 'head');
  add(new THREE.BoxGeometry(0.26, 0.08, 0.1), visorMat, 0, 1.74, -0.16, 'head'); // 面甲
  add(new THREE.BoxGeometry(0.12, 0.62, 0.16), bodyMat, -0.14, 0.32, 0);
  add(new THREE.BoxGeometry(0.12, 0.62, 0.16), bodyMat, 0.14, 0.32, 0);
  add(new THREE.BoxGeometry(0.06, 0.09, 0.52), darkMat, 0.24, 1.18, -0.28);     // 枪
  bot.spikeMark = add(new THREE.BoxGeometry(0.2, 0.26, 0.12), new THREE.MeshStandardMaterial({
    color: COLORS.acid, emissive: 0x55661a,
  }), 0, 1.05, 0.38);
  bot.spikeMark.visible = false;

  // 透视标记（声呐显形）
  const ghost = new THREE.Sprite(new THREE.SpriteMaterial({
    color: 0xff2e7e, transparent: true, opacity: 0.95, depthTest: false,
  }));
  ghost.scale.setScalar(0.5);
  ghost.position.y = 2.15;
  ghost.visible = false;
  ghost.raycast = () => {}; // 标记贴片不参与命中检测
  g.add(ghost);
  bot.ghost = ghost;

  // 队友铭牌
  if (ally) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.font = '700 40px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#c9f24b'; ctx.fillText(bot.name, 128, 46);
    const tex = new THREE.CanvasTexture(c);
    const plate = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    plate.scale.set(1.4, 0.35, 1);
    plate.position.y = 2.35;
    plate.raycast = () => {}; // 铭牌不参与命中检测
    g.add(plate);
  }
  return g;
}

/* ---------------- 生成 ---------------- */
export function clearBots() {
  for (const b of G.bots) {
    G.scene.remove(b.group);
    const i = G.shootables.indexOf(b.group);
    if (i >= 0) G.shootables.splice(i, 1);
  }
  G.bots.length = 0;
}

function weaponForRound() {
  const r = G.round;
  const freshHalf = r === 1 || r === 13 || (G.scores.ally + G.scores.enemy === 24);
  if (freshHalf) return WEAPONS.pistol;
  if (r <= 3) return Math.random() < 0.5 ? WEAPONS.smg : WEAPONS.pistol;
  const roll = Math.random();
  if (roll < 0.55) return WEAPONS.rifle;
  if (roll < 0.72) return WEAPONS.smg;
  if (roll < 0.84) return WEAPONS.shotgun;
  return WEAPONS.sniper;
}

export function spawnBots() {
  clearBots();
  const playerAttacking = G.attackingTeam === 'ally';

  const mk = (team, name, idx) => {
    const bot = {
      team, name,
      hp: 100, armor: G.round >= 3 ? 50 : 0,
      alive: true,
      weapon: weaponForRound(),
      pos: new THREE.Vector3(),
      yaw: 0, desiredYaw: 0,
      path: null, pathI: 0, goalKey: '',
      target: null, reactAt: 0, nextShot: 0, burst: 0,
      lastSeenTargetAt: 0, alertUntil: 0, alertPos: null,
      channel: null,
      revealUntil: 0, lastCombatAt: -10,
      holdPos: null, ringOffset: new THREE.Vector3(
        (Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8),
      nextThink: Math.random() * 0.15,
      deadAt: 0,
      pushDelay: 1.5 + idx * 1.6 + Math.random() * 1.5,
      escort: false,
    };
    const attacking = (team === G.attackingTeam);
    const spawns = attacking ? SPAWNS.attack : SPAWNS.defend;
    const [sx, sz] = spawns[(idx + 1) % spawns.length];
    bot.pos.set(sx, 0, sz);
    bot.yaw = attacking ? 0 : Math.PI;
    bot.attacking = attacking;
    bot.group = makeBotMesh(bot);
    bot.group.position.copy(bot.pos);
    bot.group.rotation.y = bot.yaw;
    G.scene.add(bot.group);
    G.shootables.push(bot.group);
    G.bots.push(bot);
    return bot;
  };

  ALLY_NAMES.forEach((n, i) => mk('ally', n, i));
  ENEMY_NAMES.forEach((n, i) => mk('enemy', n, i));

  // 防守方站位分配
  const defenders = G.bots.filter(b => !b.attacking);
  const holdSpots = [
    new THREE.Vector3(-26, 0, -13), new THREE.Vector3(-23, 0, -19),
    new THREE.Vector3(26, 0, -13), new THREE.Vector3(23, 0, -19),
    new THREE.Vector3(0, 0, -14),
  ];
  defenders.forEach((b, i) => { b.holdPos = holdSpots[i % holdSpots.length].clone(); });

  // 玩家进攻时指派两名队友贴身护航
  if (playerAttacking) {
    G.bots.filter(b => b.team === 'ally').slice(0, 2).forEach(b => { b.escort = true; });
  }

  // 进攻站点计划
  G.botPlan.site = Math.random() < 0.5 ? 'A' : 'B';
}

/* ---------------- 战斗 ---------------- */
export function alertNear(pos, radius) {
  for (const b of G.bots) {
    if (!b.alive) continue;
    if (b.pos.distanceTo(pos) < radius) {
      b.alertUntil = G.time + 6;
      b.alertPos = pos.clone();
    }
  }
}

function eyeOf(bot) { return new THREE.Vector3(bot.pos.x, bot.pos.y + EYE, bot.pos.z); }

function targetsFor(bot) {
  const list = [];
  if (bot.team === 'enemy') {
    const p = G.player;
    if (p.alive && G.time >= p.cloakUntil) {
      list.push({ kind: 'player', pos: () => new THREE.Vector3(p.pos.x, p.pos.y + p.eyeH, p.pos.z), alive: () => p.alive && G.time >= p.cloakUntil, name: '你' });
    }
    for (const d of G.decoys) {
      if (d.alive) list.push({ kind: 'decoy', ref: d, pos: () => d.pos.clone().setY(1.2), alive: () => d.alive && d.hp > 0, name: 'decoy' });
    }
    for (const b of G.bots) {
      if (b.team === 'ally' && b.alive) list.push({ kind: 'bot', ref: b, pos: () => eyeOf(b), alive: () => b.alive, name: b.name });
    }
  } else {
    for (const b of G.bots) {
      if (b.team === 'enemy' && b.alive) list.push({ kind: 'bot', ref: b, pos: () => eyeOf(b), alive: () => b.alive, name: b.name });
    }
  }
  return list;
}

function canSee(bot, tp) {
  const e = eyeOf(bot);
  const d = e.distanceTo(tp);
  if (d > 48) return false;
  const dir = tp.clone().sub(e).normalize();
  const fwd = new THREE.Vector3(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw));
  const inFov = fwd.dot(new THREE.Vector3(dir.x, 0, dir.z).normalize()) > 0.3;
  if (!inFov && d > 7 && G.time > bot.alertUntil) return false;
  return !losBlocked(e, tp);
}

function botShoot(bot, target) {
  const w = bot.weapon;
  const tp = target.pos();
  const e = eyeOf(bot);
  const dist = e.distanceTo(tp);

  bot.nextShot = G.time + 60 / w.rpm * (1 + Math.random() * 0.5);
  bot.lastShotAt = G.time;
  bot.burst++;
  if (bot.burst >= 4 + (Math.random() * 3 | 0)) { bot.burst = 0; bot.nextShot += 0.45; }

  let acc = botBaseAcc(w) - Math.max(0, dist - 15) * 0.007;
  if (target.kind === 'player') {
    const pv = new THREE.Vector2(G.player.vel.x, G.player.vel.z).length();
    if (pv > 3.5) acc -= 0.12;
    if (G.player.crouch) acc -= 0.03;
    if (G.time < G.player.dashUntil + 0.3) acc -= 0.2;
  }
  if (target.kind === 'decoy') acc = 0.9;
  acc = Math.max(0.06, Math.min(0.85, acc));

  const hit = Math.random() < acc;
  const gunPos = e.clone().add(new THREE.Vector3(-Math.sin(bot.yaw + 0.4), -0.3, -Math.cos(bot.yaw + 0.4)).multiplyScalar(0.35));
  const end = tp.clone();
  if (!hit) {
    end.add(new THREE.Vector3((Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 2.2));
  }
  fx.tracer(gunPos, end, bot.team === 'enemy' ? 0xffb2a0 : 0xd9ffb0);
  fx.muzzleFlash(gunPos);

  const distToPlayer = bot.pos.distanceTo(G.player.pos);
  audio.shot(w.kind, Math.max(0.08, Math.min(0.85, 1 - distToPlayer / 50)));

  if (!hit) return;
  const isHead = Math.random() < 0.1;
  let dmg = w.dmg * (isHead ? w.hsMul * 0.6 : 1) * falloff(w, dist) * (0.9 + Math.random() * 0.2);
  if (target.kind === 'bot') dmg *= 0.55; // 机器人互射伤害衰减，拖长交战节奏，让玩家来得及参与

  if (target.kind === 'player') {
    damagePlayer(dmg, bot.name, w.name);
  } else if (target.kind === 'decoy') {
    target.ref.hp -= dmg;
  } else {
    damageBot(target.ref, dmg, bot, isHead, w.name);
  }
}

export function damageBot(bot, dmg, source, isHead, weaponName) {
  if (!bot.alive || G.phase === 'end') return;
  const absorbed = Math.min(bot.armor, dmg * 0.5);
  bot.armor -= absorbed;
  bot.hp -= (dmg - absorbed);
  bot.channel = null;
  bot.alertUntil = G.time + 6;
  if (source && source.pos) bot.alertPos = source.pos.clone();
  else if (source && source.isPlayer) bot.alertPos = G.player.pos.clone();

  if (bot.hp <= 0) {
    bot.alive = false;
    bot.deadAt = G.time;
    bot.target = null;
    fx.deathBurst(bot.pos.clone().setY(1.2), bot.team === 'enemy');
    // 倒地
    bot.group.rotation.x = -Math.PI / 2;
    bot.group.position.y = 0.35;
    const i = G.shootables.indexOf(bot.group);
    if (i >= 0) G.shootables.splice(i, 1);
    if (bot.ghost) bot.ghost.visible = false;

    if (source && source.isPlayer) {
      G.credits = Math.min(9000, G.credits + 200);
      G.player.kills++;
      audio.killSnd();
    }
    hud.killfeed(source ? source.name : '?', weaponName || '', bot.name, !!isHead, bot.team === 'ally');

    // 掉落熵核
    if (G.spike.state === 'carried' && G.spike.carrier === bot) {
      rounds.dropSpike(bot.pos.clone());
    }
    rounds.onDeath();
  }
}

/* ---------------- 目标 / 寻路 ---------------- */
function setGoal(bot, key, vec) {
  if (bot.goalKey === key && bot.path) return;
  bot.goalKey = key;
  bot.path = findPath(bot.pos, vec);
  bot.pathI = 0;
}

function objective(bot) {
  const t = G.time;
  const spike = G.spike;
  const site = SITES[G.botPlan.site];

  if (bot.attacking) {
    // 开局分批推进，避免全员同时冲锋瞬间团灭
    if (G.phase === 'live' && spike.state === 'carried' && !bot.escort
        && t - (G.liveStartAt || 0) < bot.pushDelay) {
      faceToward(bot, new THREE.Vector3(bot.pos.x * 0.3, 0, bot.pos.z - 20));
      return;
    }
    if (spike.state === 'carried' && spike.carrier === bot) {
      if (inSite(bot.pos) && t - bot.lastCombatAt > 1.2) {
        bot.channel = { type: 'plant', endAt: t + 4 };
        return;
      }
      setGoal(bot, 'plant-' + G.botPlan.site, site.center.clone().add(bot.ringOffset.clone().multiplyScalar(0.4)));
      return;
    }
    if (spike.state === 'dropped') {
      if (!spike.claimer || !spike.claimer.alive) spike.claimer = bot;
      if (spike.claimer === bot) {
        if (bot.pos.distanceTo(spike.pos) < 1.6) { rounds.pickupSpike(bot); return; }
        setGoal(bot, 'grab', spike.pos);
        return;
      }
    }
    if (spike.state === 'planted') {
      const ring = spike.pos.clone().add(bot.ringOffset);
      if (bot.pos.distanceTo(ring) > 2.5) setGoal(bot, 'guard', ring);
      else faceToward(bot, new THREE.Vector3(bot.pos.x * 0.2, 0, 20));
      return;
    }
    // 护航：跟随玩家行动
    if (bot.escort && G.player.alive && G.attackingTeam === 'ally') {
      const anchor = G.player.pos.clone().add(bot.ringOffset.clone().multiplyScalar(0.5));
      if (bot.pos.distanceTo(anchor) > 4) {
        setGoal(bot, `escort-${(anchor.x / 5) | 0},${(anchor.z / 5) | 0}`, anchor);
      } else {
        bot.path = null;
        faceToward(bot, new THREE.Vector3(
          G.player.pos.x - Math.sin(G.player.yaw) * 10, 0,
          G.player.pos.z - Math.cos(G.player.yaw) * 10));
      }
      return;
    }

    // 普通推进
    const dest = site.center.clone().add(bot.ringOffset.clone().multiplyScalar(0.6));
    if (bot.pos.distanceTo(dest) > 3) setGoal(bot, 'push-' + G.botPlan.site, dest);
    else faceToward(bot, new THREE.Vector3(bot.pos.x * 0.2, 0, -28));
  } else {
    if (spike.state === 'planted') {
      const nearDefenders = G.bots.filter(b => !b.attacking && b.alive)
        .sort((a, b) => a.pos.distanceTo(spike.pos) - b.pos.distanceTo(spike.pos));
      const isRetaker = nearDefenders[0] === bot;
      if (isRetaker && bot.pos.distanceTo(spike.pos) < 2.2) {
        if (t - bot.lastCombatAt > 1.2) bot.channel = { type: 'defuse', endAt: t + 7 };
        return;
      }
      const dest = isRetaker ? spike.pos : spike.pos.clone().add(bot.ringOffset);
      setGoal(bot, 'retake', dest);
      return;
    }
    if (bot.holdPos) {
      if (bot.pos.distanceTo(bot.holdPos) > 2) setGoal(bot, 'hold', bot.holdPos);
      else faceToward(bot, new THREE.Vector3(bot.pos.x * 0.4, 0, 20));
    }
  }
}

function faceToward(bot, point) {
  bot.desiredYaw = Math.atan2(-(point.x - bot.pos.x), -(point.z - bot.pos.z));
}

function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

/* ---------------- 主更新 ---------------- */
export function updateBots(dt) {
  const t = G.time;
  const frozen = G.phase === 'buy' || G.phase === 'end';

  for (const bot of G.bots) {
    if (!bot.alive) {
      if (bot.deadAt && t - bot.deadAt > 8 && bot.group.parent) G.scene.remove(bot.group);
      continue;
    }

    // 透视标记
    if (bot.ghost) bot.ghost.visible = bot.team === 'enemy' && t < bot.revealUntil;
    if (bot.spikeMark) bot.spikeMark.visible = G.spike.state === 'carried' && G.spike.carrier === bot;

    if (frozen) continue;

    // 引导（下包/拆包）
    if (bot.channel) {
      if (bot.channel.type === 'plant' && G.spike.state !== 'carried') { bot.channel = null; }
      else if (bot.channel.type === 'defuse' && G.spike.state !== 'planted') { bot.channel = null; }
      else if (t >= bot.channel.endAt) {
        const type = bot.channel.type;
        bot.channel = null;
        if (type === 'plant') rounds.botPlanted(bot);
        else rounds.botDefused(bot);
      } else {
        bot.group.position.copy(bot.pos);
        continue; // 引导中不移动不开枪
      }
    }

    // 思考
    bot.nextThink -= dt;
    if (bot.nextThink <= 0) {
      bot.nextThink = 0.14 + Math.random() * 0.06;

      // 目标校验 / 搜索
      if (bot.target && (!bot.target.alive() || !canSee(bot, bot.target.pos()))) {
        if (t - bot.lastSeenTargetAt > 1.3) bot.target = null;
      }
      if (!bot.target) {
        let best = null, bd = Infinity;
        for (const cand of targetsFor(bot)) {
          if (!cand.alive()) continue;
          const tp = cand.pos();
          const d = eyeOf(bot).distanceTo(tp);
          if (d < bd && canSee(bot, tp)) { bd = d; best = cand; }
        }
        if (best) {
          bot.target = best;
          bot.reactAt = t + (best.kind === 'player' ? 0.5 + Math.random() * 0.4 : 0.55 + Math.random() * 0.45);
          bot.lastSeenTargetAt = t;
          bot.lastCombatAt = t;
        }
      } else {
        bot.lastSeenTargetAt = t;
        bot.lastCombatAt = t;
      }

      if (!bot.target) objective(bot);
    }

    // 战斗
    if (bot.target) {
      const tp = bot.target.pos();
      faceToward(bot, tp);
      bot.yaw = lerpAngle(bot.yaw, bot.desiredYaw, Math.min(1, 10 * dt));
      if (t >= bot.reactAt && t >= bot.nextShot && bot.target.alive() && canSee(bot, tp)) {
        botShoot(bot, bot.target);
      }
    } else {
      // 移动
      if (bot.path && bot.pathI < bot.path.length) {
        const node = bot.path[bot.pathI];
        const d = new THREE.Vector2(node.x - bot.pos.x, node.z - bot.pos.z);
        if (d.length() < 0.8) bot.pathI++;
        else {
          const speed = 4.8;
          const dir = d.normalize();
          bot.pos.x += dir.x * speed * dt;
          bot.pos.z += dir.y * speed * dt;
          bot.desiredYaw = Math.atan2(-dir.x, -dir.y);
        }
      } else if (bot.alertPos && t < bot.alertUntil) {
        faceToward(bot, bot.alertPos);
      }
      bot.yaw = lerpAngle(bot.yaw, bot.desiredYaw, Math.min(1, 8 * dt));
    }

    bot.group.position.copy(bot.pos);
    bot.group.rotation.y = bot.yaw;
  }
}

export function aliveCount(team) {
  let n = 0;
  for (const b of G.bots) if (b.team === team && b.alive) n++;
  return n;
}
