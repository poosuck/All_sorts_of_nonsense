import { test, expect } from "@playwright/test";

test("pigeon restarts without loading a renderer or model assets", async ({ page }) => {
  const errors = [];
  const renderingRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/\.(glb|gltf|bin)(?:\?|$)|\/features\/pigeon\/|\/models\/kenchoo\//.test(request.url())) {
      renderingRequests.push(request.url());
    }
  });
  await page.goto("/");
  await page.getByRole("link", { name: "비둘기 모이주기", exact: true }).click();
  await expect(page).toHaveURL("/pigeon");
  await expect(page.getByRole("heading", { name: "비둘기 모이주기" })).toBeVisible();
  await expect(page.getByText("처음부터 다시 준비합니다.")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  // Old bookmarked views must also open the reset page.
  await page.goto("/pigeon?view=pair&pigeon-review=flow");
  await page.reload();
  await expect(page.getByText("처음부터 다시 준비합니다.")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("link", { name: "별짓 홈으로" }).click();
  await expect(page).toHaveURL("/");
  expect(renderingRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("the previous model lab route is removed", async ({ page }) => {
  await page.goto("/pigeon/model-lab");
  await expect(page.getByText("404 — 딴 길로 왔네요")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
});
