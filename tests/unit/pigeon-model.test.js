import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../../", import.meta.url);
const read = path => readFile(new URL(path, root));
test("the shipped GLB is the recorded Blender anatomy model", async () => {
  const [bytes, text] = await Promise.all([read("src/assets/pigeon/pigeon.glb"), read("src/assets/pigeon/manifest.json")]);
  const manifest = JSON.parse(text);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest.glb_sha256);
  const size = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20+size).toString());
  const model = gltf.nodes.find(node => node.name === "Pigeon_R01");
  assert.ok(model);
  assert.equal(model.extras.revision, "clay-v13");
  assert.equal(manifest.stage, "anatomy-and-plumage-study");
  assert.deepEqual(manifest.poses, ["stand"]);
  assert.ok(manifest.plumage.feathers > 1000);
  assert.ok(manifest.plumage.added_triangles <= 75000);
  assert.ok(gltf.meshes.some(mesh => mesh.name.startsWith("Plumage_")));
  assert.ok(gltf.meshes.find(mesh => mesh.name === "Body_neck_head_continuous").primitives[0].attributes.COLOR_0 !== undefined);
  assert.equal(Object.keys(manifest.views).length, 8);
  assert.ok(manifest.triangles > 1000 && manifest.triangles < 150000);
  assert.ok(manifest.bounds_blender.width_over_height > 0.6 && manifest.bounds_blender.width_over_height < 0.85);
  assert.ok(manifest.bounds_blender.length_over_height > 0.9 && manifest.bounds_blender.length_over_height < 1.4);
  assert.ok(!gltf.nodes.some(node => /chicken|kenchoo|normal-v[23]/i.test(node.name || "")));
});
test("the editable original and profile measurements match the asset manifest", async () => {
  const manifest = JSON.parse(await read("src/assets/pigeon/manifest.json"));
  const [blend, profiles] = await Promise.all([read("art/pigeon/pigeon.blend"), read("art/pigeon/profiles.json")]);
  assert.equal(createHash("sha256").update(blend).digest("hex"), manifest.blend_sha256);
  assert.equal(createHash("sha256").update(profiles).digest("hex"), manifest.profiles_sha256);
  const profile = JSON.parse(profiles);
  assert.ok(Math.abs(manifest.bounds_blender.max[2] - profile.head.topZ) < 1e-5,
    "Crown and head feathers must stop at the shortened head height");
  assert.equal(manifest.reference_file_available, false);
  assert.match(manifest.reference_measurements, /estimates/);
});
test("the shipped nape expands toward the shoulders without an occipital neck notch", async () => {
  const bytes = await read("src/assets/pigeon/pigeon.glb");
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const body = gltf.meshes.find(mesh => mesh.name === "Body_neck_head_continuous");
  const accessor = gltf.accessors[body.primitives[0].attributes.POSITION];
  const view = gltf.bufferViews[accessor.bufferView];
  assert.equal(accessor.componentType, 5126);
  const start = 28 + jsonLength + (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const rows = new Map();
  for (let i = 0; i < accessor.count; i++) {
    const offset = start + i * (view.byteStride || 12);
    const height = bytes.readFloatLE(offset + 4), z = bytes.readFloatLE(offset + 8);
    if (height < .60 || height > .95) continue;
    const key = height.toFixed(6);
    const row = rows.get(key);
    if (!row || z < row.rearZ) rows.set(key, { height, rearZ: z });
  }
  const ordered = [...rows.values()].sort((a, b) => a.height - b.height);
  assert.ok(ordered.length > 20);
  for (let i = 1; i < ordered.length; i++) {
    // glTF +Y is height; the bird's rear points toward -Z.
    assert.ok(ordered[i].rearZ >= ordered[i - 1].rearZ - 1e-5,
      `Posterior contour reverses below the skull at height ${ordered[i].height}`);
  }
});
