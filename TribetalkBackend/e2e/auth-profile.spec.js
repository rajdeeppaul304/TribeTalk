import { expect, test } from "@playwright/test";

test("an unauthenticated visitor is sent to login", async ({ page }) => {
  await page.goto("/home");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
});

test("a user can register, log in, and update their profile", async ({ page }) => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const username = `e2euser${suffix}`;
  const email = `${username}@example.test`;
  const displayName = `E2E User ${suffix}`;

  await page.goto("/register");
  await page.getByPlaceholder("Enter your username").fill(username);
  await page.getByPlaceholder("Enter your email").fill(email);
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByPlaceholder("Confirm your password").fill("password123");
  await page.getByRole("button", { name: "Sign Up" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await page.getByPlaceholder("Enter your email").fill(email);
  await page.getByPlaceholder("Enter password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole("link", { name: "My Profile" }).click();
  await expect(page.getByRole("heading", { name: username })).toBeVisible();

  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("About me").fill("Created by the Playwright end-to-end suite.");
  await page.getByRole("button", { name: "Save profile" }).click();

  await expect(page.getByText("Profile saved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: displayName })).toBeVisible();
});
