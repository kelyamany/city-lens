import { json } from '@sveltejs/kit';
import { getPOIs } from '$lib/api/overpass';
import { resolveDistrict } from '$lib/api/districtResolver';
import { fetchPostalDemographics } from '$lib/api/dst';

export async function POST({ request }) {
  const { lat, lon, postnr, radius = 500 } = await request.json();

  const staticDemo = resolveDistrict(postnr);
  if (!staticDemo) {
    return json({ error: 'District not found for postal code ' + postnr }, { status: 404 });
  }

  // Augment with live DST data (postal-code level age + gender), fallback to static on error
  let demographics = staticDemo;
  const dstData = await fetchPostalDemographics(postnr);
  if (dstData) {
    demographics = {
      ...staticDemo,
      totalPopulation: dstData.totalPopulation,
      male: dstData.male,
      female: dstData.female,
      agePyramid: dstData.agePyramid,
      medianAge: dstData.medianAge,
    };
  }

  const pois = await getPOIs(lat, lon, radius);
  return json({ demographics, pois });
}
