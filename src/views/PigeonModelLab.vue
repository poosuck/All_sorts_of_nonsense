<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import "./pigeon-model-lab.css";

const BUILTIN = {
  normal: new URL("../assets/pigeon/normal-v3.glb", import.meta.url).href,
  chicken: new URL("../assets/pigeon/chicken-v3.glb", import.meta.url).href,
};
const CC0_URL = "https://www.innerscene.com/api/library/urban-pigeon-3977bbba/download";
const MAX_GLB_BYTES = 40 * 1024 * 1024;

const canvasHost = ref(null);
const referenceInput = ref(null);
const modelInput = ref(null);
const referenceUrl = ref("");
const selected = ref("normal");
const busy = ref(false);
const problem = ref("");
const currentClip = ref("");
const clips = ref([]);
const modelInfo = ref(null);
const sunStrength = ref(2.2);
const lightLabel = ref("햇빛 2.2");
const lightingStyle = ref("warm");

let active = true;
let renderer, scene, camera, controls, world, floor, sun, hemi, roomTarget;
let resizeObserver, frameId, previousFrame = 0, modelRoot, mixer, currentGltf, controller;
let loadSequence = 0, customModelFile;

function collectStats(root) {
  const geometries = new Set();
  const materials = new Set();
  let meshCount = 0, triangles = 0, textured = 0, skinned = 0;
  root.traverse((node) => {
    if (!node.isMesh) return;
    meshCount++;
    if (node.isSkinnedMesh) skinned++;
    if (node.geometry && !geometries.has(node.geometry)) {
      geometries.add(node.geometry);
      const geometry = node.geometry;
      triangles += geometry.index ? geometry.index.count / 3 : (geometry.attributes.position?.count || 0) / 3;
    }
    for (const material of [node.material].flat()) {
      if (material) materials.add(material);
    }
  });
  for (const material of materials) if (material.map) textured++;
  return { meshCount, triangles: Math.round(triangles), materials: materials.size, textured, skinned };
}

function clearModel() {
  mixer?.stopAllAction();
  if (mixer && modelRoot) mixer.uncacheRoot(modelRoot);
  mixer = undefined;
  if (world) {
    world.removeFromParent();
    world.clear();
  }
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  modelRoot?.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.skeleton) skeletons.add(node.skeleton);
    for (const material of [node.material].flat()) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const item of skeletons) item.dispose();
  for (const item of geometries) item.dispose();
  for (const item of materials) item.dispose();
  for (const item of textures) item.dispose();
  currentGltf = undefined;
  modelRoot = undefined;
  world = undefined;
}

function presentModel(gltf, label) {
  clearModel();
  currentGltf = gltf;
  modelRoot = gltf.scene;
  world = new THREE.Group();
  world.add(modelRoot);
  scene.add(world);
  modelRoot.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.isSkinnedMesh) obj.frustumCulled = false;
    }
  });
  // Normalize differently sized GLBs without changing their skeleton hierarchy.
  const original = new THREE.Box3().setFromObject(modelRoot);
  const size = original.getSize(new THREE.Vector3());
  if (original.isEmpty() || !Number.isFinite(size.y) || size.y < 0.00001) {
    throw new Error("모델의 실제 3D 크기를 확인할 수 없습니다.");
  }
  const factor = 1.4 / size.y;
  world.scale.setScalar(factor);
  world.position.set(
    -(original.min.x + original.max.x) * factor / 2,
    -original.min.y * factor,
    -(original.min.z + original.max.z) * factor / 2,
  );
  const stats = collectStats(modelRoot);
  modelInfo.value = { label, ...stats, dimensions: size.toArray().map((n) => n.toFixed(2)).join(" × ") };
  clips.value = gltf.animations.map((animation) => animation.name);
  currentClip.value = "";
  if (gltf.animations.length) {
    mixer = new THREE.AnimationMixer(modelRoot);
    const idle = gltf.animations.find((clip) => /^(idle|stand|rest)$/i.test(clip.name)) || gltf.animations[0];
    playClip(idle.name);
  }
  setAngle("threequarter");
}

async function loadBuffer(buffer, label, requestId) {
  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(buffer, "");
  if (!active || requestId !== loadSequence) return;
  presentModel(gltf, label);
}

