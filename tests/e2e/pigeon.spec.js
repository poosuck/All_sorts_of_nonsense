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
