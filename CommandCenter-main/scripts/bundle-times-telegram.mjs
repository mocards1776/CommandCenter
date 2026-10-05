/**
 * Bundle the Times front (A1 picks) for the times-telegram edge function.
 * Run from CommandCenter-main: node scripts/bundle-times-telegram.mjs
 *
 * times-telegram imports the bundle directly; redeploy the function after a rebuild
 * so the alert keeps choosing the same A1 lead as the paper.
 */
import * as esbuild from "esbuild";
import path from "node:path";
import { existsSync } from "node:fs";

const banner = `
const __mem = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
};
if (typeof globalThis.localStorage === "undefined") globalThis.localStorage = __mem();
if (typeof globalThis.sessionStorage === "undefined") globalThis.sessionStorage = __mem();
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
const __ttEnv = globalThis.Deno && globalThis.Deno.env
  ? { url: globalThis.Deno.env.get("SUPABASE_URL") || "", key: globalThis.Deno.env.get("SUPABASE_ANON_KEY") || "" }
  : (globalThis.__TT_ENV || { url: "", key: "" });
`;

const alias = {
  name: "alias",
  setup(build) {
    build.onResolve({ filter: /^@\// }, (args) => {
      const base = path.join(process.cwd(), "src", args.path.slice(2));
      for (const ext of [".ts", ".tsx", ".js", "/index.ts"]) {
        if (existsSync(base + ext)) return { path: base + ext };
      }
      return { path: base };
    });
  },
};

await esbuild.build({
  entryPoints: ["src/lib/times-telegram-entry.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: "supabase/functions/times-telegram/front.bundle.js",
  plugins: [alias],
  minify: false,
  banner: { js: banner },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": "__ttEnv.url",
    "import.meta.env.VITE_SUPABASE_ANON_KEY": "__ttEnv.key",
    "import.meta.env.VITE_DEV_BYPASS_AUTH": "undefined",
    "import.meta.env.VITE_CLIENT_SHARE_ORIGIN": "undefined",
    "import.meta.env.VITE_PUBLIC_CLIENT_SHARE_ORIGIN": "undefined",
    "import.meta.env.VITE_CALENDAR_ICAL_URLS": "undefined",
  },
  legalComments: "none",
});
