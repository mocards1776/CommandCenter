import { defineConfig } from "vite";
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

export default defineConfig({
  plugins: [tailwindcss(), react()],
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
    // No dev proxy: the app talks to Supabase and to the Todoist edge function
    // over https directly. The old /api -> localhost:8000 FastAPI proxy is gone.
  },
});
