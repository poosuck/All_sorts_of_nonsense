import { chromium } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(), args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
const output = "docs/pigeon/editor";
await mkdir(output, { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true, offline: true });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on("pageerror", error => { errors.push(error.message); console.error("Page error:", error.message); });
  page.on("request", request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  // The managed Chromium blocks file:// navigation. Fulfil one document from
  // disk at a fixed origin; all scripts, styles and the GLB must work offline.
  const html = await readFile("dist/pigeon-editor/pigeon-editor.html");
  const documentUrl = "http://127.0.0.1:4175/standalone.html";
  await page.route(documentUrl, route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto(documentUrl);
  console.log("Loaded:", await page.title());
  const scene = page.getByTestId("pigeon-scene");
  await scene.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector("[data-testid=pigeon-scene]")?.dataset.ready === "true", { timeout: 45000 });
  assert.equal(await scene.getAttribute("data-editing"), "true");
  await page.getByRole("button", { name: "머리·목", exact: true }).click();
  await page.getByText("시점·표면 선택", { exact: true }).click();
  await page.getByRole("button", { name: "좌측면", exact: true }).click();
  await page.getByText("시점·표면 선택", { exact: true }).click();
  await page.screenshot({ path: output + "/standalone-editor.png" });
  const original = await page.locator("canvas").screenshot();
  const slider = page.getByLabel("머리 높이", { exact: true });
  await slider.fill("-20"); await slider.dispatchEvent("change");
  assert.notDeepEqual(await page.locator("canvas").screenshot(), original);
  await page.getByRole("button", { name: "모든 조정값을 0으로", exact: true }).click();
  assert.deepEqual(await page.locator("canvas").screenshot(), original);
  await slider.fill("-20"); await slider.dispatchEvent("change");
  await page.getByRole("button", { name: "깃털 숨기기", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "수정 모델 GLB 저장", exact: true }).click();
  const exported = await download;
  const bytes = await readFile(await exported.path());
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  assert.equal(json.meshes.length, 48);
  const body = json.nodes.find(node => node.name === "Body_neck_head_continuous");
  const position = json.accessors[json.meshes[body.mesh].primitives[0].attributes.POSITION];
  assert.ok(position.max[1] < 0.96, "Downloaded GLB must contain actual lowered head vertices");
  assert.ok(json.nodes.some(node => node.name === "Plumage_neck_gradient"));
  await page.getByRole("button", { name: "깃털 보이기", exact: true }).click();
  await page.reload();
  await page.waitForFunction(() => document.querySelector("[data-testid=pigeon-scene]")?.dataset.ready === "true");
  assert.equal(await slider.inputValue(), "-20");
  assert.deepEqual(errors, []);
  assert.deepEqual(requests.filter(url => url !== documentUrl), []);
  const zip = await readFile("downloads/pigeon-editor.zip");
  await writeFile(output + "/verification.json", JSON.stringify({
    htmlSha256: createHash("sha256").update(html).digest("hex"),
    zipSha256: createHash("sha256").update(zip).digest("hex"),
    htmlBytes: html.length, zipBytes: zip.length,
    selfContainedOffline: true, fileProtocolVerified: false,
    fileProtocolLimitation: "Managed Chromium blocks file:// navigation; local HTML supplied as one intercepted document instead.",
    networkRequests: requests.filter(url => url !== documentUrl).length, errors,
    export: { meshes: json.meshes.length, editedBodyMaxY: position.max[1], includesHiddenFeathers: true },
    resetRestoresExactRenderedImage: true, reloadRestoresSavedValues: true,
  }, null, 2) + "\n");
  console.log("Self-contained editor works offline: edit/reset/persist/export passed; no external resources, 0 page errors.");
} finally { await browser.close(); }
