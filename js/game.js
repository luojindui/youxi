// ════════════════════════════════════════════════
//  星际格斗游戏模块
// ════════════════════════════════════════════════
import * as THREE from 'three';
import {
  createRenderer, createScene, createCamera, createSunLight,
  createLoader, fixModelMaterials, getModelInfo, disposeGroup,
  modelCache, preloadModels, spawnInstance, findSkeleton
} from './shared.js';

// ════════════════════════════════════════════════
//  常量
// ════════════════════════════════════════════════
export const ARENA_R = 14;
export const ARENA_GROUND_Y = 0;
const GRAVITY = 18;
const PLAYER_SPEED = 5;
const PLAYER_JUMP_VEL = 8;
const ATTACK_RANGE = 4.5;
const ATTACK_ANGLE = Math.PI * 0.7;
const ATTACK_COOLDOWN = 0.5;
const PLAYER_MAX_HP = 100;

// ── 动画映射 ──
const ANIM_MAP = {
  '宇航员': { idle: 'idle', move: 'moon_walk', attack: 'wave', jump: 'floating', hurt: null },
  '恐龙':   { idle: 'idle', move: 'run', attack: 'bite', attack2: 'attack_tail', hurt: 'roar', death: null },
  '狗':     { idle: 'standing', move: null, attack: 'shake', hurt: null, death: 'play_dead' },
  '飞碟':   { idle: 'hover', move: 'flight', attack: 'abduction_rings', hurt: null },
  '骨骼':   { idle: 'idle', move: null, attack: null, hurt: null },
};

const ENEMY_TYPES = ['恐龙', '狗', '飞碟', '骨骼'];

const ENEMY_STATS = {
  '恐龙': { hp: 100, speed: 2.4, damage: 10, atkRange: 2.0, atkCooldown: 2, score: 140, scale: 1.0, hitRadius: 1.1 },
  '狗':   { hp: 40, speed: 3.8, damage: 7,  atkRange: 1.6, atkCooldown: 1.2, score: 80,  scale: 0.7, hitRadius: 0.8 },
  '飞碟': { hp: 30, speed: 3, damage: 9, atkRange: 9.0, atkCooldown: 1.8, score: 120, scale: 1.2, flying: true, flyHeight: 1.8, hitRadius: 1.2, ranged: true, projSpeed: 16, projColor: '#8aff5a', keepDist: 6.5 },
  '骨骼': { hp: 80, speed: 1.6, damage: 15, atkRange: 1.8, atkCooldown: 2.5, score: 150, scale: 1.1, hitRadius: 1.0 },
};

// ── 武器配置 ──
const FIST = {
  label: '👊 拳头', kind: 'melee', accent: '#7fd1ff',
  damage: 22, range: ATTACK_RANGE, angle: ATTACK_ANGLE,
  cooldown: 0.3, knockback: 6,
};

const WEAPONS = {
  '指虎':   { label:'🤜 指虎', kind:'melee', color:'#9a8478', accent:'#e0c9a6', damage:26, range:ATTACK_RANGE, angle:ATTACK_ANGLE, cooldown:0.3, knockback:7, uses:50 },
  '棍子':   { label:'🥍 棍子', kind:'melee', color:'#8a5a2b', accent:'#d9a066', damage:35, range:5.2, angle:Math.PI*0.7, cooldown:0.45, knockback:8, uses:40 },
  '撬棒':   { label:'🔧 撬棒', kind:'melee', color:'#b03a2e', accent:'#ff7a5c', damage:50, range:4.8, angle:Math.PI*0.62, cooldown:0.55, knockback:11, uses:30 },
  '太空扳手': { label:'🔨 太空扳手', kind:'melee', color:'#8f98a8', accent:'#cfd8e8', damage:80, range:4.4, angle:Math.PI*0.55, cooldown:0.7, knockback:15, uses:20 },
  '尖叫鸡': { label:'🐔 尖叫鸡', kind:'melee', color:'#f7d000', accent:'#ffe94d', damage:20, range:ATTACK_RANGE, angle:ATTACK_ANGLE, cooldown:ATTACK_COOLDOWN, knockback:6, uses:80 },
  '手枪':   { label:'🔫 手枪', kind:'gun', color:'#bbbbcc', accent:'#ffd700', damage:28, cooldown:0.28, ammo:24, auto:false, pellets:1, spread:0.01, speed:45, knockback:3, bulletColor:'#ffd700', bulletSize:0.10, pierce:0 },
  '步枪':   { label:'🔩 步枪', kind:'gun', color:'#556644', accent:'#88ff66', damage:20, cooldown:0.09, ammo:90, auto:true, pellets:1, spread:0.035, speed:60, knockback:1.5, bulletColor:'#aaff44', bulletSize:0.08, pierce:0 },
  '霰弹枪': { label:'💥 霰弹枪', kind:'gun', color:'#7a4b2a', accent:'#ff8844', damage:25, cooldown:0.85, ammo:16, auto:false, pellets:7, spread:0.13, speed:40, knockback:6, bulletColor:'#ff9944', bulletSize:0.09, pierce:0 },
  '等离子炮': { label:'⚡ 等离子炮', kind:'gun', color:'#33346a', accent:'#00d4ff', damage:70, cooldown:0.6, ammo:12, auto:false, pellets:1, spread:0.0, speed:35, knockback:8, bulletColor:'#00d4ff', bulletSize:0.22, pierce:3 },
};

const WEAPON_NAMES = Object.keys(WEAPONS);
const MELEE_NAMES = WEAPON_NAMES.filter(n => WEAPONS[n].kind === 'melee');
const GUN_NAMES   = WEAPON_NAMES.filter(n => WEAPONS[n].kind === 'gun');

const MELEE_DROP_CHANCE = 0.10;
const GUN_DROP_CHANCE   = 0.06;
const HEART_CHANCE = 0.12;
const HEART_CHANCE_LOW_HP = 0.28;
const SPEED_CHANCE = 0.08;
const DROP_PICKUP_RANGE = 1.9;
const DROP_LIFETIME = 30;
const BULLET_LIFETIME = 2.0;
const AIM_ASSIST_ANGLE = Math.PI * 0.17;
const RUN_MULTIPLIER = 1.2;
const LEVEL_DMG_BONUS = 0.15;
const BULLET_ORIGIN_Y = 1.25;

const HEART = { label:'❤️ 医疗包', kind:'heart', color:'#e94560', accent:'#ff6b8a', heal:30 };
const SPEED = { label:'🏹 加速道具', kind:'speed', color:'#2bb3d9', accent:'#5fe0ff', duration:10, multiplier:2 };

const MUZZLE_LOCAL = {
  '手枪': new THREE.Vector3(0,0.02,0.60),
  '步枪': new THREE.Vector3(0,0.02,1.00),
  '霰弹枪': new THREE.Vector3(0,0.02,1.05),
  '等离子炮': new THREE.Vector3(0,0.02,0.85),
};

// ════════════════════════════════════════════════
//  初始化游戏引擎
// ════════════════════════════════════════════════
export function initGameEngine() {
  const canvas = document.getElementById('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = createScene('#0a0a14', '#0a0a14', 20, 60);
  const camera = createCamera(55, 0.3, 100);
  camera.position.set(0, 6, 10);
  camera.lookAt(0, 1, 0);

  return { renderer, scene, camera };
}

// ════════════════════════════════════════════════
//  竞技场
// ════════════════════════════════════════════════
export function buildArena(scene) {
  const groundGeo = new THREE.CylinderGeometry(ARENA_R, ARENA_R, 0.3, 64);
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color:'#1a1a2e', roughness:0.7, metalness:0.3 }));
  ground.position.y = ARENA_GROUND_Y - 0.15;
  ground.receiveShadow = true;
  scene.add(ground);

  const gridHelper = new THREE.PolarGridHelper(ARENA_R - 1, 48, 24, 64, '#222244', '#222244');
  gridHelper.position.y = ARENA_GROUND_Y;
  scene.add(gridHelper);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(ARENA_R, 0.2, 16, 100),
    new THREE.MeshStandardMaterial({ color:'#4466aa', roughness:0.3, metalness:0.8, emissive:'#112244', emissiveIntensity:0.5 })
  );
  ring.rotation.x = -Math.PI/2;
  ring.position.y = ARENA_GROUND_Y;
  scene.add(ring);

  for (let i = 0; i < 12; i++) {
    const angle = (i/12) * Math.PI * 2;
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 2.5, 8),
      new THREE.MeshStandardMaterial({ color:'#334466', roughness:0.4, metalness:0.7, emissive:'#112233', emissiveIntensity:0.3 })
    );
    pillar.position.set(Math.cos(angle)*ARENA_R, 1.25, Math.sin(angle)*ARENA_R);
    pillar.castShadow = pillar.receiveShadow = true;
    scene.add(pillar);
  }

  const spotLight = new THREE.SpotLight('#ffffff', 50, 30, Math.PI/6, 0.5, 1);
  spotLight.position.set(0, 12, 0);
  spotLight.castShadow = true;
  spotLight.shadow.mapSize.set(1024, 1024);
  scene.add(spotLight);
}

