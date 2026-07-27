// BFI IMAX — "The Odyssey" ticket watcher (parsing + verdict core).
//
// Checks the BFI IMAX booking page for Christopher Nolan's "The Odyssey"
// (IMAX 70mm) and reports whether screenings for a target month/year
// (default: September 2026) are on sale, and how many currently appear
// bookable vs. sold out.
//
// The page is behind bot protection that 403s plain HTTP requests, so CI
// fetches it with a real headless browser (see fetch-browser.mjs) and injects
// that fetcher into run(). This file stays dependency-free; run directly with:
//   node scripts/bfi-imax-odyssey/check.mjs        (plain fetch — will 403 on BFI)
//   node scripts/bfi-imax-odyssey/fetch-browser.mjs (headless browser — used in CI)
//
// NOTE ON SCOPE: this reliably detects when the target month becomes
// *bookable* (the hard-to-catch event) and links you straight to booking.
// It does not judge individual seat quality — the BFI seat map lives behind
// a JS booking flow.

import { appendFileSync } from "node:fs";

const TARGET_MONTH = process.env.TARGET_MONTH || "September";
const TARGET_YEAR = process.env.TARGET_YEAR || "2026";

// The Odyssey booking pages (standard + subtitled/SDH performances).
export const PAGES = [
  "https://whatson.bfi.org.uk/imax/Online/default.asp?BOparam::WScontent::loadArticle::permalink=odyssey-the-film-imax-70mm-2026",
  "https://whatson.bfi.org.uk/imax/Online/default.asp?BOparam::WScontent::loadArticle::permalink=odyssey-the-film-imax-70mm-2026-sdh",
];

const BOOKING_HOME = "https://whatson.bfi.org.uk/imax";
const BOX_OFFICE = "020 7928 3232";

export const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
};

/** Strip tags/scripts and decode the handful of entities BFI uses. */
export function stripHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#0?39;|&apos;|&rsquo;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&pound;|&#163;/gi, "£")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detect obvious anti-bot / error responses so a blocked fetch is reported
 * as "unknown" rather than silently read as "nothing on sale".
 */
export function looksBlocked(status, body) {
  if (status !== 200) return true;
  if (!body || body.length < 800) return true;
  return /just a moment|cf-browser-verification|attention required|access denied|please enable javascript|unusual traffic/i.test(
    body,
  );
}

const ANY_DATE =
  /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d\d\b/gi;

/**
 * Find each listed screening for the target month/year in the page text.
 * Each "<day> <Month> <Year>" occurrence corresponds to one listed showtime.
 * A showtime is treated as sold out if "sold out" appears within its own
 * block — i.e. between this date and the next date on the page (capped at
 * 140 chars) so a neighbouring show's status can't leak in. Best-effort:
 * the primary signal is that the month is listed at all.
 */
export function findShowings(text, monthName = TARGET_MONTH, year = TARGET_YEAR) {
  const re = new RegExp(`\\b(\\d{1,2})\\s+${monthName}\\s+${year}\\b`, "gi");
  const showings = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const blockStart = m.index + m[0].length;
    ANY_DATE.lastIndex = blockStart;
    const next = ANY_DATE.exec(text);
    const blockEnd = Math.min(next ? next.index : text.length, blockStart + 140);
    const window = text.slice(m.index, blockEnd);
    const soldOut = /sold\s*out/i.test(window);
    showings.push({ date: m[0].replace(/\s+/g, " "), soldOut });
  }
  return showings;
}

/** Turn raw showings into a verdict object. */
export function classify(showings, { allBlocked }) {
  const total = showings.length;
  const soldOut = showings.filter((s) => s.soldOut).length;
  const available = total - soldOut;
  const uniqueDates = [...new Set(showings.map((s) => s.date))];
  // Dates with at least one bookable showing — the set we timestamp-track to
  // learn when returns/new seats actually appear.
  const availableDates = [...new Set(showings.filter((s) => !s.soldOut).map((s) => s.date))];

  let status;
  if (total > 0) {
    status = available > 0 ? "on_sale_available" : "on_sale_soldout";
  } else if (allBlocked) {
    status = "blocked";
  } else {
    status = "not_yet";
  }
  return { status, total, soldOut, available, uniqueDates, availableDates };
}

/** Default fetcher: plain HTTP. Works locally / anywhere BFI isn't bot-gating. */
export async function fetchViaHttp(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: controller.signal,
    });
    const body = await res.text();
    return { url, status: res.status, body, blocked: looksBlocked(res.status, body) };
  } catch (err) {
    return { url, status: 0, body: "", blocked: true, error: String(err) };
  } finally {
    clearTimeout(t);
  }
}

function setOutput(key, value) {
  const out = process.env.GITHUB_OUTPUT;
  if (out) appendFileSync(out, `${key}=${String(value).replace(/\r?\n/g, " ")}\n`);
}

/**
 * Fetch every page with `fetcher`, classify, log, and emit GitHub outputs.
 * Returns the verdict object. `fetcher(url)` must resolve to
 * { url, status, body, blocked }.
 */
export async function run({ fetcher = fetchViaHttp } = {}) {
  const results = await Promise.all(PAGES.map((url) => fetcher(url)));
  const okPages = results.filter((r) => !r.blocked);
  const allBlocked = okPages.length === 0;
  const anyBlocked = results.some((r) => r.blocked);

  const showings = okPages.flatMap((r) => findShowings(stripHtml(r.body)));
  const verdict = classify(showings, { allBlocked });
  const checkedAt = new Date().toISOString();
  const label = `${TARGET_MONTH} ${TARGET_YEAR}`;

  const lines = [
    `BFI IMAX — The Odyssey — ${label} watch`,
    `Checked: ${checkedAt}`,
    `Pages fetched OK: ${okPages.length}/${results.length}${anyBlocked ? " (some blocked)" : ""}`,
    `Status: ${verdict.status}`,
    `${label} screenings listed: ${verdict.total} (available ${verdict.available}, sold out ${verdict.soldOut})`,
  ];
  if (verdict.uniqueDates.length) lines.push(`Dates: ${verdict.uniqueDates.join("; ")}`);
  if (allBlocked)
    lines.push(
      `WARNING: could not read the BFI page (blocked / ${results.map((r) => r.status).join(",")}). Availability unconfirmed.`,
    );
  console.log(lines.join("\n"));

  setOutput("status", verdict.status);
  setOutput("target_label", label);
  setOutput("total", verdict.total);
  setOutput("available", verdict.available);
  setOutput("sold_out", verdict.soldOut);
  setOutput("dates", verdict.uniqueDates.join("; "));
  setOutput("available_dates", verdict.availableDates.join("; "));
  setOutput("checked_at", checkedAt);
  setOutput("booking_home", BOOKING_HOME);
  setOutput("box_office", BOX_OFFICE);

  return verdict;
}

// Run when executed directly (not when imported by tests or fetch-browser.mjs).
const invokedDirectly =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) {
  run().catch((err) => {
    console.error("Checker failed:", err);
    setOutput("status", "blocked");
    process.exit(0);
  });
}
