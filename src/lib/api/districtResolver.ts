import type { Demographics } from '$lib/types';
import { postalLookup, districtsData } from '$lib/data';

/**
 * Fallback: map inner-city Copenhagen postal codes (1000-1799) to bydel/lokaludvalg
 * by numeric range. These codes are too granular to enumerate individually in postalLookup.
 */
function inferLookup(postalCode: string): { bydel: string; lokaludvalg: string } | null {
  const n = parseInt(postalCode, 10);
  if (isNaN(n)) return null;
  // Christianshavn: 1100-1199, 1400-1499
  if ((n >= 1100 && n <= 1199) || (n >= 1400 && n <= 1499)) {
    return { bydel: 'Indre By', lokaludvalg: 'Christianshavn' };
  }
  // Vesterbro: 1500-1799
  if (n >= 1500 && n <= 1799) {
    return { bydel: 'Vesterbro/Kongens Enghave', lokaludvalg: 'Vesterbro' };
  }
  // Inner city: 1000-1399
  if (n >= 1000 && n <= 1399) {
    return { bydel: 'Indre By', lokaludvalg: 'inner city' };
  }
  return null;
}

export function resolveDistrictName(postalCode: string): string | null {
  const entry = (postalLookup as Record<string, { bydel: string; lokaludvalg: string }>)[postalCode]
    ?? inferLookup(postalCode);
  return entry?.bydel ?? null;
}

/**
 * Returns a more specific area label: uses `lokaludvalg` when meaningful,
 * falls back to `bydel`. Avoids the generic "Indre By" for known sub-areas.
 * Examples: 1153 → "Christianshavn", 1620 → "Vesterbro", 2200 → "Nørrebro"
 */
export function resolveAreaLabel(postalCode: string): string | null {
  const entry = (postalLookup as Record<string, { bydel: string; lokaludvalg: string }>)[postalCode]
    ?? inferLookup(postalCode);
  if (!entry) return null;
  if (entry.lokaludvalg && entry.lokaludvalg !== 'inner city') return entry.lokaludvalg;
  return entry.bydel;
}

export function resolveDistrict(postalCode: string): Demographics | null {
  const lookup = (postalLookup as Record<string, { bydel: string; lokaludvalg: string }>)[postalCode]
    ?? inferLookup(postalCode);
  if (!lookup) return null;

  const bydelData = districtsData.bydel[lookup.bydel];
  if (!bydelData) return null;

  const eduData = districtsData.lokaludvalg[lookup.lokaludvalg];

  // Find sub-district: first key that starts with lokaludvalg name
  let subDistrictData: any = null;
  for (const key of Object.keys(districtsData.subDistrict)) {
    if (key.startsWith(lookup.lokaludvalg) || key.includes(lookup.lokaludvalg)) {
      subDistrictData = districtsData.subDistrict[key];
      break;
    }
  }

  // Also try "Quarter - {bydel}" or "Local committee - {lokaludvalg}" as fallback
  if (!subDistrictData) {
    const fallbackKeys = [
      `Quarter - ${lookup.bydel}`,
      `Local committee - ${lookup.lokaludvalg}`,
    ];
    for (const fk of fallbackKeys) {
      if (districtsData.subDistrict[fk]) {
        subDistrictData = districtsData.subDistrict[fk];
        break;
      }
    }
  }

  const incomeRaw = bydelData.income;

  return {
    medianAge: subDistrictData?.medianAge ?? 35,
    totalPopulation: bydelData.population?.total ?? 0,
    male: bydelData.population?.male ?? 0,
    female: bydelData.population?.female ?? 0,
    agePyramid: subDistrictData?.agePyramid ?? {},
    background: bydelData.background ?? { danish: 0, western: 0, nonWestern: 0 },
    maritalStatus: bydelData.maritalStatus ?? { single: 0, married: 0, divorced: 0, widowed: 0 },
    employment: bydelData.employment ?? { employed: 0, unemployed: 0, outsideWorkforce: 0, students: 0 },
    education: eduData?.education ?? {
      primaryOnly: 0, highSchool: 0, vocational: 0,
      shortHigher: 0, mediumHigher: 0, longHigher: 0,
    },
    ...(incomeRaw ? { income: incomeRaw } : {}),
  };
}
