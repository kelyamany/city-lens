# City Lens

City Lens is an AI-assisted urban planning interface for evaluating a plot of land in Copenhagen.

It combines:
- Static demographic datasets
- Nearby facilities detection
- Map-based interaction
- AI-generated land-use recommendations
- Follow-up conversational analysis

The main demo scenario is a municipality evaluating a vacant plot such as:

**Strømmen 3A, 2450 København, Denmark**

---

## What it does

A planner selects a location on the map or searches for an address.

City Lens then:
1. Resolves the area context
2. Loads demographic insights instantly from preprocessed local data
3. Finds nearby amenities and facilities
4. Generates an AI brief suggesting the best use of the plot
5. Supports follow-up questions such as:
   - “Are there schools nearby?”
   - “What is missing in this area?”
   - “Change radius to 1km”

---

## Main features

### 1. Map-first analysis
- Search for an address in Copenhagen
- Select a plot directly on the map
- Visualize the current analysis radius
- Inspect nearby facilities around the selected location

### 2. Insights tab (no AI required)
This tab is available instantly and should work even if AI is unavailable.

Typical insights include:
- Median age
- Total population
- Male / female ratio
- Background distribution
- Education level
- Employment status
- Marital status
- Age distribution

### 3. AI brief
The AI brief uses the selected area context plus nearby facility data to suggest a land use for the plot.

Examples:
- Community health center
- Childcare / kindergarten
- Youth sports facility
- Mixed-use housing with public services
- Elder care support hub

### 4. Conversational follow-up
Users can ask follow-up questions after the initial analysis.

The chat is intended to:
- Explain the recommendation
- Identify missing amenities
- Compare radius-based outcomes
- Adjust the analysis radius

---

## Why this approach

Urban planning tools often separate statistics, maps, and recommendations into different systems.

City Lens brings them together in one workflow:
- Static public data for credibility
- Maps for spatial reasoning
- AI for interpretation

The result is a tool that feels useful even before the AI responds.

---

## Tech stack

This project is built with:
- SvelteKit
- TypeScript
- Bun
- Mapbox GL JS
- AI SDK
- Claude and/or Gemini
- Static JSON generated from CSV preprocessing

---

## Data sources

The app is designed around Copenhagen demographic datasets and related area signals.

Example dataset groups:
- Citizenship / background distribution
- Age distribution
- Marital status
- Education level
- Employment status

These raw CSV files are transformed into static JSON at build time so the app can load insights instantly.

---

## Getting started

### 1. Clone the repo

```bash
git clone https://github.com/kelyamany/city-lens.git
cd city-lens
```

### 2. Install dependencies

```bash
bun install
```

### 3. Create environment file

Create a `.env` file in the project root:

```env
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
PUBLIC_MAPBOX_TOKEN=
AI_PROVIDER=claude
```

You can switch providers by changing:

```env
AI_PROVIDER=claude
```

to:

```env
AI_PROVIDER=gemini
```

### 4. Add raw datasets

Place the CSV files in the expected raw data directory if they are not already present:

```text
static/data/raw/
```

### 5. Preprocess data

```bash
bun run preprocess
```

This should generate:
- `static/data/districts.json`
- `static/data/postalLookup.json`

### 6. Start the app

```bash
bun run dev
```

Then open the local development URL shown in the terminal.

---

## Available scripts

```bash
bun run dev
bun run build
bun run check
bun run preprocess
```

---

## Demo flow

A good demo sequence is:

1. Search for `Strømmen 3A, 2450 København`
2. Let the map fly to the site
3. Open the **Metrics** tab and highlight 2–3 key metrics
4. Switch to **Insights**
5. Read the recommended land use
6. Ask a follow-up question
7. Change the radius and show how nearby facilities analysis changes

---

## Status

City Lens is currently positioned as a demo-ready urban intelligence prototype for Copenhagen 