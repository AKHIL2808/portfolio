// F.3/W.03: scroll system smoke test on /dev/scroll. Lock stops scroll and unlock
// resumes it; keyboard advance works; keys aren't stolen; scrub isn't slowed by
// slow motion; reduced motion jumps instead of gliding.
import { expect, test, type Page } from "@playwright/test";

const status = (page: Page) => page.getByTestId("scroll-status");
const attr = async (page: Page, name: string): Promise<number> => Number(await status(page).getAttribute(name));
const scrollY = (page: Page): Promise<number> => page.evaluate(() => window.scrollY);
const viewportHeight = (page: Page): Promise<number> => page.evaluate(() => window.innerHeight);

async function open(page: Page): Promise<void> {
  await page.goto("/dev/scroll");
  await expect(status(page)).toHaveAttribute("data-ready", "true");
}

/** Waits until the page stops moving (two equal reads 150 ms apart). */
async function settle(page: Page): Promise<number> {
  let prev = Number.NaN;
  await expect
    .poll(
      async () => {
        const y = await scrollY(page);
        const same = y === prev;
        prev = y;
        return same;
      },
      { intervals: [150], timeout: 5000 },
    )
    .toBe(true);
  return prev;
}

async function wheel(page: Page, dy: number): Promise<void> {
  await page.mouse.move(400, 400);
  await page.mouse.wheel(0, dy);
}

test("lock stops scroll and unlock resumes it", async ({ page }) => {
  await open(page);
  await wheel(page, 600);
  await expect.poll(() => scrollY(page)).toBeGreaterThan(0);
  await expect.poll(() => attr(page, "data-scroll")).toBeGreaterThan(0);
  await settle(page);

  await page.getByRole("button", { name: "Lock", exact: true }).click();
  await expect(status(page)).toHaveAttribute("data-locked", "true");
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe("clip");
  const before = await scrollY(page);
  await wheel(page, 600);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(500);
  expect(await scrollY(page)).toBe(before);

  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(status(page)).toHaveAttribute("data-locked", "false");
  await wheel(page, 600);
  await expect.poll(() => scrollY(page)).toBeGreaterThan(before);
});

test("Space and Arrow Down advance one screen; Arrow Up goes back, never past the top", async ({ page }) => {
  await open(page);
  const h = await viewportHeight(page);

  await page.keyboard.press("Space");
  await expect.poll(() => scrollY(page)).toBeGreaterThan(h - 3);
  expect(Math.abs((await settle(page)) - h)).toBeLessThanOrEqual(3);

  await page.keyboard.press("ArrowDown");
  await expect.poll(() => scrollY(page)).toBeGreaterThan(2 * h - 3);
  expect(Math.abs((await settle(page)) - 2 * h)).toBeLessThanOrEqual(3);

  await page.keyboard.press("ArrowUp");
  await expect.poll(() => scrollY(page)).toBeLessThan(h + 3);
  expect(Math.abs((await settle(page)) - h)).toBeLessThanOrEqual(3);

  await page.keyboard.press("ArrowUp");
  await expect.poll(() => scrollY(page)).toBeLessThan(3);
  await settle(page);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(300);
  expect(await scrollY(page)).toBe(0);
});

test("Space on a focused button presses it and doesn't scroll", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Lock", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(status(page)).toHaveAttribute("data-locked", "true");
  await page.waitForTimeout(300);
  expect(await scrollY(page)).toBe(0);
});

test("a scrub: true ScrollTrigger keeps up with scroll in slow motion", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Slow motion" }).click();
  await expect(status(page)).toHaveAttribute("data-time-scale", "0.05");
  await page.keyboard.press("ArrowDown"); // the focused button doesn't take arrows
  await expect.poll(() => scrollY(page)).toBeGreaterThan(0);
  await settle(page);
  await expect
    .poll(
      async () => {
        const limit = await attr(page, "data-limit");
        return Math.abs((await attr(page, "data-progress")) - (await attr(page, "data-scroll")) / limit);
      },
      { timeout: 1000 },
    )
    .toBeLessThan(0.02);
  expect(await attr(page, "data-progress")).toBeGreaterThan(0);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("Arrow Down jumps to the next stop instead of gliding", async ({ page }) => {
    await open(page);
    const h = await viewportHeight(page);
    await page.keyboard.press("ArrowDown");
    const y = await page.evaluate(
      () => new Promise<number>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(window.scrollY)))),
    );
    expect(Math.abs(y - h)).toBeLessThanOrEqual(2);
  });
});
