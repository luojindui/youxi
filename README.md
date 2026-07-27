# 星际格斗 · 3D 模型演示项目

> 一个纯前端、无构建步骤的 Three.js 小项目。目录下两个 HTML 文件各自独立可运行，共用 `media/` 里的 6 个 GLB 模型。

## 目录结构

```
media/
├── fighting-game.html    主体：3D 第三人称波次生存格斗游戏（本 README 主要对象，~80KB 单文件）
├── model-viewer.html     GLB 模型预览器（调试/勘查素材用）
├── README.md             本文件
└── media/                模型资源（两个 HTML 共用）
    ├── 太阳系.glb / .png      （游戏里当天空背景，非角色）
    ├── 宇航员.glb / .png      （玩家）
    ├── 恐龙.glb / .png        （敌人）
    ├── 狗.glb / .png          （敌人）
    ├── 飞碟.glb / .png        （敌人，⚠ 见“已知问题”）
    └── 骨骼.glb / .png        （敌人）
```

## 如何运行

- **model-viewer.html**：直接双击即可（模型走相对路径 `media/*.glb`，Three.js 走 CDN）。
- **fighting-game.html**：同样可直接双击运行。若浏览器对 `file://` 下的 GLB 加载有 CORS 限制，用本地服务器：
  ```bash
  cd media && python -m http.server 8765
  # 打开 http://localhost:8765/fighting-game.html
  ```
- 依赖：Three.js `0.160.0`，通过 importmap 从 `unpkg.com` CDN 加载（`GLTFLoader` + `DRACOLoader` + `OrbitControls`）。DRACO 解码器走 `gstatic.com`。**需要联网**。
- 无 npm / 无构建 / 无 package.json，所有逻辑内联在单个 HTML 的 `<script type="module">` 里。

## 语法自检（改完代码后）

```bash
cd media && node -e "const fs=require('fs');const m=fs.readFileSync('fighting-game.html','utf8').match(/<script type=\"module\">([\s\S]*?)<\/script>/);fs.writeFileSync('__check.mjs',m[1]);" && node --check __check.mjs && rm -f __check.mjs
```

---

# fighting-game.html 详解

第三人称波次生存：操控宇航员在圆形竞技场里对抗一波波怪物，可捡起掉落的武器/道具。纯键盘操作。

## 操作方式（纯键盘，无鼠标瞄准）

| 键 | 作用 |
|---|---|
| WASD / 方向键 | 移动（同时决定角色朝向 = 攻击方向） |
| Shift | 跑步（移速 ×1.25） |
| J | 攻击 / 射击（持枪射击，持近战武器或空手则挥击） |
| Space | 跳跃 |
| F | 拾取掉落物 |
| Q / E | 转视角（水平） |
| Z / X | 拉近 / 拉远相机 |
| R | 游戏结束后重来 |
| P | 开关设置面板 |
| Tab | 切换预览 / 格斗模式 |

- 瞄准：射击方向 = 角色朝向（WASD 控制），另有 **软锁定**：在朝向 ±30°(`AIM_ASSIST_ANGLE`) 锥内自动瞄准最近敌人的身体中心（这样才能打到空中的飞碟）。
- 仰角目前**没有键盘键**可调，固定在进入格斗时的 0.7（触摸屏可单指调）。这是已知的小缺口。

## 玩家参数（游戏常量，`fighting-game.html` 约 491-498 行）

| 参数 | 值 | 说明 |
|---|---|---|
| PLAYER_MAX_HP | 100 | 最大生命 |
| PLAYER_SPEED | 5 | 基础移速（单位/秒） |
| PLAYER_JUMP_VEL | 8 | 跳跃初速 |
| GRAVITY | 18 | 重力加速度 |
| RUN_MULTIPLIER | 1.25 | 按住 Shift 跑步倍率 |
| 受击无敌时间 | 0.4~0.5s | 挨打后短暂无敌，闪烁 |

移速叠乘规则：`基础5 × 加速道具倍率(吃到=2) × Shift倍率(按住=1.25)`，全开 = 12.5/秒。

## 敌人（`ENEMY_STATS`，约 501-506 行）

血量随波次成长：`实际HP = 基础HP × (1 + (wave-1) × 0.2)`。

