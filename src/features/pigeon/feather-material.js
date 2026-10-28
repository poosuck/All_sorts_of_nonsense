import * as THREE from "three";

// Non-destructive material treatment. Original color textures and skinning remain intact.
function featherMaps(source) {
  const image = source?.image;
  if (!image || !image.width || !image.height || typeof document === "undefined") return null;
  const width = Math.min(768, image.width), height = Math.min(768, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, width, height);
  let sourceData;
  try { sourceData = ctx.getImageData(0, 0, width, height); }
  catch { return null; }
  const bumpData = ctx.createImageData(width, height);
  const maskData = ctx.createImageData(width, height);
  const src = sourceData.data, bump = bumpData.data, mask = maskData.data;
  const lumas = new Float32Array(width * height);
  for (let i = 0; i < lumas.length; i++) {
    const j = i * 4;
    lumas[i] = (0.2126 * src[j] + 0.7152 * src[j + 1] + 0.0722 * src[j + 2]) / 255;
  }
  function lum(x, y) {
    return lumas[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))];
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, j = i * 4;
    const r = src[j] / 255, g = src[j + 1] / 255, b = src[j + 2] / 255;
    const greenNeck = g > r * 1.13 && g > b * 1.04 && g > 0.16;
    const purpleNeck = b > g * 0.92 && r > g * 1.05 && b > 0.12 && r < 0.60;
    const neck = greenNeck || purpleNeck;
    const fine = lum(x, y) - (lum(x - 2, y) + lum(x + 2, y) + lum(x, y - 2) + lum(x, y + 2)) * 0.25;
    const relief = THREE.MathUtils.clamp(0.5 + fine * 1.8, 0, 1);
    bump[j] = bump[j + 1] = bump[j + 2] = Math.round(relief * 255);
    bump[j + 3] = 255;
    // Same mask drives selective iridescence (R) and roughness (G).
    mask[j] = neck ? 225 : 0;
    mask[j + 1] = neck ? 72 : (lum(x, y) < 0.20 ? 210 : 188);
    mask[j + 2] = 255;
    mask[j + 3] = 255;
  }
  const maps = [];
  for (const data of [bumpData, maskData]) {
    const c = document.createElement("canvas"); c.width = width; c.height = height;
    c.getContext("2d").putImageData(data, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.flipY = source.flipY;
    t.wrapS = source.wrapS; t.wrapT = source.wrapT;
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = 4;
    t.needsUpdate = true;
    maps.push(t);
  }
  return { bump: maps[0], properties: maps[1] };
}

export function enhancePigeonPlumage(root) {
  const materials = new Map(), created = new Set(), auxiliary = [];
  root.traverse((object) => {
    if (!object.isMesh || !object.material) return;
    object.material = [object.material].flat().map((original) => {
      if (materials.has(original)) return materials.get(original);
      // Keep the complete original color atlas and UVs.
      const material = new THREE.MeshPhysicalMaterial({
        name: original.name + " · feather shading",
        map: original.map || null,
        side: original.side,
        transparent: original.transparent,
        alphaTest: original.alphaTest,
        color: original.color,
        metalness: 0.0,
        roughness: 0.78,
        envMapIntensity: 0.72,
        iridescence: 0.65,
        iridescenceIOR: 1.22,
        iridescenceThicknessRange: [110, 260],
      });
      const maps = featherMaps(original.map);
      if (maps) {
        material.bumpMap = maps.bump;
        material.bumpScale = 0.018;
        material.roughnessMap = maps.properties;
        material.iridescenceMap = maps.properties;
        auxiliary.push(maps.bump, maps.properties);
      } else {
        material.iridescence = 0;
      }
      material.userData.originalLicense = "CC-BY-4.0";
      materials.set(original, material); created.add(material);
      return material;
    });
    if (object.material.length === 1) object.material = object.material[0];
  });
  return () => {
    for (const m of created) m.dispose();
    for (const t of auxiliary) t.dispose();
  };
}
