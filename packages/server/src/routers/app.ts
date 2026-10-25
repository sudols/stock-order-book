import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { Order } from '@orderbook/shared';
import { verifyFirebaseToken } from '../middleware/auth.js';
import type { MatchingEngine } from '../matching-engine.js';
import type { PortfolioManager } from '../portfolio-manager.js';
import type { OrderBook } from '../orderbook.js';
import type { Server as SocketServer } from 'socket.io';
import { marketMakerController } from '../market-maker.js';
import { ledgerService as defaultLedgerService, type LedgerService } from '../services/ledger.js';
import { AITutorService, initializeAITutorService } from '../services/ai-tutor.js';

const t = initTRPC.create();

/**
 * Factory — creates the tRPC router with access to the engine,
 * portfolio manager, order book, and Socket.io server.
 */
const ORDERBOOK_EMIT_INTERVAL_MS = 500;

export function createAppRouter(deps: {
	matchingEngine: MatchingEngine;
	portfolioManager: PortfolioManager;
	orderBook?: OrderBook;
	io: SocketServer;
	ledgerService?: LedgerService;
	aiTutorService?: AITutorService;
}) {
	const {
		matchingEngine,
		portfolioManager,
		io,
		ledgerService = defaultLedgerService,
		aiTutorService = initializeAITutorService(matchingEngine),
	} = deps;

	const dirtySymbols = new Set<string>();

	setInterval(() => {
		if (dirtySymbols.size === 0) return;
		for (const symbol of dirtySymbols) {
			const book = matchingEngine.getOrderBook(symbol);
			if (!book) continue;
			const update = {
				symbol,
				bids: book.getTop10Bids(),
				asks: book.getTop10Asks(),
				timestamp: Date.now(),
			};
			// Symbol-specific room broadcast (FR-04)
			io.to(`orderbook:${symbol}`).emit('orderbookUpdate', update);

			// Backward compatibility: emit globally for default symbol
			if (symbol === 'TCS' || symbol === 'DEFAULT') {
				io.emit('orderbookUpdate', update);
			}
		}
		dirtySymbols.clear();
	}, ORDERBOOK_EMIT_INTERVAL_MS);

	function markOrderbookDirty(symbol: string = 'TCS') {
		dirtySymbols.add(symbol);
	}

	return t.router({
		// ── Place Order ──────────────────────────────────────
		placeOrder: t.procedure
			.input(
				z.object({
					token: z.string(),
					symbol: z.string().optional().default('TCS'),
					side: z.enum(['buy', 'sell']),
					price: z.number(),
					quantity: z.number(),
					orderType: z.enum(['LIMIT', 'MARKET']).optional().default('LIMIT'),
				}),
			)
			.mutation(async ({ input }) => {
				const userId = await verifyFirebaseToken(input.token);

				portfolioManager.initializeUser(userId);

				const symbol = input.symbol || 'TCS';
				const order: Order = {
					id: uuidv4(),
					userId,
					symbol,
					side: input.side,
					price: input.price,
					quantity: input.quantity,
					orderType: input.orderType || 'LIMIT',
					timestamp: Date.now(),
				};

				const result = await matchingEngine.placeOrderAsync(order);

				markOrderbookDirty(symbol);

				return result;
			}),

		// ── Cancel Order ─────────────────────────────────────
		cancelOrder: t.procedure
			.input(
				z.object({
					token: z.string(),
					orderId: z.string(),
					symbol: z.string().optional(),
				}),
			)
			.mutation(async ({ input }) => {
				const userId = await verifyFirebaseToken(input.token);
				const result = await matchingEngine.cancelOrderAsync(input.orderId, userId, input.symbol);

				if ('success' in result && result.success) {
					markOrderbookDirty(result.success.symbol || input.symbol || 'TCS');
				} else if (input.symbol) {
					markOrderbookDirty(input.symbol);
				}

				return result;
			}),

		// ── Get Portfolio ────────────────────────────────────
		getPortfolio: t.procedure
			.input(z.object({ token: z.string(), symbol: z.string().optional() }))
			.query(async ({ input }) => {
				const userId = await verifyFirebaseToken(input.token);
				try {
					return await portfolioManager.getPortfolioFromDb(userId, input.symbol);
				} catch {
					return portfolioManager.initializeUser(userId);
				}
			}),

		// ── Get OrderBook Snapshot ────────────────────────────
		getOrderBook: t.procedure
			.input(
				z.object({
					symbol: z.string().optional(),
				}).optional(),
			)
			.query(({ input }) => {
				const symbol = input?.symbol || 'TCS';
				const book = matchingEngine.getOrderBook(symbol) || matchingEngine.getOrderBook();
				return {
					symbol,
					bids: book ? book.getTop10Bids() : [],
					asks: book ? book.getTop10Asks() : [],
					timestamp: Date.now(),
				};
			}),

		// ── Get Supported Symbols & Market Parameters (FR-04) ─
		getSymbols: t.procedure.query(() => {
			return matchingEngine.getAllMarketParams();
		}),

		// ── Extend Market Maker ──────────────────────────────
		extendMarketMaker: t.procedure
			.input(
				z.object({
					token: z.string(),
					durationMs: z.number(),
				}),
			)
			.mutation(async ({ input }) => {
				await verifyFirebaseToken(input.token);
				marketMakerController.extend(input.durationMs);
				return { success: true };
			}),

		// ── Audit Ledger Integrity (NR-05) ───────────────────
		verifyLedger: t.procedure.query(async () => {
			return await ledgerService.verifyLedgerIntegrity();
		}),

		// ── Agentic AI Market Microstructure Tutor (NR-02) ───
		aiTutor: t.router({
			askQuestion: t.procedure
				.input(
					z.object({
						message: z.string().min(1),
						symbol: z.string().optional().default('TCS'),
						token: z.string().optional(),
					}),
				)
				.mutation(async ({ input }) => {
					return await aiTutorService.askQuestion({
						message: input.message,
						symbol: input.symbol,
					});
				}),

			queryQuestion: t.procedure
				.input(
					z.object({
						message: z.string().min(1),
						symbol: z.string().optional().default('TCS'),
					}),
				)
				.query(async ({ input }) => {
					return await aiTutorService.askQuestion({
						message: input.message,
						symbol: input.symbol,
					});
				}),
		}),
	});
}

export type AppRouter = ReturnType<typeof createAppRouter>;
