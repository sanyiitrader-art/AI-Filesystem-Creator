import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standard Tauri 2 + Vite setup. Fixed dev server port (1420) matches
// devUrl in src-tauri/tauri.conf.json, and clearScreen is disabled so
// Rust compiler output in the Tauri dev console isn't wiped by Vite.

export default defineConfig({
  plugins: [react()],

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],

  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
  },
});