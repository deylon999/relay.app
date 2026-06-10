import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        offscreen: "offscreen.html",
        popup: "popup.html",
        contentScript: "src/content/contentScript.ts",
        serviceWorker: "src/background/serviceWorker.ts"
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
});
