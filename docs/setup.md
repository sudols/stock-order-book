# Setup & Running Instructions

## Prerequisites

- Node.js (v18 or higher)
- pnpm (`npm install -g pnpm`)

## Installation

1.  Install dependencies for all packages:
    ```bash
    pnpm install
    ```

## Running Development Server

To run both the Frontend and Backend concurrently:

```bash
pnpm dev
```

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000 (API) / 3001 (WebSocket)

## Project Scripts

- `pnpm build`: Build both client and server.
- `pnpm test`: Run backend tests (Matching Engine logic).
