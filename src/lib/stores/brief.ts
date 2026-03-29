import { writable } from 'svelte/store';
import type { AreaBrief, ChatMessage } from '$lib/types';

export const brief = writable<AreaBrief | null>(null);
export const chatMessages = writable<ChatMessage[]>([]);
export const isChatLoading = writable(false);
