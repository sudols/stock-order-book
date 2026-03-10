# Stock Order Book - Project Overview

## Introduction

This project is a **Real-time Stock Order Book** application designed to demonstrate advanced Computer Science concepts, high-performance data structures, and a clean, modern full-stack architecture. It simulates a trading platform where users can place buy and sell orders, which are matched in real-time based on price-time priority.

## Key Features

- **Real-time Updates**: The order book updates instantly for all connected users via WebSockets (Socket.io).
- **High-Performance Matching**: Uses **HashMaps** and **Sorted Arrays** to achieve O(1) time complexity for key operations like price lookups and order cancellations.
- **Portfolio Management**: Tracks user balances (USD and Stock holdings) to prevent invalid trades.
- **Authentication**: Secure user authentication using Firebase.
- **Type Safety**: End-to-end type safety with TypeScript and a shared package for common types.

## Technology Stack

### Frontend (`/packages/client`)

- **Framework**: React (Vite)
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Communication**: tRPC (API) + Socket.io (Real-time)
- **Auth**: Firebase Auth

### Backend (`/packages/server`)

- **Runtime**: Node.js
- **API Framework**: tRPC (Express adapter)
- **Real-time Engine**: Socket.io
- **Data Structures**: Custom `OrderBook` with HashMaps + Arrays
- **Validation**: Zod schema validation

### Shared (`/packages/shared`)

- **Purpose**: Shared TypeScript interfaces (`Order`, `Trade`, `Portfolio`) to ensure frontend and backend are always in sync.

## Project Goal

The primary goal is to simulate a production-grade trading engine, focusing on efficiency, clean code practices (Single Responsibility Principle), and a seamless user experience.
