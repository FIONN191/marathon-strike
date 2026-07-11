// 程序化音频 —— WebAudio 合成，无外部音频文件
let ctx = null, master = null, noiseBuf = null;

export function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  const len = ctx.sampleRate * 1;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

function env(g, t0, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
}

function noise(bp, q, peak, dec, vol = 1) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = bp; f.Q.value = q;
  const g = ctx.createGain(); env(g, t0, 0.004, peak * vol, dec);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + dec + 0.05);
}

function tone(type, f0, f1, peak, dur, vol = 1) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  const g = ctx.createGain(); env(g, t0, 0.005, peak * vol, dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

// dist: 衰减用（敌人开枪）
export function shot(kind, vol = 1) {
  if (!ctx) return;
  switch (kind) {
    case 'pistol': noise(1800, 1.2, 0.5, 0.09, vol); tone('square', 160, 60, 0.25, 0.07, vol); break;
    case 'smg': noise(2400, 1.5, 0.38, 0.06, vol); tone('square', 200, 90, 0.16, 0.05, vol); break;
    case 'rifle': noise(1400, 1.0, 0.6, 0.11, vol); tone('square', 130, 50, 0.3, 0.09, vol); break;
    case 'shotgun': noise(700, 0.8, 0.85, 0.22, vol); tone('square', 90, 40, 0.4, 0.16, vol); break;
    case 'sniper': noise(900, 0.7, 0.9, 0.3, vol); tone('sawtooth', 110, 30, 0.4, 0.25, vol); break;
    case 'knife': noise(3500, 2.5, 0.25, 0.08, vol); break;
  }
}

export function dryfire() { tone('square', 900, 700, 0.12, 0.04); }
export function reloadSnd() { noise(3000, 3, 0.2, 0.05); setTimeout(() => noise(2200, 3, 0.22, 0.06), 180); setTimeout(() => noise(2800, 3, 0.25, 0.05), 900); }
export function hitmark(head) { tone('square', head ? 1400 : 1000, head ? 1100 : 800, 0.22, 0.05); }
export function killSnd() { tone('square', 500, 900, 0.2, 0.09); setTimeout(() => tone('square', 750, 1200, 0.2, 0.1), 70); }
export function hurt() { noise(400, 1, 0.5, 0.15); tone('sawtooth', 220, 90, 0.25, 0.14); }
export function uiClick() { tone('square', 800, 800, 0.12, 0.03); }
export function buySnd() { tone('square', 620, 620, 0.14, 0.05); setTimeout(() => tone('square', 930, 930, 0.14, 0.07), 80); }

export function plantTick() { tone('square', 1200, 1200, 0.14, 0.04); }
export function spikeBeep(fast) { tone('square', fast ? 1500 : 1150, fast ? 1500 : 1150, 0.16, 0.06); }
export function explosionSnd() {
  noise(120, 0.5, 1.2, 1.1); noise(500, 0.8, 0.7, 0.5);
  tone('sine', 70, 25, 0.9, 0.9);
}
export function defusedSnd() { tone('square', 700, 700, 0.2, 0.08); setTimeout(() => tone('square', 1050, 1050, 0.2, 0.14), 120); }

export function dashSnd() { noise(2000, 0.8, 0.35, 0.18); tone('sawtooth', 300, 700, 0.15, 0.16); }
export function cloakSnd() { tone('sine', 900, 300, 0.2, 0.35); }
export function sonarSnd() { tone('sine', 520, 1600, 0.22, 0.4); setTimeout(() => tone('sine', 520, 1600, 0.12, 0.4), 220); }
export function smokeSnd() { noise(600, 0.6, 0.4, 0.5); }
export function barrierSnd() { tone('square', 240, 480, 0.25, 0.2); noise(1500, 1, 0.2, 0.15); }
export function decoySnd() { tone('sawtooth', 800, 400, 0.15, 0.2); }

export function stinger(type) {
  const seq = {
    start: [[392, 0], [523, 90], [659, 180], [784, 270]],
    win: [[523, 0], [659, 120], [784, 240], [1046, 360]],
    lose: [[440, 0], [349, 160], [277, 320], [220, 480]],
    plant: [[880, 0], [880, 200], [880, 400]],
  }[type] || [];
  for (const [f, d] of seq) setTimeout(() => tone('square', f, f, 0.16, 0.22), d);
}