// ════════════════════════════════════════════════
//  模型预加载
// ════════════════════════════════════════════════
const MODELS_TO_LOAD = ['宇航员', '恐龙', '狗', '飞碟', '骨骼', '太阳系'];

export async function loadGameModels(loader, onProgress) {
  return preloadModels(loader, MODELS_TO_LOAD, onProgress);
}

// ════════════════════════════════════════════════
//  工具函数
// ════════════════════════════════════════════════
function itemCfg(type) {
  if (type === 'heart') return HEART;
  if (type === 'speed') return SPEED;
  return WEAPONS[type];
}

function currentWeaponCfg(player) {
  if (player && player.weapon) return WEAPONS[player.weapon];
  return FIST;
}

function playerDamageMult(game) {
  return 1 + (game.playerLevel - 1) * LEVEL_DMG_BONUS;
}

function scoreForLevel(n) { return 100 * (n - 1) * n; }

function getEnemyCenter(enemy) {
  const c = enemy.group.position.clone();
  c.y += enemy.flying ? 0.3 : 1.0;
  return c;
}

function isInAttackCone(aPos, aYaw, tPos, range, angle) {
  const dx = tPos.x - aPos.x, dz = tPos.z - aPos.z;
  const dist = Math.sqrt(dx*dx + dz*dz);
  if (dist > range) return { hit:false, dist };
  let diff = Math.atan2(dx, dz) - aYaw;
  while (diff > Math.PI) diff -= Math.PI*2;
  while (diff < -Math.PI) diff += Math.PI*2;
  return { hit: Math.abs(diff) < angle, dist };
}

// ════════════════════════════════════════════════
//  游戏主类
// ════════════════════════════════════════════════
export function createGame(renderer, scene, camera, loader) {
  const game = {
    renderer, scene, camera, loader,
    player: null, enemies: [], drops: [], bullets: [], enemyBullets: [], effects: [],
    score: 0, wave: 1, playerLevel: 1, gameOver: false, gameRunning: false,
    sunSystem: null, previewModel: null, previewMixer: null,
    waveEnemiesRemaining: 0, waveTotalEnemies: 0,
    keys: {}, justPressed: {},
    // 相机
    camAzimuth: Math.PI, camElevation: 0.5, camDistance: 7,
    cameraCurrent: new THREE.Vector3(),
    msgTimer: null,
    // 设置
    settings: { hpBar: true, hpNum: false, dmgNum: true },
    // UI 引用（延迟绑定）
    ui: {},
  };

  return game;
}

// ════════════════════════════════════════════════
//  UI 绑定
// ════════════════════════════════════════════════
export function bindUI(game) {
  const ui = game.ui;
  ui.loadEl = document.getElementById('loading');
  ui.loadFill = document.getElementById('loadFill');
  ui.loadText = document.getElementById('loadText');
  ui.hudEl = document.getElementById('hud');
  ui.hpFill = document.getElementById('hpFill');
  ui.hpLabel = document.getElementById('hpLabel');
  ui.scoreEl = document.getElementById('score');
  ui.waveEl = document.getElementById('wave');
  ui.levelEl = document.getElementById('level');
  ui.enemyCountEl = document.getElementById('enemy-count');
  ui.atkCdEl = document.getElementById('atk-cd');
  ui.msgEl = document.getElementById('msg');
  ui.gameoverEl = document.getElementById('gameover');
  ui.finalScoreEl = document.getElementById('final-score');
  ui.controlsEl = document.getElementById('controls');
  ui.modeBtn = document.getElementById('mode-btn');
  ui.enemyHpContainer = document.getElementById('enemyHpContainer');
  ui.weaponSlotEl = document.getElementById('weapon-slot');
  ui.wNameEl = document.getElementById('wName');
  ui.wAmmoEl = document.getElementById('wAmmo');
  ui.pickupTipEl = document.getElementById('pickup-tip');
  ui.buffsEl = document.getElementById('buffs');
  ui.dmgLayerEl = document.getElementById('dmg-layer');
  ui.settingsEl = document.getElementById('settings');

  // 设置面板
  const SETTINGS_KEY = 'starbrawl.display';
  try { Object.assign(game.settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch(e){}
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(game.settings)); } catch(e){} }

  const setHpBarEl = document.getElementById('setHpBar');
  const setHpNumEl = document.getElementById('setHpNum');
  const setDmgNumEl = document.getElementById('setDmgNum');
  setHpBarEl.checked = game.settings.hpBar;
  setHpNumEl.checked = game.settings.hpNum;
  setDmgNumEl.checked = game.settings.dmgNum;

  [[setHpBarEl,'hpBar'],[setHpNumEl,'hpNum'],[setDmgNumEl,'dmgNum']].forEach(([el,key]) => {
    el.addEventListener('change', () => { game.settings[key] = el.checked; saveSettings(); });
  });
}

// ════════════════════════════════════════════════
//  玩家
// ════════════════════════════════════════════════
function createPlayer(game) {
  const group = spawnInstance('宇航员');
  if (!group) return null;
  const gltf = modelCache['宇航员'];

  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  group.scale.setScalar(2.2 / maxDim);
  group.position.set(0, ARENA_GROUND_Y, 0);

  const mixer = new THREE.AnimationMixer(group);
  const animClips = {}, actions = {};
  const srcAnimations = gltf.animations || [];
  for (const [key, clipName] of Object.entries(ANIM_MAP['宇航员'])) {
    if (!clipName) continue;
    const clip = srcAnimations.find(a => a.name === clipName);
    if (clip) { animClips[key] = clip; actions[key] = mixer.clipAction(clip); }
  }
  if (actions.idle) actions.idle.play();

  game.scene.add(group);

  let handBone = null;
  group.traverse(c => { if (!handBone && c.isBone && /^R_Wrist/.test(c.name)) handBone = c; });

  return {
    group, mixer, actions,
    hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP,
    velocity: new THREE.Vector3(), onGround: true,
    attacking: false, attackTimer: 0, hurtTimer: 0, invincibleTimer: 0,
    yaw: 0, currentAnim: 'idle', knockback: new THREE.Vector3(),
    weapon: null, ammo: 0, gunMesh: null, shootTimer: 0,
    handBone, speedTimer: 0,
  };
}

// ════════════════════════════════════════════════
//  敌人
// ════════════════════════════════════════════════
function createEnemy(game, type) {
  const group = spawnInstance(type);
  if (!group) return null;
  const gltf = modelCache[type];
  const stats = ENEMY_STATS[type];

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.01);
  let baseScale = (stats.scale * 1.8) / maxDim;
  if (!isFinite(baseScale) || baseScale <= 0) baseScale = 0.5;
  if (baseScale > 5) baseScale = 5;
  group.scale.setScalar(baseScale);

  const angle = Math.random() * Math.PI * 2;
  const dist = ARENA_R * 0.65 + Math.random() * (ARENA_R * 0.25);
  const spawnY = stats.flying ? stats.flyHeight : ARENA_GROUND_Y;
  group.position.set(
    -center.x * baseScale + Math.cos(angle) * dist,
    -center.y * baseScale + spawnY,
    -center.z * baseScale + Math.sin(angle) * dist
  );
  group.lookAt(0, spawnY, 0);

  const mixer = new THREE.AnimationMixer(group);
  const animMap = ANIM_MAP[type];
  const animClips = {}, actions = {};
  const srcAnimations = gltf.animations || [];
  for (const [key, clipName] of Object.entries(animMap)) {
    if (!clipName) continue;
    const clip = srcAnimations.find(a => a.name === clipName);
    if (clip) { animClips[key] = clip; actions[key] = mixer.clipAction(clip); }
  }
  if (actions.idle) actions.idle.play();

  const hpEl = document.createElement('div');
  hpEl.className = 'enemy-hp';
  hpEl.innerHTML = '<div class="fill" style="width:100%"></div><div class="num"></div>';
  game.ui.enemyHpContainer.appendChild(hpEl);

  game.scene.add(group);

  return {
    group, mixer, actions, type,
    hp: stats.hp * (1 + (game.wave - 1) * 0.1),
    maxHp: stats.hp * (1 + (game.wave - 1) * 0.1),
    speed: stats.speed, damage: stats.damage,
    atkRange: stats.atkRange, atkCooldown: stats.atkCooldown,
    score: stats.score, flying: stats.flying || false,
    flyHeight: stats.flyHeight || 0, hitRadius: stats.hitRadius || 1.0,
    ranged: stats.ranged || false, projSpeed: stats.projSpeed || 16,
    projColor: stats.projColor || '#ff5a5a', keepDist: stats.keepDist || 0,
    state: 'chase', attackTimer: Math.random() * stats.atkCooldown,
    hurtTimer: 0, deathTimer: 0, currentAnim: 'idle',
    velocity: new THREE.Vector3(), _hpEl: hpEl,
  };
}

