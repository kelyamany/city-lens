<div class="skeleton">
  <div class="stat-row">
    <div class="skel-card"></div>
    <div class="skel-card"></div>
    <div class="skel-card"></div>
  </div>
  <div class="skel-line long"></div>
  <div class="skel-line medium"></div>
  <div class="skel-line short"></div>
  <div class="tag-row">
    <div class="skel-tag"></div>
    <div class="skel-tag"></div>
  </div>
</div>

<style>
  .skeleton {
    padding: 16px 0;
  }

  .stat-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin-bottom: 20px;
  }

  .skel-card {
    height: 72px;
    background: #e5e7eb;
    border-radius: var(--radius-md);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skel-line {
    height: 12px;
    background: #e5e7eb;
    border-radius: 4px;
    margin-bottom: 8px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skel-line.long {
    width: 100%;
  }

  .skel-line.medium {
    width: 80%;
  }

  .skel-line.short {
    width: 50%;
  }

  .tag-row {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }

  .skel-tag {
    width: 72px;
    height: 24px;
    background: #e5e7eb;
    border-radius: 12px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }
</style>
