export const runtime = 'nodejs';

export async function GET() {
  return Response.json(
    {
      status: 'ok',
      service: 'ai-trading-copilot',
      version: '0.5.0',
      boundary: 'research-read-only',
      capabilities: {
        deterministicStrategyParsing: true,
        deterministicRiskAnalysis: true,
        historicalBacktesting: true,
        publicMarketData: true,
        aiReviewConfigured: Boolean(process.env.OPENAI_API_KEY),
        databaseConfigured: Boolean(process.env.DATABASE_URL),
        liveExecution: false,
      },
      checkedAt: new Date().toISOString(),
    },
    {
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
}
