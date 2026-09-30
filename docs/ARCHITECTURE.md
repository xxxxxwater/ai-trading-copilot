# Architecture

AI Trading Copilot is intentionally split into a deterministic research core and an AI explanation/orchestration layer.

```text
Browser workspace
  ├─ strategy editor
  ├─ TradingView context
  ├─ deterministic risk report
  └─ historical simulation
          │
          ▼
Next.js API
  ├─ /api/analyze-strategy
  ├─ /api/backtest
  ├─ /api/market-snapshot
  ├─ /api/chat
  └─ /api/health
          │
          ├─────────────── AI layer ───────────────┐
          │                                         │
          │  OpenAI via AI SDK                     │
          │  read-only tools                       │
          │  structured explanation                │
          │                                         │
          └──── deterministic layer ────────────────┘
             Strategy Parser -> Strategy IR v1
             Risk Engine
             Backtest Engine v0.5
             Binance public market-data adapter

Prepared persistence contract (not wired into request paths):
  PostgreSQL / Drizzle schema
```

## Safety boundary

The repository has no authenticated exchange adapter and no order-placement tool. The AI layer can parse source, analyze deterministic risk, fetch public market data, and run a historical simulation. It cannot create, amend, cancel, or flatten orders.

If live execution is added later, keep the following boundary:

```text
LLM -> TradingIntent proposal -> deterministic policy/risk -> OMS -> ExecutionAdapter -> venue
```

Never connect an LLM response directly to a venue order endpoint.

## Strategy IR

`StrategyIR` is the stable contract between language-specific strategy parsing and downstream risk/backtest logic. The current parser performs deterministic evidence extraction for Python/Freqtrade/Hummingbot/Pine-like source. The interface is designed so language-specific AST adapters can replace individual extraction paths without changing the risk or UI contracts.

## Backtest engine

The built-in v0.5 engine is deliberately narrow: long-only RSI threshold strategies, signals evaluated at candle close, signal-driven fills at the next candle open, fixed fee/slippage, and closed Binance public OHLCV.

Extracted stop-loss and take-profit levels are enforced against candle OHLC. When both levels are touched inside the same candle, the engine uses a deterministic conservative rule: stop-loss first. Exact intrabar path, queue position, partial fills, order-book depth, funding, borrow costs, liquidation, and market impact are not modeled.

The narrow scope is preferable to silently claiming support for strategy semantics that are not implemented.

## Market-data boundary

The Binance adapter is public/read-only. It validates numeric/OHLC structure, rejects duplicate or out-of-order klines, excludes the currently open candle from historical datasets, and classifies timeout/upstream/invalid-response failures.

The backtest API returns a dataset hash plus start/end/finality metadata so a result carries explicit provenance.

## AI degradation behavior

Deterministic parsing and risk analysis are the source of truth for extracted evidence. When AI review generation fails, `/api/analyze-strategy` keeps the deterministic result and reports a deterministic fallback rather than failing the whole request.

The chat endpoint is optional, requires `OPENAI_API_KEY`, bounds request size/message count, exposes only read-only tools, and returns stable public errors instead of raw provider exceptions.

## Persistence model

The Drizzle schema separates:

- workspaces
- strategies
- strategy versions
- analysis runs
- backtest runs
- audit events

These tables are a **prepared persistence contract**. Current `/api/analyze-strategy` and `/api/backtest` requests do not insert run records. Wiring persistence should be done only with explicit transactional behavior, idempotency, retention policy, and authentication/workspace ownership.

## Operational boundary

`GET /api/health` is a liveness/capability endpoint. It deliberately does not call Binance, OpenAI, or PostgreSQL, so it must not be treated as dependency readiness.

Before exposing the service as a public multi-user product, add authentication/RBAC, per-user/provider rate limits, durable audit/run persistence, abuse controls, and deployment-specific observability.
