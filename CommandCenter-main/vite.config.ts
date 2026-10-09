import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { execSync } from "child_process";
import { GET as nhlProxyGet } from "./api/nhl";
import { GET as kalshiProxyGet } from "./api/kalshi";

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
      server.middlewares.use("/api/kalshi", async (req, res) => {
        const upstream = await kalshiProxyGet(new Request(new URL(req.url ?? "", "http://local")));
        res.statusCode = upstream.status;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(await upstream.text());
      });
      // Dev stand-in for the mlb-ws-odds edge function. Same parser, same cache.
      server.middlewares.use("/api/mlb-ws-odds", async (_req, res) => {
        try {
          const { fetchWsBoardCached } = await import("./supabase/functions/mlb-ws-odds/board.ts");
          const board = await fetchWsBoardCached();
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", board ? "public, max-age=180" : "public, max-age=30");
          res.end(JSON.stringify(board ?? { source: "Kalshi", teams: [] }));
        } catch {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ source: "Kalshi", teams: [] }));
        }
      });
      // ESPN scoreboards are CORS-blocked from localhost; the VM can read them.
      server.middlewares.use("/api/espn", async (req, res) => {
        const url = new URL(req.url ?? "", "http://local");
        const path = (url.searchParams.get("path") ?? "").replace(/^\/+/, "");
        if (!path || path.includes("://")) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "bad path" }));
          return;
        }
        const site = url.searchParams.get("site") === "3" ? "v3" : "v2";
        const hosts = [
          `https://site.api.espn.com/apis/site/${site}/sports`,
          `https://site.web.api.espn.com/apis/site/${site}/sports`,
        ];
        for (const host of hosts) {
          try {
            const upstream = await fetch(`${host}/${path}`, { headers: { Accept: "application/json" } });
            if (!upstream.ok) continue;
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(await upstream.text());
            return;
          } catch {
            /* next host */
          }
        }
        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "ESPN proxy failed" }));
      });
    },
  };
}

function timesPrecache(): Plugin {
  return {
    name: "times-precache",
    generateBundle(_, bundle) {
      const files = Object.values(bundle).flatMap((item) => {
        const name = item.fileName;
        if (!name) return [];
        const keep =
          name.endsWith(".css") ||
          /(?:^|\/)(?:index|vendor|DailyNewspaper|newspaper|TimesHold)/i.test(name);
        return keep ? [`/${name}`] : [];
      });
      this.emitFile({
        type: "asset",
        fileName: "times-precache.json",
        source: JSON.stringify({ files: [...new Set(files)], generatedAt: new Date().toISOString() }),
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), react(), nhlApiDevProxy(), timesPrecache()],
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react/") ||
            id.includes("node_modules/scheduler")
          ) {
            return "vendor-react";
          }
          if (id.includes("node_modules/react-router")) return "vendor-router";
          if (id.includes("node_modules/@supabase")) return "vendor-supabase";
          if (id.includes("node_modules/@tanstack")) return "vendor-query";
          return "vendor";
        },
      },
    },
  },
  server: {
    port: 5173,
    // Supabase and the Todoist edge function are called over https directly.
    // Local /api routes are the NHL and Kalshi proxy plugins above.
  },
});
