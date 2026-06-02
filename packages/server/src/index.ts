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
import { startMarketMaker } from './market-maker.js';
import rateLimit from 'express-rate-limit';

const PORT = Number(process.env.PORT) || 3001;

// ── Instantiate core objects ─────────────────────────────
const orderBook = new OrderBook();
const portfolioManager = new PortfolioManager();
const matchingEngine = new MatchingEngine(orderBook, portfolioManager);

// ── Express + HTTP server ────────────────────────────────
const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── Rate Limiting ────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return !!process.env.BOT_SECRET_KEY && req.headers['x-bot-secret'] === process.env.BOT_SECRET_KEY;
  }
});

const trpcLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return !!process.env.BOT_SECRET_KEY && req.headers['x-bot-secret'] === process.env.BOT_SECRET_KEY;
  }
});

app.use(generalLimiter);

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

// ── Turnstile Verification ─────────────────────────────────
app.post('/api/verify-turnstile', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, error: 'No token provided' });

  try {
    const formData = new URLSearchParams();
    formData.append('secret', process.env.TURNSTILE_SECRET_KEY || '');
    formData.append('response', token);
    formData.append('remoteip', req.ip || '');

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });
    const outcome = await result.json();
    if (outcome.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: 'Turnstile verification failed' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error during verification' });
  }
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
  trpcLimiter,
  trpcExpress.createExpressMiddleware({ router: appRouter }),
);

// ── Health check ─────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', orders: orderBook.size });
});

// ── Start ────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`   tRPC  → http://localhost:${PORT}/trpc`);
  console.log(`   WS    → ws://localhost:${PORT}`);

  setTimeout(() => {
    startMarketMaker(`http://localhost:${PORT}/trpc`).catch((err) => {
      console.error('Failed to start inline market maker:', err);
    });
  }, 1000);
});
