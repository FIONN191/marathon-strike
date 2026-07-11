import * as THREE from 'three';
import { G, COLORS, TEAM_NAMES } from './state.js';
import * as hud from './hud.js';
import * as audio from './audio.js';
import * as fx from './fx.js';
import { respawnPlayer, damagePlayer } from './player.js';
import { spawnBots } from './bots.js';
import { initAbilities, clearAbilityObjects } from './heroes.js';
import { HEROES } from './heroes.js';

const BUY = 10, LIVE = 100, BOMB = 42, END = 6;
let spikeMesh = null, lastBeepAt = 0;

function makeSpikeMesh() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.6 }));
  base.position.y = 0.16;
  g.add(base);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12),
    new THREE.MeshStandardMaterial({ color: COLORS.acid, emissive: 0x7a8f1a }));
  core.position.y = 0.42;
  core.name = 'core';
  g.add(core);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 34, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: COLORS.acid, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  beam.position.y = 17;
  beam.name = 'beam';
  g.add(beam);
  return g;
}

export function startMatch() {
  G.state = 'playing';
  G.matchOver = false;
  G.scores.ally = 0; G.scores.enemy = 0;
  G.round = 1;
  G.attackingTeam = 'ally';
  G.credits = 800;
  G.player.hero = G.selectedHero;
  G.player.kills = 0;
  G.player.primary = null;
  initAbilities();
  hud.setHero(HEROES[G.selectedHero]);
  if (!spikeMesh) { spikeMesh = makeSpikeMesh(); G.scene.add(spikeMesh); }
  newRound();
}

function newRound() {
  G.phase = 'buy';
  G.phaseEnds = G.time + BUY;
  clearAbilityObjects();
  spikeMesh.visible = false;

  respawnPlayer();
  spawnBots();

  const playerAttacking = G.attackingTeam === 'ally';
  const s = G.spike;
  s.state = 'carried';
  s.pos = null; s.claimer = null; s.plantedBy = null;
  if (playerAttacking) {
    s.carrier = 'player';
  } else {
    const attackers = G.bots.filter(b => b.attacking && b.alive);
    s.carrier = attackers[Math.floor(Math.random() * attackers.length)];
  }

  const decider = G.scores.ally === 12 && G.scores.enemy === 12;
  hud.announce(
    decider ? '决胜回合' : `第 ${G.round} 回合`,
    playerAttacking ? '进攻 — 将熵核安放至 A / B 站点' : '防守 — 阻止熵核激活',
    2.6
  );
  hud.refreshBuy();
  audio.stinger('start');
}

/* ---------------- 熵核事件 ---------------- */
function plantAt(pos, who) {
  const s = G.spike;
  s.state = 'planted';
  s.pos = pos.clone().setY(0);
  s.plantedBy = who;
  s.carrier = null;
  G.phase = 'planted';
  G.phaseEnds = G.time + BOMB;
  spikeMesh.visible = true;
  spikeMesh.position.copy(s.pos);
  hud.announce('熵核已激活', '引爆倒计时 42 秒', 2.4);
  audio.stinger('plant');
  // 全场知晓
  for (const b of G.bots) { b.alertUntil = G.time + 8; b.alertPos = s.pos.clone(); b.goalKey = ''; }
}

export function playerPlanted() {
  if (G.phase !== 'live') return;
  G.credits = Math.min(9000, G.credits + 300);
  plantAt(G.player.pos, 'player');
}

export function botPlanted(bot) {
  if (G.phase !== 'live') return;
  plantAt(bot.pos, bot);
}

export function playerDefused() {
  if (G.phase !== 'planted') return;
  audio.defusedSnd();
  roundEnd(G.attackingTeam === 'ally' ? 'enemy' : 'ally', '熵核已解除');
}

export function botDefused() {
  if (G.phase !== 'planted') return;
  audio.defusedSnd();
  roundEnd(G.attackingTeam === 'ally' ? 'enemy' : 'ally', '熵核已解除');
}

export function dropSpike(pos) {
  const s = G.spike;
  s.state = 'dropped';
  s.pos = pos.clone().setY(0);
  s.carrier = null;
  s.claimer = null;
  spikeMesh.visible = true;
  spikeMesh.position.copy(s.pos);
}

