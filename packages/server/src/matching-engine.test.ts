import { describe, it, expect, beforeEach } from 'vitest';
import { MatchingEngine } from './matching-engine';
import { OrderBook } from './orderbook';
import { OrderBook as NaiveOrderBook } from './orderbook-naive';
import { OrderBook as OptimizedOrderBook } from './orderbook-optimized';
import { PortfolioManager } from './portfolio-manager';
import type { Order } from '@orderbook/shared';
import { v4 as uuidv4 } from 'uuid';

// Test all 3 OrderBook variants to ensure identical behavior
const VARIANTS = [
    { name: 'Baseline', OrderBook },
    { name: 'Naive', OrderBook: NaiveOrderBook },
    { name: 'Optimized', OrderBook: OptimizedOrderBook },
];

VARIANTS.forEach(({ name, OrderBook: OrderBookClass }) => {
    describe(`MatchingEngine with ${name} OrderBook`, () => {
        let orderBook: any;
        let portfolioManager: PortfolioManager;
        let engine: MatchingEngine;

        const USER_A = 'user-a';
        const USER_B = 'user-b';

        beforeEach(() => {
            orderBook = new OrderBookClass();
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

        it('should maintain FIFO order at same price level', () => {
            const order1 = createOrder(USER_A, 'sell', 100, 5);
            const order2 = createOrder(USER_B, 'sell', 100, 5);
            
            engine.placeOrder(order1);
            engine.placeOrder(order2);

            const bestAsk = orderBook.getBestAsk();
            expect(bestAsk?.id).toBe(order1.id); // First in, first out
        });

        it('should handle complex multi-price scenarios', () => {
            // Build a book with multiple price levels
            engine.placeOrder(createOrder(USER_B, 'sell', 98, 3));
            engine.placeOrder(createOrder(USER_B, 'sell', 99, 2));
            engine.placeOrder(createOrder(USER_B, 'sell', 100, 4));
            engine.placeOrder(createOrder(USER_B, 'sell', 101, 1));

            // Sweep through multiple levels
            const result = engine.placeOrder(createOrder(USER_A, 'buy', 100, 7));

            expect(result.success?.trades).toHaveLength(3);
            expect(result.success?.trades[0].price).toBe(98);
            expect(result.success?.trades[1].price).toBe(99);
            expect(result.success?.trades[2].price).toBe(100);
            expect(result.success?.trades[2].quantity).toBe(2); // Partial fill

            // Check remaining book state
            expect(orderBook.getBestAsk()?.price).toBe(100);
            expect(orderBook.getBestAsk()?.quantity).toBe(2);
        });
    });
});

describe('Multi-Symbol Architecture & Market Parameters (FR-04 / S2-04)', () => {
    let engine: MatchingEngine;
    let pm: PortfolioManager;

    const ALICE = 'user-alice';
    const BOB = 'user-bob';

    beforeEach(() => {
        pm = new PortfolioManager();
        // MatchingEngine with default 4 core symbols: TCS, INFY, RELIANCE, HDFCBANK
        engine = new MatchingEngine(undefined, pm);
        pm.initializeUser(ALICE);
        pm.initializeUser(BOB);
        // Deposit sufficient funds for Indian equity price ranges
        pm.deposit(ALICE, { usd: 1_000_000, stocks: 500 });
        pm.deposit(BOB, { usd: 1_000_000, stocks: 500 });
    });

    it('can concurrently submit and match orders for TCS and INFY without state crosstalk', () => {
        const tcsBook = engine.getOrderBook('TCS')!;
        const infyBook = engine.getOrderBook('INFY')!;

        expect(tcsBook).toBeDefined();
        expect(infyBook).toBeDefined();

        // 1. Place resting sell orders:
        // TCS base price 3500: sell 10 shares @ ₹3,500.00
        const tcsSell: Order = {
            id: uuidv4(),
            userId: BOB,
            symbol: 'TCS',
            side: 'sell',
            price: 3500.00,
            quantity: 10,
            timestamp: Date.now(),
        };
        const tcsSellRes = engine.placeOrder(tcsSell);
        expect(tcsSellRes.success).toBeDefined();
        expect(tcsBook.size).toBe(1);
        expect(infyBook.size).toBe(0);

        // INFY base price 1500: sell 10 shares @ ₹1,500.00
        const infySell: Order = {
            id: uuidv4(),
            userId: BOB,
            symbol: 'INFY',
            side: 'sell',
            price: 1500.00,
            quantity: 10,
            timestamp: Date.now(),
        };
        const infySellRes = engine.placeOrder(infySell);
        expect(infySellRes.success).toBeDefined();
        expect(tcsBook.size).toBe(1);
        expect(infyBook.size).toBe(1);

        // 2. Aggressive buy order on TCS: buy 4 shares @ ₹3,500.00
        const tcsBuy: Order = {
            id: uuidv4(),
            userId: ALICE,
            symbol: 'TCS',
            side: 'buy',
            price: 3500.00,
            quantity: 4,
            timestamp: Date.now(),
        };
        const tcsMatchRes = engine.placeOrder(tcsBuy);
        expect(tcsMatchRes.success?.trades).toHaveLength(1);
        expect(tcsMatchRes.success?.trades[0].symbol).toBe('TCS');
        expect(tcsMatchRes.success?.trades[0].price).toBe(3500.00);
        expect(tcsMatchRes.success?.trades[0].quantity).toBe(4);

        // State verification: TCS book now has 6 resting shares; INFY book is completely untouched (10 shares)
        expect(tcsBook.getBestAsk()?.quantity).toBe(6);
        expect(infyBook.getBestAsk()?.quantity).toBe(10);
        expect(infyBook.getBestAsk()?.price).toBe(1500.00);

        // 3. Aggressive buy order on INFY: buy 10 shares @ ₹1,500.00
        const infyBuy: Order = {
            id: uuidv4(),
            userId: ALICE,
            symbol: 'INFY',
            side: 'buy',
            price: 1500.00,
            quantity: 10,
            timestamp: Date.now(),
        };
        const infyMatchRes = engine.placeOrder(infyBuy);
        expect(infyMatchRes.success?.trades).toHaveLength(1);
        expect(infyMatchRes.success?.trades[0].symbol).toBe('INFY');
        expect(infyMatchRes.success?.trades[0].price).toBe(1500.00);
        expect(infyMatchRes.success?.trades[0].quantity).toBe(10);

        // INFY book is now completely clear; TCS book still has its 6 resting shares
        expect(infyBook.size).toBe(0);
        expect(tcsBook.size).toBe(1);
        expect(tcsBook.getBestAsk()?.quantity).toBe(6);
    });

    it('rejects an order for ₹1,400.03 for invalid tick size (must be ₹1,400.05)', () => {
        const order: Order = {
            id: uuidv4(),
            userId: ALICE,
            symbol: 'INFY',
            side: 'buy',
            price: 1400.03, // Invalid tick: not a multiple of 0.05
            quantity: 5,
            timestamp: Date.now(),
        };

        const result = engine.placeOrder(order);
        expect(result.error).toBeDefined();
        expect(result.error).toMatch(/Invalid tick size.*1400\.03.*0\.05/i);

        // Conforming tick size ₹1,400.05 succeeds
        const validOrder: Order = {
            ...order,
            id: uuidv4(),
            price: 1400.05,
        };
        const validResult = engine.placeOrder(validOrder);
        expect(validResult.success).toBeDefined();
    });

    it('rejects an order placed outside the ±10% circuit band with an explanatory message', () => {
        // INFY base price is 1500.00 -> ±10% circuit band is [1350.00, 1650.00]
        
        // 1. Price above upper limit (+10%): ₹1,700.00
        const orderHigh: Order = {
            id: uuidv4(),
            userId: ALICE,
            symbol: 'INFY',
            side: 'buy',
            price: 1700.00,
            quantity: 1,
            timestamp: Date.now(),
        };
        const resHigh = engine.placeOrder(orderHigh);
        expect(resHigh.error).toBeDefined();
        expect(resHigh.error).toContain('outside the ±10% circuit band [₹1350.00, ₹1650.00] for INFY');

        // 2. Price below lower limit (-10%): ₹1,300.00
        const orderLow: Order = {
            id: uuidv4(),
            userId: ALICE,
            symbol: 'INFY',
            side: 'buy',
            price: 1300.00,
            quantity: 1,
            timestamp: Date.now(),
        };
        const resLow = engine.placeOrder(orderLow);
        expect(resLow.error).toBeDefined();
        expect(resLow.error).toContain('outside the ±10% circuit band [₹1350.00, ₹1650.00] for INFY');

        // 3. Orders exactly on the boundary: ₹1,350.00 and ₹1,650.00 must be accepted
        const orderBoundaryLower: Order = {
            id: uuidv4(),
            userId: ALICE,
            symbol: 'INFY',
            side: 'buy',
            price: 1350.00,
            quantity: 1,
            timestamp: Date.now(),
        };
        expect(engine.placeOrder(orderBoundaryLower).success).toBeDefined();

        const orderBoundaryUpper: Order = {
            id: uuidv4(),
            userId: BOB,
            symbol: 'INFY',
            side: 'sell',
            price: 1650.00,
            quantity: 1,
            timestamp: Date.now(),
        };
        expect(engine.placeOrder(orderBoundaryUpper).success).toBeDefined();

        // 4. Test TCS base price ₹3,500.00 -> band is [₹3150.00, ₹3850.00]
        const tcsHigh: Order = {
            id: uuidv4(),
            userId: ALICE,
            symbol: 'TCS',
            side: 'buy',
            price: 3900.00,
            quantity: 1,
            timestamp: Date.now(),
        };
        const resTcsHigh = engine.placeOrder(tcsHigh);
        expect(resTcsHigh.error).toBeDefined();
        expect(resTcsHigh.error).toContain('outside the ±10% circuit band [₹3150.00, ₹3850.00] for TCS');
    });

    it('rejects orders for halted symbols', () => {
        engine.setMarketParams('RELIANCE', {
            symbol: 'RELIANCE',
            tickSize: 0.05,
            lotSize: 1,
            basePrice: 2500.00,
            circuitLimitPct: 10.0,
            isHalted: true,
        });

        const order: Order = {
            id: uuidv4(),
            userId: ALICE,
            symbol: 'RELIANCE',
            side: 'buy',
            price: 2500.00,
            quantity: 1,
            timestamp: Date.now(),
        };

        const res = engine.placeOrder(order);
        expect(res.error).toBe('Trading is halted for symbol RELIANCE');
    });

    it('validates standard lot sizes', () => {
        engine.setMarketParams('HDFCBANK', {
            symbol: 'HDFCBANK',
            tickSize: 0.05,
            lotSize: 5, // custom lot size of 5 shares
            basePrice: 1600.00,
            circuitLimitPct: 10.0,
            isHalted: false,
        });

        const invalidOrder: Order = {
            id: uuidv4(),
            userId: ALICE,
            symbol: 'HDFCBANK',
            side: 'buy',
            price: 1600.00,
            quantity: 7, // not a multiple of 5
            timestamp: Date.now(),
        };

        const res = engine.placeOrder(invalidOrder);
        expect(res.error).toMatch(/Invalid lot size.*quantity 7 must be a multiple of lot size 5/i);

        const validOrder: Order = {
            ...invalidOrder,
            id: uuidv4(),
            quantity: 10,
        };
        expect(engine.placeOrder(validOrder).success).toBeDefined();
    });

    it('supports symbol-specific order cancellations', () => {
        const order: Order = {
            id: uuidv4(),
            userId: ALICE,
            symbol: 'TCS',
            side: 'buy',
            price: 3500.00,
            quantity: 5,
            timestamp: Date.now(),
        };

        engine.placeOrder(order);
        expect(engine.getOrderBook('TCS')?.size).toBe(1);

        // Cancel with explicit symbol
        const cancelRes = engine.cancelOrder(order.id, ALICE, 'TCS');
        expect(cancelRes.success).toBeDefined();
        expect(engine.getOrderBook('TCS')?.size).toBe(0);
    });

    it('tracks price history per symbol independently', () => {
        // Trade in TCS
        engine.placeOrder({
            id: uuidv4(),
            userId: BOB,
            symbol: 'TCS',
            side: 'sell',
            price: 3500.00,
            quantity: 2,
            timestamp: Date.now(),
        });
        engine.placeOrder({
            id: uuidv4(),
            userId: ALICE,
            symbol: 'TCS',
            side: 'buy',
            price: 3500.00,
            quantity: 2,
            timestamp: Date.now(),
        });

        // Trade in INFY
        engine.placeOrder({
            id: uuidv4(),
            userId: BOB,
            symbol: 'INFY',
            side: 'sell',
            price: 1520.00,
            quantity: 5,
            timestamp: Date.now(),
        });
        engine.placeOrder({
            id: uuidv4(),
            userId: ALICE,
            symbol: 'INFY',
            side: 'buy',
            price: 1520.00,
            quantity: 5,
            timestamp: Date.now(),
        });

        const tcsHistory = engine.getPriceHistory('TCS');
        const infyHistory = engine.getPriceHistory('INFY');

        expect(tcsHistory.length).toBeGreaterThan(0);
        expect(tcsHistory[0].price).toBe(3500.00);

        expect(infyHistory.length).toBeGreaterThan(0);
        expect(infyHistory[0].price).toBe(1520.00);
    });
});


