import * as THREE from "three";

export const SHAPE_GROUPS = [
  { label: "머리", controls: [
    { key: "headWidth", label: "머리 좌우 폭", min: -25, max: 25 },
    { key: "headHeight", label: "머리 높이", min: -25, max: 25 },
    { key: "headDepth", label: "머리 앞뒤 길이", min: -25, max: 25 },
    { key: "headForward", label: "머리 앞뒤 위치", min: -6, max: 6, step: 0.5, hint: "+ 앞쪽 / − 뒤쪽 · 전체 높이 대비 %" },
    { key: "rearSkull", label: "뒤통수 볼륨", min: -4, max: 4, step: 0.5, hint: "+ 돌출 / − 축소 · 전체 높이 대비 %" },
    { key: "eyeSize", label: "눈 크기", min: -20, max: 30 },
    { key: "beakLength", label: "부리 길이", min: -25, max: 35 },
  ] },
  { label: "목과 몸통 연결", controls: [
    { key: "neckWidth", label: "목 좌우 폭", min: -25, max: 25 },
    { key: "nape", label: "뒷목 볼륨", min: -5, max: 5, step: 0.5, hint: "+ 채우기 / − 줄이기 · 전체 높이 대비 %" },
    { key: "throat", label: "턱 아래·앞목", min: -4, max: 4, step: 0.5, hint: "+ 채우기 / − 들어가기 · 전체 높이 대비 %" },
    { key: "breast", label: "가슴 앞쪽 볼륨", min: -5, max: 5, step: 0.5, hint: "+ 부풀리기 / − 줄이기 · 전체 높이 대비 %" },
  ] },
  { label: "몸통", controls: [
    { key: "bodyWidth", label: "몸통 좌우 폭", min: -20, max: 20 },
    { key: "bodyDepth", label: "몸통 앞뒤 길이", min: -20, max: 20 },
  ] },
];
const controls = SHAPE_GROUPS.flatMap(group => group.controls);
export const DEFAULT_SHAPE = Object.freeze(Object.fromEntries(controls.map(control => [control.key, 0])));

export function validateShape(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("조정값 형식이 올바르지 않습니다.");
  const result = {};
  for (const control of controls) {
    const number = value[control.key];
    if (typeof number !== "number" || !Number.isFinite(number) || number < control.min || number > control.max) {
      throw new Error(`${control.label} 값이 허용 범위를 벗어났습니다.`);
    }
    result[control.key] = number;
  }
  return result;
}

const smooth = (a, b, value) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const bump = (value, center, radius) => {
  const t = Math.min(1, Math.abs((value - center) / radius));
  return 1 - smooth(0, 1, t);
};

// Coordinates are the original viewer's world space: Y up, Z toward the bill.
// Every mesh (including feathers) samples the same continuous deformation field.
// Always read immutable baseline vertices: changes never accumulate rounding drift.
export function deformPoint(point, shape) {
  const { x, y, z } = point;
  const head = smooth(0.73, 0.88, y);
  const neck = bump(y, 0.755, 0.20);
  const torso = smooth(0.12, 0.25, y) * (1 - smooth(0.52, 0.72, y));
  const rear = 1 - smooth(0.02, 0.22, z);
  const front = smooth(0.20, 0.34, z);
  return {
    x: x * (1 + shape.headWidth / 100 * head + shape.neckWidth / 100 * neck + shape.bodyWidth / 100 * torso),
    y: y + (y - 0.84) * shape.headHeight / 100 * head,
    z: z + (z - 0.20) * shape.headDepth / 100 * head + shape.headForward / 100 * head
      - shape.rearSkull / 100 * bump(y, 0.91, 0.12) * rear
      - shape.nape / 100 * bump(y, 0.75, 0.17) * rear
      + shape.throat / 100 * bump(y, 0.83, 0.10) * front
      + shape.breast / 100 * bump(y, 0.52, 0.25) * front
      + (z + 0.03) * shape.bodyDepth / 100 * torso,
  };
}

export function createShapeEditor(root) {
  root.updateMatrixWorld(true);
  const records = [], eyes = {};
  root.traverse(node => {
    if (!node.isMesh) return;
    // glTF primitives can share buffers; editing must not deform a shared buffer twice.
    node.geometry = node.geometry.clone();
    const position = node.geometry.attributes.position;
    const baseline = position.array.slice();
    const world = new Float32Array(position.count * 3);
    const vector = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      vector.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld).toArray(world, i * 3);
    }
    records.push({ node, baseline, world, inverse: node.matrixWorld.clone().invert(), normals: node.geometry.attributes.normal?.array.slice() });
    if (node.name.startsWith("Eye_globe_")) {
      eyes[node.name.endsWith("Left") ? "Left" : "Right"] = new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3());
    }
  });
  const vector = new THREE.Vector3();
  function apply(input) {
    const shape = validateShape(input);
    const neutral = Object.values(shape).every(value => value === 0);
    for (const { node, baseline, world, inverse, normals } of records) {
      const geometry = node.geometry, position = geometry.attributes.position;
      if (neutral) {
        position.array.set(baseline);
        if (normals) { geometry.attributes.normal.array.set(normals); geometry.attributes.normal.needsUpdate = true; }
      } else {
        const eye = /^(Eye_globe_|Eyelid_surface_|Pupil_landmark_)/.test(node.name)
          ? eyes[node.name.endsWith("Left") ? "Left" : "Right"] : null;
        const bill = /^(Beak_|Cere_)/.test(node.name);
        for (let i = 0; i < position.count; i++) {
          vector.fromArray(world, i * 3);
          if (eye) vector.sub(eye).multiplyScalar(1 + shape.eyeSize / 100).add(eye);
          if (bill) vector.z = 0.32 + (vector.z - 0.32) * (1 + shape.beakLength / 100);
          const point = deformPoint(vector, shape);
          vector.set(point.x, point.y, point.z).applyMatrix4(inverse);
          position.setXYZ(i, vector.x, vector.y, vector.z);
        }
        geometry.computeVertexNormals();
      }
      position.needsUpdate = true;
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    }
  }
  return { apply };
}
