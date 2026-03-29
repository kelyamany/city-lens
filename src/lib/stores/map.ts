import { writable } from 'svelte/store';

export const selectedLocation = writable<{
  lat: number;
  lon: number;
  address: string;
  postnr: string;
  neighbourhood: string;
  kommunekode: string;
} | null>(null);

export const isAnalyzing = writable(false);
export const analysisRadius = writable(500);
export const mapCenter = writable<{ lng: number; lat: number }>({ lng: 12.5683, lat: 55.6761 });
