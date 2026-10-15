import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base '/milestone-pulse/' so all assets resolve under GitHub Pages.
export default defineConfig({
  base: "/milestone-pulse/",
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
