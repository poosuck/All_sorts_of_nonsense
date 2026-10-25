import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.__pigeonErrors = [];
  page.on("pageerror", (error) => page.__pigeonErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") page.__pigeonErrors.push(message.text()); });
});
test.afterEach(async ({ page }) => { expect(page.__pigeonErrors).toEqual([]); });
async function openPark(page) {
  await page.goto("/pigeon");
  const scene = page.getByTestId("pigeon-scene");
  await expect(scene).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  await expect(scene.locator("canvas")).toBeVisible();
  return scene;
}
const number = async (scene, key) => Number(await scene.getAttribute(`data-${key}`));

test("pigeon study opens from the home card, reloads directly and returns home", async ({ page }) => {
  await page.goto("/");
  await page.locator(".pigeon-card").click();
  await expect(page).toHaveURL("/pigeon");
  await expect(page.getByTestId("pigeon-scene")).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  await page.reload();
  await expect(page.getByTestId("pigeon-scene")).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  await page.getByRole("link", { name: "별짓 홈으로", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator(".pigeon-scene canvas")).toHaveCount(0);
});

test("actual rig walks, pecks, flies, lands and pauses; both body types can be observed", async ({ page }) => {
  test.setTimeout(120000);
  const scene = await openPark(page);
  // Observe the detailed rig in the two-model comparison scene. Park rendering,
  // navigation and download lifecycle are covered separately below.
  await page.getByRole("button", { name: "정면 비교", exact: true }).click();
  await page.getByRole("button", { name: "걷기", exact: true }).click();
  await expect(scene).toHaveAttribute("data-motion", "walk");
  const foot = await number(scene, "foot-z");
  await expect.poll(async () => Math.abs(await number(scene, "foot-z") - foot)).toBeGreaterThan(0.05);
  await page.getByRole("button", { name: "먹기", exact: true }).click();
  await expect.poll(async () => number(scene, "beak-height")).toBeLessThan(0.21);
  await expect.poll(async () => number(scene, "beak-height")).toBeGreaterThan(1);
  await page.getByRole("button", { name: "날기", exact: true }).click();
  await expect.poll(async () => number(scene, "height"), { timeout: 30000 }).toBeGreaterThan(2);
  await expect.poll(async () => Math.abs(await number(scene, "wing-angle"))).toBeGreaterThan(0.7);
  await page.getByRole("button", { name: "동작 일시정지" }).click();
  const frozen = await scene.evaluate((el) => ({ frame: el.dataset.frame, time: el.dataset.time, height: el.dataset.height }));
  // Wait for actual browser animation frames, not a mirrored implementation timer.
  await page.evaluate(() => new Promise((resolve) => {
    let frames = 0;
    const tick = () => ++frames === 15 ? resolve() : requestAnimationFrame(tick);
    requestAnimationFrame(tick);
  }));
  expect(await scene.evaluate((el) => ({ frame: el.dataset.frame, time: el.dataset.time, height: el.dataset.height }))).toEqual(frozen);
  await page.getByRole("button", { name: "동작 재개" }).click();
  await expect.poll(async () => number(scene, "height"), { timeout: 45000 }).toBeLessThan(0.05);
  await page.getByRole("button", { name: /닭둘기 존재감/ }).click();
  await expect(scene).toHaveAttribute("data-kind", "chicken");
  await page.getByRole("button", { name: "먹기", exact: true }).click();
  await expect.poll(async () => number(scene, "beak-height")).toBeLessThan(0.23);
  await page.getByRole("button", { name: "장면 처음부터" }).click();
  await expect(scene).toHaveAttribute("data-kind", "normal");
  await expect(scene).toHaveAttribute("data-motion", "eat");
  await expect(page.getByRole("button", { name: "동작 일시정지" })).toBeVisible();
});

test("pigeon scene tolerates narrow windows and releases the page on repeated navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 820 });
  await openPark(page);
  await expect(page.getByRole("button", { name: "날기", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "별짓 홈으로", exact: true }).click();
  await page.locator(".pigeon-card").click();
  await expect(page.getByTestId("pigeon-scene")).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  await expect(page.locator(".pigeon-scene canvas")).toHaveCount(1);
  await page.getByRole("link", { name: "별짓 홈으로", exact: true }).click();
  await expect(page.locator(".pigeon-scene canvas")).toHaveCount(0);
});

test("two authored models load and comparison views can scrub a real eating pose", async ({ page }) => {
  const models = [];
  page.on("response", (response) => { if (/\.glb(?:\?|$)/.test(response.url()) && response.status() === 200) models.push(response.url()); });
  await page.goto("/pigeon?view=front");
  const scene = page.getByTestId("pigeon-scene");
  await expect(scene).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  expect(models.some((url) => url.includes("normal-v2"))).toBe(true);
  expect(models.some((url) => url.includes("chicken-v2"))).toBe(true);
  await expect(scene).toHaveAttribute("data-view", "front");
  await page.getByRole("button", { name: "측면 비교", exact: true }).click();
  const seek = async (value) => {
    await page.locator("#pigeon-time").evaluate((element, value) => { element.value = value; element.dispatchEvent(new Event("input", { bubbles: true })); }, value);
    await expect(scene).toHaveAttribute("data-time", value.toFixed(3));
  };
  await seek(0);
  const raised = await number(scene, "beak-height");
  await seek(1.1);
  expect(raised - await number(scene, "beak-height")).toBeGreaterThan(.8);
  await expect(page.getByRole("button", { name: "동작 재개" })).toBeVisible();
  await page.getByRole("button", { name: "돌려보기", exact: true }).click();
  await expect(scene).toHaveAttribute("data-view", "turntable");
  await page.getByRole("button", { name: "공원", exact: true }).click();
  await expect(scene).toHaveAttribute("data-view", "park");
});

test("a corrupt model shows retry and a valid retry opens the scene", async ({ page }) => {
  const pattern = /normal-v2.*\.glb/;
  await page.route(pattern, (route) => route.fulfill({ status: 200, contentType: "model/gltf-binary", body: "invalid glb fixture" }));
  await page.goto("/pigeon");
  await expect(page.getByRole("button", { name: "장면 다시 불러오기" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("pigeon-scene")).toHaveAttribute("data-ready", "false");
  await page.unroute(pattern);
  await page.getByRole("button", { name: "장면 다시 불러오기" }).click();
  await expect(page.getByTestId("pigeon-scene")).toHaveAttribute("data-ready", "true", { timeout: 45000 });
});

test("leaving during model download aborts loading without inserting a late canvas", async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let started;
  const requested = new Promise((resolve) => { started = resolve; });
  await page.route(/\.glb(?:\?|$)/, async (route) => { started(); await gate; await route.continue().catch(() => {}); });
  await page.goto("/pigeon");
  await requested;
  await page.getByRole("link", { name: "별짓 홈으로", exact: true }).click();
  release();
  await expect(page).toHaveURL("/");
  await expect(page.locator(".pigeon-scene canvas")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /할 일은 없고/ })).toBeVisible();
});
