"use client";

import { useMemo, useSyncExternalStore, type CSSProperties } from "react";
import Image from "next/image";
import brand from "../../../docs/brand/brand.json";
import prompts from "../../../docs/brand/visual-prompts.json";
import { contrast, wcagLabel } from "./contrast";

type Palette = (typeof brand.visual.palettes)[number];
type Pairing = (typeof brand.visual.type_pairings)[number];

const FONT_VARS: Record<string, { display: string; body: string; mono: string }> = {
  instrument: {
    display: "var(--font-instrument-serif)",
    body: "var(--font-inter-tight)",
    mono: "var(--font-jetbrains-mono)",
  },
  fraunces: {
    display: "var(--font-fraunces)",
    body: "var(--font-inter-body)",
    mono: "var(--font-plex-mono)",
  },
  newsreader: {
    display: "var(--font-newsreader)",
    body: "var(--font-instrument-sans)",
    mono: "var(--font-space-mono)",
  },
};

const STORAGE_KEY = "yolodex-brand-choices";
const BADGER_FILE = "yolo-badger-reference.png";

// Tiny external store over localStorage so the palette/pairing choice survives reloads
// without a setState-in-effect and without a hydration mismatch (server snapshot is "").
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function getSnapshot(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}
function getServerSnapshot(): string {
  return "";
}
function writeChoices(next: { palette?: string; pairing?: string }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: choices just don't persist */
  }
  listeners.forEach((l) => l());
}
function parseChoices(raw: string): { palette?: string; pairing?: string } {
  try {
    return raw ? (JSON.parse(raw) as { palette?: string; pairing?: string }) : {};
  } catch {
    return {};
  }
}

export default function BrandGuide({ images }: { images: string[] }) {
  const palettes = brand.visual.palettes;
  const pairings = brand.visual.type_pairings;
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const stored = useMemo(() => parseChoices(raw), [raw]);
  const defaultPalette = palettes.find((p) => p.recommended)?.id ?? palettes[0].id;
  const defaultPairing = pairings.find((p) => p.recommended)?.id ?? pairings[0].id;
  const paletteId = palettes.some((p) => p.id === stored.palette) ? stored.palette! : defaultPalette;
  const pairingId = pairings.some((p) => p.id === stored.pairing) ? stored.pairing! : defaultPairing;
  const setPaletteId = (id: string) => writeChoices({ ...stored, palette: id });
  const setPairingId = (id: string) => writeChoices({ ...stored, pairing: id });

  const palette = palettes.find((p) => p.id === paletteId) ?? palettes[0];
  const pairing = pairings.find((p) => p.id === pairingId) ?? pairings[0];
  const fonts = FONT_VARS[pairing.id] ?? FONT_VARS.instrument;

  const vars = useMemo(
    () =>
      ({
        "--paper": palette.paper,
        "--ink": palette.ink,
        "--signal": palette.signal,
        "--signal-text": palette.signal_text_on,
        "--muted": palette.muted,
        "--rule": palette.rule,
        "--surface": palette.surface,
        "--font-display": fonts.display,
        "--font-body": fonts.body,
        "--font-mono": fonts.mono,
      }) as CSSProperties,
    [palette, fonts],
  );

  const hasBadger = images.includes(BADGER_FILE);
  const heroImage = images.includes("hero-annotated-ad.png") ? "/brand/hero-annotated-ad.png" : null;
  const moodImages = prompts.images.filter((p) => images.includes(p.file) && p.id !== "badger-mark");

  return (
    <div className="brand min-h-screen" style={vars}>
      <Masthead
        hasBadger={hasBadger}
        palettes={palettes}
        pairings={pairings}
        paletteId={paletteId}
        pairingId={pairingId}
        onPalette={setPaletteId}
        onPairing={setPairingId}
      />

      <main className="mx-auto max-w-6xl px-5 pb-24 md:px-10">
        <Hero heroImage={heroImage} />
        <Blueprint />
        <Team hasBadger={hasBadger} />
        <Voice />
        <Colour palette={palette} palettes={palettes} onPalette={setPaletteId} />
        <Type pairing={pairing} pairings={pairings} onPairing={setPairingId} />
        <Device heroImage={heroImage} />
        <MoodBoard moodImages={moodImages} />
        <Assets />
        <Footer />
      </main>
    </div>
  );
}

