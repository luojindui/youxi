// ════════════════════════════════════════════════
//  共用模块：渲染器、加载器、材质工具、模型加载
// ════════════════════════════════════════════════
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ── 渲染器 ──
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

// ── 场景 ──
export function createScene(bgColor = '#1a1a2e', fogColor = null, fogNear = 20, fogFar = 60) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bgColor);
  if (fogColor) {
    scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
  }
  return scene;
}

// ── 相机 ──
export function createCamera(fov = 50, near = 0.1, far = 200) {
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  return camera;
}

// ── 基础灯光 ──
export function createBasicLights(scene, ambientIntensity = 4, dirIntensity = 2) {
  scene.add(new THREE.AmbientLight('#ffffff', ambientIntensity));
  const dir = new THREE.DirectionalLight('#ffffff', dirIntensity);
  dir.position.set(3, 5, 3);
  scene.add(dir);
}

// ── 带阴影的主灯光 ──
export function createSunLight(scene) {
  const sun = new THREE.DirectionalLight('#ffffff', 5);
  sun.position.set(5, 12, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  scene.add(sun);
  return sun;
}

// ── 加载器（含 SpecGloss 扩展）──
export function createLoader() {
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  // 注册 KHR_materials_pbrSpecularGlossiness → Standard PBR 转换
  loader.register(function(parser) {
    const extName = 'KHR_materials_pbrSpecularGlossiness';
    return {
      name: extName,
      loadMaterial: function(materialIndex) {
        const json = parser.json;
        const materialDef = json.materials[materialIndex];
        if (!materialDef.extensions || !materialDef.extensions[extName]) return null;
        const ext = materialDef.extensions[extName];
        const mat = new THREE.MeshStandardMaterial();
        if (ext.diffuseFactor) mat.color.fromArray(ext.diffuseFactor);
        mat.roughness = ext.glossinessFactor !== undefined ? 1 - ext.glossinessFactor : 1;
        if (ext.specularFactor) {
          const s = ext.specularFactor;
          mat.metalness = Math.min(0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2], 1);
        }
        const texPromises = [];
        const assignMap = function(mapProp, texDef, sRGB) {
          if (!texDef) return;
          texPromises.push(
            parser.loadTexture(texDef.index).then(function(tex) {
              tex.colorSpace = sRGB ? THREE.SRGBColorSpace : THREE.NoColorSpace;
              mat[mapProp] = tex;
            })
          );
        };
        assignMap('map', ext.diffuseTexture, true);
        assignMap('roughnessMap', ext.specularGlossinessTexture, false);
        assignMap('metalnessMap', ext.specularGlossinessTexture, false);
        if (texPromises.length > 0) {
          return Promise.all(texPromises).then(function() { return mat; });
        }
        return mat;
      }
    };
  });

  return { loader, draco };
}

// ── 材质修复（顶点颜色 + 贴图色彩空间）──
export function fixMaterialColors(mesh) {
  const geom = mesh.geometry;
  const hasVertexColors = geom && geom.attributes.color;
  const mat = mesh.material;
  if (!mat) return;
  const materials = Array.isArray(mat) ? mat : [mat];
  materials.forEach(m => {
    if (hasVertexColors) m.vertexColors = true;
    if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
    if (m.emissiveMap) m.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    if (m.roughnessMap) m.roughnessMap.colorSpace = THREE.NoColorSpace;
    if (m.metalnessMap) m.metalnessMap.colorSpace = THREE.NoColorSpace;
    if (m.aoMap) m.aoMap.colorSpace = THREE.NoColorSpace;
    if (m.normalMap) m.normalMap.colorSpace = THREE.NoColorSpace;
    m.needsUpdate = true;
  });
}

// ── 遍历修复整个模型树的材质 ──
export function fixModelMaterials(group, castShadow = true, receiveShadow = true) {
  group.traverse(child => {
    if (child.isMesh) {
      if (castShadow) child.castShadow = true;
      if (receiveShadow) child.receiveShadow = true;
      fixMaterialColors(child);
    }
  });
}

