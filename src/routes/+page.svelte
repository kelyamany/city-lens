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
  let rightPanelOpen = $state(false); // mobile: right panel as bottom sheet

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
          summary: data.summary,
          topUse: data.topUse,
          tags: data.tags ?? [],
          reasoning: data.reasoning,
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
    rightPanelOpen = true; // auto-open on mobile
    mapRef?.flyTo(loc.lat, loc.lon);
    await runAnalysis(loc, $analysisRadius);
  }

  async function handleChatSubmit(message: string) {
    chatMessages = [...chatMessages, { role: 'user', content: message }];
    isChatLoading = true;

    try {
      const loc = $selectedLocation;
      const currentBrief = $brief;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages.map((m) => ({ role: m.role, content: m.content })),
          context: {
            lat: loc?.lat,
            lon: loc?.lon,
            address: loc?.address,
            neighbourhood: loc?.neighbourhood,
            radius: $analysisRadius,
            brief: currentBrief ?? null,
          },
        }),
      });

      if (!res.ok) {
        chatMessages = [...chatMessages, { role: 'assistant', content: 'Sorry, could not process that.' }];
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      let assistantMsg = '';
      chatMessages = [...chatMessages, { role: 'assistant', content: '' }];
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('0:')) {
            try {
              assistantMsg += JSON.parse(line.slice(2));
              chatMessages = [...chatMessages.slice(0, -1), { role: 'assistant', content: assistantMsg }];
            } catch { /* skip */ }
          } else if (line.startsWith('a:')) {
            try {
              const toolResult = JSON.parse(line.slice(2));
              const result = toolResult?.result;
              if (result?.action === 'setRadius' && typeof result.value === 'number') {
                analysisRadius.set(result.value);
                const loc = $selectedLocation;
                if (loc) await runAnalysis(loc, result.value);
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (e) {
      console.error('Chat error:', e);
      chatMessages = [...chatMessages, { role: 'assistant', content: 'An error occurred. Please try again.' }];
    } finally {
      isChatLoading = false;
    }
  }
</script>

<!-- Mobile overlay backdrop -->
{#if rightPanelOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
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
    <!-- Left panel toggle (visible on desktop when panel is closed, always on mobile) -->
    {#if !leftPanelOpen}
      <button class="panel-toggle-btn left" onclick={() => (leftPanelOpen = true)} aria-label="Open left panel" title="Open sidebar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
    {/if}

    <!-- Mobile: open right panel -->
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
  /* ── Base (desktop 3-column layout) ─────────────────────────────────── */
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
    grid-template-columns: 0px 1fr 380px;
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

  /* ── Panel toggle floating buttons ──────────────────────────────────── */
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

  .panel-toggle-btn.left {
    top: 12px;
    left: 12px;
  }

  .panel-toggle-btn.right {
    top: 12px;
    right: 12px;
  }

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

  /* ── Mobile backdrop ─────────────────────────────────────────────────── */
  .mobile-backdrop {
    display: none;
  }

  /* ── Mobile only utility ─────────────────────────────────────────────── */
  .mobile-only { display: none; }

  /* ── Laptop/large tablet (< 1200px) ─────────────────────────────────── */
  @media (max-width: 1200px) {
    .app-shell {
      grid-template-columns: 280px 1fr 340px;
    }
    .app-shell.left-collapsed {
      grid-template-columns: 0px 1fr 340px;
    }
    .left-panel-wrapper.open {
      min-width: 280px;
    }
  }

  /* ── Tablet (< 900px): hide left panel by default ───────────────────── */
  @media (max-width: 900px) {
    .app-shell {
      grid-template-columns: 0px 1fr 300px;
    }
    .app-shell.left-collapsed {
      grid-template-columns: 0px 1fr 300px;
    }

    /* Left panel becomes overlay */
    .left-panel-wrapper {
      position: fixed;
      top: 0;
      left: 0;
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

  /* ── Mobile (< 640px): full-screen map, panels as overlays ──────────── */
  @media (max-width: 640px) {
    .app-shell {
      grid-template-columns: 1fr;
      grid-template-rows: 100vh;
    }

    .app-shell.left-collapsed {
      grid-template-columns: 1fr;
    }

    /* Right panel becomes bottom sheet */
    .right-panel-wrapper {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 70vh;
      z-index: 40;
      border-radius: 16px 16px 0 0;
      transform: translateY(100%);
      transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
      box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
    }

    .right-panel-wrapper.mobile-open {
      transform: translateY(0);
    }

    /* Mobile backdrop */
    .mobile-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 35;
      background: rgba(0, 0, 0, 0.3);
    }

    /* Show the "open brief" button on mobile */
    .mobile-only { display: flex; }

    /* Left toggle always visible on mobile */
    .panel-toggle-btn.left {
      top: 12px;
      left: 12px;
    }
  }
</style>
