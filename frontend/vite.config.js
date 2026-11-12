import { defineConfig, createLogger } from 'vite';
import react from '@vitejs/plugin-react';

const logger = createLogger();
const originalError = logger.error.bind(logger);

// Suppress benign client disconnect ECONNRESET errors from the dev WebSocket proxy
logger.error = (msg, options) => {
  if (
    options?.error?.code === 'ECONNRESET' ||
    (typeof msg === 'string' && (msg.includes('ECONNRESET') || msg.includes('ws proxy socket error')))
  ) {
    return;
  }
  originalError(msg, options);
};

export default defineConfig({
  customLogger: logger,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4040', changeOrigin: true },
      // WebSocket endpoints (team chat /ws/chat, notifications /ws/notify)
      // must be proxied with ws:true or upgrades never reach the backend.
      '/ws': {
        target: 'http://localhost:4040',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (err?.code === 'ECONNRESET') return;
          });
          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            socket.on('error', (err) => {
              if (err?.code === 'ECONNRESET') return;
            });
          });
        },
      },
    },
  },
});
