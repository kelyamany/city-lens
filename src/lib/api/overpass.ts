import type { POI } from '$lib/types';

export async function getPOIs(lat: number, lon: number, radiusMeters: number = 500): Promise<POI[]> {
  const query = `[out:json][timeout:15];
(
  node["amenity"~"school|hospital|cafe|restaurant|library|kindergarten|pharmacy|clinic"](around:${radiusMeters},${lat},${lon});
  node["leisure"~"park|playground|sports_centre"](around:${radiusMeters},${lat},${lon});
);
out body;`;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) return [];

    const data = await res.json();
    return (data.elements || []).map((el: any) => ({
      type: el.tags?.amenity || el.tags?.leisure || 'unknown',
      name: el.tags?.name || el.tags?.amenity || el.tags?.leisure || 'Unnamed',
      lat: el.lat,
      lon: el.lon,
    }));
  } catch {
    return [];
  }
}
