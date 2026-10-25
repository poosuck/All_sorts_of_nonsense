import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4188", "--strictPort"], { stdio: ["ignore", "pipe", "pipe"] });
let browser;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Asset authoring server did not start")), 15000);
    server.on("exit", (code) => { clearTimeout(timeout); reject(new Error(`Asset server exited ${code}`)); });
    server.stderr.on("data", (chunk) => process.stderr.write(chunk));
    server.stdout.on("data", (chunk) => { if (chunk.toString().includes("Local:")) { clearTimeout(timeout); resolve(); } });
  });
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage();
  page.on("pageerror", (error) => process.stderr.write(`${error.message}\n`));
  await page.goto("http://127.0.0.1:4188/scripts/pigeon-assets/bake.html");
  await page.waitForFunction(() => typeof window.bakePigeons === "function");
  const results = await page.evaluate(() => window.bakePigeons());
  const directory = new URL("../src/assets/pigeon/", import.meta.url);
  await mkdir(directory, { recursive: true });
  const manifest = { revision: 2, authored: "2026-10-25", provenance: "Original contour meshes, skinned plumage, articulated feather vanes and generated PBR textures. No downloaded third-party model or image.", files: [], sources: {} };
  for (const result of results) {
    const filename = `${result.kind}-v2.glb`, buffer = Buffer.from(result.data, "base64");
    await writeFile(new URL(filename, directory), buffer);
    manifest.files.push({ file: filename, bytes: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex"), triangles: result.triangles, clips: result.clips });
  }
  for (const name of ["geometry.mjs", "model.mjs", "materials.mjs", "bake.html"]) {
    const buffer = await readFile(new URL(`pigeon-assets/${name}`, import.meta.url));
    manifest.sources[`scripts/pigeon-assets/${name}`] = createHash("sha256").update(buffer).digest("hex");
  }
  for (const path of ["src/features/pigeon/rig.js", "src/features/pigeon/motion.js"]) {
    const buffer = await readFile(new URL(`../${path}`, import.meta.url));
    manifest.sources[path] = createHash("sha256").update(buffer).digest("hex");
  }
  await writeFile(new URL("manifest.json", directory), JSON.stringify(manifest, null, 2) + "\n");
  process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
} finally {
  await browser?.close(); server.kill("SIGTERM");
}
