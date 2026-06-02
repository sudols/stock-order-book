import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../server/src/routers/app';

export const trpc = createTRPCProxyClient<AppRouter>({
	links: [
		httpBatchLink({
			url: 'http://localhost:3001/trpc',
		}),
	],
});
