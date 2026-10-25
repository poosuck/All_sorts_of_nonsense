import * as THREE from "three";
import { aimSegment, featherGeometry, joinGeometry } from "./geometry.mjs";
import { ANATOMY, sculptBody, softFilaments } from "./anatomy.mjs";
import { createWings } from "./wings.mjs";
import { createFace } from "./face.mjs";

function object(geometry, material, name, parent, position = [0, 0, 0], scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
  mesh.position.set(...position); mesh.scale.set(...scale); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

export function createAuthoredPigeon(materials, kind = "normal") {
  const chicken = kind === "chicken", a = ANATOMY[kind];
  const root = new THREE.Group(); root.name = `Pigeon_${kind}_v3`; root.userData = { author: "byeoljit", revision: 3, kind, anatomy: a };
  const body = new THREE.Bone(); body.name = "Body";
  const neck = new THREE.Bone(); neck.name = "Neck";
  const head = new THREE.Bone(); head.name = "Head";
  neck.position.set(0, a.neckY, a.neckZ); head.position.set(0, a.headY - a.neckY, a.headZ - a.neckZ);
  root.add(body); body.add(neck); neck.add(head);
  const skin = sculptBody(kind), skeleton = new THREE.Skeleton([body, neck, head]);
  for (const [name, geometry, material] of [["BodySurface", skin, materials.body], ["FinePlumage", softFilaments(skin, kind), materials.body]]) {
    const mesh = new THREE.SkinnedMesh(geometry, material); mesh.name = name;
    mesh.castShadow = name !== "FinePlumage"; mesh.receiveShadow = true; mesh.frustumCulled = false;
    root.add(mesh); root.updateMatrixWorld(true); mesh.bind(skeleton);
  }
  createFace(head, materials, kind); createWings(body, materials, kind);
  const feather = featherGeometry(1, .2, .014, 12, 6), dummy = new THREE.Object3D(), tails = [];
  for (let i = 0; i < 10; i++) {
    dummy.position.set((i - 4.5) * .040, chicken ? .40 : .43, chicken ? -.91 : -.76);
    dummy.rotation.set(1.49, (i - 4.5) * -.032, 0); dummy.scale.set(.34, chicken ? .50 : .44, 1); dummy.updateMatrix();
    tails.push({ geometry: feather, matrix: dummy.matrix.clone() });
  }
  object(joinGeometry(tails), materials.dark, "Tail", body); feather.dispose();
  const tube = new THREE.CylinderGeometry(1, 1, 1, 8), cone = new THREE.ConeGeometry(1, 1, 10);
  for (const side of [-1, 1]) {
    const foot = new THREE.Group(); foot.name = side < 0 ? "Foot_L" : "Foot_R"; root.add(foot);
    object(tube, materials.feet, side < 0 ? "Shin_L" : "Shin_R", root);
    for (const [i, angle, length] of [[0, -.55, .20], [1, 0, .24], [2, .65, .18], [3, Math.PI, .10]]) {
      const toe = object(tube, materials.feet, `Toe_${side}_${i}`, foot);
      const end = [Math.sin(angle) * length, -.018, Math.cos(angle) * length]; aimSegment(toe, [0, .008, 0], end, .0105);
      const claw = object(cone, materials.claw, `Claw_${side}_${i}`, foot, end, [.013, .04, .012]); claw.rotation.x = Math.PI / 2;
    }
  }
  root.traverse((node) => {
    if (!node.geometry) return;
    for (const normals of [node.geometry.attributes.normal, ...(node.geometry.morphAttributes.normal || [])].filter(Boolean)) {
      for (let i = 0; i < normals.count; i++) {
        const normal = new THREE.Vector3().fromBufferAttribute(normals, i);
        if (normal.lengthSq() < .000001) normal.set(0, 0, 1); else normal.normalize();
        normals.setXYZ(i, ...normal.toArray());
      }
    }
  });
  root.updateMatrixWorld(true); return root;
}
