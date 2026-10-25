import * as THREE from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { seededRandom } from "../../src/features/pigeon/resources.js";

export const ANATOMY = {
  normal: { neckY: .94, neckZ: .30, headY: 1.35, headZ: .48, headRadius: .235, peckDrop: 1.2, peckReach: .22, wingY: .94, wingX: .43, width: .57 },
  chicken: { neckY: 1.02, neckZ: .50, headY: 1.30, headZ: .60, headRadius: .24, peckDrop: 2.17, peckReach: .38, wingY: 1.02, wingX: .76, width: 1.00 },
};

const union = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * .25;
};
function ellipsoid(x, y, z, center, radii) {
  const px = x - center[0], py = y - center[1], pz = z - center[2];
  const k0 = Math.hypot(px / radii[0], py / radii[1], pz / radii[2]);
  const k1 = Math.hypot(px / radii[0] ** 2, py / radii[1] ** 2, pz / radii[2] ** 2);
  if (k1 < .00001) return -Math.min(...radii);
  return k0 * (k0 - 1) / Math.max(k1, .00001);
}
export function signedDistance(kind, x, y, z) {
  const chicken = kind === "chicken", a = ANATOMY[kind];
  const body = ellipsoid(x, y, z, [0, chicken ? .66 : .71, -.17], chicken ? [1.00, .61, 1.06] : [.565, .49, .81]);
  const breast = ellipsoid(x, y, z, [0, chicken ? .66 : .72, chicken ? .40 : .30], chicken ? [.82, .58, .74] : [.465, .49, .50]);
  const neck = ellipsoid(x, y, z, [0, chicken ? 1.16 : 1.08, chicken ? .49 : .40], chicken ? [.335, .32, .31] : [.25, .315, .265]);
  const head = ellipsoid(x, y, z, [0, a.headY, a.headZ], [a.headRadius, .265, .255]);
  const skin = union(union(union(body, breast, .20), neck, .15), head, .12);
  return Math.max(skin, (chicken ? .055 : .205) - y);
}
export function flankX(kind, y, z) {
  if (signedDistance(kind, 0, y, z) >= 0) return .08;
  let low = 0, high = kind === "chicken" ? 1.2 : .8;
  for (let i = 0; i < 18; i++) {
    const mid = (low + high) / 2;
    if (signedDistance(kind, mid, y, z) < 0) low = mid; else high = mid;
  }
  return (low + high) / 2;
}
export function weightsAt(point, kind) {
  const a = ANATOMY[kind];
  // The dorsal surface stays on the body. Height-only weights bend the entire
  // back into a hump when the neck pecks; include the forward neck volume.
  const forward = THREE.MathUtils.smoothstep(point.z, kind === "chicken" ? .08 : -.05, kind === "chicken" ? .40 : .25);
  const neck = THREE.MathUtils.smoothstep(point.y, a.neckY - .04, a.neckY + .26) * forward;
  const head = THREE.MathUtils.smoothstep(point.y, a.headY - .14, a.headY + .035);
  return [1 - neck, neck * (1 - head), neck * head, 0];
}
export function colorAt(point, kind) {
  const a = ANATOMY[kind];
  const front = THREE.MathUtils.smoothstep(point.z, -.5, .55);
  const color = new THREE.Color("#959da9").lerp(new THREE.Color("#ddd9d4"), front * .85);
  color.lerp(new THREE.Color("#e0dcd5"), (1 - THREE.MathUtils.smoothstep(point.y, .3, .75)) * .35);
  const forward = THREE.MathUtils.smoothstep(point.z, -.08, a.neckZ);
  const neck = THREE.MathUtils.smoothstep(point.y, a.neckY + .02, a.neckY + .17) * (1 - THREE.MathUtils.smoothstep(point.y, a.headY - .03, a.headY + .10)) * forward;
  const throat = new THREE.Color("#694073").lerp(new THREE.Color("#24675b"), THREE.MathUtils.smoothstep(point.y, a.neckY + .14, a.headY - .04));
  color.lerp(throat, neck);
  color.lerp(new THREE.Color("#444e60"), THREE.MathUtils.smoothstep(point.y, a.headY - .04, a.headY + .12));
  return color;
}
function surfaceUV(point, kind) {
  const a = ANATOMY[kind];
  const centerZ = THREE.MathUtils.lerp(-.17, a.headZ, THREE.MathUtils.smoothstep(point.y, .8, a.headY));
  return [(Math.atan2(point.x, point.z - centerZ) / (Math.PI * 2) + .5) * 3, point.y * 2.2];
}

