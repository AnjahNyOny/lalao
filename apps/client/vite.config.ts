import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The game server: `PORT=3001 npm run dev` runs a second worktree beside the first.
const api = `localhost:${process.env.PORT ?? 3000}`;

export default defineConfig({
  plugins: [react()],
  // three.js alone is ~600 kB; split per game once there are several.
  build: { chunkSizeWarningLimit: 1200 },
  server: {
    // Reachable from phones on the same Wi-Fi.
    host: true,
    proxy: {
      '/ws': { target: `ws://${api}`, ws: true },
      '/api': `http://${api}`,
    },
  },
});
