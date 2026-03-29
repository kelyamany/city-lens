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

// ── Pre-fetch place data directly (avoids tool-call fragility with Gemini) ──
const PLACE_KEYWORDS = /vibe|cafe|café|restaurant|bar|pub|review|social|local scene|venue|dine|eat|drink|hangout/i;

async function fetchNearbyPlaces(lat: number, lon: number, radius: number): Promise<string> {
  const key = env.GOOGLE_PLACES_API_KEY;
  if (!key) return '';

  const categories = ['cafe', 'restaurant', 'bar'];
  const lines: string[] = [];

  await Promise.all(
    categories.map(async (type) => {
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
          `?location=${lat},${lon}&radius=${radius}&type=${type}&key=${key}`
        );
        const data = await res.json();
        const top = (data.results ?? []).slice(0, 3) as any[];
        for (const p of top) {
          lines.push(`  [${type}] ${p.name} — ${p.rating ?? '?'}★ (${p.user_ratings_total ?? 0} ratings)`);
        }
      } catch { /* skip category on error */ }
    })
  );

  if (lines.length === 0) return '';
  return `\nNEARBY SOCIAL VENUES (live Google Maps data within ${radius}m):\n${lines.join('\n')}`;
}

function buildSystemPrompt(context: any, placeContext = ''): string {
  const b = context?.brief;

  let demoPart = 'No demographic analysis has been run yet for this location.';
  if (b) {
    const d = b.demographics ?? {};
    const totalPop = d.totalPopulation ?? 0;
    const pct = (n: number) => totalPop > 0 ? Math.round((n / totalPop) * 100) : 0;
    const edTotal = Math.max(Object.values(d.education ?? {}).reduce((a: number, v: unknown) => a + (v as number), 0), 1);
    const higherEdPct = Math.round(((d.education?.mediumHigher ?? 0) + (d.education?.longHigher ?? 0)) / edTotal * 100);
    const poiSummary = (b.pois ?? []).reduce((acc: Record<string, number>, p: any) => {
      acc[p.type] = (acc[p.type] ?? 0) + 1; return acc;
    }, {});

    demoPart = `
DEMOGRAPHICS (${context.neighbourhood ?? 'district'}):
- Total population: ${totalPop.toLocaleString()}
- Median age: ${d.medianAge ?? '?'} yrs
- Gender: ${pct(d.male)}% M / ${pct(d.female)}% F
- Employment: ${pct(d.employment?.employed)}% employed, ${pct(d.employment?.unemployed)}% unemployed
- Higher education: ${higherEdPct}% have medium or long higher education
- Background: ${pct(d.background?.danish)}% Danish, ${pct(d.background?.western)}% Western, ${pct(d.background?.nonWestern)}% Non-Western
- Marital: ${pct(d.maritalStatus?.single)}% single, ${pct(d.maritalStatus?.married)}% married

NEARBY FACILITIES within ${context.radius ?? 500}m (OpenStreetMap):
${Object.keys(poiSummary).length > 0 ? Object.entries(poiSummary).map(([k, v]) => `  ${k}: ${v}`).join('\n') : '  None found'}`;
  }

  return `You are an objective urban planning assistant for Copenhagen Municipality helping planners, urban designers, and residents understand an area.

LOCATION: ${context.address ?? 'unknown'} (analysis radius: ${context.radius ?? 500}m)
${demoPart}${placeContext}

Guidelines:
- Be objective and evidence-based — cite actual data points
- Be concise and conversational — 2-5 sentences unless more detail is requested
- When asked to change the radius, call the setRadius tool
- Never invent facts — if data is unavailable, say so clearly
- Consider multiple perspectives (planner, resident, developer) when relevant`;
}

export async function POST({ request }) {
  const { messages, context } = await request.json();

  try {
    // Pre-fetch place data if the question is about social scene / venues
    // This avoids relying on the tool-call mechanism which is fragile with Gemini
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user')?.content ?? '';
    let placeContext = '';
    if (PLACE_KEYWORDS.test(lastUserMsg) && context.lat && context.lon) {
      placeContext = await fetchNearbyPlaces(context.lat, context.lon, context.radius ?? 1000);
    }

    const result = await generateText({
      model: getModel(),
      system: buildSystemPrompt(context, placeContext),
      messages,
      tools: {
        setRadius: tool({
          description: 'Change the POI analysis radius around the selected plot in meters',
          inputSchema: z.object({
            meters: z.number().min(100).max(2000).describe('Radius in meters, e.g. 1000 for 1km'),
          }),
          execute: async ({ meters }: { meters: number }) => ({
            action: 'setRadius',
            value: meters,
          }),
        }),
      },
      maxSteps: 3,
    });

    const content =
      result.text ||
      result.steps.map((s: any) => s.text as string).filter((t) => t?.trim()).at(-1) ||
      'I could not generate a response. Please try rephrasing.';

    return json({ content, steps: result.steps });
  } catch (e) {
    console.error('Chat error:', e);
    return json({ content: 'Sorry, something went wrong. Please try again.' });
  }
}
