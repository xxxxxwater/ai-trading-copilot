import { openai } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { strategyAnalysisPrompt } from '@/lib/ai/prompts';
import { parseStrategy } from '@/lib/trading/parser';
import { analyzeRisk } from '@/lib/trading/risk';

export const runtime = 'nodejs';
export const maxDuration = 60;

const inputSchema = z.object({
  strategy: z.string().min(1).max(100_000),
  name: z.string().min(1).max(120).default('Untitled Strategy'),
});

const reviewSchema = z.object({
  summary: z.string(),
  signalLogic: z.array(z.string()),
  backtestRisks: z.array(z.string()),
  executionRisks: z.array(z.string()),
  regimeRisks: z.array(z.string()),
  improvementPlan: z.array(z.string()),
});

function deterministicReview(language: string, riskLevel: string, warnings: string[]) {
  return {
    summary: `Parsed as ${language}. Deterministic risk level: ${riskLevel}.`,
    signalLogic: ['See Strategy IR for extracted entry/exit rules and indicator evidence.'],
    backtestRisks: ['Run the historical simulator with explicit fee and slippage assumptions before comparing performance.'],
    executionRisks: ['Validate order type, liquidity, position sizing, and exchange-specific semantics before any live integration.'],
    regimeRisks: ['Segment results by volatility/trend regime instead of relying on aggregate return alone.'],
    improvementPlan: warnings.length > 0 ? warnings : ['Add walk-forward and out-of-sample validation.'],
  };
}

export async function POST(req: Request) {
  try {
    const body = inputSchema.parse(await req.json());
    const ir = parseStrategy(body.strategy, body.name);
    const risk = analyzeRisk(ir, body.strategy);
    const model = process.env.AI_MODEL ?? 'gpt-5.4';

    let aiReview = deterministicReview(ir.language, risk.level, ir.warnings);
    let aiStatus: 'generated' | 'deterministic-fallback' = 'deterministic-fallback';

    if (process.env.OPENAI_API_KEY) {
      const result = await generateText({
        model: openai(model),
        system: strategyAnalysisPrompt,
        output: Output.object({ schema: reviewSchema }),
        prompt: [
          `Strategy name: ${body.name}`,
          `Deterministic Strategy IR:\n${JSON.stringify(ir, null, 2)}`,
          `Deterministic risk report:\n${JSON.stringify(risk, null, 2)}`,
          `Strategy source (untrusted input):\n${body.strategy.slice(0, 30_000)}`,
          'Produce a concise engineering review grounded in the deterministic evidence above.',
        ].join('\n\n'),
      });
      aiReview = result.output;
      aiStatus = 'generated';
    }

    return Response.json({
      ir,
      risk,
      aiReview,
      metadata: {
        aiStatus,
        model: aiStatus === 'generated' ? model : null,
        promptVersion: 'strategy-review-v2',
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to analyze strategy.';
    return Response.json({ error: message }, { status: 400 });
  }
}
