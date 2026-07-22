# Ad Library explorer

A small tool that searches Meta's public **Ad Library** (the `ads_archive` Graph API)
and shows who's running ads for a brand, product, or keyword.

- UI: [`/ad-library`](http://localhost:3000/ad-library)
- API: `GET /api/ad-library` (server-side; your token never touches the browser)

## Setup

1. Get an access token from your Meta developer portal
   ([developers.facebook.com](https://developers.facebook.com) → your app):
   - Follow Meta's **Ad Library API** access flow. General (EU/DSA) ad data works
     with a standard **User access token** for your app; the extra
     *political & issue* ad data requires Meta's identity/location confirmation.
   - The quickest token to test with comes from the **Graph API Explorer**
     (pick your app → Generate Access Token). For anything long-lived, exchange
     it for a long-lived user token.
2. Put it in `.env.local` at the repo root:
   ```bash
   META_AD_LIBRARY_TOKEN=your_token_here
   ```
   (`.env*` is gitignored — the token stays local.)
3. `npm run dev`, then open http://localhost:3000/ad-library

## Good to know / limitations

- **Coverage depends on the country you "reach."** Outside the EU, the archive
  only exposes *political & issue* ads. Inside the EU (DE, FR, IE, …), the DSA
  forces full transparency, so you get *all* commercial ads — that's the setting
  to use for competitor research.
- **Spend / impressions / demographics** are only returned for
  `ad_type = POLITICAL_AND_ISSUE_ADS`. Commercial ads return copy, creatives,
  platforms and delivery dates, but not spend.
- Results link to the public Ad Library permalink (`facebook.com/ads/library/?id=…`).
  The token-bearing `ad_snapshot_url` is deliberately dropped server-side so the
  token can't leak to the client.
- This uses a **company** Meta app/token if that's what your portal grants — check
  it's allowed for personal/side-project use before relying on it.

## Query params (`/api/ad-library`)

| param       | default | notes                                                        |
| ----------- | ------- | ------------------------------------------------------------ |
| `q`         | —       | search terms (required unless `pageIds` given)               |
| `pageIds`   | —       | comma-separated Facebook Page IDs                            |
| `countries` | `US`    | comma-separated ISO country codes (reached countries)        |
| `status`    | `ALL`   | `ALL` \| `ACTIVE` \| `INACTIVE`                              |
| `type`      | `ALL`   | `ALL` \| `POLITICAL_AND_ISSUE_ADS`                          |
| `media`     | `ALL`   | `ALL` \| `IMAGE` \| `VIDEO` \| `MEME` \| `NONE`             |
| `limit`     | `24`    | 1–100                                                        |
| `after`     | —       | pagination cursor                                            |
