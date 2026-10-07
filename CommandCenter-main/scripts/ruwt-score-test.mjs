/**
 * Loads the RUWT score tests through Vite so `@/` and import.meta.env resolve.
 * The scorers live in the app modules, which the plain node test runner cannot import.
 */
import { createServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.VITE_SUPABASE_URL ||= "http://127.0.0.1";
process.env.VITE_SUPABASE_ANON_KEY ||= "test-anon-key";
const server = await createServer({
  configFile: path.join(root, "vite.config.ts"),
  root,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  await server.ssrLoadModule("/src/lib/cfb-decided-live.test.ts");
  await server.ssrLoadModule("/src/lib/mlb-inning-heat.test.ts");
} finally {
  await server.close();
}
