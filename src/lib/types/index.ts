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
  active: boolean;
}

export interface AreaBrief {
  neighbourhood: string;
  city: string;
  demographics: Demographics;
  pois: POI[];
  summary: string;
  topUse: string;
  tags: string[];
  reasoning: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
