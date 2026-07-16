// Issue-based notifier for the Odyssey watcher, called from the workflow via
// actions/github-script. Idempotent and low-noise: it keeps a single open
// tracking issue and only comments when the booking status actually changes.
//
// Reads the checker's results from env vars (STATUS, TOTAL, AVAILABLE, ...).

const BOOKING_LINK =
  "https://whatson.bfi.org.uk/imax/Online/default.asp?BOparam::WScontent::loadArticle::permalink=odyssey-the-film-imax-70mm-2026";
const LABEL = "odyssey-watch";

module.exports = async ({ github, context, core }) => {
  const { owner, repo } = context.repo;
  const status = process.env.STATUS || "blocked";
  const label = process.env.TARGET_LABEL || "target month";
  const total = process.env.TOTAL || "0";
  const available = process.env.AVAILABLE || "0";
  const soldOut = process.env.SOLD_OUT || "0";
  const dates = process.env.DATES || "";
  const checkedAt = process.env.CHECKED_AT || new Date().toISOString();
  const boxOffice = process.env.BOX_OFFICE || "020 7928 3232";

  // Always record the outcome in the run summary (visible in the Actions tab).
  const summary = [
    `**Status:** \`${status}\``,
    `**${label} listed:** ${total} (bookable ${available}, sold out ${soldOut})`,
    dates ? `**Dates:** ${dates}` : "",
    `**Checked:** ${checkedAt}`,
  ]
    .filter(Boolean)
    .join("  \n");
  await core.summary.addHeading("BFI IMAX — The Odyssey watch").addRaw(summary).write();

  if (status === "blocked") {
    core.warning("Could not read the BFI booking page this run; availability unconfirmed.");
    return;
  }

  // Ensure the tracking label exists.
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

  const { data: open } = await github.rest.issues.listForRepo({
    owner,
    repo,
    state: "open",
    labels: LABEL,
  });
  const existing = open[0];
  const marker = `<!-- odyssey-status: ${status} -->`;
  const actionable = status === "on_sale_available" || status === "on_sale_soldout";

  if (!actionable) {
    // status === "not_yet": nothing to announce. Close a stale issue if present.
    if (existing) {
      await github.rest.issues.createComment({
        owner,
        repo,
        issue_number: existing.number,
        body: `${label} screenings are no longer listed on the BFI page as of ${checkedAt}. Closing — the daily watcher will reopen if they return.`,
      });
      await github.rest.issues.update({ owner, repo, issue_number: existing.number, state: "closed" });
    }
    core.info(`Status ${status}; no notification needed.`);
    return;
  }

  const title =
    status === "on_sale_available"
      ? `🎟️ The Odyssey (BFI IMAX) — ${label} tickets on sale (${available} bookable)`
      : `🎟️ The Odyssey (BFI IMAX) — ${label} tickets on sale (currently sold out)`;

  const body = [
    marker,
    `@${owner} — booking status changed for **The Odyssey** (IMAX 70mm) at **BFI IMAX Waterloo**.`,
    "",
    `- **${label} screenings listed:** ${total}`,
    `- **Appear bookable:** ${available}`,
    `- **Sold out:** ${soldOut}`,
    dates ? `- **Dates:** ${dates}` : "",
    `- **Checked:** ${checkedAt}`,
    "",
    `**Book:** ${BOOKING_LINK}`,
    `**Box office:** ${boxOffice} (Mon–Sat 12–7pm, Sun 12–6pm)`,
    "",
    "> Seat quality isn't auto-assessed. Open the booking link and aim for central seats in the middle-to-back rows (the IMAX sweet spot), avoiding the front ~5 rows. Nolan 70mm screenings sell out fast, so book quickly.",
  ]
    .filter((l) => l !== "")
    .join("\n");

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

  // An open tracking issue already exists — only act when the status changed.
  const changed = !existing.body || !existing.body.includes(marker);
  if (changed) {
    await github.rest.issues.update({ owner, repo, issue_number: existing.number, title, body });
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: existing.number,
      body: `Update (${checkedAt}): status is now **${status}** — ${available} bookable / ${soldOut} sold out for ${label}. ${BOOKING_LINK}`,
    });
    core.notice(`Updated issue #${existing.number} (status changed to ${status}).`);
  } else {
    core.info(`Issue #${existing.number} already reflects status ${status}; no comment.`);
  }
};
