// Live tennis-court availability near E5 8HE (Lower Clapton, Hackney).
//
// Data source: ClubSpark (the LTA's booking platform), which powers every
// Hackney Tennis park court plus nearby Victoria Park. Each venue exposes a
// public, auth-free JSON endpoint used by its own booking grid:
//
//   GET https://clubspark.lta.org.uk/v0/VenueBooking/{slug}/GetVenueSessions
//         ?resourceID=&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&roleId=
//
// It returns, per court ("Resource") and per day, a list of "Sessions". Times
// are integer minutes-from-midnight in Europe/London. An open, bookable slot
// has Category === 0 with a Capacity > 0 and a cost; booked / closed periods
// come back as separate sessions (Capacity 0, or named "Booking"/"Closed",
// or a non-zero Category). We surface only slots that are still bookable AND
// start after 8pm or fall on a weekend.

export type RawSession = {
  ID?: string;
  Category?: number;
  SubCategory?: number;
  Name?: string | null;
  StartTime?: number; // minutes from midnight (Europe/London)
  EndTime?: number; // minutes from midnight
  Interval?: number; // booking granularity in minutes
  Capacity?: number; // 0 => full / already booked
  Cost?: number;
  CostFrom?: number;
  GuestPrice?: number;
  CourtCost?: number;
  MemberPrice?: number;
};

export type RawDay = { Date?: string; Sessions?: RawSession[] };
export type RawResource = { ID?: string; Name?: string; Number?: number; Days?: RawDay[] };
export type VenueSessionsResponse = {
  TimeZone?: string;
  MinimumInterval?: number;
  Resources?: RawResource[];
};

export type Venue = {
  slug: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
};

export type Slot = {
  venueSlug: string;
  venueName: string;
  area: string;
  distanceMiles: number;
  date: string; // YYYY-MM-DD (Europe/London)
  weekday: string; // e.g. "Sat"
  dayLabel: string; // e.g. "Sat 26 Jul"
  startMin: number;
  endMin: number;
  start: string; // e.g. "8:00 pm"
  end: string; // e.g. "9:00 pm"
  durationMins: number;
  court: string; // court / resource name
  cost: number | null; // £ per booking (0 = free), null = unknown
  isEvening: boolean;
  isWeekend: boolean;
  bookUrl: string;
  sortKey: number; // for chronological ordering
};

export type VenueResult = {
  slug: string;
  name: string;
  area: string;
  distanceMiles: number;
  bookingUrl: string;
  ok: boolean;
  error: string | null;
  slotCount: number;
  nextSlot: Slot | null;
  slots: Slot[];
};

export type AvailabilityResult = {
  origin: typeof ORIGIN;
  generatedAt: string;
  timezone: "Europe/London";
  query: { days: number; eveningFromHour: number; mode: FilterMode };
  counts: { totalSlots: number; venuesOk: number; venuesFailed: number };
  soonest: Slot[];
  venues: VenueResult[];
};

export type FilterMode = "both" | "evening" | "weekend";

const BASE = "https://clubspark.lta.org.uk";

// The task's reference point: E5 8HE, Lower Clapton.
export const ORIGIN = {
  postcode: "E5 8HE",
  label: "Lower Clapton, Hackney",
  lat: 51.5514,
  lng: -0.0533,
} as const;

// Bookable public courts near E5 8HE, all on ClubSpark. Coordinates are the
// court locations (not park centroids), used only to rank venues by distance.
export const VENUES: Venue[] = [
  { slug: "MillfieldsParkMiddlesex", name: "Millfields Park", area: "Lower Clapton · E5", lat: 51.5556, lng: -0.0433 },
  { slug: "HackneyDowns", name: "Hackney Downs", area: "Hackney Downs · E5", lat: 51.5524, lng: -0.0619 },
  { slug: "SpringHillParkTennis", name: "Spring Hill Rec Ground", area: "Upper Clapton · E5", lat: 51.5640, lng: -0.0490 },
  { slug: "ClissoldParkHackney", name: "Clissold Park", area: "Stoke Newington · N16", lat: 51.5610, lng: -0.0855 },
  { slug: "LondonFieldsPark", name: "London Fields", area: "London Fields · E8", lat: 51.5406, lng: -0.0623 },
  { slug: "VictoriaParkLONDON", name: "Victoria Park", area: "Victoria Park · E9", lat: 51.5385, lng: -0.0430 },
  { slug: "AskeGardens", name: "Joe White Gardens", area: "Hoxton · N1", lat: 51.5316, lng: -0.0806 },
];

