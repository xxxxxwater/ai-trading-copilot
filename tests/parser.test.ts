import { describe, expect, it } from 'vitest';
import { parseStrategy } from '../lib/trading/parser';

describe('parseStrategy', () => {
  it('extracts deterministic RSI strategy evidence', () => {
    const ir = parseStrategy(`
      timeframe = "1h"
      symbol = "BTCUSDT"
      rsi_period = 14
      stop_loss = -0.05
      max_position_size = 0.25
      if rsi < 30:
          enter_long()
      elif rsi > 70:
          exit_long()
    `, 'RSI test');

    expect(ir.language).toBe('python');
    expect(ir.universe.symbols).toContain('BTCUSDT');
    expect(ir.universe.timeframe).toBe('1h');
    expect(ir.indicators.find((item) => item.name === 'RSI')?.params.period).toBe(14);
    expect(ir.entries[0]?.expression).toBe('RSI < 30');
    expect(ir.exits[0]?.expression).toBe('RSI > 70');
    expect(ir.risk.stopLossPct).toBe(5);
    expect(ir.risk.maxPositionPct).toBe(25);
    expect(ir.sourceHash).toHaveLength(64);
  });
});
