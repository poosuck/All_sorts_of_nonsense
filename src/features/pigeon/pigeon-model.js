import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { bindPigeonRig } from "./rig.js";
import { createOpenPigeon } from "./open-pigeon.js";

const URLS = {
  normal: new URL("../../assets/pigeon/normal-v3.glb", import.meta.url).href,
  chicken: new URL("../../assets/pigeon/chicken-v3.glb", import.meta.url).href,
};
const OPEN_BASE = import.meta.env.BASE_URL + "models/pigeon-open";
const VALID_LICENSES = new Set(["CC0-1.0", "CC-BY-4.0"]);

function disposeModels(models) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  for (const model of models) model?.scene?.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.skeleton) skeletons.add(object.skeleton);
    if (object.material) for (const material of [object.material].flat()) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const value of skeletons) value.dispose();
  for (const value of geometries) value.dispose();
  for (const value of materials) value.dispose();
  for (const value of textures) { value.dispose(); value.source?.data?.close?.(); }
}

async function loadKenchooModel(signal) {
  const metadata = {
    name: "Pigeon (kenchoo)",
    author: "kenchoo",
    license: "CC-BY-4.0",
    source: "https://sketchfab.com/3d-models/pigeon-ddd5ef4a94eb4159937a9de25c45697c",
    attribution: "Pigeon by kenchoo (CC BY 4.0); original glTF imported without modification",
  };
  const loader = new GLTFLoader();
  // Original .gltf references its .bin and two texture PNGs relatively.
  const url = import.meta.env.BASE_URL + "models/kenchoo/scene.gltf";
  const response = await fetch(url, { signal });
  if (!response.ok || !response.headers.get("content-type")?.includes("json")) {
    throw new Error("kenchoo 3D 모델 JSON을 찾을 수 없습니다: " + url);
  }
  const gltf = await loader.loadAsync(url);
  if (signal?.aborted) throw new DOMException("Pigeon loading aborted", "AbortError");
  if (!gltf.scene || !gltf.scene.children.length) throw new Error("kenchoo GLTF 장면이 비어 있습니다.");
  return { gltf, metadata };
}

async function loadOpenSourceModel(loader, signal) {
  // SPA fallbacks may return index.html with HTTP 200 for missing files.
  // Require a real metadata JSON before attempting to load the GLB.
  const metaResponse = await fetch(OPEN_BASE + ".json", { signal });
  if (!metaResponse.ok || !metaResponse.headers.get("content-type")?.includes("json")) return null;
  const metadata = await metaResponse.json();
  if (!VALID_LICENSES.has(metadata.license) || !metadata.sha256 || !metadata.source) {
    throw new Error("무료 비둘기 모델의 출처 또는 라이선스 정보가 올바르지 않습니다.");
  }
  const response = await fetch(OPEN_BASE + ".glb", { signal });
  if (!response.ok || response.headers.get("content-type")?.includes("text/html")) {
    throw new Error("설치된 무료 비둘기 GLB 파일을 찾을 수 없습니다.");
  }
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 20 ||
      String.fromCharCode(...bytes.slice(0, 4)) !== "glTF" ||
      new DataView(buffer).getUint32(4, true) !== 2 ||
      new DataView(buffer).getUint32(8, true) !== bytes.length) {
    throw new Error("무료 비둘기 모델은 올바른 glTF 2.0 GLB가 아닙니다.");
  }
  if (Number.isFinite(metadata.bytes) && buffer.byteLength !== metadata.bytes) {
    throw new Error("무료 비둘기 파일 크기가 출처 기록과 다릅니다.");
  }
  return { gltf: await loader.parseAsync(buffer, ""), metadata };
}

export async function loadPigeonAssets(signal) {
  const loader = new GLTFLoader();
  const results = await Promise.allSettled([
    ...Object.entries(URLS).map(async ([kind, url]) => {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error("Pigeon model load failed (" + response.status + ")");
      const data = await response.arrayBuffer();
      return [kind, await loader.parseAsync(data, "")];
    }),
    loadKenchooModel(signal),
  ]);
  const loaded = results.slice(0, 2).filter((result) => result.status === "fulfilled").map((result) => result.value);
  const open = results[2].status === "fulfilled" ? results[2].value : null;
  const failure = results.find((result) => result.status === "rejected");
  if (failure || signal?.aborted) {
    disposeModels([...loaded.map(([, model]) => model), open?.gltf]);
    throw failure?.reason || new DOMException("Pigeon loading aborted", "AbortError");
  }
  const models = Object.fromEntries(loaded);
  return {
    externalSource: open?.metadata || null,
    create(chicken = false) {
      if (!chicken && open) return createOpenPigeon(open.gltf, open.metadata);
      const root = clone(models[chicken ? "chicken" : "normal"].scene);
      root.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = object.name !== "FinePlumage";
          object.receiveShadow = true;
          if (object.isSkinnedMesh) object.frustumCulled = false;
        }
      });
      return bindPigeonRig(root, chicken);
    },
    dispose() { disposeModels([...Object.values(models), open?.gltf]); },
  };
}
