import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import type { Order, OrderBookSnapshot, OrderBookUpdate, Portfolio, PriceHistoryItem } from '@orderbook/shared';
import type { User } from 'firebase/auth';
import { API_URL } from './trpc';

interface AppState {
	// ── Auth ───────────────────────────────
	user: User | null;
	setUser: (user: User | null) => void;

	// ── Order Book ─────────────────────────
	bids: Order[];
	asks: Order[];
	priceHistory: PriceHistoryItem[];
	lastUpdate: number;

	// ── Portfolio ──────────────────────────
	portfolio: Portfolio | null;
	setPortfolio: (p: Portfolio | null) => void;

	// ── Socket.io ──────────────────────────
	socket: Socket | null;
	connectSocket: () => void;
	disconnectSocket: () => void;

	// ── UI ─────────────────────────────────
	error: string | null;
	setError: (e: string | null) => void;
}

export const useStore = create<AppState>((set, get) => ({
	// Auth
	user: null,
	setUser: (user) => set({ user }),

	// Order Book
	bids: [],
	asks: [],
	priceHistory: [],
	lastUpdate: 0,

	// Portfolio
	portfolio: null,
	setPortfolio: (portfolio) => set({ portfolio }),

	// Socket
	socket: null,
	connectSocket: () => {
		if (get().socket) return; // already connected

		const socket = io(API_URL, {
			transports: ['websocket'],
		});

		socket.on('orderbookSnapshot', (snapshot: OrderBookSnapshot) => {
			set({
				bids: snapshot.bids,
				asks: snapshot.asks,
				priceHistory: snapshot.priceHistory || [],
				lastUpdate: snapshot.timestamp,
			});
		});

		socket.on('orderbookUpdate', (update: OrderBookUpdate) => {
			set({
				bids: update.bids,
				asks: update.asks,
				lastUpdate: update.timestamp,
			});
		});

		socket.on('priceHistoryDelta', (item: PriceHistoryItem) => {
			set((state) => ({
				priceHistory: [...state.priceHistory, item],
			}));
		});

		socket.on('priceHistorySnapshotSync', (compressedHistory: PriceHistoryItem[]) => {
			set({ priceHistory: compressedHistory });
		});

		socket.on('connect', () => {
			console.log('[ws] connected');
		});

		socket.on('disconnect', () => {
			console.log('[ws] disconnected');
		});

		set({ socket });
	},
	disconnectSocket: () => {
		const { socket } = get();
		if (socket) {
			socket.disconnect();
			set({ socket: null });
		}
	},

	// UI
	error: null,
	setError: (error) => set({ error }),
}));
