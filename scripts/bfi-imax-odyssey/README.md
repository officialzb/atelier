# BFI IMAX — "The Odyssey" ticket watcher

A small, dependency-free daily watcher that checks whether **Christopher
Nolan's _The Odyssey_ (IMAX 70mm)** is bookable at **BFI IMAX Waterloo** for a
target month (default **September 2026**), and pings you when it is.

## Why this exists

Tickets for far-out dates aren't on sale yet — as of 16 July 2026 the BFI
booking page listed only opening day (17 July), already sold out. The Odyssey
is the first film shot entirely on IMAX 70mm and the BFI 70mm run sells out
fast, so the goal is to **catch the moment September goes on sale** and get in
quickly.

## How it works

- [`check.mjs`](./check.mjs) fetches the BFI booking pages (standard + subtitled
  performances), strips the HTML, and looks for any `"<day> September 2026"`
  screening. It classifies the result as:
  - `not_yet` — no September screenings listed yet (no notification),
  - `on_sale_available` — September listed with bookable shows,
  - `on_sale_soldout` — September listed but every show sold out,
  - `blocked` — the page couldn't be read (logged as a warning, no false "nothing on sale").
- [`notify.cjs`](./notify.cjs) opens a single **GitHub issue** when the status
  becomes actionable, assigning + `@`-mentioning the repo owner (that's what
  emails you). It's idempotent: one open issue, a comment only when the status
  actually changes, and it closes the issue if September stops being listed.
- [`../../.github/workflows/bfi-imax-odyssey-watch.yml`](../../.github/workflows/bfi-imax-odyssey-watch.yml)
  runs it **daily (09:23 UTC)**.

Runs on GitHub-hosted runners, which reach the BFI site directly (unlike some
sandboxed environments that proxy-block `bfi.org.uk`).

## ⚠️ To activate the daily schedule: merge to `main`

GitHub fires **both** `schedule:` triggers and the manual **Run workflow**
button only when the workflow exists on the repository's **default branch**.
While this lives on a feature branch it will **not** run — scheduled or manual.

- **To go live:** merge this branch into `main`.
- **After it's on `main`:** the daily run is automatic, and you can also trigger
  it on demand via Actions tab → _BFI IMAX Odyssey ticket watch_ → **Run
  workflow** (with optional month/year overrides).
- **Before merging**, you can still exercise the logic locally — see _Run
  locally_ below.

(GitHub also auto-disables scheduled workflows after 60 days of repo inactivity —
not a concern for a two-month watch, but worth knowing.)

## Notifications

You get an email when the tracking issue is opened/updated (via the assignment +
`@mention`), provided your GitHub notification settings email you for those.
Every run also writes its result to the workflow **run summary** in the Actions
tab, so you can see it worked even on quiet days.

## What it does *not* do

It does **not** judge individual seat quality — the BFI seat map sits behind a
JavaScript booking flow. It tells you September is bookable and links you
straight there; pick central seats in the **middle-to-back rows** (the IMAX
sweet spot), avoiding the front ~5 rows. For an automated seat-quality read you'd
need an LLM-in-the-loop routine (see below).

## Adjusting it

- **Month / year:** change the `schedule` defaults in the workflow, or pass
  `month` / `year` inputs on a manual run. Locally: `TARGET_MONTH=October node check.mjs`.
- **Cadence:** daily by default; edit the `cron:` line (UTC) to change it —
  e.g. weekly on Wednesdays: `23 9 * * 3`.
- **Party size / seat preference:** wording lives in `notify.cjs`; the default
  guidance assumes a central pair in the mid-to-back rows.

## Run locally

```bash
node scripts/bfi-imax-odyssey/check.mjs        # live check (needs open internet)
node scripts/bfi-imax-odyssey/check.test.mjs   # parser self-tests, no network
```

## Alternative: an LLM-in-the-loop routine

A richer option is a scheduled Claude "Routine" that reads the page with a
server-side fetch tool and actually assesses seat quality on every run. It needs a
one-time tool-approval that can only be granted from an interactive Claude Code
session (it can't be created from a non-interactive/automated run). This
GitHub Action is the durable, self-contained equivalent.
