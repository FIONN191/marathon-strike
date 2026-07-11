import { G, TEAM_NAMES } from './state.js';
import { WEAPONS, ARMOR_PRICE } from './weapons.js';

const $ = (id) => document.getElementById(id);
let el = {};
let heroDef = null;
let announceUntil = 0, announceSubUntil = 0;
let mmCtx = null;
let buyHandler = null;

export function init() {
  el = {
    hud: $('hud'), scoreAlly: $('score-ally'), scoreEnemy: $('score-enemy'),
    sideAlly: $('side-ally'), sideEnemy: $('side-enemy'),
    timer: $('round-timer'), roundNum: $('round-num'),
    killfeed: $('killfeed'),
    announce: $('announce'), announceSub: $('announce-sub'),
    crosshair: $('crosshair'), hitmarker: $('hitmarker'),
    interactWrap: $('interact-wrap'), interactLabel: $('interact-label'), interactFill: $('interact-fill'),
    heroName: $('hero-name'), hpFill: $('hp-fill'), armorFill: $('armor-fill'), hpNum: $('hp-num'),
    abQ: $('ab-q'), abE: $('ab-e'), abQIcon: $('ab-q-icon'), abEIcon: $('ab-e-icon'),
    abQCd: $('ab-q-cd'), abECd: $('ab-e-cd'),
    statusChips: $('status-chips'),
    credits: $('credits'), weaponName: $('weapon-name'),
    ammoMag: $('ammo-mag'), ammoReserve: $('ammo-reserve'), ammo: $('ammo'),
    minimap: $('minimap'),
    buymenu: $('buymenu'), buyCards: $('buy-cards'), buyCredits: $('buy-credits'),
    buyHintFloat: $('buy-hint-float'), lockHint: $('lock-hint'),
    spikeInd: $('spike-ind'), spikeCarry: $('spike-carry'),
    vignette: $('vignette'), flashwhite: $('flashwhite'),
    death: $('death-overlay'), specName: $('spec-name'),
    matchEnd: $('match-end'), matchResult: $('match-result'), matchScore: $('match-score'),
  };
  mmCtx = el.minimap.getContext('2d');
  buildBuyCards();
}

export function show() { el.hud.style.display = 'block'; }

export function setHero(h) {
  heroDef = h;
  el.heroName.textContent = `${h.name} · ${h.cn.replace(/\s/g, '')}`;
  el.abQIcon.textContent = h.q.icon;
  el.abEIcon.textContent = h.e.icon;
  el.abQ.title = `${h.q.name} — ${h.q.desc}`;
  el.abE.title = `${h.e.name} — ${h.e.desc}`;
}

export function setBuyHandler(fn) { buyHandler = fn; }

function buildBuyCards() {
  const items = [
    ...['smg', 'shotgun', 'rifle', 'sniper'].map(id => ({ id, name: WEAPONS[id].name, price: WEAPONS[id].price })),
    { id: 'armor', name: '轻型护甲', price: ARMOR_PRICE },
  ];
  el.buyCards.innerHTML = '';
  for (const it of items) {
    const d = document.createElement('div');
    d.className = 'buy-card';
    d.dataset.id = it.id;
    d.innerHTML = `${it.name}<span class="price">$ ${it.price}</span>`;
    d.addEventListener('click', () => { if (buyHandler) buyHandler(it.id); refreshBuy(); });
    el.buyCards.appendChild(d);
  }
}

export function refreshBuy() {
  el.buyCredits.textContent = `$ ${G.credits}`;
  for (const card of el.buyCards.children) {
    const id = card.dataset.id;
    const price = id === 'armor' ? ARMOR_PRICE : WEAPONS[id].price;
    const owned = id === 'armor' ? G.player.armor >= 50 : G.player.primary === id;
    card.classList.toggle('owned', owned);
    card.classList.toggle('poor', !owned && G.credits < price);
  }
}

export function toggleBuy() {
  if (G.phase !== 'buy' || G.state !== 'playing') return;
  G.ui = G.ui || {};
  G.ui.buyOpen = !G.ui.buyOpen;
  el.buymenu.style.display = G.ui.buyOpen ? 'block' : 'none';
  if (G.ui.buyOpen) {
    refreshBuy();
    document.exitPointerLock?.();
  } else if (G.renderer) {
    G.renderer.domElement.requestPointerLock?.();
  }
}

export function closeBuy() {
  G.ui = G.ui || {};
  if (G.ui.buyOpen) {
    G.ui.buyOpen = false;
    el.buymenu.style.display = 'none';
    G.renderer?.domElement.requestPointerLock?.();
  }
  el.buyHintFloat.style.display = 'none';
}

