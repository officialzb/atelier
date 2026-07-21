// Unit tests for the pure parsing/geo/time logic in src/lib/tennis.ts.
// Run: node --experimental-strip-types scripts/test-tennis.mts
// (No network — validates the ClubSpark session parsing the sandbox can't hit live.)

import {
  extractBookableSlots,
  haversineMiles,
  minutesTo12h,
  isWeekendDate,
  londonNow,
  addDays,
  VENUES,
  ORIGIN,
  type VenueSessionsResponse,
  type Venue,
} from "../src/lib/tennis.ts";

let passed = 0;
let failed = 0;
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, extra ?? "");
  }
}

const millfields: Venue = VENUES.find((v) => v.slug === "MillfieldsParkMiddlesex")!;

console.log("time helpers");
ok('minutesTo12h(1200) === "8 pm"', minutesTo12h(1200) === "8 pm", minutesTo12h(1200));
ok('minutesTo12h(1230) === "8:30 pm"', minutesTo12h(1230) === "8:30 pm", minutesTo12h(1230));
ok('minutesTo12h(0) === "12 am"', minutesTo12h(0) === "12 am", minutesTo12h(0));
ok('minutesTo12h(720) === "12 pm"', minutesTo12h(720) === "12 pm", minutesTo12h(720));

console.log("calendar helpers");
ok("2026-07-25 is a weekend (Sat)", isWeekendDate("2026-07-25"));
ok("2026-07-26 is a weekend (Sun)", isWeekendDate("2026-07-26"));
ok("2026-07-21 is NOT a weekend (Tue)", !isWeekendDate("2026-07-21"));
ok("addDays('2026-07-21', 13) === '2026-08-03'", addDays("2026-07-21", 13) === "2026-08-03", addDays("2026-07-21", 13));

console.log("geo");
const dMill = haversineMiles(ORIGIN.lat, ORIGIN.lng, millfields.lat, millfields.lng);
ok("Millfields is within ~1mi of E5 8HE", dMill > 0.2 && dMill < 1.0, dMill.toFixed(2));

console.log("session parsing — pre-split hourly court (weekday)");
// Tuesday 2026-07-21: 19:00 open (too early), 20:00 open (evening), 21:00 booked (Capacity 0)
const preSplit: VenueSessionsResponse = {
  MinimumInterval: 60,
  Resources: [
    {
      Name: "Court 1",
      Number: 1,
      Days: [
        {
          Date: "2026-07-21",
          Sessions: [
            { Category: 0, Name: "", StartTime: 1140, EndTime: 1200, Interval: 60, Capacity: 1, Cost: 0 }, // 19:00
            { Category: 0, Name: "", StartTime: 1200, EndTime: 1260, Interval: 60, Capacity: 1, Cost: 8.5 }, // 20:00
            { Category: 0, Name: "Booking", StartTime: 1260, EndTime: 1320, Interval: 60, Capacity: 0 }, // 21:00 booked
          ],
        },
      ],
    },
  ],
};
const slots1 = extractBookableSlots(preSplit, millfields, dMill);
ok("produces 2 bookable slots (19:00 + 20:00), booked 21:00 excluded", slots1.length === 2, slots1.map((s) => s.start));
const s20 = slots1.find((s) => s.startMin === 1200);
ok("20:00 slot is flagged evening", !!s20 && s20.isEvening === true);
ok("20:00 slot cost parsed (£8.50)", !!s20 && s20.cost === 8.5, s20?.cost);
ok("19:00 slot is NOT evening", !!slots1.find((s) => s.startMin === 1140 && !s.isEvening));
ok("no slot came from the booked 21:00 session", !slots1.find((s) => s.startMin === 1260));

console.log("session parsing — big open window with a mid-day block (weekend)");
// Saturday 2026-07-25: open 08:00–21:00, but 12:00–13:00 blocked by a non-zero Category.
const bigWindow: VenueSessionsResponse = {
  MinimumInterval: 60,
  Resources: [
    {
      Name: "Court 2",
      Number: 2,
      Days: [
        {
          Date: "2026-07-25",
          Sessions: [
            { Category: 0, Name: "Pay & Play", StartTime: 480, EndTime: 1260, Interval: 60, Capacity: 1, CostFrom: 0 },
            { Category: 2, Name: "Reserved", StartTime: 720, EndTime: 780, Capacity: 0 }, // 12:00–13:00 block
          ],
        },
      ],
    },
  ],
};
const slots2 = extractBookableSlots(bigWindow, millfields, dMill);
ok("splits 08:00–21:00 into 13 hourly slots minus 1 block = 12", slots2.length === 12, slots2.length);
ok("12:00 slot removed by block subtraction", !slots2.find((s) => s.startMin === 720), slots2.find((s) => s.startMin === 720));
ok("all weekend slots flagged isWeekend", slots2.every((s) => s.isWeekend === true));
ok("free slots show cost 0 (not null)", slots2.every((s) => s.cost === 0));

console.log("session parsing — coaching/closed names are treated as blocks");
const named: VenueSessionsResponse = {
  MinimumInterval: 60,
  Resources: [
    {
      Name: "Court 3",
      Days: [
        {
          Date: "2026-07-25",
          Sessions: [
            { Category: 0, Name: "Coaching", StartTime: 600, EndTime: 660, Capacity: 1, Cost: 0 },
            { Category: 0, Name: "Closed", StartTime: 660, EndTime: 720, Capacity: 1, Cost: 0 },
            { Category: 0, Name: "", StartTime: 1080, EndTime: 1140, Capacity: 1, Cost: 6 }, // 18:00 open
          ],
        },
      ],
    },
  ],
};
const slots3 = extractBookableSlots(named, millfields, dMill);
ok("only the un-named open 18:00 slot survives", slots3.length === 1 && slots3[0].startMin === 1080, slots3.map((s) => `${s.start}/${s.court}`));

console.log("londonNow returns a plausible shape");
const ln = londonNow(new Date("2026-07-21T10:00:00Z"));
ok("BST: 10:00Z -> 11:00 London, date 2026-07-21", ln.date === "2026-07-21" && ln.minutes === 11 * 60, ln);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
