import { describe, it, expect, beforeEach } from 'vitest';
import { MatchingEngine } from './matching-engine';
import { OrderBook } from './orderbook';
import { PortfolioManager } from './portfolio-manager';
import type { Order } from '@orderbook/shared';
import { v4 as uuidv4 } from 'uuid';

describe('MatchingEngine', () => {
    let orderBook: OrderBook;
    let portfolioManager: PortfolioManager;
    let engine: MatchingEngine;

    const USER_A = 'user-a';
    const USER_B = 'user-b';

    beforeEach(() => {
        orderBook = new OrderBook();
        portfolioManager = new PortfolioManager();
        engine = new MatchingEngine(orderBook, portfolioManager);
        portfolioManager.initializeUser(USER_A);
        portfolioManager.initializeUser(USER_B);
    });

    function createOrder(
        userId: string,
        side: 'buy' | 'sell',
        price: number,
        quantity: number,
    ): Order {
        return {
            id: uuidv4(),
            userId,
            side,
            price,
            quantity,
            timestamp: Date.now(),
        };
    }

    it('should execute a perfect match trade', () => {
        const order = createOrder(USER_A, 'buy', 100, 10);
        engine.placeOrder(order);
        
        const result = engine.placeOrder(createOrder(USER_B, 'sell', 100, 10));
        
        expect(result.success?.trades).toHaveLength(1);
        expect(result.success?.trades[0].price).toBe(100);
        expect(orderBook.size).toBe(0);

        const pA = portfolioManager.getPortfolio(USER_A);
        expect(pA?.usd).toBe(9000); // 10000 - 1000
    });

    it('should handle partial fills', () => {
        engine.placeOrder(createOrder(USER_A, 'buy', 100, 10));
        const result = engine.placeOrder(createOrder(USER_B, 'sell', 100, 4));

        expect(result.success?.trades[0].quantity).toBe(4);
        expect(orderBook.getBestBid()?.quantity).toBe(6);
    });

    it('should handle multi-level fills', () => {
        engine.placeOrder(createOrder(USER_B, 'sell', 99, 5));
        engine.placeOrder(createOrder(USER_B, 'sell', 100, 5));

        const result = engine.placeOrder(createOrder(USER_A, 'buy', 100, 8));
        
        expect(result.success?.trades).toHaveLength(2);
        expect(result.success?.trades[0].price).toBe(99); 
        expect(result.success?.trades[1].price).toBe(100);
    });

    it('should reject insufficient funds', () => {
        const result = engine.placeOrder(createOrder(USER_A, 'buy', 100, 1000));
        expect(result.error).toBe('Insufficient funds');
    });

    it('should reject invalid inputs', () => {
        expect(engine.placeOrder(createOrder(USER_A, 'buy', -100, 10)).error).toBeDefined();
    });

    it('should support cancellations', () => {
        const order = createOrder(USER_A, 'buy', 100, 10);
        engine.placeOrder(order);
        expect(orderBook.size).toBe(1);
        
        engine.cancelOrder(order.id, USER_A);
        expect(orderBook.size).toBe(0);
    });
});
