import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import manifest from "../../assets/pigeon/manifest.json";
import { createShapeEditor } from "./shape-editor.js";

const modelUrl = new URL("../../assets/pigeon/pigeon.glb", import.meta.url).href;
export const VIEWS = [
  { id: "front", label: "정면", angle: 0 },
  { id: "left45", label: "좌측 45°", angle: 45 },
  { id: "left", label: "좌측면", angle: 90 },
  { id: "back-left45", label: "후면 좌측 45°", angle: 135 },
  { id: "back", label: "후면", angle: 180 },
  { id: "back-right45", label: "후면 우측 45°", angle: 225 },
  { id: "right", label: "우측면", angle: 270 },
  { id: "right45", label: "우측 45°", angle: 315 },
];
function releaseTree(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root?.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    const list = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of list) if (material) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  textures.forEach((value) => value.dispose());
  materials.forEach((value) => value.dispose());
  geometries.forEach((value) => value.dispose());
}
export async function createPigeonStudy(host, { signal, initialView = "left45", initialFraming = "body", initialSurface = "clay", onState, onError } = {}) {
  let renderer, controls, observer, frame = 0, disposed = false, count = 0;
  let currentView = VIEWS.some((v) => v.id === initialView) ? initialView : "left45";
  let currentFraming = ["head", "head-neck"].includes(initialFraming) ? initialFraming : "body";
  let currentSurface = initialSurface === "color" ? "color" : "clay";
  const originalMaterials = new Map(), clayMaterials = new Map();
  let loaded, shapeEditor;
  const world = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 30);
  const target = new THREE.Vector3(0, 0.49, -0.08);
  const contextLost = (event) => { event.preventDefault(); if (!disposed) onError?.("그래픽 연결이 끊겼습니다. 다시 불러와 주세요."); };
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    controls?.dispose();
    if (renderer) {
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    }
    world.traverse((node) => node.shadow?.map?.dispose());
    originalMaterials.forEach((material, node) => { node.material = material; });
    releaseTree(world);
    if (loaded && !loaded.parent) releaseTree(loaded);
    clayMaterials.forEach((material) => material.dispose());
    originalMaterials.clear();
    clayMaterials.clear();
  }
  function draw() {
    frame = 0;
    if (disposed || signal?.aborted || !renderer) return;
    try {
      renderer.render(world, camera);
      count += 1;
      onState?.({ ready: true, revision: manifest.revision, view: currentView, framing: currentFraming, surface: currentSurface, frame: count,
        meshes: manifest.mesh_count, triangles: manifest.triangles, source: "blender-glb" });
    } catch (error) {
      onError?.("3D 화면을 표시하지 못했습니다. 다시 불러와 주세요.");
    }
  }
  function requestDraw() {
    if (!disposed && !frame) frame = requestAnimationFrame(draw);
  }
  function setView(value) {
    const preset = VIEWS.find((item) => item.id === value);
    if (!preset || disposed || !controls) return;
    currentView = preset.id;
    const a = THREE.MathUtils.degToRad(preset.angle);
    if (currentFraming === "head" || currentFraming === "head-neck") {
      if (currentFraming === "head") target.set(0, 0.855, 0.18);
      else target.set(0, 0.74, 0.12);
      camera.position.set(3.4 * Math.sin(a), target.y, target.z + 3.4 * Math.cos(a));
    } else {
      target.set(0, 0.49, -0.08);
      camera.position.set(3.4 * Math.sin(a), 0.82, 3.4 * Math.cos(a));
    }
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.target.copy(target);
    controls.update();
    requestDraw();
  }
  function setFraming(value) {
    if (!["body", "head", "head-neck"].includes(value) || disposed || !controls) return;
    currentFraming = value;
    setView(currentView);
    resize();
  }
  function setSurface(value) {
    if (!["color", "clay"].includes(value) || disposed || !loaded) return;
    currentSurface = value;
    originalMaterials.forEach((material, node) => {
      if (value === "color") {
        node.material = material;
        return;
      }
      const color = node.name.startsWith("Pupil_") ? 0x161616 : node.name.startsWith("Eye_globe_") ? 0x575757 : 0x858585;
      if (!clayMaterials.has(color)) clayMaterials.set(color, new THREE.MeshStandardMaterial({
        color, roughness: 0.8, metalness: 0, side: THREE.DoubleSide,
      }));
      node.material = clayMaterials.get(color);
    });
    requestDraw();
  }
  function resize() {
    if (disposed || !renderer) return;
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    const half = currentFraming === "head" ? 0.245 : currentFraming === "head-neck" ? 0.33 : 0.71, aspect = width / height;
    camera.left = -half * Math.max(aspect, 1);
    camera.right = half * Math.max(aspect, 1);
    camera.top = half * Math.max(1 / aspect, 1);
    camera.bottom = -half * Math.max(1 / aspect, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    requestDraw();
  }
  try {
    const response = await fetch(modelUrl, { signal });
    if (!response.ok) throw new Error("Model request " + response.status);
    const buffer = await response.arrayBuffer();
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const gltf = await new GLTFLoader().parseAsync(buffer, "");
    loaded = gltf.scene;
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const root = loaded.getObjectByName("Pigeon_R01");
    if (!root || root.userData.revision !== manifest.revision) throw new Error("Model revision mismatch");
    world.background = new THREE.Color("#efeeea");
    const box = new THREE.Box3().setFromObject(loaded);
    const height = box.max.y - box.min.y;
    if (!Number.isFinite(height) || height < 0.01) throw new Error("Invalid model bounds");
    loaded.scale.setScalar(1 / height);
    loaded.position.y = -box.min.y / height;
    loaded.traverse((node) => { if (node.isMesh) {
      node.castShadow = true; node.receiveShadow = false;
      originalMaterials.set(node, node.material);
    } });
    world.add(loaded);
    world.add(new THREE.HemisphereLight(0xffffff, 0xaaa69e, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(-3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -1.4, right: 1.4, top: 1.4, bottom: -1.4, near: 0.1, far: 15 });
    key.shadow.normalBias = 0.015;
    key.shadow.bias = -0.0001;
    key.shadow.radius = 4;
    key.shadow.blurSamples = 8;
    key.target.position.set(0, 0.4, 0);
    world.add(key, key.target);
    const fill = new THREE.DirectionalLight(0xffffff, 1.0);
    fill.position.set(3, 2, -3);
    world.add(fill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: "#efeeea", roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.005;
    floor.receiveShadow = true;
    world.add(floor);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.domElement.setAttribute("aria-label", "비둘기 3D 모델");
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    host.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = false;
    controls.minZoom = 0.65;
    controls.maxZoom = 3.4;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = Math.PI / 2 + 0.08;
    controls.addEventListener("change", requestDraw);
    observer = new ResizeObserver(resize);
    observer.observe(host);
    setSurface(currentSurface);
    setView(currentView);
    resize();
    return {
      dispose, setView, setFraming, setSurface,
      setShape(value) {
        if (disposed) return;
        shapeEditor ??= createShapeEditor(loaded);
        shapeEditor.apply(value);
        requestDraw();
      },
      setFeathers(visible) {
        if (disposed) return;
        loaded.traverse(node => { if (node.name.startsWith("Plumage_")) node.visible = visible; });
        requestDraw();
      },
      async exportGLB(shape) {
        if (disposed) throw new Error("편집 화면이 닫혔습니다.");
        // Clone materials/geometry so exporting cannot change the live gray preview.
        const copy = loaded.clone(true);
        const sourceMeshes = [];
        loaded.traverse(node => { if (node.isMesh) sourceMeshes.push(node); });
        let index = 0;
        copy.traverse(node => {
          node.visible = true;
          if (!node.isMesh) return;
          const source = sourceMeshes[index++];
          node.geometry = source.geometry.clone();
          const material = originalMaterials.get(source);
          node.material = Array.isArray(material) ? material.map(item => item.clone()) : material.clone();
        });
        copy.userData.shapeEdit = { baseRevision: manifest.revision, baseSha256: manifest.glb_sha256, values: { ...shape } };
        try {
          const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
          return await new GLTFExporter().parseAsync(copy, { binary: true });
        } finally { releaseTree(copy); }
      },
      screenshot() {
        if (disposed) throw new Error("편집 화면이 닫혔습니다.");
        renderer.render(world, camera);
        return renderer.domElement.toDataURL("image/png");
      },
      reset: () => { currentFraming = "body"; setSurface("clay"); setView("left45"); resize(); },
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
