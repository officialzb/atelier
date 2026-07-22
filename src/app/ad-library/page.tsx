"use client";

import { useState, KeyboardEvent } from "react";
import {
  Search,
  ExternalLink,
  Loader2,
  Radio,
  Archive,
  Layers,
  Globe,
} from "lucide-react";
import { motion, AnimatePresence, Variants } from "framer-motion";

type Ad = {
  id: string;
  page_id?: string;
  page_name?: string;
  ad_creation_time?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_descriptions?: string[];
  publisher_platforms?: string[];
  languages?: string[];
  currency?: string;
  spend?: { lower_bound?: string; upper_bound?: string };
  impressions?: { lower_bound?: string; upper_bound?: string };
  libraryUrl: string;
};

const COUNTRY_PRESETS = ["US", "GB", "DE", "FR", "IE", "CA", "AU"];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const cardVariants: Variants = {
  hidden: { y: 16, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 120, damping: 18 },
  },
};

function formatDate(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function range(r?: { lower_bound?: string; upper_bound?: string }, currency?: string) {
  if (!r) return null;
  const prefix = currency ? `${currency} ` : "";
  const lo = r.lower_bound ? Number(r.lower_bound).toLocaleString() : null;
  const hi = r.upper_bound ? Number(r.upper_bound).toLocaleString() : null;
  if (lo && hi) return `${prefix}${lo}–${hi}`;
  if (lo) return `${prefix}${lo}+`;
  return null;
}

export default function AdLibrary() {
  const [q, setQ] = useState("");
  const [countries, setCountries] = useState("US");
  const [status, setStatus] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [media, setMedia] = useState("ALL");

  const [ads, setAds] = useState<Ad[]>([]);
  const [after, setAfter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = async (cursor: string | null) => {
    if (!q.trim()) {
      setError("Enter something to search for.");
      return;
    }
    const isMore = Boolean(cursor);
    if (isMore) setLoadingMore(true);
    else {
      setLoading(true);
      setError(null);
      setAds([]);
      setAfter(null);
    }
    setSearched(true);

    try {
      const params = new URLSearchParams({
        q: q.trim(),
        countries,
        status,
        type,
        media,
        limit: "24",
      });
      if (cursor) params.set("after", cursor);

      const res = await fetch(`/api/ad-library?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed.");

      setAds((prev) => (isMore ? [...prev, ...data.ads] : data.ads));
      setAfter(data.after ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") runSearch(null);
  };

  const nonEuHint = !COUNTRY_PRESETS.slice(1, 5).some((c) =>
    countries.toUpperCase().includes(c)
  );

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-500 via-zinc-950 to-zinc-950 pointer-events-none rounded-full blur-[100px]" />

      <main className="relative z-10 px-6 py-14 md:px-12 lg:px-20 max-w-6xl mx-auto w-full">
        <header className="mb-10 text-center">
          <h1 className="text-4xl md:text-6xl font-serif tracking-widest uppercase mb-3 text-zinc-100 font-light flex items-center justify-center gap-3">
            <Archive className="w-7 h-7 md:w-9 md:h-9 text-zinc-500 opacity-60" />
            Ad Library
          </h1>
          <p className="text-zinc-400 text-sm md:text-base tracking-widest uppercase">
            See who&apos;s running ads — straight from Meta&apos;s public archive.
          </p>
          <div className="h-px w-40 bg-zinc-800 mx-auto mt-6" />
        </header>

        {/* Controls */}
        <div className="mb-8 space-y-4">
          <div className="flex items-stretch gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 pointer-events-none" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Brand, product, or keyword — e.g. “running shoes”, “Liquid Death”"
                className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg pl-12 pr-4 py-3.5 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>
            <button
              onClick={() => runSearch(null)}
              disabled={loading}
              className="px-7 rounded-lg font-serif text-lg tracking-wider uppercase bg-zinc-100 text-zinc-950 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Search"}
            </button>
          </div>

          {/* Country presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-zinc-500 flex items-center gap-1.5 mr-1">
              <Globe className="w-3.5 h-3.5" /> Reached
            </span>
            {COUNTRY_PRESETS.map((c) => {
              const active = countries.toUpperCase() === c;
              return (
                <button
                  key={c}
                  onClick={() => setCountries(c)}
                  className={`px-3 py-1 rounded-full text-xs tracking-wider border transition-colors ${
                    active
                      ? "border-zinc-400 bg-zinc-100 text-zinc-950"
                      : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  {c}
                </button>
              );
            })}
            <input
              value={countries}
              onChange={(e) => setCountries(e.target.value.toUpperCase())}
              className="w-28 bg-zinc-900/60 border border-zinc-800 rounded-full px-3 py-1 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600"
              aria-label="Country codes, comma separated"
            />
          </div>

          {/* Selects */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select label="Status" icon={<Radio className="w-3.5 h-3.5" />} value={status} onChange={setStatus} options={["ALL", "ACTIVE", "INACTIVE"]} />
            <Select label="Ad type" icon={<Layers className="w-3.5 h-3.5" />} value={type} onChange={setType} options={["ALL", "POLITICAL_AND_ISSUE_ADS"]} />
            <Select label="Media" icon={<Layers className="w-3.5 h-3.5" />} value={media} onChange={setMedia} options={["ALL", "IMAGE", "VIDEO", "MEME", "NONE"]} />
          </div>

          {nonEuHint && type === "ALL" && (
            <p className="text-xs text-amber-200/70 bg-amber-950/30 border border-amber-900/40 rounded-md px-3 py-2">
              Heads up: outside the EU, Meta&apos;s archive only exposes <em>political &amp; issue</em> ads.
              To browse a competitor&apos;s <em>commercial</em> ads, reach an EU country (DE, FR, IE…) — that&apos;s
              where the DSA forces full ad transparency.
            </p>
          )}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 px-4 py-3 bg-red-950/50 border border-red-900 text-red-200 rounded-md text-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500 gap-4">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="font-serif italic text-lg">Searching the archive…</p>
          </div>
        ) : ads.length > 0 ? (
          <>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {ads.map((ad, i) => (
                <AdCard key={`${ad.id}-${i}`} ad={ad} />
              ))}
            </motion.div>

            {after && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={() => runSearch(after)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-8 py-3 border border-zinc-700 text-zinc-300 rounded-full hover:bg-zinc-900 transition-colors text-sm tracking-widest uppercase"
                >
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load more"}
                </button>
              </div>
            )}
          </>
        ) : searched ? (
          <div className="text-center py-24 text-zinc-500">
            <p className="font-serif italic text-xl mb-2">Nothing found.</p>
            <p className="text-sm">Try a broader keyword, a different country, or set status to ALL.</p>
          </div>
        ) : (
          <div className="text-center py-24 text-zinc-600">
            <Archive className="w-12 h-12 mx-auto mb-4 opacity-30" strokeWidth={1} />
            <p className="font-serif italic text-xl">Search a brand or keyword to begin.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function Select({
  label,
  icon,
  value,
  onChange,
  options,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-zinc-500 flex items-center gap-1.5 mb-1.5">
        {icon} {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-zinc-900">
            {o.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function AdCard({ ad }: { ad: Ad }) {
  const body = ad.ad_creative_bodies?.find(Boolean);
  const title = ad.ad_creative_link_titles?.find(Boolean);
  const running = !ad.ad_delivery_stop_time;
  const started = formatDate(ad.ad_delivery_start_time);
  const spend = range(ad.spend, ad.currency);
  const impressions = range(ad.impressions);

  return (
    <motion.a
      variants={cardVariants}
      href={ad.libraryUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col border border-zinc-800 bg-zinc-900/40 rounded-xl p-5 hover:border-zinc-600 hover:bg-zinc-900/70 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-serif text-lg text-zinc-100 truncate">{ad.page_name || "Unknown page"}</p>
          {ad.page_id && <p className="text-xs text-zinc-600">#{ad.page_id}</p>}
        </div>
        <span
          className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
            running
              ? "border-emerald-800/60 text-emerald-300/80 bg-emerald-950/30"
              : "border-zinc-700 text-zinc-500"
          }`}
        >
          {running ? "Active" : "Ended"}
        </span>
      </div>

      {body ? (
        <p className="text-sm text-zinc-300 leading-relaxed line-clamp-5 mb-4">{body}</p>
      ) : (
        <p className="text-sm text-zinc-600 italic mb-4">No ad copy (image/video creative).</p>
      )}

      <div className="mt-auto space-y-3">
        {title && <p className="text-xs text-zinc-400 truncate">↳ {title}</p>}

        {(spend || impressions) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
            {spend && <span>Spend: <span className="text-zinc-200">{spend}</span></span>}
            {impressions && <span>Impressions: <span className="text-zinc-200">{impressions}</span></span>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {ad.publisher_platforms?.map((p) => (
            <span key={p} className="text-[10px] uppercase tracking-wider text-zinc-500 border border-zinc-800 rounded px-1.5 py-0.5">
              {p}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
          <span className="text-xs text-zinc-600">{started ? `Since ${started}` : "—"}</span>
          <span className="text-xs text-zinc-400 flex items-center gap-1 group-hover:text-zinc-200 transition-colors">
            Ad Library <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </div>
    </motion.a>
  );
}
