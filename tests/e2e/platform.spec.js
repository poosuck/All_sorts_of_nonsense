import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.__errors = errors;
});
test.afterEach(async ({ page }) => {
  expect(page.__errors).toEqual([]);
});
async function openLab(page) {
  await page.goto("/pudding");
  await expect(page.getByTestId("pudding-target")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator(".canvas-mount canvas")).toBeVisible();
  await page.getByTestId("pudding-target").scrollIntoViewIfNeeded();
  const box = await page.getByTestId("pudding-target").boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height * 0.55, box };
}
async function setSlider(page, id, value) {
  await page.locator(`#${id}`).evaluate((element, value) => {
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}
async function swing(page, tool) {
  await page.getByRole("button", { name: tool, exact: true }).click();
  await page.getByTestId("pudding-target").scrollIntoViewIfNeeded();
  const box = await page.getByTestId("pudding-target").boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + box.height * 0.55;
  await page.mouse.move(box.x + 12, y);
  await page.mouse.down();
  await page.mouse.move(x + 90, y, { steps: 3 });
}

test("home, content preview, independent route, reload and home return", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /할 일은 없고/ }),
  ).toBeVisible();
  await expect(page.locator(".pigeon-card")).toContainText("새로 준비 중");
  await expect(page.locator(".pigeon-card")).toHaveAttribute("href", "/pigeon");
  await page.getByRole("link", { name: "말랑 푸딩 시작하기" }).click();
  await expect(page).toHaveURL("/pudding");
  await expect(page.locator(".canvas-mount canvas")).toBeVisible();
  await page.reload();
  await expect(page.locator(".canvas-mount canvas")).toBeVisible();
  await page.getByRole("link", { name: "별짓 홈으로" }).click();
  await expect(page).toHaveURL("/");
});

test("3D pressing, dragging, visible deformation and release restore", async ({
  page,
}) => {
  await openLab(page);
  const rest = await page.locator(".canvas-mount canvas").screenshot();
  await page.getByTestId("pudding-target").scrollIntoViewIfNeeded();
  const box = await page.getByTestId("pudding-target").boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + box.height * 0.55;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await expect(page.locator(".mode-badge")).toHaveText("꾸욱 누르는 중");
  await page.mouse.move(x + 85, y - 55, { steps: 3 });
  await expect(page.locator(".mode-badge")).toHaveText("쭈욱 늘어나는 중");
  const dragged = await page.locator(".canvas-mount canvas").screenshot();
  expect(dragged.equals(rest)).toBe(false);
  await page.mouse.up();
  await expect(page.locator(".mode-badge")).toHaveText("탱글탱글, 제자리로");
  await expect(page.locator(".mode-badge")).toHaveText("한번 만져볼까요?", {
    timeout: 20000,
  });
});

test("hand and bowl sweeps hit; misses and right clicks do not hit", async ({
  page,
}) => {
  const { box } = await openLab(page);
  await page.mouse.click(box.x + 10, box.y + 10);
  await expect(page.getByTestId("pudding-target")).toHaveAttribute(
    "data-impact-count",
    "0",
  );
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.55, {
    button: "right",
  });
  await expect(page.getByTestId("pudding-target")).toHaveAttribute(
    "data-impact-count",
    "0",
  );
  let hitNumber = 0;
  for (const tool of ["손", "양푼"]) {
    await swing(page, tool);
    await expect(page.getByTestId("pudding-target")).toHaveAttribute(
      "data-impact-count",
      String(++hitNumber),
    );
    await page.mouse.up();
  }
  await expect(page.getByTestId("pudding-target")).toHaveAttribute(
    "data-impact-count",
    "2",
  );
});

test("whip rope swings and physically contacts the pudding", async ({
  page,
}) => {
  const { x, y } = await openLab(page);
  await swing(page, "채찍");
  for (let i = 0; i < 2; i++) {
    await page.mouse.move(x - 120, y - 120, { steps: 3 });
    await page.mouse.move(x + 140, y - 80, { steps: 3 });
    await page.mouse.move(x - 120, y + 40, { steps: 3 });
  }
  await expect
    .poll(async () =>
      Number(
        await page
          .getByTestId("pudding-target")
          .getAttribute("data-impact-count"),
      ),
    )
    .toBeGreaterThan(0);
  await expect(page.locator("body > canvas")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator("body > canvas")).toBeHidden();
});

