<script lang="ts">
  import { selectedLocation } from '$lib/stores/map';
  import { resolveDistrict, resolveAreaLabel } from '$lib/api/districtResolver';
  import { layers } from '$lib/stores/layers';
  import type { Demographics } from '$lib/types';

  let showDemo   = $derived($layers.find(l => l.id === 'demographics')?.active ?? true);
  let showIncome = $derived($layers.find(l => l.id === 'income')?.active ?? true);

  let demographics = $derived.by(() => {
    const loc = $selectedLocation;
    if (!loc?.postnr) return null;
    return resolveDistrict(loc.postnr);
  });

  let districtName = $derived(
    $selectedLocation?.postnr ? resolveAreaLabel($selectedLocation.postnr) : null
  );

  let totalPop = $derived(demographics?.totalPopulation ?? 0);
  let malePct = $derived(totalPop > 0 ? Math.round((demographics!.male / totalPop) * 100) : 0);
  let femalePct = $derived(totalPop > 0 ? 100 - malePct : 0);

  let bgTotal = $derived(
    demographics
      ? demographics.background.danish + demographics.background.western + demographics.background.nonWestern
      : 0
  );
  let danishPct = $derived(bgTotal > 0 ? Math.round((demographics!.background.danish / bgTotal) * 100) : 0);
  let westernPct = $derived(bgTotal > 0 ? Math.round((demographics!.background.western / bgTotal) * 100) : 0);
  let nonWesternPct = $derived(bgTotal > 0 ? 100 - danishPct - westernPct : 0);

  let ageBuckets = $derived(
    demographics?.agePyramid
      ? Object.entries(demographics.agePyramid).sort((a, b) => {
          const numA = parseInt(a[0]);
          const numB = parseInt(b[0]);
          return numA - numB;
        })
      : []
  );
  // For pyramid: max bar width is 50% of each side → use max count to scale
  let maxAge = $derived(ageBuckets.reduce((m, [, v]) => Math.max(m, v), 1));

  let eduEntries = $derived(
    demographics?.education
      ? ([
          ['Primary', demographics.education.primaryOnly],
          ['High School', demographics.education.highSchool],
          ['Vocational', demographics.education.vocational],
          ['Short Higher', demographics.education.shortHigher],
          ['Medium Higher', demographics.education.mediumHigher],
          ['Long Higher', demographics.education.longHigher],
        ] as [string, number][])
      : []
  );
  let eduTotal = $derived(eduEntries.reduce((s, [, v]) => s + v, 0));

  let empTotal = $derived(
    demographics
      ? demographics.employment.employed +
        demographics.employment.unemployed +
        demographics.employment.outsideWorkforce +
        demographics.employment.students
      : 0
  );

  let maritalTotal = $derived(
    demographics
      ? demographics.maritalStatus.single +
        demographics.maritalStatus.married +
        demographics.maritalStatus.divorced +
        demographics.maritalStatus.widowed
      : 0
  );

  function pct(val: number, total: number): string {
    if (total === 0) return '0';
    return Math.round((val / total) * 100).toString();
  }
</script>

