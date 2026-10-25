import * as THREE from "three";
import { ANATOMY, flankX } from "./anatomy.mjs";
import { featherGeometry, joinGeometry } from "./geometry.mjs";

function addMesh(geometry, material, name, parent) {
  const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function featherMatrix(side, position, length, width, openAngle = null) {
  const matrix = new THREE.Matrix4();
  if (openAngle === null) {
    // Feather width follows the vertical flank, rather than collapsing in X
    // when the surface is fitted to the body.
    matrix.makeBasis(new THREE.Vector3(0, side * .99277, -side * .12), new THREE.Vector3(0, .12, .99277), new THREE.Vector3(side, 0, 0));
  } else {
    matrix.makeBasis(new THREE.Vector3(0, side * Math.cos(openAngle), side * Math.sin(openAngle)), new THREE.Vector3(0, -Math.sin(openAngle), Math.cos(openAngle)), new THREE.Vector3(side, 0, 0));
  }
  matrix.scale(new THREE.Vector3(width, length, .45)); matrix.setPosition(...position); return matrix;
}
function morphGeometry(closed, spread) {
  closed.morphAttributes.position = [spread.attributes.position.clone()];
  closed.morphAttributes.normal = [spread.attributes.normal.clone()]; spread.dispose(); return closed;
}
function pigment(y, z) {
  const q = z + .17 * (y - .7);
  const stripe = Math.max(1 - THREE.MathUtils.smoothstep(Math.abs(q + .35), .03, .07), 1 - THREE.MathUtils.smoothstep(Math.abs(q + .72), .03, .07));
  return new THREE.Color("#8e98a8").lerp(new THREE.Color("#404b5b"), stripe);
}

export function createWings(body, materials, kind) {
  const a = ANATOMY[kind], chicken = kind === "chicken";
  const feather = featherGeometry(1, .2, .018, 12, 6);
  for (const side of [-1, 1]) {
    const wing = new THREE.Group(); wing.name = side < 0 ? "Wing_L" : "Wing_R";
    wing.position.set(side * a.wingX, a.wingY, -.08); body.add(wing);
    const fold = new THREE.Group(); fold.name = side < 0 ? "Fold_L" : "Fold_R"; wing.add(fold);
    const closed = [], spread = [], uvs = [], indices = [];
    const rows = 30, cols = 12;
    for (let layer = 0; layer < 2; layer++) for (let row = 0; row <= rows; row++) {
      const s = .015 + row / rows * .97;
      for (let col = 0; col <= cols; col++) {
        const v = col / cols * 2 - 1;
        const y = a.wingY + .06 - s * .37 + v * (chicken ? .31 : .25) * Math.sin(Math.PI * s) ** .55;
        const z = .23 - s * (chicken ? 1.51 : 1.32);
        const puff = (1 - v * v) * Math.sin(Math.PI * s) * .045;
        const offset = layer ? .014 : .018 + puff * .10;
        const x = side * (flankX(kind, y, z) + offset);
        closed.push(x - wing.position.x, y - wing.position.y, z - wing.position.z);
        spread.push(side * (.045 + (layer ? -.01 : .018 + puff * .35)), y - wing.position.y, z - wing.position.z);
        uvs.push(col / cols * 2, (1 - s) * 3);
        if (row < rows && col < cols) {
          const i = layer * (rows + 1) * (cols + 1) + row * (cols + 1) + col;
          if (layer) indices.push(i, i + cols + 1, i + 1, i + 1, i + cols + 1, i + cols + 2);
          else indices.push(i, i + 1, i + cols + 1, i + 1, i + cols + 2, i + cols + 1);
        }
      }
    }
    const layerSize = (rows + 1) * (cols + 1);
    for (let row = 0; row < rows; row++) for (const col of [0, cols]) {
      const i = row * (cols + 1) + col, j = i + cols + 1;
      indices.push(i, i + layerSize, j, j, i + layerSize, j + layerSize);
    }
    for (const row of [0, rows]) for (let col = 0; col < cols; col++) {
      const i = row * (cols + 1) + col;
      indices.push(i, i + 1, i + layerSize, i + 1, i + layerSize + 1, i + layerSize);
    }
    const cover = new THREE.BufferGeometry();
    cover.setAttribute("position", new THREE.Float32BufferAttribute(closed, 3)); cover.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); cover.setIndex(indices); cover.computeVertexNormals();
    cover.setAttribute("color", new THREE.Float32BufferAttribute(closed.flatMap((_, i) => i % 3 === 0 ? pigment(closed[i + 1] + wing.position.y, closed[i + 2] + wing.position.z).toArray() : []), 3));
    const openCover = cover.clone(); openCover.setAttribute("position", new THREE.Float32BufferAttribute(spread, 3)); openCover.computeVertexNormals();
    addMesh(morphGeometry(cover, openCover), materials.wing, `WingCover_${side}`, fold);

    const batches = { covert: [], bar: [], pale: [], dark: [] };
    function addFeather(name, closedMatrix, openMatrix, layerOffset) {
      batches[name].push({ geometry: feather, matrix: closedMatrix, openMatrix, layerOffset });
    }
    // Small overlapping coverts provide actual relief and uneven feather edges.
    for (let row = 0; row < 4; row++) for (let col = 0; col < 9; col++) {
      const y = .055 - row * .085 + Math.sin(col * .8) * .012;
      const z = .24 - col * .105 - row * .045;
      const length = (.22 + row * .025) * (chicken ? 1.13 : 1);
      const material = "covert";
      const closedMatrix = featherMatrix(side, [0, y, z], length, .43);
      const openMatrix = featherMatrix(side, [side * (.069 + row * .002), -.19 + row * .075, .14 - col * .115 - row * .035], length, .43, Math.PI / 2);
      addFeather(material, closedMatrix, openMatrix, .027 + row * .001 + col * .0002);
    }
    // Secondary feathers form a rounded trailing edge, with separate longer primaries.
    for (let i = 0; i < 9; i++) {
      const length = .34 + Math.sin(i / 8 * Math.PI) * .11;
      const closedMatrix = featherMatrix(side, [0, -.22 - i * .004, -.13 - i * .075], length, .43);
      const openMatrix = featherMatrix(side, [side * .05, -.08, -.12 - i * .10], length, .43, Math.PI / 2);
      addFeather("pale", closedMatrix, openMatrix, .025 + i * .0003);
    }
    for (let i = 0; i < 10; i++) {
      const length = (.60 + Math.sin(i / 10 * Math.PI * .85) * .30) * (chicken ? 1.1 : 1);
      const closedMatrix = featherMatrix(side, [0, -.15 - i * .016, -.26 - i * .026], length, .44);
      const openMatrix = featherMatrix(side, [side * (.053 + i * .0006), -.08 + i * .008, -.57 - i * .025], length, .46, -.3 + i / 9 * 1.04);
      addFeather(i > 6 ? "dark" : "pale", closedMatrix, openMatrix, .025 + i * .0003);
    }
    for (const [name, parts] of Object.entries(batches)) {
      if (!parts.length) continue;
      const geometry = joinGeometry(parts);
      const positions = geometry.attributes.position;
      let cursor = 0;
      for (const part of parts) for (let i = 0; i < part.geometry.attributes.position.count; i++, cursor++) {
        const y = positions.getY(cursor) + wing.position.y, z = positions.getZ(cursor) + wing.position.z;
        positions.setX(cursor, side * (flankX(kind, y, z) + part.layerOffset) - wing.position.x);
      }
      geometry.computeVertexNormals();
      if (name === "covert") {
        const colors = [];
        for (let i = 0; i < positions.count; i++) colors.push(...pigment(positions.getY(i) + wing.position.y, positions.getZ(i) + wing.position.z).toArray());
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      }
      const opened = joinGeometry(parts.map((part) => ({ geometry: part.geometry, matrix: part.openMatrix })));
      addMesh(morphGeometry(geometry, opened), materials[name], `WingFeathers_${side}_${name}`, fold);
    }
  }
  feather.dispose();
}
