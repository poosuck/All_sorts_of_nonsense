import * as THREE from "three";

export function seededRandom(seed = 4201) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function makeTexture(draw, width = 512, height = width) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createResourcePool() {
  const geometries = new Map();
  const materials = new Set();
  const textures = new Set();
  return {
    geometry(name, create) {
      if (!geometries.has(name)) geometries.set(name, create());
      return geometries.get(name);
    },
    material(options) {
      const value = new THREE.MeshStandardMaterial(options);
      materials.add(value);
      return value;
    },
    texture(value) { textures.add(value); return value; },
    dispose() {
      for (const value of geometries.values()) value.dispose();
      for (const value of materials) value.dispose();
      for (const value of textures) value.dispose();
      geometries.clear(); materials.clear(); textures.clear();
    },
  };
}

export function mesh(pool, geometry, material, position, scale, parent) {
  const value = new THREE.Mesh(geometry, material);
  if (position) value.position.set(...position);
  if (scale) value.scale.set(...scale);
  value.castShadow = true;
  value.receiveShadow = true;
  parent?.add(value);
  return value;
}

export function connect(meshValue, start, end, radius) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  meshValue.position.copy(a).add(b).multiplyScalar(0.5);
  meshValue.scale.set(radius, a.distanceTo(b), radius);
  meshValue.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
}