export function sculptBody(kind) {
  const resolution = 64, half = resolution / 2;
  const marching = new MarchingCubes(resolution, new THREE.MeshBasicMaterial(), false, false, 50000);
  marching.isolation = 0;
  for (let z = 0; z < resolution; z++) for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
    const px = (x - half) / half * 1.35, py = (y - half) / half * 1.04 + .92, pz = (z - half) / half * 1.5;
    marching.field[z * resolution ** 2 + y * resolution + x] = -signedDistance(kind, px, py, pz);
  }
  marching.update();
  const source = marching.geometry.attributes.position;
  const positions = [], uvs = [], colors = [], joints = [], weights = [];
  for (let i = 0; i < marching.count; i++) {
    const point = new THREE.Vector3(source.getX(i) * 1.35, source.getY(i) * 1.04 + .92, source.getZ(i) * 1.5);
    positions.push(...point.toArray()); uvs.push(...surfaceUV(point, kind));
    colors.push(...colorAt(point, kind).toArray()); joints.push(0, 1, 2, 0); weights.push(...weightsAt(point, kind));
  }
  // Keep triangles crossing the longitude seam from sampling the whole texture.
  for (let i = 0; i < uvs.length; i += 6) {
    const values = [uvs[i], uvs[i + 2], uvs[i + 4]];
    if (Math.max(...values) - Math.min(...values) > 1.5) for (let j = 0; j < 6; j += 2) if (uvs[i + j] < 1.5) uvs[i + j] += 3;
  }
  const raw = new THREE.BufferGeometry();
  raw.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  raw.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  raw.setAttribute("uv1", new THREE.Float32BufferAttribute(positions.flatMap((_, i) => i % 3 === 0 ? [.5, positions[i + 1] / 2] : []), 2));
  raw.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  raw.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(joints, 4));
  raw.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  const geometry = mergeVertices(raw, 1e-5); geometry.computeVertexNormals();
  raw.dispose(); marching.geometry.dispose(); marching.material.dispose();
  geometry.clearGroups();
  return geometry;
}

export function softFilaments(bodyGeometry, kind) {
  const random = seededRandom(kind === "chicken" ? 723 : 419);
  const indexed = bodyGeometry.toNonIndexed();
  const p = indexed.attributes.position, n = indexed.attributes.normal;
  const cdf = [], areas = [];
  let area = 0;
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1), c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    area += b.sub(a).cross(c.sub(a)).length() * .5; cdf.push(area); areas.push(i);
  }
  const positions = [], normals = [], uvs = [], colors = [], joints = [], weights = [];
  const tufts = kind === "chicken" ? 3000 : 2100;
  for (let k = 0; k < tufts; k++) {
    const target = random() * area;
    let lo = 0, hi = cdf.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < target) lo = mid + 1; else hi = mid; }
    const i = areas[lo], u = Math.sqrt(random()), v = random();
    const bary = [1 - u, u * (1 - v), u * v];
    const anchor = new THREE.Vector3(), normal = new THREE.Vector3();
    for (let j = 0; j < 3; j++) { anchor.addScaledVector(new THREE.Vector3().fromBufferAttribute(p, i + j), bary[j]); normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(n, i + j), bary[j]); }
    normal.normalize();
    if (anchor.y < .13) continue;
    // Folded wings cover flank down; hidden filaments must not poke through it.
    if (Math.abs(normal.x) > .45 && anchor.z < .30 && anchor.y > .40 && anchor.y < 1.28) continue;
    const growth = new THREE.Vector3(0, -.8, -.35); growth.addScaledVector(normal, -growth.dot(normal)).normalize();
    const across = new THREE.Vector3().crossVectors(growth, normal).normalize();
    const length = (.008 + random() * .014) * (anchor.y > 1.3 ? .55 : 1);
    for (let strand = 0; strand < 3; strand++) {
      const root = anchor.clone().addScaledVector(across, (strand - 1) * .003).addScaledVector(normal, .001);
      const tip = root.clone().addScaledVector(growth, length).addScaledVector(normal, .003 + random() * .005);
      for (const point of [root.clone().addScaledVector(across, -.0012), root.clone().addScaledVector(across, .0012), tip]) {
        positions.push(...point.toArray()); normals.push(...normal.toArray()); uvs.push(...surfaceUV(point, kind)); colors.push(...colorAt(point, kind).toArray()); joints.push(0, 1, 2, 0); weights.push(...weightsAt(point, kind));
      }
    }
  }
  indexed.dispose();
  const geometry = new THREE.BufferGeometry();
  for (const [name, array, size] of [["position", positions, 3], ["normal", normals, 3], ["uv", uvs, 2], ["color", colors, 3], ["skinWeight", weights, 4]]) geometry.setAttribute(name, new THREE.Float32BufferAttribute(array, size));
  geometry.setAttribute("uv1", new THREE.Float32BufferAttribute(positions.flatMap((_, i) => i % 3 === 0 ? [.5, positions[i + 1] / 2] : []), 2));
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(joints, 4));
  return geometry;
}
