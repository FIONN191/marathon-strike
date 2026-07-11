import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { G, COLORS } from './state.js';

// 地图: x -38..38, z -30..30。南(+z)=进攻方出生, 北(-z)=防守方出生
export const MAP = { w: 76, d: 60 };

export const SITES = {
  A: { minX: -35, maxX: -19, minZ: -23, maxZ: -7, center: new THREE.Vector3(-27, 0, -15) },
  B: { minX: 19, maxX: 35, minZ: -23, maxZ: -7, center: new THREE.Vector3(27, 0, -15) },
};

export const SPAWNS = {
  attack: [[0, 25], [-3.5, 26.5], [3.5, 26.5], [-7, 27.5], [7, 27.5]],
  defend: [[0, -27], [-4, -27.5], [4, -27.5], [-8, -26], [8, -26]],
};

export function inSite(pos) {
  for (const k of ['A', 'B']) {
    const s = SITES[k];
    if (pos.x >= s.minX && pos.x <= s.maxX && pos.z >= s.minZ && pos.z <= s.maxZ) return k;
  }
  return null;
}

/* ---------------- 画布纹理 ---------------- */
function canvasTex(w, h, draw, repX = 1, repY = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repX, repY);
  t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function floorTexture() {
  return canvasTex(512, 512, (g) => {
    g.fillStyle = '#dfe3dc'; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = '#c6cbc3'; g.lineWidth = 3;
    for (let i = 0; i <= 2; i++) {
      g.beginPath(); g.moveTo(i * 256, 0); g.lineTo(i * 256, 512); g.stroke();
      g.beginPath(); g.moveTo(0, i * 256); g.lineTo(512, i * 256); g.stroke();
    }
    g.strokeStyle = '#ced3cb'; g.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 512); g.stroke();
      g.beginPath(); g.moveTo(0, i * 64); g.lineTo(512, i * 64); g.stroke();
    }
    // 少量图形装饰
    g.fillStyle = '#0b100d';
    g.fillRect(30, 30, 26, 8); g.fillRect(30, 44, 12, 8);
    g.font = 'bold 22px monospace'; g.fillText('S-03', 380, 480);
    g.fillStyle = '#c9f24b'; g.fillRect(430, 30, 40, 40);
    g.fillStyle = '#0b100d'; g.font = 'bold 30px monospace'; g.fillText('⬢', 436, 62);
  }, MAP.w / 8, MAP.d / 8);
}

function checkerTexture() {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#151015'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#e02020';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++)
      if ((x + y) % 2 === 0) g.fillRect(x * 64, y * 64, 64, 64);
  }, 2, 1);
}

function chevronTexture(fg = '#0b100d', bg = '#c9f24b') {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 256, 256);
    g.fillStyle = fg;
    for (let i = -4; i < 8; i++) {
      g.beginPath();
      g.moveTo(i * 64, 0); g.lineTo(i * 64 + 32, 0);
      g.lineTo(i * 64 + 32 + 256, 256); g.lineTo(i * 64 + 256, 256);
      g.closePath(); g.fill();
    }
  }, 2, 1);
}

function letterTexture(letter, fg = '#0b100d', bg = '#eef0ea') {
  return canvasTex(512, 512, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, 512, 512); }
    g.fillStyle = fg;
    g.font = '900 400px "Arial Black", Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(letter, 256, 285);
    // 定位角标（参考图里的注册标记）
    g.strokeStyle = fg; g.lineWidth = 8;
    for (const [x, y] of [[40, 40], [472, 40], [40, 472], [472, 472]]) {
      g.beginPath(); g.moveTo(x - 20 * Math.sign(x - 256), y); g.lineTo(x, y); g.lineTo(x, y - 20 * Math.sign(y - 256)); g.stroke();
    }
  });
}