// ════════════════════════════════════════════════
//  武器模型构建
// ════════════════════════════════════════════════
function buildWeaponMesh(type) {
  if (type === 'heart') return buildHeartMesh();
  if (type === 'speed') return buildSpeedMesh();
  const cfg = WEAPONS[type];
  return cfg.kind === 'gun' ? buildGunMesh(type) : buildMeleeMesh(type);
}

function buildHeartMesh() {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0,-0.5); s.bezierCurveTo(0.6,0.15,0.95,0.75,0.45,1.0);
  s.bezierCurveTo(0.16,1.12,0.02,0.85,0,0.68);
  s.bezierCurveTo(-0.02,0.85,-0.16,1.12,-0.45,1.0);
  s.bezierCurveTo(-0.95,0.75,-0.6,0.15,0,-0.5);
  const geo = new THREE.ExtrudeGeometry(s, { depth:0.26, bevelEnabled:true, bevelThickness:0.07, bevelSize:0.07, bevelSegments:3, curveSegments:14 });
  geo.center();
  const mat = new THREE.MeshStandardMaterial({ color:HEART.color, roughness:0.3, metalness:0.25, emissive:HEART.color, emissiveIntensity:0.75 });
  const heart = new THREE.Mesh(geo, mat);
  heart.scale.setScalar(0.55); heart.castShadow = true; g.add(heart);
  const crossMat = new THREE.MeshStandardMaterial({ color:'#ffffff', roughness:0.4, metalness:0.1, emissive:'#ffdde3', emissiveIntensity:0.5 });
  const barH = new THREE.Mesh(new THREE.BoxGeometry(0.30,0.10,0.06), crossMat);
  const barV = new THREE.Mesh(new THREE.BoxGeometry(0.10,0.30,0.06), crossMat);
  barH.position.z = 0.17; barV.position.z = 0.17; g.add(barH, barV);
  return g;
}

function buildSpeedMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color:SPEED.color, roughness:0.3, metalness:0.5, emissive:SPEED.accent, emissiveIntensity:0.8 });
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.34,0.5,16), mat);
  head.position.y = 0.42; head.castShadow = true; g.add(head);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.17,0.5,0.17), mat);
  shaft.position.y = 0.02; shaft.castShadow = true; g.add(shaft);
  const lineMat = new THREE.MeshBasicMaterial({ color:SPEED.accent, transparent:true, opacity:0.75 });
  for (let i=0;i<3;i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.30-i*0.07,0.055,0.055), lineMat);
    line.position.set(0,-0.30-i*0.15,0); g.add(line);
  }
  return g;
}

function buildMeleeMesh(type) {
  const cfg = WEAPONS[type]; const g = new THREE.Group();
  const mainMat = new THREE.MeshStandardMaterial({ color:cfg.color, roughness:0.55, metalness:0.5 });
  const gripMat = new THREE.MeshStandardMaterial({ color:'#2a2a32', roughness:0.8, metalness:0.2 });
  const glowMat = new THREE.MeshStandardMaterial({ color:cfg.accent, roughness:0.35, metalness:0.6, emissive:cfg.accent, emissiveIntensity:0.7 });
  const box = (w,h,d,x,y,z,m,rz=0) => { const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); o.position.set(x,y,z); o.rotation.z=rz; o.castShadow=true; g.add(o); return o; };
  const cyl = (rt,rb,h,x,y,z,m,rx=Math.PI/2) => { const o=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,10),m); o.position.set(x,y,z); o.rotation.x=rx; o.castShadow=true; g.add(o); return o; };
  if (type==='棍子') { cyl(0.07,0.09,1.5,0,0,0.55,mainMat); cyl(0.10,0.10,0.22,0,0,-0.10,gripMat); cyl(0.11,0.09,0.14,0,0,1.26,glowMat); }
  else if (type==='撬棒') { cyl(0.055,0.055,1.5,0,0,0.55,mainMat); cyl(0.09,0.09,0.24,0,0,-0.12,gripMat); box(0.10,0.30,0.10,0,0.12,1.30,mainMat); box(0.10,0.10,0.26,0,0.24,1.42,glowMat); }
  else if (type==='太空扳手') { cyl(0.075,0.075,1.25,0,0,0.45,mainMat); cyl(0.11,0.11,0.26,0,0,-0.14,gripMat); box(0.34,0.16,0.16,0,0,1.12,mainMat); box(0.13,0.16,0.30,-0.11,0,1.32,mainMat); box(0.13,0.16,0.30,0.11,0,1.32,glowMat); }
  else if (type==='尖叫鸡') {
    const bkMat = new THREE.MeshStandardMaterial({ color:'#ff8c1a', roughness:0.6, metalness:0.1 });
    const sph = (r,x,y,z,m,sx=1,sy=1,sz=1) => { const o=new THREE.Mesh(new THREE.SphereGeometry(r,12,10),m); o.position.set(x,y,z); o.scale.set(sx,sy,sz); o.castShadow=true; g.add(o); return o; };
    cyl(0.05,0.06,0.55,0,0,0.02,bkMat); sph(0.26,0,0.05,0.62,mainMat,1,1.1,1.5);
    sph(0.17,0,0.28,1.02,mainMat); box(0.10,0.12,0.22,0,0.30,1.24,bkMat);
    sph(0.05,-0.07,0.40,1.12,glowMat); sph(0.05,0.07,0.40,1.12,glowMat);
    sph(0.14,0,0.16,0.28,mainMat,1,1.3,0.7);
  }
  g.scale.setScalar(1.5); return g;
}

function buildGunMesh(type) {
  const cfg = WEAPONS[type]; const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color:cfg.color, roughness:0.45, metalness:0.75 });
  const darkMat = new THREE.MeshStandardMaterial({ color:'#22222c', roughness:0.6, metalness:0.5 });
  const glowMat = new THREE.MeshStandardMaterial({ color:cfg.accent, roughness:0.3, metalness:0.6, emissive:cfg.accent, emissiveIntensity:0.9 });
  const box = (w,h,d,x,y,z,m) => { const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); o.position.set(x,y,z); o.castShadow=true; g.add(o); return o; };
  box(0.16,0.20,0.55,0,0,0.05,bodyMat); box(0.13,0.26,0.14,0,-0.20,-0.10,darkMat);
  if (type==='手枪') { box(0.09,0.10,0.34,0,0.02,0.40,darkMat); box(0.10,0.06,0.10,0,0.13,0.10,glowMat); }
  else if (type==='步枪') { box(0.08,0.08,0.72,0,0.02,0.60,darkMat); box(0.12,0.09,0.24,0,0.16,0.14,darkMat); box(0.10,0.24,0.12,0,-0.18,0.16,darkMat); box(0.14,0.05,0.14,0,0.22,0.14,glowMat); }
  else if (type==='霰弹枪') { box(0.09,0.09,0.80,-0.05,0.02,0.62,darkMat); box(0.09,0.09,0.80,0.05,0.02,0.62,darkMat); box(0.20,0.12,0.30,0,-0.06,0.22,bodyMat); box(0.18,0.05,0.10,0,0.13,0.05,glowMat); }
  else if (type==='等离子炮') { box(0.22,0.22,0.60,0,0.02,0.52,bodyMat); for(let i=0;i<3;i++){const r=new THREE.Mesh(new THREE.TorusGeometry(0.17,0.035,8,20),glowMat);r.position.set(0,0.02,0.38+i*0.20);g.add(r);} box(0.10,0.10,0.16,0,0.19,0.20,glowMat); }
  g.scale.setScalar(1.5); return g;
}

