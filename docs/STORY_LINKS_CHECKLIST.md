# Client story links — manual test checklist

## Wiring
- Slugs: `1715-e-buena-vista`, `1715-e-buena-vista-financial`, `evans-road-webster-land`, `robert-washington-fyan`
- Internal pages: `/notebook/:slug`
- Public page: `/story/:token`
- Story source: `CommandCenter-main/src/lib/stories/types.ts`
- API: Supabase edge function `story-link` (POST mint / DELETE revoke / GET resolve)
- Optional env: `VITE_CLIENT_SHARE_ORIGIN` (absolute origin, no trailing slash)

### Evans Road land (Thompson Brothers)
- Slug: `evans-road-webster-land`
- Internal: `/notebook/evans-road-webster-land`
- Brand: Thompson Brothers Market Research (`/brand/thompson-brothers-market.png`)
- Layout: `land` — comps, FMV range, 1/5/10-yr forecast, non-sale revenue options
- Source listing: Zillow Evans Rd Lot WP001, Marshfield MO 65706 (ZPID 2078063843) — 68.91 ac, last ask $339k (2021), off-market

### Robert Washington Fyan (Thompson family)
- Slug: `robert-washington-fyan`
- Internal: `/notebook/robert-washington-fyan`
- Brand: Thompson Family History (`/stories/robert-w-fyan.jpg`)
- Layout: `portrait` — biography, statewide filled-county maps (48th / 50th–52nd / 53rd), year-by-year elections, VoteView bills, period prices
- Family line: great-great-great-grandfather of Ken, Wally and John Thompson

## Checklist
1. Sign in → open **Buena Vista** in nav (`/notebook/1715-e-buena-vista`).
2. Click **Scroll presentation** → toast “copied”; readonly URL field appears with `{origin}/story/{token}`.
3. Click again → same token returned (idempotent; no second active row).
4. Open the URL in a private window → scroll story loads, no login, no app chrome.
5. Confirm chapters: hero → house → market → comps → offer → risk → call → comps table → range → notebook.
6. Hit `/story/not-a-real-token` → “Link unavailable”.
7. From staff session, `DELETE` via edge function with `?slug=1715-e-buena-vista` (or re-mint after revoke) → old URL 404s; new mint works.
8. Anon REST `GET /rest/v1/story_links` → denied / empty (no table grants).
9. Set `VITE_CLIENT_SHARE_ORIGIN` to a client host and remint → clipboard URL uses that origin.
