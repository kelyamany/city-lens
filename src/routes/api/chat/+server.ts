import { streamText, tool } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { env } from '$env/dynamic/private';

const getModel = () => {
  const provider = env.AI_PROVIDER;
  const anthropicKey = env.ANTHROPIC_API_KEY;
  const googleKey = env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (provider === 'gemini' && googleKey) {
    return createGoogleGenerativeAI({ apiKey: googleKey })('gemini-2.0-flash');
  }
  return createAnthropic({ apiKey: anthropicKey ?? '' })('claude-sonnet-4-6');
};

function buildSystemPrompt(context: any): string {
  const b = context?.brief;
  const hasDemo = !!b;

  let demoPart = 'No analysis has been run yet for this location.';
  if (hasDemo) {
    const d = b.demographics ?? {};
    const totalPop = d.totalPopulation ?? 0;
    const empPct = totalPop > 0 ? Math.round((d.employment?.employed / totalPop) * 100) : 0;
    const danishPct = totalPop > 0 ? Math.round((d.background?.danish / totalPop) * 100) : 0;
    const poiSummary = (b.pois ?? []).reduce((acc: Record<string, number>, p: any) => {
      acc[p.type] = (acc[p.type] ?? 0) + 1;
      return acc;
    }, {});

    demoPart = `
AI RECOMMENDATION: ${b.topUse ?? 'N/A'}
SUMMARY: ${b.summary ?? ''}
REASONING: ${b.reasoning ?? ''}
TAGS: ${(b.tags ?? []).join(', ')}

DEMOGRAPHICS (${context.neighbourhood ?? 'district'}):
- Population: ${totalPop.toLocaleString()}
- Median age: ${d.medianAge ?? '?'} yrs
- Gender: ${totalPop > 0 ? Math.round((d.male / totalPop) * 100) : 0}% M / ${totalPop > 0 ? Math.round((d.female / totalPop) * 100) : 0}% F
- Employment: ${empPct}% employed
- Background: ${danishPct}% Danish, ${totalPop > 0 ? Math.round((d.background?.western / totalPop) * 100) : 0}% Western, ${totalPop > 0 ? Math.round((d.background?.nonWestern / totalPop) * 100) : 0}% Non-Western
- Marital: ${totalPop > 0 ? Math.round((d.maritalStatus?.single / totalPop) * 100) : 0}% single, ${totalPop > 0 ? Math.round((d.maritalStatus?.married / totalPop) * 100) : 0}% married

NEARBY FACILITIES within ${context.radius ?? 500}m:
${Object.keys(poiSummary).length > 0 ? Object.entries(poiSummary).map(([k, v]) => `  ${k}: ${v}`).join('\n') : '  None found'}`;
  }

  return `You are an urban planning assistant for Copenhagen Municipality helping analyze vacant plots of land.

LOCATION: ${context.address ?? 'unknown'} (analysis radius: ${context.radius ?? 500}m)
${demoPart}

Guidelines:
- Be concise and conversational — answer in 2-4 sentences unless more detail is requested
- Reference actual data above when relevant (e.g. "given the ${hasDemo ? Math.round(((b?.demographics?.employment?.employed ?? 0) / (b?.demographics?.totalPopulation ?? 1)) * 100) : '?'}% employment rate...")
- When the user asks to change the radius (e.g. "show 1km", "expand to 800m"), call the setRadius tool
- When the user asks about specific places, reviews, or local amenities, call the queryPlaceReviews tool
- Stay focused on urban planning, demographics, and local area insights`;
}

export async function POST({ request }) {
  const { messages, context } = await request.json();

  const result = streamText({
    model: getModel(),
    system: buildSystemPrompt(context),
    messages,
    tools: {
      setRadius: tool({
        description: 'Change the POI analysis radius around the selected plot in meters',
        inputSchema: z.object({
          meters: z
            .number()
            .min(100)
            .max(2000)
            .describe('Radius in meters, e.g. 500 for 500m, 1000 for 1km'),
        }),
        execute: async ({ meters }: { meters: number }) => ({
          action: 'setRadius',
          value: meters,
        }),
      }),

      queryPlaceReviews: tool({
        description:
          'Fetch Google Maps reviews and ratings for a specific category of places near the analyzed location. Use this when the user asks about specific types of venues, local vibe, or wants social context.',
        inputSchema: z.object({
          category: z
            .string()
            .describe(
              'Place type to search for, e.g. "cafe", "restaurant", "bar", "park", "gym", "library", "museum"'
            ),
        }),
        execute: async ({ category }: { category: string }) => {
          const key = env.GOOGLE_PLACES_API_KEY;
          if (!key || !context?.lat || !context?.lon) {
            return { error: 'Google Places not configured or location missing' };
          }

          try {
            const radius = context.radius ?? 1000;
            const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${context.lat},${context.lon}&radius=${radius}&type=${category}&key=${key}`;
            const searchRes = await fetch(searchUrl);
            const searchData = await searchRes.json();
            const top3 = (searchData.results ?? []).slice(0, 3);

            const places = await Promise.all(
              top3.map(async (place: any) => {
                try {
                  const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,reviews,rating&key=${key}`;
                  const detailRes = await fetch(detailUrl);
                  const detailData = await detailRes.json();
                  const result = detailData.result ?? {};
                  return {
                    name: result.name ?? place.name,
                    rating: result.rating ?? place.rating,
                    reviews: (result.reviews ?? [])
                      .slice(0, 2)
                      .map((r: any) => r.text?.slice(0, 200)),
                  };
                } catch {
                  return { name: place.name, rating: place.rating, reviews: [] };
                }
              })
            );

            return { category, places };
          } catch {
            return { category, places: [], error: 'Failed to fetch place reviews' };
          }
        },
      }),
    },
  });

  return result.toTextStreamResponse();
}