async function loadChoice(value) {
  if (!active) return;
  selected.value = value;
  const requestId = ++loadSequence;
  controller?.abort();
  controller = new AbortController();
  busy.value = true;
  problem.value = "";
  try {
    let buffer, label;
    if (value === "custom") {
      if (!customModelFile) throw new Error("먼저 GLB 파일을 선택해 주세요.");
      buffer = await customModelFile.arrayBuffer();
      label = customModelFile.name;
    } else {
      const url = value === "cc0" ? CC0_URL : BUILTIN[value];
      label = value === "cc0" ? "Urban Pigeon · CC0" : value === "chicken" ? "닭둘기 v3" : "일반 비둘기 v3";
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("모델을 가져오지 못했습니다. HTTP " + response.status);
      const length = Number(response.headers.get("content-length") || 0);
      if (length > MAX_GLB_BYTES) throw new Error("모델 크기가 40MB를 초과합니다.");
      buffer = await response.arrayBuffer();
    }
    if (buffer.byteLength > MAX_GLB_BYTES) throw new Error("40MB 이하의 GLB 파일만 사용할 수 있습니다.");
    if (requestId !== loadSequence || !active) return;
    await loadBuffer(buffer, label, requestId);
  } catch (err) {
    if (requestId !== loadSequence || !active || err.name === "AbortError") return;
    problem.value = value === "cc0"
      ? "CC0 모델 자동 불러오기에 실패했습니다. 출처 페이지에서 GLB를 내려받아 아래 '파일 가져오기'를 이용해 주세요. (서버 CORS 설정에 따라 자동 요청이 차단될 수 있습니다.)"
      : "모델을 열 수 없습니다: " + err.message;
  } finally {
    if (active && requestId === loadSequence) busy.value = false;
  }
}

function onModelFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".glb")) {
    problem.value = "텍스처가 포함된 단일 .glb 파일을 선택해 주세요.";
    return;
  }
  customModelFile = file;
  loadChoice("custom");
}
function onReferenceFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    problem.value = "비교 이미지는 PNG/JPEG/WebP 등 이미지 파일만 지원합니다.";
    return;
  }
  if (referenceUrl.value) URL.revokeObjectURL(referenceUrl.value);
  referenceUrl.value = URL.createObjectURL(file);
}
function playClip(name) {
  if (!mixer || !currentGltf) return;
  const clip = currentGltf.animations.find((item) => item.name === name);
  if (!clip) return;
  mixer.stopAllAction();
  const action = mixer.clipAction(clip);
  action.reset().play();
  currentClip.value = name;
}
function setAngle(value) {
  if (!camera || !controls) return;
  const presets = {
    threequarter: [2.6, 1.55, 3.3],
    front: [0, 1.36, 3.9],
    side: [3.9, 1.36, 0.03],
    back: [0, 1.36, -3.9],
  };
  camera.position.set(...(presets[value] || presets.threequarter));
  controls.target.set(0, 0.76, 0);
  controls.update();
}
function setSun(event) {
  sunStrength.value = Number(event.target.value);
  lightLabel.value = "햇빛 " + sunStrength.value.toFixed(1);
  if (sun) sun.intensity = sunStrength.value;
}
function setLighting(value) {
  lightingStyle.value = value;
  if (!scene) return;
  scene.background.set(value === "warm" ? "#e5e3d8" : "#d7dce0");
  if (sun) sun.color.set(value === "warm" ? "#ffedce" : "#ffffff");
  if (hemi) hemi.color.set(value === "warm" ? "#e9f2ff" : "#ffffff");
  if (floor) floor.material.color.set(value === "warm" ? "#e8e4d7" : "#dce0e3");
}
function saveImage() {
  if (!renderer || busy.value) return;
  renderer.render(scene, camera);
  const a = document.createElement("a");
  a.href = renderer.domElement.toDataURL("image/png");
  a.download = "pigeon-model-review.png";
  a.click();
}
function resize() {
  if (!canvasHost.value || !renderer || !camera) return;
  const width = Math.max(1, canvasHost.value.clientWidth);
  const height = Math.max(1, canvasHost.value.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
function render(time) {
  if (!active || !renderer) return;
  const dt = previousFrame ? Math.min((time - previousFrame) / 1000, .05) : 0;
  previousFrame = time;
  mixer?.update(dt);
  controls?.update();
  renderer.render(scene, camera);
  frameId = requestAnimationFrame(render);
}
onMounted(() => {
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#e5e3d8");
  camera = new THREE.PerspectiveCamera(38, 1, .05, 90);
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-label", "회전 및 확대 가능한 3D 비둘기 외형 비교 화면");
  canvasHost.value.append(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.2;
  controls.maxDistance = 9;
  controls.maxPolarAngle = Math.PI * .49;
  hemi = new THREE.HemisphereLight("#e9f2ff", "#988b7c", 1.15);
  scene.add(hemi);
  sun = new THREE.DirectionalLight("#ffedce", sunStrength.value);
  sun.position.set(-3.5, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 20 });
  sun.shadow.normalBias = .015;
  scene.add(sun);
  const room = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  roomTarget = generator.fromScene(room, .04);
  scene.environment = roomTarget.texture;
  scene.environmentIntensity = .6;
  generator.dispose();
  room.dispose();
  floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: "#e8e4d7", roughness: .98 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.01;
  floor.receiveShadow = true;
  scene.add(floor);
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvasHost.value);
  setAngle("threequarter");
  resize();
  frameId = requestAnimationFrame(render);
  loadChoice("normal");
});
onBeforeUnmount(() => {
  active = false;
  loadSequence++;
  controller?.abort();
  cancelAnimationFrame(frameId);
  resizeObserver?.disconnect();
  if (referenceUrl.value) URL.revokeObjectURL(referenceUrl.value);
  clearModel();
  controls?.dispose();
  floor?.geometry.dispose();
  floor?.material.dispose();
  sun?.shadow.dispose();
  roomTarget?.dispose();
  renderer?.dispose();
  renderer?.forceContextLoss();
  renderer?.domElement.remove();
});
</script>

<template>
  <div class="pigeon-lab">
    <header class="lab-top">
      <RouterLink to="/pigeon" class="lab-back">← 비둘기 관찰실</RouterLink>
      <span>별짓 / CONTENT 002 / MODEL STUDY 01</span>
      <strong>현재 단계: 외형 검증</strong>
    </header>
    <section class="lab-heading">
      <div><span class="lab-kicker">SPECIMEN QUALITY CONTROL</span><h1>비둘기는 비둘기답게.</h1><p>실제 GLB 모델을 불러와 기준 이미지와 같은 화면에서 비교하는 1단계 검증실입니다.</p></div>
      <div class="lab-guide">모델 선택 → 시점 확인 → 참고 이미지와 비교 → PNG 기록</div>
    </section>
    <section class="lab-workspace">
      <div class="lab-viewer">
        <div class="lab-viewer-title"><strong>LIVE 3D</strong><span>{{ modelInfo?.label || "모델 준비 중" }}</span></div>
        <div ref="canvasHost" class="lab-canvas" data-testid="pigeon-model-lab-canvas"></div>
        <div v-if="busy" class="lab-loading" role="status">3D 모델을 불러오는 중…</div>
        <div class="lab-viewer-footer">마우스 드래그: 회전 · 휠: 확대 · 실제 WebGL 렌더링</div>
      </div>
      <div class="lab-reference">
        <div class="lab-viewer-title"><strong>REFERENCE</strong><span>목표 비주얼</span></div>
        <img v-if="referenceUrl" :src="referenceUrl" alt="사용자가 업로드한 목표 이미지" class="lab-reference-image" />
        <div v-else class="lab-reference-empty"><span>01 / TARGET IMAGE</span><strong>목표 이미지를 올려주세요.</strong><p>앞서 공유한 공원 비둘기 이미지를 선택하면 3D 외형과 나란히 비교할 수 있습니다.</p><button @click="referenceInput?.click()">이미지 선택</button></div>
        <button v-if="referenceUrl" class="lab-replace" @click="referenceInput?.click()">참고 이미지 변경</button>
        <input ref="referenceInput" type="file" accept="image/*" class="lab-hidden" aria-label="참고 이미지 파일 선택" @change="onReferenceFile" />
      </div>
    </section>
    <section class="lab-control-grid">
      <div class="lab-panel">
        <h2><span>01</span> 3D 모델 선택</h2>
        <div class="lab-model-list">
          <button :aria-pressed="selected === 'normal'" :disabled="busy" @click="loadChoice('normal')"><b>기존 일반 비둘기 v3</b><small>현재 저장소 · 동작 4종</small></button>
          <button :aria-pressed="selected === 'chicken'" :disabled="busy" @click="loadChoice('chicken')"><b>기존 닭둘기 v3</b><small>현재 저장소 · 체형 별도 제작</small></button>
          <button :aria-pressed="selected === 'cc0'" :disabled="busy" @click="loadChoice('cc0')"><b>Urban Pigeon (CC0)</b><small>외부 모델 · 온라인 불러오기 시도</small></button>
        </div>
        <button class="lab-upload" @click="modelInput?.click()">+ 보유한 GLB 파일 가져오기</button>
        <input ref="modelInput" class="lab-hidden" type="file" accept=".glb,model/gltf-binary" aria-label="GLB 파일 가져오기" @change="onModelFile" />
        <p class="lab-help">외부 모델이 CORS 문제로 자동 로드되지 않으면 <a href="https://www.innerscene.com/tools/library/3d-parts/urban-pigeon-3977bbba" target="_blank" rel="noopener noreferrer">CC0 원본 페이지</a>에서 다운로드 후 직접 가져오세요. 업로드한 파일은 서버로 전송하지 않습니다.</p>
        <p v-if="problem" class="lab-error" role="alert">{{ problem }}</p>
      </div>
      <div class="lab-panel">
        <h2><span>02</span> 조명 · 시점</h2>
        <div class="lab-angle"><button @click="setAngle('threequarter')">45°</button><button @click="setAngle('front')">정면</button><button @click="setAngle('side')">측면</button><button @click="setAngle('back')">후면</button></div>
        <div class="lab-light"><label for="lab-sun">{{ lightLabel }}</label><input id="lab-sun" type="range" min=".5" max="4.0" step=".1" :value="sunStrength" @input="setSun" /></div>
        <div class="lab-angle"><button :aria-pressed="lightingStyle === 'warm'" @click="setLighting('warm')">따뜻한 오후</button><button :aria-pressed="lightingStyle === 'neutral'" @click="setLighting('neutral')">중립 조명</button></div>
        <div v-if="clips.length" class="lab-clips"><span>포함된 애니메이션</span><div><button v-for="name in clips" :key="name" :aria-pressed="currentClip === name" @click="playClip(name)">{{ name }}</button></div></div>
        <button class="lab-snapshot" :disabled="busy || !modelInfo" @click="saveImage">현재 모델 PNG 저장</button>
      </div>
      <div class="lab-panel">
        <h2><span>03</span> 모델 진단</h2>
        <dl v-if="modelInfo" class="lab-stats">
          <dt>삼각형</dt><dd>{{ modelInfo.triangles.toLocaleString() }}</dd>
          <dt>3D 메시</dt><dd>{{ modelInfo.meshCount }}</dd>
          <dt>재질 / 컬러 텍스처</dt><dd>{{ modelInfo.materials }} / {{ modelInfo.textured }}</dd>
          <dt>스킨드 메시</dt><dd>{{ modelInfo.skinned }}</dd>
          <dt>애니메이션</dt><dd>{{ clips.length }}</dd>
          <dt>원본 크기 (m 또는 모델 단위)</dt><dd>{{ modelInfo.dimensions }}</dd>
        </dl>
        <p v-else>모델을 선택하면 메시 구성과 렌더링 정보를 확인할 수 있습니다.</p>
        <p class="lab-help">이 값은 로드된 모델의 구조 분석이며 FPS 또는 실제 완성도를 보장하는 성능 점수는 아닙니다.</p>
      </div>
    </section>
    <footer class="lab-end"><strong>STEP 01 · 외형 검증</strong><span>목 · 깃털 · 눈 · 부리 · 발 · 날개 · 통통한 체형을 비교한 뒤, 동작 검증으로 넘어갑니다.</span><RouterLink to="/pigeon">기존 동작 관찰실로 이동 ↗</RouterLink></footer>
  </div>
</template>
