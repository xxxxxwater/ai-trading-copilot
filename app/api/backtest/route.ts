import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getCandles } from '@/lib/market/binance';
import { runBacktest } from '@/lib/trading/backtest';
import { parseStrategy } from '@/lib/trading/parser';

export const runtime = 'nodejs';
export const maxDuration = 60;

const inputSchema = z.object({
  strategy: z.string().min(1).max(100_000),
  name: z.string().min(1).max(120).default('Untitled Strategy'),
  symbol: z.string().min(5).max(20).default('BTCUSDT'),
  interval: z.string().min(2).max(4).default('1h'),
  limit: z.number().int().min(30).max(1_000).default(500),
  initialCapital: z.number().positive().max(100_000_000).default(10_000),
});

export async function POST(req: Request) {
  try {
    const body = inputSchema.parse(await req.json());
    const ir = parseStrategy(body.strategy, body.name);
    const candles = await getCandles(body.symbol, body.interval, body.limit);
    const result = runBacktest(ir, candles, { initialCapital: body.initialCapital });
    const datasetHash = createHash('sha256')
      .update(JSON.stringify(candles.map((candle) => [candle.openTime, candle.open, candle.high, candle.low, candle.close, candle.volume])))
      .digest('hex');

    return Response.json({
      symbol: body.symbol.toUpperCase().replace(/[\/_-]/g, ''),
      interval: body.interval,
      dataSource: 'binance-spot-public-rest',
      candleCount: candles.length,
      datasetHash,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to run backtest.';
    const status = message.includes('currently supports') ? 422 : 400;
    return Response.json({ error: message }, { status });
  }
}
