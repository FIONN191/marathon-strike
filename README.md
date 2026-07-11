# MARATHON 失落星船 — 熵核行动

![version](https://img.shields.io/badge/version-0.1.1-39FF14?style=flat-square)
![engine](https://img.shields.io/badge/Vite%20+%20Three.js-000000?style=flat-square)
![type](https://img.shields.io/badge/fan%20project-non--commercial-FF7A00?style=flat-square)

**简体中文** · [English](README.en.md)

> 非官方粉丝致敬项目：**马拉松（Marathon）美学 × 无畏契约（Valorant）玩法** 的浏览器 FPS。

## 简介

一场发生在失落星船上的 5v5 搜索与破坏对局。进攻方将「熵核」安放至 A / B 站点，防守方阻止或拆除；先取 **13 局**获胜，12 局后攻防互换，12-12 进入决胜局。

- **玩法**：5v5 搜索与破坏（安放 / 拆除熵核）。
- **英雄技能**：4 名跑者（Runner），各有 Q / E 两个技能。
- **经济系统**：击杀 +$200、下包 +$300、胜局 +$3000、败局 +$1900；购买阶段按 **B** 采购武器与护甲。
- **队友与敌人**：AI 机器人（导航、交战、下包、拆包、护点）。

## 运行

```bash
npm install
npm run dev        # http://localhost:5190
npm run build      # 产物在 dist/，可静态部署
npm run dist        # 打包 Mac / Win 桌面安装包（Electron）
```

## 操作

| 按键 | 功能 |
| --- | --- |
| WASD / 空格 / C / Shift | 移动 / 跳 / 蹲 / 静步 |
| 鼠标左键 / 右键 | 射击 / 机瞄（狙击开镜） |
| Q / E | 英雄技能 |
| B | 购买菜单（仅购买阶段） |
| F（长按） | 安放 / 拆除熵核 |
| R · 1/2/3 | 装填 · 主武器/手枪/近战 |

## 跑者

| 跑者 | Q | E |
| --- | --- | --- |
| GLITCH 骇影 | 相位冲刺 | 残影诱饵（吸引 AI 火力） |
| LOCUS 壁垒 | 动能壁垒（可拦弹墙） | 过载装甲（+50 护甲） |
| BLACKBIRD 黑鸫 | 声呐脉冲（全场透视 4s） | 猎杀标记（标记最近敌人 8s） |
| VOID 虚无 | 虚空烟幕（阻断 AI 视线） | 相位隐形（开火解除） |

## 美学来源

视觉基因取自公开的 Marathon 官方美术参考（酸性荧光绿字标、白色平台 + 安全黄/警示橙色块、黑色超图形字母、红黑棋盘、深青虚空星点）。所有 3D 素材为程序化生成；字体为开源（Orbitron / Chakra Petch / Archivo Black，来自 Google Fonts）。**未使用任何 Bungie 版权资产。**

## 技术

Vite + Three.js，无其他运行时依赖。音频全部为 WebAudio 程序化合成。AI 使用路点图 A\* 导航 + 纯数学视线检测（含烟幕 / 屏障遮挡）。

## 路线图（未做）

- 真人联机（需要 WebSocket/WebRTC 服务端做状态同步）
- 大招（终极技能）与更多跑者
- 更精细的角色模型 / 枪模（可换 glTF 资产）
- 加时赛规则、残局慢动作回放

## 版权声明

本项目为非商业的粉丝致敬作品，与 Bungie、Riot Games 无任何关联，也未获其授权。「Marathon」「Valorant」商标归各自权利人所有。仓库内不含任何官方版权资产。
