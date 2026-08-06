import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Portable single-file build: everything (JS/CSS/fonts/data) inlined into one
// index.html so the app runs by double-clicking the file (file:// protocol).
// No service worker in this artifact; offline works via browser cache + IndexedDB.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 100 * 1024 * 1024,
    chunkSizeWarningLimit: 20000,
    cssCodeSplit: false
  }
});
