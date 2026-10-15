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

Set the ingest secret (do not commit it) and deploy the function with JWT
verification off so the secret header is the credential:

```bash
supabase secrets set \
  HEALTH_INGEST_SECRET="$(openssl rand -hex 24)" \
  --project-ref esdgrgulaxnewmhjuyzh

# Only if more than one profile exists. This project has a single user,
# and the function uses that profile when HEALTH_USER_ID is unset.
# supabase secrets set HEALTH_USER_ID="<auth.users id>" --project-ref esdgrgulaxnewmhjuyzh

supabase functions deploy health \
  --project-ref esdgrgulaxnewmhjuyzh \
  --no-verify-jwt
```

Pushes to `main` that touch `supabase/functions/**` also deploy `health` via
`.github/workflows/deploy-edge.yml` (same `--no-verify-jwt` flag). The secret
still has to be set once; the workflow does not create it.

`data/health/withings_weight.csv` (columns `Date`, `Weight lb`, `Fat`, `Bone`,
`Muscle`, `Hydration`) was not in the repo when the migration was added. The
2026-10-14 anchor of 175.0 lb is seeded. After the CSV is added:

```bash
node scripts/health-weight-seed.mjs
```

Run the printed SQL against the project. It upserts every other day and leaves
the 175.0 lb anchor in place.

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
