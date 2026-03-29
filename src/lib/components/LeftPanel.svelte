<script lang="ts">
  import { Search, MapPin, X, ChevronLeft } from 'lucide-svelte';
  import { searchAddress, geocodeAddress, type AddressSuggestion } from '$lib/api/dawa';
  import { layers } from '$lib/stores/layers';
  import { mapCenter } from '$lib/stores/map';
  import LayerToggle from './LayerToggle.svelte';

  let {
    onLocationSelected,
    isOpen = true,
    onToggle,
  }: {
    onLocationSelected: (data: any) => void;
    isOpen?: boolean;
    onToggle?: () => void;
  } = $props();

  let query = $state('');
  let suggestions = $state<AddressSuggestion[]>([]);
  let showDropdown = $state(false);
  let isSearching = $state(false);
  let activeIndex = $state(-1);
  let debounceTimer: ReturnType<typeof setTimeout>;

  function handleInput() {
    clearTimeout(debounceTimer);
    activeIndex = -1;
    debounceTimer = setTimeout(async () => {
      if (query.length >= 2) {
        isSearching = true;
        suggestions = await searchAddress(query);
        isSearching = false;
        showDropdown = suggestions.length > 0;
      } else {
        suggestions = [];
        showDropdown = false;
        isSearching = false;
      }
    }, 300);
  }

  function selectSuggestion(s: AddressSuggestion) {
    query = s.label;
    showDropdown = false;
    suggestions = [];
    activeIndex = -1;
    onLocationSelected({
      lat: s.lat,
      lon: s.lon,
      address: s.label,
      postnr: s.postnr,
      neighbourhood: s.neighbourhood,
      kommunekode: s.kommunekode,
    });
  }

  function clearSearch() {
    query = '';
    suggestions = [];
    showDropdown = false;
    activeIndex = -1;
  }

  async function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      showDropdown = false;
      activeIndex = -1;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, suggestions.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) {
        selectSuggestion(suggestions[activeIndex]);
      } else if (suggestions.length > 0) {
        selectSuggestion(suggestions[0]);
      } else if (query.trim().length >= 2) {
        isSearching = true;
        showDropdown = false;
        const result = await geocodeAddress(query.trim(), $mapCenter);
        isSearching = false;
        if (result) selectSuggestion(result);
      }
    }
  }
</script>

<svelte:window onclick={() => (showDropdown = false)} />

<aside class="left-panel">
  <div class="panel-content">
    <header class="brand">
      <div class="brand-row">
        <div>
          <h1 class="wordmark">City Lens</h1>
          <p class="subtitle">SOCIAL FABRIC EXPLORER</p>
        </div>
        {#if onToggle}
          <button class="collapse-btn" onclick={onToggle} title="Collapse sidebar" aria-label="Collapse sidebar">
            <ChevronLeft size={16} />
          </button>
        {/if}
      </div>
    </header>

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="search-section" onclick={(e: MouseEvent) => e.stopPropagation()}>
      <div class="search-input-wrapper" class:searching={isSearching}>
        {#if isSearching}
          <span class="spinner" aria-hidden="true"></span>
        {:else}
          <Search size={15} />
        {/if}
        <input
          type="text"
          placeholder="Search an address..."
          bind:value={query}
          oninput={handleInput}
          onkeydown={handleKeydown}
          autocomplete="off"
          spellcheck="false"
        />
        {#if query.length > 0}
          <button class="clear-btn" onclick={clearSearch} tabindex="-1" aria-label="Clear search">
            <X size={13} />
          </button>
        {/if}
      </div>

      {#if showDropdown && suggestions.length > 0}
        <ul class="suggestions" role="listbox" aria-label="Address suggestions">
          {#each suggestions as s, i}
            <!-- svelte-ignore a11y_mouse_events_have_key_events -->
            <li role="option" aria-selected={i === activeIndex}>
              <button
                onclick={() => selectSuggestion(s)}
                class:highlighted={i === activeIndex}
                onmouseenter={() => (activeIndex = i)}
              >
                <span class="item-icon" aria-hidden="true"><MapPin size={11} /></span>
                <span class="suggestion-text">
                  <span class="primary">{s.primaryLine}</span>
                  <span class="secondary">{s.secondaryLine}</span>
                </span>
              </button>
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
    <p>AEC Hackathon · Copenhagen 2026</p>
    <a href="https://github.com/kelyamany/city-lens" target="_blank" rel="noopener noreferrer" class="github-link">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
      </svg>
      city-lens
    </a>
  </footer>
</aside>

<style>
  .left-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-surface);
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.06);
    z-index: 10;
    overflow-y: auto;
    overflow-x: hidden;
    width: 320px;
    min-width: 0;
  }

  .panel-content {
    flex: 1;
    padding: 20px 18px;
  }

  /* Brand row */
  .brand { margin-bottom: 24px; }

  .brand-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .wordmark {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
    line-height: 1.2;
  }

  .subtitle {
    font-size: 9px;
    color: var(--color-text-muted);
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-top: 3px;
  }

  .collapse-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }

  .collapse-btn:hover {
    background: #f3f4f6;
    color: var(--color-text);
  }

  /* Search */
  .search-section {
    position: relative;
    margin-bottom: 24px;
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
    transition: border-color 0.15s, background 0.15s;
  }

  .search-input-wrapper:focus-within {
    border-color: var(--color-primary);
    background: #fff;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
  }

  input {
    border: none;
    outline: none;
    background: transparent;
    font-size: 13px;
    width: 100%;
    color: var(--color-text);
    min-width: 0;
  }

  input::placeholder { color: #9ca3af; }

  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    cursor: pointer;
    color: #9ca3af;
    padding: 0;
    flex-shrink: 0;
    transition: color 0.1s;
  }

  .clear-btn:hover { color: var(--color-text); }

  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* Suggestions dropdown */
  .suggestions {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    list-style: none;
    z-index: 100;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    max-height: 280px;
    overflow-y: auto;
    padding: 4px 0;
  }

  .suggestions li button {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    padding: 9px 12px;
    text-align: left;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--color-text);
    transition: background 0.1s;
  }

  .suggestions li button.highlighted,
  .suggestions li button:hover {
    background: #f3f4f6;
  }

  .item-icon {
    color: #9ca3af;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .suggestion-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .primary {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .secondary {
    font-size: 10px;
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Layers */
  .section-label {
    font-size: 9px;
    color: var(--color-text-muted);
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 10px;
    font-weight: 600;
  }

  .layers-section { margin-top: 4px; }

  .panel-footer {
    padding: 14px 18px;
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .panel-footer p {
    font-size: 9px;
    color: #9ca3af;
    letter-spacing: 1px;
    text-align: center;
  }

  .github-link {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    margin-top: 6px;
    font-size: 9px;
    color: #9ca3af;
    letter-spacing: 1px;
    text-decoration: none;
  }

  .github-link:hover {
    color: var(--color-teal, #0d9488);
  }

  /* Responsive */
  @media (max-width: 1200px) {
    .left-panel { width: 280px; }
  }

  @media (max-width: 900px) {
    .left-panel { width: 280px; }
  }
</style>
