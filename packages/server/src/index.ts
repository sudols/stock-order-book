import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server as SocketServer } from 'socket.io';
import * as trpcExpress from '@trpc/server/adapters/express';
import { SUPPORTED_SYMBOLS } from '@orderbook/shared';
import { OrderBook } from './orderbook.js';
import { PortfolioManager } from './portfolio-manager.js';
import { MatchingEngine } from './matching-engine.js';
import { createAppRouter } from './routers/app.js';
import { startMarketMaker } from './market-maker.js';
import { ledgerService } from './services/ledger.js';
import { initializeAITutorService } from './services/ai-tutor.js';
import rateLimit from 'express-rate-limit';

const PORT = Number(process.env.PORT) || 3001;

// ── Instantiate multi-symbol core objects (FR-04) ────────
const books = new Map<string, OrderBook>();
for (const sym of SUPPORTED_SYMBOLS) {
  books.set(sym, new OrderBook(sym));
}

const portfolioManager = new PortfolioManager();
const matchingEngine = new MatchingEngine(books, portfolioManager);
const aiTutorService = initializeAITutorService(matchingEngine);

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

// ── Socket.io with Symbol Rooms (FR-04) ───────────────────
const io = new SocketServer(server, {
  cors: { origin: '*' },
});

// Broadcast price history updates to symbol-specific rooms + legacy global
matchingEngine.onPriceHistoryPush = (item, symbol) => {
  io.to(`priceHistory:${symbol}`).emit('priceHistoryDelta', { ...item, symbol });
  if (symbol === 'TCS' || symbol === 'DEFAULT') {
    io.emit('priceHistoryDelta', item);
  }
};

// Broadcast compressed array when a compression threshold is hit
matchingEngine.onPriceHistorySnapshot = (compressedHistory, symbol) => {
  io.to(`priceHistory:${symbol}`).emit('priceHistorySnapshotSync', compressedHistory);
  if (symbol === 'TCS' || symbol === 'DEFAULT') {
    io.emit('priceHistorySnapshotSync', compressedHistory);
  }
};

io.on('connection', (socket) => {
  console.log(`[ws] client connected: ${socket.id}`);

  // Auto-subscribe to all supported symbols
  for (const sym of SUPPORTED_SYMBOLS) {
    socket.join(`orderbook:${sym}`);
    socket.join(`priceHistory:${sym}`);
  }

  // Allow explicit room subscription
  socket.on('subscribe', (symbol: string) => {
    socket.join(`orderbook:${symbol}`);
    socket.join(`priceHistory:${symbol}`);
    const book = matchingEngine.getOrderBook(symbol);
    socket.emit('orderbookSnapshot', {
      symbol,
      bids: book ? book.getTop10Bids() : [],
      asks: book ? book.getTop10Asks() : [],
      priceHistory: matchingEngine.getPriceHistory(symbol),
      timestamp: Date.now(),
    });
  });

  socket.on('unsubscribe', (symbol: string) => {
    socket.leave(`orderbook:${symbol}`);
    socket.leave(`priceHistory:${symbol}`);
  });

  // Send default (TCS) orderbook snapshot on initial connection
  const defaultBook = matchingEngine.getOrderBook('TCS');
  socket.emit('orderbookSnapshot', {
    symbol: 'TCS',
    bids: defaultBook ? defaultBook.getTop10Bids() : [],
    asks: defaultBook ? defaultBook.getTop10Asks() : [],
    priceHistory: matchingEngine.getPriceHistory('TCS'),
    timestamp: Date.now(),
  });

  // Agentic AI Tutor conversation handler (NR-02)
  socket.on('aiTutor:ask', async (data: { message: string; symbol?: string }, callback) => {
    try {
      const response = await aiTutorService.askQuestion(data);
      if (typeof callback === 'function') {
        callback({ success: true, ...response });
      }
      socket.emit('aiTutor:response', response);
    } catch (err: any) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err?.message || String(err) });
      }
    }
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
  orderBook: matchingEngine.getOrderBook('TCS'),
  io,
  aiTutorService,
});

app.use(
  '/trpc',
  trpcLimiter,
  trpcExpress.createExpressMiddleware({ router: appRouter }),
);

// ── Health check (Multi-Symbol) ───────────────────────────
app.get('/health', (_req, res) => {
  const allBooks = matchingEngine.getAllOrderBooks();
  let totalOrders = 0;
  const bookSizes: Record<string, number> = {};
  for (const [sym, b] of allBooks.entries()) {
    bookSizes[sym] = b.size;
    totalOrders += b.size;
  }
  res.json({ status: 'ok', orders: totalOrders, bookSizes });
});

// ── Double-Entry Ledger Audit Endpoint (NR-05) ─────────────
app.get('/api/audit/verify-ledger', async (_req, res) => {
  try {
    const report = await ledgerService.verifyLedgerIntegrity();
    res.status(200).json(report);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to verify ledger integrity', details: err?.message || String(err) });
  }
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
