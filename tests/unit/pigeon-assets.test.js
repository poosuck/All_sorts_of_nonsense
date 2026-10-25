import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { createAuthoredPigeon } from "../../scripts/pigeon-assets/model.mjs";
import { bindPigeonRig } from "../../src/features/pigeon/rig.js";
import { sampleMotion } from "../../src/features/pigeon/motion.js";

test("authored GLBs match their sources and contain self-contained textures, skin, eyelids and four clips", async () => {
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
    assert.deepEqual(json.animations.map((a) => a.name).sort(), ["eat", "fly", "idle", "walk"]);
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
    rig.pose(sampleMotion("idle", 0)); root.updateMatrixWorld(true);
    for (const side of [-1, 1]) {
      const eye = root.getObjectByName(side < 0 ? "Eye_L" : "Eye_R");
      const iris = root.getObjectByName(`Iris_${side}`).getWorldPosition(new THREE.Vector3());
      const outward = eye.localToWorld(new THREE.Vector3(0, 0, 1)).sub(eye.getWorldPosition(new THREE.Vector3())).normalize();
      const ray = new THREE.Raycaster(iris.clone().add(outward), outward.clone().negate());
      const surface = ray.intersectObject(mesh)[0];
      assert.ok(surface && surface.distance > 1.001, `${kind}: iris is visible above the actual skinned head surface`);
    }
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox, size = box.getSize(new THREE.Vector3());
    dimensions.push({ width: size.x, height: size.y, bottom: box.min.y });
    for (const mode of ["walk", "eat", "fly"]) for (const t of [0, .45, .9, 1.4, 2.1]) {
      rig.pose(sampleMotion(mode, t)); root.updateMatrixWorld(true);
      for (let i = 0; i < mesh.geometry.attributes.position.count; i += 17) {
        const vertex = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i);
        const resting = vertex.clone();
        mesh.applyBoneTransform(i, vertex);
        assert.ok(vertex.toArray().every(Number.isFinite));
        assert.ok(vertex.y > -.03, `${kind} ${mode} ${t}: body intersects paving`);
        if (resting.z < -.06) {
          const torsoOnly = resting.applyMatrix4(root.getObjectByName("Body").matrixWorld);
          assert.ok(vertex.distanceTo(torsoOnly) < .002, `${kind}: pecking must not pull the back into the neck`);
        }
      }
    }
    rig.pose(sampleMotion("fly", 2.1)); root.updateMatrixWorld(true);
    const fold = root.getObjectByName("Fold_R"), flightPlane = [];
    for (const wingMesh of fold.children.filter((child) => child.morphTargetInfluences?.length)) {
      for (let i = 0; i < wingMesh.geometry.attributes.position.count; i += 7) {
        flightPlane.push(wingMesh.getVertexPosition(i, new THREE.Vector3()).x);
      }
    }
    assert.ok(Math.max(...flightPlane) - Math.min(...flightPlane) < .10, "extended cover and feathers stay in a connected, shallow wing volume");
    rig.pose(sampleMotion("idle", 0));
    const lid = root.getObjectByName("Lid_L");
    const minimumY = () => Math.min(...Array.from({ length: lid.geometry.attributes.position.count }, (_, i) => lid.getVertexPosition(i, new THREE.Vector3()).y));
    assert.ok(minimumY() > .03);
    rig.pose(sampleMotion("idle", 3.52));
    assert.ok(minimumY() < -.03, "actual eyelid geometry closes over the iris");
    for (const wingMesh of root.getObjectByName("Fold_R").children.filter((child) => child.name.startsWith("WingFeathers"))) {
      const geometry = wingMesh.geometry, position = geometry.attributes.position, index = geometry.index;
      let solid = 0;
      const count = index ? index.count : position.count;
      for (let i = 0; i < count; i += 3) {
        const points = [0, 1, 2].map((offset) => new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i + offset) : i + offset));
        if (points[1].sub(points[0]).cross(points[2].sub(points[0])).lengthSq() > 1e-14) solid++;
      }
      assert.ok(solid / (count / 3) > .8, "feather width must not collapse to a line when fitted to the body");
    }
    const geometry = new Set(); root.traverse((object) => { if (object.geometry) geometry.add(object.geometry); });
    for (const item of geometry) item.dispose(); rig.dispose();
  }
  assert.ok(dimensions[1].width / dimensions[0].width > 1.5);
  assert.ok(dimensions[1].height / dimensions[0].height < 1.15);
  assert.ok(dimensions[1].bottom < dimensions[0].bottom);
  material.dispose();
});
