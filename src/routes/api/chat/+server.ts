import { streamText, tool } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { AI_PROVIDER, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY } from '$env/static/private';

const anthropicAI = createAnthropic({ apiKey: ANTHROPIC_API_KEY });
const googleAI = createGoogleGenerativeAI({ apiKey: GOOGLE_GENERATIVE_AI_API_KEY });

const getModel = () =>
  AI_PROVIDER === 'gemini'
    ? googleAI('gemini-3-flash-preview')
    : anthropicAI('claude-sonnet-4-6');

export async function POST({ request }) {
  const { messages, context } = await request.json();

  const result = streamText({
    model: getModel(),
    system: `You are an urban planning assistant for Copenhagen Municipality.
The user is analyzing a vacant plot of land. Current area context:
${JSON.stringify(context, null, 2)}

Answer follow-up questions concisely in plain language suitable for non-technical planners.
When the user asks to change the analysis radius (e.g. "show 1km radius", "zoom out to 800m"),
call the setRadius tool with the appropriate meter value.
Be specific and reference the actual data provided in context.`,
    messages,
    tools: {
      setRadius: tool({
        description: 'Change the POI analysis radius around the selected plot in meters',
        inputSchema: z.object({
          meters: z.number().min(100).max(2000)
            .describe('Radius in meters, e.g. 500 for 500m, 1000 for 1km'),
        }),
        execute: async ({ meters }: { meters: number }) => ({
          action: 'setRadius',
          value: meters,
        }),
      }),
    },
  });

  return result.toTextStreamResponse();
}
