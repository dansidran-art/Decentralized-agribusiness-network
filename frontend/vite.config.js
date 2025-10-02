import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist", // Cloudflare Pages will serve from here
  },
  server: {
    port: 5173, // local dev server
  },
  preview: {
    port: 4173, // preview mode
  },
});
