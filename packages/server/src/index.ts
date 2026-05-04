import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server as SocketServer } from 'socket.io';
import * as trpcExpress from '@trpc/server/adapters/express';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { GoMatchingEngineClient } from './go-client.js';
import { PortfolioManager } from './portfolio-manager.js';
import { createAppRouter } from './routers/app.js';

const PORT = Number(process.env.PORT) || 3001;
const USE_GO_ENGINE = process.env.USE_GO_ENGINE !== 'false'; // Default to true

// ── Start Go Matching Engine (if enabled) ────────────────
let goProcess: any = null;
let matchingEngine: GoMatchingEngineClient;

if (USE_GO_ENGINE) {
  console.log('🚀 Starting Go matching engine...');
  
  const goPath = path.join(process.cwd(), '../matching-engine-go');
  goProcess = spawn('go', ['run', 'main.go'], {
    cwd: goPath,
    stdio: 'inherit',
  });

  goProcess.on('error', (err: Error) => {
    console.error('❌ Failed to start Go service:', err);
    process.exit(1);
  });

  goProcess.on('exit', (code: number | null) => {
    if (code !== 0 && code !== null) {
      console.error(`⚠️  Go service exited with code ${code}`);
      process.exit(1);
    }
  });

  // Wait for Go service to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  matchingEngine = new GoMatchingEngineClient();

  // Verify connection
  try {
    const health = await matchingEngine.health();
    console.log('✅ Connected to Go matching engine:', health);
  } catch (error) {
    console.error('❌ Failed to connect to Go service');
    goProcess.kill();
    process.exit(1);
  }
} else {
  // Fallback to TypeScript implementation
  console.log('📝 Using TypeScript matching engine (fallback mode)');
  const { OrderBook } = await import('./orderbook.js');
  const { MatchingEngine } = await import('./matching-engine.js');
  const orderBook = new OrderBook();
  matchingEngine = new MatchingEngine(orderBook, new PortfolioManager()) as any;
}

// ── Instantiate other components ─────────────────────────
const portfolioManager = new PortfolioManager();

// ── Express + HTTP server ────────────────────────────────
const app = express();
app.use(cors({ origin: '*' }));

const server = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────
const io = new SocketServer(server, {
  cors: { origin: '*' },
});

io.on('connection', async (socket) => {
  console.log(`[ws] client connected: ${socket.id}`);

  // Send current orderbook snapshot on connect
  const orderbook = await matchingEngine.getOrderBook();
  socket.emit('orderbook', {
    bids: orderbook.bids,
    asks: orderbook.asks,
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
  io,
});

app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({ router: appRouter }),
);

// ── Health check ─────────────────────────────────────────
app.get('/health', async (_req, res) => {
  if (USE_GO_ENGINE) {
    try {
      const goHealth = await matchingEngine.health();
      res.json({ 
        status: 'ok',
        engine: 'go',
        go: goHealth,
      });
    } catch (error) {
      res.status(503).json({ status: 'error', engine: 'go', error: 'Go service unavailable' });
    }
  } else {
    res.json({ status: 'ok', engine: 'typescript' });
  }
});

// ── Graceful shutdown ────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n⏳ Shutting down...');
  if (goProcess) {
    goProcess.kill();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⏳ Shutting down...');
  if (goProcess) {
    goProcess.kill();
  }
  process.exit(0);
});

// ── Start ────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`   tRPC  → http://localhost:${PORT}/trpc`);
  console.log(`   WS    → ws://localhost:${PORT}`);
});
