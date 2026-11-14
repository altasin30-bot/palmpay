import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config: dev server on 5173, proxies /api to the Flask backend on 5000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
});
