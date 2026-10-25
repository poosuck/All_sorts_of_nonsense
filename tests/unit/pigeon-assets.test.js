import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { createAuthoredPigeon } from "../../scripts/pigeon-assets/model.mjs";
import { bindPigeonRig } from "../../src/features/pigeon/rig.js";
import { sampleMotion } from "../../src/features/pigeon/motion.js";

test("authored GLBs match their sources and contain self-contained textures, skin and three clips", async () => {
  const root = new URL("../../", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("src/assets/pigeon/manifest.json", root)));
  for (const [path, expected] of Object.entries(manifest.sources)) {
    const bytes = await readFile(new URL(path, root));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, `${path}: rebuild pigeon assets`);
  }
  for (const file of manifest.files) {
    const bytes = await readFile(new URL(`src/assets/pigeon/${file.file}`, root));
    assert.equal(bytes.readUInt32LE(0), 0x46546c67);
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.deepEqual(json.animations.map((a) => a.name).sort(), ["eat", "fly", "walk"]);
    assert.ok(json.animations.find((a) => a.name === "fly").channels.filter((channel) => channel.target.path === "weights").length >= 6);
    assert.ok(json.skins.length > 0);
    assert.ok(json.images.length >= 4);
    for (const image of json.images) assert.ok(Number.isInteger(image.bufferView) && !image.uri);
    for (const buffer of json.buffers) assert.equal(buffer.uri, undefined);
    for (const name of ["Body", "Neck", "Head", "BeakTip", "Wing_L", "Wing_R"]) assert.ok(json.nodes.some((node) => node.name === name));
  }
});

test("chicken silhouette is wider and lower; the animated skin stays finite and above the paving", () => {
  const material = new THREE.MeshStandardMaterial();
  const materials = new Proxy({}, { get: () => material });
  const dimensions = [];
  for (const kind of ["normal", "chicken"]) {
    const root = createAuthoredPigeon(materials, kind);
    const rig = bindPigeonRig(root, kind === "chicken");
    const mesh = root.getObjectByName("BodySurface");
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox, size = box.getSize(new THREE.Vector3());
    dimensions.push({ width: size.x, height: size.y, bottom: box.min.y });
    for (const mode of ["walk", "eat", "fly"]) for (const t of [0, .45, .9, 1.4, 2.1]) {
      rig.pose(sampleMotion(mode, t)); root.updateMatrixWorld(true);
      for (let i = 0; i < mesh.geometry.attributes.position.count; i += 17) {
        const vertex = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i);
        mesh.applyBoneTransform(i, vertex);
        assert.ok(vertex.toArray().every(Number.isFinite));
        assert.ok(vertex.y > -.03, `${kind} ${mode} ${t}: body intersects paving`);
      }
    }
    const orientation = [];
    for (const mode of ["eat", "fly"]) {
      rig.pose(sampleMotion(mode, 2.1)); root.updateMatrixWorld(true);
      const cover = root.getObjectByName("WingCover_1");
      const normals = cover.geometry.attributes.normal;
      const normal = new THREE.Vector3().fromBufferAttribute(normals, Math.floor(normals.count / 2));
      normal.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(cover.matrixWorld));
      orientation.push(Math.abs(normal.y));
    }
    assert.ok(orientation[0] < .5, "resting wing cover follows the body side");
    assert.ok(orientation[1] > .8, "flying wing cover must open horizontally");
    const flightPlane = [];
    const fold = root.getObjectByName("Fold_R");
    for (const mesh of fold.children.filter((child) => child.morphTargetInfluences?.length)) {
      for (let i = 0; i < mesh.geometry.attributes.position.count; i += 7) {
        flightPlane.push(mesh.getVertexPosition(i, new THREE.Vector3()).x);
      }
    }
    assert.ok(Math.max(...flightPlane) - Math.min(...flightPlane) < .04, "extended cover and primaries must remain attached in one wing plane");
    const geometry = new Set(); root.traverse((object) => { if (object.geometry) geometry.add(object.geometry); });
    for (const item of geometry) item.dispose(); rig.dispose();
  }
  assert.ok(dimensions[1].width / dimensions[0].width > 1.5);
  assert.ok(dimensions[1].height / dimensions[0].height < 1.15);
  assert.ok(dimensions[1].bottom < dimensions[0].bottom);
  material.dispose();
});