{#if demographics}
  <div class="insights">
    {#if districtName}
      <div class="district-header">
        <span class="district-label">DISTRICT</span>
        <span class="district-name">{districtName}</span>
      </div>
    {/if}

    {#if showDemo}
      <section>
        <h4 class="section-title">Population Overview</h4>
        <div class="stat-row-3">
          <div class="mini-stat">
            <p class="mini-label">Total</p>
            <p class="mini-value">{totalPop.toLocaleString()}</p>
          </div>
          <div class="mini-stat">
            <p class="mini-label">Gender</p>
            <div class="gender-bar">
              <div class="gender-m" style="width: {malePct}%"></div>
              <div class="gender-f" style="width: {femalePct}%"></div>
            </div>
            <div class="gender-labels">
              <span class="gender-tag male">♂ {malePct}%</span>
              <span class="gender-tag female">♀ {femalePct}%</span>
            </div>
          </div>
          <div class="mini-stat">
            <p class="mini-label">Median Age</p>
            <p class="mini-value">{demographics.medianAge}</p>
          </div>
        </div>
      </section>

      <section>
        <h4 class="section-title">Background & Diversity</h4>
        <div class="stacked-bar">
          <div class="bar-segment danish" style="width: {danishPct}%">{danishPct}%</div>
          <div class="bar-segment western" style="width: {westernPct}%">{westernPct > 4 ? westernPct + '%' : ''}</div>
          <div class="bar-segment non-western" style="width: {nonWesternPct}%">{nonWesternPct > 4 ? nonWesternPct + '%' : ''}</div>
        </div>
        <div class="legend">
          <span class="legend-item"><span class="dot danish"></span> Danish</span>
          <span class="legend-item"><span class="dot western"></span> Western</span>
          <span class="legend-item"><span class="dot non-western"></span> Non-Western</span>
        </div>
      </section>

      <section>
        <h4 class="section-title">Age Distribution</h4>
        <div class="pyramid-header">
          <span class="pyramid-axis-label">← younger</span>
          <span></span>
          <span class="pyramid-axis-label">older →</span>
          <span></span>
        </div>
        <div class="pyramid">
          {#each ageBuckets.slice().reverse() as [label, count]}
            {@const barPct = (count / maxAge) * 100}
            {@const popPct = totalPop > 0 ? ((count / totalPop) * 100).toFixed(1) : '0.0'}
            <div class="pyramid-row">
              <div class="pyramid-side left">
                <div class="pyramid-bar" style="width: {barPct / 2}%"></div>
              </div>
              <span class="pyramid-label">{label}</span>
              <div class="pyramid-side right">
                <div class="pyramid-bar" style="width: {barPct / 2}%"></div>
              </div>
              <span class="pyramid-pct">{popPct}%</span>
            </div>
          {/each}
        </div>
      </section>

      <section>
        <h4 class="section-title">Employment Status</h4>
        <div class="stat-grid">
          <div class="mini-stat">
            <p class="mini-label">Employed</p>
            <p class="mini-value accent">{pct(demographics.employment.employed, empTotal)}%</p>
          </div>
          <div class="mini-stat">
            <p class="mini-label">Unemployed</p>
            <p class="mini-value">{pct(demographics.employment.unemployed, empTotal)}%</p>
          </div>
          <div class="mini-stat">
            <p class="mini-label">Students</p>
            <p class="mini-value">{pct(demographics.employment.students, empTotal)}%</p>
          </div>
          <div class="mini-stat">
            <p class="mini-label">Outside WF</p>
            <p class="mini-value">{pct(demographics.employment.outsideWorkforce, empTotal)}%</p>
          </div>
        </div>
      </section>

      <section>
        <h4 class="section-title">Household Status</h4>
        <div class="stacked-bar">
          <div class="bar-segment single" style="width: {pct(demographics.maritalStatus.single, maritalTotal)}%">
            {parseInt(pct(demographics.maritalStatus.single, maritalTotal)) > 10 ? pct(demographics.maritalStatus.single, maritalTotal) + '%' : ''}
          </div>
          <div class="bar-segment married" style="width: {pct(demographics.maritalStatus.married, maritalTotal)}%">
            {parseInt(pct(demographics.maritalStatus.married, maritalTotal)) > 10 ? pct(demographics.maritalStatus.married, maritalTotal) + '%' : ''}
          </div>
          <div class="bar-segment divorced" style="width: {pct(demographics.maritalStatus.divorced, maritalTotal)}%"></div>
          <div class="bar-segment widowed" style="width: {pct(demographics.maritalStatus.widowed, maritalTotal)}%"></div>
        </div>
        <div class="legend">
          <span class="legend-item"><span class="dot single"></span> Single {pct(demographics.maritalStatus.single, maritalTotal)}%</span>
          <span class="legend-item"><span class="dot married"></span> Married {pct(demographics.maritalStatus.married, maritalTotal)}%</span>
          <span class="legend-item"><span class="dot divorced"></span> Divorced {pct(demographics.maritalStatus.divorced, maritalTotal)}%</span>
          <span class="legend-item"><span class="dot widowed"></span> Widowed {pct(demographics.maritalStatus.widowed, maritalTotal)}%</span>
        </div>
      </section>
    {/if}

    {#if showIncome}
      <section>
        <h4 class="section-title">Education Level</h4>
        <div class="bar-chart">
          {#each eduEntries as [label, count], i}
            {@const pctVal = eduTotal > 0 ? (count / eduTotal) * 100 : 0}
            <div class="bar-row">
              <span class="bar-label">{label}</span>
              <div class="bar-track">
                <div
                  class="bar-fill edu"
                  style="width: {pctVal}%; opacity: {0.45 + (i / eduEntries.length) * 0.55}"
                ></div>
              </div>
              <span class="bar-count">{pctVal.toFixed(1)}%</span>
            </div>
          {/each}
        </div>
      </section>

      {#if demographics.income?.avgEarnedIncomeDKK}
      {@const avgEarned = Math.round(demographics.income.avgEarnedIncomeDKK / 1000)}
      {@const avgDisp = Math.round(demographics.income.avgDisposableIncomeDKK / 1000)}
      <section>
        <h4 class="section-title">Income (avg. per person, 2024)</h4>
        <div class="stat-grid">
          <div class="mini-stat">
            <p class="mini-label">Earned Income</p>
            <p class="mini-value accent">{avgEarned}k</p>
            <p class="mini-sub">DKK / worker</p>
          </div>
          <div class="mini-stat">
            <p class="mini-label">Disposable</p>
            <p class="mini-value">{avgDisp}k</p>
            <p class="mini-sub">DKK / earner</p>
          </div>
        </div>
      </section>
      {/if}
    {/if}

    {#if !showDemo && !showIncome}
      <div class="empty">
        <p>All data layers are hidden.<br>Enable a layer in the left panel to see metrics.</p>
      </div>
    {/if}
  </div>
{:else}
  <div class="empty">
    <p>No district data available</p>
  </div>
{/if}

<style>
  .insights {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-bottom: 20px;
  }

  .district-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 14px;
    background: #eff6ff;
    border-radius: var(--radius-md);
    border-left: 3px solid var(--color-primary);
  }

  .district-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .district-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--color-primary);
  }

  .section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-muted);
    margin-bottom: 10px;
  }

  .stat-row-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .mini-stat {
    background: #f3f4f6;
    border-radius: var(--radius-sm);
    padding: 10px;
    text-align: center;
  }

  .mini-label {
    font-size: 9px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .mini-value {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-text);
  }

  .mini-value.accent {
    color: var(--color-primary);
  }

  .mini-sub {
    font-size: 9px;
    color: var(--color-text-muted);
  }

  .gender-bar {
    display: flex;
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
    margin: 6px 0 5px;
    gap: 1px;
  }
  .gender-m {
    background: #3b82f6;
    border-radius: 3px 0 0 3px;
  }
  .gender-f {
    background: #f472b6;
    border-radius: 0 3px 3px 0;
    flex: 1;
  }
  .gender-labels {
    display: flex;
    justify-content: space-between;
  }
  .gender-tag {
    font-size: 10px;
    font-weight: 600;
  }
  .gender-tag.male  { color: #3b82f6; }
  .gender-tag.female { color: #ec4899; }

  .stacked-bar {
    display: flex;
    height: 28px;
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .bar-segment {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    color: white;
    min-width: 2px;
  }

  .bar-segment.danish, .bar-segment.single { background: #1e3a8a; }
  .bar-segment.western, .bar-segment.married { background: #2563eb; }
  .bar-segment.non-western, .bar-segment.divorced { background: #93c5fd; }
  .bar-segment.widowed { background: #bfdbfe; }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-top: 8px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--color-text-muted);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .dot.danish, .dot.single { background: #1e3a8a; }
  .dot.western, .dot.married { background: #2563eb; }
  .dot.non-western, .dot.divorced { background: #93c5fd; }
  .dot.widowed { background: #bfdbfe; }

  .bar-chart {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .bar-row {
    display: grid;
    grid-template-columns: 64px 1fr 48px;
    align-items: center;
    gap: 6px;
  }

  .bar-label {
    font-size: 10px;
    color: var(--color-text-muted);
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bar-track {
    height: 14px;
    background: #f3f4f6;
    border-radius: 3px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    background: var(--color-primary);
    border-radius: 3px;
    min-width: 2px;
  }

  .bar-fill.edu {
    background: #2563eb;
  }

  .bar-count {
    font-size: 10px;
    color: var(--color-text-muted);
    text-align: right;
  }

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 0;
    color: var(--color-text-muted);
    font-size: 13px;
  }

  .pyramid-header {
    display: grid;
    grid-template-columns: 1fr 36px 1fr 32px;
    gap: 2px;
    margin-bottom: 4px;
  }

  .pyramid-axis-label {
    font-size: 9px;
    color: var(--color-text-muted);
    opacity: 0.6;
  }

  .pyramid-axis-label:first-child {
    text-align: right;
  }

  .pyramid {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .pyramid-row {
    display: grid;
    grid-template-columns: 1fr 36px 1fr 32px;
    align-items: center;
    gap: 2px;
    height: 14px;
  }

  .pyramid-side {
    display: flex;
    height: 10px;
  }

  .pyramid-side.left {
    justify-content: flex-end;
  }

  .pyramid-side.right {
    justify-content: flex-start;
  }

  .pyramid-bar {
    height: 100%;
    background: var(--color-primary);
    border-radius: 1px;
    min-width: 2px;
    opacity: 0.75;
    transition: width 0.3s ease;
  }

  .pyramid-label {
    font-size: 9px;
    color: var(--color-text-muted);
    text-align: center;
    white-space: nowrap;
  }

  .pyramid-pct {
    font-size: 9px;
    color: var(--color-text-muted);
    text-align: right;
  }
</style>