| 敌人 | HP | 速度 | 伤害 | 攻击距离 | 攻击冷却 | 分值 | 命中半径 | 特性 |
|---|---|---|---|---|---|---|---|---|
| 🦕 恐龙 | 60 | 2.8 | 10 | 2.0 | 1.6s | 100 | 1.1 | 近战；有两套攻击动画随机 |
| 🐕 狗 | 40 | 3.8 | 7 | 1.6 | 1.2s | 80 | 0.8 | 近战；快速脆皮 |
| 🛸 飞碟 | 50 | 2.4 | 12 | 9.0 | 1.8s | 120 | 1.2 | **飞行 + 远程发射**（见下） |
| 💀 骨骼 | 90 | 1.6 | 18 | 1.8 | 2.5s | 150 | 1.0 | 近战；高血高伤慢速 |

**飞碟远程专属字段**：`flying:true, flyHeight:1.4, ranged:true, projSpeed:16, projColor:'#8aff5a', keepDist:6.5, _fixedScale:135`
- 远距离(9)停下发射绿色能量弹，玩家近到 6.5(`keepDist`)内会后退。
- 子弹伤害 = 敌人 damage(12)，命中玩家时结算（走独立的 `enemyBullets` 系统）。
- `_fixedScale`：飞碟原始模型极小，用固定倍率放大（其它敌人按包围盒自适应）。

> 想加新的远程敌人：在 `ENEMY_STATS` 里加 `ranged:true` + `projSpeed/projColor/keepDist` 即可复用整套敌人子弹逻辑。

## 武器（`WEAPONS` / `FIST`，约 512-566 行）

**统一一个装备槽**：捡到新武器会覆盖当前手持的。近战与枪械共用 J 键。

### 徒手 / 近战武器（有耐久 `uses`，命中才扣、空挥不扣，用尽回退拳头）

| 武器 | 伤害 | 范围 | 攻击角度 | 冷却 | 击退 | 耐久 |
|---|---|---|---|---|---|---|
| 👊 拳头（默认空手） | 25 | 4.5 | ~126° | 0.5s | 6 | ∞ |
| 🥍 棍子 | 35 | 5.2 | ~126° | 0.45s | 8 | 40 |
| 🔧 撬棒 | 50 | 4.8 | ~112° | 0.55s | 11 | 30 |
| 🔨 太空扳手 | 80 | 4.4 | ~99° | 0.7s | 15 | 20 |
| 🐔 尖叫鸡 | 20 | 4.5 | ~126° | 0.5s | 6 | 80 |

### 枪械（有弹药 `ammo`，打空回退拳头）

| 武器 | 单发伤害 | 冷却 | 弹药 | 连发 | 弹丸数 | 散射 | 弹速 | 穿透 |
|---|---|---|---|---|---|---|---|---|
| 🔫 手枪 | 28 | 0.28s | 24 | 半自动 | 1 | 0.01 | 45 | 0 |
| 🔩 步枪 | 20 | 0.09s | 90 | **全自动**（可按住） | 1 | 0.035 | 60 | 0 |
| 💥 霰弹枪 | 25 ×7 | 0.85s | 16 | 半自动 | 7 | 0.13 | 40 | 0 |
| ⚡ 等离子炮 | 70 | 0.6s | 12 | 半自动 | 1 | 0 | 35 | 3（穿透3个敌人） |

- 攻速 = 1/cooldown（步枪 0.09s ≈ 11发/秒）。
- 全自动的快速点击也保证至少发射 1 发（`keys || justPressed`）。
- 子弹从玩家中轴胸口高度(y+1.25)发射，枪焰特效画在真实枪口；两点分离是刻意的，详见代码注释。

## 消耗类道具（`HEART` / `SPEED`，约 579-590 行）

| 道具 | 效果 |
|---|---|
| ❤️ 医疗包 | 回 30 血；满血时不自动拾取（提示"生命已满"，仍可按 F 强拿） |
| 🏹 加速道具 | 10 秒内移速 ×2（重复拾取刷新时长） |

## 掉落系统（约 596-606 行 + `onEnemyKilled`）

每次击杀敌人时独立判定：

| 类别 | 概率 | 说明 |
|---|---|---|
| 徒手武器 | 10% (`MELEE_DROP_CHANCE`) | 与枪械互斥（同一次 random 分段），四选一 |
| 枪械 | 5% (`GUN_DROP_CHANCE`) | 与徒手互斥 |
| 医疗包 | 12% (`HEART_CHANCE`)；残血<40% 时 28% (`HEART_CHANCE_LOW_HP`) | 独立判定 |
| 加速道具 | 8% (`SPEED_CHANCE`) | 独立判定 |

