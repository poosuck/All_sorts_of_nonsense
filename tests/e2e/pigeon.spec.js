import { test, expect } from "@playwright/test";
const views = [
  ["정면", "front"], ["좌측 45°", "left45"], ["좌측면", "left"], ["후면 좌측 45°", "back-left45"],
  ["후면", "back"], ["후면 우측 45°", "back-right45"], ["우측면", "right"], ["우측 45°", "right45"],
];
test("one Blender GLB renders from all eight cameras and returns home", async ({ page }) => {
  const errors = [], requests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (/\.glb(?:\?|$)/.test(request.url())) requests.push(request.url()); });
  await page.goto("/pigeon?view=front");
  const scene = page.getByTestId("pigeon-scene");
  await expect(scene).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  await expect(scene).toHaveAttribute("data-revision", "clay-v12");
  await expect(scene).toHaveAttribute("data-framing", "body");
  await expect(scene).toHaveAttribute("data-surface", "clay");
  await expect(scene).toHaveAttribute("data-source", "blender-glb");
  const canvas = page.locator(".pigeon-viewport canvas");
  await expect(canvas).toHaveCount(1);
  await canvas.evaluate(el => { el.dataset.originalCanvas = "true"; });
  const screenshots = new Set();
  for (const [label, id] of views) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(scene).toHaveAttribute("data-view", id);
    await expect(canvas).toHaveAttribute("data-original-canvas", "true");
    screenshots.add((await canvas.screenshot()).toString("base64"));
  }
  expect(screenshots.size).toBeGreaterThan(5);
  await page.getByRole("button", { name: "얼굴", exact: true }).click();
  await expect(scene).toHaveAttribute("data-framing", "head");
  await page.getByRole("button", { name: "정면", exact: true }).click();
  await expect(scene).toHaveAttribute("data-view", "front");
  await expect(canvas).toHaveAttribute("data-original-canvas", "true");
  expect(screenshots.has((await canvas.screenshot()).toString("base64"))).toBe(false);
  const clayHead = (await canvas.screenshot()).toString("base64");
  await page.getByRole("button", { name: "머리·목", exact: true }).click();
  await expect(scene).toHaveAttribute("data-framing", "head-neck");
  expect((await canvas.screenshot()).toString("base64")).not.toBe(clayHead);
  const clayHeadNeck = (await canvas.screenshot()).toString("base64");
  await page.getByRole("button", { name: "기존색", exact: true }).click();
  await expect(scene).toHaveAttribute("data-surface", "color");
  expect((await canvas.screenshot()).toString("base64")).not.toBe(clayHeadNeck);
  await page.getByRole("button", { name: "무채색", exact: true }).click();
  await expect(scene).toHaveAttribute("data-surface", "clay");
  expect(requests).toHaveLength(1);
  expect(requests[0]).not.toMatch(/normal-v|chicken|kenchoo/);
  await page.getByRole("button", { name: "기존색", exact: true }).click();
  await expect(scene).toHaveAttribute("data-surface", "color");
  await page.getByRole("button", { name: "↺ 기본 시점으로", exact: true }).click();
  await expect(scene).toHaveAttribute("data-view", "left45");
  await expect(scene).toHaveAttribute("data-framing", "body");
  await expect(scene).toHaveAttribute("data-surface", "clay");
  await page.getByRole("link", { name: "별짓 홈으로", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("bad model data offers a valid retry", async ({ page }) => {
  const pattern = /pigeon[^/]*\.glb(?:\?|$)/;
  await page.route(pattern, route => route.fulfill({ status: 200, contentType: "model/gltf-binary", body: "invalid model" }));
  await page.goto("/pigeon");
  await expect(page.getByRole("button", { name: "다시 불러오기", exact: true })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.unroute(pattern);
  await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await expect(page.getByTestId("pigeon-scene")).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  await expect(page.locator("canvas")).toHaveCount(1);
});
test("leaving during download cannot insert a late canvas", async ({ page }) => {
  let release, started;
  const gate = new Promise(resolve => { release = resolve; });
  const request = new Promise(resolve => { started = resolve; });
  await page.route(/pigeon[^/]*\.glb(?:\?|$)/, async route => { started(); await gate; await route.continue().catch(() => {}); });
  await page.goto("/pigeon");
  await request;
  await page.getByRole("link", { name: "별짓 홈으로", exact: true }).click();
  release();
  await expect(page).toHaveURL("/");
  await expect(page.locator("canvas")).toHaveCount(0);
});
test("old model lab stays removed; narrow study remains usable", async ({ page }) => {
  await page.goto("/pigeon/model-lab");
  await expect(page.getByText("404 — 딴 길로 왔네요")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pigeon?frame=head-neck&surface=color");
  await expect(page.getByTestId("pigeon-scene")).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  await expect(page.getByTestId("pigeon-scene")).toHaveAttribute("data-framing", "head-neck");
  await expect(page.getByTestId("pigeon-scene")).toHaveAttribute("data-surface", "color");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "정면", exact: true }).click();
  await expect(page.getByTestId("pigeon-scene")).toHaveAttribute("data-view", "front");
});
