# Competitive Telegram — Almanac send contract

Almanac fires **once per finished load batch**, never per row and never from a
`competitive_buys` INSERT trigger:

```http
POST /functions/v1/competitive-telegram
```

`buy_ids` are always required for a send. Empty `buy_ids` → skip (200).

## Just In amounts

| Load kind | Payload | Just In numbers |
| --- | --- | --- |
| **Insert** (true new rows) | `{ action: "send", race_slug, buy_ids }` only | Full new row spend + GRP via `rowsToJustIn` |
| **Revision** (increase on an existing buy) | Same `buy_ids`, **plus** `just_in` | **Delta only** — the spend/GRP *increase*, never the full revised totals |
| **Daily recap** (6:04pm CT, today's inserts) | Same `buy_ids`, **plus** `recap: true` | Full row spend + GRP (same as insert) |

`planCompetitiveSend` prefers `body.just_in` (`parseJustInPayload`) and skips
`fetchBuysByIds` for Just In when `just_in` is present. Race / DMA pies /
affiliation totals still come from live Almanac `competitive_buys` for the
`race_slug` (or from payload `buyers` / `totals` if Almanac keys are unset).

### Edited-buy guard

Almanac `competitive_buys` has `created_at` and `updated_at`. When `just_in`
is omitted, the send fetches those rows and **refuses with 409** if any row's
`updated_at` is more than **5 minutes** after `created_at`. The error names
the edited `buy_ids` and tells the caller to pass the change amounts in
`just_in`. That is how a hand-fired revision (no `just_in`) fails loudly
instead of posting the revised row's full totals.

A same-load insert that is patched within that 5-minute window still counts
as new (full amounts). Rows with no timestamps cannot be classified and are
treated as inserts.

The 6:04pm CT recap re-sends today's inserts as `buy_ids` only. Those rows
may get `source_label` (or similar) hours later, which bumps `updated_at`.
Pass `"recap": true` to skip the guard. Do not use `recap` on a real
spend/GRP revision — that path still needs `just_in` deltas.

### Revision example (MSCC Nexstar)

Row was $11,150 / ~87 GRP and is now $17,600 / 134 GRP. Just In must show
**+$6,450 / ~47 GRP**, not $17.6k / 134 GRP:

```json
{
  "action": "send",
  "race_slug": "mo-sd30",
  "buy_ids": ["<revised-buy-id>"],
  "just_in": [{
    "sponsor": "Missouri Senate Campaign Committee",
    "amount": 6450,
    "grp": 47,
    "market": "Springfield",
    "media": "TV",
    "station": "Springfield DMA",
    "side": "gop"
  }]
}
```

### DMA tiles

Same `sponsor|market|media` across stations collapses to one tile labeled
`{market} DMA`. Almanac may send that already aggregated as a single `just_in`
tile (`station: "Springfield DMA"`). Inserts without `just_in` still aggregate
the same way from fetched rows.

## Colors

GOP PAC and **any Missouri Senate Campaign Committee (MSCC)** tile / buyer bar
use the **red family** (candidate `#FF3B30`, PAC `#FF6B63`). Do not use indigo
`#5E5CE6`.

On revision `just_in` without `color`, Almanac should pass `side: "gop"` (or
`affiliation` / an MSCC `sponsor`) **or** an explicit red `color`. The edge
function infers from those fields; it must never default a GOP tile to Dem
blue `#0A84FF`.

## Sponsor names

Race tiles, Just In PAC labels, footer labels, and the caption use **full PAC
names**. Prefer Almanac `sponsors.name`. Short payload labels map up:

| Short | Card / caption |
| --- | --- |
| SDCC | Senate Democratic Campaign Committee |
| Alliance | Missouri Alliance PAC |
| WOTP | Will of the People PAC |
| MSCC | Missouri Senate Campaign Committee |
| Forward | Forward PAC |
| Legio | Legio XIII PAC |

Candidates stay last names on race tiles and caption sponsor lines (Ingle,
Patterson, Fogle, Stinnett). Just In candidate tiles keep first + last
(`Keri Ingle`, `Betsy Fogle`) so that line is unchanged except for PAC names.
Long PAC names wrap to two lines or step the font down — no ellipsis.

## Caption: this week vs race to date

Almanac weeks run **Tuesday–Monday**. The card header date is that Tuesday
(week of Oct 6, 2026 → Mon Oct 12). Caption sponsor lines are **this week
only**, labeled `This week (Oct 6–12):`. Each buy's spend and GRP are split
across weeks with Almanac's flight-weighting helper (`week.ts`, same 18%
weekday / 5% weekend shares as `thompsonalmanac` `flight-weighting-shared.ts`).
Sponsors with $0 this week are omitted.

The last line is race-to-date Dem / GOP / race spend plus DMA GRP, labeled
`Race to date`. Image race tiles and pies stay race-to-date; only the names
change.

## Local tests

```bash
node --experimental-strip-types supabase/functions/competitive-telegram/competitive-telegram.test.ts
```

Preview (does not deploy):

```bash
cd scripts && npm install
node --experimental-strip-types competitive-telegram-photo.ts --slug mo-sd8 --out ../supabase/functions/competitive-telegram/previews/sample-sd8.jpg
```
