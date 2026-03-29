<script lang="ts">
  let { label, value, unit }: { label: string; value: string | number; unit: string } = $props();
</script>

<div class="stat-card">
  <p class="stat-label">{label}</p>
  <p class="stat-value">{value}</p>
  {#if unit}
    <p class="stat-unit">{unit}</p>
  {/if}
</div>

<style>
  .stat-card {
    background: #f3f4f6;
    border-radius: var(--radius-md);
    padding: 12px;
    text-align: center;
    min-width: 0;
  }

  .stat-label {
    font-size: 10px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .stat-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text);
    line-height: 1.2;
  }

  .stat-unit {
    font-size: 10px;
    color: var(--color-text-muted);
    margin-top: 2px;
  }
</style>
