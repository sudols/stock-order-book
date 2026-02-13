import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server as SocketServer } from 'socket.io';
import * as trpcExpress from '@trpc/server/adapters/express';
import { OrderBook } from './orderbook.js';
import { PortfolioManager } from './portfolio-manager.js';
import { MatchingEngine } from './matching-engine.js';
import { createAppRouter } from './routers/app.js';

const PORT = Number(process.env.PORT) || 3001;

// ── Instantiate core objects ─────────────────────────────
const orderBook = new OrderBook();
const portfolioManager = new PortfolioManager();
const matchingEngine = new MatchingEngine(orderBook, portfolioManager);

// ── Express + HTTP server ────────────────────────────────
const app = express();
app.use(cors({ origin: '*' }));

const server = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────
const io = new SocketServer(server, {
  cors: { origin: '*' },
});

io.on('connection', (socket) => {
  console.log(`[ws] client connected: ${socket.id}`);

  // Send current orderbook snapshot on connect
  socket.emit('orderbook', {
    bids: orderBook.getTop10Bids(),
    asks: orderBook.getTop10Asks(),
    timestamp: Date.now(),
  });

  socket.on('disconnect', () => {
    console.log(`[ws] client disconnected: ${socket.id}`);
  });
});

// ── tRPC ─────────────────────────────────────────────────
const appRouter = createAppRouter({
  matchingEngine,
  portfolioManager,
  orderBook,
  io,
});

app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({ router: appRouter }),
);

// ── Health check ─────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', orders: orderBook.size });
});

// ── Start ────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
  console.log(`   tRPC  → http://localhost:${PORT}/trpc`);
  console.log(`   WS    → ws://localhost:${PORT}`);
});
