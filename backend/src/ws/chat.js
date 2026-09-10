// WebSocket layer — live team chat + live notification fan-out.
//   ws://…/ws/chat   — every posted chat message (REST persists, then emits here)
//   ws://…/ws/notify — per-user notification events (po_submitted, approvals, …)
// One WebSocketServer with manual path routing: two servers bound to the same
// HTTP listener would race the upgrade event and reject each other's paths.
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'node:events';

export const chatBus = new EventEmitter();
export const notifyBus = new EventEmitter();

function verify(socket, req) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    if (!token) throw new Error('missing token');
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.sub;
    return true;
  } catch {
    try {
      socket.close(4001, 'unauthorized');
    } catch { /* ignore */ }
    return false;
  }
}

function heartbeat(wss2) {
  return setInterval(() => {
    for (const client of wss2.clients) {
      if (client.isAlive === false) {
        client.close(4000, 'heartbeat timeout'); // graceful, avoids a TCP RST
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, 30000);
}

export function attachChatWs(server) {
  const chatWss = new WebSocketServer({ noServer: true });
  const notifyWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/ws/chat') return chatWss.handleUpgrade(req, socket, head, (ws) => chatWss.emit('connection', ws, req));
    if (pathname === '/ws/notify') return notifyWss.handleUpgrade(req, socket, head, (ws) => notifyWss.emit('connection', ws, req));
    // Unknown WebSocket path — answer with a proper HTTP 404 and close cleanly
    // instead of destroying the socket (which produces a TCP RST / ECONNRESET).
    try {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    } catch { /* ignore */ }
    socket.destroy();
  });

  chatWss.on('connection', (socket, req) => {
    if (!verify(socket, req)) return;
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });
    socket.on('message', () => { /* inbound chat goes through REST; socket is receive-only */ });
  });
  const hb1 = heartbeat(chatWss);
  chatWss.on('close', () => clearInterval(hb1));

  notifyWss.on('connection', (socket, req) => {
    if (!verify(socket, req)) return;
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });
    socket.on('message', () => { /* receive-only */ });
  });
  const hb2 = heartbeat(notifyWss);
  notifyWss.on('close', () => clearInterval(hb2));

  chatBus.on('message', (message) => {
    const payload = JSON.stringify({ type: 'chat', message });
    for (const client of chatWss.clients) {
      if (client.readyState === 1) client.send(payload);
    }
  });

  notifyBus.on('notification', ({ userId, notification }) => {
    const payload = JSON.stringify({ type: 'notification', userId, notification });
    for (const client of notifyWss.clients) {
      if (client.readyState === 1 && String(client.userId) === String(userId)) client.send(payload);
    }
  });

  return chatWss;
}
