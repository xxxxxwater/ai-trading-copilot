# AI Trading Copilot

AI-native quantitative research workspace built with Next.js, TypeScript, Vercel AI SDK, PostgreSQL/Drizzle, TradingView, deterministic strategy parsing, risk analysis, and reproducible historical simulation.

The project has been upgraded from a prompt-only strategy reviewer into a research runtime with a clear boundary between **deterministic trading logic** and **AI explanation/orchestration**.

## What it does

- Parses Python, Freqtrade, Hummingbot, and Pine-like strategy source into a stable `StrategyIR`
- Extracts symbols, timeframe, indicators, RSI thresholds, sizing, leverage, stop-loss, DCA, fees, and slippage when explicitly present
- Runs deterministic risk checks for missing stops/exits, leverage, DCA exposure, look-ahead bias, martingale patterns, execution assumptions, and parser uncertainty
- Runs a real historical simulation for supported long-only RSI threshold strategies using Binance public OHLCV
- Models fixed fees and slippage and reports return, max drawdown, Sharpe, win rate, profit factor, trade count, and total fees
- Fetches read-only Binance public market snapshots with source and freshness metadata
- Uses AI SDK structured output to explain deterministic evidence when `OPENAI_API_KEY` is configured
- Exposes read-only agent tools for parsing, risk analysis, market context, and backtesting
- Provides a TradingView-centered research workspace
- Includes a versioned PostgreSQL/Drizzle persistence model for strategies, analysis runs, backtests, and audit events
- Includes tests and GitHub Actions CI

## Safety boundary

This repository **does not expose live order placement**. The AI tool layer is read-only/research-only: it can parse strategies, inspect public market data, run risk checks, and run historical simulations.

If execution is added later, keep the architecture:

```text
LLM -> TradingIntent proposal -> deterministic policy/risk -> OMS -> ExecutionAdapter -> venue
```

Do not connect model output directly to an exchange order endpoint.

## Architecture

```mermaid
flowchart TD
  U[User] --> UI[Next.js Research Workspace]
  UI --> ANALYZE[/api/analyze-strategy]
  UI --> BT[/api/backtest]
  UI --> MARKET[/api/market-snapshot]
  UI --> CHAT[/api/chat]

  ANALYZE --> PARSER[Strategy Parser]
  PARSER --> IR[Strategy IR v1]
  IR --> RISK[Deterministic Risk Engine]
  ANALYZE --> AI[AI Structured Review]
  RISK --> AI

  BT --> DATA[Binance Public OHLCV]
  BT --> ENGINE[Backtest Engine v0.4]
  MARKET --> DATA

  CHAT --> TOOLS[Read-only Copilot Tools]
  TOOLS --> PARSER
  TOOLS --> RISK
  TOOLS --> DATA
  TOOLS --> ENGINE

  ANALYZE --> DB[(PostgreSQL / Drizzle model)]
  BT --> DB
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for design boundaries and extension points.

## Strategy IR

`lib/trading/types.ts` defines the contract between language parsing and downstream systems. This lets future AST-specific adapters replace heuristic extraction without changing the risk engine, backtest API, database contracts, or UI.

Example extracted fields:

```text
language
universe.symbols
universe.timeframe
indicators[]
entries[]
exits[]
risk.stopLossPct
risk.maxLeverage
risk.maxPositionPct
risk.dcaSteps
execution.orderType
execution.feeBps
execution.slippageBps
sourceHash
```

## Backtest scope

The built-in `v0.4.0` simulator intentionally supports a narrow, explicit contract:

- long-only RSI threshold strategies
- Binance public candles
- candle-close execution
- configurable fixed fee/slippage
- deterministic position allocation

It does **not** silently claim support for unsupported strategy semantics. Queue position, order-book depth, partial fills, funding, borrow costs, liquidation, and venue-specific order behavior are future adapter responsibilities.

## API

### `POST /api/analyze-strategy`

Input:

```json
{
  "name": "RSI Research",
  "strategy": "if rsi < 30: enter_long()"
}
```

Returns Strategy IR, deterministic risk report, AI/fallback review, and reproducibility metadata.

### `POST /api/backtest`

Input:

```json
{
  "strategy": "...",
  "symbol": "BTCUSDT",
  "interval": "1h",
  "limit": 500,
  "initialCapital": 10000
}
```

Returns data-source metadata, dataset hash, assumptions, metrics, trades, equity curve, and limitations.

### `GET /api/market-snapshot?symbol=BTCUSDT&interval=1h`

Returns a read-only Binance public snapshot with freshness metadata.

### `POST /api/chat`

AI SDK UI-message endpoint with multi-step read-only tools:

- `parse_strategy`
- `analyze_risk`
- `market_snapshot`
- `run_backtest`

## Database model

The Drizzle schema includes:

- `workspaces`
- `strategies`
- `strategy_versions`
- `analysis_runs`
- `backtest_runs`
- `audit_events`

The schema is designed to retain source hashes, prompt/model versions, deterministic outputs, dataset hashes, assumptions, metrics, trades, and tool traces.

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Vercel AI SDK 7
- OpenAI provider
- PostgreSQL + Drizzle ORM
- Tailwind CSS 4
- TradingView advanced chart embed
- Vitest
- GitHub Actions

Dependencies are pinned to exact versions in `package.json` instead of `latest` tags.

## Local setup

Node.js 22+ is required.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Environment variables:

```bash
OPENAI_API_KEY=
AI_MODEL=gpt-5.4
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ai_trading_copilot
BINANCE_REST_URL=https://api.binance.com
```

`OPENAI_API_KEY` is optional for deterministic analysis/backtesting. It is required only for AI-generated reviews and `/api/chat`.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

CI runs the same quality gates on pushes to `main` and pull requests.

## Database

```bash
npm run db:generate
npm run db:migrate
```

Review generated migrations before applying them to an existing database.

## Next engineering milestones

1. Language-specific AST adapters for Python/Freqtrade and Pine
2. Event-driven simulator with limit orders, partial fills, funding, borrow, and liquidation
3. Walk-forward, Monte Carlo, parameter-sensitivity, and regime segmentation tools
4. Workspace authentication/RBAC and persistent run history
5. Provider interface for Hyperliquid/IBKR/internal market data
6. Read-only portfolio/runtime adapters before any proposal-to-execution workflow
7. Agent eval suite covering look-ahead bias, overfitting, sizing, leverage, and execution-risk detection

## Disclaimer

This repository is for engineering and quantitative research. Historical simulations are not guarantees of future results and the application does not provide financial advice or live execution.
