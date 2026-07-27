// Headless-browser fetcher for the Odyssey watcher (used in CI).
//
// The BFI booking site 403s plain HTTP requests, and even headless Chromium is
// blocked intermittently. To improve the hit rate we: warm up on the IMAX
// homepage first (to pick up any bot-clearance cookies), lightly mask the
// automation fingerprint, and retry each page a few times before giving up.
//
// Parsing/verdict/output all come from check.mjs via the injected fetcher.
// Requires the `playwright` package + a Chromium build (installed in CI).

import { chromium } from "playwright";
import { run, looksBlocked } from "./check.mjs";

const HOMEPAGE = "https://whatson.bfi.org.uk/imax";
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const ATTEMPTS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: "en-GB",
    timezoneId: "Europe/London",
    viewport: { width: 1366, height: 900 },
    extraHTTPHeaders: {
      "Accept-Language": "en-GB,en;q=0.9",
      "Upgrade-Insecure-Requests": "1",
    },
  });
  // Mask the most obvious headless tells before any page script runs.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "languages", { get: () => ["en-GB", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
  });

  // Warm-up: land on the homepage first so any WAF clearance cookie is set.
  try {
    const home = await context.newPage();
    await home.goto(HOMEPAGE, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await home.waitForTimeout(2_500);
    await home.close();
  } catch (err) {
    console.error("Warm-up navigation failed (continuing):", String(err));
  }

  const fetchOnce = async (url) => {
    const page = await context.newPage();
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(3_000);
      const body = await page.content();
      const status = resp ? resp.status() : 0;
      return { url, status, body, blocked: looksBlocked(status, body) };
    } catch (err) {
      return { url, status: 0, body: "", blocked: true, error: String(err) };
    } finally {
      await page.close();
    }
  };

  const fetcher = async (url) => {
    let last = { url, status: 0, body: "", blocked: true };
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      last = await fetchOnce(url);
      if (!last.blocked) return last;
      if (attempt < ATTEMPTS) await sleep(2_000 * attempt); // 2s, 4s backoff
    }
    console.error(`All ${ATTEMPTS} attempts blocked for ${url} (last status ${last.status}).`);
    return last;
  };

  try {
    await run({ fetcher });
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Browser fetch failed:", err);
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    import("node:fs").then((fs) => fs.appendFileSync(out, "status=blocked\n")).catch(() => {});
  }
  process.exitCode = 0;
});