// ════════════════════════════════════════════════
//  掉落物
// ════════════════════════════════════════════════
function spawnDrop(game, type, position) {
  const cfg = itemCfg(type);
  const group = new THREE.Group();
  const mesh = buildWeaponMesh(type);
  mesh.position.y = 0.15; group.add(mesh);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.45,0.62,28), new THREE.MeshBasicMaterial({ color:cfg.accent, transparent:true, opacity:0.55, side:THREE.DoubleSide }));
  ring.rotation.x = -Math.PI/2; ring.position.y = 0.03; group.add(ring);
  const light = new THREE.PointLight(cfg.accent, 6, 4); light.position.y = 0.5; group.add(light);
  const ox = position.x + (Math.random()-0.5)*1.2, oz = position.z + (Math.random()-0.5)*1.2;
  const d = Math.sqrt(ox*ox+oz*oz), limit = ARENA_R-1.5;
  const k = d > limit ? limit/d : 1;
  group.position.set(ox*k, ARENA_GROUND_Y+0.35, oz*k);
  game.scene.add(group);
  game.drops.push({ group, gun:mesh, ring, type, age:0, baseY:ARENA_GROUND_Y+0.35, spin:Math.random()*Math.PI*2 });
  showMsg(game, `${cfg.label} 掉落！`, cfg.accent);
}

function removeDrop(game, idx) {
  const d = game.drops[idx]; if (!d) return;
  game.scene.remove(d.group); disposeGroup(d.group);
  game.drops.splice(idx, 1);
}

// ════════════════════════════════════════════════
//  武器装备
// ════════════════════════════════════════════════
function equipWeapon(game, type) {
  const p = game.player; if (!p) return;
  unequipWeapon(game);
  const cfg = WEAPONS[type];
  p.weapon = type; p.ammo = cfg.kind==='gun' ? cfg.ammo : cfg.uses; p.shootTimer = 0;
  p.gunMesh = buildWeaponMesh(type); game.scene.add(p.gunMesh);
  showMsg(game, `拾取 ${cfg.label}`, cfg.accent);
}

function unequipWeapon(game) {
  const p = game.player; if (!p || !p.gunMesh) return;
  game.scene.remove(p.gunMesh); disposeGroup(p.gunMesh);
  p.gunMesh = null; p.weapon = null; p.ammo = 0;
}

function consumeWeaponUse(game) {
  const p = game.player;
  p.ammo--;
  if (p.ammo <= 0) {
    const wasGun = WEAPONS[p.weapon].kind === 'gun';
    unequipWeapon(game);
    showMsg(game, wasGun ? '弹药耗尽，切回拳头' : '武器损坏，切回拳头', '#ff6b6b');
  }
}

const _handPos = new THREE.Vector3();
function updateGunTransform(game) {
  const p = game.player;
  if (!p || !p.gunMesh) return;
  const yaw = p.group.rotation.y;
  if (p.handBone) {
    p.handBone.getWorldPosition(_handPos);
    _handPos.x += Math.sin(yaw)*0.18; _handPos.z += Math.cos(yaw)*0.18;
    p.gunMesh.position.copy(_handPos);
  } else {
    p.gunMesh.position.set(
      p.group.position.x+Math.cos(yaw)*0.55+Math.sin(yaw)*0.25,
      p.group.position.y+1.5,
      p.group.position.z-Math.sin(yaw)*0.55+Math.cos(yaw)*0.25
    );
  }
  p.gunMesh.rotation.y = yaw;
}

function getMuzzleWorld(game) {
  const p = game.player;
  if (p.gunMesh) {
    updateGunTransform(game); p.gunMesh.updateMatrixWorld(true);
    const local = MUZZLE_LOCAL[p.weapon] || new THREE.Vector3(0,0,0.6);
    return p.gunMesh.localToWorld(local.clone());
  }
  return p.group.position.clone().setY(p.group.position.y+1.15);
}

function getBulletOrigin(game) {
  const o = game.player.group.position.clone();
  o.y += BULLET_ORIGIN_Y;
  return o;
}

// ════════════════════════════════════════════════
//  战斗系统
// ════════════════════════════════════════════════
function getAimDirection(game, originPos) {
  const p = game.player;
  const yaw = p.group.rotation.y;
  const baseDir = new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)).normalize();
  let best=null, bestScore=Infinity;
  for (const e of game.enemies) {
    if (e.state==='dead') continue;
    const c = getEnemyCenter(e), toE = c.clone().sub(originPos);
    const dist = toE.length(); if (dist<0.001 || dist>40) continue;
    const flatTo = new THREE.Vector3(toE.x,0,toE.z);
    if (flatTo.lengthSq()<0.0001) continue; flatTo.normalize();
    const angle = Math.acos(Math.max(-1,Math.min(1, flatTo.dot(baseDir))));
    if (angle>AIM_ASSIST_ANGLE) continue;
    const sv = angle*10+dist*0.05; if (sv<bestScore) { bestScore=sv; best=toE.normalize(); }
  }
  return best || baseDir;
}

function meleeAttack(game, cfg) {
  const p = game.player;
  p.attacking = true; p.attackTimer = cfg.cooldown;
  const attackYaw = p.group.rotation.y;
  if (p.actions.attack) { p.actions.attack.reset().play(); p.currentAnim='attack';
    setTimeout(() => { if(p.currentAnim==='attack'){p.currentAnim='idle'; crossfadeAnim(p,'idle');} }, 600); }
  spawnAttackEffect(game, p.group.position.clone(), attackYaw, cfg.accent);
  const pPos = new THREE.Vector3(p.group.position.x, p.group.position.y+1, p.group.position.z);
  let hitAny = false;
  for (const e of game.enemies) {
    if (e.state==='dead') continue;
    const ePos = e.group.position.clone(); ePos.y+=1;
    const r = isInAttackCone(pPos, attackYaw, ePos, cfg.range, cfg.angle);
    if (r.hit) { damageEnemy(game, e, cfg.damage, new THREE.Vector3(ePos.x-pPos.x,0,ePos.z-pPos.z), cfg.knockback); hitAny=true; }
  }
  if (hitAny && p.weapon) consumeWeaponUse(game);
}

function fireWeapon(game) {
  const p = game.player;
  const cfg = WEAPONS[p.weapon]; if (!cfg) return;
  p.shootTimer = cfg.cooldown; consumeWeaponUse(game);
  const origin = getBulletOrigin(game), aim = getAimDirection(game, origin);
  if (Math.abs(aim.x)>0.001 || Math.abs(aim.z)>0.001) { p.yaw = Math.atan2(aim.x,aim.z); p.group.rotation.y = p.yaw; }
  const muzzle = getMuzzleWorld(game);
  const up=new THREE.Vector3(0,1,0), side=new THREE.Vector3().crossVectors(aim,up).normalize();
  if (side.lengthSq()<0.001) side.set(1,0,0);
  const vert = new THREE.Vector3().crossVectors(side,aim).normalize();
  for (let i=0;i<cfg.pellets;i++) {
    const dir=aim.clone();
    if (cfg.spread>0){dir.addScaledVector(side,(Math.random()-0.5)*2*cfg.spread);dir.addScaledVector(vert,(Math.random()-0.5)*2*cfg.spread);dir.normalize();}
    spawnBullet(game, origin.clone(), dir, cfg);
  }
  spawnMuzzleFlash(game, muzzle, cfg.accent);
}

function spawnBullet(game, pos, dir, cfg) {
  const mat = new THREE.MeshBasicMaterial({ color:cfg.bulletColor });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(cfg.bulletSize,8,8), mat);
  mesh.position.copy(pos);
  const trail = new THREE.Mesh(new THREE.CylinderGeometry(cfg.bulletSize*0.5,cfg.bulletSize*0.9,1.1,6), new THREE.MeshBasicMaterial({ color:cfg.bulletColor, transparent:true, opacity:0.35 }));
  trail.rotation.x=Math.PI/2; trail.position.z=-0.6; mesh.add(trail);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), dir.clone().normalize());
  game.scene.add(mesh);
  game.bullets.push({ mesh, dir:dir.clone().normalize(), speed:cfg.speed, damage:cfg.damage, knockback:cfg.knockback, radius:cfg.bulletSize, pierce:cfg.pierce, age:0, hitSet:new Set() });
}

function spawnMuzzleFlash(game, pos, color) {
  const m=new THREE.Mesh(new THREE.SphereGeometry(0.22,8,8), new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.95 }));
  m.position.copy(pos); game.scene.add(m);
  game.effects.push({ mesh:m, life:0.09, age:0 });
}

function spawnEnemyBullet(game, fromPos, dir, speed, damage, color) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22,10,10), new THREE.MeshBasicMaterial({ color }));
  mesh.position.copy(fromPos);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.34,10,10), new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.35 }));
  mesh.add(glow); game.scene.add(mesh);
  game.enemyBullets.push({ mesh, dir:dir.clone().normalize(), speed, damage, radius:0.3, age:0 });
}

