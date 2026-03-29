/**
 * DST StatBank live API client
 *
 * Primary table: POSTNR1 — Population by postal code, sex, age (annual, Jan 1st)
 * Updated annually, last update 2026-02-12.
 *
 * Why not replace ALL static data with DST API?
 * - Employment, education, background, marital status are only available at
 *   municipality level (all of Copenhagen = code 101) in the current DST API.
 *   Our static CSVs (from now-retired KK-specific tables) are at bydel/district
 *   level, which is MORE granular. We keep them as the better source.
 * - POSTNR1 gives us postal-code level age+gender, which is actually BETTER than
 *   our static bydel-level age data. This is the main live data win.
 */

const DST_BASE = 'https://api.statbank.dk/v1';

// ── In-memory cache with 1-hour TTL ──────────────────────────────────────────
const _cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 3_600_000; // 1 hour

function withCache<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return Promise.resolve(hit.data as T);
  return fn().then((data) => {
    _cache.set(key, { data, ts: Date.now() });
    return data;
  });
}

// ── DST data query ────────────────────────────────────────────────────────────
async function queryTable(
  table: string,
  variables: Record<string, string[]>
): Promise<unknown> {
  const res = await fetch(`${DST_BASE}/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table,
      format: 'JSONSTAT',
      lang: 'en',
      variables: Object.entries(variables).map(([code, values]) => ({ code, values })),
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`DST HTTP ${res.status} for ${table}`);
  return res.json();
}

// ── JSON-stat v1 parser ───────────────────────────────────────────────────────
// DST returns nested JSON-stat: { dataset: { dimension: { id, size, [dimId]: { category: { index, label } } }, value: [] } }
interface ParsedStat {
  dimOrder: string[];
  dimKeys: Record<string, string[]>;    // dimension id → ordered value codes
  dimSizes: Record<string, number>;
  values: (number | null)[];
}

function parseStat(response: unknown): ParsedStat {
  const ds = (response as any).dataset;
  const dim = ds.dimension;
  const dimOrder: string[] = dim.id;
  const dimSizes: Record<string, number> = {};
  const dimKeys: Record<string, string[]> = {};

  for (const id of dimOrder) {
    const cat = dim[id].category;
    const idx: Record<string, number> = cat.index ?? {};
    dimKeys[id] = Object.keys(idx).sort((a, b) => idx[a] - idx[b]);
    dimSizes[id] = dimKeys[id].length;
  }

  return { dimOrder, dimKeys, dimSizes, values: ds.value };
}

/** Compute linear index into the flat values array */
function idx(parsed: ParsedStat, coords: Record<string, number>): number {
  let index = 0;
  let stride = 1;
  for (let i = parsed.dimOrder.length - 1; i >= 0; i--) {
    const dimId = parsed.dimOrder[i];
    index += (coords[dimId] ?? 0) * stride;
    stride *= parsed.dimSizes[dimId];
  }
  return index;
}

// ── Age pyramid ───────────────────────────────────────────────────────────────
// POSTNR1 age buckets (from tableinfo):
// IALT, 0-4, 5-9, 10-14, 15-19, 20-24, 25-29, 30-34, 35-39, 40-44,
// 45-49, 50-54, 55-59, 60-64, 65-69, 70-74, 75-79, 80-84, 85-89, 90-94, 95+
//
// We collapse 70-74…95+ into "70+" to match the existing Demographics.agePyramid schema.

function computeMedianAge(pyramid: Record<string, number>, totalPop: number): number {
  const bins: { label: string; low: number; width: number }[] = [
    { label: '0-4',   low: 0,  width: 5 },
    { label: '5-9',   low: 5,  width: 5 },
    { label: '10-14', low: 10, width: 5 },
    { label: '15-19', low: 15, width: 5 },
    { label: '20-24', low: 20, width: 5 },
    { label: '25-29', low: 25, width: 5 },
    { label: '30-34', low: 30, width: 5 },
    { label: '35-39', low: 35, width: 5 },
    { label: '40-44', low: 40, width: 5 },
    { label: '45-49', low: 45, width: 5 },
    { label: '50-54', low: 50, width: 5 },
    { label: '55-59', low: 55, width: 5 },
    { label: '60-64', low: 60, width: 5 },
    { label: '65-69', low: 65, width: 5 },
    { label: '70+',   low: 70, width: 20 }, // wide last bin
  ];
  const half = totalPop / 2;
  let cumulative = 0;
  for (const { label, low, width } of bins) {
    const count = pyramid[label] ?? 0;
    if (count > 0 && cumulative + count >= half) {
      return Math.round(low + ((half - cumulative) / count) * width);
    }
    cumulative += count;
  }
  return 40; // fallback
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface PostalAgeDemographics {
  totalPopulation: number;
  male: number;
  female: number;
  agePyramid: Record<string, number>;
  medianAge: number;
  source: 'dst';
  year: number;
}

/**
 * Fetch population, gender split, and age pyramid for a Copenhagen postal code
 * from the live DST StatBank (POSTNR1).
 *
 * Returns null on any error so callers can fall back to static data.
 */
export async function fetchPostalDemographics(
  postalCode: string
): Promise<PostalAgeDemographics | null> {
  // Normalise: DST uses zero-padded 4-digit codes
  const code = postalCode.padStart(4, '0');

  return withCache(`postnr1:${code}`, async () => {
    const raw = await queryTable('POSTNR1', {
      PNR20: [code],
      KØN: ['TOT', '1', '2'],
      ALDER: ['*'],
      Tid: ['2026'],
    });

    const parsed = parseStat(raw);
    const ageKeys = parsed.dimKeys['ALDER'];   // e.g. ['IALT','0-4','5-9',...]
    const konKeys = parsed.dimKeys['KØN'];     // ['TOT','1','2']

    const konIdx: Record<string, number> = {};
    konKeys.forEach((k, i) => { konIdx[k] = i; });

    const ialt = ageKeys.indexOf('IALT');

    const val = (konCode: string, ageI: number): number => {
      const v = parsed.values[idx(parsed, {
        PNR20: 0,
        KØN: konIdx[konCode] ?? 0,
        ALDER: ageI,
        ContentsCode: 0,
        Tid: 0,
      })];
      return v ?? 0;
    };

    const totalPopulation = val('TOT', ialt);
    const male            = val('1',   ialt);
    const female          = val('2',   ialt);

    if (totalPopulation === 0) return null; // postal code not found / no data

    // Build age pyramid, collapsing 70+ groups
    const agePyramid: Record<string, number> = {};
    let over70 = 0;

    for (let i = 0; i < ageKeys.length; i++) {
      const group = ageKeys[i];
      if (group === 'IALT') continue;
      const start = parseInt(group.split('-')[0].replace('+', ''));
      const count = val('TOT', i);
      if (start >= 70) {
        over70 += count;
      } else {
        agePyramid[group] = count;
      }
    }
    agePyramid['70+'] = over70;

    const medianAge = computeMedianAge(agePyramid, totalPopulation);

    return { totalPopulation, male, female, agePyramid, medianAge, source: 'dst' as const, year: 2026 };
  }).catch(() => null); // any network/parse error → null (caller falls back to static)
}
