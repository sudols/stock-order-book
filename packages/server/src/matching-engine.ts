import { v4 as uuidv4 } from 'uuid';
import {
	type Order,
	type Trade,
	type Result,
	type PriceHistoryItem,
	type MarketParams,
	DEFAULT_MARKET_PARAMS,
	SUPPORTED_SYMBOLS,
} from '@orderbook/shared';
import { OrderBook } from './orderbook.js';
import type { PortfolioManager, SettlementResult } from './portfolio-manager.js';

/**
 * MatchingEngine (Multi-Symbol Architecture — FR-04)
 *
 * Maintains independent, concurrent order books for multiple symbols (TCS, INFY, RELIANCE, HDFCBANK).
 * Enforces market parameters:
 *   - Minimum Tick Size (e.g. ₹0.05)
 *   - Standard Lot Size (e.g. 1 share)
 *   - Dynamic Daily Circuit Breakers (±10% band around basePrice)
 *   - Trading Halt status
 *
 * Runs price-time priority matching per symbol and delegates balance updates to PortfolioManager.
 */
export class MatchingEngine {
	private orderBooks: Map<string, OrderBook> = new Map();
	private marketParams: Map<string, MarketParams> = new Map();
	private priceHistories: Map<string, PriceHistoryItem[]> = new Map();
	private lastPushTimestamps: Map<string, number> = new Map();
	public defaultSymbol: string = 'DEFAULT';

	public onPriceHistoryPush?: (item: PriceHistoryItem, symbol: string) => void;
	public onPriceHistorySnapshot?: (history: PriceHistoryItem[], symbol: string) => void;

	constructor(
		booksOrBook?: OrderBook | Map<string, OrderBook> | Record<string, OrderBook>,
		private portfolioManager?: PortfolioManager,
		params?: Map<string, MarketParams> | Record<string, MarketParams>,
	) {
		// 1. Initialize Market Parameters
		if (params) {
			if (params instanceof Map) {
				this.marketParams = new Map(params);
			} else {
				this.marketParams = new Map(Object.entries(params));
			}
		} else {
			for (const [sym, config] of Object.entries(DEFAULT_MARKET_PARAMS)) {
				this.marketParams.set(sym, { ...config });
			}
		}

		// 2. Initialize Order Books
		if (booksOrBook instanceof Map) {
			this.orderBooks = new Map(booksOrBook);
			const firstKey = booksOrBook.keys().next().value;
			if (firstKey) this.defaultSymbol = firstKey;
		} else if (
			booksOrBook &&
			typeof booksOrBook === 'object' &&
			!('addOrder' in booksOrBook)
		) {
			this.orderBooks = new Map(Object.entries(booksOrBook));
			const firstKey = Object.keys(booksOrBook)[0];
			if (firstKey) this.defaultSymbol = firstKey;
		} else if (booksOrBook && 'addOrder' in booksOrBook) {
			const sym = (booksOrBook as OrderBook).symbol || 'DEFAULT';
			this.orderBooks.set(sym, booksOrBook as OrderBook);
			this.defaultSymbol = sym;
		} else {
			// Default initialization for core symbols
			for (const sym of SUPPORTED_SYMBOLS) {
				this.orderBooks.set(sym, new OrderBook(sym));
			}
			this.defaultSymbol = 'TCS';
		}
	}

	/**
	 * Retrieve the order book for a given symbol, or default.
	 */
	public getOrderBook(symbol: string = this.defaultSymbol): OrderBook | undefined {
		return this.orderBooks.get(symbol);
	}

	/**
	 * Retrieve or create an order book for a symbol.
	 */
	public getOrCreateOrderBook(symbol: string = this.defaultSymbol): OrderBook {
		let book = this.orderBooks.get(symbol);
		if (!book) {
			book = new OrderBook(symbol);
			this.orderBooks.set(symbol, book);
		}
		return book;
	}

	/**
	 * Get all managed order books.
	 */
	public getAllOrderBooks(): Map<string, OrderBook> {
		return this.orderBooks;
	}

	/**
	 * Get market parameters for a symbol.
	 */
	public getMarketParams(symbol: string): MarketParams | undefined {
		return this.marketParams.get(symbol);
	}

	/**
	 * Set or update market parameters for a symbol.
	 */
	public setMarketParams(symbol: string, params: MarketParams): void {
		this.marketParams.set(symbol, { ...params });
	}

	/**
	 * Get all registered market parameters.
	 */
	public getAllMarketParams(): Record<string, MarketParams> {
		const result: Record<string, MarketParams> = {};
		for (const [sym, p] of this.marketParams.entries()) {
			result[sym] = { ...p };
		}
		return result;
	}

