/**
 * Capture App Store screenshots from the Expo mobile web build (latest app UI).
 * Uses SPA navigation only (no full reloads after login).
 */
import { chromium } from "playwright";
import { mkdirSync, unlinkSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const BASE = process.env.EXPO_URL || "http://localhost:8081";
const OUT = join(process.cwd(), "docs/app-store/iphone-6.5/screenshots");
const ART = "/opt/cursor/artifacts/app-store/screenshots";
const SHOT_W = 1284;
const SHOT_H = 2778;

function fit(src, dest) {
  execSync(
    `ffmpeg -y -i ${JSON.stringify(src)} -vf "scale=${SHOT_W}:${SHOT_H}:force_original_aspect_ratio=increase,crop=${SHOT_W}:${SHOT_H},setsar=1" -frames:v 1 -update 1 ${JSON.stringify(dest)}`,
    { stdio: "pipe", shell: "/bin/bash" },
  );
}

async function clickTab(page, label) {
  await page.getByText(label, { exact: true }).last().click({ force: true });
  await page.waitForTimeout(1400);
}

async function clickText(page, re) {
  await page.getByText(re).first().click({ force: true, timeout: 15000 });
  await page.waitForTimeout(1200);
}

async function hideOverlays(page) {
  // RN-web inactive scene layers can intercept clicks; mute them for capture.
  await page.evaluate(() => {
    document.querySelectorAll("div").forEach((el) => {
      const s = getComputedStyle(el);
      if (
        s.position === "absolute" &&
        s.top === "0px" &&
        s.bottom === "0px" &&
        s.left === "0px" &&
        s.right === "0px" &&
        s.pointerEvents !== "none"
      ) {
        // Keep the topmost visible scene; hide clearly empty interceptors
        if ((el.textContent || "").trim().length === 0) {
          el.style.pointerEvents = "none";
        }
      }
    });
  });
}

async function capture(page, file) {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(ART, { recursive: true });
  const raw = join(OUT, `.raw-${file}`);
  const dest = join(OUT, file);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: raw, type: "png" });
  fit(raw, dest);
  unlinkSync(raw);
  execSync(`cp ${JSON.stringify(dest)} ${JSON.stringify(join(ART, file))}`);
  console.log(`  ✓ ${file}`);
}

async function main() {
  if (existsSync(OUT)) {
    for (const f of readdirSync(OUT)) {
      if (/\.raw-|settlement|settings/i.test(f)) {
        try {
          unlinkSync(join(OUT, f));
        } catch {}
      }
    }
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 430, height: 926 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();

  // Fresh web DB (clear any half-migrated localStorage from prior runs)
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.evaluate(() => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("poultrytech_"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
  });
  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(4000);
  if ((await page.locator("body").innerText()).includes("Sign in")) {
    await page.locator("input").nth(0).fill("tech@poultry.local");
    await page.locator("input").nth(1).fill("password123");
    await page.getByText("Sign in", { exact: true }).last().click();
    await page.waitForTimeout(5000);
  }
  await page.getByText("Today's schedule").first().waitFor({ timeout: 30000 });
  console.log("Signed in →", page.url());

  // 01 Dashboard
  console.log("→ 01-dashboard.png");
  await clickTab(page, "Dashboard");
  await capture(page, "01-dashboard.png");

  // 02 Farms
  console.log("→ 02-farms.png");
  await clickTab(page, "Farms");
  await hideOverlays(page);
  await capture(page, "02-farms.png");

  // 03 Farm detail
  console.log("→ 03-farm-detail.png");
  await hideOverlays(page);
  await clickText(page, /River Bend/);
  await page.waitForTimeout(800);
  await capture(page, "03-farm-detail.png");

  // 08 Service Farm (from farm detail)
  console.log("→ 08-service-farm.png");
  await hideOverlays(page);
  await clickText(page, /Service Farm/);
  await capture(page, "08-service-farm.png");
  // back
  await page.getByText(/←|Back/i).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(800);

  // 09 History
  console.log("→ 09-history.png");
  // ensure on farm detail
  if (!(await page.locator("body").innerText()).includes("Farm History")) {
    await clickTab(page, "Farms");
    await hideOverlays(page);
    await clickText(page, /River Bend/);
  }
  await hideOverlays(page);
  await clickText(page, /Farm History/);
  await capture(page, "09-history.png");

  // 04 Mortality
  console.log("→ 04-mortality.png");
  await clickTab(page, "Mortality");
  await hideOverlays(page);
  await page.getByText(/River Bend/i).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
  await page.getByText(/^House 1$/i).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture(page, "04-mortality.png");

  // 05 LFO
  console.log("→ 05-lfo.png");
  await clickTab(page, "LFO");
  await hideOverlays(page);
  await page.getByText(/River Bend/i).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);
  await page.getByText(/Create LFO/i).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1200);
  await capture(page, "05-lfo.png");

  // 06 Tools
  console.log("→ 06-tools.png");
  await clickTab(page, "Tools");
  await capture(page, "06-tools.png");

  // 07 Reports — via Tools/More if needed
  console.log("→ 07-reports.png");
  // Try navigating with history API without full reload
  await page.evaluate(() => {
    history.pushState({}, "", "/reports");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForTimeout(1500);
  // Fallback: open More then Reports
  if (!(await page.locator("body").innerText()).match(/Report|Mortality matrix|House/i)) {
    await page.goto(`${BASE}/reports`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2000);
  }
  await capture(page, "07-reports.png");

  // 10 More
  console.log("→ 10-more.png");
  await page.goto(`${BASE}/more`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await capture(page, "10-more.png");

  await browser.close();
  console.log("Done →", OUT);
  console.log("Files:", readdirSync(OUT).filter((f) => f.endsWith(".png")).sort().join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
