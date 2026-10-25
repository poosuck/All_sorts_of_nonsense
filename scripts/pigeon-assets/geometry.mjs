import * as THREE from "three";

const up = new THREE.Vector3(0, 1, 0);

// A curved vane with a raised shaft; the actual outline replaces ellipsoid blades.
export function featherGeometry(length = 1, width = .2, curve = .045, rows = 9, cols = 4) {
  const positions = [], uvs = [], indices = [];
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    const root = Math.sqrt(Math.min(1, v / .12));
    const tip = v > .78 ? Math.sqrt(Math.max(0, 1 - ((v - .78) / .22) ** 2)) : 1;
    const outline = root * tip * (.85 + .15 * v);
    for (let col = 0; col <= cols; col++) {
      const u = col / cols * 2 - 1;
      const asymmetry = u < 0 ? .76 : 1;
      positions.push(u * width * outline * asymmetry, -v * length, curve * Math.sin(v * Math.PI) * (1 - u * u) + .0015 * Math.exp(-u * u * 50) * Math.sin(v * Math.PI));
      uvs.push(col / cols, 1 - v);
      if (row < rows && col < cols) {
        const i = row * (cols + 1) + col;
        indices.push(i, i + cols + 1, i + 1, i + 1, i + cols + 1, i + cols + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function joinGeometry(parts) {
  const positions = [], normals = [], uvs = [], indices = [];
  for (const { geometry, matrix } of parts) {
    const base = positions.length / 3;
    const p = geometry.getAttribute("position"), n = geometry.getAttribute("normal"), uv = geometry.getAttribute("uv");
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    for (let i = 0; i < p.count; i++) {
      positions.push(...new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(matrix).toArray());
      normals.push(...new THREE.Vector3().fromBufferAttribute(n, i).applyMatrix3(normalMatrix).normalize().toArray());
      uvs.push(uv.getX(i), uv.getY(i));
    }
    const index = geometry.getIndex();
    if (index) for (let i = 0; i < index.count; i++) indices.push(base + index.getX(i));
    else for (let i = 0; i < p.count; i++) indices.push(base + i);
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  result.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  result.setIndex(indices);
  return result;
}

export function aimSegment(mesh, start, end, radius) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.scale.set(radius, a.distanceTo(b), radius);
  mesh.quaternion.setFromUnitVectors(up, b.sub(a).normalize());
}
