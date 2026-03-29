export interface AddressSuggestion {
  label: string;
  id: string;
  postnr: string;
  kommunekode: string;
  lat: number;
  lon: number;
  neighbourhood: string;
}

export async function searchAddress(query: string): Promise<AddressSuggestion[]> {
  if (!query || query.length < 2) return [];

  try {
    // Use /adresser endpoint (not autocomplete) — returns full objects including x/y coords
    const res = await fetch(
      `https://api.dataforsyningen.dk/adresser?q=${encodeURIComponent(query)}&per_side=5&struktur=mini`
    );
    if (!res.ok) return [];

    const items = await res.json();
    return items.map((item: any) => ({
      label: `${item.vejnavn} ${item.husnr}, ${item.postnr} ${item.postnrnavn}`,
      id: item.id ?? '',
      postnr: item.postnr ?? '',
      kommunekode: item.kommunekode ?? '',
      lat: item.y ?? 55.6761,
      lon: item.x ?? 12.5683,
      neighbourhood: item.supplerendebynavn || item.postnrnavn || '',
    }));
  } catch {
    return [];
  }
}