function damageEnemy(game, enemy, damage, dirVec, knockback=3) {
  if (!enemy || enemy.state==='dead') return false;
  damage *= playerDamageMult(game);
  enemy.hp -= damage; enemy.state='hurt'; enemy.hurtTimer=0.4;
  if (dirVec) { const kb=new THREE.Vector3(dirVec.x,0,dirVec.z); if(kb.lengthSq()>0.0001){kb.normalize().multiplyScalar(knockback*0.02); enemy.group.position.x+=kb.x; enemy.group.position.z+=kb.z;} }
  const hitPos=enemy.group.position.clone(); hitPos.y+=1; spawnHitEffect(game, hitPos);
  spawnDamageNumber(game, hitPos.clone().setY(hitPos.y+0.8), damage, enemy.hp<=0 ? '#ff4757':'#ffd700', enemy.hp<=0);
  if (enemy.actions.hurt) enemy.actions.hurt.reset().play();
  if (enemy.hp<=0) { enemy.state='dead'; enemy.deathTimer=1.0; if(enemy._hpEl)enemy._hpEl.style.display='none';
    if(enemy.actions.death){enemy.actions.death.reset().play();} Object.values(enemy.actions).forEach(a=>{if(a!==enemy.actions.death)a.stop();});
    onEnemyKilled(game, enemy); return true; }
  return false;
}

// ════════════════════════════════════════════════
//  特效 / 消息 / HUD
// ════════════════════════════════════════════════
function spawnAttackEffect(game, pos, yaw, color) {
  const eff = new THREE.Mesh(new THREE.TorusGeometry(1.0,0.08,8,16,Math.PI*0.8), new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.8 }));
  eff.position.copy(pos); eff.position.y+=1.0; eff.rotation.x=-Math.PI/2; eff.rotation.z=yaw+Math.PI;
  game.scene.add(eff); game.effects.push({ mesh:eff, life:0.25, age:0 });
}

function spawnHitEffect(game, pos) {
  const eff = new THREE.Mesh(new THREE.SphereGeometry(0.3,8,8), new THREE.MeshBasicMaterial({ color:'#ff4444', transparent:true, opacity:0.9 }));
  eff.position.copy(pos); eff.position.y+=1.0; game.scene.add(eff);
  game.effects.push({ mesh:eff, life:0.2, age:0 });
}

function showMsg(game, text, color='#ffd700') {
  game.ui.msgEl.textContent=text; game.ui.msgEl.style.color=color; game.ui.msgEl.classList.add('show');
  clearTimeout(game.msgTimer); game.msgTimer=setTimeout(()=>game.ui.msgEl.classList.remove('show'),1500);
}

// ── 伤害数字 ──
const dmgNumbers=[];
function spawnDamageNumber(game, worldPos, amount, color='#ffd700', big=false) {
  if (!game.settings.dmgNum) return;
  const el=document.createElement('div'); el.className=big?'dmg crit':'dmg';
  el.textContent=(amount>0?'-':'+')+Math.abs(Math.round(amount)); el.style.color=color;
  game.ui.dmgLayerEl.appendChild(el);
  dmgNumbers.push({ el, pos:worldPos.clone(), drift:(Math.random()-0.5)*0.9, life:0.9, age:0 });
}

function updateDamageNumbers(game, dt) {
  for (let i=dmgNumbers.length-1;i>=0;i--) {
    const n=dmgNumbers[i]; n.age+=dt; const t=n.age/n.life;
    if (t>=1){n.el.remove();dmgNumbers.splice(i,1);continue;}
    const p=n.pos.clone(); p.y+=t*1.5; p.x+=n.drift*t;
    const proj=p.project(game.camera);
    if(proj.z>1){n.el.style.display='none';continue;}
    n.el.style.display=''; n.el.style.left=((proj.x*0.5+0.5)*game.renderer.domElement.clientWidth)+'px';
    n.el.style.top=((-proj.y*0.5+0.5)*game.renderer.domElement.clientHeight)+'px';
    n.el.style.opacity=String(Math.max(0,1-t*t));
  }
}

// ════════════════════════════════════════════════
//  波次 / 击杀
// ════════════════════════════════════════════════
function spawnWave(game) {
  game.enemies.forEach(e=>{game.scene.remove(e.group);if(e._hpEl)e._hpEl.remove();});
  game.enemies=[];
  game.waveTotalEnemies=1+game.wave; game.waveEnemiesRemaining=game.waveTotalEnemies;
  for (let i=0;i<game.waveTotalEnemies;i++) {
    const ti=Math.floor(Math.random()*Math.min(ENEMY_TYPES.length,1+game.wave));
    const type=ENEMY_TYPES[Math.min(ti,ENEMY_TYPES.length-1)];
    const e=createEnemy(game,type); if(e)game.enemies.push(e);
  }
  showMsg(game, `🌊 第 ${game.wave} 波 开始！`, '#00d4ff');
}

function onEnemyKilled(game, enemy) {
  game.score+=enemy.score;
  if (updatePlayerLevel(game)) showMsg(game, `⬆️ 升到 ${game.playerLevel} 级！伤害 +${Math.round((playerDamageMult(game)-1)*100)}%`, '#ffd700');
  spawnHitEffect(game, enemy.group.position.clone());
  game.waveEnemiesRemaining--;
  const roll=Math.random();
  if (roll<MELEE_DROP_CHANCE) spawnDrop(game, MELEE_NAMES[Math.floor(Math.random()*MELEE_NAMES.length)], enemy.group.position.clone());
  else if (roll<MELEE_DROP_CHANCE+GUN_DROP_CHANCE) spawnDrop(game, GUN_NAMES[Math.floor(Math.random()*GUN_NAMES.length)], enemy.group.position.clone());
  const lowHp=game.player&&game.player.hp<game.player.maxHp*0.4;
  if (Math.random()<(lowHp?HEART_CHANCE_LOW_HP:HEART_CHANCE)) spawnDrop(game,'heart',enemy.group.position.clone());
  if (Math.random()<SPEED_CHANCE) spawnDrop(game,'speed',enemy.group.position.clone());
  if (game.waveEnemiesRemaining<=0) { setTimeout(()=>{game.wave++;spawnWave(game);},2000); showMsg(game,'✨ 波次清除！','#ffd700'); }
}

function updatePlayerLevel(game) {
  let leveled=false;
  while(game.score>=scoreForLevel(game.playerLevel+1)){game.playerLevel++;leveled=true;}
  return leveled;
}

// ════════════════════════════════════════════════
//  动画
// ════════════════════════════════════════════════
export function crossfadeAnim(entity, targetKey, duration=0.15) {
  if (!entity.actions[targetKey]) return;
  for (const [key,action] of Object.entries(entity.actions)) {
    if (key===targetKey) action.reset().fadeIn(duration).play();
    else if (action.isRunning()) action.fadeOut(duration);
  }
  entity.currentAnim=targetKey;
}

// ════════════════════════════════════════════════
//  相机
// ════════════════════════════════════════════════
const CAM_MIN_DIST=3, CAM_MAX_DIST=18, CAM_ELEV_MIN=0.1, CAM_ELEV_MAX=1.2, CAM_SMOOTH=8;
const CAM_ROT_SPEED=2.2, CAM_ZOOM_SPEED=12;

export function updateCameraInput(game, dt) {
  if (game.keys['KeyQ']) game.camAzimuth+=CAM_ROT_SPEED*dt;
  if (game.keys['KeyE']) game.camAzimuth-=CAM_ROT_SPEED*dt;
  if (game.keys['KeyZ']) game.camDistance=Math.max(CAM_MIN_DIST, game.camDistance-CAM_ZOOM_SPEED*dt);
  if (game.keys['KeyX']) game.camDistance=Math.min(CAM_MAX_DIST, game.camDistance+CAM_ZOOM_SPEED*dt);
}

export function updateCamera(game, dt) {
  updateCameraInput(game, dt);
  const targetPos=new THREE.Vector3(0,1.2,0);
  if (game.player) { targetPos.copy(game.player.group.position); targetPos.y+=1.2; }
  game.cameraCurrent.lerp(targetPos, dt*CAM_SMOOTH);
  const cx=game.cameraCurrent.x+Math.sin(game.camAzimuth)*Math.cos(game.camElevation)*game.camDistance;
  const cy=game.cameraCurrent.y+Math.sin(game.camElevation)*game.camDistance;
  const cz=game.cameraCurrent.z+Math.cos(game.camAzimuth)*Math.cos(game.camElevation)*game.camDistance;
  game.camera.position.lerp(new THREE.Vector3(cx,cy,cz), dt*CAM_SMOOTH);
  game.camera.lookAt(game.cameraCurrent);
}

