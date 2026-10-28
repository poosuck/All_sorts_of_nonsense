// Reversible, non-destructive body reshaping for the original kenchoo rig.
// Positions are in the model's bind-space (meters) before GPU skinning.
// Never adjust head, toes, tail tips, bone transforms, UVs or source assets.
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export function anatomicalWeights(bones, indices, values) {
  const groups = { chest: 0, body: 0, neck: 0, tail: 0, head: 0, legs: 0 };
  for (let k = 0; k < 4; k++) {
    const amount = values[k] || 0;
    const name = bones[indices[k]]?.name || "";
    if (/Head|Jaw/i.test(name)) groups.head += amount;
    else if (/Leg|Toe|Foot|Ankle|Knee/i.test(name)) groups.legs += amount;
    else if (/Chest/i.test(name)) groups.chest += amount;
    else if (/Neck/i.test(name)) groups.neck += amount;
    else if (/Tail/i.test(name)) groups.tail += amount;
    else groups.body += amount;
  }
  return groups;
}

export function sculptPigeonPoint(point, weights, roundness) {
  const strength = clamp01(roundness / 100);
  const tissue = clamp01(weights.chest + weights.body * 0.95 +
    weights.tail * 0.48 + weights.neck * 0.22);
  // Original kenchoo bird: X is width, Y is height, +Z is chest/head.
  const vertical = smooth(0.065, 0.19, point.y) *
    (1 - smooth(0.455, 0.59, point.y));
  const length = smooth(-0.34, -0.11, point.z) *
    (1 - smooth(0.20, 0.345, point.z));
  const field = strength * tissue * vertical * length;
  // Elliptical, rounded belly: widen, deepen and subtly drop the abdomen.
  return {
    x: point.x * (1 + field * 0.92),
    y: 0.305 + (point.y - 0.305) * (1 + field * 0.31) - field * 0.018,
    z: 0.015 + (point.z - 0.015) * (1 + field * 0.40) + field * 0.014,
    influence: field,
  };
}

function normalize(x, y, z) {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

export function installPigeonBodySculpt(root, initialRoundness = 82) {
  const entries = [];
  root.traverse(object => {
    if (!object.isSkinnedMesh || !object.geometry?.attributes?.position) return;
    const geo = object.geometry.clone(); // skinned models share original geometry
    object.geometry = geo;
    const position = geo.attributes.position;
    const normal = geo.attributes.normal;
    const skinIndex = geo.attributes.skinIndex;
    const skinWeight = geo.attributes.skinWeight;
    const original = Float32Array.from(position.array);
    const originalNormal = normal ? Float32Array.from(normal.array) : null;
    const groups = [];
    for (let i = 0; i < position.count; i++) {
      if (skinIndex && skinWeight) {
        groups.push(anatomicalWeights(
          object.skeleton.bones,
          [skinIndex.getX(i), skinIndex.getY(i), skinIndex.getZ(i), skinIndex.getW(i)],
          [skinWeight.getX(i), skinWeight.getY(i), skinWeight.getZ(i), skinWeight.getW(i)],
        ));
      } else groups.push({ body: 1, chest: 0, neck: 0, head: 0, tail: 0, legs: 0 });
    }
    entries.push({ geo, position, normal, original, originalNormal, groups });
  });
  let roundness = 0;
  const setRoundness = value => {
    const numeric = Number(value);
    roundness = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;
    for (const entry of entries) {
      const { geo, position, normal, original, originalNormal, groups } = entry;
      for (let i = 0; i < position.count; i++) {
        const k = i * 3;
        const p = sculptPigeonPoint(
          { x: original[k], y: original[k + 1], z: original[k + 2] },
          groups[i], roundness,
        );
        position.setXYZ(i, p.x, p.y, p.z);
        if (normal) {
          // Approximate inverse-transpose of local ellipsoidal scaling.
          // Preserve the authored normals to avoid introducing UV seam artifacts.
          const [nx, ny, nz] = normalize(
            originalNormal[k] / (1 + 0.92 * p.influence),
            originalNormal[k + 1] / (1 + 0.31 * p.influence),
            originalNormal[k + 2] / (1 + 0.40 * p.influence),
          );
          normal.setXYZ(i, nx, ny, nz);
        }
      }
      position.needsUpdate = true;
      if (normal) normal.needsUpdate = true;
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
    }
  };
  setRoundness(initialRoundness);
  return {
    setRoundness,
    get roundness() { return roundness; },
    dispose() { for (const { geo } of entries) geo.dispose(); },
  };
}
