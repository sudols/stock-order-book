import type { Portfolio, Trade } from '@orderbook/shared';

const STARTING_USD = 10_000;
const STARTING_STOCKS = 100;

/**
 * PortfolioManager — In-memory balance tracking.
 *
 * Every user starts with $10,000 USD and 100 stocks.
 * Balances update atomically when a trade executes.
 */
export class PortfolioManager {
  private portfolios = new Map<string, Portfolio>();

  /** Create portfolio for a new user (idempotent). */
  initializeUser(userId: string): Portfolio {
    if (this.portfolios.has(userId)) {
      return this.portfolios.get(userId)!;
    }
    const portfolio: Portfolio = { usd: STARTING_USD, stocks: STARTING_STOCKS };
    this.portfolios.set(userId, portfolio);
    return portfolio;
  }

  getPortfolio(userId: string): Portfolio | null {
    return this.portfolios.get(userId) || null;
  }

  /** Pre-trade check: can the user afford this order? */
  canAfford(userId: string, side: 'buy' | 'sell', price: number, quantity: number): boolean {
    const p = this.portfolios.get(userId);
    if (!p) return false;

    if (side === 'buy') {
      return p.usd >= price * quantity;
    } else {
      return p.stocks >= quantity;
    }
  }

  /** Update buyer & seller balances after a trade. */
  executeTrade(trade: Trade): void {
    const buyer = this.portfolios.get(trade.buyerId);
    if (buyer) {
      buyer.usd -= trade.price * trade.quantity;
      buyer.stocks += trade.quantity;
    }

    const seller = this.portfolios.get(trade.sellerId);
    if (seller) {
      seller.usd += trade.price * trade.quantity;
      seller.stocks -= trade.quantity;
    }
  }
}
