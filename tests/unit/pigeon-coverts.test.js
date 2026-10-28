import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installLayeredCoverts } from '../../src/features/pigeon/layered-coverts.js';
import { installPigeonBodySculpt } from '../../src/features/pigeon/pigeon-body-shape.js';

test('layered coverts follow the skinned surface and survive reversible roundness changes', () => {
  const geo = new THREE.SphereGeometry(1, 24, 16);
  geo.scale(.11, .18, .28); geo.translate(0, .30, -.03);
  const count = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) weights[i * 4] = 1;
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const original = Float32Array.from(geo.attributes.position.array);
  const mat = new THREE.MeshStandardMaterial();
  const mesh = new THREE.SkinnedMesh(geo, mat);
  const bone = new THREE.Bone(); bone.name = 'Chicken_Chest'; mesh.add(bone);
  mesh.bind(new THREE.Skeleton([bone]));
  const root = new THREE.Group(); root.add(mesh);
  const release = installLayeredCoverts(root);
  const coverts = root.getObjectByName('ReferenceLayeredCoverts');
  assert.ok(coverts?.isSkinnedMesh);
  assert.equal(coverts.skeleton, mesh.skeleton);
  const attrs = coverts.geometry.attributes;
  assert.ok(attrs.position.count > 100);
  for (let i = 0; i < attrs.position.count; i++) {
    const sum = [0,1,2,3].reduce((s,j) => s + attrs.skinWeight.array[i * 4 + j], 0);
    assert.ok(Math.abs(sum - 1) < 1e-5);
    assert.ok([attrs.position.getX(i),attrs.position.getY(i),attrs.position.getZ(i)].every(Number.isFinite));
  }
  const sculpt = installPigeonBodySculpt(root, 82);
  sculpt.setRoundness(0); sculpt.setRoundness(100); sculpt.setRoundness(0);
  assert.deepEqual(geo.attributes.position.array, original, 'source geometry is unchanged');
  sculpt.dispose(); release();
  assert.equal(root.getObjectByName('ReferenceLayeredCoverts'), undefined);
  geo.dispose(); mat.dispose(); mesh.skeleton.dispose();
});
