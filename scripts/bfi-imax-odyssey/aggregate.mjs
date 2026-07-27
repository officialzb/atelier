// Aggregate the parallel fetch attempts (matrix) into one result.
//
// Each matrix runner writes result-<n>/result.json. Different runners get
// different IPs, so if BFI blocks some datacenter IPs we still likely have at
// least one clean read. We pick the "best" available read and emit it as
// GitHub step outputs for the notifier.
//
// Usage (CI): node aggregate.mjs <artifacts-dir>

import { readdirSync, readFileSync, statSync, appendFileSync } from "node:fs";
import { join } from "node:path";

// Higher rank wins. A real read of any kind beats "blocked"; among real reads
// prefer one that shows availability (guards against a returns flip mid-run).
const RANK = { on_sale_available: 3, on_sale_soldout: 2, not_yet: 1, blocked: 0 };

export function pickBest(results) {
  const usable = results.filter((r) => r && typeof r.status === "string");
  if (usable.length === 0) return null;
  return usable.slice().sort((a, b) => (RANK[b.status] ?? 0) - (RANK[a.status] ?? 0))[0];
}

function loadResults(dir) {
  const out = [];
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const p = join(dir, name);
    try {
      // Artifacts download as result-<n>/result.json (or flat result.json).
      const file = statSync(p).isDirectory() ? join(p, "result.json") : p;
      if (!file.endsWith(".json")) continue;
      out.push(JSON.parse(readFileSync(file, "utf8")));
    } catch {
      // Skip missing/corrupt files (a runner may have failed to upload).
    }
  }
  return out;
}

function setOutput(key, value) {
  const out = process.env.GITHUB_OUTPUT;
  const line = `${key}=${String(value ?? "").replace(/\r?\n/g, " ")}\n`;
  if (out) appendFileSync(out, line);
}

function main() {
  const dir = process.argv[2] || "attempts";
  const results = loadResults(dir);
  const okReads = results.filter((r) => r && r.status && r.status !== "blocked").length;
  const best = pickBest(results);

  console.log(
    `Aggregated ${results.length} attempt(s); ${okReads} got through. ` +
      `Chosen status: ${best ? best.status : "blocked (all attempts blocked/absent)"}`,
  );

  if (!best) {
    setOutput("status", "blocked");
    setOutput("target_label", results[0]?.label || "");
    return;
  }

  setOutput("status", best.status);
  setOutput("target_label", best.label || "");
  setOutput("total", best.total ?? 0);
  setOutput("available", best.available ?? 0);
  setOutput("sold_out", best.soldOut ?? 0);
  setOutput("dates", (best.uniqueDates || []).join("; "));
  setOutput("available_dates", (best.availableDates || []).join("; "));
  setOutput("checked_at", best.checkedAt || new Date().toISOString());
  setOutput("box_office", best.boxOffice || "020 7928 3232");
  setOutput("ok_reads", okReads);
  setOutput("attempts", results.length);
}

const invokedDirectly =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) main();
