import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // three.js alone is ~600 kB; split per game once there are several.
  build: { chunkSizeWarningLimit: 1200 },
  server: {
    // Reachable from phones on the same Wi-Fi.
    host: true,
    proxy: {
      '/ws': { target: 'ws://localhost:3000', ws: true },
      '/api': 'http://localhost:3000',
    },
  },
});
