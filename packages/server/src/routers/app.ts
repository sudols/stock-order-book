import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { Order } from '@orderbook/shared';
import { verifyFirebaseToken } from '../middleware/auth.js';
import type { MatchingEngine } from '../matching-engine.js';
import type { PortfolioManager } from '../portfolio-manager.js';
import type { OrderBook } from '../orderbook.js';
import type { Server as SocketServer } from 'socket.io';

const t = initTRPC.create();

/**
 * Factory — creates the tRPC router with access to the engine,
 * portfolio manager, order book, and Socket.io server.
 */
export function createAppRouter(deps: {
  matchingEngine: MatchingEngine;
  portfolioManager: PortfolioManager;
  orderBook: OrderBook;
  io: SocketServer;
}) {
  const { matchingEngine, portfolioManager, orderBook, io } = deps;

  return t.router({
    // ── Place Order ──────────────────────────────────────
    placeOrder: t.procedure
      .input(
        z.object({
          token: z.string(),
          side: z.enum(['buy', 'sell']),
          price: z.number(),
          quantity: z.number(),
        }),
      )
      .mutation(async ({ input }) => {
        // 1. Authenticate
        const userId = await verifyFirebaseToken(input.token);

        // 2. Ensure portfolio exists
        portfolioManager.initializeUser(userId);

        // 3. Build order
        const order: Order = {
          id: uuidv4(),
          userId,
          side: input.side,
          price: input.price,
          quantity: input.quantity,
          timestamp: Date.now(),
        };

        // 4. Execute
        const result = matchingEngine.placeOrder(order);

        // 5. Broadcast updated book
        io.emit('orderbook', {
          bids: orderBook.getTop10Bids(),
          asks: orderBook.getTop10Asks(),
          timestamp: Date.now(),
        });

        return result;
      }),

    // ── Cancel Order ─────────────────────────────────────
    cancelOrder: t.procedure
      .input(
        z.object({
          token: z.string(),
          orderId: z.string(),
        }),
      )
      .mutation(async ({ input }) => {
        const userId = await verifyFirebaseToken(input.token);
        const result = matchingEngine.cancelOrder(input.orderId, userId);

        // Broadcast updated book
        io.emit('orderbook', {
          bids: orderBook.getTop10Bids(),
          asks: orderBook.getTop10Asks(),
          timestamp: Date.now(),
        });

        return result;
      }),

    // ── Get Portfolio ────────────────────────────────────
    getPortfolio: t.procedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const userId = await verifyFirebaseToken(input.token);
        const portfolio = portfolioManager.initializeUser(userId);
        return portfolio;
      }),

    // ── Get OrderBook Snapshot ────────────────────────────
    getOrderBook: t.procedure.query(() => {
      return {
        bids: orderBook.getTop10Bids(),
        asks: orderBook.getTop10Asks(),
        timestamp: Date.now(),
      };
    }),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
