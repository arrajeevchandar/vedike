import { expect, test } from "@playwright/test";

test("home and public showcase are navigable", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole("heading", { name: /Where Culture Meets Community/i })).toBeVisible();
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: /Community Events/i })).toBeVisible();
  await expect(page.getByText("Kannada Sangama 2026")).toBeVisible();
  await page.goto("/competitions/rangoli-art-challenge");
  await expect(page.getByRole("heading", { name: "Rangoli Art Challenge" })).toBeVisible();
  await expect(page.getByText("Showcase only").first()).toBeDisabled();
});

test("prototype home scroll windows stay stable without renderer errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("webpack-hmr")) {
      errors.push(message.text());
    }
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.scrollTo(0, 0));
  const progressWindows = [
    [0, 0],
    [0.12, 0],
    [0.3, 1],
    [0.52, 2],
    [0.72, 3],
    [0.92, -1],
  ] as const;

  for (const [progress, activeChapter] of progressWindows) {
    await page.evaluate(async ({ progress: scrollProgress }) => {
      const runway = document.querySelector<HTMLElement>("[data-home-runway]")!;
      window.scrollTo(0, (runway.offsetHeight - window.innerHeight) * scrollProgress);
      await new Promise((resolve) => window.setTimeout(resolve, 400));
    }, { progress });
    await page.waitForFunction((chapter) => {
      const element = document.querySelector<HTMLElement>(`[data-home-chapter="${chapter}"]`);
      return chapter === -1
        ? [...document.querySelectorAll<HTMLElement>("[data-home-chapter]")].every((item) => getComputedStyle(item).visibility === "hidden")
        : getComputedStyle(element!).visibility === "visible";
    }, activeChapter);
    const canvasOpacity = await page.locator("[data-home-canvas]").evaluate((element) => Number(getComputedStyle(element).opacity));
    expect(canvasOpacity).toBeGreaterThan(0.9);
    for (let chapter = 0; chapter < 4; chapter += 1) {
      const visible = await page.locator(`[data-home-chapter="${chapter}"]`).evaluate((element) => getComputedStyle(element).visibility === "visible");
      expect(visible).toBe(activeChapter === chapter);
    }
  }
  expect(errors).toEqual([]);
});
