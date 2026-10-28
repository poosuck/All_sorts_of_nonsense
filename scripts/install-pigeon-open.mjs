#!/usr/bin/env node
// Install a legitimately downloaded free/open-license GLB into the real pigeon scene.
// No downloads, model scraping, paid assets, API keys, or new runtime packages.
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const SOURCES = Object.freeze({
  urban: {
    name: "Urban pigeon",
    author: "Innerscene",
    license: "CC0-1.0",
    source: "https://www.innerscene.com/tools/library/3d-parts/urban-pigeon-3977bbba",
    attribution: "No credit required (CC0).",
  },
  kenchoo: {
    name: "Pigeon",
    author: "kenchoo",
    license: "CC-BY-4.0",
    source: "https://sketchfab.com/3d-models/pigeon-ddd5ef4a94eb4159937a9de25c45697c",
    attribution: '"Pigeon" by kenchoo, CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/. Adapted for 별짓.',
  },
  dudecon: {
    name: "Animated Bird, Pigeon",
    author: "dudecon",
    license: "CC-BY-4.0",
    source: "https://sketchfab.com/3d-models/animated-bird-pigeon-797d27b68af3453e865149435df6aa30",
    attribution: '"Animated Bird, Pigeon" by dudecon, CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/. Adapted for 별짓.',
  },
});

const [argument, sourceId] = process.argv.slice(2);
if (!argument || !SOURCES[sourceId]) {
  console.error("사용법: npm run pigeon:install -- \"C:/Downloads/urban-pigeon.glb\" urban");
  console.error("출처: urban (CC0) / kenchoo (CC BY) / dudecon (CC BY)");
  process.exitCode = 1;
} else {
  try {
    const original = resolve(argument);
    const data = await readFile(original);
    if (data.byteLength < 20 || data.byteLength > 40 * 1024 * 1024 ||
        data.toString("ascii", 0, 4) !== "glTF" ||
        data.readUInt32LE(4) !== 2 || data.readUInt32LE(8) !== data.byteLength) {
      throw new Error("유효한 glTF 2.0 .glb 파일이 아닙니다(최대 40MB). Blender에서 GLB로 내보내 주세요.");
    }
    const source = SOURCES[sourceId];
    const directory = resolve("public/models");
    await mkdir(directory, { recursive: true });
    const output = resolve(directory, "pigeon-open.glb");
    if (original !== output) await copyFile(original, output);
    const sha256 = createHash("sha256").update(data).digest("hex");
    await writeFile(resolve(directory, "pigeon-open.json"),
      JSON.stringify({ ...source, sha256, bytes: data.length,
        installedAt: new Date().toISOString(), userVerified: true }, null, 2) + "\n");
    console.log("✓ 무료 라이선스 비둘기 모델 설치: " + output);
    console.log("  크기: " + data.length + " bytes / sha256: " + sha256);
    console.log("  출처: " + source.source);
    console.log("  저작자 표시: " + source.attribution);
    console.log("  모델 다운로드 파일과 해당 출처·라이선스의 일치 여부는 직접 확인해야 합니다.");
    console.log("  실행: npm run dev → http://localhost:5173/pigeon");
  } catch (error) {
    console.error("비둘기 모델 설치 실패:", error.message);
    process.exitCode = 1;
  }
}
