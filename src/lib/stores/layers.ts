import { writable } from 'svelte/store';
import type { LayerState } from '$lib/types';

export const layers = writable<LayerState[]>([
  { id: 'demographics', label: 'Demographics', icon: 'users', active: true },
  { id: 'income', label: 'Income & Education', icon: 'graduation-cap', active: true },
  { id: 'facilities', label: 'Nearby Facilities', icon: 'map-pin', active: false },
  { id: 'social', label: 'Social Ratings', icon: 'star', active: false },
]);
