import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"
// Chantan Element Editor tagger (dev only) — stamps data-chantan-src on JSX
import chantanTagger from "./chantan-tagger.mjs"
import pkg from "./package.json"

// Pre-bundle EVERY preinstalled dependency at server boot. Without this, the
// first import of a not-yet-optimized package (e.g. the AI adds a chart or
// auth feature) makes Vite re-optimize deps MID-SESSION → forced full page
// reloads, and in the bad case a stale module graph (duplicate React → white
// preview, or the "Outdated Optimize Dep" infinite reload loop). Node-side
// packages that never run in the browser stay out of the list.
const PREBUNDLE_EXCLUDE = new Set(["tailwindcss-animate"])
const prebundle = [
  "react/jsx-runtime",
  "react-dom/client",
  ...Object.keys((pkg as { dependencies?: Record<string, string> }).dependencies || {}).filter(
    (d) => !PREBUNDLE_EXCLUDE.has(d)
  ),
]

export default defineConfig(({ mode }) => ({
  plugins: [react(mode === "production" ? {} : { babel: { plugins: [[chantanTagger, { root: process.cwd() }]] } })],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  optimizeDeps: {
    include: prebundle,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    hmr: { overlay: false },
  },
}))
