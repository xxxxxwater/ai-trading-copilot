# Operations

## Runtime contract

AI Trading Copilot v0.5 is a **research/read-only** service.

Allowed runtime capabilities:

- deterministic strategy parsing
- deterministic risk analysis
- public Binance market-data reads
- historical simulation
- optional AI explanation/orchestration with read-only tools

Not implemented:

- authenticated exchange account access
- order creation/amend/cancel
- portfolio mutation
- automatic flattening
- live execution adapters

## Health endpoint

`GET /api/health` reports process liveness plus whether optional AI/database configuration is present.

It does **not** probe Binance, OpenAI, or PostgreSQL. This is intentional: a failing external dependency must not make the process liveness check flap.

For deployment platforms, use `/api/health` as liveness only. Add a separate authenticated readiness/diagnostic path later if dependency probes become operationally necessary.

## Failure semantics

| Area | Behavior |
| --- | --- |
| Invalid strategy/API input | 4xx |
| Unsupported backtest strategy semantics | 422 |
| Binance public upstream failure | 502 |
| Binance timeout | 504 |
| AI review provider failure | deterministic analysis succeeds with fallback metadata |
| Chat without AI configuration | 503 |
| Oversized chat request | 413 |
| Malformed market payload | fail closed; no metrics are produced |

## Historical-data semantics

Backtests consume **closed candles only**. The current open Binance candle is excluded.

The v0.5 engine evaluates RSI signals at candle close and executes signal-driven fills at the next candle open. Extracted stop-loss/take-profit levels are evaluated from OHLC. If stop and take-profit are both touched in the same candle, stop-loss wins because exact intrabar ordering is unknowable from OHLC alone.

## Deployment gates

A production build should pass:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Do not expose the AI endpoint broadly without authentication and rate limiting. Model-provider spend and request amplification are otherwise unbounded by user identity.

Do not add exchange API secrets to this repository or to browser-visible environment variables. If execution is introduced in a future system, keep credentials and venue actions behind deterministic policy/OMS boundaries.

## Database status

`DATABASE_URL` enables construction of the Drizzle client, but current analysis/backtest API routes do not write run history. The existing schema is preparatory. Do not describe PostgreSQL persistence as active until request-path writes, ownership, migrations, and failure/retry semantics are implemented and tested.
