# Health write API

Another bot can append food log entries and weigh-ins. The Health app
(`/health`) reads the same tables with the signed-in user's session.

Base URL:

```text
https://esdgrgulaxnewmhjuyzh.supabase.co/functions/v1/health
```

## One-time setup

Apply the migration (tables, RLS, saved foods, the 2026-10-14 food log, and
the 175.0 lb weigh-in):

```bash
supabase db push --project-ref esdgrgulaxnewmhjuyzh
```

Or run `supabase/migrations/20261015_health.sql` in the SQL editor for project
`esdgrgulaxnewmhjuyzh`. The statements are idempotent.

Deploy the function with JWT verification off so the secret header is the
credential:

```bash
supabase functions deploy health \
  --project-ref esdgrgulaxnewmhjuyzh \
  --no-verify-jwt
```

Pushes to `main` that touch `supabase/functions/**` also deploy `health` via
`.github/workflows/deploy-edge.yml` (same `--no-verify-jwt` flag).

The function accepts `x-health-secret` when it matches, in order:

1. The platform secret `HEALTH_INGEST_SECRET`, if it is set.
2. Otherwise the `ingest_secret` row in `public.health_config`.

Comparison is constant-time (`secretsMatch` in `supabase/functions/health/ingest.ts`).
An empty secret never matches. A bearer token equal to the service role key
is also accepted; do not give that key to the other bot.

`health_config` has RLS enabled and no policies. `anon` and `authenticated`
have no grants. Only `service_role` may `select`, and the function reads the
row with that role. Do not commit the secret.

Platform secret, when you can set one:

```bash
supabase secrets set \
  HEALTH_INGEST_SECRET="$(openssl rand -hex 24)" \
  --project-ref esdgrgulaxnewmhjuyzh
```

Table fallback (the value is not in git):

```sql
insert into public.health_config (key, value)
values ('ingest_secret', '<secret>')
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();
```

`HEALTH_USER_ID` is optional. This project has a single profile, and the
function uses it when that secret is unset. The `ingest_secret` row is
already loaded on `esdgrgulaxnewmhjuyzh`; the value lives only in that row
and in the bot store, not in this repo.

`data/health/withings_weight.csv` is the Withings export (`Date`, `Weight (lb)`,
`Fat mass (lb)`, `Bone mass (lb)`, `Muscle mass (lb)`, `Hydration (lb)`).
Date cells include a time. The table keeps one row per Chicago calendar day,
and the latest stamp on a day wins. The 2026-10-14 anchor of 175.0 lb is not
in that file and is left as seeded by the migration.

```bash
node scripts/health-weight-seed.mjs
```

Run the printed SQL against the project to reload those days. That SQL was
applied to `esdgrgulaxnewmhjuyzh` on 2026-10-15: 663 calendar days from the
CSV, plus the 175.0 lb anchor, for 664 `health_weights` rows.

## Request

`POST` JSON. The gateway still expects the project anon key. The authorization
that matters is `x-health-secret`.

| Header | Value |
| --- | --- |
| `Content-Type` | `application/json` |
| `apikey` | Supabase anon (publishable) key |
| `Authorization` | `Bearer <same anon key>` |
| `x-health-secret` | `HEALTH_INGEST_SECRET` |

A bearer token equal to the service role key is also accepted. Do not put that
key in the other bot.

Times without a zone are America/Chicago. `logged_at` may be a full ISO
timestamp; `log_date` is the Chicago calendar day of that instant. A weigh-in
on a day that already exists is updated. A food row with `source_key` (or
`id`) upserts on that key. Omit the key to insert a new row every time.

### One food entry

```bash
curl -sS -X POST \
  'https://esdgrgulaxnewmhjuyzh.supabase.co/functions/v1/health' \
  -H 'Content-Type: application/json' \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "x-health-secret: $HEALTH_INGEST_SECRET" \
  -d '{
    "type": "food",
    "date": "2026-10-14",
    "time": "08:49",
    "item": "crackers",
    "kcal": 200,
    "protein_g": 4,
    "source_key": "bot-2026-10-14-0849-crackers"
  }'
```

`logged_at` can replace `date` and `time`:

```json
{
  "type": "food",
  "logged_at": "2026-10-14T13:50:00-05:00",
  "item": "crackers",
  "kcal": 200,
  "protein_g": 4
}
```

`name`, `calories`, and `protein` are accepted aliases.

### One weigh-in

```bash
curl -sS -X POST \
  'https://esdgrgulaxnewmhjuyzh.supabase.co/functions/v1/health' \
  -H 'Content-Type: application/json' \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "x-health-secret: $HEALTH_INGEST_SECRET" \
  -d '{
    "type": "weight",
    "weighed_on": "2026-10-15",
    "weight_lb": 174.6,
    "fat": 40.1,
    "bone": 8.2,
    "muscle": 120.4,
    "hydration": 55
  }'
```

`date` and `weight` are accepted aliases. Composition fields are optional.

### Batch

```bash
curl -sS -X POST \
  'https://esdgrgulaxnewmhjuyzh.supabase.co/functions/v1/health' \
  -H 'Content-Type: application/json' \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "x-health-secret: $HEALTH_INGEST_SECRET" \
  -d '{
    "foods": [
      {
        "logged_at": "2026-10-15T12:30:00-05:00",
        "item": "Oikos Salted Caramel shake",
        "kcal": 170,
        "protein_g": 30
      }
    ],
    "weights": [
      { "weighed_on": "2026-10-15", "weight_lb": 174.6 }
    ]
  }'
```

Success:

```json
{ "ok": true, "user_id": "<profile id>", "foods": [], "weights": [] }
```

`401` means the secret header (and service-role bearer) did not match.
`400` means the JSON shape was rejected. `500` means the write failed.
