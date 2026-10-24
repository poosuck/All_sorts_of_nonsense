import test from "node:test";
import assert from "node:assert/strict";
import { FLIGHT_DURATION, advanceClock, sampleMotion } from "../../src/features/pigeon/motion.js";
import { createPigeon } from "../../src/features/pigeon/pigeon-model.js";
import { createResourcePool } from "../../src/features/pigeon/resources.js";

test("pigeon visible clock stops while paused and bounds stale-tab deltas", () => {
  assert.equal(advanceClock(4, 120, true), 4);
  assert.equal(advanceClock(4, 120), 4.05);
  assert.equal(advanceClock(4, -1), 4);
  assert.equal(advanceClock(4, NaN), 4);
  let time = 0;
  for (let i = 0; i < 120; i++) time = advanceClock(time, 1 / 60);
  assert.ok(Math.abs(time - 2) < 1e-10);
});

test("pigeon flight takes off, returns to the same ground and has a grounded rest", () => {
  assert.equal(sampleMotion("fly", 0).height, 0);
  assert.equal(sampleMotion("fly", FLIGHT_DURATION).height, 0);
  let maxHeight = 0;
  const phases = new Set();
  for (let i = 0; i <= 760; i++) {
    const pose = sampleMotion("fly", i / 100);
    maxHeight = Math.max(maxHeight, pose.height);
    phases.add(pose.phase);
    assert.ok(pose.height >= 0);
    for (const value of Object.values(pose)) if (typeof value === "number") assert.ok(Number.isFinite(value));
  }
  assert.ok(maxHeight > 2.5);
  assert.equal(phases.size, 4);
  const rest = sampleMotion("fly", FLIGHT_DURATION * 0.95);
  assert.equal(rest.height, 0);
  assert.ok(Math.abs(rest.x) + Math.abs(rest.z) < 1e-10);
  assert.equal(rest.legTuck, 0);
  // Flight orientation must face its direction of travel, including the return leg.
  for (const t of [0.4, 1.2, 2.6, 3.8, 5.2, 6.1]) {
    const a = sampleMotion("fly", t), b = sampleMotion("fly", t + 0.001);
    const direction = Math.atan2(b.x - a.x, b.z - a.z);
    assert.ok(Math.cos(direction - a.yaw) > 0.999);
  }
});

test("both actual 3D rigs lower their beaks to the grain layer and alternate their feet", () => {
  const pool = createResourcePool();
  const material = pool.material({ color: "#cccccc" });
  const materials = new Proxy({}, { get: () => material });
  for (const chicken of [false, true]) {
    const bird = createPigeon(pool, materials, { chicken });
    let low = Infinity, high = -Infinity;
    for (let i = 0; i < 260; i++) {
      bird.pose(sampleMotion("eat", i / 100));
      const { beakHeight } = bird.inspect();
      low = Math.min(low, beakHeight); high = Math.max(high, beakHeight);
    }
    assert.ok(low < 0.18, `beak too far from food: ${low}, chicken=${chicken}`);
    assert.ok(low > -0.08, `beak penetrated paving: ${low}`);
    assert.ok(high - low > 0.8);
    bird.pose(sampleMotion("walk", 0));
    const a = bird.inspect();
    bird.pose(sampleMotion("walk", Math.PI / 8.8));
    const b = bird.inspect();
    assert.ok(Math.abs(a.footHeight - b.footHeight) > 0.08);
    bird.pose(sampleMotion("fly", 2));
    assert.ok(Math.abs(bird.wings[0].rotation.z + bird.wings[1].rotation.z) < 1e-10);
    assert.ok(Math.abs(bird.inspect().wingAngle) > 0.5);
    bird.dispose();
  }
  pool.dispose();
});
