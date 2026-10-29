import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, stepCountIs, streamText, TypeValidationError, validateUIMessages } from 'ai';
import { z } from 'zod';
import { copilotPrompt } from '@/lib/ai/prompts';
import { copilotTools } from '@/lib/ai/tools';

export const runtime = 'nodejs';
export const maxDuration = 60;

const inputSchema = z.object({
  messages: z.array(z.unknown()).min(1).max(100),
}).strict();

const maxBodyChars = 1_000_000;

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: 'OPENAI_API_KEY is required for chat. Deterministic analysis and backtesting remain available without it.' },
      { status: 503 },
    );
  }

  try {
    const raw = await req.text();
    if (raw.length > maxBodyChars) {
      return Response.json({ error: 'Chat request is too large.' }, { status: 413 });
    }

    const body = inputSchema.parse(JSON.parse(raw));
    // Validate message/part shapes and tool inputs before any provider work,
    // so malformed history is a 400 rather than a TypeError (500).
    const messages = await validateUIMessages({ messages: body.messages, tools: copilotTools });
    // The server owns the system prompt; client-supplied system messages would
    // otherwise be forwarded to the model alongside copilotPrompt.
    if (messages.some((message) => message.role === 'system')) {
      return Response.json({ error: 'Invalid chat request.' }, { status: 400 });
    }
    const result = streamText({
      model: openai(process.env.AI_MODEL ?? 'gpt-5.4'),
      system: copilotPrompt,
      messages: await convertToModelMessages(messages, { tools: copilotTools }),
      tools: copilotTools,
      stopWhen: stepCountIs(6),
    });

    return result.toUIMessageStreamResponse({
      onError: () => 'Copilot request failed.',
    });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError || TypeValidationError.isInstance(error)) {
      return Response.json({ error: 'Invalid chat request.' }, { status: 400 });
    }
    return Response.json({ error: 'Unable to process chat request.' }, { status: 500 });
  }
}
