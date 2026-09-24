import { tool } from 'ai';
import { z } from 'zod';
import { getCandles, getMarketSnapshot } from '@/lib/market/binance';
import { runBacktest } from '@/lib/trading/backtest';
import { parseStrategy } from '@/lib/trading/parser';
import { analyzeRisk } from '@/lib/trading/risk';

export const copilotTools = {
  parse_strategy: tool({
    description: 'Parse strategy source into a deterministic Strategy IR with extracted language, indicators, rules, risk controls, and execution assumptions.',
    inputSchema: z.object({
      strategy: z.string().min(1).max(100_000),
      name: z.string().min(1).max(120).optional(),
    }),
    execute: async ({ strategy, name }) => parseStrategy(strategy, name),
  }),

  analyze_risk: tool({
    description: 'Run deterministic risk checks on a strategy source. Higher score means higher implementation/execution risk.',
    inputSchema: z.object({
      strategy: z.string().min(1).max(100_000),
      name: z.string().min(1).max(120).optional(),
    }),
    execute: async ({ strategy, name }) => {
      const ir = parseStrategy(strategy, name);
      return analyzeRisk(ir, strategy);
    },
  }),

  market_snapshot: tool({
    description: 'Read a current Binance public spot market snapshot. This tool is read-only and does not use account credentials.',
    inputSchema: z.object({
      symbol: z.string().default('BTCUSDT'),
      interval: z.string().default('1h'),
    }),
    execute: async ({ symbol, interval }) => getMarketSnapshot(symbol, interval),
  }),

  run_backtest: tool({
    description: 'Run the built-in historical simulator for supported RSI threshold strategies using Binance public OHLCV. No orders are placed.',
    inputSchema: z.object({
      strategy: z.string().min(1).max(100_000),
      name: z.string().min(1).max(120).optional(),
      symbol: z.string().default('BTCUSDT'),
      interval: z.string().default('1h'),
      limit: z.number().int().min(30).max(1_000).default(500),
      initialCapital: z.number().positive().max(100_000_000).default(10_000),
    }),
    execute: async ({ strategy, name, symbol, interval, limit, initialCapital }) => {
      const ir = parseStrategy(strategy, name);
      const candles = await getCandles(symbol, interval, limit);
      return runBacktest(ir, candles, { initialCapital });
    },
  }),
};
