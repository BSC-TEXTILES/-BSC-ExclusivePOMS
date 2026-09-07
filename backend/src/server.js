import 'dotenv/config';
import app from './app.js';
import { pool } from './config/db.js';
import { attachChatWs } from './ws/chat.js';

const port = process.env.PORT || 4000;

const server = app.listen(port, () => {
  console.log(`POMS API listening on http://localhost:${port}`);
});
attachChatWs(server); // live team chat on ws://localhost:<port>/ws/chat

async function shutdown(signal) {
  console.log(`\n${signal} received — closing server and DB pool`);
  server.close(() => pool.end().then(() => process.exit(0)));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
