import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Build output is served by Django at /static/* on single-host deployments.
  base: command === "build" ? "/static/" : "/",
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/manage": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/accounts": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/feedback": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
}));
