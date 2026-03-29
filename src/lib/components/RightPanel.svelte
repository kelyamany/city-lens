<script lang="ts">
  import { MapPin } from 'lucide-svelte';
  import { marked } from 'marked';
  import { selectedLocation, isAnalyzing, analysisRadius } from '$lib/stores/map';
  import { brief } from '$lib/stores/brief';
  import StatCard from './StatCard.svelte';
  import ChatInput from './ChatInput.svelte';
  import InsightsPanel from './InsightsPanel.svelte';
  import SocialPanel from './SocialPanel.svelte';
  import type { ChatMessage, SocialData } from '$lib/types';

  let { chatMessages = [], onChatSubmit, isChatLoading = false }: {
    chatMessages?: ChatMessage[];
    onChatSubmit: (message: string) => void;
    isChatLoading?: boolean;
  } = $props();

  let activeTab = $state<'brief' | 'insights' | 'social'>('brief');

  // Social tab state
  let socialData = $state<SocialData | null>(null);
  let isSocialLoading = $state(false);
  let socialFetchedFor = $state<string | null>(null);

  // Suggestion chips shown before first message
  const CHIPS = [
    {
      icon: '🏗️',
      label: 'Best use for this plot?',
      prompt: 'Based on the demographics and nearby facilities, what is the best land use recommendation for this plot? Be specific and reference the data.',
    },
    {
      icon: '🏠',
      label: 'Good place to live?',
      prompt: 'Is this a good area to live in? Consider the demographics, nearby amenities, and social factors. Be honest about both strengths and weaknesses.',
    },
    {
      icon: '📊',
      label: 'Who lives here?',
      prompt: 'Give me a detailed breakdown of who lives in this area — age groups, employment, background, education level, and lifestyle.',
    },
    {
      icon: '⭐',
      label: "What's the local vibe?",
      prompt: 'What is the social scene like here? Use the queryPlaceReviews tool to look up nearby cafes and describe the local vibe based on real reviews.',
    },
    {
      icon: '🔍',
      label: "What's missing here?",
      prompt: "What types of services, facilities, or amenities are missing or underrepresented in this neighborhood compared to a typical well-served Copenhagen district?",
    },
  ];

  let showChips = $derived(chatMessages.length === 0 && !!$brief && !$isAnalyzing);

  let employedPct = $derived(() => {
    const d = $brief?.demographics;
    if (!d || !d.totalPopulation) return 0;
    return Math.round((d.employment.employed / d.totalPopulation) * 100);
  });

  let densityLabel = $derived(
    $brief?.pois
      ? $brief.pois.length > 20 ? 'High' : $brief.pois.length > 8 ? 'Medium' : 'Low'
      : '--'
  );

  // Chat thread scroll
  let chatThread: HTMLDivElement | undefined = $state();
  $effect(() => {
    if (chatMessages.length > 0 && chatThread) {
      chatThread.scrollTop = chatThread.scrollHeight;
    }
  });

  async function fetchSocialData(lat: number, lon: number, radius: number) {
    isSocialLoading = true;
    socialData = null;
    const key = `${lat},${lon},${radius}`;
    socialFetchedFor = key;
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lon, radius }),
      });
      socialData = await res.json();
    } catch {
      socialData = null;
    } finally {
      isSocialLoading = false;
    }
  }

  function switchToSocial() {
    activeTab = 'social';
    const loc = $selectedLocation;
    const key = loc ? `${loc.lat},${loc.lon},${$analysisRadius}` : null;
    if (loc && key !== socialFetchedFor) {
      fetchSocialData(loc.lat, loc.lon, $analysisRadius);
    }
  }

  function handleRadiusApply() {
    const loc = $selectedLocation;
    if (loc) fetchSocialData(loc.lat, loc.lon, $analysisRadius);
  }

  function sendChip(prompt: string) {
    onChatSubmit(prompt);
  }
</script>

