import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4040', changeOrigin: true },
      // WebSocket endpoints (team chat /ws/chat, notifications /ws/notify)
      // must be proxied with ws:true or upgrades never reach the backend.
      '/ws': { target: 'http://localhost:4040', ws: true },
    },
  },
});
