import * as THREE from "three";
import { makeTexture, mesh, seededRandom } from "./resources.js";

export function createPark(scene, pool) {
  const box = pool.geometry("park-box", () => new THREE.BoxGeometry(1, 1, 1));
  const cylinder = pool.geometry("park-cylinder", () => new THREE.CylinderGeometry(1, 1, 1, 10));
  const stone = pool.material({ color: "#d2c9b0", roughness: 0.95 });
  const woodTexture = pool.texture(makeTexture((ctx, w, h) => {
    const random = seededRandom(31); ctx.fillStyle = "#986c4c"; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 850; i++) {
      const y = random() * h;
      ctx.strokeStyle = random() > .45 ? "rgba(43,21,9,.13)" : "rgba(249,219,170,.16)";
      ctx.lineWidth = .3 + random() * 1.2; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(w * .3, y + 4, w * .7, y - 4, w, y + 1); ctx.stroke();
    }
  }, 512, 128));
  const wood = pool.material({ map: woodTexture, bumpMap: woodTexture, bumpScale: .013, roughness: .78 });
  const iron = pool.material({ color: "#394b43", roughness: 0.62, metalness: 0.3 });
  const bark = pool.material({ color: "#77634a", roughness: 1 });
  const paving = pool.texture(makeTexture((ctx, w) => {
    const random = seededRandom(8);
    ctx.fillStyle = "#8d8679"; ctx.fillRect(0, 0, w, w);
    const size = w / 8;
    for (let row = -1; row < 9; row++) {
      for (let col = -1; col < 9; col++) {
        const x = col * size + (row % 2) * size / 2;
        const y = row * size;
        const shade = Math.floor(158 + random() * 32);
        ctx.fillStyle = `rgb(${shade + 11},${shade + 5},${shade - 7})`;
        ctx.beginPath(); ctx.roundRect(x + 2, y + 2, size - 4, size - 4, 3); ctx.fill();
        ctx.strokeStyle = "rgba(255,250,229,.25)";
        ctx.strokeRect(x + 2.5, y + 2.5, size - 5, size - 5);
        for (let i = 0; i < 500; i++) {
          ctx.fillStyle = random() > 0.5 ? "rgba(80,65,44,.1)" : "rgba(255,250,229,.22)";
          ctx.fillRect(x + random() * size, y + random() * size, 1.4, 1.4);
        }
      }
    }
  }, 1024));
  paving.wrapS = paving.wrapT = THREE.RepeatWrapping;
  paving.repeat.set(15, 15);
  const groundMaterial = pool.material({ map: paving, bumpMap: paving, bumpScale: .038, roughness: .94 });
  const floor = mesh(pool, pool.geometry("floor", () => new THREE.PlaneGeometry(60, 60)), groundMaterial, [0, -0.02, 18], null, scene);
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false;

  const random = seededRandom(2026);
  const leafGeometry = pool.geometry("green-leaf", () => new THREE.CircleGeometry(1, 7));
  const leafGreen = pool.material({ color: "#94a66e", roughness: .88, side: THREE.DoubleSide });
  function foliage(count, center, spread) {
    const leaves = new THREE.InstancedMesh(leafGeometry, leafGreen, count);
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const theta = random() * Math.PI * 2, vertical = random() * 2 - 1, radius = Math.cbrt(random());
      const horizontal = Math.sqrt(1 - vertical * vertical);
      dummy.position.set(center[0] + Math.cos(theta) * horizontal * radius * spread[0], center[1] + vertical * radius * spread[1], center[2] + Math.sin(theta) * horizontal * radius * spread[2]);
      dummy.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      dummy.scale.set(.10 + random() * .13, .045 + random() * .055, 1);
      dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
      leaves.setColorAt(i, color.setHSL(.19 + random() * .08, .25 + random() * .25, .48 + random() * .28));
    }
    leaves.castShadow = true; leaves.receiveShadow = true; scene.add(leaves);
  }
  function bench(x, z, yaw = 0) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = yaw; scene.add(group);
    for (let i = 0; i < 5; i++) {
      mesh(pool, box, wood, [0, 0.82, (i - 2) * 0.18], [3.8, 0.12, 0.15], group);
      const slat = mesh(pool, box, wood, [0, 1.13 + i * 0.18, -0.43 - i * 0.018], [3.8, 0.135, 0.11], group);
      slat.rotation.x = -0.1;
    }
    for (const x of [-1.45, 1.45]) {
      mesh(pool, box, iron, [x, 0.42, 0], [0.12, 0.84, 0.65], group);
      mesh(pool, box, iron, [x, 1.05, 0.01], [0.1, 0.13, 0.85], group);
      mesh(pool, box, iron, [x, 1.27, -0.5], [0.1, 1.1, 0.12], group);
    }
  }
  bench(4.3, -5.4, -0.12);
  bench(-7.4, -6.4, 0.22);

  // Low planters keep the silhouettes readable while framing the riverside view.
  for (const [x, z, width] of [[-7, -8, 8], [5.4, -8.6, 9], [11.3, -2, 3]]) {
    mesh(pool, box, stone, [x, 0.37, z], [width, 0.74, 1.9], scene);
    foliage(Math.round(width * 130), [x, 1.12, z], [width * .5, .65, .95]);
  }
  for (const [x, z, scale] of [[7.7, -8.5, 1.1], [-9.5, -8.2, 1.15], [12, -11, 1.3], [-14, -13, 1.2]]) {
    mesh(pool, cylinder, bark, [x, 2.6 * scale, z], [0.28 * scale, 5.2 * scale, 0.28 * scale], scene);
    foliage(1700, [x, 5.1 * scale, z], [3.0 * scale, 1.75 * scale, 2.5 * scale]);
  }

  // A quiet Han-river-like horizon: rail, water, bridge and a restrained skyline.
  const river = mesh(pool, box, pool.material({ color: "#b4c8c4", roughness: 0.45, metalness: 0.12 }), [0, -0.15, -22], [65, 0.1, 20], scene);
  river.castShadow = false;
  const railing = pool.material({ color: "#687a70", roughness: 0.75 });
  for (let x = -20; x <= 20; x += 2.5) {
    mesh(pool, cylinder, railing, [x, 0.6, -12], [0.04, 1.2, 0.04], scene);
  }
  for (const y of [0.4, 1]) mesh(pool, box, railing, [0, y, -12], [40, 0.05, 0.05], scene);
  const skyline = pool.material({ color: "#c3cbd0", roughness: 1 });
  for (let i = 0; i < 22; i++) {
    const height = 1.5 + random() * 4;
    mesh(pool, box, skyline, [-25 + i * 2.4, height / 2 - 0.5, -33 - random() * 3], [1 + random(), height, 1.2], scene).castShadow = false;
  }
  const bridge = pool.material({ color: "#beaca0", roughness: 1 });
  mesh(pool, box, bridge, [4, 1.7, -28], [33, 0.22, 0.9], scene);
  for (let x = -11; x < 20; x += 4) mesh(pool, box, bridge, [x, 0.6, -28], [0.4, 2.2, 0.5], scene);

  // A few fallen leaves; instanced so scenery does not grow with play time.
  const leafMaterial = pool.material({ color: "#bfa25e", roughness: 1, side: THREE.DoubleSide });
  const leaves = new THREE.InstancedMesh(pool.geometry("fallen-leaf", () => new THREE.CircleGeometry(1, 5)), leafMaterial, 65);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 65; i++) {
    dummy.position.set((random() - 0.5) * 21, 0.012, (random() - 0.5) * 17);
    dummy.rotation.set(-Math.PI / 2, 0, random() * Math.PI);
    dummy.scale.set(0.07 + random() * 0.06, 0.035 + random() * 0.04, 1);
    dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
  }
  leaves.receiveShadow = true; scene.add(leaves);

  // Decorative fixed grains for the eating animation study, not throwable game resources.
  const grainMaterial = pool.material({ color: "#dfb365", roughness: 0.83 });
  const grains = new THREE.InstancedMesh(pool.geometry("grain", () => new THREE.SphereGeometry(1, 8, 6)), grainMaterial, 115);
  for (let i = 0; i < 115; i++) {
    const patch = i < 75 ? [-0.95, 2.0] : [1.65, 1.25];
    dummy.position.set(patch[0] + (random() - 0.5) * 1.7, 0.035, patch[1] + (random() - 0.5) * 1.1);
    dummy.rotation.set(random(), random() * Math.PI, random());
    dummy.scale.set(0.035, 0.023, 0.05); dummy.updateMatrix(); grains.setMatrixAt(i, dummy.matrix);
  }
  grains.castShadow = true; scene.add(grains);
}