/* ---------------- 播报 ---------------- */
export function announce(main, sub, dur = 2.5, cls = '') {
  el.announce.textContent = main;
  el.announce.className = 'show ' + cls;
  announceUntil = G.time + dur;
  if (sub !== undefined) {
    el.announceSub.textContent = sub;
    el.announceSub.className = 'mono show';
    announceSubUntil = G.time + dur + 0.5;
  }
}

export function announceSub(text, dur = 1.6) {
  el.announceSub.textContent = text;
  el.announceSub.className = 'mono show';
  announceSubUntil = G.time + dur;
}

export function killfeed(killer, weapon, victim, hs, enemyKill) {
  const li = document.createElement('li');
  if (enemyKill) li.className = 'enemykill';
  li.innerHTML = `${killer} <span class="dim">[${weapon}]</span>${hs ? ' <span class="hs">◉</span>' : ''} ▸ ${victim}`;
  el.killfeed.prepend(li);
  while (el.killfeed.children.length > 6) el.killfeed.lastChild.remove();
  setTimeout(() => li.remove(), 6000);
}

export function hitmarker(head) {
  el.hitmarker.classList.remove('show', 'head');
  void el.hitmarker.offsetWidth;
  if (head) el.hitmarker.classList.add('head');
  el.hitmarker.classList.add('show');
}

export function damageFlash(k) {
  el.vignette.style.opacity = Math.min(1, 0.35 + k * 0.65);
}

export function flashWhite() {
  el.flashwhite.style.transition = 'none';
  el.flashwhite.style.opacity = 0.9;
  requestAnimationFrame(() => {
    el.flashwhite.style.transition = 'opacity 1.2s';
    el.flashwhite.style.opacity = 0;
  });
}

export function setInteract(label, frac) {
  if (!label) { el.interactWrap.style.display = 'none'; return; }
  el.interactWrap.style.display = 'block';
  el.interactLabel.textContent = `${label} — 长按 F`;
  el.interactFill.style.width = `${Math.min(100, frac * 100)}%`;
}

export function showDeath(on) {
  el.death.style.display = on ? 'block' : 'none';
  el.crosshair.classList.toggle('dead', on);
  if (!on) setSpectate(null);
}

export function setSpectate(name) {
  if (!el.specName) return;
  el.specName.textContent = name ? `观战 ▸ ${name} — 左键切换队友` : '';
}

export function showMatchEnd(win, score) {
  document.exitPointerLock?.();
  el.matchEnd.style.display = 'flex';
  el.matchResult.textContent = win ? '任务完成' : '链接终止';
  el.matchResult.className = 'wordmark' + (win ? '' : ' lose');
  el.matchScore.textContent = score;
}

/* ---------------- 每帧 ---------------- */
export function update() {
  const p = G.player;
  if (!p) return;
  const t = G.time;

  // 计时
  const remain = Math.max(0, G.phaseEnds - t);
  const mm = Math.floor(remain / 60), ss = Math.floor(remain % 60);
  if (G.phase === 'planted') {
    el.timer.textContent = '⬢';
    el.timer.className = 'mono danger';
  } else {
    el.timer.textContent = `${mm}:${ss.toString().padStart(2, '0')}`;
    el.timer.className = 'mono' + (G.phase === 'live' && remain < 15 ? ' danger' : '');
  }
  const half = G.round <= 12 ? '上半场' : (G.scores.ally === 12 && G.scores.enemy === 12 ? '决胜' : '下半场');
  const side = G.attackingTeam === 'ally' ? '进攻' : '防守';
  el.roundNum.textContent = `R${G.round} · ${half} · ${G.phase === 'buy' ? '购买阶段' : side}`;

  el.scoreAlly.textContent = G.scores.ally;
  el.scoreEnemy.textContent = G.scores.enemy;
  el.sideAlly.textContent = TEAM_NAMES.ally;
  el.sideEnemy.textContent = TEAM_NAMES.enemy;

  // 生命 / 弹药 / 经济
  el.hpFill.style.width = `${p.hp}%`;
  el.armorFill.style.width = `${p.armor}%`;
  el.hpNum.textContent = Math.ceil(p.hp);
  el.credits.textContent = `$ ${G.credits}`;

  const wid = p.current === 'knife' ? 'knife' : p.current === 'primary' ? (p.primary || 'pistol') : 'pistol';
  const w = WEAPONS[wid];
  el.weaponName.textContent = w.name + (p.reloadEndsAt > 0 ? ' — 装填中' : '');
  if (w.type === 'melee') {
    el.ammoMag.textContent = '—'; el.ammoReserve.textContent = '';
    el.ammo.classList.remove('low');
  } else {
    const a = p.ammo[wid];
    el.ammoMag.textContent = a.mag;
    el.ammoReserve.textContent = a.res;
    el.ammo.classList.toggle('low', a.mag <= w.mag * 0.25);
  }

  // 技能冷却
  if (heroDef) {
    for (const slot of ['q', 'e']) {
      const box = slot === 'q' ? el.abQ : el.abE;
      const cd = slot === 'q' ? el.abQCd : el.abECd;
      const left = p.abil ? p.abil[slot].readyAt - t : 0;
      box.classList.toggle('oncd', left > 0);
      if (left > 0) cd.textContent = Math.ceil(left);
    }
  }

  // 状态 chips
  let chips = '';
  if (t < p.cloakUntil) chips += `<span class="schip">隐形 ${Math.ceil(p.cloakUntil - t)}s</span>`;
  if (G.phase === 'buy') chips += `<span class="schip">购买阶段 ${Math.ceil(remain)}s — 按 B</span>`;
  el.statusChips.innerHTML = chips;

  // 熵核指示
  el.spikeInd.style.display = G.phase === 'planted' ? 'block' : 'none';
  el.spikeCarry.style.display =
    (G.spike.state === 'carried' && G.spike.carrier === 'player') ? 'block' : 'none';

  // 准星
  const moving = Math.hypot(p.vel.x, p.vel.z) > 2;
  const gap = 5 + p.bloom * 13 + (moving ? 5 : 0) + (p.onGround ? 0 : 8);
  el.crosshair.style.setProperty('--gap', `${gap}px`);

  // 播报淡出
  if (announceUntil && t > announceUntil) { el.announce.className = ''; announceUntil = 0; }
  if (announceSubUntil && t > announceSubUntil) { el.announceSub.className = 'mono'; announceSubUntil = 0; }

  // 受击红晕消退
  const vo = parseFloat(el.vignette.style.opacity || 0);
  if (vo > 0) el.vignette.style.opacity = Math.max(0, vo - 0.02);

  // 购买悬浮提示
  el.buyHintFloat.style.display = (G.phase === 'buy' && !(G.ui && G.ui.buyOpen)) ? 'block' : 'none';

  // 指针锁定提示（锁定失败的环境下提示拖拽转向）
  const locked = G.renderer && document.pointerLockElement === G.renderer.domElement;
  el.lockHint.style.display =
    (!locked && p.alive && !(G.ui && G.ui.buyOpen)) ? 'block' : 'none';

  drawMinimap();
}

