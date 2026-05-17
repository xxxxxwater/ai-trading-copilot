import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { strategyAnalysisPrompt } from '@/lib/ai/prompts';
import { staticRiskScan } from '@/lib/trading/risk';
const schema = z.object({ summary: z.string(), signalLogic: z.string(), backtestExplanation: z.string(), riskReview: z.array(z.string()), improvementPlan: z.array(z.string()) });
export async function POST(req: Request) {
  const { strategy, name = 'Untitled Strategy' } = await req.json();
  if (!strategy || typeof strategy !== 'string') return Response.json({ error: 'strategy is required' }, { status: 400 });
  const staticFindings = staticRiskScan(strategy);
  const result = await generateObject({ model: openai('gpt-4o-mini'), schema, system: strategyAnalysisPrompt, prompt: `Strategy name: ${name}\n\nStrategy source:\n${strategy.slice(0, 12000)}` });
  return Response.json({ ...result.object, staticFindings });
}
