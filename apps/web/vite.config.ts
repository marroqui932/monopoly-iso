import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Sur GitHub Pages, le site est servi sous /monopoly-iso/.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? "/monopoly-iso/" : "/",
  plugins: [react()],
  build: { chunkSizeWarningLimit: 2000 },
});
