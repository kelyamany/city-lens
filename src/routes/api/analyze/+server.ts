import { json } from '@sveltejs/kit';
import { generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { getPOIs } from '$lib/api/overpass';
import { resolveDistrict } from '$lib/api/districtResolver';
import { AI_PROVIDER, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY } from '$env/static/private';

const anthropicAI = createAnthropic({ apiKey: ANTHROPIC_API_KEY });
const googleAI = createGoogleGenerativeAI({ apiKey: GOOGLE_GENERATIVE_AI_API_KEY });

const getModel = () =>
  AI_PROVIDER === 'gemini'
    ? googleAI('gemini-2.0-flash')
    : anthropicAI('claude-sonnet-4-6');

const schema = z.object({
  summary: z.string().describe('2-3 sentence description of the area and recommendation'),
  topUse: z.string().describe('Short label for the top recommended land use e.g. Community Health Centre'),
  tags: z.array(z.string()).max(3).describe('2-3 short category tags'),
  reasoning: z.string().describe('One paragraph evidence-based reasoning citing the data'),
});

export async function POST({ request }) {
  const { address, lat, lon, postnr, neighbourhood, radius = 500 } = await request.json();

  const demographics = resolveDistrict(postnr);
  if (!demographics) {
    return json({ error: 'District not found for postal code ' + postnr }, { status: 404 });
  }

  const pois = await getPOIs(lat, lon, radius);
  const poiSummary = pois.reduce((acc: Record<string, number>, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {});

  const totalPop = demographics.totalPopulation;
  const employedPct = totalPop > 0
    ? Math.round((demographics.employment.employed / totalPop) * 100) : 0;
  const higherEdPct = demographics.education.mediumHigher + demographics.education.longHigher;
  const higherEdTotal = Object.values(demographics.education).reduce((a, b) => a + b, 0);
  const higherEdShare = higherEdTotal > 0 ? Math.round((higherEdPct / higherEdTotal) * 100) : 0;

  const prompt = `You are an expert urban planning assistant for Copenhagen Municipality.

A vacant plot of land is located at: ${address} (${neighbourhood}, Copenhagen, postal code ${postnr}).

AREA DEMOGRAPHICS (${neighbourhood} / ${neighbourhood?.includes('Enghave') ? 'Vesterbro/Kongens Enghave' : 'Copenhagen'} district):
- Total district population: ${totalPop.toLocaleString()}
- Median age: ${demographics.medianAge} years
- Gender split: ${Math.round((demographics.male / totalPop) * 100)}% male / ${Math.round((demographics.female / totalPop) * 100)}% female
- Employment rate: ${employedPct}% employed, ${Math.round((demographics.employment.unemployed / totalPop) * 100)}% unemployed
- Higher education (medium + long): ${higherEdShare}% of population
- Background: ${Math.round((demographics.background.danish / totalPop) * 100)}% Danish, ${Math.round((demographics.background.western / totalPop) * 100)}% Western, ${Math.round((demographics.background.nonWestern / totalPop) * 100)}% Non-Western
- Marital status: ${Math.round((demographics.maritalStatus.single / totalPop) * 100)}% single, ${Math.round((demographics.maritalStatus.married / totalPop) * 100)}% married

NEARBY FACILITIES within ${radius}m:
${Object.keys(poiSummary).length > 0 ? JSON.stringify(poiSummary, null, 2) : 'No facilities found in radius'}

Based on this data, recommend the single best use for this vacant plot to maximise value
for local residents. Be specific, evidence-based, and practical. Reference specific data
points in your reasoning (e.g. "given the ${employedPct}% employment rate...").`;

  const { object } = await generateObject({ model: getModel(), schema, prompt });

  return json({ demographics, pois, ...object });
}
