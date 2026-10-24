import * as THREE from "three";
import { connect, makeTexture, mesh, seededRandom } from "./resources.js";

export function createPigeonMaterials(pool) {
  const feathers = pool.texture(makeTexture((ctx, w, h) => {
    const random = seededRandom(42);
    ctx.fillStyle = "#d4d5d2";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4200; i++) {
      const x = random() * w, y = random() * h;
      ctx.strokeStyle = `rgba(${random() > 0.5 ? "255,255,255" : "68,75,80"},${0.025 + random() * 0.08})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4, y + 6, x, y + 14); ctx.stroke();
    }
    for (let row = 0; row < 21; row++) {
      for (let col = -1; col < 22; col++) {
        const x = col * 25 + (row % 2) * 12.5, y = row * 25;
        ctx.strokeStyle = "rgba(75,83,91,.12)";
        ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.quadraticCurveTo(x, y + 20, x + 10, y); ctx.stroke();
      }
    }
  }));
  const neck = pool.texture(makeTexture((ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#616e76");
    gradient.addColorStop(0.24, "#477d74");
    gradient.addColorStop(0.46, "#476f69");
    gradient.addColorStop(0.63, "#77536f");
    gradient.addColorStop(0.87, "#85818e");
    gradient.addColorStop(1, "#9e9ea2");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    const random = seededRandom(70);
    for (let row = 0; row < 26; row++) {
      for (let col = 0; col < 42; col++) {
        ctx.strokeStyle = `rgba(20,34,40,${0.13 + random() * 0.15})`;
        ctx.beginPath();
        ctx.arc(col * 13 + (row % 2) * 6, row * 20, 7, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
    }
  }));
  return {
    body: pool.material({ color: "#b1b5bd", map: feathers, bumpMap: feathers, bumpScale: 0.012, roughness: 0.92 }),
    breast: pool.material({ color: "#c8c4c3", map: feathers, bumpMap: feathers, bumpScale: 0.012, roughness: 0.95 }),
    head: pool.material({ color: "#7f8d9d", map: feathers, roughness: 0.88 }),
    wing: pool.material({ color: "#9da6b2", map: feathers, bumpMap: feathers, bumpScale: 0.01, roughness: 0.9 }),
    pale: pool.material({ color: "#bdc1c8", map: feathers, roughness: 0.9 }),
    dark: pool.material({ color: "#424954", map: feathers, roughness: 0.9 }),
    neck: pool.material({ map: neck, bumpMap: feathers, bumpScale: 0.012, roughness: 0.48, metalness: 0.22 }),
    beak: pool.material({ color: "#605852", roughness: 0.72 }),
    cere: pool.material({ color: "#e3d8c9", roughness: 0.9 }),
    feet: pool.material({ color: "#b86e61", roughness: 0.86 }),
    claw: pool.material({ color: "#625550", roughness: 0.8 }),
    eyeRim: pool.material({ color: "#9d6f58", roughness: 0.64 }),
    iris: pool.material({ color: "#ef962a", roughness: 0.4 }),
    pupil: pool.material({ color: "#080d12", roughness: 0.12 }),
    glint: pool.material({ color: "#fff7e9", emissive: "#fff5df", emissiveIntensity: 0.3 }),
  };
}

export function createPigeon(pool, materials, { chicken = false } = {}) {
  const sphere = pool.geometry("bird-sphere", () => new THREE.SphereGeometry(1, 24, 18));
  const feather = pool.geometry("feather", () => new THREE.SphereGeometry(1, 10, 8));
  const cylinder = pool.geometry("bird-cylinder", () => new THREE.CylinderGeometry(1, 1, 1, 7));
  const cone = pool.geometry("beak-cone", () => new THREE.ConeGeometry(1, 1, 12));
  const root = new THREE.Group();
  const torso = new THREE.Group();
  root.add(torso);
  const fat = chicken ? 1.38 : 1;
  const body = mesh(pool, sphere, materials.body, [0, 0.83, -0.1], [0.47 * fat, 0.59 * fat, 0.65 * fat], torso);
  body.rotation.x = -0.16;
  mesh(pool, sphere, materials.breast, [0, 0.82, 0.27], [0.435 * fat, 0.56 * fat, 0.47 * fat], torso);

  // Shared neck/head pivot is also the attachment point for future body-hit grains.
  const neck = new THREE.Group();
  neck.position.set(0, chicken ? 1.1 : 0.96, 0.26);
  torso.add(neck);
  mesh(pool, sphere, materials.neck, [0, 0.16, 0.01], [0.29 * (chicken ? 1.16 : 1), 0.48, 0.3], neck);
  const head = mesh(pool, sphere, materials.head, [0, 0.57, 0.1], [0.285, 0.31, 0.29], neck);
  head.rotation.x = -0.12;
  const beak = mesh(pool, cone, materials.beak, [0, 0.46, 0.48], [0.09, 0.28, 0.085], neck);
  beak.rotation.x = Math.PI / 2 + 0.27;
  mesh(pool, sphere, materials.cere, [0, 0.515, 0.35], [0.105, 0.072, 0.11], neck);

  for (const side of [-1, 1]) {
    // Layered rim, orange iris and glossy black pupil; eyes remain small, as in the reference.
    const eye = new THREE.Group();
    eye.position.set(side * 0.253, 0.61, 0.202);
    eye.rotation.y = side * Math.PI / 2;
    neck.add(eye);
    mesh(pool, sphere, materials.eyeRim, [0, 0, 0], [0.069, 0.073, 0.029], eye);
    mesh(pool, sphere, materials.iris, [0, 0, 0.018], [0.054, 0.057, 0.022], eye);
    mesh(pool, sphere, materials.pupil, [0, 0.002, 0.035], [0.028, 0.035, 0.014], eye);
    mesh(pool, sphere, materials.glint, [-0.011, 0.018, 0.046], [0.009, 0.011, 0.005], eye);
  }

  const wings = [];
  const matrix = new THREE.Object3D();
  const featherColor = new THREE.Color();
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(side * 0.41 * fat, 1.03, -0.1);
    torso.add(wing);
    const cover = mesh(pool, sphere, materials.wing, [side * 0.02, -0.2, -0.12], [0.12, 0.4 * fat, 0.51 * fat], wing);
    cover.rotation.x = -0.27;
    const feathers = new THREE.InstancedMesh(feather, materials.pale, 24);
    feathers.castShadow = true;
    feathers.receiveShadow = true;
    for (let i = 0; i < 24; i++) {
      const row = i < 12 ? 0 : 1;
      const j = i % 12;
      matrix.position.set(side * (0.055 + row * 0.045), -0.1 - j * 0.039, 0.17 - j * 0.055 - row * 0.1);
      matrix.rotation.set(-0.4 - j * 0.025, side * 0.08, side * (0.06 + j * 0.018));
      matrix.scale.set(0.041, (0.19 + j * 0.014) * fat, 0.11);
      matrix.updateMatrix();
      feathers.setMatrixAt(i, matrix.matrix);
      const darkBand = j === 4 || j === 8;
      featherColor.set(darkBand ? "#626b78" : row ? "#a7afbb" : "#cbd0d7");
      feathers.setColorAt(i, featherColor);
    }
    wing.add(feathers);
    wings.push(wing);
  }

  const tail = new THREE.Group();
  tail.position.set(0, 0.76, -0.65 * fat);
  tail.rotation.x = -0.25;
  torso.add(tail);
  const tails = new THREE.InstancedMesh(feather, materials.dark, 8);
  tails.castShadow = true;
  for (let i = 0; i < 8; i++) {
    matrix.position.set((i - 3.5) * 0.065, -0.02, -0.18);
    matrix.rotation.set(-0.15, (i - 3.5) * -0.065, 0);
    matrix.scale.set(0.075, 0.037, 0.42);
    matrix.updateMatrix(); tails.setMatrixAt(i, matrix.matrix);
  }
  tail.add(tails);

  const legs = [];
  for (const side of [-1, 1]) {
    const shin = mesh(pool, cylinder, materials.feet, null, null, root);
    const foot = new THREE.Group();
    root.add(foot);
    const toes = [];
    for (const [spread, length] of [[-0.65, 0.2], [0, 0.25], [0.65, 0.19], [Math.PI, 0.11]]) {
      const toe = mesh(pool, cylinder, materials.feet, null, null, foot);
      const end = [Math.sin(spread) * length, -0.018, Math.cos(spread) * length];
      connect(toe, [0, 0.01, 0], end, 0.016);
      const claw = mesh(pool, cone, materials.claw, end, [0.018, 0.055, 0.015], foot);
      claw.rotation.x = Math.PI / 2;
      toes.push(toe);
    }
    legs.push({ side, shin, foot, toes });
  }

  const probe = new THREE.Vector3();
  const pose = (motion) => {
    torso.rotation.x = motion.bodyPitch;
    neck.rotation.x = motion.neckAngle;
    neck.position.y = (chicken ? 1.1 : 0.96) + motion.neckBob * (chicken ? 2.1 : 1);
    neck.position.z = 0.26 + motion.neckBob * 1.6 * Math.max(0, 1 - motion.neckAngle / 0.35);
    tail.rotation.z = Math.sin(motion.leftStep * 3) * 0.035;
    wings.forEach((wing, i) => {
      const side = i ? 1 : -1;
      wing.rotation.z = side * (motion.wingOpen * 1.28 + motion.wingFlap);
      wing.rotation.x = motion.wingOpen * -0.25;
    });
    legs.forEach(({ side, shin, foot }, i) => {
      const step = i ? motion.rightStep : motion.leftStep;
      const lift = i ? motion.rightLift : motion.leftLift;
      foot.position.set(side * 0.17, 0.06 + lift + motion.legTuck * 0.31, 0.13 + step - motion.legTuck * 0.25);
      foot.rotation.x = -motion.legTuck * 0.9;
      connect(shin, [side * 0.19, 0.43, -0.02], foot.position.toArray(), 0.025);
    });
  };
  return {
    root, torso, neck, wings, head, pose,
    inspect() {
      root.updateWorldMatrix(true, true);
      beak.localToWorld(probe.set(0, 0.5, 0));
      const beakHeight = probe.y;
      legs[0].foot.getWorldPosition(probe);
      return {
        beakHeight, footHeight: probe.y, footZ: probe.z,
        wingAngle: wings[1].rotation.z, height: root.position.y,
        x: root.position.x, z: root.position.z,
      };
    },
    dispose() { for (const wing of wings) wing.children.filter((v) => v.isInstancedMesh).forEach((v) => v.dispose()); tails.dispose(); },
  };
}
