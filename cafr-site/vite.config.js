import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        dashboard: resolve(import.meta.dirname, 'dashboard.html'),
        verify: resolve(import.meta.dirname, 'verify.html'),
        reset: resolve(import.meta.dirname, 'reset.html')
      }
    }
  }
});
