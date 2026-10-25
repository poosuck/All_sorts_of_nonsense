import * as THREE from "three";
import { makeTexture, seededRandom } from "../../src/features/pigeon/resources.js";

export function createMaterials() {
  const random = seededRandom(251025);
  const featherColor = makeTexture((ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      const v = 1 - y / h;
      const neck = THREE.MathUtils.smoothstep(v, .58, .73) * (1 - THREE.MathUtils.smoothstep(v, .85, .92));
      for (let x = 0; x < w; x += 4) {
        const front = Math.max(0, Math.cos(x / w * Math.PI * 2));
        const body = new THREE.Color().setRGB(.56 + .16 * front, .58 + .14 * front, .62 + .09 * front);
        const throat = new THREE.Color().setHSL(.38 + .43 * THREE.MathUtils.smoothstep(v, .70, .84), .42, .052 + .009 * Math.cos(x / w * Math.PI * 4));
        body.lerp(throat, neck * .94);
        body.lerp(new THREE.Color("#505b6b"), THREE.MathUtils.smoothstep(v, .88, .96));
        ctx.fillStyle = `#${body.getHexString()}`; ctx.fillRect(x, y, 4, 1);
      }
    }
    for (let i = 0; i < 26000; i++) {
      const x = random() * w, y = random() * h;
      ctx.strokeStyle = random() > .48 ? "rgba(245,245,236,.11)" : "rgba(30,42,56,.08)";
      ctx.lineWidth = .55;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 1.5, y + 4, x + .2, y + 8); ctx.stroke();
    }
  }, 512, 1024);
  const featherNormal = makeTexture((ctx, w, h) => {
    ctx.fillStyle = "rgb(128,128,255)"; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 20000; i++) {
      const x = random() * w, y = random() * h;
      ctx.strokeStyle = `rgba(${random() > .5 ? '152,118,250' : '110,138,251'},.45)`;
      ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y + 6); ctx.stroke();
    }
  }, 512, 1024);
  featherNormal.colorSpace = THREE.NoColorSpace;
  const sheenMask = makeTexture((ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      const v = 1 - y / h;
      const value = Math.round(255 * THREE.MathUtils.smoothstep(v, .6, .73) * (1 - THREE.MathUtils.smoothstep(v, .85, .92)));
      ctx.fillStyle = `rgb(0,${value},0)`; ctx.fillRect(0, y, w, 1);
    }
  }, 16, 256);
  sheenMask.colorSpace = THREE.NoColorSpace;
  const vane = makeTexture((ctx, w, h) => {
    ctx.fillStyle = "#dadbdd"; ctx.fillRect(0, 0, w, h);
    const shade = ctx.createLinearGradient(0, 0, w, 0);
    shade.addColorStop(0, "#999fa8"); shade.addColorStop(.5, "#e2e1de"); shade.addColorStop(1, "#a4aab1");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h);
    for (let y = -60; y < h; y += 3) {
      ctx.strokeStyle = "rgba(65,74,86,.17)"; ctx.lineWidth = .6;
      ctx.beginPath(); ctx.moveTo(w / 2, y); ctx.lineTo(0, y + 65); ctx.moveTo(w / 2, y); ctx.lineTo(w, y + 65); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(235,234,220,.6)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
  }, 128, 256);
  const irisMap = makeTexture((ctx, w) => {
    const center = w / 2;
    ctx.fillStyle = "#bd7027"; ctx.fillRect(0, 0, w, w);
    for (let i = 0; i < 350; i++) {
      const theta = i / 350 * Math.PI * 2;
      ctx.strokeStyle = i % 3 ? "rgba(75,37,12,.6)" : "rgba(255,192,59,.8)";
      ctx.lineWidth = .6 + random();
      ctx.beginPath(); ctx.moveTo(center + Math.cos(theta) * 22, center + Math.sin(theta) * 22);
      ctx.lineTo(center + Math.cos(theta) * (48 + random() * 15), center + Math.sin(theta) * (48 + random() * 15)); ctx.stroke();
    }
  }, 128);
  const coverts = makeTexture((ctx, w, h) => {
    ctx.fillStyle = "#aeb6c2"; ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 18; row++) {
      for (let col = -1; col < 13; col++) {
        const x = col * w / 12 + (row % 2) * w / 24, y = row * h / 18;
        ctx.fillStyle = row % 3 ? "rgba(218,221,225,.13)" : "rgba(65,74,88,.07)";
        ctx.beginPath(); ctx.ellipse(x, y, w / 21, h / 24, -.12, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const level of [.34, .56]) {
      ctx.strokeStyle = "rgba(43,51,63,.88)"; ctx.lineWidth = h * .052;
      ctx.beginPath(); ctx.moveTo(-10, h * level); ctx.quadraticCurveTo(w * .5, h * (level + .09), w + 10, h * (level + .035)); ctx.stroke();
    }
    for (let i = 0; i < 6000; i++) {
      const x = random() * w, y = random() * h;
      ctx.strokeStyle = "rgba(242,242,233,.09)"; ctx.lineWidth = .5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y + 7); ctx.stroke();
    }
  }, 256, 512);
  const materials = {
    body: new THREE.MeshPhysicalMaterial({ map: featherColor, normalMap: featherNormal, normalScale: new THREE.Vector2(.27, .27), roughness: .87, sheen: .38, sheenColor: "#ded9d2", sheenRoughness: .9, iridescence: .45, iridescenceMap: sheenMask, iridescenceIOR: 1.3, iridescenceThicknessRange: [160, 370], side: THREE.DoubleSide }),
    wing: new THREE.MeshStandardMaterial({ color: "#b7bfca", roughness: .87, map: coverts, side: THREE.DoubleSide }),
    pale: new THREE.MeshStandardMaterial({ color: "#b9bec6", roughness: .86, map: vane, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: "#444a55", roughness: .84, map: vane, side: THREE.DoubleSide }),
    beak: new THREE.MeshStandardMaterial({ color: "#77746d", roughness: .63 }),
    cere: new THREE.MeshStandardMaterial({ color: "#d5d2c9", roughness: .84 }),
    feet: new THREE.MeshStandardMaterial({ color: "#b76f69", roughness: .84 }),
    claw: new THREE.MeshStandardMaterial({ color: "#5f5651", roughness: .8 }),
    eyeRim: new THREE.MeshStandardMaterial({ color: "#746556", roughness: .75 }),
    iris: new THREE.MeshPhysicalMaterial({ map: irisMap, roughness: .3, clearcoat: 1, clearcoatRoughness: .08 }),
    pupil: new THREE.MeshPhysicalMaterial({ color: "#090b0c", roughness: .12, clearcoat: 1, clearcoatRoughness: .04 }),
    glint: new THREE.MeshBasicMaterial({ color: "#fff9e9" }),
  };
  for (const [name, material] of Object.entries(materials)) material.name = `Pigeon_${name}`;
  return materials;
}