export function getCameraForwardRight(game) {
  const f=new THREE.Vector3(-Math.sin(game.camAzimuth),0,-Math.cos(game.camAzimuth)).normalize();
  const r=new THREE.Vector3(Math.cos(game.camAzimuth),0,-Math.sin(game.camAzimuth)).normalize();
  return { forward:f, right:r };
}

// ════════════════════════════════════════════════
//  游戏主循环
// ════════════════════════════════════════════════
export function updateGame(game, dt) {
  const p=game.player; if (!p||game.gameOver) return;
  dt=Math.min(dt,0.1);

  const input=getInputDir(game);
  p.speedTimer=Math.max(0, p.speedTimer-dt);
  const boostMult=p.speedTimer>0?SPEED.multiplier:1;
  const runMult=(game.keys['ShiftLeft']||game.keys['ShiftRight'])?RUN_MULTIPLIER:1;

  const { forward, right } = getCameraForwardRight(game);
  const moveSpeed=PLAYER_SPEED*boostMult*runMult;
  const mwx=(input.dx*right.x+(-input.dz)*forward.x)*moveSpeed;
  const mwz=(input.dx*right.z+(-input.dz)*forward.z)*moveSpeed;

  if (input.len>0.2) p.yaw=Math.atan2(mwx,mwz);
  p.group.rotation.y=p.yaw;

  p.attackTimer-=dt; p.shootTimer-=dt;
  const wcfg=currentWeaponCfg(p);
  if (wcfg.kind==='gun') {
    const wantFire=wcfg.auto?(game.keys['KeyJ']||game.justPressed['KeyJ']):game.justPressed['KeyJ'];
    if (wantFire&&p.shootTimer<=0&&p.ammo>0) fireWeapon(game);
  } else if (game.justPressed['KeyJ']&&p.attackTimer<=0) meleeAttack(game, wcfg);

  const spd=p.attacking?0.3:1.0;
  p.velocity.x=mwx*spd+p.knockback.x; p.velocity.z=mwz*spd+p.knockback.z;
  p.knockback.multiplyScalar(Math.max(0,1-dt*8));

  if (game.justPressed['Space']&&p.onGround){p.velocity.y=PLAYER_JUMP_VEL;p.onGround=false;if(p.actions.jump)p.actions.jump.reset().play();}
  if (!p.onGround) p.velocity.y-=GRAVITY*dt;
  p.group.position.x+=p.velocity.x*dt; p.group.position.y+=p.velocity.y*dt; p.group.position.z+=p.velocity.z*dt;
  if (p.group.position.y<=ARENA_GROUND_Y){p.group.position.y=ARENA_GROUND_Y;p.velocity.y=0;p.onGround=true;}
  const pDist=Math.sqrt(p.group.position.x**2+p.group.position.z**2);
  if (pDist>ARENA_R-1){const c=(ARENA_R-1)/pDist;p.group.position.x*=c;p.group.position.z*=c;}

  // 动画状态机
  if (p.currentAnim!=='attack'||(p.currentAnim==='attack'&&p.attackTimer<0.1)) {
    if (!p.onGround) { if(p.currentAnim!=='jump')crossfadeAnim(p,'jump'); }
    else if (input.len>0.2) { if(p.currentAnim!=='move')crossfadeAnim(p,'move'); }
    else { if(p.currentAnim!=='idle')crossfadeAnim(p,'idle'); }
  }
  p.invincibleTimer-=dt; p.hurtTimer-=dt;
  p.group.visible = p.hurtTimer>0 ? Math.floor(p.hurtTimer*20)%2===0 : true;
  if (p.attackTimer<=0) p.attacking=false;

  // ── 敌人更新 ──
  const pPos=p.group.position.clone(); pPos.y+=1;
  for (const e of game.enemies) {
    if (e.state==='dead'){e.deathTimer-=dt;if(e.deathTimer<=0)e.group.visible=false;if(e.group.position.y>ARENA_GROUND_Y-2)e.group.position.y-=dt*3;continue;}
    const ePos=e.group.position.clone(); ePos.y+=1;
    const dx=pPos.x-ePos.x, dz=pPos.z-ePos.z, dist=Math.sqrt(dx*dx+dz*dz);
    if (e.state==='hurt'){e.hurtTimer-=dt;if(e.hurtTimer<=0)e.state='chase';e.group.visible=Math.floor(e.hurtTimer*20)%2===0;e.mixer.update(dt);continue;}
    if (e.state==='attack'){e._attackAnimTimer-=dt;if(e._attackAnimTimer<=0)e.state='chase';}
    e.group.visible=true;
    if (dist>0.1){const yaw=Math.atan2(dx,dz);e.group.rotation.y=yaw;}
    e.attackTimer-=dt;
    if (dist<=e.atkRange){
      if(e.attackTimer<=0){e.state='attack';e.attackTimer=e.atkCooldown;e._attackAnimTimer=0.6;
        let atkAnim=e.actions.attack;
        if(e.type==='恐龙'&&e.actions.attack2&&Math.random()<0.5)atkAnim=e.actions.attack2;
        if(atkAnim)atkAnim.reset().play();
        spawnAttackEffect(game,e.group.position.clone(),e.group.rotation.y,'#ff4444');
        if(e.ranged){const from=e.group.position.clone();from.y+=0.6;const target=p.group.position.clone();target.y+=1;spawnEnemyBullet(game,from,target.sub(from).normalize(),e.projSpeed,e.damage,e.projColor);}
        else if(p.invincibleTimer<=0){p.hp-=e.damage;p.invincibleTimer=0.5;p.hurtTimer=0.5;
          const kbDir=new THREE.Vector3(pPos.x-ePos.x,0,pPos.z-ePos.z).normalize();p.knockback.set(kbDir.x*5,3,kbDir.z*5);
          spawnHitEffect(game,pPos);spawnDamageNumber(game,pPos.clone().setY(pPos.y+0.9),e.damage,'#ff4757');
          if(p.hp<=0){p.hp=0;onPlayerDeath(game);}}
      }else{if(e.currentAnim!=='idle'&&e.actions.idle)crossfadeAnim(e,'idle');}
    }else{e.state='chase';
      e.group.position.x+=(dx/dist)*e.speed*dt;e.group.position.z+=(dz/dist)*e.speed*dt;
      if(e.flying)e.group.position.y+=(e.flyHeight-e.group.position.y)*dt*3;else e.group.position.y=ARENA_GROUND_Y;
      if(e.actions.move&&e.currentAnim!=='move')crossfadeAnim(e,'move');}
    if(e.ranged&&e.keepDist>0&&dist<e.keepDist&&dist>0.1){e.group.position.x+=-(dx/dist)*e.speed*dt;e.group.position.z+=-(dz/dist)*e.speed*dt;if(e.flying)e.group.position.y+=(e.flyHeight-e.group.position.y)*dt*3;}
    const eDist=Math.sqrt(e.group.position.x**2+e.group.position.z**2);
    if(eDist>ARENA_R-1){const c=(ARENA_R-1)/eDist;e.group.position.x*=c;e.group.position.z*=c;}
  }

  updateGunTransform(game);
  updateBullets(game, dt);
  updateEnemyBullets(game, dt);
  updateDrops(game, dt);
}

// ── 输入方向 ──
function getInputDir(game) {
  let dx=0,dz=0;
  if(game.keys['KeyW']||game.keys['ArrowUp'])dz-=1;
  if(game.keys['KeyS']||game.keys['ArrowDown'])dz+=1;
  if(game.keys['KeyA']||game.keys['ArrowLeft'])dx-=1;
  if(game.keys['KeyD']||game.keys['ArrowRight'])dx+=1;
  const len=Math.sqrt(dx*dx+dz*dz);
  return { dx:len>1?dx/len:dx, dz:len>1?dz/len:dz, len:Math.min(len,1) };
}

// ── 子弹更新 ──
function updateBullets(game, dt) {
  for (let i=game.bullets.length-1;i>=0;i--){const b=game.bullets[i];b.age+=dt;if(b.age>BULLET_LIFETIME){removeBullet(game,i);continue;}
    const total=b.speed*dt, steps=Math.max(1,Math.ceil(total/0.4)), stepLen=total/steps;let dead=false;
    for(let s=0;s<steps&&!dead;s++){b.mesh.position.addScaledVector(b.dir,stepLen);const bp=b.mesh.position;
      for(const e of game.enemies){if(e.state==='dead'||b.hitSet.has(e))continue;
        const c=getEnemyCenter(e);if(c.distanceToSquared(bp)<=(e.hitRadius+b.radius)**2){b.hitSet.add(e);damageEnemy(game,e,b.damage,b.dir,b.knockback);if(b.pierce>0)b.pierce--;else dead=true;break;}}
      if(!dead){const h=Math.sqrt(bp.x*bp.x+bp.z*bp.z);if(h>ARENA_R+6||bp.y<ARENA_GROUND_Y-1.0||bp.y>30)dead=true;}}
    if(dead)removeBullet(game,i);}
}

