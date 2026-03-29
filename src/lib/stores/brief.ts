import { writable } from 'svelte/store';
import type { AreaBrief } from '$lib/types';

export const brief = writable<AreaBrief | null>(null);
