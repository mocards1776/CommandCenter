import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
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
