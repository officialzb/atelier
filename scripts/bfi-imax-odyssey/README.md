# BFI IMAX — "The Odyssey" ticket watcher

A watcher (runs **every ~30 min**) that checks whether **Christopher Nolan's
_The Odyssey_ (IMAX 70mm)** has bookable seats at **BFI IMAX Waterloo** for a
target month (default **September 2026**), pings you when it does, and logs a
timestamped history of when seats appear/disappear.

## The situation (important)

The full 70mm run (through 10 Sept 2026) **sold out on the single on-sale on
Mon 15 Jun 2026**. So there is **no daily "fresh ticket drop"** — what shows up
now is **returns** (seats released by people who can't attend), which appear
unpredictably and vanish fast. There's no published time for them. This watcher
exists to (a) alert you the instant a return appears, and (b) accumulate enough
timestamped observations to reveal whether returns cluster at particular times.

## How it works

- [`fetch-browser.mjs`](./fetch-browser.mjs) loads the BFI booking pages in
  **real headless Chromium**. BFI 403s plain HTTP requests, and blocks even a
  browser intermittently, so it warms up on the IMAX homepage first (for any
  clearance cookie), masks the automation fingerprint, and **retries** each page.
- [`check.mjs`](./check.mjs) parses the HTML for `"<day> September 2026"`
  screenings and classifies: `not_yet`, `on_sale_available`, `on_sale_soldout`,
  or `blocked` (couldn't read — logged as a warning, never a false negative).
- [`notify.cjs`](./notify.cjs) keeps a single **GitHub issue** (assigning +
  `@`-mentioning the owner → email), and **comments a timestamp whenever the set
  of bookable dates changes** — 🟢 became bookable / 🔴 sold out again. Those
  comments are the drop-time dataset.
- [`../../.github/workflows/bfi-imax-odyssey-watch.yml`](../../.github/workflows/bfi-imax-odyssey-watch.yml)
  runs it **every 30 min (:07/:37 UTC)** with the Chromium download cached.

## Figuring out drop times

Because tickets sold out, timing is about **returns**, which BFI doesn't
schedule publicly. The 🟢/🔴 comments on the tracking issue build a UTC
timeline; after a week or two, sort the 🟢 timestamps to see if returns cluster
(e.g. a staff-processing hour, or when 48-hour holds expire). If a pattern
emerges, be ready then — but returns can also appear any time, so instant alerts
+ a box-office call (020 7928 3232) remain the surest way to grab one.

## ⚠️ To activate the schedule: merge to `main`

GitHub runs `schedule:` triggers (and the manual **Run workflow** button) only
from the repository's **default branch**. Merge this into `main` to go live;
pushing changes under `scripts/bfi-imax-odyssey/**` to `main` also triggers a
run. (GitHub auto-disables schedules after 60 days of repo inactivity.)

## What it does *not* do

It does **not** judge individual seat quality — the seat map is behind a JS
booking flow. It flags bookable dates and links you straight there; aim for
central seats in the middle-to-back rows, avoiding the front ~5 rows.

## If runs report `blocked`

The headless browser couldn't get past BFI's bot protection that run (it's
intermittent; the retries/warm-up reduce it). It's a warning, not a false
"nothing on sale". If it's frequent, the reliable escalation is a server-side
fetch API (e.g. Exa) behind an `EXA_API_KEY` secret.

## Adjusting it

- **Month / year:** `month` / `year` inputs on a manual run, or the defaults in
  the workflow. Locally: `TARGET_MONTH=October npm run check:browser`.
- **Cadence:** every 30 min by default (`7,37 * * * *`); edit the `cron:` line.
- **Party size / seat preference:** wording lives in `notify.cjs`.

## Run locally

```bash
cd scripts/bfi-imax-odyssey
npm install && npx playwright install chromium   # one-time, for the browser fetch
npm run check:browser   # live check via headless Chromium (what CI runs)
npm run check:http      # plain-fetch check (will 403 on BFI's bot protection)
npm test                # parser + diff self-tests, no network
```

## Alternative: an LLM-in-the-loop routine

A richer option is a scheduled Claude "Routine" that reads the page with a
server-side fetch tool and assesses seat quality on every run. It needs a
one-time tool-approval only grantable from an interactive Claude Code session.
This GitHub Action is the durable, self-contained equivalent.
