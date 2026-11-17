import { test, expect } from "@playwright/test";

test("protected journal redirects signed-out visitors", async ({ page }) => {
  await page.goto("/add");
  await expect(page).toHaveURL(/\/(login|setup)(?:\?|$)/);
  await expect(page.locator("h1")).toBeVisible();
});

test("sign in and account creation remain keyboard accessible", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveAttribute("type", "email");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Make yourself at home." })).toBeVisible();
  await expect(page.getByLabel("What should we call you?")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
  await expect(page.getByRole("button", { name: "Create your journal" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("private data endpoints reject signed-out reads and uploads", async ({ request }) => {
  const exported = await request.get("/api/export");
  expect([401, 503]).toContain(exported.status());
  const photo = await request.post("/api/photos", { multipart: { file: { name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff,0xd8,0xff]) } } });
  expect([401, 403, 503]).toContain(photo.status());
  const cleanup = await request.get("/api/cleanup");
  expect([401, 503]).toContain(cleanup.status());
});

test("authentication callbacks cannot redirect to another origin", async ({ page }) => {
  await page.goto("/auth/callback?next=https%3A%2F%2Fexample.com");
  await expect(page).toHaveURL(/\/(login|setup)/);
});
