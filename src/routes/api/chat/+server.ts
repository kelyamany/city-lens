import { json } from '@sveltejs/kit';
import { generateText, tool } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { env } from '$env/dynamic/private';

const getModel = () => {
  const provider = env.AI_PROVIDER;
  const anthropicKey = env.ANTHROPIC_API_KEY;
  const googleKey = env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (provider === 'gemini' && googleKey) {
    return createGoogleGenerativeAI({ apiKey: googleKey })('gemini-3-flash-preview');
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
    const higherEdPct = totalPop > 0
      ? Math.round(((d.education?.mediumHigher ?? 0) + (d.education?.longHigher ?? 0)) /
          Math.max(Object.values(d.education ?? {}).reduce((a: number, b: unknown) => a + (b as number), 0), 1) * 100)
      : 0;
    const singlePct = totalPop > 0 ? Math.round((d.maritalStatus?.single / totalPop) * 100) : 0;
    const poiSummary = (b.pois ?? []).reduce((acc: Record<string, number>, p: any) => {
      acc[p.type] = (acc[p.type] ?? 0) + 1;
      return acc;
    }, {});

    demoPart = `
DEMOGRAPHICS (${context.neighbourhood ?? 'district'}, postal code area):
- Total population: ${totalPop.toLocaleString()}
- Median age: ${d.medianAge ?? '?'} yrs
- Gender: ${totalPop > 0 ? Math.round((d.male / totalPop) * 100) : 0}% M / ${totalPop > 0 ? Math.round((d.female / totalPop) * 100) : 0}% F
- Employment: ${empPct}% employed, ${totalPop > 0 ? Math.round((d.employment?.unemployed / totalPop) * 100) : 0}% unemployed
- Higher education: ${higherEdPct}% have medium or long higher education
- Background: ${danishPct}% Danish, ${totalPop > 0 ? Math.round((d.background?.western / totalPop) * 100) : 0}% Western, ${totalPop > 0 ? Math.round((d.background?.nonWestern / totalPop) * 100) : 0}% Non-Western
- Marital status: ${singlePct}% single, ${totalPop > 0 ? Math.round((d.maritalStatus?.married / totalPop) * 100) : 0}% married

NEARBY FACILITIES within ${context.radius ?? 500}m:
${Object.keys(poiSummary).length > 0 ? Object.entries(poiSummary).map(([k, v]) => `  ${k}: ${v}`).join('\n') : '  None found'}`;
  }

  return `You are an objective urban planning assistant for Copenhagen Municipality. You help municipality planners, urban designers, and residents understand areas of Copenhagen.

LOCATION: ${context.address ?? 'unknown'} (analysis radius: ${context.radius ?? 500}m)
${demoPart}

Guidelines:
- Be objective and evidence-based — cite actual numbers from the data above
- Be concise and conversational — 2-5 sentences unless detail is explicitly requested
- When recommending land use, weigh the data carefully and present pros/cons
- When asked about radius changes (e.g. "show 1km"), call the setRadius tool
- When asked about local vibe, cafes, restaurants, parks or reviews, call queryPlaceReviews
- Never invent facts — if data is missing, say so
- Address the question from multiple perspectives (planner, resident, developer) when relevant`;
}

export async function POST({ request }) {
  const { messages, context } = await request.json();

  try {
    const result = await generateText({
      model: getModel(),
      system: buildSystemPrompt(context),
      messages,
      tools: {
        setRadius: tool({
          description: 'Change the POI analysis radius around the selected plot in meters',
          inputSchema: z.object({
            meters: z.number().min(100).max(2000).describe('Radius in meters'),
          }),
          execute: async ({ meters }: { meters: number }) => ({
            action: 'setRadius',
            value: meters,
          }),
        }),

        queryPlaceReviews: tool({
          description: 'Fetch Google Maps ratings and reviews for a category of places near the location. Use when asked about local vibe, specific venue types, or social context.',
          inputSchema: z.object({
            category: z.string().describe('Place type: cafe, restaurant, bar, park, gym, library, museum, supermarket'),
          }),
          execute: async ({ category }: { category: string }) => {
            const key = env.GOOGLE_PLACES_API_KEY;
            if (!key || !context?.lat || !context?.lon) {
              return { error: 'Google Places not configured or location missing' };
            }
            try {
              const radius = context.radius ?? 1000;
              const searchRes = await fetch(
                `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${context.lat},${context.lon}&radius=${radius}&type=${category}&key=${key}`
              );
              const searchData = await searchRes.json();
              const top3 = (searchData.results ?? []).slice(0, 3);

              const places = await Promise.all(
                top3.map(async (place: any) => {
                  try {
                    const detailRes = await fetch(
                      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,reviews,rating&key=${key}`
                    );
                    const detailData = await detailRes.json();
                    const r = detailData.result ?? {};
                    return {
                      name: r.name ?? place.name,
                      rating: r.rating ?? place.rating,
                      reviews: (r.reviews ?? []).slice(0, 2).map((rv: any) => rv.text?.slice(0, 200)),
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
      maxSteps: 5,
    });

    // Collect text from all steps — when tools are called, the final text
    // may be in an earlier step if maxSteps runs out before a new text step.
    const content =
      result.text ||
      result.steps
        .map((s: any) => s.text as string)
        .filter((t) => t?.trim())
        .at(-1) ||
      'I processed your request but could not generate a text response. Please try rephrasing.';

    return json({ content, steps: result.steps });
  } catch (e) {
    console.error('Chat error:', e);
    return json({ content: 'Sorry, I could not process that request. Please try again.' });
  }
}
