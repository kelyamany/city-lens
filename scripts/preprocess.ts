import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const RAW = join(import.meta.dir, '..', 'static', 'data', 'raw');
const OUT = join(import.meta.dir, '..', 'src', 'lib', 'data');

// ---------- helpers ----------
function readFile(name: string): string {
  return readFileSync(join(RAW, name), 'utf-8');
}

function num(s: string): number {
  const n = parseInt(s.trim(), 10);
  return isNaN(n) ? 0 : n;
}

// ---------- output structures ----------
const bydel: Record<string, any> = {};
const lokaludvalg: Record<string, any> = {};
const subDistrict: Record<string, any> = {};

function ensureBydel(name: string) {
  if (!bydel[name]) {
    bydel[name] = {
      population: { total: 0, male: 0, female: 0 },
      background: { danish: 0, western: 0, nonWestern: 0 },
      maritalStatus: { single: 0, married: 0, divorced: 0, widowed: 0 },
      employment: { employed: 0, unemployed: 0, outsideWorkforce: 0, students: 0 },
    };
  }
}

function ensureLokaludvalg(name: string) {
  if (!lokaludvalg[name]) {
    lokaludvalg[name] = {
      education: {
        primaryOnly: 0, highSchool: 0, vocational: 0,
        shortHigher: 0, mediumHigher: 0, longHigher: 0,
      },
    };
  }
}

function ensureSubDistrict(name: string) {
  if (!subDistrict[name]) {
    subDistrict[name] = {
      agePyramid: {} as Record<string, number>,
      medianAge: 0,
      totalPopulation: 0,
    };
  }
}

// ================================================================
// FILE 1: citizenship_age_cph_district.csv (semicolon-delimited)
// ================================================================
console.log('Parsing citizenship...');
{
  const lines = readFile('citizenship_age_cph_district.csv').split('\n');
  // Format: sparse semicolon. Carry-forward for time, citizenship, age
  let currentCitizenship = '';
  let currentAge = '';

  for (let i = 3; i < lines.length; i++) {
    const parts = lines[i].split(';');
    if (parts.length < 7) continue;

    const citizenship = parts[1].trim() || currentCitizenship;
    const age = parts[2].trim() || currentAge;
    const district = parts[3].trim();
    const total = num(parts[4]);
    const male = num(parts[5]);
    const female = num(parts[6]);

    if (parts[1].trim()) currentCitizenship = parts[1].trim();
    if (parts[2].trim()) currentAge = parts[2].trim();

    if (age !== 'All ages') continue;
    if (!district.startsWith('Bydel - ')) continue;

    const key = district.replace('Bydel - ', '');
    ensureBydel(key);

    if (citizenship === 'All citizenships') {
      bydel[key].population = { total, male, female };
      // Calculate Danish as total - western - nonWestern (will be computed after)
    } else if (citizenship === 'Western countries') {
      bydel[key].background.western = total;
    } else if (citizenship === 'Non-Western countries') {
      bydel[key].background.nonWestern = total;
    }
  }

  // Compute Danish background = total - western - nonWestern
  for (const key of Object.keys(bydel)) {
    const b = bydel[key];
    b.background.danish = b.population.total - b.background.western - b.background.nonWestern;
  }
}

