import * as THREE from "three";
import { ANATOMY, flankX } from "./anatomy.mjs";

function mesh(geometry, material, name, parent, position, scale) {
  const value = new THREE.Mesh(geometry, material); value.name = name;
  if (position) value.position.set(...position); if (scale) value.scale.set(...scale);
  value.castShadow = true; value.receiveShadow = true; parent.add(value); return value;
}
function lidGeometry() {
  const positions = [], closed = [], uv = [], indices = [], rows = 10, cols = 14;
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
    const v = row / rows, u = col / cols * 2 - 1;
    for (const [target, y] of [[positions, .051 - v * .014], [closed, .051 - v * .102]]) {
      const x = u * .05 * Math.sqrt(Math.max(0, 1 - (y / .053) ** 2));
      const z = .022 + Math.sqrt(Math.max(0, 1 - (x / .052) ** 2 - (y / .055) ** 2)) * .014;
      target.push(x, y, z);
    }
    uv.push(col / cols, row / rows);
    if (row < rows && col < cols) { const i = row * (cols + 1) + col; indices.push(i, i + 1, i + cols + 1, i + 1, i + cols + 2, i + cols + 1); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const shut = geometry.clone(); shut.setAttribute("position", new THREE.Float32BufferAttribute(closed, 3)); shut.computeVertexNormals();
  geometry.morphAttributes.position = [shut.attributes.position.clone()]; geometry.morphAttributes.normal = [shut.attributes.normal.clone()]; shut.dispose();
  return geometry;
}
function beakGeometry(lower = false) {
  const positions = [], indices = [], rows = 16, cols = 16;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const width = .052 * (1 - t) ** .7 + .001;
    const height = (lower ? .012 : .027) * (1 - t) ** .65 + .001;
    for (let col = 0; col <= cols; col++) {
      const theta = col / cols * Math.PI * 2;
      const upperHeight = .027 * (1 - t) ** .65 + .001;
      const center = -.078 - t * .027 - (lower ? upperHeight + height + .001 : 0);
      positions.push(Math.cos(theta) * width * (lower ? .91 : 1), center + Math.sin(theta) * height, .215 + t * .18);
      if (row < rows && col < cols) { const i = row * (cols + 1) + col; indices.push(i, i + 1, i + cols + 1, i + 1, i + cols + 2, i + cols + 1); }
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

export function createFace(head, materials, kind) {
  const anatomy = ANATOMY[kind];
  const eyeX = flankX(kind, anatomy.headY + .035, anatomy.headZ + .115) + .002;
  const sphere = new THREE.SphereGeometry(1, 24, 18);
  for (const side of [-1, 1]) {
    const eye = new THREE.Group(); eye.name = side < 0 ? "Eye_L" : "Eye_R";
    eye.position.set(side * eyeX, .035, .115); eye.scale.setScalar(.80);
    eye.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(side * .9, .035, .44).normalize()); head.add(eye);
    mesh(sphere, materials.eyeRim, `EyeRim_${side}`, eye, [0, 0, 0], [.044, .045, .010]);
    mesh(sphere, materials.iris, `Iris_${side}`, eye, [0, 0, .008], [.033, .034, .012]);
    mesh(sphere, materials.pupil, `Pupil_${side}`, eye, [0, 0, .018], [.014, .016, .006]);
    mesh(sphere, materials.glint, `Highlight_${side}`, eye, [-.008, .011, .024], [.0038, .0045, .0018]);
    mesh(lidGeometry(), materials.lid, side < 0 ? "Lid_L" : "Lid_R", eye);
    const edge = [];
    for (let i = 0; i <= 20; i++) {
      const theta = i / 20 * Math.PI * 2;
      edge.push(new THREE.Vector3(Math.cos(theta) * .044, Math.sin(theta) * .045, .013));
    }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge), 30, .0026, 5, true), materials.lid, `EyeLidRim_${side}`, eye);
  }
  mesh(beakGeometry(), materials.beak, "UpperBeak", head);
  const jaw = new THREE.Group(); jaw.name = "Jaw"; jaw.position.set(0, -.09, .22); head.add(jaw);
  mesh(beakGeometry(true), materials.beak, "LowerBeak", jaw, [0, .09, -.22]);
  mesh(sphere, materials.cere, "Cere", head, [0, -.052, .226], [.036, .011, .027]);
  for (const side of [-1, 1]) {
    mesh(sphere, materials.claw, `Nostril_${side}`, head, [side * .025, -.057, .245], [.005, .0025, .007]);
  }
  const tip = new THREE.Object3D(); tip.name = "BeakTip"; tip.position.set(0, -.105, .395); head.add(tip);
}
