import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { execSync } from "child_process";

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
        const path = new URL(req.url ?? "", "http://local").searchParams.get("path") ?? "";
        if (!/^v1\/[\w/-]+$/.test(path)) {
          res.statusCode = 400;
          res.end('{"error":"Path not allowed"}');
          return;
        }
        try {
          const upstream = await fetch(`https://api-web.nhle.com/${path}`, {
            headers: { Accept: "application/json" },
          });
          res.statusCode = upstream.status;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(await upstream.text());
        } catch {
          res.statusCode = 502;
          res.end('{"error":"Upstream unavailable"}');
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), react(), nhlApiDevProxy()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
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
