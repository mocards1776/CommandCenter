# Health write API

Another bot can append food log entries, weigh-ins, and exercise sets. The Health app
(`/health`) reads the same tables with the signed-in user's session.

Base URL:

```text
https://esdgrgulaxnewmhjuyzh.supabase.co/functions/v1/health
```

## One-time setup

Apply the migrations (tables, RLS, saved foods, the 2026-10-14 food log, the
175.0 lb weigh-in, and `20261016_health_exercise_log.sql` for exercise):

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

### One exercise set

```bash
curl -sS -X POST \
  'https://esdgrgulaxnewmhjuyzh.supabase.co/functions/v1/health' \
  -H 'Content-Type: application/json' \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "x-health-secret: $HEALTH_INGEST_SECRET" \
  -d '{
    "type": "exercise",
    "date": "2026-10-16",
    "time": "07:30",
    "exercise": "Bench Press",
    "sets": 3,
    "reps": 10,
    "weight_lb": 135,
    "duration_min": 12,
    "kcal_burned": 90,
    "note": "felt strong"
  }'
```

| Field | Required | Notes |
| --- | --- | --- |
| `type` | yes | `"exercise"` (`"workout"` is an alias) |
| `exercise` | yes | Name, up to 120 characters. `name` is an alias. |
| `date` | yes, unless `logged_at` | `YYYY-MM-DD`, America/Chicago |
| `time` | no | `HH:MM` or `HH:MM:SS`, America/Chicago. Defaults to `12:00`. |
| `logged_at` | no | Full ISO timestamp. Replaces `date` and `time`; stored as the Chicago day and wall time of that instant. |
| `sets` | no | Whole number, 1 or more. A row with no `sets` counts as one set on the page. |
| `reps` | no | Whole number, 0 or more |
| `weight_lb` | no | 0 to 5000. Use `0` or omit for bodyweight. `weight` is an alias. |
| `duration_min` | no | Minutes, 0 to 1440. `duration` is an alias. |
| `kcal_burned` | no | 0 to 20000. `kcal` and `calories` are aliases. Net calories on `/health` subtract half of this. |
| `note` | no | Up to 500 characters |

Omitted optional fields are stored as null. The row key is
`(date, time, exercise)`: posting the same date, time, and exercise again
updates that row instead of adding another, so a retry is safe. To log several
sets of one exercise, give each its own `time` (the 2022-2026 import has one
row per set, `sets` = 1), or use one row with `sets` > 1.

`kcal_burned` is optional because most history has no burn estimate. A day with
no `kcal_burned` shows net calories equal to food kcal.

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
    ],
    "exercises": [
      { "date": "2026-10-15", "time": "07:30", "exercise": "Push-Up", "reps": 25 }
    ]
  }'
```

Success:

```json
{ "ok": true, "user_id": "<profile id>", "foods": [], "weights": [], "exercises": [] }
```

`401` means the secret header (and service-role bearer) did not match.
Each array holds the rows that were written. At most 200 rows (food, weights,
and exercises together) per post.

`400` means the JSON shape was rejected. `500` means the write failed.

## Exercise history import

`data/health/exercise_log.csv` is the workout-app export (`Exercise`, `Date`,
`Repetitions`, `Weight (lb)`, `Weight (kg)`, `Duration (seconds)`,
`Duration (formatted)`, `Note`, `Label`): 95 sets of Bench Press, Push-Up,
Dumbbell Curls, and Pull-Up from 2022-10-04 to 2026-06-11. Each CSV row is one
set (`sets` = 1). The `Date` cell has no zone and is read as America/Chicago
wall clock. The kg column is ignored.

```bash
node scripts/health-exercise-seed.mjs > /tmp/exercise_seed.sql
```

Run the printed SQL against the project. It inserts with
`on conflict (user_id, date, time, exercise) do nothing`, so running it again
adds no rows. Applied to `esdgrgulaxnewmhjuyzh` on 2026-10-16: 95 rows.
