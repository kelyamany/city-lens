<script lang="ts">
  import { Users, GraduationCap, MapPin, Star } from 'lucide-svelte';
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

  let Icon = $derived(iconMap[layer.icon] || MapPin);
</script>

<button class="layer-row" onclick={toggle}>
  <span class="layer-icon">
    <Icon size={16} />
  </span>
  <span class="layer-label">{layer.label}</span>
  <span class="toggle" class:active={layer.active}>
    <span class="toggle-knob"></span>
  </span>
</button>

<style>
  .layer-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border: none;
    background: none;
    width: 100%;
    cursor: pointer;
    color: var(--color-text);
    font-size: 13px;
  }

  .layer-icon {
    color: var(--color-text-muted);
    display: flex;
  }

  .layer-label {
    flex: 1;
    text-align: left;
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
