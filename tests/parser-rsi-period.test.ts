import { describe, expect, it } from 'vitest';
import { parseStrategy } from '../lib/trading/parser';

describe('parseStrategy RSI period', () => {
  const period = (source: string) => parseStrategy(source).indicators.find((item) => item.name === 'RSI')?.params.period;

  it('does not take the period from another indicator call', () => {
    const freqtrade = `
class Sample(IStrategy):
    stoploss = -0.10
    def populate_indicators(self, dataframe, metadata):
        dataframe['ema200'] = ta.EMA(dataframe, timeperiod=200)
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=21)
        return dataframe
`;
    expect(period(freqtrade)).toBe(21);
    expect(period(freqtrade.replace('ta.RSI(dataframe, timeperiod=21)', 'ta.RSI(dataframe)'))).toBe(14);
  });

  it('does not read arguments past the end of the RSI call', () => {
    const pine = `//@version=5
strategy("RSI")
r = ta.rsi(close)
plot(ta.sma(close, 50))
if r < 30
    strategy.entry("L", strategy.long)`;
    expect(period(pine)).toBe(14);
  });

  it('reads positional and keyword RSI periods', () => {
    expect(period('r = ta.rsi(close, 9)\nif r < 30: enter_long()')).toBe(9);
    expect(period("df['rsi'] = ta.RSI(df['close'], timeperiod=7)")).toBe(7);
    expect(period("df['rsi'] = pta.rsi(df['close'], length=10)")).toBe(10);
  });
});
