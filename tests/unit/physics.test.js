import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PuddingPhysics,
  deformPoint as deformVertex,
} from "../../src/features/pudding/core/pudding-physics.js";
import {
  StrikeMotion as PointerMotion,
  strikeStrength as impactStrength,
  sweepContact,
} from "../../src/features/pudding/core/pudding-strike.js";
import {
  canStartPointer as isPrimaryPointer,
  isActivePointer as samePointer,
} from "../../src/features/pudding/core/pudding-input.js";

test("impact scales with speed, contact angle and softness; bounded at extreme speed", () => {
  assert.equal(impactStrength(0, 1, 60), 0);
  assert.equal(impactStrength(1000, 0, 60), 0);
  assert.ok(impactStrength(1000, 1, 100) > impactStrength(1000, 1, 0));
  assert.ok(impactStrength(1000, 1, 60) > impactStrength(500, 1, 60));
  assert.ok(impactStrength(1e8, 1, 100) <= 17);
});
test("spring settles at minimum and maximum recovery without unstable values", () => {
  for (const speed of [0, 100]) {
    const p = new PuddingPhysics();
    p.speed = speed;
    p.strike({ x: 1, y: -0.5, z: 0.5 }, 12);
    for (let i = 0; i < 2400; i++) p.step(1 / 60, false);
    for (const value of Object.values(p.q))
      assert.ok(Number.isFinite(value) && Math.abs(value) < 0.001);
  }
});
test("higher recovery reduces residual displacement after two seconds", () => {
  function residual(speed) {
    const p = new PuddingPhysics();
    p.speed = speed;
    p.strike({ x: 1, y: -0.3, z: 0.5 }, 8);
    for (let i = 0; i < 120; i++) p.step(1 / 60, false);
    return Object.values(p.q).reduce((sum, value) => sum + Math.abs(value), 0);
  }
  assert.ok(residual(100) < residual(0));
});
test("hold and release restore the original shape; reset clears all motion", () => {
  const p = new PuddingPhysics();
  p.target.x = 1;
  p.target.squash = -0.4;
  for (let i = 0; i < 120; i++) p.step(1 / 60, true);
  assert.ok(Math.abs(p.q.x - 1) < 0.01);
  p.release();
  for (let i = 0; i < 1200; i++) p.step(1 / 60, false);
  assert.ok(Math.abs(p.q.x) < 0.001);
  p.strike({ x: 1, y: -1, z: 0 }, 20);
  p.reset();
  assert.deepEqual(p.q, { x: 0, z: 0, squash: 0, dent: 0 });
  assert.deepEqual(p.v, p.q);
});
test("sweep detects a narrow hit between fast pointer samples and misses empty space", () => {
  const contact = sweepContact({ x: 0, y: 10 }, { x: 100, y: 10 }, (x, y) =>
    x >= 49 && x <= 53 ? { x, y } : null,
  );
  assert.ok(contact && contact.x >= 49 && contact.x <= 53);
  assert.equal(
    sweepContact({ x: 0, y: 10 }, { x: 100, y: 10 }, () => null),
    undefined,
  );
});
test("motion uses real sample timing and becomes stale after 100ms", () => {
  const m = new PointerMotion();
  m.start({ x: 0, y: 0, t: 0 });
  m.add({ x: 100, y: 0, t: 50 });
  assert.equal(m.velocity(50).speed, 2000);
  assert.equal(m.velocity(151).speed, 0);
});
test("vertices at rest preserve shape and deformation never penetrates the floor", () => {
  const q = { x: 0, z: 0, squash: 0, dent: 0 };
  assert.deepEqual(
    deformVertex(1, 1, 1, q, { x: 0, y: 2, z: 0 }, { x: 0, y: 1, z: 0 }),
    [1, 1, 1],
  );
  assert.ok(
    deformVertex(
      0,
      0,
      0,
      { ...q, squash: -0.6, dent: 0.5 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    )[1] >= 0.022,
  );
});
test("only primary supported pointers can start and other pointer IDs cannot release", () => {
  assert.ok(
    isPrimaryPointer(
      { isPrimary: true, button: 0, pointerType: "mouse" },
      false,
    ),
  );
  assert.equal(
    isPrimaryPointer(
      { isPrimary: true, button: 2, pointerType: "mouse" },
      false,
    ),
    false,
  );
  assert.equal(samePointer({ pointerId: 2 }, 1), false);
});
