import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createShapeEditor, DEFAULT_SHAPE, deformPoint, validateShape } from "../../src/features/pigeon/shape-editor.js";

test("shape field preserves the baseline and grounded feet, rejects incompatible values", () => {
  const point = { x: 0.12, y: 0.9, z: 0.18 };
  assert.deepEqual(deformPoint(point, DEFAULT_SHAPE), point);
  const extreme = { ...DEFAULT_SHAPE, headWidth: 25, nape: 5, bodyWidth: 20, headForward: 6 };
  const foot = { x: 0.08, y: 0.06, z: 0.2 };
  assert.deepEqual(deformPoint(foot, extreme), foot);
  assert.throws(() => validateShape({ ...DEFAULT_SHAPE, headWidth: NaN }));
  assert.throws(() => validateShape({ ...DEFAULT_SHAPE, nape: 90 }));
  assert.throws(() => validateShape({ headWidth: 1 }));
});

test("transformed meshes share the same field, changes are reversible and do not accumulate", () => {
  const root = new THREE.Group();
  root.scale.setScalar(1.7); root.position.y = 0.02;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8));
  mesh.name = "Body_neck_head_continuous";
  mesh.position.set(0, 0.5, 0.1); root.add(mesh);
  const original = mesh.geometry.attributes.position.array.slice();
  const editor = createShapeEditor(root);
  const shape = { ...DEFAULT_SHAPE, headWidth: 20, headHeight: -15, nape: 3 };
  editor.apply(shape);
  const first = mesh.geometry.attributes.position.array.slice();
  assert.notDeepEqual(first, original);
  editor.apply({ ...DEFAULT_SHAPE, headWidth: -10 });
  editor.apply(shape);
  assert.deepEqual(mesh.geometry.attributes.position.array, first);
  const local = new THREE.Vector3().fromArray(original, 0);
  const expected = deformPoint(local.applyMatrix4(mesh.matrixWorld), shape);
  const actual = new THREE.Vector3().fromArray(first, 0).applyMatrix4(mesh.matrixWorld);
  assert.ok(actual.distanceTo(new THREE.Vector3(expected.x, expected.y, expected.z)) < 1e-6);
  editor.apply(DEFAULT_SHAPE);
  assert.deepEqual(mesh.geometry.attributes.position.array, original);
});