function letterDecalTexture(letter) {
  return canvasTex(512, 512, (g) => {
    g.clearRect(0, 0, 512, 512);
    g.fillStyle = 'rgba(11,16,13,0.88)';
    g.font = '900 420px "Arial Black", Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(letter, 256, 285);
  });
}

function skyTexture() {
  return canvasTex(1024, 512, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#0e3238');
    grad.addColorStop(0.55, '#062026');
    grad.addColorStop(1, '#020c10');
    g.fillStyle = grad; g.fillRect(0, 0, 1024, 512);
    // 星点 + 星座连线（参考图里的白色圆点阵）
    const pts = [];
    for (let i = 0; i < 130; i++) {
      const x = Math.random() * 1024, y = Math.random() * 340;
      pts.push([x, y]);
      g.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.6})`;
      g.beginPath(); g.arc(x, y, Math.random() * 2 + 0.6, 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const a = pts[(Math.random() * pts.length) | 0], b = pts[(Math.random() * pts.length) | 0];
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    // 一颗品红环行星
    g.fillStyle = 'rgba(255,46,126,0.5)';
    g.beginPath(); g.arc(820, 120, 26, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,46,126,0.7)'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(820, 120, 48, 12, -0.3, 0, 7); g.stroke();
  });
}

/* ---------------- 建造 ---------------- */
let matWall, matYellow, matOrange, matAcid, matChecker, matChevron, matDark;

function addBox(x, z, w, d, h, mat, opts = {}) {
  const y0 = opts.y0 || 0;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y0 + h / 2, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  G.scene.add(mesh);
  if (opts.collide !== false) {
    G.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: y0 + h });
    G.wallMeshes.push(mesh);
  }
  if (opts.rect !== false) G.mapRects.push({ x, z, w, d });
  if (!opts.noCap && h > 2) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.1, d + 0.06), matDark);
    cap.position.set(x, y0 + h + 0.05, z);
    G.scene.add(cap);
  }
  return mesh;
}

function addCylinder(x, z, r, h, mat) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), mat);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  G.scene.add(mesh);
  G.colliders.push({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, h });
  G.wallMeshes.push(mesh);
  G.mapRects.push({ x, z, w: r * 2, d: r * 2 });
  // 顶部圆角提示条
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.04, r + 0.04, 0.12, 20), matDark);
  cap.position.set(x, h + 0.06, z); G.scene.add(cap);
  return mesh;
}

function addDecal(x, z, size, tex, ry = 0, y = 0.03) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2; m.rotation.z = ry;
  m.position.set(x, y, z);
  m.receiveShadow = false;
  G.scene.add(m);
  return m;
}

function addStrip(x, z, w, d, color, y = 0.02) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
  G.scene.add(m);
  return m;
}

// 自发光灯带 —— 作为泛光锚点，营造星船内舱氛围光（不参与碰撞）
function addGlowBar(x, z, w, d, color, y, intensity = 2.0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.16, d),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.5 })
  );
  m.position.set(x, y, z);
  G.scene.add(m);
  return m;
}

export function initRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // 电影级色调映射 —— 高光柔和过渡，配合后处理泛光
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  container.appendChild(renderer.domElement);
  G.renderer = renderer;

  G.scene = new THREE.Scene();
  G.scene.fog = new THREE.Fog(0x07242a, 60, 260);

  // 环境反射贴图（IBL）：给所有 PBR 材质提供基于环境的间接光与金属反射
  const pmrem = new THREE.PMREMGenerator(renderer);
  G.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  G.scene.environmentIntensity = 0.28;

  G.camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 500);
  G.camera.rotation.order = 'YXZ';
  G.scene.add(G.camera);

  window.addEventListener('resize', () => {
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

export function buildWorld() {
  const S = G.scene;

  matWall = new THREE.MeshStandardMaterial({ color: 0xe8ebe3, roughness: 0.92 });
  matYellow = new THREE.MeshStandardMaterial({ color: 0xf2e11c, roughness: 0.85 });
  matOrange = new THREE.MeshStandardMaterial({ color: 0xff5c1f, roughness: 0.7 });
  matAcid = new THREE.MeshStandardMaterial({ color: COLORS.acid, roughness: 0.8, emissive: 0x2a3a00 });
  matChecker = new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.85 });
  matChevron = new THREE.MeshStandardMaterial({ map: chevronTexture(), roughness: 0.85 });
  matDark = new THREE.MeshStandardMaterial({ color: 0x141814, roughness: 0.9 });

  // 灯光
  S.add(new THREE.HemisphereLight(0xbfd0d6, 0x10201c, 0.45));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.15);
  sun.position.set(45, 75, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 200 });
  S.add(sun);

  // 天空球 + 虚空基座
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(420, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false })
  );
  S.add(sky);

  const base = new THREE.Mesh(new THREE.BoxGeometry(MAP.w + 3, 5, MAP.d + 3), matDark);
  base.position.y = -2.55; S.add(base);
  // 平台边缘荧光绿描边
  const rim = new THREE.Mesh(new THREE.BoxGeometry(MAP.w + 3.2, 0.14, MAP.d + 3.2),
    new THREE.MeshBasicMaterial({ color: COLORS.acid }));
  rim.position.y = -0.1; S.add(rim);

  // 地板
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP.w, MAP.d),
    new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.42, metalness: 0.24, envMapIntensity: 0.8 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  S.add(floor);
  G.wallMeshes.push(floor); // 供射击命中地面

  /* ---- 外围墙 ---- */
  addBox(0, -30.5, MAP.w + 2, 1, 3, matWall);
  addBox(0, 30.5, MAP.w + 2, 1, 3, matWall);
  addBox(-38.5, 0, 1, MAP.d + 2, 3, matWall);
  addBox(38.5, 0, 1, MAP.d + 2, 3, matWall);

  /* ---- 中央分隔（三路） ---- */
  addBox(-13.5, -12, 3, 12, 3.2, matWall);   // 左隔墙北段 (z -18..-6)
  addBox(-13.5, 8, 3, 16, 3.2, matWall);     // 左隔墙南段 (z 0..16)
  addBox(13.5, -12, 3, 12, 3.2, matWall);
  addBox(13.5, 8, 3, 16, 3.2, matWall);

  // 中路反应堆（红黑棋盘 —— 内舱参考图）
  const reactor = addBox(0, -2, 8, 8, 3.6, matChecker);
  reactor.material = matChecker;
  const reactorTrim = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.5, 8.4), matAcid);
  reactorTrim.position.set(0, 3.75, -2); S.add(reactorTrim);

  // 防守方出生区隔墙
  addBox(0, -24, 16, 1.6, 3, matWall);

  /* ---- A 站点 ---- */
  addBox(-27, -15, 4.5, 2.2, 1.3, matYellow);          // 黄色平台块
  addBox(-23, -11, 2.2, 2.2, 1.5, matWall);
  addBox(-31, -19, 2.2, 2.2, 1.5, matChevron);
  addBox(-24, -19, 2.2, 2.2, 1.5, matWall);
  addCylinder(-34, -9, 1.4, 4, matOrange);             // 橙色筒仓地标
  addBox(-33, -24.6, 8, 0.8, 5, matWall, { noCap: true }); // 站点背景墙
  const signA = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6),
    new THREE.MeshBasicMaterial({ map: letterTexture('A') }));
  signA.position.set(-33, 2.5, -24.15); S.add(signA);
  addDecal(-27, -15, 9, letterDecalTexture('A'));
  addStrip(-27, -15, 16, 16, 0xf2e11c, 0.012).material.opacity = 0.16;

  /* ---- B 站点 ---- */
  addBox(27, -15, 4.5, 2.2, 1.3, matYellow);
  addBox(23, -11, 2.2, 2.2, 1.5, matWall);
  addBox(31, -19, 2.2, 2.2, 1.5, matChevron);
  addBox(24, -19, 2.2, 2.2, 1.5, matWall);
  addCylinder(34, -9, 1.4, 4, matOrange);
  addBox(33, -24.6, 8, 0.8, 5, matWall, { noCap: true });
  const signB = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6),
    new THREE.MeshBasicMaterial({ map: letterTexture('B') }));
  signB.position.set(33, 2.5, -24.15); S.add(signB);
  addDecal(27, -15, 9, letterDecalTexture('B'));
  addStrip(27, -15, 16, 16, 0xf2e11c, 0.012).material.opacity = 0.16;

  /* ---- 中路与走廊掩体 ---- */
  addBox(-7, 8, 2.2, 2.2, 1.5, matWall);
  addBox(7, 4, 2.2, 2.2, 1.5, matWall);
  addBox(0, 12, 3, 1.2, 1.4, matChevron);
  addBox(-27, 10, 2.2, 2.2, 1.5, matWall);
  addBox(-31, 1, 2.2, 2.2, 1.5, matChevron);
  addBox(27, 10, 2.2, 2.2, 1.5, matWall);
  addBox(31, 1, 2.2, 2.2, 1.5, matChevron);

  /* ---- 出生区掩体 ---- */
  addBox(-4, 20.5, 4, 1.2, 1.4, matChevron);
  addBox(4, 20.5, 4, 1.2, 1.4, matChevron);
  addBox(-11, -27, 1.8, 1.8, 1.4, matWall);
  addBox(11, -27, 1.8, 1.8, 1.4, matWall);

  /* ---- 图形化地面装饰 ---- */
  addStrip(0, 18, MAP.w - 4, 0.5, COLORS.acid);        // 进攻方“起跑线”
  addStrip(-10.7, 3, 0.35, 26, COLORS.acid);
  addStrip(10.7, 3, 0.35, 26, COLORS.acid);
  addStrip(0, -22, 14, 0.4, 0xff2e7e);
  addDecal(0, 22, 6, letterDecalTexture('⬢'));
  const runnerTex = canvasTex(256, 64, (g) => {
    g.clearRect(0, 0, 256, 64);
    g.fillStyle = 'rgba(11,16,13,.8)'; g.font = '700 34px monospace';
    g.fillText('UESC MARATHON', 6, 44);
  });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5),
    new THREE.MeshBasicMaterial({ map: runnerTex, transparent: true }));
  label.rotation.x = -Math.PI / 2; label.position.set(0, 0.04, 27.5); S.add(label);

  /* ---- 天花板荧光灯带（氛围光 + 泛光锚点） ---- */
  const ACID = COLORS.acid;
  addGlowBar(-27, -8, 0.32, 34, ACID, 4.3, 2.2);   // A 侧长廊灯带
  addGlowBar(27, -8, 0.32, 34, ACID, 4.3, 2.2);    // B 侧长廊灯带
  addGlowBar(0, 6, 0.32, 28, 0x37e1e8, 4.3, 1.9);  // 中路青色灯带
  addGlowBar(-33, -24, 7, 0.3, 0xf2e11c, 3.2, 2.4); // A 站点背墙灯条
  addGlowBar(33, -24, 7, 0.3, 0xf2e11c, 3.2, 2.4);  // B 站点背墙灯条
  addGlowBar(0, -24, 12, 0.3, 0xff2e7e, 3.0, 2.0);  // 防守出生品红警示条

  G.shootables = [...G.wallMeshes];
}

/* ---------------- 路点导航 ---------------- */
export const WP = [
  [0, 25],      // 0 进攻出生
  [-27, 18],    // 1 A 长廊南
  [-27, 6],     // 2 A 长廊中
  [-27, -4],    // 3 A 长廊北
  [-27, -15],   // 4 A 站点
  [-33, -20],   // 5 A 站点深处
  [0, 16],      // 6 中路南
  [-8, -2],     // 7 反应堆西
  [8, -2],      // 8 反应堆东
  [0, -10],     // 9 中路北
  [-13.5, -3],  // 10 A 连接口
  [13.5, -3],   // 11 B 连接口
  [27, 18],     // 12 B 长廊南
  [27, 6],      // 13 B 长廊中
  [27, -4],     // 14 B 长廊北
  [27, -15],    // 15 B 站点
  [33, -20],    // 16 B 站点深处
  [0, -27],     // 17 防守出生
  [-14, -22],   // 18 防守 A 通道
  [14, -22],    // 19 防守 B 通道
  [-22, -20],   // 20 A 站点北口
  [22, -20],    // 21 B 站点北口
  [0, -16],     // 22 中路最北
].map(([x, z]) => new THREE.Vector3(x, 0, z));

const EDGE_LIST = [
  [0, 1], [0, 6], [0, 12],
  [1, 2], [2, 3], [3, 4], [4, 5], [4, 20], [3, 10],
  [6, 7], [6, 8], [7, 9], [8, 9], [7, 10], [8, 11],
  [10, 3], [11, 14],
  [12, 13], [13, 14], [14, 15], [15, 16], [15, 21],
  [9, 22], [22, 18], [22, 19],
  [17, 18], [17, 19], [18, 20], [19, 21], [20, 4], [21, 15],
];
const ADJ = WP.map(() => []);
for (const [a, b] of EDGE_LIST) { ADJ[a].push(b); ADJ[b].push(a); }

export function nearestWP(pos) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < WP.length; i++) {
    const d = (WP[i].x - pos.x) ** 2 + (WP[i].z - pos.z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

export function findPath(from, to) {
  const s = nearestWP(from), e = nearestWP(to);
  // A*
  const open = [s], came = {}, gScore = { [s]: 0 };
  const f = { [s]: WP[s].distanceTo(WP[e]) };
  const closed = new Set();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if ((f[open[i]] ?? 1e9) < (f[open[bi]] ?? 1e9)) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur === e) {
      const path = [WP[e].clone()];
      let c = e;
      while (came[c] !== undefined) { c = came[c]; path.unshift(WP[c].clone()); }
      path.push(to.clone().setY(0));
      return path;
    }
    closed.add(cur);
    for (const nb of ADJ[cur]) {
      if (closed.has(nb)) continue;
      const tg = gScore[cur] + WP[cur].distanceTo(WP[nb]);
      if (tg < (gScore[nb] ?? 1e9)) {
        came[nb] = cur; gScore[nb] = tg;
        f[nb] = tg + WP[nb].distanceTo(WP[e]);
        if (!open.includes(nb)) open.push(nb);
      }
    }
  }
  return [to.clone().setY(0)];
}

/* ---------------- 视线检测（纯数学，供 AI 用） ---------------- */
function segHitsBox(ax, ay, az, bx, by, bz, c) {
  // slab 法: x/z 用碰撞体范围, y 用 0..h
  let tmin = 0, tmax = 1;
  const dims = [
    [ax, bx, c.minX, c.maxX],
    [ay, by, -0.5, c.h],
    [az, bz, c.minZ, c.maxZ],
  ];
  for (const [o, e, lo, hi] of dims) {
    const d = e - o;
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return false; continue; }
    let t1 = (lo - o) / d, t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

function segHitsSphere(a, b, center, r) {
  const ab = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, center.clone().sub(a).dot(ab) / ab.lengthSq()));
  return a.clone().addScaledVector(ab, t).distanceTo(center) < r;
}

export function losBlocked(a, b) {
  for (const c of G.colliders) {
    if (segHitsBox(a.x, a.y, a.z, b.x, b.y, b.z, c)) return true;
  }
  for (const s of G.smokes) {
    if (segHitsSphere(a, b, s.pos, s.r)) return true;
  }
  return false;
}
