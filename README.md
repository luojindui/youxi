# 星际格斗 · 3D 模型演示项目

> 一个纯前端、无构建步骤的 Three.js 小项目。两个 HTML 页面各自独立可运行：一个是波次生存格斗游戏，一个是 GLB 模型预览器。逻辑已模块化拆分到 `js/` 目录，模型资源在 `model/` 目录。

## 目录结构

```
media/
├── fighting-game.html    格斗游戏入口（HTML 只做外壳 + importmap + UI 骨架）
├── model-viewer.html     GLB 模型预览器入口
├── js/
│   ├── shared.js         共用模块：渲染器/场景/相机/灯光、GLTF 加载器、材质修复、模型缓存与骨骼克隆
│   ├── game.js           格斗游戏全部逻辑（玩家/敌人/武器/掉落/战斗/波次/相机/HUD）
│   └── viewer.js         模型预览器逻辑（OrbitControls、动画切换、模型信息面板）
├── model/                GLB 模型 + 同名 png（贴图/参考图）
└── README.md             本文件
```

### model/ 里的模型

- **游戏实际加载的 6 个**（`game.js` 的 `MODELS_TO_LOAD`）：`宇航员`、`恐龙`、`狗`、`飞碟`、`骨骼`、`太阳系`。
- **预览器可浏览的全部**（`viewer.js` 的 `VIEWER_MODELS`，共 24 项）：太阳系、宇航员、恐龙、狗、飞碟、飞碟1、骨骼、机器人、大眼怪、树怪、草怪、雪怪、鱼怪、翼龙、矮哥布林、矮哥布林2、高哥布林、普通子弹、火子弹、毒子弹、地图1~4。
  - ⚠ 预览列表里的 `飞碟1` 在 `model/` 中没有对应 `飞碟1.glb`（只有 `飞碟.glb`），点它会加载失败。`矮哥布林` 的贴图文件名是 `矮哥布林1.png`（与 glb 名不完全一致）。
  - 这些"多出来"的模型（机器人、各种怪物、地图等）目前只用于预览器，格斗游戏尚未接入。

## 如何运行

- **model-viewer.html**：一般可直接双击（模型走相对路径 `model/*.glb`，Three.js 走 CDN）。
- **fighting-game.html**：同样可直接双击。若浏览器对 `file://` 下的 GLB / ES module 加载有 CORS 限制，用本地服务器：
  ```bash
  cd media && python -m http.server 8765
  # 打开 http://localhost:8765/fighting-game.html
  ```
- 依赖：Three.js `0.160.0`，通过 importmap 从 `unpkg.com` CDN 加载（`three` 主包 + `three/addons/` 下的 `GLTFLoader`/`DRACOLoader`/`OrbitControls`）。DRACO 解码器走 `gstatic.com`（`1.5.6`）。**需要联网**。
- 无 npm / 无构建 / 无 package.json。HTML 里只有 importmap 和一段引导脚本，真正逻辑都在 `js/*.js` 里。
- `shared.js` 的加载器额外注册了 `KHR_materials_pbrSpecularGlossiness` → Standard PBR 的材质转换，兼容老式 SpecGloss 材质的 GLB。

## 语法自检（改完代码后）

代码已是独立的 `.mjs` 语义模块，可直接用 Node 检查：

```bash
cd media && node --check js/shared.js && node --check js/game.js && node --check js/viewer.js
```

---

# fighting-game.html 详解

第三人称波次生存：操控宇航员在圆形竞技场里对抗一波波怪物，捡起掉落的武器/道具，靠击杀得分升级。纯键盘操作（含触摸屏支持）。页面进入时先显示太阳系模型预览，点"🎮 进入格斗"或按 Tab 开始。

## 操作方式（纯键盘，无鼠标瞄准）

| 键 | 作用 |
|---|---|
| WASD / 方向键 | 移动（同时决定角色朝向 = 攻击方向） |
| Shift | 跑步（移速 ×1.2，`RUN_MULTIPLIER`） |
| J | 攻击 / 射击（持枪射击，持近战武器或空手则挥击） |
| Space | 跳跃 |
| F | 拾取掉落物 |
| Q / E | 转视角（水平方位角） |
| Z / X | 拉近 / 拉远相机 |
| R | 游戏结束后重来 |
| P | 开关设置面板 |
| Tab | 切换预览 / 格斗模式 |

