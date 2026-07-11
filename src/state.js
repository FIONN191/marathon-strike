// 全局游戏状态 —— 所有模块共享，避免循环依赖
export const G = {
  renderer: null, scene: null, camera: null,
  time: 0,                       // 游戏时钟（暂停时停走）
  state: 'menu',                 // menu | playing
  paused: false,
  phase: 'buy',                  // buy | live | planted | end
  phaseEnds: 0,
  round: 1,
  scores: { ally: 0, enemy: 0 },
  attackingTeam: 'ally',         // 上半场玩家方进攻
  matchOver: false,
  credits: 800,
  selectedHero: 'glitch',

  player: null,
  bots: [],
  decoys: [],
  smokes: [],                    // {pos, r, until, mesh}
  barriers: [],                  // {mesh, collider, hp, until}
  spike: { state: 'idle', carrier: null, pos: null, mesh: null, claimer: null, plantedBy: null },

  colliders: [],                 // {minX,maxX,minZ,maxZ,h} 静态 + 屏障
  wallMeshes: [],
  shootables: [],
  mapRects: [],                  // 小地图用 2D 矩形
  botPlan: { site: 'A' },

  shake: 0,
  liveStartAt: 0,                // 当前回合 live 阶段开始时间（分批推进用）
  sens: 1,
};

export const TEAM_NAMES = { ally: '跑者', enemy: '保全' };
export const COLORS = {
  acid: 0xc9f24b, acid2: 0x9be21e, mag: 0xff2e7e, cyan: 0x37e1e8,
  orange: 0xff5c1f, paper: 0xeef0ea, ink: 0x0b100d,
};