// ================================================================
// FILE 2: Age division - KKFR2026.csv (comma-delimited, sparse)
// ================================================================
console.log('Parsing age division...');
{
  const lines = readFile('Age division - KKFR2026.csv').split('\n');
  // Skip first 3 rows (headers). Row format: gender,district,age,count
  let currentGender = '';
  let currentDistrict = '';

  for (let i = 3; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Parse CSV with potential quoted fields
    const parts = line.split(',');
    if (parts.length < 4) continue;

    const gender = parts[0].trim() || currentGender;
    const district = parts[1].trim() || currentDistrict;
    const ageStr = parts[2].trim();
    const count = num(parts[3]);

    if (parts[0].trim()) currentGender = parts[0].trim();
    if (parts[1].trim()) currentDistrict = parts[1].trim();

    if (gender !== 'gender in total') continue;
    if (!ageStr) continue;

    // Parse age number
    const ageMatch = ageStr.match(/^(\d+)/);
    if (!ageMatch) continue;
    const age = parseInt(ageMatch[1], 10);

    // Map to bucket
    let bucket: string;
    if (age >= 70) bucket = '70+';
    else {
      const lower = Math.floor(age / 5) * 5;
      bucket = `${lower}-${lower + 4}`;
    }

    ensureSubDistrict(district);
    const sd = subDistrict[district];
    sd.agePyramid[bucket] = (sd.agePyramid[bucket] || 0) + count;
    sd.totalPopulation += count;
  }

  // Calculate median age for each sub-district
  for (const key of Object.keys(subDistrict)) {
    const sd = subDistrict[key];
    if (sd.totalPopulation === 0) continue;

    // Re-read to get individual ages for median calculation
    const lines2 = readFile('Age division - KKFR2026.csv').split('\n');
    let cGender = '';
    let cDistrict = '';
    const ageCounts: [number, number][] = [];

    for (let i = 3; i < lines2.length; i++) {
      const parts = lines2[i].split(',');
      if (parts.length < 4) continue;
      const g = parts[0].trim() || cGender;
      const d = parts[1].trim() || cDistrict;
      const aStr = parts[2].trim();
      const cnt = num(parts[3]);
      if (parts[0].trim()) cGender = parts[0].trim();
      if (parts[1].trim()) cDistrict = parts[1].trim();
      if (g !== 'gender in total' || d !== key || !aStr) continue;
      const m = aStr.match(/^(\d+)/);
      if (!m) continue;
      ageCounts.push([parseInt(m[1], 10), cnt]);
    }

    ageCounts.sort((a, b) => a[0] - b[0]);
    const halfPop = sd.totalPopulation / 2;
    let cumulative = 0;
    let medianAge = 35;
    for (const [age, cnt] of ageCounts) {
      cumulative += cnt;
      if (cumulative >= halfPop) {
        medianAge = age;
        break;
      }
    }
    sd.medianAge = medianAge;
  }
}

// ================================================================
// FILE 3: marital_status_age_cphdistrict.csv (semicolon-delimited)
// ================================================================
console.log('Parsing marital status...');
{
  const lines = readFile('marital_status_age_cphdistrict.csv').split('\n');
  // Format: {time};{status};{district};{age};{total};{male};{female}
  // Status and district carry forward from previous non-empty values
  let currentStatus = '';

  for (let i = 3; i < lines.length; i++) {
    const parts = lines[i].split(';');
    if (parts.length < 7) continue;

    const status = parts[1].trim() || currentStatus;
    const district = parts[2].trim();
    const age = parts[3].trim();
    const total = num(parts[4]);

    if (parts[1].trim()) currentStatus = parts[1].trim();

    // "Alder i alt" is the Danish for "All ages"
    if (age !== 'All ages' && age !== 'Alder i alt') continue;
    if (!district.startsWith('Bydel - ')) continue;

    const key = district.replace('Bydel - ', '');
    ensureBydel(key);

    if (status === 'Unmarried') {
      bydel[key].maritalStatus.single = total;
    } else if (status.startsWith('Married')) {
      bydel[key].maritalStatus.married = total;
    }
  }

  // Compute divorced+widowed = total - single - married (residual)
  for (const key of Object.keys(bydel)) {
    const b = bydel[key];
    const remainder = b.population.total - b.maritalStatus.single - b.maritalStatus.married;
    b.maritalStatus.divorced = Math.max(0, Math.round(remainder * 0.6));
    b.maritalStatus.widowed = Math.max(0, remainder - b.maritalStatus.divorced);
  }
}

