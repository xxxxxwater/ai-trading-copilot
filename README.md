# AI Trading Copilot

AI Trading Copilot is a Next.js + TypeScript application for strategy review, backtest explanation, trade risk analysis, and market context visualization. It is designed as a production-style demo for AI-native trading workflows: paste or upload a strategy, ask the copilot to explain the backtest logic, review risk controls, and inspect market context through a TradingView chart panel.

## Why this project exists

This repo demonstrates the exact engineering surface area required for modern AI trading products:

- Full-stack product development with Next.js, TypeScript, Tailwind, and shadcn-style components
- LLM-powered workflows using Vercel AI SDK and OpenAI
- PostgreSQL persistence with Drizzle ORM
- Strategy analysis, backtest explanation, and trade risk review
- TradingView chart integration for market context
- Clear separation between UI, AI prompts, trading analysis logic, and database schema

## Core features

### 1. Strategy upload / paste
Paste a Python, Pine Script, Freqtrade, Hummingbot, or custom strategy into the UI. The app stores strategy metadata and sends the strategy text to the AI analysis pipeline.

### 2. AI backtest explanation
The copilot explains signal generation, assumptions, entry/exit logic, position sizing, backtest limitations, and likely failure modes.

### 3. Trade risk analysis
The app highlights risk issues such as missing stop-loss logic, overfitting risk, excessive leverage, poor liquidity assumptions, execution slippage, and missing drawdown controls.

### 4. Market data / TradingView chart UI
A TradingView chart panel gives immediate market context while reviewing strategy logic.

## Tech stack

- Next.js App Router
- TypeScript
- Vercel AI SDK
- OpenAI API
- PostgreSQL
- Drizzle ORM
- TailwindCSS
- shadcn-style UI primitives

## Architecture

```mermaid
flowchart TD
  U[User] --> UI[Next.js App Router UI]
  UI --> API1[/api/analyze-strategy]
  UI --> API2[/api/chat]
  UI --> TV[TradingView Widget]
  API1 --> AI[Vercel AI SDK + OpenAI]
  API2 --> AI
  API1 --> DB[(PostgreSQL + Drizzle)]
  DB --> UI
  AI --> RISK[Risk Analysis + Backtest Explanation]
  RISK --> UI
```

## Local setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Environment variables

```bash
OPENAI_API_KEY=your_openai_key
DATABASE_URL=postgres://user:password@localhost:5432/ai_trading_copilot
```

## Database

```bash
pnpm db:generate
pnpm db:migrate
```

## Roadmap

- Strategy file upload
- Freqtrade backtest import parser
- Hummingbot config analyzer
- Trade journal upload and PnL attribution
- RAG over strategy docs and exchange docs
- Tool calling for market data providers
- User auth and saved strategy workspaces

## Disclaimer

This project is for engineering demonstration and research only. It is not financial advice and does not execute trades.
