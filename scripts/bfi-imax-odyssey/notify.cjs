// Issue-based notifier + availability timeline for the Odyssey watcher.
// Called from the workflow via actions/github-script.
//
// - Keeps ONE open tracking issue; opens it when the month is on sale.
// - Logs a timestamped comment every time the set of *bookable* dates changes
//   (a return appears / a date sells out again). With frequent runs, those
//   timestamps reveal when new seats actually drop.
//
// Reads the checker's results from env vars (STATUS, AVAILABLE_DATES, ...).

const BOOKING_LINK =
  "https://whatson.bfi.org.uk/imax/Online/default.asp?BOparam::WScontent::loadArticle::permalink=odyssey-the-film-imax-70mm-2026";
const LABEL = "odyssey-watch";

/** Set difference helper: which dates are in `curr` but not `prev`, and vice-versa. */
function diffAvailability(prev, curr) {
  const p = new Set(prev);
  const c = new Set(curr);
  return {
    appeared: curr.filter((d) => !p.has(d)),
    disappeared: prev.filter((d) => !c.has(d)),
  };
}

function parseList(env) {
  return (env || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function readAvailableMarker(body) {
  const m = (body || "").match(/<!-- odyssey-available: (\[.*?\]) -->/);
  if (!m) return [];
  try {
    return JSON.parse(m[1]);
  } catch {
    return [];
  }
}

function buildBody({ owner, status, label, total, available, soldOut, dates, availableDates, checkedAt }) {
  return [
    `<!-- odyssey-status: ${status} -->`,
    `<!-- odyssey-available: ${JSON.stringify(availableDates)} -->`,
    `@${owner} — **The Odyssey** (IMAX 70mm) at **BFI IMAX Waterloo**, ${label}.`,
    "",
    `- **Status:** ${status === "on_sale_available" ? "bookable now" : "on sale, currently sold out"}`,
    `- **Screenings listed:** ${total}  ·  **bookable:** ${available}  ·  **sold out:** ${soldOut}`,
    dates ? `- **Dates listed:** ${dates}` : "",
    availableDates.length ? `- **Bookable dates:** ${availableDates.join("; ")}` : "",
    `- **Last checked:** ${checkedAt}`,
    "",
    `**Book:** ${BOOKING_LINK}  ·  **Box office:** 020 7928 3232 (Mon–Sat 12–7pm, Sun 12–6pm)`,
    "",
    "> The full 70mm run sold out on the 15 Jun on-sale, so bookable seats are usually **returns** — grab them fast. Comments below log when seats appear/disappear (all times UTC).",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

module.exports = async ({ github, context, core }) => {
  const { owner, repo } = context.repo;
  const status = process.env.STATUS || "blocked";
  const label = process.env.TARGET_LABEL || "target month";
  const total = process.env.TOTAL || "0";
  const available = process.env.AVAILABLE || "0";
  const soldOut = process.env.SOLD_OUT || "0";
  const dates = process.env.DATES || "";
  const availableDates = parseList(process.env.AVAILABLE_DATES);
  const checkedAt = process.env.CHECKED_AT || new Date().toISOString();

  const summary = [
    `**Status:** \`${status}\``,
    `**${label} listed:** ${total} (bookable ${available}, sold out ${soldOut})`,
    availableDates.length ? `**Bookable now:** ${availableDates.join("; ")}` : "",
    `**Checked:** ${checkedAt}`,
  ]
    .filter(Boolean)
    .join("  \n");
  await core.summary.addHeading("BFI IMAX — The Odyssey watch").addRaw(summary).write();

  if (status === "blocked") {
    core.warning("Could not read the BFI booking page this run; availability unconfirmed.");
    return;
  }

  try {
    await github.rest.issues.getLabel({ owner, repo, name: LABEL });
  } catch (e) {
    if (e.status === 404) {
      await github.rest.issues.createLabel({
        owner,
        repo,
        name: LABEL,
        color: "B60205",
        description: "BFI IMAX Odyssey ticket watcher",
      });
    } else {
      throw e;
    }
  }

  const { data: open } = await github.rest.issues.listForRepo({ owner, repo, state: "open", labels: LABEL });
  const existing = open[0];
  const actionable = status === "on_sale_available" || status === "on_sale_soldout";

  if (!actionable) {
    // status === "not_yet": nothing on sale. Close a stale issue if present.
    if (existing) {
      await github.rest.issues.createComment({
        owner,
        repo,
        issue_number: existing.number,
        body: `${label} screenings are no longer listed as of ${checkedAt}. Closing — the watcher will reopen if they return.`,
      });
      await github.rest.issues.update({ owner, repo, issue_number: existing.number, state: "closed" });
    }
    core.info(`Status ${status}; no notification needed.`);
    return;
  }

  const title =
    status === "on_sale_available"
      ? `🎟️ The Odyssey (BFI IMAX) — ${label} bookable now (${available})`
      : `🎟️ The Odyssey (BFI IMAX) — ${label} on sale (sold out right now)`;
  const body = buildBody({ owner, status, label, total, available, soldOut, dates, availableDates, checkedAt });

  if (!existing) {
    const { data: created } = await github.rest.issues.create({ owner, repo, title, body, labels: [LABEL] });
    try {
      await github.rest.issues.addAssignees({ owner, repo, issue_number: created.number, assignees: [owner] });
    } catch (e) {
      core.info(`Could not assign ${owner}: ${e.message}`);
    }
    core.notice(`Opened issue #${created.number}: ${title}`);
    return;
  }

  // Existing issue: log any change in the bookable-date set (the drop timeline).
  const prevAvailable = readAvailableMarker(existing.body);
  const { appeared, disappeared } = diffAvailability(prevAvailable, availableDates);
  const prevStatus = (existing.body.match(/<!-- odyssey-status: (\S+) -->/) || [])[1];
  const statusChanged = prevStatus !== status;

  if (appeared.length || disappeared.length || statusChanged) {
    await github.rest.issues.update({ owner, repo, issue_number: existing.number, title, body });
  }

  const logLines = [];
  if (appeared.length) logLines.push(`🟢 **Became bookable** at ${checkedAt}: ${appeared.join("; ")} — book fast: ${BOOKING_LINK}`);
  if (disappeared.length) logLines.push(`🔴 **Sold out again** at ${checkedAt}: ${disappeared.join("; ")}`);
  if (logLines.length) {
    await github.rest.issues.createComment({ owner, repo, issue_number: existing.number, body: logLines.join("\n\n") });
    core.notice(`Logged availability change on #${existing.number}: +${appeared.length}/-${disappeared.length}`);
  } else {
    core.info(`Issue #${existing.number}: no bookable-date change (${status}).`);
  }
};

module.exports.diffAvailability = diffAvailability;
