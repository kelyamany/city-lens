import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { SocialCategory } from '$lib/types';

const CATEGORIES = [
  { type: 'cafe', label: 'Cafes' },
  { type: 'restaurant', label: 'Restaurants' },
  { type: 'bar', label: 'Bars' },
  { type: 'park', label: 'Parks' },
  { type: 'gym', label: 'Gyms' },
  { type: 'library', label: 'Libraries' },
  { type: 'museum', label: 'Museums' },
  { type: 'supermarket', label: 'Supermarkets' },
];

export async function POST({ request }) {
  const key = env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return json({ categories: [], error: 'Google Places API not configured' });
  }

  const { lat, lon, radius = 1000 } = await request.json();

  const results: SocialCategory[] = await Promise.all(
    CATEGORIES.map(async (cat) => {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=${radius}&type=${cat.type}&key=${key}`;
        const res = await fetch(url);
        const data = await res.json();
        const places = (data.results ?? []).slice(0, 5);

        const rated = places.filter((p: any) => typeof p.rating === 'number');
        const avgRating =
          rated.length > 0
            ? rated.reduce((sum: number, p: any) => sum + p.rating, 0) / rated.length
            : 0;

        const topPlaces = rated
          .sort((a: any, b: any) => b.rating - a.rating)
          .slice(0, 3)
          .map((p: any) => ({
            name: p.name,
            rating: p.rating,
            address: p.vicinity ?? '',
            placeId: p.place_id ?? '',
          }));

        return { type: cat.type, label: cat.label, avgRating, count: places.length, topPlaces };
      } catch {
        return { type: cat.type, label: cat.label, avgRating: 0, count: 0, topPlaces: [] };
      }
    })
  );

  return json({ categories: results });
}
