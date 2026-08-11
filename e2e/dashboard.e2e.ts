// Playwright-only acceptance coverage; the suffix keeps this out of Vitest's glob.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { checkA11y, injectAxe } from "axe-playwright";
import { installFixtureRoutes, type InitialMode } from "./fixture";

const dashboard = (page: Page) => page.locator("[data-selected-record-index]");
const refreshStatus = (page: Page) => page.locator(".sync-status");
const refreshButton = (page: Page) => page.getByRole("button", { name: "Refresh validated snapshot" });
const slider = (page: Page, label: string) => page.getByRole("slider", { name: new RegExp(label, "i") });

async function numericValue(locator: Locator): Promise<number> {
  return Number(await locator.getAttribute("aria-valuenow"));
}

async function openReadyDashboard(page: Page) {
  const controller = await installFixtureRoutes(page);
  await page.goto("/");
  await expect(dashboard(page)).toHaveAttribute("data-selected-record-index", "101");
  await expect(refreshStatus(page)).toContainText("Snapshot ready");
  await expect(page.getByTestId("fixture-banner")).toContainText("not live thesis results");
  return controller;
}

test("one selected row supplies geometry, controls, metrics, and provenance", async ({ page }) => {
  await openReadyDashboard(page);

  await expect(page.getByTestId("metric-cl")).toContainText("+0.11100");
  await expect(page.getByTestId("metric-cd")).toContainText("+0.02220");
  await expect(page.getByTestId("provenance-run-id")).toHaveText("fixture-run-row-a");
  await expect.poll(() => numericValue(slider(page, "Camber position"))).toBeCloseTo(0.3, 8);
  await expect.poll(() => numericValue(slider(page, "Maximum thickness"))).toBeCloseTo(0.07, 8);

  const selectedPath = await page.getByTestId("selected-wing-path").getAttribute("d");
  const referencePath = await page.getByTestId("reference-wing-path").getAttribute("d");
  expect(selectedPath).toBeTruthy();
  expect(referencePath).toBeTruthy();
  expect(selectedPath).not.toBe(referencePath);
  await expect(page.getByTestId("wing-plot")).toHaveAttribute("preserveAspectRatio", "xMidYMid meet");
});

test("pointer preview is live and commit snaps every active slider to one measured row", async ({ page }) => {
  await openReadyDashboard(page);
  const camber = slider(page, "Camber position");
  const thickness = slider(page, "Maximum thickness");
  const root = camber.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' slider-root ')][1]");
  const thumbBox = await camber.boundingBox();
  const rootBox = await root.boundingBox();
  expect(thumbBox).not.toBeNull();
  expect(rootBox).not.toBeNull();

  await page.mouse.move(thumbBox!.x + thumbBox!.width / 2, thumbBox!.y + thumbBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(rootBox!.x + rootBox!.width * 0.96, rootBox!.y + rootBox!.height / 2, { steps: 8 });

  await expect(dashboard(page)).toHaveAttribute("data-selected-record-index", "202");
  await expect(page.getByTestId("requested-marker-x_c")).toBeVisible();
  await expect(page.getByTestId("metric-cl")).toContainText("+0.77800");
  await expect(page.getByTestId("metric-cd")).toContainText("-0.03340");
  await expect(page.getByTestId("provenance-run-id")).toHaveText("fixture-run-row-b-v1");

  await page.mouse.up();
  await expect.poll(() => numericValue(camber)).toBeCloseTo(0.7, 8);
  await expect.poll(() => numericValue(thickness)).toBeCloseTo(0.14, 8);
  await expect(page.getByRole("status").filter({ hasText: /Snapped to database row 202/ })).toBeAttached();

  await camber.press("Home");
  await expect(dashboard(page)).toHaveAttribute("data-selected-record-index", "101");
  await expect.poll(() => numericValue(camber)).toBeCloseTo(0.3, 8);
  await expect.poll(() => numericValue(thickness)).toBeCloseTo(0.07, 8);
});

test("refresh handles unchanged, newer, older, malformed, exporter, and offline outcomes atomically", async ({ page }) => {
  const controller = await openReadyDashboard(page);

  controller.setRefreshMode("same");
  await refreshButton(page).click();
  await expect(refreshStatus(page)).toContainText("Already up to date");

  controller.setRefreshMode("newer");
  await refreshButton(page).click();
  await expect(refreshStatus(page)).toContainText("New snapshot loaded");

  controller.setRefreshMode("older");
  await refreshButton(page).click();
  await expect(refreshStatus(page)).toContainText("stale server snapshot was ignored");

  controller.setRefreshMode("malformed");
  await refreshButton(page).click();
  await expect(refreshStatus(page)).toContainText("Malformed refresh rejected");
  await expect(dashboard(page)).toHaveAttribute("data-selected-record-index", "101");

  controller.setRefreshMode("exporter-failure");
  await refreshButton(page).click();
  await expect(refreshStatus(page)).toContainText("Exporter unavailable");
  await expect(page.getByTestId("provenance-run-id")).toHaveText("fixture-run-row-a");

  controller.setRefreshMode("offline");
  await refreshButton(page).click();
  await expect(refreshStatus(page)).toContainText("Offline — showing the last validated snapshot");
  await expect(page.getByTestId("metric-cl")).toContainText("+0.11100");

  const dataUrls = controller.requests.map((request) => new URL(request.url()));
  const queriedDataRequests = dataUrls.filter((url) => url.search.length > 0);
  expect(queriedDataRequests.length).toBeGreaterThan(0);
  expect(queriedDataRequests.every((url) => url.pathname === "/data/manifest.json" && url.searchParams.has("refresh"))).toBe(true);
  expect(dataUrls.some((url) => /wandb/i.test(url.hostname))).toBe(false);
});

for (const scenario of [
  { mode: "offline", expected: /validated data is offline/i },
  { mode: "malformed", expected: /data validation stopped safely/i },
  { mode: "exporter-failure", expected: /data validation stopped safely/i }
] as const satisfies readonly { mode: InitialMode; expected: RegExp }[]) {
  test(`initial ${scenario.mode} state fails closed without partial rows`, async ({ page }) => {
    await installFixtureRoutes(page, { initialMode: scenario.mode });
    await page.goto("/");
    await expect(page.getByRole("alert")).toContainText(scenario.expected);
    await expect(dashboard(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
}

test("narrow mobile layout has usable controls and no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReadyDashboard(page);

  await expect(page.getByRole("slider")).toHaveCount(2);
  await expect(page.getByRole("complementary", { name: "Design controls and provenance" })).toBeVisible();
  await expect(page.getByTestId("wing-plot")).toBeVisible();
  await expect.poll(async () =>
    page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - window.innerWidth)
  ).toBeLessThanOrEqual(1);

  const viewportWidth = page.viewportSize()!.width;
  for (const card of await page.locator("main .card").all()) {
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);
  }
});

test("ready fixture dashboard has no automated accessibility violations", async ({ page }) => {
  await openReadyDashboard(page);
  await injectAxe(page);
  await checkA11y(
    page,
    undefined,
    { detailedReport: true, detailedReportOptions: { html: true } },
    false,
    "default"
  );
});
