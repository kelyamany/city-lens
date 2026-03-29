<script lang="ts">
  import { analysisRadius } from '$lib/stores/map';
  import type { SocialData } from '$lib/types';

  let {
    data,
    isLoading,
    onRadiusApply,
  }: {
    data: SocialData | null;
    isLoading: boolean;
    onRadiusApply: () => void;
  } = $props();

  // Track whether the radius has changed since the last fetch
  let appliedRadius = $state($analysisRadius);
  let radiusDirty = $derived($analysisRadius !== appliedRadius && !isLoading);

  function applyRadius() {
    appliedRadius = $analysisRadius;
    onRadiusApply();
  }

  function stars(rating: number): { full: number; half: boolean; empty: number } {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);
    return { full, half, empty };
  }

  function ratingColor(rating: number): string {
    if (rating >= 4.5) return '#16a34a';
    if (rating >= 4.0) return '#2563eb';
    if (rating >= 3.5) return '#d97706';
    return '#6b7280';
  }

  let hasData = $derived(data && data.categories.length > 0 && !data.error);
  let categoriesWithData = $derived(hasData ? data!.categories.filter((c) => c.count > 0) : []);
  let noCategories = $derived(hasData && categoriesWithData.length === 0);
</script>

<div class="social-panel">
  <!-- Radius control -->
  <div class="radius-section">
    <div class="radius-header">
      <span class="radius-label">Analysis Radius</span>
      <span class="radius-value">{$analysisRadius}m</span>
    </div>
    <input
      type="range"
      min="100"
      max="2000"
      step="100"
      bind:value={$analysisRadius}
      class="radius-slider"
    />
    {#if radiusDirty}
      <button class="apply-btn" onclick={applyRadius}>
        Refresh with {$analysisRadius}m radius
      </button>
    {:else}
      <p class="radius-note">Drag to change · affects map circle and social data</p>
    {/if}
  </div>

  {#if isLoading}
    <div class="loading-grid">
      {#each Array(6) as _}
        <div class="skeleton-card">
          <div class="skel skel-title"></div>
          <div class="skel skel-stars"></div>
          <div class="skel skel-sub"></div>
        </div>
      {/each}
    </div>

  {:else if !data || data.error}
    <div class="empty-state">
      <p class="empty-title">Social Ratings Unavailable</p>
      <p class="empty-hint">
        Add <code>GOOGLE_PLACES_API_KEY</code> to <code>.env</code> to enable live social data for
        this area.
      </p>
    </div>

  {:else if noCategories}
    <div class="empty-state">
      <p class="empty-title">No places found nearby</p>
      <p class="empty-hint">Try increasing the analysis radius above.</p>
    </div>

  {:else}
    <p class="panel-intro">
      Average Google Maps ratings for nearby places within {$analysisRadius}m.
    </p>

    <div class="categories-grid">
      {#each categoriesWithData as cat}
        {@const s = stars(cat.avgRating)}
        <div class="category-card">
          <div class="card-header">
            <span class="cat-label">{cat.label}</span>
            <span class="cat-count">{cat.count} place{cat.count !== 1 ? 's' : ''}</span>
          </div>

          <div class="rating-row">
            <span class="rating-num" style="color: {ratingColor(cat.avgRating)}">
              {cat.avgRating > 0 ? cat.avgRating.toFixed(1) : '—'}
            </span>
            <span class="stars" aria-label="{cat.avgRating.toFixed(1)} out of 5 stars">
              {#each Array(s.full) as _}<span class="star full">★</span>{/each}
              {#if s.half}<span class="star half">★</span>{/if}
              {#each Array(s.empty) as _}<span class="star empty">★</span>{/each}
            </span>
          </div>

          {#if cat.topPlaces.length > 0}
            <ul class="top-places">
              {#each cat.topPlaces as place}
                <li class="place-row">
                  <span class="place-name">{place.name}</span>
                  <span class="place-rating" style="color: {ratingColor(place.rating)}">
                    {place.rating.toFixed(1)} ★
                  </span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .social-panel {
    padding-bottom: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Radius control */
  .radius-section {
    background: #f3f4f6;
    border-radius: var(--radius-md);
    padding: 12px;
  }

  .radius-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .radius-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text);
  }

  .radius-value {
    font-size: 12px;
    font-weight: 700;
    color: var(--color-primary);
  }

  .radius-slider {
    width: 100%;
    accent-color: var(--color-primary);
  }

  .radius-note {
    font-size: 10px;
    color: var(--color-text-muted);
    margin-top: 4px;
  }

  .apply-btn {
    margin-top: 8px;
    width: 100%;
    padding: 7px 12px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .apply-btn:hover {
    background: #1d4ed8;
  }

  .panel-intro {
    font-size: 11px;
    color: var(--color-text-muted);
    line-height: 1.5;
  }

  /* Loading skeleton */
  .loading-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .skeleton-card {
    background: #f3f4f6;
    border-radius: var(--radius-md);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .skel {
    background: #e5e7eb;
    border-radius: 4px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skel-title  { height: 12px; width: 60%; }
  .skel-stars  { height: 16px; width: 80%; }
  .skel-sub    { height: 10px; width: 40%; }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px 16px;
    text-align: center;
  }

  .empty-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
  }

  .empty-hint {
    font-size: 11px;
    color: var(--color-text-muted);
    line-height: 1.6;
  }

  .empty-hint code {
    font-family: monospace;
    background: #f3f4f6;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 10px;
  }

  /* Category grid */
  .categories-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .category-card {
    background: #f9fafb;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .cat-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-muted);
  }

  .cat-count {
    font-size: 9px;
    color: var(--color-text-muted);
  }

  .rating-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .rating-num {
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
  }

  .stars {
    display: flex;
    gap: 1px;
  }

  .star        { font-size: 13px; }
  .star.full   { color: #f59e0b; }
  .star.half   { color: #f59e0b; opacity: 0.6; }
  .star.empty  { color: #d1d5db; }

  .top-places {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 3px;
    border-top: 1px solid var(--color-border);
    padding-top: 6px;
    margin-top: 2px;
  }

  .place-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 4px;
  }

  .place-name {
    font-size: 10px;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .place-rating {
    font-size: 10px;
    font-weight: 600;
    flex-shrink: 0;
  }
</style>
