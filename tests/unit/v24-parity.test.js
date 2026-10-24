import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import {
  PuddingPhysics,
  deformPoint,
} from "../../src/features/pudding/core/pudding-physics.js";
import { STRIKE_AUDIO_BASE64 } from "../../src/features/pudding/core/strike-audio-data.js";
import { BOWL_AUDIO_BASE64 } from "../../src/features/pudding/core/bowl-audio-data.js";
import {
  WHIP_HIT_AUDIO,
  WHIP_SWING_AUDIO,
} from "../../src/features/pudding/core/whip-audio-data.js";

function upstream(module) {
  const file = new URL(
    `../../vendor/pudding-v24/lib/${module}.ts`,
    import.meta.url,
  );
  const result = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  });
  const sandbox = { exports: {}, Math };
  vm.runInNewContext(result.outputText, sandbox);
  return sandbox.exports;
}
test("preserved v24 files match the uploaded snapshot checksums", () => {
  const root = new URL("../../vendor/pudding-v24/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", root)));
  for (const [file, digest] of Object.entries(manifest.files)) {
    assert.equal(
      createHash("sha256")
        .update(readFileSync(new URL(file, root)))
        .digest("hex"),
      digest,
      file,
    );
  }
});
test("ported physics and vertex deformation equal v24 over 1,000 mixed steps", () => {
  const original = upstream("pudding-physics"),
    a = new original.PuddingPhysics(),
    b = new PuddingPhysics();
  for (let i = 0; i < 1000; i++) {
    a.speed = b.speed = i % 101;
    if (i % 79 === 0) {
      const d = { x: Math.sin(i), y: -0.3, z: Math.cos(i) };
      a.strike(d, 8);
      b.strike(d, 8);
    }
    if (i % 40 < 10) {
      a.target.x = b.target.x = 0.7;
      a.target.squash = b.target.squash = -0.2;
    } else {
      a.release();
      b.release();
    }
    a.step(1 / 60, i % 40 < 10);
    b.step(1 / 60, i % 40 < 10);
    for (const key of ["x", "z", "squash", "dent"])
      assert.equal(b.q[key], a.q[key]);
    const args = [
      0.6,
      1.8,
      0.7,
      b.q,
      { x: 0, y: 1.5, z: 1 },
      { x: 0, y: 0, z: 1 },
    ];
    assert.deepEqual(
      [...deformPoint(...args)],
      [...original.deformPoint(...args)],
    );
  }
});
test("all four audio samples are byte-identical to the supplied v24 source", () => {
  const samples = [
    [STRIKE_AUDIO_BASE64, upstream("strike-audio-data").STRIKE_AUDIO_BASE64],
    [BOWL_AUDIO_BASE64, upstream("bowl-audio-data").BOWL_AUDIO_BASE64],
    [WHIP_HIT_AUDIO, upstream("whip-audio-data").WHIP_HIT_AUDIO],
    [WHIP_SWING_AUDIO, upstream("whip-audio-data").WHIP_SWING_AUDIO],
  ];
  for (const [actual, expected] of samples)
    assert.ok(
      Buffer.from(actual, "base64").equals(Buffer.from(expected, "base64")),
    );
});
