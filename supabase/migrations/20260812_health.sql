-- Health page: calorie log, daily goals, synced metrics, OAuth connections.
-- Applied remotely as migration `health` on project esdgrgulaxnewmhjuyzh.

-- Per-user calorie / health preferences.
CREATE TABLE IF NOT EXISTS public.health_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_calorie_goal integer NOT NULL DEFAULT 2000
    CHECK (daily_calorie_goal > 0 AND daily_calorie_goal <= 20000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER health_settings_touch_updated_at
  BEFORE UPDATE ON public.health_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.health_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY health_settings_select_own ON public.health_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY health_settings_insert_own ON public.health_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY health_settings_update_own ON public.health_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY health_settings_delete_own ON public.health_settings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Manual + imported food log.
CREATE TABLE IF NOT EXISTS public.calorie_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_date date NOT NULL,
  meal_type text NOT NULL DEFAULT 'snack'
    CHECK (meal_type = ANY (ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'snack'::text])),
  name text NOT NULL,
  calories integer NOT NULL CHECK (calories >= 0 AND calories <= 20000),
  protein_g numeric(6,1),
  carbs_g numeric(6,1),
  fat_g numeric(6,1),
  source text NOT NULL DEFAULT 'manual'
    CHECK (source = ANY (ARRAY['manual'::text, 'withings'::text, 'apple_health'::text])),
  external_id text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS calorie_entries_user_external_uidx
  ON public.calorie_entries (user_id, source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS calorie_entries_user_date_idx
  ON public.calorie_entries (user_id, logged_date DESC);

ALTER TABLE public.calorie_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY calorie_entries_select_own ON public.calorie_entries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY calorie_entries_insert_own ON public.calorie_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY calorie_entries_update_own ON public.calorie_entries
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY calorie_entries_delete_own ON public.calorie_entries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Daily metrics from Withings / Apple Health (weight, steps, burned calories…).
CREATE TABLE IF NOT EXISTS public.health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  metric_type text NOT NULL
    CHECK (metric_type = ANY (ARRAY[
      'weight_kg'::text,
      'steps'::text,
      'active_calories'::text,
      'total_calories'::text,
      'heart_rate'::text,
      'body_fat_pct'::text,
      'distance_m'::text
    ])),
  value numeric(12,4) NOT NULL,
  unit text NOT NULL,
  source text NOT NULL
    CHECK (source = ANY (ARRAY['withings'::text, 'apple_health'::text, 'manual'::text])),
  external_id text,
  recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS health_metrics_user_external_uidx
  ON public.health_metrics (user_id, source, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS health_metrics_user_day_type_source_uidx
  ON public.health_metrics (user_id, metric_date, metric_type, source);

CREATE INDEX IF NOT EXISTS health_metrics_user_date_idx
  ON public.health_metrics (user_id, metric_date DESC);

ALTER TABLE public.health_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY health_metrics_select_own ON public.health_metrics
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY health_metrics_insert_own ON public.health_metrics
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY health_metrics_update_own ON public.health_metrics
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY health_metrics_delete_own ON public.health_metrics
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- OAuth tokens for third-party health providers. Browser never reads tokens.
CREATE TABLE IF NOT EXISTS public.health_connections (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL
    CHECK (provider = ANY (ARRAY['withings'::text, 'apple_health'::text])),
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status = ANY (ARRAY['disconnected'::text, 'connected'::text, 'error'::text])),
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  provider_user_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

CREATE TRIGGER health_connections_touch_updated_at
  BEFORE UPDATE ON public.health_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.health_connections ENABLE ROW LEVEL SECURITY;

-- Tokens never reach the browser. Authenticated roles cannot touch this table;
-- edge functions write with the service role. Connection status is returned by
-- the withings / apple-health edge functions (and mirrored into integration_sync).
REVOKE ALL ON TABLE public.health_connections FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.health_connections TO service_role;
