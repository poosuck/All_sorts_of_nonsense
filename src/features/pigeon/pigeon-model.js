import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { bindPigeonRig } from "./rig.js";

const URLs = {
  normal: new URL("../../assets/pigeon/normal-v2.glb", import.meta.url).href,
  chicken: new URL("../../assets/pigeon/chicken-v2.glb", import.meta.url).href,
};

function disposeModels(models) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  for (const model of models) model?.scene.traverse((object) => {
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

export async function loadPigeonAssets(signal) {
  const loader = new GLTFLoader();
  const results = await Promise.allSettled(Object.entries(URLs).map(async ([kind, url]) => {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Pigeon model load failed (${response.status})`);
    const data = await response.arrayBuffer();
    return [kind, await loader.parseAsync(data, "")];
  }));
  const loaded = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
  const failure = results.find((result) => result.status === "rejected");
  if (failure || signal?.aborted) {
    disposeModels(loaded.map(([, model]) => model));
    throw failure?.reason || new DOMException("Pigeon loading aborted", "AbortError");
  }
  const models = Object.fromEntries(loaded);
  return {
    create(chicken = false) {
      const root = clone(models[chicken ? "chicken" : "normal"].scene);
      root.traverse((object) => { if (object.isMesh) { object.castShadow = object.name !== "FinePlumage"; object.receiveShadow = true; if (object.isSkinnedMesh) object.frustumCulled = false; } });
      return bindPigeonRig(root, chicken);
    },
    dispose() { disposeModels(Object.values(models)); },
  };
}
