import type { Demographics } from '$lib/types';
import { postalLookup, districtsData } from '$lib/data';

export function resolveDistrictName(postalCode: string): string | null {
  return (postalLookup as Record<string, { bydel: string; lokaludvalg: string }>)[postalCode]?.bydel ?? null;
}

export function resolveDistrict(postalCode: string): Demographics | null {
  const lookup = postalLookup[postalCode];
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
  };
}
