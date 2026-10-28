import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { bindPigeonRig } from "./rig.js";
import { createReferencePigeon } from "./reference-pigeon.js";

const chickenURL = new URL("../../assets/pigeon/chicken-v3.glb", import.meta.url).href;

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

export async function loadPigeonAssets(signal) {
  const response = await fetch(chickenURL, { signal });
  if (!response.ok) throw new Error(`Pigeon model load failed (${response.status})`);
  const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), "");
  if (signal?.aborted) {
    disposeModels([gltf]);
    throw new DOMException("Pigeon loading aborted", "AbortError");
  }
  return {
    create(chicken = false) {
      if (!chicken) {
        const review = new URLSearchParams(globalThis.location?.search || '').get('pigeon-review') || 'final';
        return createReferencePigeon({ review });
      }
      const root = clone(gltf.scene);
      root.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = object.name !== "FinePlumage";
        object.receiveShadow = true;
        if (object.isSkinnedMesh) object.frustumCulled = false;
      });
      return bindPigeonRig(root, true);
    },
    dispose() { disposeModels([gltf]); },
  };
}