/* ---------- Sections ---------- */

function Masthead(props: {
  hasBadger: boolean;
  palettes: Palette[];
  pairings: Pairing[];
  paletteId: string;
  pairingId: string;
  onPalette: (id: string) => void;
  onPairing: (id: string) => void;
}) {
  return (
    <header className="sticky top-0 z-20 bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4 md:px-10">
        <div className="flex items-center gap-3">
          <BadgerMark hasBadger={props.hasBadger} size={36} />
          <span className="t-body text-2xl font-semibold tracking-tight">
            <span className="swipe">yolodex</span>
          </span>
          <span className="t-mono text-muted">brand · v{brand.meta.version}</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-x-6 gap-y-2">
          <Switcher
            label="Colour"
            options={props.palettes.map((p) => ({ id: p.id, name: p.name }))}
            value={props.paletteId}
            onChange={props.onPalette}
          />
          <Switcher
            label="Type"
            options={props.pairings.map((p) => ({ id: p.id, name: p.name }))}
            value={props.pairingId}
            onChange={props.onPairing}
          />
        </div>
      </div>
      <div className="rule-ink" />
    </header>
  );
}

function Switcher(props: {
  label: string;
  options: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="t-mono text-muted">{props.label}</span>
      <div className="flex flex-wrap gap-1" role="group" aria-label={props.label}>
        {props.options.map((o) => (
          <button
            key={o.id}
            type="button"
            className="chip"
            aria-pressed={props.value === o.id}
            onClick={() => props.onChange(o.id)}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function BadgerMark({ hasBadger, size }: { hasBadger: boolean; size: number }) {
  if (hasBadger) {
    return (
      <span
        className="relative inline-block overflow-hidden rounded-full bg-signal"
        style={{ width: size, height: size }}
        aria-label="Yolo Badger"
      >
        <Image src={`/brand/${BADGER_FILE}`} alt="Yolo Badger" fill className="object-cover object-top" sizes={`${size}px`} />
      </span>
    );
  }
  return (
    <span
      className="t-mono inline-flex items-center justify-center rounded-full bg-signal"
      style={{ width: size, height: size }}
      aria-label="Yolo Badger placeholder"
    >
      YB
    </span>
  );
}

function SectionHead({ n, title, kicker }: { n: string; title: string; kicker?: string }) {
  return (
    <div className="mt-20 mb-8">
      <div className="rule-ink" />
      <div className="flex items-baseline gap-4 pt-3">
        <span className="t-mono text-muted">{n}</span>
        <h2 className="t-h2">{title}</h2>
        {kicker && <span className="t-mono text-muted hidden md:inline">{kicker}</span>}
      </div>
    </div>
  );
}

function Hero({ heroImage }: { heroImage: string | null }) {
  const { promise, explainer, category } = brand.blueprint;
  return (
    <section className="grid gap-10 pt-14 md:grid-cols-12 md:pt-20">
      <div className="md:col-span-7">
        <p className="t-mono text-muted mb-6">{category}</p>
        <h1 className="t-display-xl">
          {promise.headline}
          <br />
          <span className="text-muted">{promise.subline}</span>
        </h1>
        <p className="t-body mt-8 max-w-xl text-lg">{explainer}</p>
        <p className="t-mono text-muted mt-6">
          Draft {brand.meta.version} · {brand.meta.date} · {brand.meta.status}
        </p>
      </div>
      <div className="md:col-span-5">
        {heroImage ? (
          <div className="relative aspect-video w-full border border-rule bg-surface">
            <Image src={heroImage} alt="Annotated ad hero concept" fill className="object-cover" sizes="(min-width: 768px) 40vw, 100vw" />
          </div>
        ) : (
          <AnnotatedAdDemo compact />
        )}
      </div>
    </section>
  );
}

function Blueprint() {
  const b = brand.blueprint;
  const rows: [string, string][] = [
    ["Purpose", b.purpose],
    ["Category", b.category],
    ["Explainer", b.explainer],
    ["Promise", `${b.promise.headline} ${b.promise.subline}`],
    ["Buyer", `${b.audience.primary_buyer}. Cares about ${b.audience.buyer_cares_about.join(", ")}.`],
    ["Enemy", `Smaller brands: ${b.enemy.smaller_brands} Bigger brands: ${b.enemy.bigger_brands}`],
    ["Tried before", b.audience.tried_before.join(". ") + "."],
    ["Proof style", b.proof_style],
    ["Hero story", `${b.hero_story.brand}: ${b.hero_story.setup} “${b.hero_story.ideal_quote}”`],
    ["Archetype", `${brand.personality.archetype}. ${brand.personality.traits.join(", ")}.`],
    ["Ambition", b.ambition],
  ];
  return (
    <section>
      <SectionHead n="01" title="Blueprint" kicker="one slide, everything derives from it" />
      <dl className="grid gap-x-8 md:grid-cols-[10rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="t-mono text-muted pt-4 md:border-t md:border-rule">{k}</dt>
            <dd className="t-body border-t border-rule pt-4 pb-4 md:border-t">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {b.supporting_proof.map((p) => (
          <div key={p.brand} className="border-t border-ink pt-3">
            <p className="t-display text-4xl">{p.brand}</p>
            <p className="t-body mt-2 text-sm">{p.stat}</p>
          </div>
        ))}
      </div>
      <p className="t-body mt-10 max-w-3xl">
        <span className="t-mono text-muted mr-3">Positioning</span>
        {b.positioning_statement}
      </p>
    </section>
  );
}

function Team({ hasBadger }: { hasBadger: boolean }) {
  const t = brand.team;
  return (
    <section>
      <SectionHead n="02" title="The team" kicker="every agent is a real job" />
      <p className="t-body max-w-3xl">{t.concept}</p>
      <div className="mt-10 border border-ink">
        <div className="flex items-center gap-5 p-6">
          <BadgerMark hasBadger={hasBadger} size={72} />
          <div>
            <p className="t-display text-3xl">{t.lead.name}</p>
            <p className="t-mono text-muted mt-1">{t.lead.role}</p>
            <p className="t-body mt-2 max-w-2xl text-sm">{t.lead.does}</p>
          </div>
        </div>
        <div className="rule-ink" />
        <ol className="grid md:grid-cols-7">
          {t.agents.map((a, i) => (
            <li key={a.title} className="border-b border-rule p-4 md:border-r md:border-b-0 md:last:border-r-0">
              <p className="t-mono text-muted">0{i + 1}</p>
              <p className="t-body mt-2 font-semibold">{a.title}</p>
              <p className="t-body text-muted mt-1 text-xs leading-snug">{a.does}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Voice() {
  const v = brand.personality.voice;
  const examples: [string, string][] = [
    [
      "Homepage hero",
      "Yolodex is an AI creative strategy team. It finds your winning angles, builds shoot-ready briefs at ten times the pace of a human team, and learns from every ad you run. Peachies now gets 90% of its winning ads from Yolodex briefs.",
    ],
    [
      "Cold email",
      "Hi Sam. You're spending roughly £200k a month on Meta and your strategist is briefing about eight ads a week. That maths doesn't hold under Andromeda. Worth 20 minutes? I'll show you the machine on your own account.",
    ],
    [
      "In-app (Yolo Badger)",
      "Sprint 14 is ready. I've ranked 6 angles by opportunity and built 12 briefs. The “night-time routine” persona is new this week: 41 reviews mention it and none of your live ads do. Start there.",
    ],
  ];
  return (
    <section>
      <SectionHead n="03" title="Voice" kicker={v.register} />
      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <table className="w-full text-left">
            <thead>
              <tr className="t-mono text-muted">
                <th className="border-b border-ink pb-2 font-normal">We are</th>
                <th className="border-b border-ink pb-2 font-normal">We are not</th>
              </tr>
            </thead>
            <tbody className="t-body">
              {v.we_are.map((w, i) => (
                <tr key={w}>
                  <td className="border-b border-rule py-2 capitalize">{w}</td>
                  <td className="border-b border-rule py-2 capitalize text-muted">{v.we_are_not[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ol className="t-body mt-8 list-decimal space-y-2 pl-5 text-sm">
            {v.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        </div>
        <div className="space-y-6">
          {examples.map(([k, text]) => (
            <figure key={k} className="border-l-2 border-ink pl-4">
              <figcaption className="t-mono text-muted mb-2">{k}</figcaption>
              <blockquote className="t-body">{text}</blockquote>
            </figure>
          ))}
          <div className="grid grid-cols-2 gap-6 pt-2">
            <div>
              <p className="t-mono text-muted mb-2">Use</p>
              <p className="t-body text-sm">{v.preferred_words.join(" · ")}</p>
            </div>
            <div>
              <p className="t-mono text-muted mb-2">Ban</p>
              <p className="t-body text-muted text-sm line-through decoration-1">{v.banned_words.join(" · ")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Swatch({ name, hex, on, large }: { name: string; hex: string; on?: string; large?: boolean }) {
  const ratio = on ? contrast(hex, on) : null;
  return (
    <div>
      <div
        className="border border-rule"
        style={{ background: hex, height: large ? 120 : 72 }}
        aria-label={`${name} ${hex}`}
      />
      <p className="t-body mt-2 text-sm font-semibold">{name}</p>
      <p className="t-mono text-muted">{hex}</p>
      {ratio !== null && (
        <p className="t-mono text-muted">
          {ratio.toFixed(1)}:1 · {wcagLabel(ratio)}
        </p>
      )}
    </div>
  );
}

function Colour({ palette, palettes, onPalette }: { palette: Palette; palettes: Palette[]; onPalette: (id: string) => void }) {
  return (
    <section>
      <SectionHead n="04" title="Colour" kicker="paper, ink, greys and one signal" />
      <p className="t-body max-w-3xl">{palette.notes}</p>
      <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-6">
        <Swatch name="Paper" hex={palette.paper} large />
        <Swatch name="Ink" hex={palette.ink} on={palette.paper} large />
        <Swatch name="Signal" hex={palette.signal} on={palette.signal_text_on} large />
        <Swatch name="Muted" hex={palette.muted} on={palette.paper} />
        <Swatch name="Rule" hex={palette.rule} />
        <Swatch name="Surface" hex={palette.surface} />
      </div>
      <p className="t-mono text-muted mt-4">Contrast ratios are against the colour each is set on: ink and muted on paper, signal text on signal.</p>

      <div className="mt-12 grid gap-4 md:grid-cols-4">
        {palettes.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPalette(p.id)}
            aria-pressed={p.id === palette.id}
            className="border p-4 text-left transition-colors"
            style={{
              background: p.paper,
              color: p.ink,
              borderColor: p.id === palette.id ? p.ink : p.rule,
              borderWidth: p.id === palette.id ? 2 : 1,
            }}
          >
            <span className="block text-2xl" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
              {p.name}
            </span>
            <span
              className="mt-2 inline-block px-2 py-0.5 text-[0.7rem] uppercase tracking-wider"
              style={{ background: p.signal, color: p.signal_text_on, fontFamily: "var(--font-mono), monospace" }}
            >
              Winner
            </span>
            <span className="mt-3 block text-xs" style={{ color: p.muted }}>
              {p.recommended ? "Recommended · " : ""}
              {p.paper} / {p.ink} / {p.signal}
            </span>
          </button>
        ))}
      </div>
      <ul className="t-body mt-8 max-w-3xl list-disc space-y-1 pl-5 text-sm">
        <li>Body text is always ink on paper.</li>
        <li>Yellow is a highlight, never a text colour. Set ink on yellow, not yellow on paper.</li>
        <li>Muted grey is for captions and metadata only, at 0.875rem or larger.</li>
        <li>Signal colour at most about 10% of any composition.</li>
        <li>A dark “machine” section is allowed for product screenshots and diagrams only.</li>
      </ul>
    </section>
  );
}

function Type({ pairing, pairings, onPairing }: { pairing: Pairing; pairings: Pairing[]; onPairing: (id: string) => void }) {
  return (
    <section>
      <SectionHead n="05" title="Type" kicker={`${pairing.display} · ${pairing.body} · ${pairing.mono}`} />
      <p className="t-body max-w-3xl">{pairing.notes}</p>

      <div className="mt-10 space-y-8">
        <div className="border-t border-rule pt-4">
          <p className="t-mono text-muted mb-3">display-xl · {pairing.display}</p>
          <p className="t-display-xl">Know what to run next.</p>
        </div>
        <div className="border-t border-rule pt-4">
          <p className="t-mono text-muted mb-3">display · {pairing.display}</p>
          <p className="t-display text-4xl md:text-5xl">
            90% of winning ads <span className="text-muted">start as a Yolodex brief.</span>
          </p>
          <p className="t-mono text-muted mt-3">Source · Peachies, Jun–Sep 2026 (target quote)</p>
        </div>
        <div className="grid gap-8 border-t border-rule pt-4 md:grid-cols-2">
          <div>
            <p className="t-mono text-muted mb-3">body · {pairing.body}</p>
            <p className="t-body">
              A creative strategist guesses with taste. Yolodex runs the experiment. It takes every winning ad apart
              frame by frame, isolates which variable drove the result, and turns that into next sprint&apos;s briefs.
              The ads run, the numbers feed straight back in, and the loop closes without anyone working it.
            </p>
          </div>
          <div>
            <p className="t-mono text-muted mb-3">mono · {pairing.mono}</p>
            <pre className="t-mono-lc whitespace-pre-wrap border border-rule bg-surface p-4">
{`HOOK        0:00–0:02  "I nearly sent them back"
FORMAT      UGC testimonial · 9:16
CLAIM       sleep · low sugar
TALENT      founder
RESULT      nCPA £35 vs £35 target
STATUS      WINNER`}
            </pre>
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {pairings.map((p) => {
          const f = FONT_VARS[p.id];
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPairing(p.id)}
              aria-pressed={p.id === pairing.id}
              className="border p-5 text-left"
              style={{ borderColor: p.id === pairing.id ? "var(--ink)" : "var(--rule)", borderWidth: p.id === pairing.id ? 2 : 1 }}
            >
              <span className="block text-3xl leading-none" style={{ fontFamily: `${f.display}, Georgia, serif` }}>
                Creative is the new targeting.
              </span>
              <span className="mt-3 block text-sm" style={{ fontFamily: `${f.body}, system-ui, sans-serif` }}>
                We build the creative briefs that win.
              </span>
              <span className="t-mono text-muted mt-3 block" style={{ fontFamily: `${f.mono}, monospace` }}>
                {p.recommended ? "Recommended · " : ""}
                {p.display} / {p.body} / {p.mono}
              </span>
            </button>
          );
        })}
      </div>

      <table className="t-body mt-10 w-full max-w-3xl text-left text-sm">
        <thead>
          <tr className="t-mono text-muted">
            <th className="border-b border-ink pb-2 font-normal">Token</th>
            <th className="border-b border-ink pb-2 font-normal">Size / line-height / tracking</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(brand.visual.type_scale).map(([k, v]) => (
            <tr key={k}>
              <td className="t-mono-lc border-b border-rule py-2">{k}</td>
              <td className="border-b border-rule py-2">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Device({ heroImage }: { heroImage: string | null }) {
  const d = brand.visual.signature_device;
  return (
    <section>
      <SectionHead n="06" title={d.name} kicker="the signature device" />
      <div className="grid gap-10 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="t-body">{d.description}</p>
          <ul className="t-body mt-6 list-disc space-y-1 pl-5 text-sm">
            {brand.visual.imagery.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <p className="t-mono text-muted mt-6">Never</p>
          <p className="t-body text-muted mt-1 text-sm">{brand.visual.avoid.join(" · ")}</p>
        </div>
        <div className="md:col-span-7">
          {heroImage ? (
            <div className="relative aspect-video w-full border border-rule bg-surface">
              <Image src={heroImage} alt="Annotated ad hero" fill className="object-cover" sizes="(min-width: 768px) 55vw, 100vw" />
            </div>
          ) : (
            <AnnotatedAdDemo />
          )}
        </div>
      </div>
    </section>
  );
}

/** A CSS/SVG mock of the annotated-ad device so the page shows it even before images are generated. */
function AnnotatedAdDemo({ compact = false }: { compact?: boolean }) {
  const labels = [
    "HOOK 0:00–0:02 · “nearly sent it back”",
    "FORMAT · UGC testimonial · 9:16",
    "CLAIM · sleep · low sugar",
    "TALENT · founder",
  ];
  return (
    <figure className="relative aspect-video w-full border border-rule bg-surface">
      <svg viewBox="0 0 100 56" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {/* ad still */}
        <rect x="6" y="5" width="26" height="46" fill="var(--rule)" />
        <rect x="6" y="5" width="26" height="46" className="callout-line" />
        <text x="19" y="29" textAnchor="middle" fontSize="2.4" fill="var(--muted)" fontFamily="var(--font-mono), monospace">
          REAL AD STILL
        </text>
        {/* callouts: anchor on the still, label to the right, evenly spaced */}
        {labels.map((text, i) => {
          const y = 11 + i * 9;
          return (
            <g key={text}>
              <line x1="32" y1={y} x2="40" y2={y} className="callout-line" />
              <circle cx="32" cy={y} r="1" className="callout-dot" />
              <text x="42" y={y + 0.9} fontSize={compact ? 2.2 : 2} fill="var(--ink)" fontFamily="var(--font-mono), monospace" letterSpacing="0.05">
                {text}
              </text>
            </g>
          );
        })}
        {/* winner tag */}
        <rect x="40" y="44" width="52" height="6" fill="var(--signal)" />
        <text x="66" y="48.2" textAnchor="middle" fontSize="2.3" fill="var(--signal-text)" fontFamily="var(--font-mono), monospace" letterSpacing="0.1">
          WINNER · 90% OF WINNING ADS
        </text>
      </svg>
      <figcaption className="t-mono text-muted absolute right-3 bottom-2">device mock · replace with a real annotated ad</figcaption>
    </figure>
  );
}

function MoodBoard({ moodImages }: { moodImages: (typeof prompts.images)[number][] }) {
  return (
    <section>
      <SectionHead n="07" title="Mood board" kicker="visual lines to test" />
      <p className="t-body max-w-3xl">{brand.visual.line}</p>
      {moodImages.length === 0 ? (
        <div className="t-body mt-8 border border-dashed border-rule p-8 text-sm">
          <p>No generated images yet. Run the batch locally and they appear here:</p>
          <pre className="t-mono-lc mt-3 whitespace-pre-wrap">
{`GEMINI_API_KEY=... node --experimental-strip-types scripts/brand/generate-visuals.ts`}
          </pre>
          <p className="t-mono text-muted mt-3">Drop the Yolo Badger reference at public/brand/{BADGER_FILE} first.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {moodImages.map((m) => (
            <figure key={m.id}>
              <div className="relative w-full border border-rule bg-surface" style={{ aspectRatio: aspectCss(m.aspect) }}>
                <Image src={`/brand/${m.file}`} alt={m.id} fill className="object-cover" sizes="(min-width: 768px) 33vw, 100vw" />
              </div>
              <figcaption className="t-mono text-muted mt-2">{m.id}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

function aspectCss(aspect: string): string {
  const [w, h] = aspect.split(":").map(Number);
  return w && h ? `${w} / ${h}` : "1 / 1";
}

function Assets() {
  return (
    <section>
      <SectionHead n="08" title="Assets" kicker="what gets made, in order" />
      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <p className="t-mono text-muted mb-3">Phase 1</p>
          <ul className="t-body space-y-2 text-sm">
            {brand.assets.phase_1.map((a) => (
              <li key={a} className="border-b border-rule pb-2">{a}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="t-mono text-muted mb-3">Phase 2</p>
          <ul className="t-body text-muted space-y-2 text-sm">
            {brand.assets.phase_2.map((a) => (
              <li key={a} className="border-b border-rule pb-2">{a}</li>
            ))}
          </ul>
          <p className="t-mono text-muted mt-8 mb-2">Logo</p>
          <p className="t-body text-sm">{brand.visual.logo.direction}</p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-24">
      <div className="rule-ink" />
      <div className="t-mono text-muted flex flex-wrap gap-x-8 gap-y-2 pt-4">
        <span>Source of truth · docs/brand/brand.json</span>
        <span>Guidelines · docs/brand/yolodex-brand-guidelines.md</span>
        <span>Interview · docs/brand/interview.md</span>
        <span>Images · scripts/brand/generate-visuals.ts</span>
      </div>
    </footer>
  );
}
