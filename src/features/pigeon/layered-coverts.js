import * as THREE from 'three';

// Rounded surface-following feathers. Each vertex samples the same source triangle
// for position, skin weights and morph deltas, avoiding floating or torn patches.
export function installLayeredCoverts(root) {
  const additions = [], owned = [];
  const sources = [];
  root.traverse(mesh => { if (mesh.isSkinnedMesh) sources.push(mesh); });
  for (const mesh of sources) {
    const { position: source, skinIndex, skinWeight } = mesh.geometry.attributes;
    if (!skinIndex || !skinWeight) continue;
    const probeMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const probe = new THREE.Mesh(mesh.geometry, probeMaterial);
    probe.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const positions = [], indices = [], colors = [], joints = [], weights = [];
    const sourceMorphs = mesh.geometry.morphAttributes.position || [];
    const morphs = sourceMorphs.map(() => []);
    const vertex = (side, y, z, lift, shade) => {
      ray.set(new THREE.Vector3(side, y, z), new THREE.Vector3(-side, 0, 0));
      const hit = ray.intersectObject(probe, false)[0];
      if (!hit || Math.abs(hit.point.x) < .045) return -1;
      const vertices = [hit.face.a, hit.face.b, hit.face.c];
      const bary = THREE.Triangle.getBarycoord(hit.point,
        ...vertices.map(i => new THREE.Vector3().fromBufferAttribute(source, i)), new THREE.Vector3());
      const fractions = [bary.x, bary.y, bary.z];
      const blended = new Map();
      for (let v = 0; v < 3; v++) for (let j = 0; j < 4; j++) {
        const i = vertices[v] * 4 + j, joint = skinIndex.array[i];
        blended.set(joint, (blended.get(joint) || 0) + skinWeight.array[i] * fractions[v]);
      }
      const selected = [...blended].sort((a,b) => b[1] - a[1]).slice(0,4);
      const sum = selected.reduce((s,e) => s + e[1], 0) || 1;
      const index = positions.length / 3;
      positions.push(hit.point.x + side * lift, y, z);
      for (let j = 0; j < 4; j++) { joints.push(selected[j]?.[0] || 0); weights.push((selected[j]?.[1] || 0) / sum); }
      // Two continuous curved bands, not alternating dark polygon tiles.
      const axis = z + (y - .30) * .5;
      const band = Math.min(Math.abs(axis + .13), Math.abs(axis + .255)) < .013;
      const color = new THREE.Color(band ? '#41414e' : '#beb7bc');
      color.multiplyScalar(shade); colors.push(...color.toArray());
      sourceMorphs.forEach((attribute, m) => {
        const p = new THREE.Vector3();
        vertices.forEach((i,v) => p.addScaledVector(new THREE.Vector3().fromBufferAttribute(attribute,i), fractions[v]));
        if (!mesh.geometry.morphTargetsRelative) p.x += side * lift;
        morphs[m].push(...p.toArray());
      });
      return index;
    };
    for (const side of [-1,1]) for (let row = 0; row < 9; row++) for (let col = 0; col < 12; col++) {
      const cy = .425 - row * .025;
      const cz = .135 - col * .038 + (row % 2) * .019;
      // One oval wing envelope, broad at the shoulder and tapering at the tail.
      if (((cy - .32) / .125) ** 2 + ((cz + .09) / .255) ** 2 > 1) continue;
      const grid = [];
      const length = .043 + row * .0015, width = .023;
      for (let r = 0; r <= 10; r++) {
        const t = r / 10, outline = Math.pow(Math.sin(Math.PI * t), .55);
        const line = [];
        for (let c = 0; c <= 8; c++) {
          const u = c / 8 * 2 - 1;
          const y = cy - t * length, z = cz + u * width * outline - t * .012;
          const dome = Math.sin(t * Math.PI) * (1-u*u);
          line.push(vertex(side, y, z, .0035 + (8-row) * .0007 + dome * .0025, .97 + dome * .055));
        }
        grid.push(line);
      }
      for (let r = 0; r < 10; r++) for (let c = 0; c < 8; c++) {
        const a = grid[r][c], b = grid[r+1][c], d = grid[r][c+1], e = grid[r+1][c+1];
        if (Math.min(a,b,d,e) < 0) continue;
        indices.push(a,b,d,d,b,e);
      }
    }
    probeMaterial.dispose();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(joints,4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights,4));
    geo.setIndex(indices); geo.computeVertexNormals();
    geo.morphTargetsRelative = mesh.geometry.morphTargetsRelative;
    geo.morphAttributes.position = morphs.map(values => new THREE.Float32BufferAttribute(values,3));
    const material = new THREE.MeshPhysicalMaterial({ color:'#ffffff', vertexColors:true,
      roughness:.87, sheen:.18, sheenRoughness:.9, side:THREE.DoubleSide });
    const coverts = new THREE.SkinnedMesh(geo,material);
    coverts.name = 'ReferenceLayeredCoverts'; coverts.frustumCulled = false;
    coverts.castShadow = false; coverts.receiveShadow = true;
    coverts.position.copy(mesh.position); coverts.quaternion.copy(mesh.quaternion); coverts.scale.copy(mesh.scale);
    mesh.parent.add(coverts); coverts.bind(mesh.skeleton,mesh.bindMatrix);
    if (mesh.morphTargetInfluences) coverts.morphTargetInfluences = mesh.morphTargetInfluences;
    additions.push(coverts); owned.push(geo, material);
  }
  return () => { additions.forEach(mesh=>mesh.removeFromParent()); owned.forEach(value=>value.dispose()); };
}
