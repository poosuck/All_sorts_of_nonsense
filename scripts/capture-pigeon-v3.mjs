import { chromium } from "@playwright/test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const base = process.env.REVIEW_BASE_URL || "http://127.0.0.1:4174";
const output = new URL("../docs/pigeon/v3/", import.meta.url);
const temporary = await mkdtemp(join(tmpdir(), "pigeon-v3-review-"));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
const errors = [], requests = [], records = [];
const labels = { threequarter: "모델 보기", front: "정면 비교", side: "측면 비교", pair: "크기 비교", turntable: "돌려보기", idle: "쉬기", walk: "걷기", eat: "먹기", fly: "날기" };
try {
  await mkdir(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", (request) => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(base).origin) requests.push(request.url()); });
  await page.goto(`${base}/pigeon`);
  await page.waitForSelector('[data-testid="pigeon-scene"][data-ready="true"]', { timeout: 90000 });
  const target = page.getByTestId("pigeon-scene"), canvas = target.locator("canvas");
  async function choose(value) { await page.getByRole("button", { name: labels[value], exact: true }).click(); }
  async function hideControls() {
    return page.addStyleTag({ content: ".pigeon-title-block,.pigeon-observation,.pigeon-scene-caption,.pigeon-bottom-bar{visibility:hidden!important}.pigeon-world::after{display:none!important}" });
  }
  async function seek(seconds) {
    const before = Number(await target.getAttribute("data-frame"));
    await page.locator("#pigeon-time").evaluate((element, value) => {
      element.step = "any"; element.value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, seconds);
    await page.waitForFunction(({ time, frame }) => {
      const data = document.querySelector('[data-testid="pigeon-scene"]').dataset;
      return Number(data.frame) > frame && Math.abs(Number(data.time) - time) < .002;
    }, { time: seconds, frame: before });
  }
  async function capture(name, view, mode, time) {
    await choose(view); await choose(mode); await seek(time);
    if (name === "normal-threequarter") await page.screenshot({ path: new URL("controls.png", output).pathname, fullPage: true });
    const overlayStyle = await hideControls();
    await canvas.screenshot({ path: new URL(`${name}.png`, output).pathname });
    await overlayStyle.evaluate((element) => element.remove());
    records.push({ name, data: await target.evaluate((element) => ({ ...element.dataset })) });
  }
  for (const kind of ["normal", "chicken"]) {
    await page.getByRole("button", { name: kind === "normal" ? /일반 비둘기 적당히/ : /닭둘기 존재감/ }).click();
    await capture(`${kind}-threequarter`, "threequarter", "idle", 0);
    await capture(`${kind}-front`, "front", "idle", 0);
    await capture(`${kind}-side`, "side", "idle", 0);
    await capture(`${kind}-eating`, "side", "eat", 1.1);
    await capture(`${kind}-flight`, "threequarter", "fly", 1.9);
    process.stdout.write(`Captured ${kind} views\n`);
  }
  await capture("pair", "pair", "idle", 0);

  // Review actual rendered poses at known simulation times. This does not
  // measure real-time frame rate on a user's GPU.
  await page.setViewportSize({ width: 1200, height: 820 });
  const fps = 12;
  let frame = 0;
  const chapters = [];
  for (const [mode, duration] of [["idle", 5.1], ["walk", 1.45], ["eat", 2.6], ["fly", 7.6]]) {
    await choose(mode);
    const start = frame / fps, overlayStyle = await hideControls();
    for (let i = 0; i <= Math.ceil(duration * fps); i++) {
      await seek(Math.min(i / fps, duration));
      await canvas.screenshot({ path: join(temporary, `frame-${String(frame++).padStart(4, "0")}.png`) });
    }
    await overlayStyle.evaluate((element) => element.remove());
    chapters.push({ mode, start, end: frame / fps });
    process.stdout.write(`Captured ${mode}\n`);
  }
  await new Promise((resolve, reject) => {
    const process = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-framerate", String(fps), "-i", join(temporary, "frame-%04d.png"), "-vf", "scale=1200:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-movflags", "+faststart", new URL("motion-review.mp4", output).pathname], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = ""; process.stderr.on("data", (chunk) => { stderr += chunk; });
    process.on("error", reject); process.on("exit", (code) => code === 0 ? resolve() : reject(new Error(stderr)));
  });
  const manifest = JSON.parse(await readFile(new URL("../src/assets/pigeon/manifest.json", import.meta.url)));
  const record = { date: "2026-10-25", source: base, revision: 3, browser: await page.evaluate(() => navigator.userAgent), renderer: "Chromium headless / SwiftShader", images: records, video: { filename: "motion-review.mp4", fps, frames: frame, chapters, method: "Actual WebGL canvas frames sampled using the visible pose scrubber. Not a real-time frame-rate measurement." }, modelFiles: manifest.files, errors, externalRequests: requests };
  await writeFile(new URL("review-record.json", output), JSON.stringify(record, null, 2) + "\n");
  if (errors.length || requests.length) throw new Error(JSON.stringify({ errors, requests }));
  process.stdout.write(`Saved v3 review images and ${frame} WebGL frames\n`);
} finally {
  await browser.close(); await rm(temporary, { recursive: true, force: true });
}
