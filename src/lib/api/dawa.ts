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

export async function searchAddress(query: string): Promise<AddressSuggestion[]> {
  if (!query || query.length < 2 || !PUBLIC_MAPBOX_TOKEN) return [];

  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?country=dk&types=address&autocomplete=true&limit=5&access_token=${PUBLIC_MAPBOX_TOKEN}`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.features ?? []).map((feature: any) => {
      const context: any[] = feature.context ?? [];
      const postnr = context.find((c) => c.id?.startsWith('postcode'))?.text ?? '';
      const city = context.find((c) => c.id?.startsWith('place'))?.text ?? '';
      const neighbourhood =
        context.find((c) => c.id?.startsWith('neighborhood') || c.id?.startsWith('locality'))
          ?.text ?? city;

      // feature.text is the street name + number (e.g. "Vesterbrogade 1")
      // feature.place_name is the full string (e.g. "Vesterbrogade 1, 1620 København, Denmark")
      const primaryLine = feature.text ?? feature.place_name.split(',')[0].trim();
      const secondaryLine = [postnr, city, neighbourhood !== city ? neighbourhood : '']
        .filter(Boolean)
        .join(' · ');

      return {
        label: feature.place_name,
        id: feature.id ?? '',
        postnr,
        kommunekode: '0101',
        lat: feature.center[1],
        lon: feature.center[0],
        neighbourhood,
        primaryLine,
        secondaryLine,
      };
    });
  } catch {
    return [];
  }
}
