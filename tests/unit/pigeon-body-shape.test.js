import test from "node:test";
import assert from "node:assert/strict";
import { anatomicalWeights, sculptPigeonPoint } from "../../src/features/pigeon/pigeon-body-shape.js";

const p = { x: 0.1, y: 0.29, z: 0.12 };
const chest = { chest: 1, body: 0, neck: 0, tail: 0, legs: 0, head: 0 };
const head = { chest: 0, body: 0, neck: 0, tail: 0, legs: 0, head: 1 };
const legs = { chest: 0, body: 0, neck: 0, tail: 0, legs: 1, head: 0 };

test("plumper chest is wider and rounder without resizing the head/feet", () => {
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
