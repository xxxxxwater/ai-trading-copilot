import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { copilotPrompt } from '@/lib/ai/prompts';
import { copilotTools } from '@/lib/ai/tools';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: 'OPENAI_API_KEY is required for chat. Deterministic analysis and backtesting remain available without it.' },
      { status: 503 },
    );
  }

  try {
    const { messages }: { messages: UIMessage[] } = await req.json();
    const result = streamText({
      model: openai(process.env.AI_MODEL ?? 'gpt-5.4'),
      system: copilotPrompt,
      messages: await convertToModelMessages(messages, { tools: copilotTools }),
      tools: copilotTools,
      stopWhen: stepCountIs(6),
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => error instanceof Error ? error.message : 'Copilot request failed.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process chat request.';
    return Response.json({ error: message }, { status: 400 });
  }
}