export function pickupSpike(bot) {
  const s = G.spike;
  s.state = 'carried';
  s.carrier = bot;
  s.pos = null;
  spikeMesh.visible = false;
}

/* ---------------- 阵亡结算 ---------------- */
export function onDeath() {
  if (G.phase !== 'live' && G.phase !== 'planted') return;
  const playerAttacking = G.attackingTeam === 'ally';
  const p = G.player;

  let attackers = 0, defenders = 0;
  for (const b of G.bots) {
    if (!b.alive) continue;
    if (b.attacking) attackers++; else defenders++;
  }
  if (p.alive) { if (playerAttacking) attackers++; else defenders++; }

  if (G.phase === 'live') {
    if (attackers === 0) return roundEnd(playerAttacking ? 'enemy' : 'ally', '进攻部队歼灭');
    if (defenders === 0) return roundEnd(G.attackingTeam, '防守部队歼灭');
  } else {
    if (defenders === 0) return roundEnd(G.attackingTeam, '防守部队歼灭');
  }
}

/* ---------------- 回合结束 ---------------- */
function roundEnd(winner, reason) {
  if (G.phase === 'end') return;
  G.phase = 'end';
  G.phaseEnds = G.time + END;
  G.scores[winner]++;

  const win = winner === 'ally';
  G.credits = Math.min(9000, G.credits + (win ? 3000 : 1900));
  hud.announce(win ? '回合胜利' : '回合失败', reason, 3.2, win ? 'win' : 'lose');
  audio.stinger(win ? 'win' : 'lose');

  if (G.scores.ally >= 13 || G.scores.enemy >= 13) G.matchOver = true;
}

/* ---------------- 主循环 ---------------- */
export function update() {
  if (G.state !== 'playing') return;
  const t = G.time;

  // 熵核视觉脉动
  if (spikeMesh && spikeMesh.visible) {
    const core = spikeMesh.getObjectByName('core');
    const k = 0.5 + 0.5 * Math.sin(t * (G.phase === 'planted' ? 10 : 4));
    core.scale.setScalar(1 + k * 0.35);
    spikeMesh.getObjectByName('beam').material.opacity = G.phase === 'planted' ? 0.25 + k * 0.3 : 0.15;
  }

  switch (G.phase) {
    case 'buy':
      if (t >= G.phaseEnds) {
        G.phase = 'live';
        G.phaseEnds = t + LIVE;
        G.liveStartAt = t;
        hud.closeBuy();
        hud.announce('行动开始', G.attackingTeam === 'ally' ? '推进并安放熵核' : '守住 A / B 站点', 2);
      }
      break;
    case 'live':
      if (t >= G.phaseEnds) {
        roundEnd(G.attackingTeam === 'ally' ? 'enemy' : 'ally', '时间耗尽');
      }
      break;
    case 'planted': {
      const remain = G.phaseEnds - t;
      const interval = remain > 20 ? 1 : remain > 8 ? 0.5 : 0.22;
      if (t - lastBeepAt >= interval) {
        lastBeepAt = t;
        audio.spikeBeep(remain <= 8);
      }
      if (t >= G.phaseEnds) {
        fx.explosion(G.spike.pos.clone().setY(1));
        audio.explosionSnd();
        hud.flashWhite();
        spikeMesh.visible = false;
        G.spike.state = 'exploded';
        if (G.player.alive && G.player.pos.distanceTo(G.spike.pos) < 14) {
          damagePlayer(250, '熵核', '引爆');
        }
        roundEnd(G.attackingTeam, '熵核引爆');
      }
      break;
    }
    case 'end':
      if (t >= G.phaseEnds) {
        if (G.matchOver) {
          hud.showMatchEnd(G.scores.ally >= 13, `${G.scores.ally} - ${G.scores.enemy}`);
          G.state = 'matchend';
        } else {
          const total = G.scores.ally + G.scores.enemy;
          G.round = total + 1;
          if (total === 12) {
            G.attackingTeam = G.attackingTeam === 'ally' ? 'enemy' : 'ally';
            G.credits = 800;
            G.player.primary = null;
            hud.announce('攻防互换', '经济重置 — 下半场开始', 3);
          }
          newRound();
        }
      }
      break;
  }
}