function updateEnemyBullets(game, dt) {
  if(!game.player)return;
  for(let i=game.enemyBullets.length-1;i>=0;i--){const b=game.enemyBullets[i];b.age+=dt;if(b.age>BULLET_LIFETIME){removeEnemyBullet(game,i);continue;}
    const total=b.speed*dt, steps=Math.max(1,Math.ceil(total/0.4)), stepLen=total/steps;let dead=false;
    for(let s=0;s<steps&&!dead;s++){b.mesh.position.addScaledVector(b.dir,stepLen);const bp=b.mesh.position;
      const pc=game.player.group.position.clone();pc.y+=1;
      if(!game.gameOver&&pc.distanceToSquared(bp)<=(0.7+b.radius)**2){
        if(game.player.invincibleTimer<=0){game.player.hp-=b.damage;game.player.invincibleTimer=0.4;game.player.hurtTimer=0.4;
          spawnHitEffect(game,pc);spawnDamageNumber(game,pc.clone().setY(pc.y+0.9),b.damage,'#ff4757');
          if(game.player.hp<=0){game.player.hp=0;onPlayerDeath(game);}}dead=true;break;}
      const h=Math.sqrt(bp.x*bp.x+bp.z*bp.z);if(h>ARENA_R+6||bp.y<ARENA_GROUND_Y-1.0||bp.y>30)dead=true;}
    if(dead)removeEnemyBullet(game,i);}
}

function removeBullet(game, idx){const b=game.bullets[idx];if(!b)return;game.scene.remove(b.mesh);disposeGroup(b.mesh);game.bullets.splice(idx,1);}
function removeEnemyBullet(game, idx){const b=game.enemyBullets[idx];if(!b)return;game.scene.remove(b.mesh);disposeGroup(b.mesh);game.enemyBullets.splice(idx,1);}

// ── 掉落物更新 ──
function updateDrops(game, dt) {
  const p=game.player; let autoTarget=null, autoDist=Infinity, nearest=null, nearestDist=Infinity;
  const canAutoPick=(type)=>{const cfg=itemCfg(type);if(cfg.kind==='heart')return p.hp<p.maxHp;if(cfg.kind==='melee'||cfg.kind==='gun')return !p.weapon;return true;};
  for(let i=game.drops.length-1;i>=0;i--){const d=game.drops[i];d.age+=dt;if(d.age>DROP_LIFETIME){removeDrop(game,i);continue;}
    d.group.visible=(DROP_LIFETIME-d.age)>5?true:Math.floor((DROP_LIFETIME-d.age)*6)%2===0;
    d.spin+=dt*1.6;d.gun.rotation.y=d.spin;d.group.position.y=d.baseY+Math.sin(d.age*2.2)*0.12;d.ring.rotation.z+=dt*0.8;
    if(!p)continue;const dist=Math.hypot(d.group.position.x-p.group.position.x,d.group.position.z-p.group.position.z);
    if(dist<nearestDist){nearestDist=dist;nearest=d;}if(canAutoPick(d.type)&&dist<autoDist){autoDist=dist;autoTarget=d;}}
  const pickUp=(d)=>{const idx=game.drops.indexOf(d);
    if(d.type==='heart'){const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+HEART.heal);showMsg(game,`❤️ +${Math.round(p.hp-before)} 生命`,HEART.accent);const hp=p.group.position.clone();hp.y+=2.0;spawnDamageNumber(game,hp,-(p.hp-before),'#3ddc84');}
    else if(d.type==='speed'){p.speedTimer=SPEED.duration;showMsg(game,`🏹 加速 ${SPEED.duration} 秒！`,SPEED.accent);}
    else equipWeapon(game,d.type);
    if(idx>=0)removeDrop(game,idx);game.ui.pickupTipEl.style.display='none';};
  if(autoTarget&&autoDist<DROP_PICKUP_RANGE)pickUp(autoTarget);
  else if(nearest&&nearestDist<4.5){const cfg=itemCfg(nearest.type),isWpn=cfg.kind==='melee'||cfg.kind==='gun',full=nearest.type==='heart'&&p.hp>=p.maxHp;
    game.ui.pickupTipEl.innerHTML=full?`${cfg.label} · 生命已满`:isWpn&&p.weapon?`${cfg.label} · 按 <span style="color:#fff">F</span> 更换武器`:`${cfg.label} · 走近或按 <span style="color:#fff">F</span> 拾取`;
    game.ui.pickupTipEl.style.display='block';if(game.justPressed['KeyF'])pickUp(nearest);}
  else game.ui.pickupTipEl.style.display='none';
}

// ════════════════════════════════════════════════
//  玩家死亡 / 波次管理
// ════════════════════════════════════════════════
function onPlayerDeath(game) { game.gameOver=true; game.ui.finalScoreEl.textContent=game.score; game.ui.gameoverEl.classList.add('show'); game.gameRunning=false; }

// ════════════════════════════════════════════════
//  开始 / 退出游戏
// ════════════════════════════════════════════════
export function startGame(game) {
  if (game.previewModel){game.scene.remove(game.previewModel);game.previewModel=null;}
  if (game.previewMixer){game.previewMixer.stopAllAction();game.previewMixer=null;}
  game.enemies.forEach(e=>game.scene.remove(e.group)); game.enemies=[];
  if(game.player){unequipWeapon(game);game.scene.remove(game.player.group);game.player=null;}
  game.drops.forEach(d=>{game.scene.remove(d.group);disposeGroup(d.group);}); game.drops=[];
  game.bullets.forEach(b=>{game.scene.remove(b.mesh);disposeGroup(b.mesh);}); game.bullets=[];
  game.enemyBullets.forEach(b=>{game.scene.remove(b.mesh);disposeGroup(b.mesh);}); game.enemyBullets=[];
  game.effects.forEach(e=>{game.scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();}); game.effects=[];
  game.ui.enemyHpContainer.innerHTML='';

  game.score=0; game.wave=1; game.playerLevel=1; game.gameOver=false; game.gameRunning=true;
  game.player=createPlayer(game); if(!game.player)return;
  placeSunSystem(game);
  spawnWave(game);
  game.ui.hudEl.style.display='block'; game.ui.controlsEl.style.display='block';
  game.ui.enemyHpContainer.style.display='block'; game.ui.weaponSlotEl.style.display='block';
  game.ui.dmgLayerEl.style.display=game.settings.dmgNum?'block':'none';
  game.ui.gameoverEl.classList.remove('show'); game.ui.modeBtn.textContent='🔍 退出格斗';
  game.camDistance=CAM_MAX_DIST; game.camElevation=0.7; game.camAzimuth=Math.PI;
  game.cameraCurrent.set(game.player.group.position.x+5,5,game.player.group.position.z+5);
  game.camera.position.copy(game.cameraCurrent);
}

export function restartGame(game) { startGame(game); }

export function exitGame(game) {
  game.gameRunning=false;
  game.enemies.forEach(e=>game.scene.remove(e.group)); game.enemies=[];
  if(game.player){unequipWeapon(game);game.scene.remove(game.player.group);game.player=null;}
  if(game.sunSystem){game.scene.remove(game.sunSystem);game.sunSystem=null;}
  game.drops.forEach(d=>{game.scene.remove(d.group);disposeGroup(d.group);}); game.drops=[];
  game.bullets.forEach(b=>{game.scene.remove(b.mesh);disposeGroup(b.mesh);}); game.bullets=[];
  game.enemyBullets.forEach(b=>{game.scene.remove(b.mesh);disposeGroup(b.mesh);}); game.enemyBullets=[];
  game.effects.forEach(e=>{game.scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();}); game.effects=[];
  dmgNumbers.forEach(n=>n.el.remove()); dmgNumbers.length=0;
  game.ui.enemyHpContainer.innerHTML=''; game.ui.enemyHpContainer.style.display='none';
  game.ui.hudEl.style.display='none'; game.ui.controlsEl.style.display='none';
  game.ui.weaponSlotEl.style.display='none'; game.ui.pickupTipEl.style.display='none';
  game.ui.buffsEl.style.display='none'; game.ui.buffsEl.innerHTML='';
  game.ui.dmgLayerEl.style.display='none'; game.ui.gameoverEl.classList.remove('show');
  game.ui.modeBtn.textContent='🎮 进入格斗';
  game.camera.position.set(5,4,8); game.camera.lookAt(0,1,0);
  game.cameraCurrent.set(5,4,8);
}

