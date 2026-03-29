import { env } from '$env/dynamic/public';
const PUBLIC_MAPBOX_TOKEN = env.PUBLIC_MAPBOX_TOKEN;

export interface AddressSuggestion {
  label: string;
  id: string;
  postnr: string;
  kommunekode: string;
  lat: number;
  lon: number;
  neighbourhood: string;
  primaryLine: string;
  secondaryLine: string;
}

function mapFeature(feature: any): AddressSuggestion {
  const context: any[] = feature.context ?? [];
  const postnr = context.find((c) => c.id?.startsWith('postcode'))?.text ?? '';
  const city = context.find((c) => c.id?.startsWith('place'))?.text ?? '';
  const neighbourhood =
    context.find((c) => c.id?.startsWith('neighborhood') || c.id?.startsWith('locality'))?.text ?? city;
  return {
    label: feature.place_name,
    id: feature.id ?? '',
    postnr,
    kommunekode: '0101',
    lat: feature.center[1],
    lon: feature.center[0],
    neighbourhood,
    primaryLine: feature.text ?? feature.place_name.split(',')[0].trim(),
    secondaryLine: [postnr, city, neighbourhood !== city ? neighbourhood : ''].filter(Boolean).join(' · '),
  };
}

export async function searchAddress(query: string): Promise<AddressSuggestion[]> {
  if (!query || query.length < 2 || !PUBLIC_MAPBOX_TOKEN) return [];

  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?country=dk&types=address&autocomplete=true&limit=5&access_token=${PUBLIC_MAPBOX_TOKEN}`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.features ?? []).map(mapFeature);
  } catch {
    return [];
  }
}

export async function geocodeAddress(
  query: string,
  proximity?: { lng: number; lat: number }
): Promise<AddressSuggestion | null> {
  if (!query || !PUBLIC_MAPBOX_TOKEN) return null;

  const prox = proximity ? `&proximity=${proximity.lng},${proximity.lat}` : '';
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?country=dk&types=address&limit=1${prox}&access_token=${PUBLIC_MAPBOX_TOKEN}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.features?.[0];
    return feature ? mapFeature(feature) : null;
  } catch {
    return null;
  }
}
