# AI Trading Copilot

AI trading copilot built with Next.js, TypeScript, Vercel AI SDK, PostgreSQL, and TradingView-style market analysis.

## Live Demo

Live demo placeholder: deploy to Vercel and replace this line with the production URL.

## What It Does

- AI backtesting assistant for reviewing strategy logic, assumptions, and likely failure modes
- AI risk analysis for leverage, stop-loss coverage, drawdown exposure, slippage, and liquidity risks
- TradingView chart UI for live market context beside the strategy review workflow
- PostgreSQL + Drizzle persistence for strategies, analysis records, and future user workspaces

## Tech Stack

- Next.js App Router
- TypeScript
- Vercel AI SDK
- OpenAI API
- PostgreSQL
- Drizzle ORM
- Tailwind CSS
- TradingView widget embed

## Feature Overview

### AI Backtesting Assistant

Paste a Python, Pine Script, Freqtrade, or Hummingbot strategy into the app and get a structured explanation of signal generation, entries, exits, assumptions, and backtest weaknesses.

### Risk Analysis

The copilot flags missing stop-loss logic, unrealistic fills, overfitting risk, leverage misuse, weak drawdown controls, and poor liquidity assumptions.

### TradingView Chart UI

The interface keeps a TradingView chart panel visible while the strategy is being reviewed so users can inspect market structure and symbol context in the same screen.

### PostgreSQL / Drizzle

The project is wired for PostgreSQL and Drizzle so analysis results and strategy records can move from demo mode into persistent product workflows.

## Screenshots

Screenshot placeholder 1: homepage with strategy input + TradingView chart UI

Screenshot placeholder 2: AI backtesting assistant and risk analysis result panel

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
  AI --> RISK[Backtest Explanation + Risk Analysis]
  RISK --> UI
```

## Local Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Environment Variables

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

- Full auth and saved workspaces
- Vercel deployment with live demo URL
- Strategy file upload and parsing
- Rich backtest import support
- More advanced market data and research tools

## Disclaimer

This repository is for engineering demonstration and research use. It is not financial advice and does not execute live trades.
