import * as THREE from "three";

export const PROFILES = {
  normal: [
    [.21, .025, .09, -.10], [.27, .29, .45, -.10], [.40, .47, .66, -.13],
    [.62, .57, .77, -.18], [.85, .55, .74, -.20], [1.05, .46, .59, -.13],
    [1.21, .32, .39, .08], [1.36, .235, .25, .25], [1.50, .265, .27, .30],
    [1.64, .235, .245, .31], [1.74, .13, .15, .30], [1.775, .003, .003, .29],
  ],
  chicken: [
    [.10, .035, .12, -.14], [.16, .48, .69, -.17], [.31, .79, .96, -.22],
    [.56, .96, 1.05, -.27], [.82, .93, 1.01, -.28], [1.04, .79, .85, -.25],
    [1.22, .55, .60, -.10], [1.35, .35, .39, .16], [1.47, .265, .28, .32],
    [1.61, .27, .275, .35], [1.74, .23, .245, .35], [1.83, .13, .15, .34],
    [1.865, .003, .003, .33],
  ],
};
const up = new THREE.Vector3(0, 1, 0);
const forward = new THREE.Vector3(0, 0, 1);

export function createSurface(kind) {
  const profile = PROFILES[kind];
  const radii = new THREE.CatmullRomCurve3(profile.map(([y, x, z]) => new THREE.Vector3(x, y, z)), false, "centripetal");
  const centers = new THREE.CatmullRomCurve3(profile.map(([y, , , z]) => new THREE.Vector3(0, y, z)), false, "centripetal");
  function position(t, theta) {
    const r = radii.getPoint(THREE.MathUtils.clamp(t, 0, 1));
    const c = centers.getPoint(THREE.MathUtils.clamp(t, 0, 1));
    return new THREE.Vector3(Math.sin(theta) * Math.max(.003, r.x), r.y, c.z + Math.cos(theta) * Math.max(.003, r.z));
  }
  return {
    height: profile.at(-1)[0], position,
    normal(t, theta) {
      const a = position(t, theta + .001).sub(position(t, theta - .001));
      const b = position(t + .001, theta).sub(position(t - .001, theta));
      return a.cross(b).normalize();
    },
  };
}

export function skinWeight(y, kind) {
  const base = kind === "chicken" ? 1.15 : 1.02;
  const neck = THREE.MathUtils.smoothstep(y, base, base + .29);
  const head = THREE.MathUtils.smoothstep(y, base + .34, base + .49);
  return [1 - neck, neck * (1 - head), neck * head, 0];
}

export function bodyGeometry(surface, kind) {
  const positions = [], uvs = [], indices = [], bones = [], weights = [];
  const rows = 64, columns = 64;
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= columns; col++) {
      const point = surface.position(row / rows, col / columns * Math.PI * 2);
      positions.push(...point.toArray());
      uvs.push(col / columns, point.y / surface.height);
      bones.push(0, 1, 2, 0); weights.push(...skinWeight(point.y, kind));
      if (row < rows && col < columns) {
        const i = row * (columns + 1) + col;
        indices.push(i, i + 1, i + columns + 1, i + 1, i + columns + 2, i + columns + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(bones, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const normals = geometry.getAttribute("normal");
  for (let row = 0; row <= rows; row++) {
    const a = row * (columns + 1), b = a + columns;
    const normal = new THREE.Vector3().fromBufferAttribute(normals, a).add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize();
    normals.setXYZ(a, ...normal.toArray()); normals.setXYZ(b, ...normal.toArray());
  }
  return geometry;
}

// A curved vane with a raised shaft; the actual outline replaces ellipsoid blades.
export function featherGeometry(length = 1, width = .2, curve = .045, rows = 9, cols = 4) {
  const positions = [], uvs = [], indices = [];
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    const outline = Math.pow(Math.sin(Math.PI * (.035 + .93 * v)), .68) * (1 - .35 * v);
    for (let col = 0; col <= cols; col++) {
      const u = col / cols * 2 - 1;
      positions.push(u * width * outline, -v * length, curve * Math.sin(v * Math.PI) * (1 - .65 * Math.abs(u)));
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

export function plumageGeometry(surface, kind) {
  const positions = [], normals = [], uvs = [], indices = [], bones = [], weights = [];
  const feather = featherGeometry(1, 1, .04, 4, 2);
  const source = feather.getAttribute("position"), normal = feather.getAttribute("normal");
  const rows = kind === "chicken" ? 31 : 28, columns = 52;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const t = .09 + row / rows * .62;
      const theta = (col + (row % 2) * .5) / columns * Math.PI * 2;
      const anchor = surface.position(t, theta);
      const n = surface.normal(t, theta);
      const orientation = new THREE.Quaternion().setFromUnitVectors(forward, n);
      const scale = kind === "chicken" ? 1.2 : 1;
      const length = (.055 + .012 * Math.sin(theta) ** 2) * scale;
      const width = .018 * scale;
      const start = positions.length / 3;
      for (let i = 0; i < source.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(source, i);
        point.multiply(new THREE.Vector3(width, length, .055)).applyQuaternion(orientation).add(anchor).addScaledVector(n, .0015);
        positions.push(...point.toArray());
        // Fine body feathers follow the underlying surface shading; strong per-petal
        // highlights made the first bake resemble scales rather than soft plumage.
        normals.push(...n.toArray());
        uvs.push(theta / (Math.PI * 2), point.y / surface.height);
        bones.push(0, 1, 2, 0); weights.push(...skinWeight(point.y, kind));
      }
      for (let i = 0; i < feather.index.count; i++) indices.push(start + feather.index.getX(i));
    }
  }
  feather.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(bones, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  geometry.setIndex(indices);
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
