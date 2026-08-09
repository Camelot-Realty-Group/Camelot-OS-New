import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';

// Stamp the build with the current git short SHA so the in-app VersionStamp
// reads something like "v2026.05.31+1bd49eb" in prod and "v2026.05.31+dev"
// when running `vite dev`. Falls back gracefully when git isn't available.
function gitShortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  define: {
    'import.meta.env.VITE_BUILD_SHA': JSON.stringify(
      process.env.VITE_BUILD_SHA ?? gitShortSha(),
    ),
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 4500,
    rollupOptions: {
      output: {
        // Without this, lucide-react's per-icon ESM modules get code-split
        // into hundreds of ~0.4 kB chunks (dist/assets/circle-alert-*.js,
        // map-pin-*.js, ...) — noisy build logs and extra HTTP requests.
        // Bundle each vendor family into a single stable chunk instead.
        manualChunks(id: string) {
          if (id.includes('node_modules/lucide-react')) return 'lucide';
          if (id.includes('node_modules/react')) return 'react-vendor';
          return undefined;
        },
      },
    },
  },
});
