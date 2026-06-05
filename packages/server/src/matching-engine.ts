import { v4 as uuidv4 } from 'uuid';
import type { Order, Trade, Result, PriceHistoryItem } from '@orderbook/shared';
import type { OrderBook } from './orderbook.js';
import type { PortfolioManager } from './portfolio-manager.js';

/**
 * MatchingEngine
 *
 * Validates incoming orders, runs price-time priority matching,
 * and delegates balance updates to the PortfolioManager.
 */
export class MatchingEngine {
	public priceHistory: PriceHistoryItem[] = [];
	private lastPushTimestamp = 0;

	constructor(
		private orderBook: OrderBook,
		private portfolioManager: PortfolioManager,
	) {}

	private recordTradePrice(price: number) {
		const now = Date.now();
		const timeStr = new Date(now).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});

		if (this.priceHistory.length === 0 || now - this.lastPushTimestamp >= 500) {
			this.priceHistory.push({ time: timeStr, price });
			this.lastPushTimestamp = now;
		} else {
			this.priceHistory[this.priceHistory.length - 1].price = price;
		}
	}

	/**
	 * Validate & match an incoming order against the book.
	 * Returns executed trades + any remaining (resting) order.
	 */
	placeOrder(
		order: Order,
	): Result<{ trades: Trade[]; remainingOrder: Order | null }> {
		// ── Input validation ───────────────────────────────
		if (order.price <= 0) return { error: 'Price must be positive' };
		if (order.quantity <= 0) return { error: 'Quantity must be positive' };
		if (order.price > 1_000_000) return { error: 'Price too high' };
		if (order.quantity > 10_000) return { error: 'Quantity too high' };

		if (
			!this.portfolioManager.canAfford(
				order.userId,
				order.side,
				order.price,
				order.quantity,
			)
		) {
			return { error: 'Insufficient funds' };
		}

		// ── Matching loop
		const trades: Trade[] = [];
		let remainingQty = order.quantity;

		while (remainingQty > 0) {
			const opposite =
				order.side === 'buy'
					? this.orderBook.getBestAsk()
					: this.orderBook.getBestBid();

			if (!opposite) break;

			const canMatch =
				order.side === 'buy'
					? order.price >= opposite.price
					: order.price <= opposite.price;

			if (!canMatch) break;

			// Execute trade at maker's price
			const tradeQty = Math.min(remainingQty, opposite.quantity);

			const trade: Trade = {
				id: uuidv4(),
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
				this.orderBook.removeOrder(opposite.id);
			} else {
				opposite.quantity -= tradeQty;
			}

			this.portfolioManager.executeTrade(trade);
			this.recordTradePrice(trade.price);
		}

		// Remaining quantity rests on the book
		if (remainingQty > 0) {
			const restingOrder: Order = { ...order, quantity: remainingQty };
			this.orderBook.addOrder(restingOrder);
			return { success: { trades, remainingOrder: restingOrder } };
		}

		return { success: { trades, remainingOrder: null } };
	}

	/** Cancel an existing order. */
	cancelOrder(orderId: string, userId: string): Result<Order> {
		const order = this.orderBook.getOrderById(orderId);
		if (!order) return { error: 'Order not found' };
		if (order.userId !== userId) return { error: 'Not your order' };

		this.orderBook.removeOrder(orderId);
		return { success: order };
	}
}
