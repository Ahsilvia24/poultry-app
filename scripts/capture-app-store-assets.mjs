/**
 * Capture App Store screenshots (10) + app previews (3).
 * Screenshots: 1284×2778 PNG
 * App Previews: 886×1920 MP4 (Apple's accepted preview size — NOT screenshot size)
 * Run while `npm run dev` is serving http://localhost:3000
 */
import { chromium } from "playwright";
import { mkdirSync, existsSync, readdirSync, renameSync, unlinkSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const BASE = process.env.APP_BASE_URL || "http://localhost:3000";
const OUT = join(process.cwd(), "docs/app-store/iphone-6.5");
/** Screenshot pixel size (iPhone 6.5" portrait). */
const SHOT_W = 1284;
const SHOT_H = 2778;
/**
 * App Preview pixel size — Apple accepts 886×1920 for 6.5"/6.9" portrait,
 * NOT the screenshot sizes (1284×2778). See ASC App Preview specifications.
 */
const PREV_W = 886;
const PREV_H = 1920;
/** CSS viewport — iPhone logical points so mobile breakpoints apply. */
const VIEW_W = 430;
const VIEW_H = 926;
const SCALE = 3; // 430×3=1290 ≈ 1284; we crop/scale to exact SHOT_* after capture
const FARM_ACTIVE = "cmsfp6zyg00vpjswbainssppr"; // River Bend — active flock
const FARM_SCHEDULE = "cmsfp6zji0004jswbrptk18nw"; // Oak Hollow — prebrood

const screens = [
  { file: "01-dashboard.png", path: "/", wait: "text=Today" },
  { file: "02-farms.png", path: "/farms", wait: "text=Farms" },
  { file: "03-farm-detail.png", path: `/farms/${FARM_ACTIVE}`, wait: "text=River Bend" },
  {
    file: "04-mortality.png",
    path: `/mortality?farmId=${FARM_ACTIVE}&houseFlockId=cmsfp6zyj00vxjswbnulguxuh`,
    wait: "text=Enter mortality",
  },
  { file: "05-lfo.png", path: `/lfo/new/${FARM_ACTIVE}`, wait: "text=inventory" },
  { file: "06-tools.png", path: "/tools", wait: "text=Tools" },
  { file: "07-reports.png", path: `/reports?farmId=${FARM_ACTIVE}`, wait: "text=Reports" },
  { file: "08-settlement.png", path: "/settlement", wait: "text=Settlement" },
  { file: "09-history.png", path: `/history/${FARM_ACTIVE}`, wait: "text=History" },
  { file: "10-settings.png", path: "/settings", wait: "text=Settings" },
];

const previews = [
  {
    file: "preview-01-today-schedule.mp4",
    title: "Today's schedule",
    steps: [
      { path: "/", wait: 1800, scroll: 0 },
      { path: "/", wait: 1200, scroll: 600 },
      { path: `/farms/${FARM_SCHEDULE}`, wait: 2200, scroll: 0 },
      { path: `/farms/${FARM_SCHEDULE}`, wait: 1800, scroll: 500 },
      { path: "/", wait: 1600, scroll: 0 },
    ],
  },
  {
    file: "preview-02-mortality-logging.mp4",
    title: "Mortality logging",
    steps: [
      { path: "/farms", wait: 1400, scroll: 0 },
      { path: `/farms/${FARM_ACTIVE}`, wait: 1800, scroll: 0 },
      {
        path: `/mortality?farmId=${FARM_ACTIVE}&houseFlockId=cmsfp6zyj00vxjswbnulguxuh`,
        wait: 2400,
        scroll: 0,
      },
      {
        path: `/mortality?farmId=${FARM_ACTIVE}&houseFlockId=cmsfp6zyj00vxjswbnulguxuh`,
        wait: 1800,
        scroll: 500,
      },
      { path: `/farms/${FARM_ACTIVE}`, wait: 1600, scroll: 400 },
    ],
  },
  {
    file: "preview-03-tools-reports.mp4",
    title: "Tools & reports",
    steps: [
      { path: "/tools", wait: 1800, scroll: 0 },
      { path: "/tools", wait: 1400, scroll: 500 },
      { path: `/reports?farmId=${FARM_ACTIVE}`, wait: 2200, scroll: 0 },
      { path: `/reports?farmId=${FARM_ACTIVE}`, wait: 1600, scroll: 600 },
      { path: `/lfo/new/${FARM_ACTIVE}`, wait: 2000, scroll: 0 },
    ],
  },
];

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function encodePreview(rawWebm, outMp4) {
  // Apple App Preview: 886×1920, H.264 High@L4.0, ~10–12 Mbps, stereo AAC, SAR=1.
  execSync(
    [
      "ffmpeg",
      "-y",
      "-i",
      JSON.stringify(rawWebm),
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-vf",
      `"scale=${PREV_W}:${PREV_H}:force_original_aspect_ratio=decrease,pad=${PREV_W}:${PREV_H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30"`,
      "-c:v",
      "libx264",
      "-profile:v",
      "high",
      "-level",
      "4.0",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "30",
      "-g",
      "30",
      "-x264-params",
      "nal-hrd=cbr:force-cfr=1",
      "-b:v",
      "10M",
      "-minrate",
      "10M",
      "-maxrate",
      "10M",
      "-bufsize",
      "10M",
      "-c:a",
      "aac",
      "-b:a",
      "256k",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-shortest",
      "-movflags",
      "+faststart",
      JSON.stringify(outMp4),
    ].join(" "),
    { stdio: "inherit", shell: "/bin/bash" },
  );
}

function fitToAppStoreSize(srcPng, destPng) {
  execSync(
    [
      "ffmpeg",
      "-y",
      "-i",
      JSON.stringify(srcPng),
      "-vf",
      `"scale=${SHOT_W}:${SHOT_H}:force_original_aspect_ratio=increase,crop=${SHOT_W}:${SHOT_H},setsar=1"`,
      "-frames:v",
      "1",
      "-update",
      "1",
      JSON.stringify(destPng),
    ].join(" "),
    { stdio: "inherit", shell: "/bin/bash" },
  );
}

function mobileContextOptions(extra = {}) {
  return {
    viewport: { width: VIEW_W, height: VIEW_H },
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    ...extra,
  };
}

async function establishSession(context) {
  const page = await context.newPage();
  await page.goto(`${BASE}/api/dev-bypass-login?next=/`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(500);
  await page.close();
}

async function captureScreenshots(context) {
  const shotDir = join(OUT, "screenshots");
  const tmpDir = join(OUT, ".raw-shots");
  ensureDir(shotDir);
  ensureDir(tmpDir);
  const page = await context.newPage();

  for (const s of screens) {
    const dest = join(shotDir, s.file);
    const raw = join(tmpDir, s.file);
    console.log(`Screenshot → ${s.file} (${s.path})`);
    await page.goto(`${BASE}${s.path}`, { waitUntil: "networkidle", timeout: 60000 });
    try {
      await page.waitForSelector(s.wait, { timeout: 15000 });
    } catch {
      console.warn(`  warn: selector ${s.wait} not found, continuing`);
    }
    // Mortality form is client-driven — click House if still needed, then pin to top
    if (s.file === "04-mortality.png") {
      const house = page.getByRole("button", { name: /^House 1$/i }).or(
        page.getByRole("link", { name: /^House 1$/i }),
      );
      if (await house.count()) {
        await house.first().click().catch(() => {});
        await page.waitForTimeout(600);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(800);
    await page.addStyleTag({
      content: `
        * { caret-color: transparent !important; }
        ::-webkit-scrollbar { display: none !important; }
        html, body { overflow-x: hidden !important; }
      `,
    });
    // Captures VIEW_W*SCALE × VIEW_H*SCALE (1290×2778)
    await page.screenshot({ path: raw, type: "png" });
    fitToAppStoreSize(raw, dest);
    unlinkSync(raw);
    const probe = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 ${JSON.stringify(dest)}`,
      { encoding: "utf8" },
    ).trim();
    console.log(`  size: ${probe}`);
  }
  await page.close();
}

async function capturePreviews(browser) {
  const prevDir = join(OUT, "previews");
  const rawDir = join(OUT, ".raw-previews");
  ensureDir(prevDir);
  ensureDir(rawDir);

  for (const preview of previews) {
    console.log(`Preview → ${preview.file}`);
    const context = await browser.newContext(
      mobileContextOptions({
        recordVideo: {
          dir: rawDir,
          size: { width: VIEW_W * SCALE, height: VIEW_H * SCALE },
        },
      }),
    );
    await establishSession(context);
    const page = await context.newPage();
    await page.addInitScript(() => {
      // Reduce motion noise in recordings
      const style = document.createElement("style");
      style.textContent = "* { scroll-behavior: auto !important; }";
      document.documentElement.appendChild(style);
    });

    for (const step of preview.steps) {
      await page.goto(`${BASE}${step.path}`, {
        waitUntil: "networkidle",
        timeout: 60000,
      });
      await page.waitForTimeout(400);
      if (step.scroll) {
        await page.evaluate(async (y) => {
          const start = window.scrollY;
          const frames = 24;
          for (let i = 1; i <= frames; i++) {
            window.scrollTo(0, start + (y * i) / frames);
            await new Promise((r) => setTimeout(r, 40));
          }
        }, step.scroll);
      }
      await page.waitForTimeout(step.wait);
    }

    const video = page.video();
    await page.close();
    await context.close();
    const rawPath = await video.path();
    const outPath = join(prevDir, preview.file);
    encodePreview(rawPath, outPath);
    const dur = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 ${JSON.stringify(outPath)}`,
      { encoding: "utf8" },
    ).trim();
    const dims = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 ${JSON.stringify(outPath)}`,
      { encoding: "utf8" },
    ).trim();
    console.log(`  done: ${dims} ${dur}s`);
  }

  // cleanup raw
  if (existsSync(rawDir)) {
    for (const f of readdirSync(rawDir)) {
      try {
        unlinkSync(join(rawDir, f));
      } catch {}
    }
  }
}

async function main() {
  ensureDir(OUT);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(mobileContextOptions());
  await establishSession(context);
  await captureScreenshots(context);
  await context.close();
  await capturePreviews(browser);
  await browser.close();
  console.log("\nAll App Store assets written to", OUT);
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("capture-app-store-assets.mjs") ||
    process.argv[1].includes("capture-app-store-assets"));

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
