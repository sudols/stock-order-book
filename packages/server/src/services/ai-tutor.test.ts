import { describe, it, expect, beforeEach } from 'vitest';
import { AITutorService, initializeAITutorService } from './ai-tutor.js';
import { MatchingEngine } from '../matching-engine.js';
import { OrderBook } from '../orderbook.js';
import { PortfolioManager } from '../portfolio-manager.js';
import { createAppRouter } from '../routers/app.js';
import type { Order, SupportedSymbol } from '@orderbook/shared';

describe('Feature Card: S3-01 — Tool-Calling Agentic AI Market Microstructure Tutor (NR-02)', () => {
  let books: Map<string, OrderBook>;
  let portfolioManager: PortfolioManager;
  let matchingEngine: MatchingEngine;
  let tutorService: AITutorService;

  beforeEach(() => {
    books = new Map<string, OrderBook>();
    for (const sym of ['TCS', 'INFY', 'RELIANCE', 'HDFCBANK']) {
      books.set(sym, new OrderBook(sym));
    }
    portfolioManager = new PortfolioManager();
    matchingEngine = new MatchingEngine(books, portfolioManager);
    tutorService = new AITutorService(matchingEngine);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 1. TOOL 1: get_orderbook_depth(symbol)
  // ═════════════════════════════════════════════════════════════════════════
  describe('Tool 1: get_orderbook_depth', () => {
    it('should query top 10 price levels and cumulative volume accurately', async () => {
      const book = matchingEngine.getOrderBook('INFY')!;

      // Add 3 bid levels
      book.addOrder({
        id: 'b1',
        userId: 'u1',
        symbol: 'INFY',
        side: 'buy',
        price: 1500,
        quantity: 100,
        timestamp: 1,
      });
      book.addOrder({
        id: 'b2',
        userId: 'u2',
        symbol: 'INFY',
        side: 'buy',
        price: 1495,
        quantity: 200,
        timestamp: 2,
      });
      book.addOrder({
        id: 'b3',
        userId: 'u3',
        symbol: 'INFY',
        side: 'buy',
        price: 1490,
        quantity: 300,
        timestamp: 3,
      });

      // Add 2 ask levels
      book.addOrder({
        id: 'a1',
        userId: 'u4',
        symbol: 'INFY',
        side: 'sell',
        price: 1505,
        quantity: 150,
        timestamp: 4,
      });
      book.addOrder({
        id: 'a2',
        userId: 'u5',
        symbol: 'INFY',
        side: 'sell',
        price: 1510,
        quantity: 250,
        timestamp: 5,
      });

      const depth = await tutorService.getOrderBookDepth('INFY');

      expect(depth.symbol).toBe('INFY');
      expect(depth.bestBidPrice).toBe(1500);
      expect(depth.bestAskPrice).toBe(1505);
      expect(depth.spread).toBe(5);
      expect(depth.midPrice).toBe(1502.5);

      // Verify bid levels descending
      expect(depth.bids).toHaveLength(3);
      expect(depth.bids[0]).toEqual({
        price: 1500,
        quantity: 100,
        orderCount: 1,
        cumulativeVolume: 100,
      });
      expect(depth.bids[1]).toEqual({
        price: 1495,
        quantity: 200,
        orderCount: 1,
        cumulativeVolume: 300,
      });
      expect(depth.bids[2]).toEqual({
        price: 1490,
        quantity: 300,
        orderCount: 1,
        cumulativeVolume: 600,
      });

      // Verify ask levels ascending
      expect(depth.asks).toHaveLength(2);
      expect(depth.asks[0]).toEqual({
        price: 1505,
        quantity: 150,
        orderCount: 1,
        cumulativeVolume: 150,
      });
      expect(depth.asks[1]).toEqual({
        price: 1510,
        quantity: 250,
        orderCount: 1,
        cumulativeVolume: 400,
      });

      expect(depth.totalBidVolumeTop10).toBe(600);
      expect(depth.totalAskVolumeTop10).toBe(400);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 2. TOOL 2: calculate_slippage(symbol, order_size, side)
  // ═════════════════════════════════════════════════════════════════════════
  describe('Tool 2: calculate_slippage', () => {
    it('should compute exact multi-level VWAP and slippage for a BUY market sweep', async () => {
      const book = matchingEngine.getOrderBook('TCS')!;

      // Resting asks: 100 shares @ 3500, 200 shares @ 3510, 300 shares @ 3520
      book.addOrder({ id: 'a1', userId: 'u1', symbol: 'TCS', side: 'sell', price: 3500, quantity: 100, timestamp: 1 });
      book.addOrder({ id: 'a2', userId: 'u2', symbol: 'TCS', side: 'sell', price: 3510, quantity: 200, timestamp: 2 });
      book.addOrder({ id: 'a3', userId: 'u3', symbol: 'TCS', side: 'sell', price: 3520, quantity: 300, timestamp: 3 });

      // Request market BUY of 250 shares:
      // Fills: 100 @ 3500 (cost: 350,000) + 150 @ 3510 (cost: 526,500)
      // Total cost = 876,500; VWAP = 876,500 / 250 = 3506.00
      // Best ask = 3500.00; Slippage = 6.00; Slippage % = (6 / 3500) * 100 = 0.1714%
      const res = await tutorService.calculateSlippage('TCS', 250, 'BUY');

      expect(res.symbol).toBe('TCS');
      expect(res.side).toBe('BUY');
      expect(res.requestedSize).toBe(250);
      expect(res.filledQuantity).toBe(250);
      expect(res.isFullyFilled).toBe(true);
      expect(res.topOfBookPrice).toBe(3500);
      expect(res.effectiveVWAP).toBe(3506.0);
      expect(res.slippageAmount).toBe(6.0);
      expect(res.slippagePct).toBe(0.1714);
      expect(res.priceLevelsCrossed).toBe(2);
      expect(res.tierBreakdown).toEqual([
        { level: 1, price: 3500, sharesFilled: 100, tierCost: 350000 },
        { level: 2, price: 3510, sharesFilled: 150, tierCost: 526500 },
      ]);
    });

    it('should compute partial fill when order size exceeds depth', async () => {
      const book = matchingEngine.getOrderBook('RELIANCE')!;
      book.addOrder({ id: 'b1', userId: 'u1', symbol: 'RELIANCE', side: 'buy', price: 2500, quantity: 50, timestamp: 1 });

      const res = await tutorService.calculateSlippage('RELIANCE', 100, 'SELL');
      expect(res.filledQuantity).toBe(50);
      expect(res.unfilledQuantity).toBe(50);
      expect(res.isFullyFilled).toBe(false);
      expect(res.effectiveVWAP).toBe(2500);
      expect(res.slippageAmount).toBe(0);
    });

    it('should return informative error when zero counterpart liquidity exists', async () => {
      const res = await tutorService.calculateSlippage('HDFCBANK', 100, 'BUY');
      expect(res.error).toContain('Liquidity vacuum');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 3. TOOL 3: get_orderbook_imbalance(symbol)
  // ═════════════════════════════════════════════════════════════════════════
  describe('Tool 3: get_orderbook_imbalance', () => {
    it('should calculate OBI ratio across top 5 depth tiers precisely', async () => {
      const book = matchingEngine.getOrderBook('INFY')!;

      // Heavy bid liquidity: 300 + 300 = 600 shares
      book.addOrder({ id: 'b1', userId: 'u1', symbol: 'INFY', side: 'buy', price: 1500, quantity: 300, timestamp: 1 });
      book.addOrder({ id: 'b2', userId: 'u2', symbol: 'INFY', side: 'buy', price: 1495, quantity: 300, timestamp: 2 });

      // Thin ask liquidity: 100 shares
      book.addOrder({ id: 'a1', userId: 'u3', symbol: 'INFY', side: 'sell', price: 1505, quantity: 100, timestamp: 3 });

      // OBI = (600 - 100) / (600 + 100) = 500 / 700 = 0.7143 (> 0.5 -> Strong Buying Pressure)
      const res = await tutorService.getOrderBookImbalance('INFY');

      expect(res.symbol).toBe('INFY');
      expect(res.bidVolumeTop5).toBe(600);
      expect(res.askVolumeTop5).toBe(100);
      expect(res.obi).toBe(0.7143);
      expect(res.regime).toContain('Strong Buying Pressure');
    });

    it('should flag Strong Selling Pressure when asks dominate bids', async () => {
      const book = matchingEngine.getOrderBook('TCS')!;
      book.addOrder({ id: 'b1', userId: 'u1', symbol: 'TCS', side: 'buy', price: 3500, quantity: 50, timestamp: 1 });
      book.addOrder({ id: 'a1', userId: 'u2', symbol: 'TCS', side: 'sell', price: 3505, quantity: 450, timestamp: 2 });

      // OBI = (50 - 450) / (50 + 450) = -400 / 500 = -0.8000 (< -0.5 -> Strong Selling Pressure)
      const res = await tutorService.getOrderBookImbalance('TCS');
      expect(res.obi).toBe(-0.8);
      expect(res.regime).toContain('Strong Selling Pressure');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 4. TOOL 4: inspect_recent_trades(symbol, limit)
  // ═════════════════════════════════════════════════════════════════════════
  describe('Tool 4: inspect_recent_trades', () => {
    it('should return recent trades structure with verified schema', async () => {
      const res = await tutorService.inspectRecentTrades('INFY', 5);
      expect(res.symbol).toBe('INFY');
      expect(Array.isArray(res.trades)).toBe(true);
      expect(typeof res.tradeCount).toBe('number');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 5. TOOL 5: explain_price_movement(symbol, timeframe)
  // ═════════════════════════════════════════════════════════════════════════
  describe('Tool 5: explain_price_movement', () => {
    it('should return structured timeframe diagnosis', async () => {
      const res = await tutorService.explainPriceMovement('INFY', '15m');
      expect(res.symbol).toBe('INFY');
      expect(res.timeframe).toBe('15m');
      expect(res).toHaveProperty('currentPrice');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 6. ACCEPTANCE CRITERIA: "Why did INFY price move?"
  // ═════════════════════════════════════════════════════════════════════════
  describe('Acceptance Criteria: AI Tutor Autonomous Invocation', () => {
    it('asking "Why did INFY price move?" triggers inspect_recent_trades and get_orderbook_depth', async () => {
      const book = matchingEngine.getOrderBook('INFY')!;
      book.addOrder({ id: 'b1', userId: 'u1', symbol: 'INFY', side: 'buy', price: 1500, quantity: 200, timestamp: 1 });
      book.addOrder({ id: 'a1', userId: 'u2', symbol: 'INFY', side: 'sell', price: 1505, quantity: 150, timestamp: 2 });

      const response = await tutorService.askQuestion({
        message: 'Why did INFY price move?',
        symbol: 'INFY',
      });

      // Criterion 1: inspect_recent_trades and get_orderbook_depth are executed
      expect(response.usedTools).toContain('inspect_recent_trades');
      expect(response.usedTools).toContain('get_orderbook_depth');

      // Criterion 2: Tool execution telemetry is captured in toolAudit
      expect(response.toolAudit.length).toBeGreaterThanOrEqual(2);
      const depthAudit = response.toolAudit.find((a) => a.toolName === 'get_orderbook_depth');
      const tradesAudit = response.toolAudit.find((a) => a.toolName === 'inspect_recent_trades');

      expect(depthAudit).toBeDefined();
      expect(depthAudit?.args.symbol).toBe('INFY');
      expect(depthAudit?.result.bestBidPrice).toBe(1500);
      expect(depthAudit?.result.bestAskPrice).toBe(1505);
      expect(depthAudit?.executionTimeMs).toBeGreaterThanOrEqual(0);

      expect(tradesAudit).toBeDefined();

      // Criterion 3: Zero hallucination guarantee — response cites actual numbers
      expect(response.answer).toContain('INFY');
      expect(response.answer).toContain('1500'); // Best bid cited
      expect(response.answer).toContain('1505'); // Best ask cited
      expect(response.answer).toContain('Spread');
    });

    it('asking about slippage triggers calculate_slippage and cites exact VWAP', async () => {
      const book = matchingEngine.getOrderBook('TCS')!;
      book.addOrder({ id: 'a1', userId: 'u1', symbol: 'TCS', side: 'sell', price: 3500, quantity: 100, timestamp: 1 });
      book.addOrder({ id: 'a2', userId: 'u2', symbol: 'TCS', side: 'sell', price: 3510, quantity: 100, timestamp: 2 });

      const response = await tutorService.askQuestion({
        message: 'Calculate slippage for 150 shares market BUY of TCS',
        symbol: 'TCS',
      });

      expect(response.usedTools).toContain('calculate_slippage');
      expect(response.answer).toContain('VWAP');
      expect(response.answer).toContain('3503.33'); // 100@3500 + 50@3510 = 525,500 / 150 = 3503.33
      expect(response.answer).toContain('Slippage');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 7. tRPC ROUTER ENDPOINT INTEGRATION
  // ═════════════════════════════════════════════════════════════════════════
  describe('tRPC router endpoint integration', () => {
    it('should expose aiTutor.askQuestion and return complete telemetry payload', async () => {
      const router = createAppRouter({
        matchingEngine,
        portfolioManager,
        io: { to: () => ({ emit: () => {} }), emit: () => {} } as any,
        aiTutorService: tutorService,
      });

      const caller = router.createCaller({} as any);
      const res = await caller.aiTutor.askQuestion({
        message: 'Why did INFY price move?',
        symbol: 'INFY',
      });

      expect(res).toBeDefined();
      expect(res.symbol).toBe('INFY');
      expect(res.usedTools).toContain('get_orderbook_depth');
      expect(res.usedTools).toContain('inspect_recent_trades');
      expect(Array.isArray(res.toolAudit)).toBe(true);
      expect(typeof res.answer).toBe('string');
      expect(typeof res.latencyMs).toBe('number');
    });
  });
});
