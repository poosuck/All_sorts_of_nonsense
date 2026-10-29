import { chromium } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const revision=JSON.parse(await readFile("src/assets/pigeon/manifest.json","utf8")).revision;
const output = "docs/pigeon/reviews/"+revision;
await mkdir(output, { recursive: true });
const env = { ...process.env, TEST_PRODUCTION: "1", PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath() };
const check = spawnSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "tests/e2e/pigeon.spec.js", "--timeout", "120000"], { env, stdio: "inherit" });
if (check.status !== 0) process.exit(check.status || 1);
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "4175", "--strictPort"], { stdio: "ignore" });
let browser;
try {
  let connected = false;
  for (let i=0;i<60;i++) {
    try { connected = (await fetch("http://127.0.0.1:4175")).ok; } catch {}
    if (connected) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!connected) throw new Error("Preview server did not start");
  browser = await chromium.launch({ executablePath:env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 1 });
  const errors = [], requests = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", r => { if (/\.glb(?:\?|$)/.test(r.url())) requests.push(r.url()); });
  await page.goto("http://127.0.0.1:4175/pigeon?capture=1&view=front");
  await page.waitForFunction(() => document.querySelector("[data-testid=pigeon-scene]")?.dataset.ready === "true");
  const views = ["front","left45","left","back-left45","back","back-right45","right","right45"];
  const captures = [];
  let budget=500000;
  for (let i=0;i<views.length;i++) {
    await page.locator(".study-views button").nth(i).evaluate(button => button.click());
    await page.waitForFunction(view => document.querySelector("[data-testid=pigeon-scene]").dataset.view === view, views[i]);
    const path = output + "/web-" + views[i] + ".png";
    const bytes = await page.locator("canvas").screenshot({ path });
    captures.push({ view: views[i], path, bytes: bytes.length });
    if (process.env.PIGEON_EXPORT_BUNDLE === "1" && bytes.length <= budget) {
      budget -= bytes.length;
      const encoded = bytes.toString("base64"), parts = Math.ceil(encoded.length / 16000);
      console.log("PIGEON_FILE_HEADER " + JSON.stringify({ path, parts, bytes: bytes.length }));
      for (let p=0;p<parts;p++) console.log("PIGEON_FILE_CHUNK " + JSON.stringify({ path, index:p, data:encoded.slice(p*16000,(p+1)*16000) }));
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  if (requests.length !== 1) throw new Error("Unexpected model requests: " + requests.length);
  const manifest=JSON.parse(await readFile("src/assets/pigeon/manifest.json","utf8"));
  const record={ run:process.env.GITHUB_RUN_ID || null, commit:process.env.GITHUB_SHA || null, revision:manifest.revision,
    glb_sha256:manifest.glb_sha256, renderer:"Chromium / Three.js / same GLB", tests:4, passed:true, requests,captures,errors };
  await writeFile(output+"/web-report.json",JSON.stringify(record,null,2)+"\n");
  console.log("PIGEON_WEB_REPORT " + JSON.stringify(record));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
