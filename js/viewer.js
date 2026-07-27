// ════════════════════════════════════════════════
//  3D 模型预览器模块
// ════════════════════════════════════════════════
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  createRenderer, createScene, createCamera, createBasicLights,
  createLoader, fixModelMaterials, getModelInfo, fitModelToGroup, disposeGroup
} from './shared.js';

// ── 所有可预览的模型 ──
export const VIEWER_MODELS = [
  '太阳系', '宇航员', '恐龙', '狗', '飞碟', '飞碟1', '骨骼',
  '机器人', '大眼怪', '树怪', '草怪', '雪怪', '鱼怪', '翼龙',
  '矮哥布林', '矮哥布林2', '高哥布林',
  '普通子弹', '火子弹', '毒子弹',
  '地图1', '地图2', '地图3', '地图4'
];

// ── 初始化预览器 ──
export function initViewer() {
  const canvas = document.getElementById('canvas');
  const renderer = createRenderer(canvas);
  const scene = createScene('#1a1a2e');
  const camera = createCamera(50, 0.1, 200);
  camera.position.set(3, 2, 5);

  // OrbitControls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.5;
  controls.maxDistance = 30;
  controls.target.set(0, 1, 0);
  controls.update();

  // 灯光
  createBasicLights(scene, 4, 2);

  // 地面网格
  const grid = new THREE.GridHelper(12, 20, '#222244', '#111122');
  grid.position.y = -1.5;
  scene.add(grid);

  // 加载器
  const { loader } = createLoader();

  // UI 元素
  const ui = {
    loadEl:      document.getElementById('loading'),
    loadFill:    document.getElementById('loadFill'),
    loadPercent: document.getElementById('loadPercent'),
    loadText:    document.getElementById('loadText'),
    modelName:   document.getElementById('modelName'),
    tris:        document.getElementById('tris'),
    nodes:       document.getElementById('nodes'),
    anims:       document.getElementById('anims'),
    bones:       document.getElementById('bones'),
    matType:     document.getElementById('matType'),
    hasVC:       document.getElementById('hasVC'),
    animBar:     document.getElementById('anim-bar'),
    animBtns:    document.getElementById('animBtns'),
    hint:        document.getElementById('hint'),
  };

  // 状态
  const state = {
    currentGroup: null,
    currentGltf: null,
    mixer: null,
    activeActions: [],
    clock: new THREE.Clock(),
  };

  // ── 工具栏 ──
  document.querySelectorAll('#toolbar .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#toolbar .btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadModel(btn.dataset.model);
    });
  });

  // ── 动画切换 ──
  function toggleAnim(index, clip) {
    if (!state.mixer) return;
    state.activeActions.forEach(a => a.stop());
    state.activeActions = [];

    const action = state.mixer.clipAction(clip);
    action.reset();
    action.play();
    state.activeActions.push(action);

    const btns = ui.animBtns.querySelectorAll('.anim-btn');
    btns.forEach((b, i) => b.classList.toggle('paused', i !== index));
  }

  // ── 加载模型 ──
  function loadModel(name) {
    ui.loadEl.style.display = 'block';
    ui.loadFill.style.width = '0%';
    ui.loadPercent.textContent = '0%';
    ui.loadText.textContent = `加载 ${name}...`;

    // 清理旧模型
    if (state.currentGroup) {
      scene.remove(state.currentGroup);
      disposeGroup(state.currentGroup);
      state.currentGroup = null;
    }
    if (state.mixer) {
      state.mixer.stopAllAction();
      state.mixer = null;
      state.activeActions = [];
    }
    ui.animBar.style.display = 'none';
    ui.animBtns.innerHTML = '';

    const path = `model/${name}.glb`;

    loader.load(
      path,
      (gltf) => {
        ui.loadEl.style.display = 'none';
        state.currentGltf = gltf;
        state.currentGroup = gltf.scene;

        // 适配模型
        fitModelToGroup(state.currentGroup);
        fixModelMaterials(state.currentGroup);

        // 调整相机
        const box = new THREE.Box3().setFromObject(state.currentGroup);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const dist = maxDim * 2.5;
        controls.target.set(0, size.y * 0.3, 0);
        camera.position.set(dist * 0.7, dist * 0.5, dist * 0.8);
        controls.update();

        scene.add(state.currentGroup);

        // 模型信息
        const info = getModelInfo(state.currentGroup);
        ui.modelName.textContent = name;
        ui.tris.textContent = info.triCount.toLocaleString();
        ui.nodes.textContent = info.nodeCount;
        ui.bones.textContent = info.boneCount || '无';
        ui.matType.textContent = info.matTypes.join(', ');
        ui.hasVC.textContent = info.hasVC ? '✅ 是' : '❌ 否';

        // 动画
        const animations = gltf.animations || [];
        ui.anims.textContent = animations.length > 0
          ? animations.map(a => a.name || '(未命名)').join(', ')
          : '无';

        if (animations.length > 0) {
          state.mixer = new THREE.AnimationMixer(state.currentGroup);
          ui.animBar.style.display = 'block';

          animations.forEach((clip, i) => {
            const btn = document.createElement('span');
            btn.className = 'anim-btn paused';
            btn.textContent = clip.name || `动画${i + 1}`;
            btn.addEventListener('click', () => toggleAnim(i, clip));
            ui.animBtns.appendChild(btn);
          });

          toggleAnim(0, animations[0]);
        }

        ui.hint.textContent = '🖱 拖拽旋转 · 滚轮缩放 · 右键平移 · 双击恢复视角';
      },
      (progress) => {
        if (progress.total > 0) {
          const pct = Math.round(progress.loaded / progress.total * 100);
          ui.loadFill.style.width = pct + '%';
          ui.loadPercent.textContent = pct + '%';
        }
      },
      (err) => {
        ui.loadText.textContent = `❌ 加载失败: ${name}`;
        console.error(err);
      }
    );
  }

  // ── 双击恢复视角 ──
  canvas.addEventListener('dblclick', () => {
    if (!state.currentGroup) return;
    const box = new THREE.Box3().setFromObject(state.currentGroup);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = maxDim * 2.5;
    controls.target.set(0, size.y * 0.3, 0);
    camera.position.set(dist * 0.7, dist * 0.5, dist * 0.8);
    controls.update();
  });

  // ── 键盘快捷键 ──
  window.addEventListener('keydown', (e) => {
    const animations = state.currentGltf?.animations || [];
    if (animations.length === 0) return;

    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (state.activeActions.length > 0) {
        const a = state.activeActions[0];
        if (a.paused) {
          a.play();
          ui.animBtns.querySelectorAll('.anim-btn')[animations.indexOf(a._clip)]?.classList.remove('paused');
        } else {
          a.pause();
          ui.animBtns.querySelectorAll('.anim-btn')[animations.indexOf(a._clip)]?.classList.add('paused');
        }
      }
    }

    const num = parseInt(e.key);
    if (num >= 1 && num <= animations.length) {
      toggleAnim(num - 1, animations[num - 1]);
    }
  });

  // ── 响应式 ──
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── 渲染循环 ──
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(state.clock.getDelta(), 0.1);
    if (state.mixer) state.mixer.update(dt);
    controls.update();
    renderer.render(scene, camera);
  }

  // 启动
  animate();
  loadModel('地图2');
}
