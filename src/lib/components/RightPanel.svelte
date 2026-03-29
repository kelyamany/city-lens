<script lang="ts">
  import { MapPin, Sparkles } from 'lucide-svelte';
  import { selectedLocation, isAnalyzing } from '$lib/stores/map';
  import { brief } from '$lib/stores/brief';
  import StatCard from './StatCard.svelte';
  import SkeletonBrief from './SkeletonBrief.svelte';
  import ChatInput from './ChatInput.svelte';
  import InsightsPanel from './InsightsPanel.svelte';
  import type { ChatMessage } from '$lib/types';

  let { chatMessages = [], onChatSubmit, isChatLoading = false }: {
    chatMessages?: ChatMessage[];
    onChatSubmit: (message: string) => void;
    isChatLoading?: boolean;
  } = $props();

  let activeTab = $state<'brief' | 'insights'>('brief');

  let employedPct = $derived(
    $brief && $brief.demographics.totalPopulation > 0
      ? Math.round(
          ($brief.demographics.employment.employed / $brief.demographics.totalPopulation) * 100
        )
      : 0
  );

  let densityLabel = $derived(
    $brief && $brief.pois
      ? $brief.pois.length > 20
        ? 'High'
        : $brief.pois.length > 8
          ? 'Medium'
          : 'Low'
      : '--'
  );
</script>

<aside class="right-panel">
  <div class="panel-header">
    <h2>Area Brief</h2>
  </div>

  <div class="tab-bar">
    <button
      class="tab"
      class:active={activeTab === 'brief'}
      onclick={() => (activeTab = 'brief')}
    >
      Insights
    </button>
    <button
      class="tab"
      class:active={activeTab === 'insights'}
      onclick={() => (activeTab = 'insights')}
    >
      Metrics
    </button>
  </div>

  <div class="panel-body">
    {#if !$selectedLocation}
      <div class="empty-state">
        <MapPin size={32} color="#9ca3af" />
        <p>Enter an address above to explore this area</p>
      </div>
    {:else if activeTab === 'brief'}
      {#if $isAnalyzing}
        <SkeletonBrief />
      {:else if $brief}
        <div class="brief-content">
          <p class="meta">
            {$brief.neighbourhood} &middot; Copenhagen &middot; Generated just now
          </p>

          <div class="stat-row">
            <StatCard label="Age" value={$brief.demographics.medianAge} unit="yrs" />
            <StatCard label="Employment" value="{employedPct}%" unit="employed" />
            <StatCard label="Density" value={densityLabel} unit="" />
          </div>

          <div class="recommendation">
            <p class="rec-label">
              <Sparkles size={12} />
              AI RECOMMENDATION
            </p>
            <p class="rec-top-use">{$brief.topUse}</p>
            <p class="rec-summary">{$brief.summary}</p>
          </div>

          <div class="tags">
            {#each $brief.tags as tag}
              <span class="tag">{tag}</span>
            {/each}
          </div>

          <hr class="divider" />

          <div class="chat-thread">
            {#each chatMessages as msg}
              <div class="chat-msg {msg.role}">
                <p>{msg.content}</p>
              </div>
            {/each}
          </div>

          <ChatInput onSubmit={onChatSubmit} disabled={isChatLoading} />
        </div>
      {:else}
        <div class="empty-state">
          <p>Analysis could not be completed. Check your API keys.</p>
        </div>
      {/if}
    {:else}
      <InsightsPanel />
    {/if}
  </div>
</aside>

<style>
  .right-panel {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--color-surface);
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.06);
    z-index: 10;
    overflow: hidden;
  }

  .panel-header {
    padding: 20px 20px 0;
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
  }

  .tab.active {
    background: var(--color-primary);
    color: white;
  }

  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 0 20px 20px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px 20px;
    text-align: center;
  }

  .empty-state p {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .brief-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .meta {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .stat-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }

  .recommendation {
    padding: 0;
  }

  .rec-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--color-primary);
    margin-bottom: 8px;
  }

  .rec-top-use {
    font-size: 15px;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: 6px;
  }

  .rec-summary {
    font-size: 13px;
    color: var(--color-text);
    font-style: italic;
    line-height: 1.5;
  }

  .tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .tag {
    padding: 4px 10px;
    border: 1px solid var(--color-primary);
    border-radius: 12px;
    font-size: 11px;
    color: var(--color-primary);
    background: transparent;
  }

  .divider {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: 4px 0;
  }

  .chat-thread {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
  }

  .chat-msg {
    padding: 8px 12px;
    border-radius: var(--radius-md);
    font-size: 12px;
    line-height: 1.5;
  }

  .chat-msg.user {
    background: #dbeafe;
    align-self: flex-end;
    max-width: 85%;
    margin-left: auto;
  }

  .chat-msg.assistant {
    background: #f3f4f6;
    align-self: flex-start;
    max-width: 85%;
  }
</style>
