import axios, { type AxiosInstance } from 'axios';
import type { Order, Trade } from '@orderbook/shared';

const GO_SERVICE_URL = process.env.GO_SERVICE_URL || 'http://localhost:8080';

/**
 * GoMatchingEngineClient - HTTP client for communicating with Go matching engine
 * 
 * This client wraps HTTP calls to the Go service, providing a simple interface
 * that matches the original TypeScript MatchingEngine API.
 */
export class GoMatchingEngineClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: GO_SERVICE_URL,
      timeout: 5000, // 5 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Place an order - sends HTTP request to Go service
   */
  async placeOrder(order: Order): Promise<{
    trades: Trade[];
    remainingOrder: Order | null;
    error?: string;
  }> {
    try {
      const response = await this.client.post('/place-order', order);
      
      return {
        trades: response.data.trades || [],
        remainingOrder: response.data.remainingOrder || null,
        error: response.data.error,
      };
    } catch (error) {
      console.error('Failed to communicate with Go service:', error);
      return {
        trades: [],
        remainingOrder: null,
        error: 'Failed to communicate with matching engine',
      };
    }
  }

  /**
   * Get current orderbook snapshot
   */
  async getOrderBook(): Promise<{ bids: Order[]; asks: Order[] }> {
    try {
      const response = await this.client.get('/orderbook');
      return {
        bids: response.data.bids || [],
        asks: response.data.asks || [],
      };
    } catch (error) {
      console.error('Failed to get orderbook:', error);
      return { bids: [], asks: [] };
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, userId: string): Promise<{
    order: Order | null;
    error?: string;
  }> {
    try {
      const response = await this.client.post('/cancel-order', {
        orderId,
        userId,
      });
      return {
        order: response.data.order || null,
        error: response.data.error,
      };
    } catch (error) {
      console.error('Failed to cancel order:', error);
      return {
        order: null,
        error: 'Failed to communicate with matching engine',
      };
    }
  }

  /**
   * Health check - verify Go service is running
   */
  async health(): Promise<{ status: string; orders: number }> {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      throw new Error('Go service is not reachable');
    }
  }
}