- 瞄准：射击方向 = 角色朝向（WASD 控制），另有 **软锁定**：在朝向 ±约30°(`AIM_ASSIST_ANGLE = π*0.17`) 锥内自动瞄准最近敌人的身体中心（这样才能打到空中的飞碟）。射击时角色朝向会转向锁定目标。
- 仰角没有键盘键可调，进入格斗时固定为 `0.7`（触摸屏可单指调）。
- 触摸屏：单指拖拽转视角 + 调仰角，双指捏合缩放相机。

## 玩家参数（`game.js` 常量，约 14-22 行）

| 参数 | 值 | 说明 |
|---|---|---|
| PLAYER_MAX_HP | 100 | 最大生命 |
| PLAYER_SPEED | 5 | 基础移速（单位/秒） |
| PLAYER_JUMP_VEL | 8 | 跳跃初速 |
| GRAVITY | 18 | 重力加速度 |
| RUN_MULTIPLIER | 1.2 | 按住 Shift 跑步倍率 |
| 受击无敌时间 | 0.4~0.5s | 挨打后短暂无敌，闪烁 |

移速叠乘规则：`基础5 × 加速道具倍率(吃到=2) × Shift倍率(按住=1.2)`，全开 = 12/秒。

### 等级系统

- 击杀累计得分，升级公式 `scoreForLevel(n) = 100 × (n-1) × n`（即 Lv2 需 200 分、Lv3 需 600 分、Lv4 需 1200 分……）。
- 每升 1 级，玩家伤害 `+15%`（`LEVEL_DMG_BONUS`），对近战和枪械都生效。HUD 会显示当前加成百分比。

## 敌人（`ENEMY_STATS`，约 35-40 行）

血量随波次成长：`实际HP = 基础HP × (1 + (wave-1) × 0.1)`。

| 敌人 | 基础HP | 速度 | 伤害 | 攻击距离 | 攻击冷却 | 分值 | 命中半径 | 特性 |
|---|---|---|---|---|---|---|---|---|
| 🦕 恐龙 | 100 | 2.4 | 10 | 2.0 | 2.0s | 140 | 1.1 | 近战；有两套攻击动画随机（bite / attack_tail） |
| 🐕 狗 | 40 | 3.8 | 7 | 1.6 | 1.2s | 80 | 0.8 | 近战；快速脆皮 |
| 🛸 飞碟 | 30 | 3.0 | 9 | 9.0 | 1.8s | 120 | 1.2 | **飞行 + 远程发射**（见下） |
| 💀 骨骼 | 80 | 1.6 | 15 | 1.8 | 2.5s | 150 | 1.0 | 近战；高血高伤慢速 |

模型缩放：按各自 `scale` × 1.8 除以包围盒最大边自适应（上限 5 倍）。

**飞碟远程专属字段**：`flying:true, flyHeight:1.8, ranged:true, projSpeed:16, projColor:'#8aff5a', keepDist:6.5`
- 飞行高度 1.8；远距离(9)停下发射绿色能量弹，玩家近到 6.5(`keepDist`)内会后退。
- 子弹伤害 = 敌人 damage(9)，走独立的 `enemyBullets` 系统，命中玩家时结算。

> 想加新的远程敌人：在 `ENEMY_STATS` 里加 `ranged:true` + `projSpeed/projColor/keepDist` 即可复用整套敌人子弹逻辑。

## 武器（`WEAPONS` / `FIST`，约 42-59 行）

**统一一个装备槽**：捡到新武器会覆盖当前手持的。近战与枪械共用 J 键。武器模型全部是程序化几何体拼的（`buildMeleeMesh` / `buildGunMesh`），不依赖外部资源。

### 徒手 / 近战武器（有耐久 `uses`，命中才扣、空挥不扣，用尽回退拳头）

