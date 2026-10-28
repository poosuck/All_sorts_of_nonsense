import test from "node:test";
import assert from "node:assert/strict";
import { anatomicalWeights, sculptPigeonPoint } from "../../src/features/pigeon/pigeon-body-shape.js";

const p = { x: 0.1, y: 0.29, z: 0.12 };
const chest = { chest: 1, body: 0, neck: 0, tail: 0, legs: 0, head: 0 };
const head = { chest: 0, body: 0, neck: 0, tail: 0, legs: 0, head: 1 };
const legs = { chest: 0, body: 0, neck: 0, tail: 0, legs: 1, head: 0 };

test("plumper chest is wider and rounder while feet stay fixed", () => {
  const natural = sculptPigeonPoint(p, chest, 0);
  const chubby = sculptPigeonPoint(p, chest, 82);
  assert.ok(chubby.x > natural.x);
  assert.ok(chubby.z > natural.z);
  assert.deepEqual(sculptPigeonPoint(p, head, 100), { ...p, influence: 0 });
  assert.deepEqual(sculptPigeonPoint(p, legs, 100), { ...p, influence: 0 });
});

test("roundness stays finite, is clamped, and is reversible", () => {
  const upper = sculptPigeonPoint(p, chest, 100);
  assert.deepEqual(sculptPigeonPoint(p, chest, 999), upper);
  assert.deepEqual(sculptPigeonPoint(p, chest, -10), { ...p, influence: 0 });
  assert.ok(Object.values(upper).every(Number.isFinite));
});

test("chest skin weights are derived from real rig joint names", () => {
  const bones = [{ name: "Chicken_Chest_01_01SHJnt" }, { name: "Chicken_l_Leg_HipSHJnt" }];
  const weights = anatomicalWeights(bones, [0, 1, 0, 0], [0.75, 0.25, 0, 0]);
  assert.equal(weights.chest, 0.75);
  assert.equal(weights.legs, 0.25);
});


test("reference proportions enlarge head, thicken neck and shorten tail at full roundness", () => {
  const h = { x: .04, y: .57, z: .20 };
  const shaped = sculptPigeonPoint(h, head, 82);
  assert.ok(shaped.x > h.x);
  assert.ok(shaped.y < h.y);
  const neck = { ...head, head: 0, neck: 1 };
  assert.ok(sculptPigeonPoint(h, neck, 82).x > h.x);
  const tail = { ...head, head: 0, tail: 1 };
  const t = { x: .03, y: .19, z: -.50 };
  assert.ok(sculptPigeonPoint(t, tail, 82).z > t.z);
  assert.deepEqual(sculptPigeonPoint(h, head, 0), { ...h, influence: 0 });
});
