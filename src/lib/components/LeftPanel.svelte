<script lang="ts">
  import { Search } from 'lucide-svelte';
  import { searchAddress, type AddressSuggestion } from '$lib/api/dawa';
  import { layers } from '$lib/stores/layers';
  import LayerToggle from './LayerToggle.svelte';

  let { onLocationSelected }: { onLocationSelected: (data: any) => void } = $props();

  let query = $state('');
  let suggestions = $state<AddressSuggestion[]>([]);
  let showDropdown = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout>;

  function handleInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      if (query.length >= 2) {
        suggestions = await searchAddress(query);
        showDropdown = suggestions.length > 0;
      } else {
        suggestions = [];
        showDropdown = false;
      }
    }, 300);
  }

  function selectSuggestion(s: AddressSuggestion) {
    query = s.label;
    showDropdown = false;
    suggestions = [];
    onLocationSelected({
      lat: s.lat,
      lon: s.lon,
      address: s.label,
      postnr: s.postnr,
      neighbourhood: s.neighbourhood,
      kommunekode: s.kommunekode,
    });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      showDropdown = false;
    }
  }
</script>

<svelte:window onclick={() => (showDropdown = false)} />

<aside class="left-panel">
  <div class="panel-content">
    <header class="brand">
      <h1 class="wordmark">City Lens</h1>
      <p class="subtitle">SOCIAL FABRIC EXPLORER</p>
    </header>

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="search-section" onclick={(e: MouseEvent) => e.stopPropagation()}>
      <div class="search-input-wrapper">
        <Search size={16} />
        <input
          type="text"
          placeholder="Enter an address in Copenhagen..."
          bind:value={query}
          oninput={handleInput}
          onkeydown={handleKeydown}
        />
      </div>

      {#if showDropdown}
        <ul class="suggestions">
          {#each suggestions as s}
            <li>
              <button onclick={() => selectSuggestion(s)}>{s.label}</button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="layers-section">
      <p class="section-label">DATA LAYERS</p>
      {#each $layers as layer}
        <LayerToggle {layer} />
      {/each}
    </div>
  </div>

  <footer class="panel-footer">
    <p>POWERED BY DST &middot; OSM &middot; AIRBNB</p>
  </footer>
</aside>

<style>
  .left-panel {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--color-surface);
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.06);
    z-index: 10;
    overflow-y: auto;
  }

  .panel-content {
    flex: 1;
    padding: 24px 20px;
  }

  .brand {
    margin-bottom: 28px;
  }

  .wordmark {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
  }

  .subtitle {
    font-size: 10px;
    color: var(--color-text-muted);
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-top: 4px;
  }

  .search-section {
    position: relative;
    margin-bottom: 28px;
  }

  .search-input-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: #f9fafb;
    color: var(--color-text-muted);
  }

  input {
    border: none;
    outline: none;
    background: transparent;
    font-size: 13px;
    width: 100%;
    color: var(--color-text);
  }

  input::placeholder {
    color: #9ca3af;
  }

  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    margin-top: 4px;
    list-style: none;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    max-height: 240px;
    overflow-y: auto;
  }

  .suggestions li button {
    display: block;
    width: 100%;
    padding: 10px 12px;
    text-align: left;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 12px;
    color: var(--color-text);
    border-bottom: 1px solid var(--color-border);
  }

  .suggestions li:last-child button {
    border-bottom: none;
  }

  .suggestions li button:hover {
    background: #f3f4f6;
  }

  .section-label {
    font-size: 10px;
    color: var(--color-text-muted);
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 12px;
    font-weight: 600;
  }

  .layers-section {
    margin-top: 8px;
  }

  .panel-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--color-border);
  }

  .panel-footer p {
    font-size: 9px;
    color: #9ca3af;
    letter-spacing: 1px;
    text-align: center;
  }
</style>
