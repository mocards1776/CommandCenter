import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { execSync } from "child_process";
import { GET as nhlProxyGet } from "./api/nhl";

function git(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

const commit =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VITE_APP_COMMIT ||
  git("git rev-parse HEAD") ||
  "dev";
const commitTime =
  process.env.VERCEL_GIT_COMMIT_DATE ||
  process.env.VITE_APP_COMMIT_TIME ||
  git("git log -1 --format=%cI") ||
  new Date().toISOString();

/** Dev stand-in for the Vercel `api/nhl.ts` function (api-web.nhle.com has no CORS). */
function nhlApiDevProxy(): Plugin {
  return {
    name: "nhl-api-dev-proxy",
    configureServer(server) {
      server.middlewares.use("/api/nhl", async (req, res) => {
        const upstream = await nhlProxyGet(new Request(new URL(req.url ?? "", "http://local")));
        res.statusCode = upstream.status;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(await upstream.text());
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), react(), nhlApiDevProxy()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@heat": path.resolve(__dirname, "../supabase/functions/_shared/heat-alert"),
    },
  },
  define: {
    "import.meta.env.VITE_APP_COMMIT": JSON.stringify(commit),
    "import.meta.env.VITE_APP_COMMIT_TIME": JSON.stringify(commitTime),
  },
  css: {
    transformer: "postcss",
  },
  build: {
    cssMinify: "esbuild",
  },
  server: {
    port: 5173,
    // Supabase and the Todoist edge function are called over https directly.
    // The only local /api route is the NHL proxy plugin above.
  },
});
