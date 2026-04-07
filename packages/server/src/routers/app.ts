import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { Order } from '@orderbook/shared';
import { verifyFirebaseToken } from '../middleware/auth.js';
import type { GoMatchingEngineClient } from '../go-client.js';
import type { PortfolioManager } from '../portfolio-manager.js';
import type { Server as SocketServer } from 'socket.io';

const t = initTRPC.create();

/**
 * Factory — creates the tRPC router with access to the engine,
 * portfolio manager, and Socket.io server.
 */
export function createAppRouter(deps: {
  matchingEngine: GoMatchingEngineClient;
  portfolioManager: PortfolioManager;
  io: SocketServer;
}) {
  const { matchingEngine, portfolioManager, io } = deps;

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

        // 4. Check if user can afford this order
        if (!portfolioManager.canAfford(userId, order.side, order.price, order.quantity)) {
          return { error: 'Insufficient funds' };
        }

        // 5. Execute via Go matching engine (HTTP call)
        const result = await matchingEngine.placeOrder(order);

        // 6. If successful, update portfolios for executed trades
        if (!result.error && result.trades) {
          for (const trade of result.trades) {
            portfolioManager.executeTrade(trade);
          }
        }

        // 7. Broadcast updated book
        const orderbook = await matchingEngine.getOrderBook();
        io.emit('orderbook', {
          bids: orderbook.bids,
          asks: orderbook.asks,
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
        const result = await matchingEngine.cancelOrder(input.orderId, userId);

        // Broadcast updated book
        const orderbook = await matchingEngine.getOrderBook();
        io.emit('orderbook', {
          bids: orderbook.bids,
          asks: orderbook.asks,
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
    getOrderBook: t.procedure.query(async () => {
      const orderbook = await matchingEngine.getOrderBook();
      return {
        bids: orderbook.bids,
        asks: orderbook.asks,
        timestamp: Date.now(),
      };
    }),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
