import { describe, expect, it } from 'vitest';
import { runBacktest } from '../lib/trading/backtest';
import { parseStrategy } from '../lib/trading/parser';
import type { MarketCandle } from '../lib/trading/types';

function candlesFrom(closes: number[]): MarketCandle[] {
  return closes.map((close, index) => ({
    openTime: index * 3_600_000,
    closeTime: (index + 1) * 3_600_000 - 1,
    open: close,
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume: 100,
  }));
}

describe('runBacktest', () => {
  it('runs a reproducible long-only RSI simulation', () => {
    const source = `
      rsi_period = 3
      stop_loss = -0.05
      max_position_size = 0.5
      fee_bps = 4
      slippage_bps = 2
      if rsi < 35:
          enter_long()
      elif rsi > 65:
          exit_long()
    `;
    const closes = [
      100, 99, 98, 97, 96, 95, 94, 96, 98, 100,
      102, 104, 103, 101, 99, 97, 95, 93, 95, 97,
      99, 101, 103, 105, 104, 102, 100, 98, 96, 94,
      96, 98, 100, 102, 104, 106, 105, 103, 101, 99,
    ];
    const result = runBacktest(parseStrategy(source), candlesFrom(closes), { initialCapital: 10_000 });

    expect(result.mode).toBe('historical-simulation');
    expect(result.metrics.tradeCount).toBeGreaterThan(0);
    expect(result.equityCurve).toHaveLength(closes.length);
    expect(result.metrics.totalFees).toBeGreaterThan(0);
    expect(Number.isFinite(result.metrics.maxDrawdownPct)).toBe(true);
  });
});
