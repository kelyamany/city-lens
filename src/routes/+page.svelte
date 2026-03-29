<script lang="ts">
  import MapView from '$lib/components/MapView.svelte';
  import LeftPanel from '$lib/components/LeftPanel.svelte';
  import RightPanel from '$lib/components/RightPanel.svelte';
  import { selectedLocation, isAnalyzing, analysisRadius } from '$lib/stores/map';
  import { brief } from '$lib/stores/brief';
  import type { ChatMessage } from '$lib/types';

  let mapRef: MapView | undefined = $state();
  let chatMessages = $state<ChatMessage[]>([]);
  let isChatLoading = $state(false);
  let leftPanelOpen = $state(true);
  let rightPanelOpen = $state(false);

  async function runAnalysis(loc: any, radius: number) {
    isAnalyzing.set(true);
    brief.set(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...loc, radius }),
      });
      const data = await res.json();
      if (!data.error && data.demographics) {
        brief.set({
          neighbourhood: loc.neighbourhood || loc.address,
          city: 'Copenhagen',
          demographics: data.demographics,
          pois: data.pois ?? [],
        });
      }
    } catch (e) {
      console.error('Analysis failed:', e);
    } finally {
      isAnalyzing.set(false);
    }
  }

  async function handleLocationSelected(loc: any) {
    selectedLocation.set(loc);
    chatMessages = [];
    rightPanelOpen = true;
    mapRef?.flyTo(loc.lat, loc.lon);
    await runAnalysis(loc, $analysisRadius);
  }

  async function handleChatSubmit(message: string) {
    chatMessages = [...chatMessages, { role: 'user', content: message }];
    isChatLoading = true;

    try {
      const loc = $selectedLocation;
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages.filter((m) => m.role === 'user' || m.content !== ''),
          context: {
            lat: loc?.lat,
            lon: loc?.lon,
            address: loc?.address,
            neighbourhood: loc?.neighbourhood,
            radius: $analysisRadius,
            brief: $brief ?? null,
          },
        }),
      });

      const data = await res.json();
      chatMessages = [...chatMessages, { role: 'assistant', content: data.content || 'No response received. Please try again.' }];

      // Handle setRadius tool result
      for (const step of data.steps ?? []) {
        for (const tr of step.toolResults ?? []) {
          if (tr.result?.action === 'setRadius' && typeof tr.result.value === 'number') {
            analysisRadius.set(tr.result.value);
            if (loc) await runAnalysis(loc, tr.result.value);
          }
        }
      }
    } catch {
      chatMessages = [...chatMessages, { role: 'assistant', content: 'Something went wrong. Please try again.' }];
    } finally {
      isChatLoading = false;
    }
  }
</script>

<!-- Mobile overlay backdrop -->
{#if rightPanelOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="mobile-backdrop" role="presentation" onclick={() => (rightPanelOpen = false)}></div>
{/if}

<div class="app-shell" class:left-collapsed={!leftPanelOpen}>
  <div class="left-panel-wrapper" class:open={leftPanelOpen}>
    <LeftPanel
      onLocationSelected={handleLocationSelected}
      isOpen={leftPanelOpen}
      onToggle={() => (leftPanelOpen = !leftPanelOpen)}
    />
  </div>

  <div class="map-wrapper">
    {#if !leftPanelOpen}
      <button class="panel-toggle-btn left" onclick={() => (leftPanelOpen = true)} aria-label="Open left panel" title="Open sidebar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
    {/if}

    {#if $selectedLocation || $isAnalyzing}
      <button class="panel-toggle-btn right mobile-only" onclick={() => (rightPanelOpen = !rightPanelOpen)} aria-label="Toggle area brief">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/>
        </svg>
        {#if $isAnalyzing}
          <span class="btn-badge loading"></span>
        {:else if $brief}
          <span class="btn-badge ready"></span>
        {/if}
      </button>
    {/if}

    <MapView bind:this={mapRef} onPlotSelected={handleLocationSelected} />
  </div>

  <div class="right-panel-wrapper" class:mobile-open={rightPanelOpen}>
    <RightPanel {chatMessages} onChatSubmit={handleChatSubmit} {isChatLoading} />
  </div>
</div>

<style>
  .app-shell {
    display: grid;
    grid-template-columns: 320px 1fr 380px;
    grid-template-rows: 100vh;
    width: 100vw;
    overflow: hidden;
    background: #f8f7f4;
    font-family: 'Inter', system-ui, sans-serif;
    transition: grid-template-columns 0.25s ease;
  }

  .app-shell.left-collapsed {
    grid-template-columns: 0px 1fr 420px;
  }

  .left-panel-wrapper {
    overflow: hidden;
    height: 100vh;
    min-width: 0;
    transition: min-width 0.25s ease;
  }

  .left-panel-wrapper.open {
    min-width: 320px;
  }

  .map-wrapper {
    position: relative;
    height: 100vh;
    min-width: 0;
    overflow: hidden;
  }

  .right-panel-wrapper {
    height: 100vh;
    overflow: hidden;
    min-width: 0;
  }

  .panel-toggle-btn {
    position: absolute;
    z-index: 15;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    background: white;
    color: #374151;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: background 0.15s;
  }

  .panel-toggle-btn:hover { background: #f3f4f6; }
  .panel-toggle-btn.left { top: 12px; left: 12px; }
  .panel-toggle-btn.right { top: 12px; right: 12px; }

  .btn-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid white;
  }

  .btn-badge.loading { background: #f59e0b; animation: pulse-dot 1s infinite; }
  .btn-badge.ready   { background: #22c55e; }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .mobile-backdrop { display: none; }
  .mobile-only { display: none; }

  @media (max-width: 1200px) {
    .app-shell { grid-template-columns: 280px 1fr 340px; }
    .app-shell.left-collapsed { grid-template-columns: 0px 1fr 380px; }
    .left-panel-wrapper.open { min-width: 280px; }
  }

  @media (max-width: 900px) {
    .app-shell { grid-template-columns: 0px 1fr 300px; }
    .app-shell.left-collapsed { grid-template-columns: 0px 1fr 300px; }

    .left-panel-wrapper {
      position: fixed;
      top: 0; left: 0;
      height: 100vh;
      width: 280px;
      z-index: 50;
      transform: translateX(-100%);
      transition: transform 0.25s ease;
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
    }

    .left-panel-wrapper.open {
      transform: translateX(0);
      min-width: unset;
    }
  }

  @media (max-width: 640px) {
    .app-shell { grid-template-columns: 1fr; grid-template-rows: 100vh; }
    .app-shell.left-collapsed { grid-template-columns: 1fr; }

    .right-panel-wrapper {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: 70vh;
      z-index: 40;
      border-radius: 16px 16px 0 0;
      transform: translateY(100%);
      transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
      box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
    }

    .right-panel-wrapper.mobile-open { transform: translateY(0); }

    .mobile-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 35;
      background: rgba(0, 0, 0, 0.3);
    }

    .mobile-only { display: flex; }

    .panel-toggle-btn.left { top: 12px; left: 12px; }
  }
</style>
