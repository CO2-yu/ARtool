import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/ARtool/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        viewer: resolve(__dirname, "viewer/index.html"),
        ar: resolve(__dirname, "ar/index.html"),
      },
    },
  },
  server: {
    host: "0.0.0.0",
  },
  preview: {
    host: "0.0.0.0",
  },
});
