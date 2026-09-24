import type { MarketCandle } from '@/lib/trading/types';

const allowedIntervals = new Set([
  '1m', '3m', '5m', '15m', '30m',
  '1h', '2h', '4h', '6h', '8h', '12h',
  '1d', '3d', '1w', '1M',
]);

function baseUrl(): string {
  return (process.env.BINANCE_REST_URL ?? 'https://api.binance.com').replace(/\/$/, '');
}

function normalizeSymbol(symbol: string): string {
  const value = symbol.toUpperCase().replace(/[\/_-]/g, '');
  if (!/^[A-Z0-9]{5,20}$/.test(value)) throw new Error('Invalid Binance symbol.');
  return value;
}

function normalizeInterval(interval: string): string {
  if (!allowedIntervals.has(interval)) throw new Error(`Unsupported Binance interval: ${interval}`);
  return interval;
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'user-agent': 'ai-trading-copilot/0.4' },
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Binance request failed (${response.status}): ${detail.slice(0, 180)}`);
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function getCandles(symbol: string, interval = '1h', limit = 500): Promise<MarketCandle[]> {
  const safeSymbol = normalizeSymbol(symbol);
  const safeInterval = normalizeInterval(interval);
  const safeLimit = Math.min(1_000, Math.max(30, Math.round(limit)));
  const url = `${baseUrl()}/api/v3/klines?symbol=${encodeURIComponent(safeSymbol)}&interval=${encodeURIComponent(safeInterval)}&limit=${safeLimit}`;
  const rows = await fetchJson<Array<[number, string, string, string, string, string, number, ...unknown[]]>>(url);

  return rows.map((row) => ({
    openTime: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    closeTime: Number(row[6]),
  }));
}

export type MarketSnapshot = {
  source: 'binance-spot-public-rest';
  symbol: string;
  interval: string;
  timestamp: string;
  freshnessMs: number;
  lastPrice: number;
  priceChangePct24h: number;
  high24h: number;
  low24h: number;
  quoteVolume24h: number;
  recentVolatilityPct: number;
};

export async function getMarketSnapshot(symbol = 'BTCUSDT', interval = '1h'): Promise<MarketSnapshot> {
  const safeSymbol = normalizeSymbol(symbol);
  const safeInterval = normalizeInterval(interval);
  const tickerUrl = `${baseUrl()}/api/v3/ticker/24hr?symbol=${encodeURIComponent(safeSymbol)}`;
  const [ticker, candles] = await Promise.all([
    fetchJson<{
      lastPrice: string;
      priceChangePercent: string;
      highPrice: string;
      lowPrice: string;
      quoteVolume: string;
      closeTime: number;
    }>(tickerUrl),
    getCandles(safeSymbol, safeInterval, 50),
  ]);

  const returns: number[] = [];
  for (let i = 1; i < candles.length; i += 1) {
    if (candles[i - 1].close > 0) returns.push(candles[i].close / candles[i - 1].close - 1);
  }
  const mean = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
  const variance = returns.length > 1
    ? returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1)
    : 0;

  return {
    source: 'binance-spot-public-rest',
    symbol: safeSymbol,
    interval: safeInterval,
    timestamp: new Date(ticker.closeTime).toISOString(),
    freshnessMs: Math.max(0, Date.now() - ticker.closeTime),
    lastPrice: Number(ticker.lastPrice),
    priceChangePct24h: Number(ticker.priceChangePercent),
    high24h: Number(ticker.highPrice),
    low24h: Number(ticker.lowPrice),
    quoteVolume24h: Number(ticker.quoteVolume),
    recentVolatilityPct: Math.sqrt(variance) * 100,
  };
}