function placeSunSystem(game) {
  const gltf=modelCache['太阳系']; if(!gltf||game.sunSystem)return;
  game.sunSystem=gltf.scene.clone();
  fixModelMaterials(game.sunSystem, false, false);
  const box=new THREE.Box3().setFromObject(game.sunSystem);
  const size=box.getSize(new THREE.Vector3());
  const maxDim=Math.max(size.x,size.y,size.z);
  game.sunSystem.scale.setScalar(12/maxDim);
  game.sunSystem.position.set(0,7,0);
  game.scene.add(game.sunSystem);
}

// ════════════════════════════════════════════════
//  初始化预览
// ════════════════════════════════════════════════
export async function initPreview(game) {
  const gltf=modelCache['太阳系'];
  if(gltf){game.previewModel=gltf.scene;
    const box=new THREE.Box3().setFromObject(game.previewModel);
    const center=box.getCenter(new THREE.Vector3());
    const size=box.getSize(new THREE.Vector3());
    const maxDim=Math.max(size.x,size.y,size.z);
    game.previewModel.position.sub(center);
    game.previewModel.scale.setScalar(3/maxDim);
    game.previewModel.position.y=1.5;
    fixModelMaterials(game.previewModel);
    game.scene.add(game.previewModel);
    const dist=maxDim*2; game.camera.position.set(dist*0.7,dist*0.5,dist*0.8);
    game.camera.lookAt(0,1,0); game.cameraCurrent.copy(game.camera.position);}
  game.ui.modeBtn.style.display='block';
}

// ════════════════════════════════════════════════
//  渲染循环
// ════════════════════════════════════════════════
export function gameLoop(game, dt) {
  if (game.gameRunning) {
    updateGame(game, dt);
    updateCamera(game, dt);
    updateHUD(game);
    for (const e of game.enemies) { e.mixer.update(dt); updateEnemyHpBar(game, e); }
    if (game.player&&game.player.mixer) game.player.mixer.update(dt);
    updateDamageNumbers(game, dt);
  } else if (game.previewMixer) game.previewMixer.update(dt);
  if (game.sunSystem) game.sunSystem.rotation.y+=dt*0.2;
  for (let i=game.effects.length-1;i>=0;i--){const ef=game.effects[i];ef.age+=dt;const t=ef.age/ef.life;ef.mesh.scale.setScalar(1+t*2);ef.mesh.material.opacity=Math.max(0,1-t);if(t>=1){game.scene.remove(ef.mesh);ef.mesh.geometry.dispose();ef.mesh.material.dispose();game.effects.splice(i,1);}}
  for (const key of Object.keys(game.justPressed)){if(game.justPressed[key])game.justPressed[key]=false;}
  game.renderer.render(game.scene, game.camera);
}

function updateHUD(game) {
  const p=game.player; if(!p)return;
  const hpPct=Math.max(0,p.hp/p.maxHp*100); game.ui.hpFill.style.width=hpPct+'%'; game.ui.hpLabel.textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;
  game.ui.scoreEl.textContent=`⭐ ${game.score}`; game.ui.waveEl.textContent=`🌊 第 ${game.wave} 波`;
  game.ui.levelEl.textContent=`🎖️ Lv.${game.playerLevel} (+${Math.round((playerDamageMult(game)-1)*100)}%)`;
  game.ui.enemyCountEl.textContent=`剩余敌人: ${game.enemies.filter(e=>e.state!=='dead').length}`;
  const wcfg=currentWeaponCfg(p); const cd=wcfg.kind==='gun'?p.shootTimer:p.attackTimer;
  if(cd<=0){game.ui.atkCdEl.classList.add('ready');game.ui.atkCdEl.querySelector('.inner').textContent='J';}
  else{game.ui.atkCdEl.classList.remove('ready');game.ui.atkCdEl.querySelector('.inner').textContent=cd.toFixed(1);}
  if(p.weapon){const cfg=WEAPONS[p.weapon];const total=cfg.kind==='gun'?cfg.ammo:cfg.uses;
    game.ui.weaponSlotEl.classList.remove('melee');game.ui.wNameEl.textContent=cfg.label;game.ui.wNameEl.style.color=cfg.accent;
    game.ui.wAmmoEl.innerHTML=`${p.ammo}<span class="max"> / ${total}</span>`;game.ui.weaponSlotEl.classList.toggle('low',p.ammo<=Math.max(3,total*0.2));}
  else{game.ui.weaponSlotEl.classList.add('melee');game.ui.weaponSlotEl.classList.remove('low');game.ui.wNameEl.textContent=FIST.label;game.ui.wNameEl.style.color='';game.ui.wAmmoEl.innerHTML='∞';}
  if(p.speedTimer>0){game.ui.buffsEl.style.display='flex';const pct=(p.speedTimer/SPEED.duration)*100;
    game.ui.buffsEl.innerHTML=`<div class="buff"><span class="bname">🏹 加速 ×${SPEED.multiplier}</span><span class="bbar"><i style="width:${pct}%"></i></span><span class="btime">${p.speedTimer.toFixed(1)}s</span></div>`;}
  else if(game.ui.buffsEl.style.display!=='none'){game.ui.buffsEl.style.display='none';game.ui.buffsEl.innerHTML='';}
}

function updateEnemyHpBar(game, enemy) {
  if(!enemy._hpEl||enemy.state==='dead')return;
  if(!game.settings.hpBar){enemy._hpEl.style.display='none';return;}
  const pos=enemy.group.position.clone();pos.y+=2.0;
  const projected=pos.clone().project(game.camera);
  const x=(projected.x*0.5+0.5)*game.renderer.domElement.clientWidth;
  const y=(-projected.y*0.5+0.5)*game.renderer.domElement.clientHeight;
  if(projected.z>1){enemy._hpEl.style.display='none';return;}
  enemy._hpEl.style.display='';enemy._hpEl.style.left=(x-20)+'px';enemy._hpEl.style.top=y+'px';
  const pct=Math.max(0,enemy.hp/enemy.maxHp*100);enemy._hpEl.querySelector('.fill').style.width=pct+'%';
  enemy._hpEl.classList.toggle('shownum',game.settings.hpNum);
  if(game.settings.hpNum)enemy._hpEl.querySelector('.num').textContent=`${Math.max(0,Math.ceil(enemy.hp))}/${Math.round(enemy.maxHp)}`;
  if(pct<30)enemy._hpEl.querySelector('.fill').style.background='linear-gradient(90deg,#ff4757,#ff6b6b)';
}

// ════════════════════════════════════════════════
//  输入事件
// ════════════════════════════════════════════════
export function setupInput(game, canvas) {
  window.addEventListener('keydown', (e) => {
    if (!game.keys[e.code]) game.justPressed[e.code] = true;
    game.keys[e.code] = true;
    if (['Space','KeyW','KeyA','KeyS','KeyD','KeyJ','KeyF','KeyQ','KeyE','KeyZ','KeyX','KeyR','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.code==='KeyR'&&game.gameOver) restartGame(game);
    if (e.code==='KeyP'){e.preventDefault();game.ui.settingsEl.classList.toggle('show');}
    if (e.code==='Tab'){e.preventDefault();if(game.gameRunning)exitGame(game);else startGame(game);}
  });
  window.addEventListener('keyup', (e) => { game.keys[e.code] = false; });

  // 触摸支持
  let lastMX=0,lastMY=0,touchD0=0;
  canvas.addEventListener('touchstart', (e) => { if(!game.gameRunning)return;
    if(e.touches.length===1){lastMX=e.touches[0].clientX;lastMY=e.touches[0].clientY;}
    if(e.touches.length===2){touchD0=Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY);}
    e.preventDefault(); },{passive:false});
  canvas.addEventListener('touchmove', (e) => { if(!game.gameRunning)return;
    if(e.touches.length===1){const dx=e.touches[0].clientX-lastMX,dy=e.touches[0].clientY-lastMY;
      game.camAzimuth-=dx*0.005;game.camElevation=Math.max(CAM_ELEV_MIN,Math.min(CAM_ELEV_MAX,game.camElevation-dy*0.005));
      lastMX=e.touches[0].clientX;lastMY=e.touches[0].clientY;}
    if(e.touches.length===2){const d=Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY);
      game.camDistance=Math.max(CAM_MIN_DIST,Math.min(CAM_MAX_DIST,game.camDistance+(touchD0-d)*0.03));touchD0=d;}
    e.preventDefault(); },{passive:false});
}

export function setupResize(game) {
  window.addEventListener('resize', () => {
    game.camera.aspect = window.innerWidth / window.innerHeight;
    game.camera.updateProjectionMatrix();
    game.renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
