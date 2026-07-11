// 武器定义 —— 数值向无畏契约靠拢，命名走马拉松风
export const WEAPONS = {
  knife:   { id: 'knife',   name: '作训刀',      type: 'melee', dmg: 75,  hsMul: 1.5, rpm: 110, range: 2.3, price: 0, moveSpeed: 5.7 },
  pistol:  { id: 'pistol',  name: 'P-7 侧卫',    dmg: 26,  hsMul: 3.0, rpm: 400, mag: 12, reserve: 36, spread: 0.011, kick: 0.011, price: 0,    auto: false, kind: 'pistol',  moveSpeed: 5.2 },
  smg:     { id: 'smg',     name: '蜂群 SMG',    dmg: 22,  hsMul: 2.2, rpm: 790, mag: 30, reserve: 90, spread: 0.020, kick: 0.006, price: 1000, auto: true,  kind: 'smg',     moveSpeed: 5.4 },
  shotgun: { id: 'shotgun', name: '破门者',      dmg: 9,   hsMul: 1.8, rpm: 72,  mag: 7,  reserve: 21, spread: 0.065, kick: 0.030, price: 1600, auto: false, kind: 'shotgun', pellets: 8, moveSpeed: 5.2 },
  rifle:   { id: 'rifle',   name: '长矛 MA-75',  dmg: 33,  hsMul: 3.5, rpm: 600, mag: 25, reserve: 75, spread: 0.008, kick: 0.010, price: 2900, auto: true,  kind: 'rifle',   moveSpeed: 5.0 },
  sniper:  { id: 'sniper',  name: '轨道者',      dmg: 120, hsMul: 2.1, rpm: 35,  mag: 5,  reserve: 10, spread: 0.001, kick: 0.045, price: 4500, auto: false, kind: 'sniper',  zoom: true, moveSpeed: 4.6 },
};

export const ARMOR_PRICE = 1000;

// 伤害距离衰减
export function falloff(weapon, dist) {
  if (weapon.kind === 'shotgun') return Math.max(0.25, 1 - Math.max(0, dist - 7) * 0.07);
  if (weapon.kind === 'smg' || weapon.kind === 'pistol') return Math.max(0.65, 1 - Math.max(0, dist - 18) * 0.012);
  if (weapon.kind === 'rifle') return Math.max(0.75, 1 - Math.max(0, dist - 28) * 0.01);
  return 1;
}

// 机器人命中率基础值
export function botBaseAcc(weapon) {
  switch (weapon.kind) {
    case 'sniper': return 0.45;
    case 'rifle': return 0.33;
    case 'smg': return 0.28;
    case 'shotgun': return 0.42;
    default: return 0.26;
  }
}
