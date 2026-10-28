import * as THREE from "three";
import { makeTexture, seededRandom } from "../../src/features/pigeon/resources.js";
import { ANATOMY } from "./anatomy.mjs";

export async function createMaterials(kind = "normal") {
  const random = seededRandom(251025);
  // Neutral overlapping vanes keep pigment separate from feather relief.
  const featherColor = makeTexture((ctx, w, h) => {
    ctx.fillStyle = '#bfc1c4'; ctx.fillRect(0, 0, w, h);
    const stepX = 64, stepY = 48;
    for (let row = -1; row < h / stepY + 1; row++) for (let col = -1; col < w / stepX + 1; col++) {
      const x = col * stepX + (row % 2) * stepX / 2;
      const y = row * stepY;
      const tone = 188 + Math.floor(random() * 15);
      ctx.fillStyle = `rgb(${tone},${tone + 1},${tone + 3})`;
      ctx.beginPath(); ctx.moveTo(x - 34, y); ctx.quadraticCurveTo(x - 32, y + 46, x, y + 57);
      ctx.quadraticCurveTo(x + 32, y + 46, x + 34, y); ctx.fill();
      ctx.strokeStyle = 'rgba(60,65,75,.13)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = .65;
      for (let j = -24; j <= 24; j += 4) {
        ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + j, y + 43 - Math.abs(j) * .25); ctx.stroke();
      }
    }
  }, 512, 1024);
  featherColor.wrapS = featherColor.wrapT = THREE.RepeatWrapping;
  featherColor.repeat.set(.4, .4);
  const featherNormal = makeTexture((ctx, w, h) => {
    ctx.fillStyle = 'rgb(128,128,255)'; ctx.fillRect(0, 0, w, h);
    for (let row = -1; row < h / 48 + 1; row++) for (let col = -1; col < w / 64 + 1; col++) {
      const x = col * 64 + (row % 2) * 32, y = row * 48;
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgb(128,151,251)';
      ctx.beginPath(); ctx.moveTo(x - 31, y + 14); ctx.quadraticCurveTo(x - 25, y + 45, x, y + 56);
      ctx.quadraticCurveTo(x + 25, y + 45, x + 31, y + 14); ctx.stroke();
    }
  }, 512, 1024);
  featherNormal.wrapS = featherNormal.wrapT = THREE.RepeatWrapping;
  featherNormal.repeat.set(.4, .4);
  featherNormal.colorSpace = THREE.NoColorSpace;
  const anatomy = ANATOMY[kind];
  const sheenMask = makeTexture((ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      const v = (1 - y / h) * 2;
      const value = Math.round(255 * THREE.MathUtils.smoothstep(v, anatomy.neckY + .02, anatomy.neckY + .17) * (1 - THREE.MathUtils.smoothstep(v, anatomy.headY - .03, anatomy.headY + .10)));
      ctx.fillStyle = `rgb(${value},${value},${value})`; ctx.fillRect(0, y, w, 1);
    }
  }, 16, 256);
  sheenMask.colorSpace = THREE.NoColorSpace; sheenMask.channel = 1;
  const roughnessMap = makeTexture((ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      const v = (1 - y / h) * 2;
      const mask = THREE.MathUtils.smoothstep(v, anatomy.neckY + .02, anatomy.neckY + .17) * (1 - THREE.MathUtils.smoothstep(v, anatomy.headY - .03, anatomy.headY + .10));
      const value = Math.round(255 * (1 - mask * .48));
      ctx.fillStyle = `rgb(${value},${value},${value})`; ctx.fillRect(0, y, w, 1);
    }
  }, 16, 256);
  roughnessMap.colorSpace = THREE.NoColorSpace; roughnessMap.channel = 1;
  const vane = makeTexture((ctx, w, h) => {
    ctx.fillStyle = "#dadbdd"; ctx.fillRect(0, 0, w, h);
    const shade = ctx.createLinearGradient(0, 0, w, 0);
    shade.addColorStop(0, "#b1b7bf"); shade.addColorStop(.5, "#c5c9cc"); shade.addColorStop(1, "#b7bdc5");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h);
    for (let y = -60; y < h; y += 3) {
      ctx.strokeStyle = "rgba(65,74,86,.08)"; ctx.lineWidth = .6;
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
  const materials = {
    body: new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: featherColor, vertexColors: true, normalMap: featherNormal, normalScale: new THREE.Vector2(.32, .32), roughness: .9, roughnessMap, sheen: .16, sheenColor: '#c7c3be', sheenRoughness: .9, metalness: 0, iridescence: .85, iridescenceMap: sheenMask, iridescenceIOR: 1.3, iridescenceThicknessRange: [230, 430], side: THREE.DoubleSide }),
    wing: new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: .9, map: featherColor, sheen: .2, side: THREE.DoubleSide }),
    covert: new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: .9, map: vane, sheen: .2, side: THREE.DoubleSide }),
    bar: new THREE.MeshPhysicalMaterial({ color: '#414b5c', roughness: .87, map: vane, sheen: .25, side: THREE.DoubleSide }),
    lid: new THREE.MeshStandardMaterial({ color: '#444e60', map: featherColor, roughness: .88, side: THREE.DoubleSide }),
    pale: new THREE.MeshStandardMaterial({ color: "#77818f", roughness: .9, map: vane, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: "#444a55", roughness: .84, map: vane, side: THREE.DoubleSide }),
    beak: new THREE.MeshStandardMaterial({ color: "#696762", roughness: .68 }),
    cere: new THREE.MeshStandardMaterial({ color: "#b8b2a6", roughness: .84 }),
    feet: new THREE.MeshStandardMaterial({ color: "#b45c50", roughness: .84 }),
    claw: new THREE.MeshStandardMaterial({ color: "#5f5651", roughness: .8 }),
    eyeRim: new THREE.MeshStandardMaterial({ color: "#655e57", roughness: .75 }),
    iris: new THREE.MeshPhysicalMaterial({ map: irisMap, roughness: .21, clearcoat: 1, clearcoatRoughness: .08 }),
    pupil: new THREE.MeshPhysicalMaterial({ color: "#090b0c", roughness: .12, clearcoat: 1, clearcoatRoughness: .04 }),
    glint: new THREE.MeshBasicMaterial({ color: "#fff9e9" }),
  };
  for (const [name, material] of Object.entries(materials)) material.name = `Pigeon_${name}`;
  return materials;
}