	/**
	 * Backward compatibility: returns price history for default symbol.
	 */
	get priceHistory(): PriceHistoryItem[] {
		return this.getPriceHistory(this.defaultSymbol);
	}

	/**
	 * Get price history for a specific symbol.
	 */
	public getPriceHistory(symbol: string = this.defaultSymbol): PriceHistoryItem[] {
		return this.priceHistories.get(symbol) ?? [];
	}

	private recordTradePrice(symbol: string, price: number) {
		const now = Date.now();
		const timeStr = new Date(now).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});

		let history = this.priceHistories.get(symbol);
		if (!history) {
			history = [];
			this.priceHistories.set(symbol, history);
		}

		const lastPush = this.lastPushTimestamps.get(symbol) ?? 0;
		if (history.length === 0 || now - lastPush >= 500) {
			const newItem: PriceHistoryItem = { time: timeStr, price, symbol };
			history.push(newItem);
			this.lastPushTimestamps.set(symbol, now);

			if (history.length >= 400) {
				const compressed = history.filter((_, idx) => idx % 2 === 0);
				this.priceHistories.set(symbol, compressed);
				this.onPriceHistorySnapshot?.(compressed, symbol);
				console.log(`[${symbol}] Compression snapshot pushed`);
			} else {
				this.onPriceHistoryPush?.(newItem, symbol);
			}
		}
	}

	/**
	 * Validate & match an incoming order against the appropriate symbol book.
	 * Returns executed trades + any remaining (resting) order.
	 */
	/**
	 * Validate & match an incoming order against the appropriate symbol book (synchronous).
	 * Returns executed trades + any remaining (resting) order.
	 */
	placeOrder(
		order: Order,
	): Result<{ trades: Trade[]; remainingOrder: Order | null }> {
		const symbol = order.symbol || this.defaultSymbol;
		const isMarket = order.orderType === 'MARKET';

		// ── Input validation ───────────────────────────────
		if (isMarket) {
			if (order.price <= 0) {
				order.price = order.side === 'buy' ? 1_000_000 : 0.05;
			}
		} else {
			if (order.price <= 0) return { error: 'Price must be positive' };
			if (order.price > 1_000_000) return { error: 'Price too high' };
		}
		if (order.quantity <= 0) return { error: 'Quantity must be positive' };
		if (order.quantity > 10_000) return { error: 'Quantity too high' };

		// ── Market Parameters Validation (FR-04) ───────────
		const params = this.marketParams.get(symbol);
		if (params) {
			// 1. Trading Halt check
			if (params.isHalted) {
				return { error: `Trading is halted for symbol ${symbol}` };
			}

			// 2. Standard Lot Size check
			if (params.lotSize > 0 && order.quantity % params.lotSize !== 0) {
				return {
					error: `Invalid lot size: quantity ${order.quantity} must be a multiple of lot size ${params.lotSize}`,
				};
			}

			// 3. Minimum Tick Size check (e.g. ₹0.05) - only for limit orders
			if (!isMarket && params.tickSize > 0) {
				const ticks = order.price / params.tickSize;
				const roundedTicks = Math.round(ticks);
				if (Math.abs(ticks - roundedTicks) > 1e-5) {
					return {
						error: `Invalid tick size: price ₹${order.price.toFixed(2)} must be a multiple of ₹${params.tickSize.toFixed(2)}`,
					};
				}
			}

			// 4. Dynamic Daily Circuit Breakers (±10% band around basePrice) - only for limit orders
			if (!isMarket && params.basePrice > 0) {
				const limitPct = params.circuitLimitPct ?? 10.0;
				const lowerBand = Number(
					(params.basePrice * (1 - limitPct / 100)).toFixed(2),
				);
				const upperBand = Number(
					(params.basePrice * (1 + limitPct / 100)).toFixed(2),
				);

				if (order.price < lowerBand - 1e-5 || order.price > upperBand + 1e-5) {
					return {
						error: `Price ₹${order.price.toFixed(2)} is outside the ±${limitPct}% circuit band [₹${lowerBand.toFixed(2)}, ₹${upperBand.toFixed(2)}] for ${symbol}`,
					};
				}
			}
		}

		// ── Balance Affordability Check ─────────────────────
		if (
			this.portfolioManager &&
			!this.portfolioManager.canAfford(
				order.userId,
				order.side,
				order.price,
				order.quantity,
			)
		) {
			return { error: 'Insufficient funds' };
		}

		// ── Retrieve OrderBook for Symbol ───────────────────
		const book = this.getOrCreateOrderBook(symbol);

		// ── Matching loop ──────────────────────────────────
		const trades: Trade[] = [];
		let remainingQty = order.quantity;

		while (remainingQty > 0) {
			const opposite =
				order.side === 'buy'
					? book.getBestAsk()
					: book.getBestBid();

			if (!opposite) break;

			const canMatch = isMarket
				? true
				: order.side === 'buy'
					? order.price >= opposite.price
					: order.price <= opposite.price;

			if (!canMatch) break;

			// Execute trade at maker's price
			const tradeQty = Math.min(remainingQty, opposite.quantity);

			const trade: Trade = {
				id: uuidv4(),
				symbol,
				buyOrderId: order.side === 'buy' ? order.id : opposite.id,
				sellOrderId: order.side === 'sell' ? order.id : opposite.id,
				buyerId: order.side === 'buy' ? order.userId : opposite.userId,
				sellerId: order.side === 'sell' ? order.userId : opposite.userId,
				price: opposite.price, // taker gets maker's price
				quantity: tradeQty,
				timestamp: Date.now(),
			};

			trades.push(trade);
			remainingQty -= tradeQty;

			// Update or remove the resting order
			if (opposite.quantity === tradeQty) {
				book.removeOrder(opposite.id);
			} else {
				opposite.quantity -= tradeQty;
			}

			if (this.portfolioManager) {
				this.portfolioManager.executeTrade(trade);
			}
			this.recordTradePrice(symbol, trade.price);
		}

		// Remaining quantity rests on the book (only for limit orders)
		if (remainingQty > 0 && !isMarket) {
			const restingOrder: Order = { ...order, symbol, quantity: remainingQty };
			book.addOrder(restingOrder);
			return { success: { trades, remainingOrder: restingOrder } };
		}

		return { success: { trades, remainingOrder: null } };
	}

	/**
	 * Asynchronously validate, match, and atomically settle an incoming order (NR-01 / S2-05).
	 * If matching generates trades, executes multi-counterparty atomic settlement under
	 * REPEATABLE READ isolation. If settlement fails, book modifications are cleanly rolled back.
	 */
	async placeOrderAsync(
		order: Order,
	): Promise<Result<{ trades: Trade[]; remainingOrder: Order | null; settlement?: SettlementResult }>> {
		const symbol = order.symbol || this.defaultSymbol;
		const isMarket = order.orderType === 'MARKET';

		// ── Input validation ───────────────────────────────
		if (isMarket) {
			if (order.price <= 0) {
				order.price = order.side === 'buy' ? 1_000_000 : 0.05;
			}
		} else {
			if (order.price <= 0) return { error: 'Price must be positive' };
			if (order.price > 1_000_000) return { error: 'Price too high' };
		}
		if (order.quantity <= 0) return { error: 'Quantity must be positive' };
		if (order.quantity > 10_000) return { error: 'Quantity too high' };

		// ── Market Parameters Validation (FR-04) ───────────
		const params = this.marketParams.get(symbol);
		if (params) {
			// 1. Trading Halt check
			if (params.isHalted) {
				return { error: `Trading is halted for symbol ${symbol}` };
			}

			// 2. Standard Lot Size check
			if (params.lotSize > 0 && order.quantity % params.lotSize !== 0) {
				return {
					error: `Invalid lot size: quantity ${order.quantity} must be a multiple of lot size ${params.lotSize}`,
				};
			}

			// 3. Minimum Tick Size check (e.g. ₹0.05) - only for limit orders
			if (!isMarket && params.tickSize > 0) {
				const ticks = order.price / params.tickSize;
				const roundedTicks = Math.round(ticks);
				if (Math.abs(ticks - roundedTicks) > 1e-5) {
					return {
						error: `Invalid tick size: price ₹${order.price.toFixed(2)} must be a multiple of ₹${params.tickSize.toFixed(2)}`,
					};
				}
			}

			// 4. Dynamic Daily Circuit Breakers (±10% band around basePrice) - only for limit orders
			if (!isMarket && params.basePrice > 0) {
				const limitPct = params.circuitLimitPct ?? 10.0;
				const lowerBand = Number(
					(params.basePrice * (1 - limitPct / 100)).toFixed(2),
				);
				const upperBand = Number(
					(params.basePrice * (1 + limitPct / 100)).toFixed(2),
				);

				if (order.price < lowerBand - 1e-5 || order.price > upperBand + 1e-5) {
					return {
						error: `Price ₹${order.price.toFixed(2)} is outside the ±${limitPct}% circuit band [₹${lowerBand.toFixed(2)}, ₹${upperBand.toFixed(2)}] for ${symbol}`,
					};
				}
			}
		}

		// ── Retrieve OrderBook for Symbol ───────────────────
		const book = this.getOrCreateOrderBook(symbol);

		// ── Matching loop with Rollback Stack ───────────────
		interface RestingRollbackItem {
			order: Order;
			hadRemaining: boolean;
			originalQty: number;
		}

		const rollbackStack: RestingRollbackItem[] = [];
		const trades: Trade[] = [];
		let remainingQty = order.quantity;

		while (remainingQty > 0) {
			const opposite =
				order.side === 'buy'
					? book.getBestAsk()
					: book.getBestBid();

			if (!opposite) break;

			const canMatch = isMarket
				? true
				: order.side === 'buy'
					? order.price >= opposite.price
					: order.price <= opposite.price;

			if (!canMatch) break;

			const tradeQty = Math.min(remainingQty, opposite.quantity);

			rollbackStack.push({
				order: { ...opposite },
				hadRemaining: opposite.quantity > tradeQty,
				originalQty: opposite.quantity,
			});

			const trade: Trade = {
				id: uuidv4(),
				symbol,
				buyOrderId: order.side === 'buy' ? order.id : opposite.id,
				sellOrderId: order.side === 'sell' ? order.id : opposite.id,
				buyerId: order.side === 'buy' ? order.userId : opposite.userId,
				sellerId: order.side === 'sell' ? order.userId : opposite.userId,
				price: opposite.price,
				quantity: tradeQty,
				timestamp: Date.now(),
			};

			trades.push(trade);
			remainingQty -= tradeQty;

			if (opposite.quantity === tradeQty) {
				book.removeOrder(opposite.id);
			} else {
				opposite.quantity -= tradeQty;
			}
		}

		// ── Multi-Counterparty Atomic Settlement (S2-05) ────
		let settlement: SettlementResult | undefined;

		if (trades.length > 0 && this.portfolioManager) {
			try {
				settlement = await this.portfolioManager.settleTradesAtomic({
					trades,
					takerOrder: order,
					symbolId: symbol,
				});
			} catch (err: any) {
				// Cleanly rollback in-memory book modifications
				for (let i = rollbackStack.length - 1; i >= 0; i--) {
					const item = rollbackStack[i];
					if (!item.hadRemaining) {
						book.addOrder({ ...item.order, quantity: item.originalQty });
					} else {
						const existing = book.getOrderById(item.order.id);
						if (existing) {
							existing.quantity = item.originalQty;
						} else {
							book.addOrder({ ...item.order, quantity: item.originalQty });
						}
					}
				}
				return { error: err.message || 'Atomic settlement failed' };
			}

			for (const t of trades) {
				this.recordTradePrice(symbol, t.price);
			}
		}

		// Remaining quantity rests on the book (limit orders only)
		if (remainingQty > 0 && !isMarket) {
			const restingOrder: Order = { ...order, symbol, quantity: remainingQty };
			book.addOrder(restingOrder);

			if (this.portfolioManager) {
				try {
					await this.portfolioManager.lockFundsForOrder(restingOrder);
				} catch (err: any) {
					book.removeOrder(restingOrder.id);
					return { error: err.message || 'Failed to lock funds for resting order' };
				}
			}

			return { success: { trades, remainingOrder: restingOrder, settlement } };
		}

		return { success: { trades, remainingOrder: null, settlement } };
	}

	/** Cancel an existing order by ID and optional symbol. */
	cancelOrder(orderId: string, userId: string, symbol?: string): Result<Order> {
		if (symbol) {
			const book = this.orderBooks.get(symbol);
			if (!book) return { error: 'Order not found' };
			const order = book.getOrderById(orderId);
			if (!order) return { error: 'Order not found' };
			if (order.userId !== userId) return { error: 'Not your order' };

			book.removeOrder(orderId);
			return { success: order };
		}

		// If no symbol specified, search across all books
		for (const book of this.orderBooks.values()) {
			const order = book.getOrderById(orderId);
			if (order) {
				if (order.userId !== userId) return { error: 'Not your order' };
				book.removeOrder(orderId);
				return { success: order };
			}
		}

		return { error: 'Order not found' };
	}

	/** Asynchronously cancel order and release locked funds */
	async cancelOrderAsync(orderId: string, userId: string, symbol?: string): Promise<Result<Order>> {
		const result = this.cancelOrder(orderId, userId, symbol);
		if ('success' in result && result.success && this.portfolioManager) {
			try {
				await this.portfolioManager.unlockFundsForOrder(result.success);
			} catch (err: any) {
				console.warn('Failed to unlock funds on order cancellation:', err);
			}
		}
		return result;
	}

	/** Clear all books and price histories (useful for testing). */
	clearAll(): void {
		for (const book of this.orderBooks.values()) {
			book.clear();
		}
		this.priceHistories.clear();
		this.lastPushTimestamps.clear();
	}
}
