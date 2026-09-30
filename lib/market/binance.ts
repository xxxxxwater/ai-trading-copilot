import type { MarketCandle } from '@/lib/trading/types';

const allowedIntervals = new Set([
  '1m', '3m', '5m', '15m', '30m',
  '1h', '2h', '4h', '6h', '8h', '12h',
  '1d', '3d', '1w', '1M',
]);

export type MarketDataErrorKind = 'timeout' | 'upstream' | 'invalid-response';

export class MarketDataError extends Error {
  constructor(
    public readonly kind: MarketDataErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'MarketDataError';
  }
}

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

function finiteNumber(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new MarketDataError('invalid-response', `Binance returned a non-finite ${field}.`);
  }
  return parsed;
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'user-agent': 'ai-trading-copilot/0.5' },
    });

    if (!response.ok) {
      throw new MarketDataError('upstream', `Binance request failed with HTTP ${response.status}.`);
    }

    try {
      return await response.json() as T;
    } catch {
      throw new MarketDataError('invalid-response', 'Binance returned invalid JSON.');
    }
  } catch (error) {
    if (error instanceof MarketDataError) throw error;
    if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw new MarketDataError('timeout', 'Binance request timed out.');
    }
    throw new MarketDataError('upstream', 'Unable to reach Binance public market data.');
  } finally {
    clearTimeout(timer);
  }
}

function parseKline(row: unknown, index: number): MarketCandle {
  if (!Array.isArray(row) || row.length < 7) {
    throw new MarketDataError('invalid-response', `Binance returned a malformed kline at index ${index}.`);
  }

  const candle: MarketCandle = {
    openTime: finiteNumber(row[0], 'openTime'),
    open: finiteNumber(row[1], 'open'),
    high: finiteNumber(row[2], 'high'),
    low: finiteNumber(row[3], 'low'),
    close: finiteNumber(row[4], 'close'),
    volume: finiteNumber(row[5], 'volume'),
    closeTime: finiteNumber(row[6], 'closeTime'),
  };

  if (
    candle.open <= 0
    || candle.high <= 0
    || candle.low <= 0
    || candle.close <= 0
    || candle.volume < 0
    || candle.openTime >= candle.closeTime
    || candle.high < Math.max(candle.open, candle.close, candle.low)
    || candle.low > Math.min(candle.open, candle.close, candle.high)
  ) {
    throw new MarketDataError('invalid-response', `Binance returned an invalid kline at index ${index}.`);
  }

  return candle;
}

export async function getCandles(symbol: string, interval = '1h', limit = 500): Promise<MarketCandle[]> {
  const safeSymbol = normalizeSymbol(symbol);
  const safeInterval = normalizeInterval(interval);
  const safeLimit = Math.min(1_000, Math.max(30, Math.round(limit)));
  const fetchLimit = Math.min(1_000, safeLimit + 1);
  const url = `${baseUrl()}/api/v3/klines?symbol=${encodeURIComponent(safeSymbol)}&interval=${encodeURIComponent(safeInterval)}&limit=${fetchLimit}`;
  const rows = await fetchJson<unknown[]>(url);

  if (!Array.isArray(rows)) {
    throw new MarketDataError('invalid-response', 'Binance returned a non-array kline payload.');
  }

  const parsed = rows.map(parseKline);
  for (let index = 1; index < parsed.length; index += 1) {
    if (parsed[index].openTime <= parsed[index - 1].openTime) {
      throw new MarketDataError('invalid-response', 'Binance returned duplicate or out-of-order klines.');
    }
  }

  const now = Date.now();
  const closed = parsed.filter((candle) => candle.closeTime <= now).slice(-safeLimit);
  if (closed.length === 0) {
    throw new MarketDataError('invalid-response', 'Binance returned no closed candles.');
  }

  return closed;
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
    fetchJson<Record<string, unknown>>(tickerUrl),
    getCandles(safeSymbol, safeInterval, 50),
  ]);

  const lastPrice = finiteNumber(ticker.lastPrice, 'lastPrice');
  const priceChangePct24h = finiteNumber(ticker.priceChangePercent, 'priceChangePercent');
  const high24h = finiteNumber(ticker.highPrice, 'highPrice');
  const low24h = finiteNumber(ticker.lowPrice, 'lowPrice');
  const quoteVolume24h = finiteNumber(ticker.quoteVolume, 'quoteVolume');
  const closeTime = finiteNumber(ticker.closeTime, 'closeTime');

  if (lastPrice <= 0 || high24h <= 0 || low24h <= 0 || quoteVolume24h < 0 || high24h < low24h) {
    throw new MarketDataError('invalid-response', 'Binance returned an invalid 24h ticker payload.');
  }

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
    timestamp: new Date(closeTime).toISOString(),
    freshnessMs: Math.max(0, Date.now() - closeTime),
    lastPrice,
    priceChangePct24h,
    high24h,
    low24h,
    quoteVolume24h,
    recentVolatilityPct: Math.sqrt(variance) * 100,
  };
}