| 武器 | 伤害 | 范围 | 冷却 | 击退 | 耐久 |
|---|---|---|---|---|---|
| 👊 拳头（默认空手 `FIST`） | 22 | 4.5 | 0.3s | 6 | ∞ |
| 🤜 指虎 | 26 | 4.5 | 0.3s | 7 | 50 |
| 🥍 棍子 | 35 | 5.2 | 0.45s | 8 | 40 |
| 🔧 撬棒 | 50 | 4.8 | 0.55s | 11 | 30 |
| 🔨 太空扳手 | 80 | 4.4 | 0.7s | 15 | 20 |
| 🐔 尖叫鸡 | 20 | 4.5 | 0.5s | 6 | 80 |

> 攻击角度锥：拳头/指虎/棍子/尖叫鸡约 `π*0.7`，撬棒约 `π*0.62`，太空扳手约 `π*0.55`（越重的武器锥角越窄）。

### 枪械（有弹药 `ammo`，打空回退拳头）

| 武器 | 单发伤害 | 冷却 | 弹药 | 连发 | 弹丸数 | 散射 | 弹速 | 穿透 |
|---|---|---|---|---|---|---|---|---|
| 🔫 手枪 | 28 | 0.28s | 24 | 半自动 | 1 | 0.01 | 45 | 0 |
| 🔩 步枪 | 20 | 0.09s | 90 | **全自动**（可按住） | 1 | 0.035 | 60 | 0 |
| 💥 霰弹枪 | 25 ×7 | 0.85s | 16 | 半自动 | 7 | 0.13 | 40 | 0 |
| ⚡ 等离子炮 | 70 | 0.6s | 12 | 半自动 | 1 | 0 | 35 | 3（穿透3个敌人） |

- 实际伤害 = 表中伤害 × 等级加成(`1 + (Lv-1)×0.15`)。
- 攻速 = 1/cooldown（步枪 0.09s ≈ 11发/秒）。
- 子弹从玩家中轴胸口高度(`BULLET_ORIGIN_Y = 1.25`)发射，枪焰特效画在真实枪口(`MUZZLE_LOCAL`)；两点分离是刻意的。
- 子弹分步进(step ≤ 0.4)做连续碰撞检测，避免高速穿模；穿透弹每命中一个敌人 `pierce--`。

## 消耗类道具（`HEART` / `SPEED`，约 78-79 行）

| 道具 | 效果 |
|---|---|
| ❤️ 医疗包 | 回 30 血；满血时不自动拾取（提示"生命已满"，仍可按 F 强拿） |
| 🏹 加速道具 | 10 秒内移速 ×2（重复拾取刷新时长），HUD 显示 buff 倒计时条 |

## 掉落系统（掉落率常量约 65-72 行 + `onEnemyKilled`）

每次击杀敌人时判定：

| 类别 | 概率 | 说明 |
|---|---|---|
| 徒手武器 | 10% (`MELEE_DROP_CHANCE`) | 与枪械互斥（同一次 random 分段），随机一件 |
| 枪械 | 6% (`GUN_DROP_CHANCE`) | 与徒手互斥 |
| 医疗包 | 12% (`HEART_CHANCE`)；残血<40% 时 28% (`HEART_CHANCE_LOW_HP`) | 独立判定 |
| 加速道具 | 8% (`SPEED_CHANCE`) | 独立判定 |

- 一次击杀**最多掉一件武器**（近战/枪械二选一，走同一次 `Math.random()` 分段）；医疗包/加速道具各自独立掷骰，可与武器同时掉。
- 拾取规则：
  - 空手时走近武器 → **自动拾取**（`DROP_PICKUP_RANGE = 1.9` 格内）。
  - **手上已有武器** → 不自动拾取，需按 F 更换（防止好武器被覆盖）。
  - 医疗包（未满血）、加速道具 → 走近自动拾取。
- 掉落物 30 秒(`DROP_LIFETIME`)后闪烁消失（最后 5 秒开始闪）。

## 波次规则（`spawnWave`，约 677 行）

- 第 N 波敌人数 = `1 + wave`（第1波2个，第2波3个……）。
- 波次越高越容易刷出强敌：`typeIdx = random × min(4, 1+wave)`。
- 一波清完，2 秒后进下一波。

## 设置面板（P 键 / 齿轮按钮，状态存 localStorage `starbrawl.display`）

