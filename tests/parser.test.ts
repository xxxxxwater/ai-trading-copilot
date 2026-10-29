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

  it('does not detect indicators inside unrelated words', () => {
    const pine = parseStrategy(`//@version=5
strategy("EMA cross", overlay=true)
fast = ta.ema(close, 9)
slow = ta.ema(close, 21)
if ta.crossover(fast, slow)
    strategy.entry("L", strategy.long)`);
    expect(pine.indicators.map((item) => item.name)).toEqual(['EMA']);

    const freqtrade = parseStrategy(`
class Cross(IStrategy):
    INTERFACE_VERSION = 3
    stoploss = -0.1
    def populate_indicators(self, dataframe, metadata):
        dataframe['sma200'] = ta.SMA(dataframe, timeperiod=200)
        return dataframe
`);
    expect(freqtrade.indicators.map((item) => item.name)).toEqual(['SMA']);
  });

  it('still detects RSI written as an identifier part or call', () => {
    expect(parseStrategy('rsi_period = 7\nif rsi < 30:\n    enter_long()').indicators[0]?.params.period).toBe(7);
    expect(parseStrategy("dataframe['rsi'] = ta.RSI(dataframe, timeperiod=21)").indicators[0]?.params.period).toBe(21);
    expect(parseStrategy('r = ta.rsi(close, 9)').indicators[0]?.name).toBe('RSI');
  });

  it('binds RSI thresholds to the comparison that follows the RSI operand', () => {
    const ir = parseStrategy(`
      if ta.rsi(close, 14) < 30 and volume > 0:
          enter_long()
      if rsi > 70 and close < 100:
          exit_long()
    `);

    expect(ir.entries[0]?.expression).toBe('RSI < 30');
    expect(ir.exits[0]?.expression).toBe('RSI > 70');
  });
});