<aside class="right-panel">
  <!-- Mobile drag handle -->
  <div class="drag-handle" aria-hidden="true">
    <span class="handle-bar"></span>
  </div>

  <div class="panel-header">
    <h2>Area Brief</h2>
  </div>

  <div class="tab-bar">
    <button class="tab" class:active={activeTab === 'brief'} onclick={() => (activeTab = 'brief')}>
      Insights
    </button>
    <button class="tab" class:active={activeTab === 'insights'} onclick={() => (activeTab = 'insights')}>
      Metrics
    </button>
    <button class="tab" class:active={activeTab === 'social'} onclick={switchToSocial}>
      Social Lens
    </button>
  </div>

  <div class="panel-body">
    {#if activeTab === 'brief'}
      {#if !$selectedLocation}
        <!-- Empty state -->
        <div class="empty-state">
          <MapPin size={32} color="#9ca3af" />
          <p>Select an address or click the map to explore an area</p>
        </div>

      {:else}
        <!-- Location label -->
        <p class="location-label">{$selectedLocation.address}</p>

        <!-- Stat cards -->
        {#if $isAnalyzing}
          <div class="stats-skeleton">
            {#each [1,2,3] as _}
              <div class="stat-skel"></div>
            {/each}
          </div>
        {:else if $brief?.demographics}
          <div class="stat-row">
            <StatCard label="Age" value={$brief.demographics.medianAge} unit="yrs" />
            <StatCard label="Employment" value="{employedPct()}%" unit="employed" />
            <StatCard label="Density" value={densityLabel} unit="" />
          </div>
        {/if}

        <!-- Chat thread -->
        {#if chatMessages.length > 0}
          <div class="chat-thread" bind:this={chatThread}>
            {#each chatMessages as msg}
              <div class="chat-msg {msg.role}">
                {#if msg.role === 'assistant'}
                  <div class="md">{@html marked.parse(msg.content)}</div>
                {:else}
                  <p>{msg.content}</p>
                {/if}
              </div>
            {/each}

            {#if isChatLoading}
              <div class="chat-msg assistant thinking">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Suggestion chips (shown before first message) -->
        {#if showChips}
          <div class="chips-section">
            <p class="chips-label">Ask the AI about this area</p>
            <div class="chips-list">
              {#each CHIPS as chip}
                <button
                  class="chip"
                  onclick={() => sendChip(chip.prompt)}
                  disabled={isChatLoading}
                >
                  <span class="chip-icon">{chip.icon}</span>
                  <span class="chip-text">{chip.label}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Chat input (shown once location is selected) -->
        {#if $brief || $isAnalyzing}
          <div class="chat-input-wrap">
            <ChatInput onSubmit={onChatSubmit} disabled={isChatLoading || $isAnalyzing} />
          </div>
        {/if}
      {/if}

    {:else if activeTab === 'insights'}
      <InsightsPanel />

    {:else if activeTab === 'social'}
      <SocialPanel data={socialData} isLoading={isSocialLoading} onRadiusApply={handleRadiusApply} />
    {/if}
  </div>
</aside>

<style>
  .right-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-surface);
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.06);
    z-index: 10;
    overflow: hidden;
  }

  /* Mobile drag handle */
  .drag-handle {
    display: none;
    justify-content: center;
    align-items: center;
    padding: 10px 0 4px;
    flex-shrink: 0;
  }
  .handle-bar {
    width: 40px;
    height: 4px;
    background: #d1d5db;
    border-radius: 2px;
  }
  @media (max-width: 640px) {
    .drag-handle { display: flex; }
  }

  .panel-header {
    padding: 20px 20px 0;
    flex-shrink: 0;
  }
  .panel-header h2 {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text);
  }

  .tab-bar {
    display: flex;
    gap: 4px;
    padding: 12px 20px;
    flex-shrink: 0;
  }
  .tab {
    padding: 6px 14px;
    border: none;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    background: transparent;
    color: var(--color-text-muted);
    transition: all 0.15s;
    white-space: nowrap;
  }
  .tab.active {
    background: var(--color-primary);
    color: white;
  }

  /* Panel body — flex column so input stays at bottom */
  .panel-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0 20px 16px;
    min-height: 0;
    overflow: hidden;
  }

  /* Empty state */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    text-align: center;
  }
  .empty-state p {
    font-size: 13px;
    color: var(--color-text-muted);
    line-height: 1.5;
  }

  /* Location label */
  .location-label {
    font-size: 11px;
    color: var(--color-text-muted);
    margin-bottom: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
  }

  /* Stat row */
  .stat-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    flex-shrink: 0;
    margin-bottom: 16px;
  }

  /* Stats skeleton */
  .stats-skeleton {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    flex-shrink: 0;
    margin-bottom: 16px;
  }
  .stat-skel {
    height: 72px;
    background: #f3f4f6;
    border-radius: var(--radius-md);
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Chat thread — scrollable, grows to fill space */
  .chat-thread {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-bottom: 8px;
    min-height: 0;
  }

  .chat-msg {
    padding: 10px 13px;
    border-radius: 12px;
    font-size: 12.5px;
    line-height: 1.55;
    max-width: 88%;
  }
  .chat-msg.user {
    background: var(--color-primary);
    color: white;
    align-self: flex-end;
    border-bottom-right-radius: 4px;
  }
  .chat-msg.assistant {
    background: #f3f4f6;
    color: var(--color-text);
    align-self: flex-start;
    border-bottom-left-radius: 4px;
  }

  /* Markdown in assistant messages */
  .chat-msg.assistant :global(.md > *:first-child) { margin-top: 0; }
  .chat-msg.assistant :global(.md > *:last-child)  { margin-bottom: 0; }
  .chat-msg.assistant :global(.md p)   { margin: 0 0 6px; }
  .chat-msg.assistant :global(.md ul),
  .chat-msg.assistant :global(.md ol)  { margin: 4px 0 6px; padding-left: 16px; }
  .chat-msg.assistant :global(.md li)  { margin-bottom: 3px; }
  .chat-msg.assistant :global(.md strong) { font-weight: 600; }
  .chat-msg.assistant :global(.md em)     { font-style: italic; }
  .chat-msg.assistant :global(.md code)   { background: #e5e7eb; border-radius: 3px; padding: 1px 4px; font-size: 11px; font-family: monospace; }
  .chat-msg.assistant :global(.md h1),
  .chat-msg.assistant :global(.md h2),
  .chat-msg.assistant :global(.md h3) { font-size: 12px; font-weight: 700; margin: 6px 0 3px; }

  /* Thinking dots */
  .chat-msg.thinking {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 12px 14px;
    background: #f3f4f6;
    align-self: flex-start;
    border-bottom-left-radius: 4px;
  }
  .dot {
    width: 6px;
    height: 6px;
    background: #9ca3af;
    border-radius: 50%;
    animation: bounce 1.2s ease-in-out infinite;
  }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-4px); }
  }

  /* Suggestion chips */
  .chips-section {
    flex-shrink: 0;
    margin-top: 4px;
    margin-bottom: 4px;
  }
  .chips-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--color-text-muted);
    margin-bottom: 10px;
  }
  .chips-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .chip {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 14px;
    background: #f9fafb;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    font-size: 12.5px;
    color: var(--color-text);
    cursor: pointer;
    text-align: left;
    transition: background 0.12s, border-color 0.12s;
    line-height: 1.3;
  }
  .chip:hover:not(:disabled) {
    background: #eff6ff;
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  .chip:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .chip-icon {
    font-size: 16px;
    flex-shrink: 0;
  }
  .chip-text {
    font-weight: 500;
  }

  /* Chat input pinned at bottom */
  .chat-input-wrap {
    flex-shrink: 0;
    padding-top: 10px;
    border-top: 1px solid var(--color-border);
  }
</style>
