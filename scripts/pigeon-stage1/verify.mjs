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
  await page.goto("http://127.0.0.1:4175/pigeon?capture=1&view=front&surface=clay");
  await page.waitForFunction(() => {
    const scene = document.querySelector("[data-testid=pigeon-scene]");
    return scene?.dataset.ready === "true" && scene.dataset.surface === "clay";
  });
  const views = ["front","left45","left","back-left45","back","back-right45","right","right45"];
  const captures = [];
  const imageData = new Map();
  let budget=500000;
  async function selectView(view) {
    const before = Number(await page.getByTestId("pigeon-scene").getAttribute("data-frame"));
    await page.locator(".study-views button").nth(views.indexOf(view)).evaluate(button => button.click());
    await page.waitForFunction(({view, before}) => {
      const scene = document.querySelector("[data-testid=pigeon-scene]");
      return scene.dataset.view === view && Number(scene.dataset.frame) > before;
    }, {view, before});
  }
  async function capture(view, framing) {
    const surface = "clay";
    await selectView(view);
    const actual = await page.getByTestId("pigeon-scene").evaluate(scene => ({
      framing: scene.dataset.framing, surface: scene.dataset.surface,
    }));
    if (actual.framing !== framing || actual.surface !== surface) throw new Error("Capture state mismatch: " + JSON.stringify(actual));
    const stem = "web-clay-" + (framing === "body" ? "" : framing + "-") + view;
    const path = output + "/" + stem + ".png";
    const bytes = await page.locator("canvas").screenshot({ path });
    imageData.set(stem, "data:image/png;base64," + bytes.toString("base64"));
    captures.push({ view, framing, surface, path, bytes: bytes.length });
    if (process.env.PIGEON_EXPORT_BUNDLE === "1" && bytes.length <= budget) {
      budget -= bytes.length;
      const encoded = bytes.toString("base64"), parts = Math.ceil(encoded.length / 16000);
      console.log("PIGEON_FILE_HEADER " + JSON.stringify({ path, parts, bytes: bytes.length }));
      for (let p=0;p<parts;p++) console.log("PIGEON_FILE_CHUNK " + JSON.stringify({ path, index:p, data:encoded.slice(p*16000,(p+1)*16000) }));
    }
  }
  for (const view of views) await capture(view, "body");
  await page.locator(".study-framing button").nth(1).evaluate(button => button.click());
  await page.waitForFunction(() => document.querySelector("[data-testid=pigeon-scene]").dataset.framing === "head");
  for (const view of ["front", "left45", "left"]) await capture(view, "head");
  async function contactSheet(stems, labels, tile, filename) {
    const data = await page.evaluate(async ({sources, labels, tile}) => {
      const sheet = document.createElement("canvas");
      sheet.width = tile * sources.length;
      sheet.height = tile + 32;
      const context = sheet.getContext("2d");
      context.fillStyle = "#efeeea";
      context.fillRect(0, 0, sheet.width, sheet.height);
      const images = await Promise.all(sources.map(src => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Capture sheet image did not load"));
        image.src = src;
      })));
      context.fillStyle = "#323230";
      context.font = "12px sans-serif";
      images.forEach((image, i) => {
        context.drawImage(image, i*tile, 0, tile, tile);
        context.fillText(labels[i], i*tile + 12, tile + 21);
      });
      return sheet.toDataURL("image/png").split(",")[1];
    }, {sources: stems.map(stem => imageData.get(stem)), labels, tile});
    await writeFile(output + "/" + filename, Buffer.from(data, "base64"));
  }
  const fiveViews = ["front", "left45", "left", "back-left45", "back"];
  await contactSheet(fiveViews.map(view => "web-clay-" + view), fiveViews, 320, "web-clay-five-views.png");
  await contactSheet(["front", "left45", "left"].map(view => "web-clay-head-" + view), ["front", "left45", "left"], 400, "web-clay-head-three-views.png");
  await page.locator(".study-framing button").nth(2).evaluate(button => button.click());
  await page.waitForFunction(() => document.querySelector("[data-testid=pigeon-scene]").dataset.framing === "head-neck");
  const headNeckViews = ["front", "left45", "left", "back-left45"];
  for (const view of headNeckViews) await capture(view, "head-neck");
  await contactSheet(headNeckViews.map(view => "web-clay-head-neck-" + view), headNeckViews, 400, "web-clay-head-neck-four-views.png");
  if (captures.length !== 15 || captures.some(capture => capture.surface !== "clay")) throw new Error("Expected 15 clay-only captures");
  if (errors.length) throw new Error(errors.join("\n"));
  if (requests.length !== 1) throw new Error("Unexpected model requests: " + requests.length);
  const manifest=JSON.parse(await readFile("src/assets/pigeon/manifest.json","utf8"));
  const record={ run:process.env.GITHUB_RUN_ID || null, commit:process.env.GITHUB_SHA || null, revision:manifest.revision,
    glb_sha256:manifest.glb_sha256, renderer:"Chromium / Three.js / same GLB", surface:"clay", tests:4, passed:true, requests,captures,errors };
  await writeFile(output+"/web-report.json",JSON.stringify(record,null,2)+"\n");
  console.log("PIGEON_WEB_REPORT " + JSON.stringify(record));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
