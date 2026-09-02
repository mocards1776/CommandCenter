import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/** Full sports bundle loaded from GitHub (cache-bust when libs change). */
await import(
  "https://raw.githubusercontent.com/mocards1776/CommandCenter/main/supabase/functions/sports/index.ts?v=145"
);