- 一次击杀**最多掉一件武器**；医疗包/加速道具各自独立掷骰，可与武器同时掉。
- 拾取规则：
  - 空手时踩到武器 → **自动拾取**（1.9 格内，`DROP_PICKUP_RANGE`）。
  - **手上已有武器**（棍/枪都算）踩到新武器 → **不自动拾取**，需按 F 更换（防止好武器被覆盖）。
  - 医疗包（未满血）、加速道具 → 走近自动拾取。
- 掉落物 30 秒(`DROP_LIFETIME`)后闪烁消失。

## 波次规则（`spawnWave`，约 1790 行）

- 第 N 波敌人数 = `1 + wave`（第1波2个，第2波3个……）。
- 波次越高越容易刷出强敌：`typeIdx = random × min(4, 1+wave)`。
- 一波清完，2 秒后进下一波。

## 设置面板（齿轮按钮 / P 键，状态存 localStorage `starbrawl.display`）

| 开关 | 默认 | 作用 |
|---|---|---|
| 敌人血条 | 开 | 头顶血条 |
| 血量数值 | 关 | 血条上叠加 `当前/上限` |
| 伤害数字 | 开 | 命中飘动数字（打敌人黄字/击杀红色大字/玩家挨打红字/回血绿字） |

## 场景 / 相机常量

- 竞技场半径 `ARENA_R = 14`（圆形）；太阳系模型缩放后悬在上方当天空背景（非角色）。
- 相机：第三人称球面跟随，`CAM_MIN_DIST=3` / `CAM_MAX_DIST=18`，进入格斗时距离 18、仰角 0.7、方位 π。

## 代码结构导航（fighting-game.html 单文件）

用 `// ═══` 分隔线划分区块。关键函数：
- `createPlayer()` / `createEnemy(type)`：实例化，含骨骼克隆（`cloneSkinned` 内联了 Three.js SkeletonUtils.clone）。
- `ANIM_MAP`（约 476 行）：把每个 GLB 原始动画名映射成 idle/move/attack/jump/hurt/death 等游戏语义，`crossfadeAnim()` 做淡入淡出。
- `updateGame(dt)`：主循环——输入、移动、攻击、敌人 AI、边界。
- `meleeAttack(cfg)` / `fireWeapon()`：近战与射击，共用 `damageEnemy()`。
- `spawnBullet` / `updateBullets`（玩家子弹）；`spawnEnemyBullet` / `updateEnemyBullets`（敌人子弹，独立数组）。
- `spawnDrop` / `updateDrops` / `equipWeapon`：掉落与拾取。
- `buildWeaponMesh` → `buildMeleeMesh` / `buildGunMesh` / `buildHeartMesh` / `buildSpeedMesh`：**所有武器/道具模型都是程序化几何体拼的，不依赖外部资源**。
- `updateEnemyHpBar` / `spawnDamageNumber`：DOM 元素投影到屏幕坐标（非 3D 精灵）。

调整数值基本只需改 `ENEMY_STATS`、`WEAPONS`、`FIST`、`HEART`、`SPEED` 和那批掉落率常量，都集中在 488-606 行。

## 已知问题 ⚠

- **飞碟(🛸)模型在游戏里几乎看不见**（血条和攻击都正常，就是本体不渲染）。
  - 已排查到：飞碟的骨骼网格绑定姿态包围球异常（中心偏到约 (0,21,-30)、半径 81，而实际模型仅约 2 单位）。
  - 试过关闭 `frustumCulled`（视锥剔除）**无效**，说明不止这一个原因——怀疑骨骼动画把顶点变换到别处，或材质/贴图问题。**此问题尚未解决**，飞碟其余逻辑（远程攻击、掉血、AI）都正常。
  - 下一步排查方向：检查骨骼动画后顶点的实际世界位置；对比 model-viewer.html 里飞碟能正常显示的加载方式差异。
- `model-viewer.html` 能正常显示全部 6 个模型（含飞碟），可作为对照参考。

## 变更约定（给后续 session）

- 改完 HTML 里的脚本务必跑上面的**语法自检**。
- 若用 Playwright/浏览器验证，收尾时删除临时调试钩子（`window.__diag` 之类）和临时截图，勿留在文件里。
- 提交/落盘前确认没有 `__test` / `__diag` / `_frozen` / 临时 `frustumCulled` 等排查残留。
