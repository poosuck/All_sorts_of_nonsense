import * as THREE from "three";
import { aimSegment, bodyGeometry, createSurface, featherGeometry, joinGeometry, plumageGeometry } from "./geometry.mjs";

function object(geometry, material, name, parent, position = [0, 0, 0], scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
  mesh.position.set(...position); mesh.scale.set(...scale);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

export function createAuthoredPigeon(materials, kind = "normal") {
  const chicken = kind === "chicken";
  const root = new THREE.Group(); root.name = `Pigeon_${kind}_v2`; root.userData = { author: "byeoljit", revision: 2, kind };
  const body = new THREE.Bone(); body.name = "Body";
  const neck = new THREE.Bone(); neck.name = "Neck";
  const head = new THREE.Bone(); head.name = "Head";
  const baseY = chicken ? 1.18 : 1.04, headY = chicken ? 1.62 : 1.52;
  neck.position.set(0, baseY, chicken ? .3 : .24);
  head.position.set(0, headY - baseY, chicken ? .05 : .06);
  root.add(body); body.add(neck); neck.add(head);
  const surface = createSurface(kind);
  const skeleton = new THREE.Skeleton([body, neck, head]);
  for (const [name, geometry] of [["BodySurface", bodyGeometry(surface, kind)], ["FinePlumage", plumageGeometry(surface, kind)]]) {
    const mesh = new THREE.SkinnedMesh(geometry, materials.body); mesh.name = name;
    mesh.castShadow = name !== "FinePlumage"; mesh.receiveShadow = true; mesh.frustumCulled = false;
    root.add(mesh); root.updateMatrixWorld(true); mesh.bind(skeleton);
  }
  const sphere = new THREE.SphereGeometry(1, 20, 16);
  const tube = new THREE.CylinderGeometry(1, 1, 1, 8);
  const cone = new THREE.ConeGeometry(1, 1, 10);
  const eyeY = -.015;
  for (const side of [-1, 1]) {
    const eye = new THREE.Group(); eye.name = side < 0 ? "Eye_L" : "Eye_R";
    eye.position.set(side * .237, eyeY, .13);
    eye.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(side * .87, .04, .5).normalize());
    head.add(eye);
    object(sphere, materials.eyeRim, `EyeRim_${side}`, eye, [0, 0, 0], [.053, .054, .012]);
    object(sphere, materials.iris, `Iris_${side}`, eye, [0, 0, .008], [.041, .042, .014]);
    object(sphere, materials.pupil, `Pupil_${side}`, eye, [0, 0, .019], [.020, .023, .007]);
    object(sphere, materials.glint, `Highlight_${side}`, eye, [-.008, .011, .026], [.005, .006, .002]);
  }
  const beak = new THREE.Group(); beak.name = "Beak"; head.add(beak);
  const beakMesh = object(cone, materials.beak, "UpperBeak", beak, [0, -.115, .36], [.066, .29, .045]);
  beakMesh.rotation.x = Math.PI / 2 + .22;
  for (const side of [-1, 1]) object(sphere, materials.cere, `Cere_${side}`, head, [side * .029, -.074, .267], [.037, .026, .067]);
  const tip = new THREE.Object3D(); tip.name = "BeakTip";
  tip.position.set(0, -.146, .502); head.add(tip);

  const feather = featherGeometry();
  const dummy = new THREE.Object3D();
  const wings = [], folds = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group(); wing.name = side < 0 ? "Wing_L" : "Wing_R";
    wing.position.set(side * (chicken ? .69 : .43), chicken ? 1.08 : .99, -.06);
    body.add(wing); wings.push(wing);
    const fold = new THREE.Group(); fold.name = side < 0 ? "Fold_L" : "Fold_R"; wing.add(fold); folds.push(fold);
    const featherSets = { wing: [], pale: [], dark: [] };
    // A continuous shell prevents overlapping coverts from occupying the same surface.
    const coverPositions = [], coverUVs = [], coverIndices = [];
    const rows = 32, cols = 12;
    for (let row = 0; row <= rows; row++) {
      const s = .01 + row / rows * .98;
      for (let col = 0; col <= cols; col++) {
        const v = col / cols * 2 - 1;
        const y = (chicken ? 1.11 : 1.01) - s * (chicken ? .45 : .39) + v * (chicken ? .33 : .27) * Math.sin(Math.PI * s) ** .62;
        const z = .12 - s * (chicken ? 1.46 : 1.24);
        const factor = 1 - ((y - .68) / (chicken ? .83 : .67)) ** 2 - ((z + .2) / (chicken ? 1.13 : .87)) ** 2;
        const x = side * ((chicken ? .96 : .57) * Math.sqrt(Math.max(.08, factor)) + .032 + (1 - v * v) * .023);
        coverPositions.push(x - wing.position.x, y - wing.position.y, z - wing.position.z);
        coverUVs.push(col / cols, 1 - s);
        if (row < rows && col < cols) {
          const i = row * (cols + 1) + col;
          coverIndices.push(i, i + 1, i + cols + 1, i + 1, i + cols + 2, i + cols + 1);
        }
      }
    }
    const cover = new THREE.BufferGeometry();
    cover.setAttribute("position", new THREE.Float32BufferAttribute(coverPositions, 3));
    cover.setAttribute("uv", new THREE.Float32BufferAttribute(coverUVs, 2));
    cover.setIndex(coverIndices); cover.computeVertexNormals();
    const flatCover = cover.clone();
    const flatPosition = flatCover.getAttribute("position");
    for (let i = 0; i < flatPosition.count; i++) flatPosition.setX(i, side * .045);
    flatCover.computeVertexNormals();
    cover.morphAttributes.position = [flatPosition.clone()];
    cover.morphAttributes.normal = [flatCover.getAttribute("normal").clone()];
    flatCover.dispose();
    object(cover, materials.wing, `WingCover_${side}`, fold);
    for (let i = 0; i < 11; i++) {
      dummy.position.set(side * (.025 + i * .017), -.19 - i * .009, -.25 - i * .034);
      dummy.rotation.set(1.47, side * (i - 5) * -.019, side * -.08);
      dummy.scale.set(.38, (.59 + i * .022) * (chicken ? 1.25 : 1), 1);
      dummy.updateMatrix();
      const angle = (i / 10 - .5) * 1.05;
      const openMatrix = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(0, side * Math.cos(angle), side * Math.sin(angle)),
        new THREE.Vector3(0, -Math.sin(angle), Math.cos(angle)),
        new THREE.Vector3(side, 0, 0),
      );
      openMatrix.scale(new THREE.Vector3(.47, (.65 + Math.sin(i / 10 * Math.PI) * .19) * (chicken ? 1.13 : 1), .25));
      openMatrix.setPosition(side * .045, -.2, -.5);
      featherSets[i > 7 ? "dark" : "pale"].push({ geometry: feather, matrix: dummy.matrix.clone(), openMatrix });
    }
    for (const [name, parts] of Object.entries(featherSets)) {
      if (!parts.length) continue;
      const geometry = joinGeometry(parts);
      const positions = geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i) + wing.position.y;
        const z = positions.getZ(i) + wing.position.z;
        const width = chicken ? .96 : .57;
        const factor = 1 - ((y - .68) / (chicken ? .83 : .67)) ** 2 - ((z + .2) / (chicken ? 1.13 : .87)) ** 2;
        const flank = width * Math.sqrt(Math.max(.08, factor)) - .012 + Math.abs(positions.getX(i)) * .025;
        positions.setX(i, side * flank - wing.position.x);
      }
      geometry.computeVertexNormals();
      const spread = joinGeometry(parts.map((part) => ({ geometry: part.geometry, matrix: part.openMatrix })));
      geometry.morphAttributes.position = [spread.getAttribute("position").clone()];
      geometry.morphAttributes.normal = [spread.getAttribute("normal").clone()];
      spread.dispose();
      object(geometry, materials[name], `WingFeathers_${side}_${name}`, fold);
    }
  }
  const tails = [];
  for (let i = 0; i < 10; i++) {
    dummy.position.set((i - 4.5) * .047, .47, chicken ? -1.03 : -.84);
    dummy.rotation.set(1.43, (i - 4.5) * -.035, 0);
    dummy.scale.set(.35, chicken ? .63 : .55, 1); dummy.updateMatrix();
    tails.push({ geometry: feather, matrix: dummy.matrix.clone() });
  }
  object(joinGeometry(tails), materials.dark, "Tail", body);
  feather.dispose();
  for (const side of [-1, 1]) {
    const foot = new THREE.Group(); foot.name = side < 0 ? "Foot_L" : "Foot_R"; root.add(foot);
    const shin = object(tube, materials.feet, side < 0 ? "Shin_L" : "Shin_R", root);
    for (const [i, angle, length] of [[0, -.55, .21], [1, 0, .25], [2, .65, .18], [3, Math.PI, .105]]) {
      const toe = object(tube, materials.feet, `Toe_${side}_${i}`, foot);
      const end = [Math.sin(angle) * length, -.018, Math.cos(angle) * length];
      aimSegment(toe, [0, .008, 0], end, .015);
      const claw = object(cone, materials.claw, `Claw_${side}_${i}`, foot, end, [.014, .045, .013]); claw.rotation.x = Math.PI / 2;
    }
  }
  root.updateMatrixWorld(true);
  return root;
}
