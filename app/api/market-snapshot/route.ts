export async function GET() {
  return Response.json({ symbol: 'BTCUSDT', timeframe: '1D', note: 'Stub endpoint. Replace with exchange, OpenBB, CCXT, or internal market data provider.', volatilityRegime: 'unknown', liquidityWarning: 'Check venue depth before execution.' });
}