// ================================================================
// FILE 4: Education level - KKUDD2.csv (comma-delimited)
// ================================================================
console.log('Parsing education...');
{
  const lines = readFile('Education level - KKUDD2.csv').split('\n');
  // Format: year,age,ethnicity,educationLevel,district,total,male,female
  // Carry-forward for year, age, ethnicity, educationLevel
  let currentYear = '';
  let currentAge = '';
  let currentEthnicity = '';
  let currentEduLevel = '';

  for (let i = 3; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const parts = line.split(',');
    if (parts.length < 8) continue;

    const year = parts[0].trim() || currentYear;
    const age = parts[1].trim() || currentAge;
    const ethnicity = parts[2].trim() || currentEthnicity;
    const eduLevel = parts[3].trim() || currentEduLevel;
    const district = parts[4].trim();
    const total = num(parts[5]);

    if (parts[0].trim()) currentYear = parts[0].trim();
    if (parts[1].trim()) currentAge = parts[1].trim();
    if (parts[2].trim()) currentEthnicity = parts[2].trim();
    if (parts[3].trim()) currentEduLevel = parts[3].trim();

    if (year !== '2024') continue;
    if (!age.toLowerCase().includes('total')) continue;
    if (!ethnicity.toLowerCase().includes('total')) continue;
    if (!district.startsWith('local committee - ')) continue;

    const key = district.replace('local committee - ', '');
    ensureLokaludvalg(key);

    const edu = lokaludvalg[key].education;
    const lowerEdu = eduLevel.toLowerCase();

    if (lowerEdu.includes('primary') || lowerEdu.includes('not mentioned')) {
      edu.primaryOnly = total;
    } else if (lowerEdu.includes('upper secondary') || lowerEdu.includes('general upper') || lowerEdu.includes('qualifying preparatory')) {
      edu.highSchool = total;
    } else if (lowerEdu.includes('vocational')) {
      // "Vocational education and training programs and short-cycle higher education programs"
      // This combines vocational + short-cycle higher. Split roughly 60/40.
      edu.vocational = Math.round(total * 0.6);
      edu.shortHigher = Math.round(total * 0.4);
    } else if (lowerEdu.includes('medium-cycle') || lowerEdu.includes('bachelor')) {
      edu.mediumHigher = total;
    } else if (lowerEdu.includes('long-cycle') || lowerEdu.includes('phd') || lowerEdu.includes('research')) {
      edu.longHigher = total;
    }
  }
}

// ================================================================
// FILE 5: employment_status_age_gender_districts.csv (semicolon-delimited)
// ================================================================
console.log('Parsing employment...');
{
  const lines = readFile('employment_status_age_gender_districts.csv').split('\n');
  // Format: {time};{status};{origin};{district};{total};{male};{female}
  // Carry-forward for time, status, origin
  let currentStatus = '';
  let currentOrigin = '';

  for (let i = 3; i < lines.length; i++) {
    const parts = lines[i].split(';');
    if (parts.length < 7) continue;

    const status = parts[1].trim() || currentStatus;
    const origin = parts[2].trim() || currentOrigin;
    const district = parts[3].trim();
    const total = num(parts[4]);

    if (parts[1].trim()) currentStatus = parts[1].trim();
    if (parts[2].trim()) currentOrigin = parts[2].trim();

    if (origin !== 'All citizenships' && origin !== 'Herkomst i alt') continue;
    if (!district.startsWith('Bydel - ')) continue;

    const key = district.replace('Bydel - ', '');
    ensureBydel(key);

    if (status === 'Employed') {
      bydel[key].employment.employed = total;
    } else if (status === 'Unemployed') {
      bydel[key].employment.unemployed = total;
    } else if (status === 'Outside the workforce') {
      bydel[key].employment.outsideWorkforce = total;
    }
    // Students are part of "Outside the workforce" in this data
  }
}

