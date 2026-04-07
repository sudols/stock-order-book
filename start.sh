#!/bin/bash

# Quick start script for running the stock order book with Go engine

echo "╔═══════════════════════════════════════════════════════╗"
echo "║   Stock Order Book - Go Matching Engine              ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go 1.21+ first."
    echo "   Visit: https://golang.org/dl/"
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install pnpm first."
    echo "   Run: npm install -g pnpm"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
    echo ""
fi

# Build Go binary if not exists
if [ ! -f "packages/matching-engine-go/matching-engine" ]; then
    echo "🔨 Building Go matching engine..."
    cd packages/matching-engine-go
    go build -o matching-engine
    cd ../..
    echo "✅ Go binary built successfully"
    echo ""
fi

echo "🚀 Starting services..."
echo ""
echo "Starting in 3 separate terminals:"
echo "  1. Go Matching Engine (port 8080)"
echo "  2. Node.js Backend (port 3001)"
echo "  3. React Frontend (port 5173)"
echo ""

# Detect terminal emulator
if command -v gnome-terminal &> /dev/null; then
    # GNOME Terminal
    gnome-terminal --tab --title="Go Engine" -- bash -c "cd packages/matching-engine-go && ./matching-engine; exec bash"
    sleep 1
    gnome-terminal --tab --title="Node.js Backend" -- bash -c "cd packages/server && USE_GO_ENGINE=true pnpm dev; exec bash"
    sleep 1
    gnome-terminal --tab --title="React Frontend" -- bash -c "cd packages/client && pnpm dev; exec bash"
elif command -v konsole &> /dev/null; then
    # KDE Konsole
    konsole --new-tab -e bash -c "cd packages/matching-engine-go && ./matching-engine; exec bash" &
    sleep 1
    konsole --new-tab -e bash -c "cd packages/server && USE_GO_ENGINE=true pnpm dev; exec bash" &
    sleep 1
    konsole --new-tab -e bash -c "cd packages/client && pnpm dev; exec bash" &
elif command -v osascript &> /dev/null; then
    # macOS Terminal
    osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"'/packages/matching-engine-go && ./matching-engine"'
    sleep 1
    osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"'/packages/server && USE_GO_ENGINE=true pnpm dev"'
    sleep 1
    osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"'/packages/client && pnpm dev"'
else
    # Fallback: print manual instructions
    echo "⚠️  Could not detect terminal emulator."
    echo "    Please manually open 3 terminals and run:"
    echo ""
    echo "Terminal 1:"
    echo "  cd packages/matching-engine-go"
    echo "  ./matching-engine"
    echo ""
    echo "Terminal 2:"
    echo "  cd packages/server"
    echo "  USE_GO_ENGINE=true pnpm dev"
    echo ""
    echo "Terminal 3:"
    echo "  cd packages/client"
    echo "  pnpm dev"
    exit 0
fi

echo ""
echo "✅ Services started!"
echo ""
echo "Access the application:"
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:3001"
echo "  Go Engine: http://localhost:8080"
echo ""
echo "Press Ctrl+C in each terminal to stop services."
