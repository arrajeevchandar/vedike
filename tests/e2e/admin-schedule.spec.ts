import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SignJWT } from "jose";

function localAuthSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  try {
    const line = readFileSync(join(process.cwd(), ".env.local"), "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith("AUTH_SECRET="));
    const value = line?.slice(line.indexOf("=") + 1).trim();
    if (value) return value.replace(/^(["'])(.*)\1$/, "$2");
  } catch {
    // Local development can use the same documented fallback as the application.
  }
  return "savitri-foundation-development-auth-secret-change-me";
}

async function adminToken() {
  return new SignJWT({ role: "admin", email: "admin@savitrifoundation.in" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(localAuthSecret()));
}

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "savitri_foundation_admin", value: await adminToken(), url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
});

test("admin schedules use the themed accessible IST picker", async ({ page }, testInfo) => {
  await page.goto("/admin/competitions");
  await expect(page.getByRole("heading", { name: "Competitions" })).toBeVisible();
  await expect(page.locator('input[type="datetime-local"]')).toHaveCount(0);

  const createForm = page.locator("details").first().locator("form");
  const pickers = createForm.locator('button[aria-haspopup="dialog"]');
  test.skip(await pickers.count() === 0, "No published event is available for scheduling.");
  await expect(pickers).toHaveCount(4);
  await expect(pickers.nth(1)).toBeDisabled();

  await pickers.first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("India Standard Time")).toBeVisible();
  await expect(dialog.locator('button[role="gridcell"]:disabled')).not.toHaveCount(0);
  await expect(dialog.getByLabel("Hour").locator("option:disabled")).not.toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("themed-picker.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(pickers.first()).toBeFocused();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await pickers.first().click();
  expect(await dialog.evaluate((element) => getComputedStyle(element).animationDuration)).toMatch(/^(0s|0\.001ms|1e-06s)$/);
  await page.keyboard.press("Escape");

  if (testInfo.project.name === "mobile") {
    await pickers.first().click();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    await page.keyboard.press("Escape");
  }
});

test("tampered out-of-event schedules return inline errors and are not stored", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "The server validation mutation check only needs one browser project.");
  await page.goto("/admin/competitions");
  const createForm = page.locator("details").first().locator("form");
  test.skip(await createForm.count() === 0, "No published event is available for scheduling.");

  const marker = `Invalid schedule ${Date.now()}`;
  await createForm.locator('input[name="title"]').fill(marker);
  await createForm.locator('textarea[name="description"]').fill("This entry must be rejected before storage.");
  await createForm.evaluate((form) => {
    const values: Record<string, string> = {
      applicationStartsAt: "2000-01-01T09:00",
      applicationEndsAt: "2000-01-01T10:00",
      votingStartsAt: "2000-01-01T10:00",
      votingEndsAt: "2000-01-01T11:00",
    };
    for (const [name, value] of Object.entries(values)) {
      const input = form.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      if (input) input.value = value;
    }
    form.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])')?.removeAttribute("disabled");
  });
  await createForm.locator("button").last().click();
  await expect(createForm.getByText("Fix the highlighted schedule fields.")).toBeVisible();
  await page.reload();
  await expect(page.getByText(marker, { exact: true })).toHaveCount(0);
});
