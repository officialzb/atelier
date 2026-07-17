// Headless-browser fetcher for the Odyssey watcher (used in CI).
//
// The BFI booking site 403s plain HTTP requests (any User-Agent, anywhere),
// so we load it in real headless Chromium — the same class of client that
// successfully read the page during development. Parsing/verdict/output all
// come from check.mjs via the injected fetcher.
//
// Requires the `playwright` package + a Chromium build (installed in CI).

import { chromium } from "playwright";
import { run, looksBlocked } from "./check.mjs";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

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
  });

  const fetcher = async (url) => {
    const page = await context.newPage();
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      // Give any bot-check / late-rendered listings a moment to settle.
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

  try {
    await run({ fetcher });
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Browser fetch failed:", err);
  // Don't hard-fail the CI step; check.mjs already emits status via run(),
  // but on a launch failure make sure downstream sees "blocked".
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    import("node:fs").then((fs) => fs.appendFileSync(out, "status=blocked\n")).catch(() => {});
  }
  process.exitCode = 0;
});
