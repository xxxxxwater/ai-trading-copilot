import { z } from 'zod';
import { getMarketSnapshot, MarketDataError } from '@/lib/market/binance';

export const runtime = 'nodejs';

const querySchema = z.object({
  symbol: z.string().trim().min(5).max(20).default('BTCUSDT'),
  interval: z.string().trim().min(2).max(4).default('1h'),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = querySchema.parse({
      symbol: url.searchParams.get('symbol') ?? undefined,
      interval: url.searchParams.get('interval') ?? undefined,
    });
    const snapshot = await getMarketSnapshot(query.symbol, query.interval);
    return Response.json(snapshot);
  } catch (error) {
    if (error instanceof MarketDataError) {
      return Response.json(
        { error: error.message, upstream: 'binance' },
        { status: error.kind === 'timeout' ? 504 : 502 },
      );
    }
    const message = error instanceof Error ? error.message : 'Unable to fetch market snapshot.';
    return Response.json({ error: message }, { status: 400 });
  }
}
