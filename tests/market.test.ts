import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCandles, MarketDataError } from '../lib/market/binance';

function kline(openTime: number, closeTime: number, close = 100) {
  return [
    openTime,
    String(close),
    String(close * 1.01),
    String(close * 0.99),
    String(close),
    '100',
    closeTime,
  ];
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Binance market adapter', () => {
  it('excludes the currently open candle from historical datasets', async () => {
    const now = Date.now();
    const minute = 60_000;
    const rows = Array.from({ length: 31 }, (_, index) => {
      const openTime = now - (31 - index) * minute;
      const closeTime = index === 30 ? now + minute : openTime + minute - 1;
      return kline(openTime, closeTime);
    });

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(rows), { status: 200 })));

    const candles = await getCandles('BTCUSDT', '1m', 30);

    expect(candles).toHaveLength(30);
    expect(candles.every((candle) => candle.closeTime <= Date.now())).toBe(true);
  });

  it('fails closed when Binance returns malformed OHLC data', async () => {
    const now = Date.now();
    const minute = 60_000;
    const rows = Array.from({ length: 30 }, (_, index) => {
      const openTime = now - (31 - index) * minute;
      return kline(openTime, openTime + minute - 1);
    });
    rows[10][2] = '90';

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(rows), { status: 200 })));

    await expect(getCandles('BTCUSDT', '1m', 30)).rejects.toBeInstanceOf(MarketDataError);
  });
});
