import { NextRequest, NextResponse } from "next/server";

// Route Handlers are dynamic by default in Next 16 (not cached). We read query
// params + hit an external API with a secret token, so keep it explicitly dynamic.
export const dynamic = "force-dynamic";

// Meta Graph API — Ad Library ("ads_archive") endpoint.
const GRAPH_VERSION = "v23.0";
const AD_ARCHIVE_URL = `https://graph.facebook.com/${GRAPH_VERSION}/ads_archive`;

// Fields that are valid for every ad_type (commercial + political).
const COMMON_FIELDS = [
  "id",
  "page_id",
  "page_name",
  "ad_creation_time",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_captions",
  "ad_creative_link_descriptions",
  "publisher_platforms",
  "languages",
];

// Only valid (and only populated) when ad_type = POLITICAL_AND_ISSUE_ADS.
const POLITICAL_FIELDS = [
  "currency",
  "spend",
  "impressions",
  "estimated_audience_size",
  "demographic_distribution",
  "bylines",
];

const AD_TYPES = new Set(["ALL", "POLITICAL_AND_ISSUE_ADS"]);
const STATUSES = new Set(["ALL", "ACTIVE", "INACTIVE"]);
const MEDIA_TYPES = new Set(["ALL", "IMAGE", "MEME", "VIDEO", "NONE"]);

function toList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  const token = process.env.META_AD_LIBRARY_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        error:
          "META_AD_LIBRARY_TOKEN is not set. Add it to .env.local — see AD-LIBRARY.md for how to get one.",
      },
      { status: 500 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const search = (sp.get("q") ?? "").trim();
  const pageIds = (sp.get("pageIds") ?? "").trim();
  const countries = (sp.get("countries") || "US").trim();
  const status = (sp.get("status") || "ALL").toUpperCase();
  const adType = (sp.get("type") || "ALL").toUpperCase();
  const media = (sp.get("media") || "ALL").toUpperCase();
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 24, 1), 100);
  const after = sp.get("after") || "";

  if (!search && !pageIds) {
    return NextResponse.json(
      { error: "Provide a search term (q) or one or more page IDs (pageIds)." },
      { status: 400 }
    );
  }
  if (!AD_TYPES.has(adType)) {
    return NextResponse.json({ error: `Unknown ad type: ${adType}` }, { status: 400 });
  }
  if (!STATUSES.has(status)) {
    return NextResponse.json({ error: `Unknown status: ${status}` }, { status: 400 });
  }
  if (!MEDIA_TYPES.has(media)) {
    return NextResponse.json({ error: `Unknown media type: ${media}` }, { status: 400 });
  }

  const fields = [...COMMON_FIELDS];
  if (adType === "POLITICAL_AND_ISSUE_ADS") fields.push(...POLITICAL_FIELDS);

  const params = new URLSearchParams({
    access_token: token,
    ad_reached_countries: JSON.stringify(toList(countries)),
    ad_active_status: status,
    ad_type: adType,
    media_type: media,
    fields: fields.join(","),
    limit: String(limit),
  });
  if (search) params.set("search_terms", search);
  if (pageIds) params.set("search_page_ids", JSON.stringify(toList(pageIds)));
  if (after) params.set("after", after);

  let json: {
    data?: MetaAd[];
    paging?: { cursors?: { after?: string } };
    error?: { message?: string; type?: string; code?: number };
  };
  try {
    const res = await fetch(`${AD_ARCHIVE_URL}?${params.toString()}`, {
      cache: "no-store",
    });
    json = await res.json();

    if (!res.ok || json.error) {
      const message = json?.error?.message || `Meta Graph API returned HTTP ${res.status}.`;
      return NextResponse.json(
        { error: message, code: json?.error?.code ?? null },
        { status: res.status && res.status >= 400 ? res.status : 502 }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach the Meta Graph API.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Never return Meta's ad_snapshot_url — it embeds the access token. Build the
  // public, token-free Ad Library permalink from the ad's archive id instead.
  const ads = (json.data ?? []).map((ad) => ({
    ...ad,
    libraryUrl: `https://www.facebook.com/ads/library/?id=${ad.id}`,
  }));

  return NextResponse.json({
    ads,
    after: json.paging?.cursors?.after ?? null,
  });
}

type MetaAd = {
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
};
