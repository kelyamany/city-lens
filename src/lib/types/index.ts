export interface Demographics {
  medianAge: number;
  totalPopulation: number;
  male: number;
  female: number;
  agePyramid: Record<string, number>;
  background: { danish: number; western: number; nonWestern: number };
  maritalStatus: { single: number; married: number; divorced: number; widowed: number };
  employment: { employed: number; unemployed: number; outsideWorkforce: number; students: number };
  education: {
    primaryOnly: number;
    highSchool: number;
    vocational: number;
    shortHigher: number;
    mediumHigher: number;
    longHigher: number;
  };
  /** Average income per person at bydel level (source: KK incomes dataset, 2024) */
  income?: {
    avgEarnedIncomeDKK: number;    // avg earned/business income for workers (DKK)
    avgDisposableIncomeDKK: number; // avg disposable income per earner (DKK)
  };
}

export interface POI {
  type: string;
  name: string;
  lat: number;
  lon: number;
}

export interface LayerState {
  id: string;
  label: string;
  icon: string;
  active: boolean;     // controls Metrics tab + AI context
  mapVisible?: boolean; // controls map overlay (choropleth / POI markers)
}

export interface AreaBrief {
  neighbourhood: string;
  city: string;
  demographics: Demographics;
  pois: POI[];
  summary?: string;
  topUse?: string;
  tags?: string[];
  reasoning?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PlaceResult {
  name: string;
  rating: number;
  address: string;
  placeId: string;
}

export interface SocialCategory {
  type: string;
  label: string;
  avgRating: number;
  count: number;
  topPlaces: PlaceResult[];
}

export interface SocialData {
  categories: SocialCategory[];
  error?: string;
}
