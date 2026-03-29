import { json } from '@sveltejs/kit';
import { getPOIs } from '$lib/api/overpass';
import { resolveDistrict } from '$lib/api/districtResolver';

export async function POST({ request }) {
  const { lat, lon, postnr, radius = 500 } = await request.json();

  const demographics = resolveDistrict(postnr);
  if (!demographics) {
    return json({ error: 'District not found for postal code ' + postnr }, { status: 404 });
  }

  const pois = await getPOIs(lat, lon, radius);
  return json({ demographics, pois });
}
