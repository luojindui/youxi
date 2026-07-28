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

- 瞄准：射击方向 = 角色朝向（WASD 控制），另有 **软锁定**：在朝向 ±约30° 锥内自动瞄准最近敌人的身体中心（这样才能打到空中的飞碟）。射击时角色朝向会转向锁定目标。
- 仰角没有键盘键可调，进入格斗时固定（触摸屏可单指调）。
- 触摸屏：单指拖拽转视角 + 调仰角，双指捏合缩放相机。

## 玩家 / 敌人 / 武器 / 掉落 / 波次 / 场景数值

所有平衡数值（玩家属性、等级系统、敌人属性、武器与枪械参数、消耗道具、掉落率、波次规则、场景 / 相机常量）已抽到独立文档：

👉 **[VALUES.md](VALUES.md)**

调平衡对照该表改 `game.js` 约 14-86 行的 `ENEMY_STATS` / `WEAPONS` / `FIST` / `HEART` / `SPEED` 及掉落率 / 等级常量即可。

## 设置面板（P 键 / 齿轮按钮，状态存 localStorage `starbrawl.display`）

| 开关 | 默认 | 作用 |
|---|---|---|
| 敌人血条 | 开 | 头顶血条 |
| 血量数值 | 关 | 血条上叠加 `当前/上限` |
| 伤害数字 | 开 | 命中飘动数字（打敌人黄字/击杀红色大字/玩家挨打红字/回血绿字） |

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
