import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3003' },
    // The repo lives on /mnt/c, and WSL2 gets no inotify events for changes on
    // the Windows filesystem — so the default watcher silently never fires and
    // the dev server keeps serving the pre-edit module until it is restarted.
    // Polling is the only thing that sees those writes. Costs a little CPU;
    // cheaper than debugging a fix that "didn't work" because it never shipped.
    watch: { usePolling: true, interval: 300 },
  },
});
