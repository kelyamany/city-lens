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

      if (data.error) {
        console.error('Analysis error:', data.error);
        return;
      }

      brief.set({
        neighbourhood: loc.neighbourhood || loc.address,
        city: 'Copenhagen',
        demographics: data.demographics,
        pois: data.pois,
        summary: data.summary,
        topUse: data.topUse,
        tags: data.tags,
        reasoning: data.reasoning,
      });
    } catch (e) {
      console.error('Analysis failed:', e);
    } finally {
      isAnalyzing.set(false);
    }
  }

  async function handleLocationSelected(loc: any) {
    selectedLocation.set(loc);
    chatMessages = [];
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
        chatMessages = [
          ...chatMessages,
          { role: 'assistant', content: 'Sorry, I could not process that request.' },
        ];
        return;
      }

      // Stream the response
      const reader = res.body?.getReader();
      if (!reader) return;

      let assistantMsg = '';
      chatMessages = [...chatMessages, { role: 'assistant', content: '' }];

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('0:')) {
            // Text delta
            try {
              const text = JSON.parse(line.slice(2));
              assistantMsg += text;
              chatMessages = [
                ...chatMessages.slice(0, -1),
                { role: 'assistant', content: assistantMsg },
              ];
            } catch {
              // skip malformed chunks
            }
          } else if (line.startsWith('a:')) {
            // Tool result — handle setRadius
            try {
              const toolResult = JSON.parse(line.slice(2));
              const result = toolResult?.result;
              if (result?.action === 'setRadius' && typeof result.value === 'number') {
                analysisRadius.set(result.value);
                const loc = $selectedLocation;
                if (loc) await runAnalysis(loc, result.value);
              }
            } catch {
              // skip
            }
          }
        }
      }
    } catch (e) {
      console.error('Chat error:', e);
      chatMessages = [
        ...chatMessages,
        { role: 'assistant', content: 'An error occurred. Please try again.' },
      ];
    } finally {
      isChatLoading = false;
    }
  }
</script>

<div class="app-shell">
  <LeftPanel onLocationSelected={handleLocationSelected} />
  <MapView bind:this={mapRef} onPlotSelected={handleLocationSelected} />
  <RightPanel {chatMessages} onChatSubmit={handleChatSubmit} {isChatLoading} />
</div>

<style>
  .app-shell {
    display: grid;
    grid-template-columns: 320px 1fr 380px;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: #f8f7f4;
    font-family: 'Inter', system-ui, sans-serif;
  }
</style>