// ── 模型信息提取 ──
export function getModelInfo(group) {
  let triCount = 0, nodeCount = 0, boneCount = 0;
  const matTypes = new Set();

  group.traverse(child => {
    nodeCount++;
    if (child.isMesh) {
      const geom = child.geometry;
      if (geom.index) triCount += geom.index.count / 3;
      else if (geom.attributes.position) triCount += geom.attributes.position.count / 3;

      const mat = child.material;
      if (mat) {
        (Array.isArray(mat) ? mat : [mat]).forEach(m => matTypes.add(m.type));
      }
    }
    if (child.isBone || child.isSkinnedMesh) boneCount++;
  });

  const hasVC = (() => {
    let found = false;
    group.traverse(c => { if (c.isMesh && c.geometry && c.geometry.attributes.color) found = true; });
    return found;
  })();

  return { triCount: Math.round(triCount), nodeCount, boneCount, matTypes: [...matTypes], hasVC };
}

// ── 模型适配：居中 + 缩放 ──
export function fitModelToGroup(group, targetScale = null) {
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  group.position.sub(center);

  if (targetScale !== null && maxDim > 0) {
    group.scale.setScalar(targetScale / maxDim);
  }

  return { box, center, size, maxDim };
}

// ── 模型清理 ──
export function disposeGroup(group) {
  group.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach(m => {
        for (const key of Object.keys(m)) {
          const val = m[key];
          if (val && val.isTexture) val.dispose();
        }
        m.dispose();
      });
    }
  });
}

// ── 骨骼模型克隆 ──
function parallelTraverse(a, b, callback) {
  callback(a, b);
  for (let i = 0; i < a.children.length; i++) {
    parallelTraverse(a.children[i], b.children[i], callback);
  }
}

export function cloneSkinned(source) {
  const clone = source.clone(true);

  let hasSkinned = false;
  source.traverse(n => { if (n.isSkinnedMesh) hasSkinned = true; });

  if (hasSkinned) {
    const sourceLookup = new Map();
    const cloneLookup = new Map();
    parallelTraverse(source, clone, function(sourceNode, clonedNode) {
      sourceLookup.set(clonedNode, sourceNode);
      cloneLookup.set(sourceNode, clonedNode);
    });

    clone.traverse(function(node) {
      if (!node.isSkinnedMesh) return;
      const sourceMesh = sourceLookup.get(node);
      if (!sourceMesh || !sourceMesh.skeleton) return;
      const sourceBones = sourceMesh.skeleton.bones;
      const clonedSkeleton = sourceMesh.skeleton.clone();
      clonedSkeleton.bones = sourceBones.map(function(bone) {
        return cloneLookup.get(bone);
      });
      node.bind(clonedSkeleton, node.bindMatrix);
    });
  }

  fixModelMaterials(clone);
  return clone;
}

// ── 模型缓存 ──
export const modelCache = {};

export async function loadModel(loader, name) {
  return new Promise((resolve, reject) => {
    loader.load(
      `model/${name}.glb`,
      (gltf) => {
        modelCache[name] = gltf;
        resolve(gltf);
      },
      undefined,
      (err) => reject(err)
    );
  });
}

export async function preloadModels(loader, names, onProgress) {
  let loaded = 0;
  const results = await Promise.allSettled(
    names.map(name =>
      loadModel(loader, name).then(gltf => {
        loaded++;
        if (onProgress) onProgress(name, loaded, names.length);
        return gltf;
      }).catch(err => {
        loaded++;
        console.warn(`加载 ${name} 失败:`, err);
        if (onProgress) onProgress(name, loaded, names.length);
        return null;
      })
    )
  );
  return results;
}

// ── 从缓存克隆模型实例 ──
export function spawnInstance(name) {
  const gltf = modelCache[name];
  if (!gltf) { console.warn(`spawnInstance: "${name}" 不在缓存中`); return null; }

  let hasSkinned = false;
  gltf.scene.traverse(n => { if (n.isSkinnedMesh) hasSkinned = true; });

  if (!hasSkinned) {
    const clone = gltf.scene.clone(true);
    fixModelMaterials(clone);
    return clone;
  }
  return cloneSkinned(gltf.scene);
}

// ── 查找骨骼 ──
export function findSkeleton(obj) {
  let skeleton = null;
  obj.traverse(c => { if (c.isSkinnedMesh && c.skeleton) skeleton = c.skeleton; });
  return skeleton;
}

// ── 模型路径 ──
export function modelPath(name) {
  return `model/${name}.glb`;
}
