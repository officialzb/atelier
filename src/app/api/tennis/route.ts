import { NextResponse } from "next/server";
import { getAvailability, type FilterMode } from "@/lib/tennis";

// Live data: never cache. ClubSpark is queried on every request.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const days = numParam(searchParams.get("days"), 14);
  const after = numParam(searchParams.get("after"), 20); // "after Xpm" (24h hour)
  const modeParam = searchParams.get("mode");
  const mode: FilterMode =
    modeParam === "evening" || modeParam === "weekend" ? modeParam : "both";

  try {
    const data = await getAvailability({ days, eveningFromHour: after, mode });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load availability";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function numParam(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
