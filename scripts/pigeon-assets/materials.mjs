import * as THREE from "three";
import { makeTexture, seededRandom } from "../../src/features/pigeon/resources.js";
import { ANATOMY } from "./anatomy.mjs";

export async function createMaterials(kind = "normal") {
  const random = seededRandom(251025);
  const featherColor = await new THREE.TextureLoader().loadAsync(new URL('./textures/feather-albedo.png', import.meta.url).href);
  featherColor.colorSpace = THREE.SRGBColorSpace;
  featherColor.wrapS = featherColor.wrapT = THREE.RepeatWrapping;
  featherColor.anisotropy = 4;
  const featherNormal = makeTexture((ctx, w, h) => {
    ctx.fillStyle = "rgb(128,128,255)"; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 20000; i++) {
      const x = random() * w, y = random() * h;
      ctx.strokeStyle = `rgba(${random() > .5 ? '152,118,250' : '110,138,251'},.45)`;
      ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y + 6); ctx.stroke();
    }
  }, 512, 1024);
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
    body: new THREE.MeshPhysicalMaterial({ map: featherColor, vertexColors: true, normalMap: featherNormal, normalScale: new THREE.Vector2(.08, .08), roughness: .9, roughnessMap, sheen: .24, sheenColor: '#c7c3be', sheenRoughness: .9, metalness: .015, iridescence: .55, iridescenceMap: sheenMask, iridescenceIOR: 1.3, iridescenceThicknessRange: [230, 430], side: THREE.DoubleSide }),
    wing: new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: .9, map: featherColor, sheen: .2, side: THREE.DoubleSide }),
    covert: new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: .9, map: vane, sheen: .2, side: THREE.DoubleSide }),
    bar: new THREE.MeshPhysicalMaterial({ color: '#414b5c', roughness: .87, map: vane, sheen: .25, side: THREE.DoubleSide }),
    lid: new THREE.MeshStandardMaterial({ color: '#444e60', map: featherColor, roughness: .88, side: THREE.DoubleSide }),
    pale: new THREE.MeshStandardMaterial({ color: "#b9bec6", roughness: .86, map: vane, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: "#444a55", roughness: .84, map: vane, side: THREE.DoubleSide }),
    beak: new THREE.MeshStandardMaterial({ color: "#77746d", roughness: .63 }),
    cere: new THREE.MeshStandardMaterial({ color: "#c5c0b3", roughness: .84 }),
    feet: new THREE.MeshStandardMaterial({ color: "#9d564c", roughness: .84 }),
    claw: new THREE.MeshStandardMaterial({ color: "#5f5651", roughness: .8 }),
    eyeRim: new THREE.MeshStandardMaterial({ color: "#655e57", roughness: .75 }),
    iris: new THREE.MeshPhysicalMaterial({ map: irisMap, roughness: .21, clearcoat: 1, clearcoatRoughness: .08 }),
    pupil: new THREE.MeshPhysicalMaterial({ color: "#090b0c", roughness: .12, clearcoat: 1, clearcoatRoughness: .04 }),
    glint: new THREE.MeshBasicMaterial({ color: "#fff9e9" }),
  };
  for (const [name, material] of Object.entries(materials)) material.name = `Pigeon_${name}`;
  return materials;
}