/* ---------------- 小地图 ---------------- */
const MM_S = 2.8, MM_OX = 110, MM_OY = 90;
function mmx(x) { return MM_OX + x * MM_S; }
function mmy(z) { return MM_OY + z * MM_S; }

function drawMinimap() {
  const c = mmCtx;
  c.clearRect(0, 0, 220, 180);
  c.fillStyle = 'rgba(4,25,30,0.4)';
  c.fillRect(0, 0, 220, 180);

  c.fillStyle = 'rgba(238,240,234,0.5)';
  for (const r of G.mapRects) {
    c.fillRect(mmx(r.x - r.w / 2), mmy(r.z - r.d / 2), r.w * MM_S, r.d * MM_S);
  }

  c.font = '700 14px monospace';
  c.fillStyle = 'rgba(201,242,75,0.9)';
  c.fillText('A', mmx(-27) - 4, mmy(-15) + 5);
  c.fillText('B', mmx(27) - 4, mmy(-15) + 5);

  const t = G.time;
  // 熵核
  if (G.spike.pos && (G.spike.state === 'planted' || G.spike.state === 'dropped')) {
    c.fillStyle = G.spike.state === 'planted'
      ? (Math.sin(t * 8) > 0 ? '#ff2e7e' : '#ffffff') : '#c9f24b';
    c.fillRect(mmx(G.spike.pos.x) - 3, mmy(G.spike.pos.z) - 3, 6, 6);
  }

  // 队友
  for (const b of G.bots) {
    if (!b.alive) continue;
    if (b.team === 'ally') {
      c.fillStyle = '#c9f24b';
      c.beginPath(); c.arc(mmx(b.pos.x), mmy(b.pos.z), 3, 0, 7); c.fill();
    } else if (t < b.revealUntil || t - (b.lastShotAt || -9) < 1.2) {
      c.fillStyle = '#ff2e7e';
      c.beginPath(); c.arc(mmx(b.pos.x), mmy(b.pos.z), 3.5, 0, 7); c.fill();
    }
  }

  // 玩家箭头
  const p = G.player;
  if (p.alive) {
    const x = mmx(p.pos.x), y = mmy(p.pos.z);
    const fx_ = -Math.sin(p.yaw), fy = -Math.cos(p.yaw);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(x + fx_ * 7, y + fy * 7);
    c.lineTo(x - fy * 4 - fx_ * 3, y + fx_ * 4 - fy * 3);
    c.lineTo(x + fy * 4 - fx_ * 3, y - fx_ * 4 - fy * 3);
    c.closePath(); c.fill();
  }
}
