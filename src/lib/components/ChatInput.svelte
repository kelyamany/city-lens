<script lang="ts">
  import { ArrowRight } from 'lucide-svelte';

  let { onSubmit, disabled = false }: { onSubmit: (message: string) => void; disabled?: boolean } = $props();

  let inputValue = $state('');

  function handleSubmit() {
    if (!inputValue.trim() || disabled) return;
    onSubmit(inputValue.trim());
    inputValue = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }
</script>

<div class="chat-input-wrapper">
  <input
    type="text"
    bind:value={inputValue}
    onkeydown={handleKeydown}
    placeholder='e.g. "Are there schools nearby?" or "change radius to 1km"'
    {disabled}
  />
  <button onclick={handleSubmit} disabled={disabled || !inputValue.trim()} class="send-btn">
    <ArrowRight size={16} />
  </button>
</div>

<style>
  .chat-input-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: #f9fafb;
  }

  input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 12px;
    color: var(--color-text);
  }

  input::placeholder {
    color: #9ca3af;
    font-size: 11px;
  }

  .send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 50%;
    background: var(--color-primary);
    color: white;
    cursor: pointer;
    flex-shrink: 0;
  }

  .send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
