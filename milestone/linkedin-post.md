Built a real-time stock order book from scratch.
Here's what actually took the most time — and it wasn't the UI.

---

We built a stock trading simulator for our course subject this semester. It is not connected to any real exchange,
no real money. Just a clean full-stack system that shows how buy and sell orders works.

The hardest part?
It wasn't the frontend or auth or even the WebSocket setup. It was the order book data structure itself.

We ended up building **three different versions** of it:

→ **Naive** — just pushed orders into an array and sorted the whole thing on every insert. It was simple enough to implement. Got us a working prototype in no time. It works fine for first 10 orders. But falls apart at scale. O(n log n) after 10000 orders/sec.

→ **Hybrid** — switched to HashMaps for price-level lookups + sorted arrays for best bid/ask access.
This was much faster. But the removal task still needed array splicing that was again O(n) operation. Progress, but not ideal.

→ **Optimized** — Final version uses a doubly-linked list at each price level. Now... order cancellation became a pointer swap.
O(1) removal, big improvement. Benchmark showed a **~7x difference** between the worst and best version.

---

But there is still more to it optimize.
The language itself is a bottleneck. We used Node.js with TypeScript for these version. Great for rapid development speed but not idea for performance.

So we added a **Go-based matching engine** as a separate service on a feature branch.
Node.js still handles auth, portfolio checks, and WebSocket broadcasting.
But GO handles the actual order matching.
They talk over HTTP/JSON on localhost. We wanted to use gRPC but it was a bit too much for this project. Maybe in the future.

Single order latency went from ~50–100µs in TypeScript to ~2–5µs in Go.
Throughput went from ~700k orders/sec to 3M+.

---

TechStack: **React · Zustand · Tailwind · tRPC · Socket.io · Firebase · Node.js · Go**

We also did user testing with a few people. This includes a finance student, a day trader, and a classmate from our batch.
Found bugs we had no idea existed. Biggest one was decimal quantity input silently failing.
No labels on the bid/ask columns, just color coding, which confused literally everyone at first.

---

The whole thing is open source under MIT.
Docs are actually written properly (rare for a college project, we know).
Proper git commits with detailed messages.
Runs on most hardware with just a `git clone` and `npm run dev`. Your phone can run it too.

GitHub → github.com/sudols/stock-order-book

Would love feedback on the architecture or anything you'd build differently.

---

#OpenSource #FullStack #DataStructures #GoLang #React #NodeJS #BennettUniversity #WebDevelopment
