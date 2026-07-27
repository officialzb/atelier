// Fixture-based tests for the Odyssey checker's parsing logic.
// Run: node scripts/bfi-imax-odyssey/check.test.mjs
// Exits non-zero if any assertion fails. No network access required.

import assert from "node:assert/strict";
import { stripHtml, looksBlocked, findShowings, classify, run, PAGES } from "./check.mjs";
import notify from "./notify.cjs";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
};

// Mirrors the real BFI markup shape: each show is a title + date/time +
// venue + title, then either "Sold out!" or a price/Book control.
const show = (date, time, tail) =>
  `<div class="show"><h3>The Odyssey</h3><p>-${date} ${time}</p>` +
  `<span>BFI IMAX</span><span>The Odyssey</span>${tail}</div>`;
const SOLD = "<span>Sold out!</span>";
const BOOK = "<span>£27.50</span><a>Book now</a>";

test("stripHtml removes tags and decodes entities", () => {
  assert.equal(stripHtml("<p>A&amp;B <b>C</b></p>"), "A&B C");
});

test("looksBlocked flags non-200, tiny, and challenge bodies", () => {
  assert.equal(looksBlocked(403, "x".repeat(2000)), true);
  assert.equal(looksBlocked(200, "too short"), true);
  assert.equal(looksBlocked(200, "Just a moment... " + "x".repeat(2000)), true);
  assert.equal(looksBlocked(200, "The Odyssey listing " + "x".repeat(2000)), false);
});

test("current state (July only, sold out) => not_yet for September", () => {
  const html =
    show("Friday 17 July 2026", "16:15", SOLD) + show("Friday 17 July 2026", "20:00", SOLD);
  const showings = findShowings(stripHtml(html), "September", "2026");
  assert.equal(showings.length, 0);
  assert.equal(classify(showings, { allBlocked: false }).status, "not_yet");
});

test("September listed but all sold out => on_sale_soldout", () => {
  const html =
    show("Saturday 5 September 2026", "12:00", SOLD) +
    show("Saturday 5 September 2026", "16:15", SOLD);
  const showings = findShowings(stripHtml(html), "September", "2026");
  assert.equal(showings.length, 2);
  assert.equal(showings.every((s) => s.soldOut), true);
  const v = classify(showings, { allBlocked: false });
  assert.equal(v.status, "on_sale_soldout");
  assert.equal(v.available, 0);
});

test("September with a bookable show => on_sale_available", () => {
  const html =
    show("Saturday 5 September 2026", "12:00", SOLD) +
    show("Sunday 6 September 2026", "16:15", BOOK);
  const showings = findShowings(stripHtml(html), "September", "2026");
  assert.equal(showings.length, 2);
  const v = classify(showings, { allBlocked: false });
  assert.equal(v.status, "on_sale_available");
  assert.equal(v.available, 1);
  assert.equal(v.soldOut, 1);
  assert.deepEqual(v.uniqueDates, ["5 September 2026", "6 September 2026"]);
});

test("classify exposes availableDates (only bookable dates)", () => {
  const html =
    show("Saturday 5 September 2026", "12:00", SOLD) + show("Sunday 6 September 2026", "16:15", BOOK);
  const v = classify(findShowings(stripHtml(html), "September", "2026"), { allBlocked: false });
  assert.deepEqual(v.availableDates, ["6 September 2026"]);
});

test("diffAvailability computes appeared/disappeared", () => {
  const a = notify.diffAvailability(["03 September 2026"], ["03 September 2026", "10 September 2026"]);
  assert.deepEqual(a.appeared, ["10 September 2026"]);
  assert.deepEqual(a.disappeared, []);
  const b = notify.diffAvailability(["03 September 2026"], []);
  assert.deepEqual(b.appeared, []);
  assert.deepEqual(b.disappeared, ["03 September 2026"]);
});

test("a sold-out neighbour does not leak into a bookable show's block", () => {
  // Bookable Sept 6 immediately followed by a sold-out Sept 7.
  const html = show("Sunday 6 September 2026", "16:15", BOOK) + show("Monday 7 September 2026", "12:00", SOLD);
  const showings = findShowings(stripHtml(html), "September", "2026");
  const sixth = showings.find((s) => s.date === "6 September 2026");
  assert.equal(sixth.soldOut, false, "Sept 6 should remain bookable");
});

test("all pages blocked with no showings => blocked", () => {
  assert.equal(classify([], { allBlocked: true }).status, "blocked");
});

// run() wires an injected fetcher through to a verdict (async).
const asyncTests = [];
const atest = (name, fn) => asyncTests.push([name, fn]);

atest("run() with an injected fetcher returning bookable September => on_sale_available", async () => {
  const page = show("Saturday 5 September 2026", "16:15", BOOK);
  const fetcher = async (url) => ({ url, status: 200, body: page, blocked: false });
  const v = await run({ fetcher });
  assert.equal(v.status, "on_sale_available");
});

atest("run() reports blocked when every fetch is blocked", async () => {
  const fetcher = async (url) => ({ url, status: 403, body: "", blocked: true });
  const v = await run({ fetcher });
  assert.equal(v.status, "blocked");
});

atest("run() fetches exactly the configured pages", async () => {
  const seen = [];
  const fetcher = async (url) => {
    seen.push(url);
    return { url, status: 200, body: "<p>nothing here " + "x".repeat(900) + "</p>", blocked: false };
  };
  await run({ fetcher });
  assert.deepEqual(seen.sort(), [...PAGES].sort());
});

for (const [name, fn] of asyncTests) {
  await fn();
  passed++;
  console.log(`  ok - ${name}`);
}

console.log(`\n${passed} tests passed.`);