test("all five flavors persist, property settings, original reset and keyboard play", async ({
  page,
}) => {
  await openLab(page);
  for (const name of ["딸기", "말차", "초코", "우유", "커스터드"]) {
    const button = page.getByRole("button", { name, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }
  await page.getByRole("button", { name: "우유", exact: true }).click();
  await page.reload();
  await expect(page.getByTestId("pudding-target")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "우유", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await setSlider(page, "softness", 100);
  await setSlider(page, "recovery", 0);
  await expect(page.locator("output[for=softness]")).toHaveText("100");
  await expect(page.locator("output[for=recovery]")).toHaveText("00");
  await page.getByRole("button", { name: /처음 상태로/ }).click();
  await expect(page.locator("output[for=softness]")).toHaveText("60");
  await expect(page.locator("output[for=recovery]")).toHaveText("50");
  await page.getByTestId("pudding-target").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("pudding-target")).toHaveAttribute(
    "data-impact-count",
    "1",
  );
});

test("mobile touch press and release, layout and narrow desktop do not overflow", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    deviceScaleFactor: 0.5,
    isMobile: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const { x, y } = await openLab(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const session = await context.newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await expect(page.locator(".mode-badge")).toHaveText("꾸욱 누르는 중");
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.locator(".mode-badge")).toHaveText("탱글탱글, 제자리로");
  await page.screenshot({
    path: "test-results/mobile-pudding.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await context.close();
});

test("404 route returns home", async ({ page }) => {
  await page.goto("/missing");
  await expect(
    page.getByRole("heading", { name: /여긴 아무 별짓도/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /홈으로 돌아가기/ }).click();
  await expect(page).toHaveURL("/");
});

test("original samples output audio, overlap, follow volume/mute and close on leave", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Base = window.AudioContext;
    window.__audio = {
      contexts: [],
      voices: [],
      monitors: [],
      samples: [],
      ends: 0,
    };
    const processorCode = `class Meter extends AudioWorkletProcessor {
      process(inputs){let peak=0;for(const channel of inputs[0]||[])for(const value of channel)peak=Math.max(peak,Math.abs(value));
      this.port.postMessage({peak,time:currentTime});return true;}}
      registerProcessor('pudding-test-meter',Meter);`;
    const moduleUrl = URL.createObjectURL(
      new Blob([processorCode], { type: "text/javascript" }),
    );
    window.AudioContext = class extends Base {
      constructor(options) {
        super(options);
        window.__audio.contexts.push(this);
      }
      createBufferSource() {
        const source = super.createBufferSource(),
          start = source.start.bind(source);
        source.start = (...args) => {
          window.__audio.voices.push({
            time: this.currentTime,
            wall: performance.now(),
            duration: source.buffer.duration,
            offset: args[1],
          });
          return start(...args);
        };
        source.addEventListener("ended", () => window.__audio.ends++);
        return source;
      }
      createDynamicsCompressor() {
        const compressor = super.createDynamicsCompressor(),
          id = window.__audio.contexts.indexOf(this);
        const ready = this.audioWorklet.addModule(moduleUrl).then(() => {
          const meter = new AudioWorkletNode(this, "pudding-test-meter"),
            silent = this.createGain();
          silent.gain.value = 0;
          meter.port.onmessage = (e) => {
            window.__audio.samples.push({ ...e.data, id });
            if (window.__audio.samples.length > 40000)
              window.__audio.samples.splice(0, 20000);
          };
          compressor.connect(meter).connect(silent).connect(this.destination);
          return meter;
        });
        window.__audio.monitors.push(ready);
        return compressor;
      }
    };
    document.addEventListener(
      "keydown",
      () => {
        window.__audio.inputTime = performance.now();
      },
      true,
    );
  });
  await openLab(page);
  await page.getByRole("button", { name: "양푼", exact: true }).click();
  await page.evaluate(() => Promise.all(__audio.monitors));
  await page.getByTestId("pudding-target").focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => __audio.voices.length)).toBe(1);
  expect(
    await page.evaluate(() => __audio.voices[0].wall - __audio.inputTime),
  ).toBeLessThan(150);
  const capturedPeak = () =>
    page.evaluate(() => Math.max(0, ...__audio.samples.map((s) => s.peak)));
  await expect.poll(capturedPeak).toBeGreaterThan(0.001);
  // Two events in one browser task model a burst without headless GPU round-trip delays.
  const overlap = await page.getByTestId("pudding-target").evaluate((el) => {
    const before = __audio.voices.length;
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    return __audio.voices.slice(before).map((v) => v.time);
  });
  expect(overlap).toHaveLength(2);
  expect(overlap[1] - overlap[0]).toBeLessThan(0.02);
  // Keep audio-thread samples, so a completed short sample cannot disappear between polls.
  await setSlider(page, "volume", 0);
  const markers = await page.evaluate(() =>
    __audio.contexts.map((c) => c.currentTime + 0.15),
  );
  await expect
    .poll(() =>
      page.evaluate((markers) => {
        const recent = __audio.samples.filter((s) => s.time > markers[s.id]);
        return recent.length ? Math.max(...recent.map((s) => s.peak)) : 1;
      }, markers),
    )
    .toBeLessThan(0.0001);
  await setSlider(page, "volume", 30);
  await page.evaluate(() => {
    __audio.samples = [];
  });
  await page.getByTestId("pudding-target").focus();
  await page.keyboard.press("Enter");
  await expect.poll(capturedPeak).toBeGreaterThan(0.001);
  await page.getByRole("button", { name: "음소거", exact: true }).click();
  const muteMarkers = await page.evaluate(() =>
    __audio.contexts.map((c) => c.currentTime + 0.15),
  );
  await expect
    .poll(() =>
      page.evaluate((markers) => {
        const recent = __audio.samples.filter((s) => s.time > markers[s.id]);
        return recent.length ? Math.max(...recent.map((s) => s.peak)) : 1;
      }, muteMarkers),
    )
    .toBeLessThan(0.0001);
  await page.getByRole("button", { name: "음소거 해제", exact: true }).click();
  await expect(page.locator("output[for=volume]")).toHaveText("30%");
  for (const name of ["손", "채찍"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.evaluate(() => Promise.all(__audio.monitors));
    await page.evaluate(() => {
      __audio.samples = [];
    });
    await page.getByTestId("pudding-target").focus();
    await page.keyboard.press("Enter");
    await expect.poll(capturedPeak).toBeGreaterThan(0.001);
  }
  await page.getByRole("link", { name: "별짓 홈으로" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        __audio.contexts.every((ctx) => ctx.state === "closed"),
      ),
    )
    .toBe(true);
});
