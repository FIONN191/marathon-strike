import './style.css';
import { G } from './state.js';
import { initRenderer, buildWorld } from './world.js';
import { initPostFX, renderPostFX } from './postfx.js';
import { initPlayer, updatePlayer, buyWeapon, buyArmor } from './player.js';
import { updateBots } from './bots.js';
import * as rounds from './rounds.js';
import * as heroes from './heroes.js';
import * as fx from './fx.js';
import * as hud from './hud.js';
import { ensureAudio, uiClick } from './audio.js';
import { HEROES } from './heroes.js';

const $ = (id) => document.getElementById(id);
window.G = G; // 调试用

/* ---------------- 初始化 ---------------- */
hud.init();
initRenderer($('app'));
buildWorld();
initPostFX(G.renderer, G.scene, G.camera);
initPlayer();
hud.setBuyHandler((id) => (id === 'armor' ? buyArmor() : buyWeapon(id)));

/* ---------------- 主菜单 ---------------- */
const cardsEl = $('hero-cards');
for (const h of Object.values(HEROES)) {
  const card = document.createElement('div');
  card.className = 'hero-card' + (h.id === G.selectedHero ? ' sel' : '');
  card.innerHTML = `
    <div class="hero-glyph" style="color:${h.color}">${h.glyph}</div>
    <h3 style="color:${h.color}">${h.name}</h3>
    <div class="hero-cn">${h.cn}</div>
    <div class="hero-abils"><b>Q</b> ${h.q.name} — ${h.q.desc}<br/><b>E</b> ${h.e.name} — ${h.e.desc}</div>`;
  card.addEventListener('click', () => {
    G.selectedHero = h.id;
    for (const c of cardsEl.children) c.classList.remove('sel');
    card.classList.add('sel');
    ensureAudio(); uiClick();
  });
  cardsEl.appendChild(card);
}

$('sens-input').addEventListener('input', (e) => {
  G.sens = parseFloat(e.target.value);
  $('sens-val').textContent = G.sens.toFixed(1);
});

const canvas = () => G.renderer.domElement;

function requestLock() {
  try {
    const r = canvas().requestPointerLock?.();
    if (r && typeof r.catch === 'function') r.catch(() => { /* 环境不支持指针锁定，使用拖拽转向兜底 */ });
  } catch (e) { /* 同上 */ }
}

$('btn-start').addEventListener('click', () => {
  ensureAudio();
  $('menu').style.display = 'none';
  hud.show();
  rounds.startMatch();
  requestLock();
});

$('btn-resume').addEventListener('click', () => {
  $('pause').style.display = 'none';
  G.paused = false;
  requestLock();
});

$('btn-restart').addEventListener('click', () => location.reload());
$('btn-tomenu').addEventListener('click', () => location.reload());

// 退出游戏 —— 仅桌面版（Electron）可关闭窗口，浏览器里隐藏按钮
const isElectron = /electron/i.test(navigator.userAgent);
for (const id of ['btn-quit', 'btn-quit2', 'btn-quit-menu']) {
  const b = $(id);
  if (isElectron) b.addEventListener('click', () => window.close());
  else b.style.display = 'none';
}

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas();
  if (locked) {
    G.paused = false;
    $('pause').style.display = 'none';
  } else if (G.state === 'playing' && !(G.ui && G.ui.buyOpen)) {
    G.paused = true;
    $('pause').style.display = 'flex';
  }
});

window.addEventListener('click', (e) => {
  if (G.state !== 'playing') return;
  if (G.ui && G.ui.buyOpen) return;
  if (document.pointerLockElement !== canvas() && e.target.tagName === 'CANVAS') requestLock();
});

/* ---------------- 主循环 ---------------- */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (G.state === 'playing' && !G.paused) {
    G.time += dt;
    updatePlayer(dt);
    updateBots(dt);
    heroes.update();
    rounds.update();
    fx.update();
    hud.update();
  } else if (G.state === 'matchend') {
    G.time += dt;
    fx.update();
  }

  renderPostFX();
}
requestAnimationFrame(frame);
