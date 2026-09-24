# Architecture

AI Trading Copilot is intentionally split into deterministic research components and an AI explanation/orchestration layer.

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
  └─ /api/chat
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
             Backtest Engine v0.4
             Binance public market-data adapter
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

The built-in v0.4 engine is deliberately narrow: long-only RSI threshold strategies, candle-close fills, fixed fee/slippage, and Binance public OHLCV. This is a real historical simulation, but it does not model queue position, partial fills, order-book depth, funding, borrow costs, or liquidation.

The narrow scope is preferable to silently claiming support for strategy semantics that are not implemented.

## Persistence model

The Drizzle schema now separates:

- workspaces
- strategies
- strategy versions
- analysis runs
- backtest runs
- audit events

This gives future persistence a place to store strategy hashes, prompt/model versions, deterministic outputs, dataset hashes, assumptions, and tool traces for reproducibility.
