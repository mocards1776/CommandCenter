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

`planCompetitiveSend` prefers `body.just_in` (`parseJustInPayload`) and skips
`fetchBuysByIds` for Just In when `just_in` is present. Race / DMA pies /
affiliation totals still come from live Almanac `competitive_buys` for the
`race_slug` (or from payload `buyers` / `totals` if Almanac keys are unset).

### Revision example (MSCC Nexstar)

Row was $11,150 / ~87 GRP and is now $17,600 / 134 GRP. Just In must show
**+$6,450 / ~47 GRP**, not $17.6k / 134 GRP:

```json
{
  "action": "send",
  "race_slug": "mo-sd30",
  "buy_ids": ["<revised-buy-id>"],
  "just_in": [{
    "sponsor": "MSCC",
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

GOP PAC and **any MSCC** tile / buyer bar use the **red family** (candidate
`#FF3B30`, PAC `#FF6B63`). Do not use indigo `#5E5CE6`.

On revision `just_in` without `color`, Almanac should pass `side: "gop"` (or
`affiliation` / an MSCC `sponsor`) **or** an explicit red `color`. The edge
function infers from those fields; it must never default a GOP tile to Dem
blue `#0A84FF`.

## Local tests

```bash
node --experimental-strip-types supabase/functions/competitive-telegram/competitive-telegram.test.ts
```