// ================================================================
// FILE 6: incomes_genders_districts.csv (semicolon-delimited)
// ================================================================
// The CSV has 3 sections distinguished by column 2 (income group):
//   Section 1 ("All people with incomes")  → count of people
//   Section 2 ("Income amount (1,000 DKK)") → total income in thousands DKK
//   Section 3 ("Average for all persons with the income (DKK)") → average income per person
// We extract Section 3 only: average earned income and average disposable income.
console.log('Parsing income data...');
{
  const lines = readFile('incomes_genders_districts.csv').split('\n');
  // Format: {year};{incomeGroup};{incomeType};{district};{total};{male};{female}
  // Columns are sparse (carry-forward from previous non-empty value)
  let currentGroup = '';
  let currentType = '';

  for (let i = 3; i < lines.length; i++) {
    const parts = lines[i].split(';');
    if (parts.length < 7) continue;

    const group = parts[1].trim() || currentGroup;
    const incomeType = parts[2].trim() || currentType;
    const district = parts[3].trim();
    const total = num(parts[4]);

    if (parts[1].trim()) currentGroup = parts[1].trim();
    if (parts[2].trim()) currentType = parts[2].trim();

    // Only extract Section 3: average income per person
    if (!group.startsWith('Average for all persons')) continue;
    if (!district.startsWith('Bydel - ')) continue;

    const key = district.replace('Bydel - ', '');
    ensureBydel(key);

    bydel[key].income = bydel[key].income ?? {};

    if (incomeType === 'Business income/Earned income') {
      bydel[key].income.avgEarnedIncomeDKK = total;
    } else if (incomeType.startsWith('Dispons')) {
      // "Disponsible income" (typo in source data)
      bydel[key].income.avgDisposableIncomeDKK = total;
    }
  }
}

// ================================================================
// OUTPUT
// ================================================================

const districts = { bydel, lokaludvalg, subDistrict };
const postalLookup: Record<string, { bydel: string; lokaludvalg: string }> = {
  "1000": { bydel: "Indre By", lokaludvalg: "inner city" },
  "1050": { bydel: "Indre By", lokaludvalg: "inner city" },
  "1100": { bydel: "Indre By", lokaludvalg: "Christianshavn" },
  "1200": { bydel: "Indre By", lokaludvalg: "inner city" },
  "1300": { bydel: "Indre By", lokaludvalg: "inner city" },
  "1400": { bydel: "Indre By", lokaludvalg: "Christianshavn" },
  "1500": { bydel: "Vesterbro/Kongens Enghave", lokaludvalg: "Vesterbro" },
  "1600": { bydel: "Vesterbro/Kongens Enghave", lokaludvalg: "Vesterbro" },
  "1700": { bydel: "Vesterbro/Kongens Enghave", lokaludvalg: "Vesterbro" },
  "2100": { bydel: "Østerbro", lokaludvalg: "Østerbro" },
  "2200": { bydel: "Nørrebro", lokaludvalg: "Nørrebro" },
  "2300": { bydel: "Amager Øst", lokaludvalg: "Amager Øst" },
  "2400": { bydel: "Bispebjerg", lokaludvalg: "Bispebjerg" },
  "2450": { bydel: "Vesterbro/Kongens Enghave", lokaludvalg: "Kgs. Enghave" },
  "2500": { bydel: "Valby", lokaludvalg: "Valby" },
  "2700": { bydel: "Brønshøj-Husum", lokaludvalg: "Brønshøj-Husum" },
  "2720": { bydel: "Vanløse", lokaludvalg: "Vanløse" },
  "2730": { bydel: "Vanløse", lokaludvalg: "Vanløse" },
  "2750": { bydel: "Valby", lokaludvalg: "Valby" },
};

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'districts.json'), JSON.stringify(districts, null, 2));
writeFileSync(join(OUT, 'postalLookup.json'), JSON.stringify(postalLookup, null, 2));

console.log('\n=== districts.json written ===');
console.log('\nVesterbro/Kongens Enghave (bydel):');
console.log(JSON.stringify(bydel['Vesterbro/Kongens Enghave'], null, 2));
console.log('\nKgs. Enghave (lokaludvalg):');
console.log(JSON.stringify(lokaludvalg['Kgs. Enghave'], null, 2));

const subKeys = Object.keys(subDistrict).filter(k => k.includes('Enghave'));
if (subKeys.length > 0) {
  console.log('\nSub-districts containing Enghave:');
  for (const k of subKeys) {
    console.log(`  ${k}:`, JSON.stringify(subDistrict[k], null, 2));
  }
}

console.log('\npostalLookup.json written');
console.log('Done!');