| 开关 | 默认 | 作用 |
|---|---|---|
| 敌人血条 | 开 | 头顶血条 |
| 血量数值 | 关 | 血条上叠加 `当前/上限` |
| 伤害数字 | 开 | 命中飘动数字（打敌人黄字/击杀红色大字/玩家挨打红字/回血绿字） |

## 场景 / 相机常量

- 竞技场半径 `ARENA_R = 14`（圆形），含发光边环、12 根立柱、顶部聚光灯。太阳系模型缩放 12 悬在 `(0,7,0)` 当天空背景（非角色，缓慢自转）。
- 相机：第三人称球面跟随。`CAM_MIN_DIST=3` / `CAM_MAX_DIST=18`，仰角范围 `0.1~1.2`，平滑系数 `CAM_SMOOTH=8`。进入格斗时距离 18、仰角 0.7、方位 π。

## 代码结构导航（`js/game.js`）

用 `// ═══` 分隔线划分区块。关键导出/函数：
- `initGameEngine()` / `buildArena()`：引擎（renderer/scene/camera）与竞技场搭建。
- `loadGameModels()` → `shared.js` 的 `preloadModels`：预加载 6 个 GLB 到 `modelCache`。
- `createPlayer()` / `createEnemy(type)`：实例化，用 `shared.js` 的 `spawnInstance`（内部 `cloneSkinned` 克隆骨骼网格）。
- `ANIM_MAP`（约 25 行）：把每个 GLB 原始动画名映射成 idle/move/attack/jump/hurt/death 等游戏语义，`crossfadeAnim()` 做淡入淡出。
- `updateGame(dt)`：主循环——输入、移动、攻击、敌人 AI、子弹、边界。
- `meleeAttack(cfg)` / `fireWeapon()`：近战与射击，共用 `damageEnemy()`。
- `spawnBullet`/`updateBullets`（玩家子弹）；`spawnEnemyBullet`/`updateEnemyBullets`（敌人子弹，独立数组）。
- `spawnDrop`/`updateDrops`/`equipWeapon`：掉落与拾取。
- `buildWeaponMesh` → `buildMeleeMesh`/`buildGunMesh`/`buildHeartMesh`/`buildSpeedMesh`：**所有武器/道具模型都是程序化几何体拼的**。
- `updateEnemyHpBar`/`spawnDamageNumber`/`updateHUD`：DOM 元素投影到屏幕坐标（非 3D 精灵）。
- `gameLoop(game, dt)`：由 HTML 的 `animate()` 每帧调用，驱动更新与渲染。

调整数值基本只需改 `ENEMY_STATS`、`WEAPONS`、`FIST`、`HEART`、`SPEED` 和那批掉落率/等级常量，都集中在 `game.js` 约 14-86 行。

---

# model-viewer.html 详解

独立的 GLB 模型勘查工具（`js/viewer.js`），用于查看素材、动画和网格信息。

- 顶部工具栏按钮切换模型（按钮的 `data-model` 属性对应 `model/*.glb`）。默认加载 `地图2`。
- 用 `OrbitControls`：**🖱 拖拽旋转 · 滚轮缩放 · 右键平移 · 双击恢复视角**。
- 信息面板显示：三角形数、节点数、骨骼数、材质类型、是否含顶点色、动画列表。
- 动画控制：底部动画按钮点击切换；**空格暂停/继续**当前动画，**数字键 1~9** 切换到第 N 个动画。
- 加载模型时居中并按包围盒自动缩放/摆放相机（`fitModelToGroup`）。

---

## 变更约定（给后续 session）

- 改完 `js/*.js` 务必跑上面的**语法自检**（`node --check`）。
- 若用 Playwright/浏览器验证，收尾时删除临时调试钩子（`window.__diag` 之类）和临时截图，勿留在文件里。
- 提交/落盘前确认没有 `__test` / `__diag` / `_frozen` 等排查残留。
- 新增游戏敌人时记得把模型加进 `game.js` 的 `MODELS_TO_LOAD` 并在 `ANIM_MAP` / `ENEMY_STATS` / `ENEMY_TYPES` 里补齐配置。
</content>
</invoke>
