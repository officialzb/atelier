"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Clock,
  CalendarDays,
  Moon,
  RefreshCw,
  ArrowUpRight,
  Loader2,
  AlertTriangle,
  Navigation,
  CircleCheck,
  CircleSlash,
} from "lucide-react";
import type { AvailabilityResult, Slot, VenueResult, FilterMode } from "@/lib/tennis";

const MODES: { key: FilterMode; label: string }[] = [
  { key: "both", label: "After 8pm + weekends" },
  { key: "evening", label: "After 8pm" },
  { key: "weekend", label: "Weekends" },
];

const DAY_OPTIONS = [7, 14, 21];

function priceLabel(cost: number | null): string {
  if (cost === null) return "";
  if (cost === 0) return "Free";
  return `£${cost.toFixed(2).replace(/\.00$/, "")}`;
}

export default function TennisFinder() {
  const [data, setData] = useState<AvailabilityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<FilterMode>("both");
  const [days, setDays] = useState(14);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tennis?mode=${mode}&days=${days}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setData(json as AvailabilityResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [mode, days]);

  useEffect(() => {
    load();
  }, [load]);

  const hero = data?.soonest?.[0] ?? null;
  const updated = useMemo(
    () =>
      data
        ? new Date(data.generatedAt).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/London",
          })
        : null,
    [data],
  );

  return (
    <div className="relative min-h-screen bg-zinc-950 overflow-hidden font-sans text-zinc-50">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] opacity-[0.12] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-lime-400 via-zinc-950 to-zinc-950 pointer-events-none rounded-full blur-[120px]" />

      <main className="relative z-10 px-5 py-12 md:px-10 md:py-20 max-w-5xl mx-auto w-full">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <p className="text-lime-400/70 text-xs tracking-[0.35em] uppercase mb-4">Live court availability</p>
          <h1 className="text-4xl md:text-6xl font-serif tracking-wider uppercase font-light text-zinc-100">
            Court Finder
          </h1>
          <p className="mt-4 text-zinc-400 text-sm md:text-base flex items-center justify-center gap-2 flex-wrap">
            <MapPin className="w-4 h-4 text-lime-400/70" />
            Tennis near <span className="text-zinc-200 font-medium">E5&nbsp;8HE</span>
            <span className="text-zinc-600">·</span>
            evenings after 8pm &amp; weekends
          </p>
          <div className="h-px w-40 bg-zinc-800 mx-auto mt-8" />
        </motion.header>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs md:text-sm border transition-colors ${
                  mode === m.key
                    ? "border-lime-400/60 bg-lime-400/10 text-lime-200"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-full border border-zinc-800 overflow-hidden">
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    days === d ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-zinc-800 text-xs md:text-sm text-zinc-300 hover:border-zinc-600 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Status line */}
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-6 h-4">
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking live availability…
            </span>
          ) : data ? (
            <span className="flex items-center gap-2 flex-wrap">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-400" />
              </span>
              Live · updated {updated} · {data.counts.totalSlots} slot
              {data.counts.totalSlots === 1 ? "" : "s"} across {data.counts.venuesOk} venue
              {data.counts.venuesOk === 1 ? "" : "s"}
              {data.counts.venuesFailed > 0 && (
                <span className="text-amber-500/80">· {data.counts.venuesFailed} unreachable</span>
              )}
            </span>
          ) : null}
        </div>

        {/* Hard error */}
        {error && (
          <div className="mb-8 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-amber-200/90 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="font-medium text-amber-200">Couldn&apos;t load availability</p>
              <p className="text-amber-200/70 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Hero: next available */}
        <AnimatePresence mode="wait">
          {hero && (
            <motion.div
              key={`${hero.venueSlug}-${hero.date}-${hero.startMin}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="mb-10 rounded-2xl border border-lime-400/30 bg-gradient-to-br from-lime-400/[0.08] to-zinc-900/40 p-6 md:p-8"
            >
              <p className="text-xs tracking-[0.3em] uppercase text-lime-400/70 mb-3">Next available</p>
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
                <div>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-3xl md:text-5xl font-serif font-light text-white">{hero.start}</span>
                    <span className="text-zinc-400 text-lg">{hero.dayLabel}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-zinc-300">
                    <span className="font-medium text-lime-100">{hero.venueName}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="flex items-center gap-1 text-sm text-zinc-400">
                      <Navigation className="w-3.5 h-3.5" />
                      {hero.distanceMiles} mi
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 flex-wrap text-sm text-zinc-400">
                    <Badge slot={hero} />
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {hero.start} – {hero.end}
                    </span>
                    <span>· {hero.court}</span>
                    {priceLabel(hero.cost) && (
                      <span className="text-zinc-300">· {priceLabel(hero.cost)}</span>
                    )}
                  </div>
                </div>
                <a
                  href={hero.bookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-lime-400 px-6 py-3 text-sm font-medium text-zinc-950 hover:bg-lime-300 transition-colors shrink-0"
                >
                  Book on ClubSpark
                  <ArrowUpRight className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state (loaded, reachable, but nothing matched) */}
        {!loading && data && data.counts.totalSlots === 0 && data.counts.venuesOk > 0 && (
          <div className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center">
            <CircleSlash className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-300">No {modeText(mode)} slots in the next {days} days.</p>
            <p className="text-zinc-500 text-sm mt-1">Try a wider window or a different filter.</p>
          </div>
        )}

        {/* Venues */}
        {data && (
          <div className="space-y-4">
            {data.venues.map((venue, i) => (
              <VenueCard key={venue.slug} venue={venue} index={i} days={days} />
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-14 pt-8 border-t border-zinc-900 text-xs text-zinc-600 leading-relaxed">
          <p>
            Live data pulled directly from{" "}
            <span className="text-zinc-400">ClubSpark</span> (the LTA booking platform used by Hackney
            Tennis) each time you load or refresh. Courts are ranked by distance from E5&nbsp;8HE.
            Availability changes minute to minute — tap through to ClubSpark to confirm and pay.
          </p>
        </footer>
      </main>
    </div>
  );
}

function modeText(mode: FilterMode): string {
  if (mode === "evening") return "after-8pm";
  if (mode === "weekend") return "weekend";
  return "evening or weekend";
}

function Badge({ slot }: { slot: Slot }) {
  if (slot.isEvening) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 text-indigo-200 px-2 py-0.5 text-xs">
        <Moon className="w-3 h-3" /> Evening
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-lime-500/15 text-lime-200 px-2 py-0.5 text-xs">
      <CalendarDays className="w-3 h-3" /> Weekend
    </span>
  );
}

function VenueCard({
  venue,
  index,
  days,
}: {
  venue: VenueResult;
  index: number;
  days: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? venue.slots : venue.slots.slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
      className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl text-zinc-100 flex items-center gap-2">
            {venue.name}
            {venue.ok && venue.slotCount > 0 && (
              <CircleCheck className="w-4 h-4 text-lime-400" />
            )}
          </h3>
          <p className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
            <span>{venue.area}</span>
            <span className="text-zinc-700">·</span>
            <span className="flex items-center gap-1">
              <Navigation className="w-3 h-3" />
              {venue.distanceMiles} mi
            </span>
          </p>
        </div>
        <a
          href={venue.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-400 hover:text-lime-300 transition-colors flex items-center gap-1 shrink-0"
        >
          Grid <ArrowUpRight className="w-3 h-3" />
        </a>
      </div>

      {/* Slots / states */}
      <div className="mt-4">
        {!venue.ok ? (
          <p className="text-xs text-amber-500/80 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            {venue.error ?? "Unreachable"}
          </p>
        ) : venue.slots.length === 0 ? (
          <p className="text-xs text-zinc-600">No matching slots in the next {days} days.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {visible.map((slot) => (
                <a
                  key={`${slot.date}-${slot.startMin}-${slot.court}`}
                  href={slot.bookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${slot.court} · ${slot.start}–${slot.end}${
                    priceLabel(slot.cost) ? ` · ${priceLabel(slot.cost)}` : ""
                  }`}
                  className="group flex flex-col rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 hover:border-lime-400/50 hover:bg-lime-400/[0.06] transition-colors"
                >
                  <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                    {slot.isEvening ? <Moon className="w-3 h-3" /> : <CalendarDays className="w-3 h-3" />}
                    {slot.dayLabel}
                  </span>
                  <span className="text-sm text-zinc-100 group-hover:text-lime-200">{slot.start}</span>
                </a>
              ))}
            </div>
            {venue.slotCount > 6 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {expanded ? "Show less" : `Show all ${venue.slotCount} slots`}
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
