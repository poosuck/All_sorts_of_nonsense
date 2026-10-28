import * as THREE from 'three';
import { featherGeometry, joinGeometry } from '../../../scripts/pigeon-assets/geometry.mjs';

// Small skinned vanes fitted to the imported wing. Source assets stay untouched.
export function installLayeredCoverts(root) {
  const additions = [], geometries = [], materials = [];
  const sources = [];
  root.traverse(mesh => { if (mesh.isSkinnedMesh) sources.push(mesh); });
  for (const mesh of sources) {
    const { position: pos, normal: normals, skinIndex, skinWeight } = mesh.geometry.attributes;
    if (!skinIndex || !skinWeight) continue;
    const feather = featherGeometry(1, .5, .0012, 12, 10);
    geometries.push(feather);
    const material = new THREE.MeshPhysicalMaterial({
      color: '#c5bec4', vertexColors: true, roughness: .88,
      sheen: .2, sheenRoughness: .85, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    materials.push(material);
    const parts = [], joints = [], weights = [], colors = [], lifts = [];
    const surfaceMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const surface = new THREE.Mesh(mesh.geometry, surfaceMaterial);
    surface.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const hitSurface = (side, y, z) => {
      ray.set(new THREE.Vector3(side, y, z), new THREE.Vector3(-side, 0, 0));
      return ray.intersectObject(surface, false)[0];
    };
    for (const side of [-1, 1]) for (let row = 0; row < 5; row++) for (let col = 0; col < 8; col++) {
      const y = .375 - row * .030, z = .09 - col * .041 - (row % 2) * .016;
      const hit = hitSurface(side, y, z);
      if (!hit || Math.abs(hit.point.x) < .055) continue;
      const best = hit.face.a;
      const anchor = hit.point.clone();
      const normal = (hit.normal || hit.face.normal).clone().normalize();
      const growth = new THREE.Vector3(0, -.45, -.9);
      growth.addScaledVector(normal, -growth.dot(normal)).normalize();
      const across = new THREE.Vector3().crossVectors(growth, normal).normalize();
      const matrix = new THREE.Matrix4().makeBasis(across, growth.clone().negate(), normal);
      matrix.scale(new THREE.Vector3(.049 + row * .002, .062 + row * .003, 1));
      matrix.setPosition(anchor.addScaledVector(normal, .002 + row * .0006));
      parts.push({ geometry: feather, matrix });
      lifts.push(.014 + row * .003 + col * .0004);
      const stripe = col === 3 || col === 6;
      const color = new THREE.Color(stripe ? '#424453' : '#c5bec4');
      color.multiplyScalar(1 - .018 * Math.sin(row * 9 + col * 3));
      for (let i = 0; i < feather.attributes.position.count; i++) {
        joints.push(skinIndex.getX(best), skinIndex.getY(best), skinIndex.getZ(best), skinIndex.getW(best));
        weights.push(skinWeight.getX(best), skinWeight.getY(best), skinWeight.getZ(best), skinWeight.getW(best));
        colors.push(...color.toArray());
      }
    }
    const geo = joinGeometry(parts); geometries.push(geo);
    // Fit every vane vertex to the wing, avoiding floating planar tiles.
    const fitted = geo.attributes.position;
    for (let i = 0; i < fitted.count; i++) {
      const side = fitted.getX(i) < 0 ? -1 : 1;
      const hit = hitSurface(side, fitted.getY(i), fitted.getZ(i));
      if (!hit) continue;
      fitted.setX(i, hit.point.x + side * lifts[Math.floor(i / feather.attributes.position.count)]);
      const normal = (hit.normal || hit.face.normal).clone().normalize();
      geo.attributes.normal.setXYZ(i, normal.x, normal.y, normal.z);
      const bary = THREE.Triangle.getBarycoord(hit.point,
        new THREE.Vector3().fromBufferAttribute(pos, hit.face.a),
        new THREE.Vector3().fromBufferAttribute(pos, hit.face.b),
        new THREE.Vector3().fromBufferAttribute(pos, hit.face.c), new THREE.Vector3());
      const blended = new Map();
      for (const [index, fraction] of [[hit.face.a, bary.x], [hit.face.b, bary.y], [hit.face.c, bary.z]]) {
        for (let j = 0; j < 4; j++) {
          const joint = skinIndex.array[index * 4 + j];
          blended.set(joint, (blended.get(joint) || 0) + skinWeight.array[index * 4 + j] * fraction);
        }
      }
      const selected = [...blended].sort((a,b) => b[1] - a[1]).slice(0,4);
      const sum = selected.reduce((s,entry) => s + entry[1], 0) || 1;
      for (let j = 0; j < 4; j++) { joints[i * 4 + j] = selected[j]?.[0] || 0; weights[i * 4 + j] = (selected[j]?.[1] || 0) / sum; }
    }
    surfaceMaterial.dispose();
    geo.setAttribute('skinIndex' , new THREE.Uint16BufferAttribute(joints, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    material.color.set('#ffffff');
    const coverts = new THREE.SkinnedMesh(geo, material);
    coverts.name = 'ReferenceLayeredCoverts';
    coverts.frustumCulled = false; coverts.castShadow = false; coverts.receiveShadow = false;
    coverts.position.copy(mesh.position); coverts.quaternion.copy(mesh.quaternion); coverts.scale.copy(mesh.scale);
    mesh.parent.add(coverts); coverts.bind(mesh.skeleton, mesh.bindMatrix);
    additions.push(coverts);
  }
  return () => {
    for (const mesh of additions) mesh.removeFromParent();
    for (const geo of geometries) geo.dispose();
    for (const material of materials) material.dispose();
  };
}
