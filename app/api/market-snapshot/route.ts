import { getMarketSnapshot } from '@/lib/market/binance';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const symbol = url.searchParams.get('symbol') ?? 'BTCUSDT';
    const interval = url.searchParams.get('interval') ?? '1h';
    const snapshot = await getMarketSnapshot(symbol, interval);
    return Response.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch market snapshot.';
    return Response.json({ error: message }, { status: 400 });
  }
}