// ---------------------------------------------------------------------------
// Geo + time helpers
// ---------------------------------------------------------------------------

export function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.7613; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.min(1, Math.sqrt(s)));
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A "YYYY-MM-DD" plain date -> weekday index (0=Sun). Anchored at UTC noon so
// no timezone can shift it across a day boundary.
function weekdayIndex(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function isWeekendDate(date: string): boolean {
  const d = weekdayIndex(date);
  return d === 0 || d === 6;
}

function dayLabel(date: string): string {
  const dt = new Date(`${date}T12:00:00Z`);
  return `${DOW[dt.getUTCDay()]} ${dt.getUTCDate()} ${MON[dt.getUTCMonth()]}`;
}

export function minutesTo12h(min: number): string {
  const h24 = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ampm = h24 >= 12 ? "pm" : "am";
  const h12 = ((h24 + 11) % 12) + 1;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Current wall-clock in Europe/London, as a plain date + minutes-from-midnight.
export function londonNow(now: Date = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some environments emit "24" at midnight
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + parseInt(get("minute"), 10),
  };
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function bookingUrl(slug: string, date?: string): string {
  const anchor = date ? `#?date=${date}&role=guest` : "";
  return `${BASE}/${slug}/Booking/BookByDate${anchor}`;
}

// ---------------------------------------------------------------------------
// Session parsing
// ---------------------------------------------------------------------------

const BLOCK_NAME = /(book|reserv|closed|unavail|maintenance|block|coaching|lesson|event)/i;

// A session that occupies court time and is therefore NOT bookable.
function isBlock(s: RawSession): boolean {
  if ((s.Category ?? 0) !== 0) return true;
  if (typeof s.Capacity === "number" && s.Capacity <= 0) return true;
  if (s.Name && BLOCK_NAME.test(s.Name)) return true;
  return false;
}

function sessionCost(s: RawSession): number | null {
  const candidates = [s.Cost, s.CostFrom, s.GuestPrice, s.CourtCost, s.MemberPrice];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return c;
  }
  return null;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// Expand a venue's raw response into concrete bookable [start,end] slots.
export function extractBookableSlots(
  data: VenueSessionsResponse,
  venue: Venue,
  distanceMiles: number,
): Slot[] {
  const minInterval = data.MinimumInterval && data.MinimumInterval > 0 ? data.MinimumInterval : 60;
  const slots: Slot[] = [];

  for (const resource of data.Resources ?? []) {
    const court = resource.Name?.trim() || `Court ${resource.Number ?? ""}`.trim() || "Court";
    for (const day of resource.Days ?? []) {
      const date = day.Date ? String(day.Date).slice(0, 10) : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const sessions = day.Sessions ?? [];
      const blocks = sessions.filter(isBlock).map((b) => [b.StartTime ?? 0, b.EndTime ?? 0] as const);
      const weekend = isWeekendDate(date);

      for (const s of sessions) {
        if (isBlock(s)) continue;
        const start = s.StartTime;
        const end = s.EndTime;
        if (typeof start !== "number" || typeof end !== "number" || end <= start) continue;

        const interval = s.Interval && s.Interval > 0 ? s.Interval : minInterval;
        const duration = end - start;

        // Normal case: each session already IS one bookable unit. Only split
        // genuinely long "open windows" into interval-sized slots, subtracting
        // any booked blocks that fall inside them.
        const pieces: Array<[number, number]> =
          duration > 75
            ? Array.from({ length: Math.floor(duration / interval) }, (_, i) => {
                const t = start + i * interval;
                return [t, t + interval] as [number, number];
              })
            : [[start, end]];

        const cost = sessionCost(s);
        for (const [ps, pe] of pieces) {
          if (pe > end) continue;
          if (blocks.some(([bs, be]) => overlaps(ps, pe, bs, be))) continue;
          slots.push({
            venueSlug: venue.slug,
            venueName: venue.name,
            area: venue.area,
            distanceMiles,
            date,
            weekday: DOW[weekdayIndex(date)],
            dayLabel: dayLabel(date),
            startMin: ps,
            endMin: pe,
            start: minutesTo12h(ps),
            end: minutesTo12h(pe),
            durationMins: pe - ps,
            court,
            cost,
            isEvening: ps >= 20 * 60,
            isWeekend: weekend,
            bookUrl: bookingUrl(venue.slug, date),
            sortKey: Number(date.replace(/-/g, "")) * 10000 + ps,
          });
        }
      }
    }
  }
  return slots;
}

// ---------------------------------------------------------------------------
// Fetch + orchestration
// ---------------------------------------------------------------------------

async function fetchVenueSessions(
  slug: string,
  startDate: string,
  endDate: string,
  signal?: AbortSignal,
): Promise<VenueSessionsResponse> {
  const url = `${BASE}/v0/VenueBooking/${slug}/GetVenueSessions?resourceID=&startDate=${startDate}&endDate=${endDate}&roleId=`;
  const res = await fetch(url, {
    signal,
    cache: "no-store",
    headers: {
      Accept: "application/json, text/plain, */*",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Referer: `${BASE}/${slug}/Booking/BookByDate`,
    },
  });
  if (!res.ok) throw new Error(`ClubSpark responded ${res.status}`);
  return (await res.json()) as VenueSessionsResponse;
}

function keep(slot: Slot, mode: FilterMode, eveningFromMin: number): boolean {
  const evening = slot.startMin >= eveningFromMin;
  const weekend = slot.isWeekend;
  if (mode === "evening") return evening;
  if (mode === "weekend") return weekend;
  return evening || weekend;
}

export type GetAvailabilityOptions = {
  days?: number; // how far ahead to look
  eveningFromHour?: number; // "after Xpm" threshold (24h). Default 20 (8pm)
  mode?: FilterMode; // both | evening | weekend
  perVenueLimit?: number; // cap slots returned per venue
  soonestLimit?: number; // cap the cross-venue "soonest" list
  timeoutMs?: number;
  now?: Date;
};

export async function getAvailability(opts: GetAvailabilityOptions = {}): Promise<AvailabilityResult> {
  const days = clampInt(opts.days ?? 14, 1, 28);
  const eveningFromHour = clampInt(opts.eveningFromHour ?? 20, 0, 23);
  const mode: FilterMode = opts.mode ?? "both";
  const perVenueLimit = clampInt(opts.perVenueLimit ?? 40, 1, 500);
  const soonestLimit = clampInt(opts.soonestLimit ?? 30, 1, 200);
  const timeoutMs = clampInt(opts.timeoutMs ?? 12000, 1000, 30000);
  const eveningFromMin = eveningFromHour * 60;

  const now = opts.now ?? new Date();
  const today = londonNow(now);
  const startDate = today.date;
  const endDate = addDays(startDate, days - 1);

  const venuesWithDistance = VENUES.map((v) => ({
    venue: v,
    distance: haversineMiles(ORIGIN.lat, ORIGIN.lng, v.lat, v.lng),
  })).sort((a, b) => a.distance - b.distance);

  const results = await Promise.all(
    venuesWithDistance.map(async ({ venue, distance }): Promise<VenueResult> => {
      const distanceMiles = Math.round(distance * 10) / 10;
      const base: Omit<VenueResult, "ok" | "error" | "slotCount" | "nextSlot" | "slots"> = {
        slug: venue.slug,
        name: venue.name,
        area: venue.area,
        distanceMiles,
        bookingUrl: bookingUrl(venue.slug),
      };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const data = await fetchVenueSessions(venue.slug, startDate, endDate, controller.signal);
        const all = extractBookableSlots(data, venue, distanceMiles)
          .filter((s) => isFuture(s, today))
          .filter((s) => keep(s, mode, eveningFromMin))
          .sort((a, b) => a.sortKey - b.sortKey);
        return {
          ...base,
          ok: true,
          error: null,
          slotCount: all.length,
          nextSlot: all[0] ?? null,
          slots: all.slice(0, perVenueLimit),
        };
      } catch (err) {
        const message =
          err instanceof Error && err.name === "AbortError"
            ? "Timed out contacting ClubSpark"
            : err instanceof Error
              ? err.message
              : "Unknown error";
        return { ...base, ok: false, error: message, slotCount: 0, nextSlot: null, slots: [] };
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  const soonest = results
    .flatMap((r) => r.slots)
    .sort((a, b) => a.sortKey - b.sortKey || a.distanceMiles - b.distanceMiles)
    .slice(0, soonestLimit);

  return {
    origin: ORIGIN,
    generatedAt: now.toISOString(),
    timezone: "Europe/London",
    query: { days, eveningFromHour, mode },
    counts: {
      totalSlots: results.reduce((n, r) => n + r.slotCount, 0),
      venuesOk: results.filter((r) => r.ok).length,
      venuesFailed: results.filter((r) => !r.ok).length,
    },
    soonest,
    venues: results,
  };
}

function isFuture(slot: Slot, today: { date: string; minutes: number }): boolean {
  if (slot.date > today.date) return true;
  if (slot.date < today.date) return false;
  return slot.startMin > today.minutes;
}

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.trunc(n)));
}
