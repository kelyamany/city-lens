<script lang="ts">
  import { Users, GraduationCap, MapPin, Star, Eye, EyeOff } from 'lucide-svelte';
  import type { LayerState } from '$lib/types';
  import { layers } from '$lib/stores/layers';
  let { layer }: { layer: LayerState } = $props();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iconMap: Record<string, any> = {
    'users': Users,
    'graduation-cap': GraduationCap,
    'map-pin': MapPin,
    'star': Star,
  };

  function toggle() {
    layers.update((ls) =>
      ls.map((l) => (l.id === layer.id ? { ...l, active: !l.active } : l))
    );
  }

  function toggleMap(e: MouseEvent) {
    e.stopPropagation();
    layers.update((ls) =>
      ls.map((l) => (l.id === layer.id ? { ...l, mapVisible: !l.mapVisible } : l))
    );
  }

  let Icon = $derived(iconMap[layer.icon] || MapPin);
</script>

<div class="layer-row">
  <span class="layer-icon"><Icon size={16} /></span>
  <span class="layer-label">{layer.label}</span>

  <button
    class="eye-btn"
    class:visible={layer.mapVisible}
    onclick={toggleMap}
    title={layer.mapVisible ? 'Hide from map' : 'Show on map'}
    aria-label="Toggle map visibility"
  >
    {#if layer.mapVisible}
      <Eye size={13} />
    {:else}
      <EyeOff size={13} />
    {/if}
  </button>

  <button class="toggle-btn" onclick={toggle} aria-label="Toggle layer data">
    <span class="toggle" class:active={layer.active}>
      <span class="toggle-knob"></span>
    </span>
  </button>
</div>

<style>
  .layer-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    width: 100%;
    color: var(--color-text);
    font-size: 13px;
  }

  .layer-icon {
    color: var(--color-text-muted);
    display: flex;
    flex-shrink: 0;
  }

  .layer-label {
    flex: 1;
    text-align: left;
  }

  .eye-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 5px;
    background: transparent;
    cursor: pointer;
    color: #d1d5db;
    transition: color 0.15s, background 0.15s;
    flex-shrink: 0;
    padding: 0;
  }

  .eye-btn:hover {
    background: #f3f4f6;
    color: #6b7280;
  }

  .eye-btn.visible {
    color: var(--color-primary);
  }

  .eye-btn.visible:hover {
    background: #eff6ff;
  }

  .toggle-btn {
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .toggle {
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: #d1d5db;
    position: relative;
    transition: background 0.2s;
  }

  .toggle.active {
    background: var(--color-primary);
  }

  .toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s;
  }

  .toggle.active .toggle-knob {
    transform: translateX(16px);
  }
</style>
