<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import mapboxgl from 'mapbox-gl';
  import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
  import { analysisRadius } from '$lib/stores/map';
  import { brief } from '$lib/stores/brief';
  import { layers } from '$lib/stores/layers';

  let { onPlotSelected }: { onPlotSelected: (data: any) => void } = $props();

  let mapContainer: HTMLDivElement;
  let map: mapboxgl.Map | null = $state(null);
  let marker: mapboxgl.Marker | null = null;
  let isSatellite = $state(false);
  let currentLng = 0;
  let currentLat = 0;
  let currentRadius = 500;
  let currentPois = $state<any[]>([]);
  let facilitiesActive = $state(false);

  // ─── Category config ────────────────────────────────────────────────────────
  const CATEGORY: Record<string, { color: string; label: string }> = {
    hospital:      { color: '#ef4444', label: 'Healthcare' },
    pharmacy:      { color: '#ef4444', label: 'Healthcare' },
    clinic:        { color: '#ef4444', label: 'Healthcare' },
    school:        { color: '#3b82f6', label: 'Education' },
    kindergarten:  { color: '#3b82f6', label: 'Education' },
    library:       { color: '#3b82f6', label: 'Education' },
    restaurant:    { color: '#f97316', label: 'Food & Drink' },
    cafe:          { color: '#f97316', label: 'Food & Drink' },
    bar:           { color: '#f97316', label: 'Food & Drink' },
    park:          { color: '#22c55e', label: 'Parks & Recreation' },
    playground:    { color: '#22c55e', label: 'Parks & Recreation' },
    sports_centre: { color: '#22c55e', label: 'Parks & Recreation' },
  };
  const DEFAULT_COLOR = '#6b7280';

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function createCircleGeoJSON(lng: number, lat: number, radiusMeters: number) {
    const points = 64;
    const coords: [number, number][] = [];
    const earthRadius = 6371000;
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const dx = radiusMeters * Math.cos(angle);
      const dy = radiusMeters * Math.sin(angle);
      const newLat = lat + (dy / earthRadius) * (180 / Math.PI);
      const newLng =
        lng + (dx / (earthRadius * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
      coords.push([newLng, newLat]);
    }
    return {
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [coords] },
      properties: {},
    };
  }

  function updateCircle(lng: number, lat: number, radius: number) {
    if (!map) return;
    currentLng = lng;
    currentLat = lat;
    const geojson = createCircleGeoJSON(lng, lat, radius);
    (map.getSource('radius-circle') as mapboxgl.GeoJSONSource | undefined)?.setData(
      geojson as any
    );
  }

  function buildPOIFeatures(pois: any[]) {
    return {
      type: 'FeatureCollection' as const,
      features: pois.map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
        properties: {
          name: p.name,
          type: p.type,
          category: CATEGORY[p.type]?.label ?? 'Other',
          color: CATEGORY[p.type]?.color ?? DEFAULT_COLOR,
        },
      })),
    };
  }

  function updatePOISource(pois: any[]) {
    if (!map) return;
    const source = map.getSource('pois') as mapboxgl.GeoJSONSource | undefined;
    source?.setData(buildPOIFeatures(pois) as any);
  }

  function setPOIVisibility(visible: boolean) {
    if (!map) return;
    const vis = visible ? 'visible' : 'none';
    for (const id of ['poi-clusters', 'poi-cluster-count', 'poi-points']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    }
  }

  // ─── Setup all custom sources/layers after each style load ──────────────────
  function setupCustomLayers() {
    if (!map) return;

    // Radius circle (fill + border)
    map.addSource('radius-circle', {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[]] }, properties: {} },
    });
    map.addLayer({
      id: 'radius-circle-fill',
      type: 'fill',
      source: 'radius-circle',
      paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.06 },
    });
    map.addLayer({
      id: 'radius-circle-line',
      type: 'line',
      source: 'radius-circle',
      paint: { 'line-color': '#2563eb', 'line-width': 2, 'line-dasharray': [2, 2] },
    });

    // Restore circle if we already have a location
    if (currentLng && currentLat) {
      updateCircle(currentLng, currentLat, currentRadius);
    }

    // POI source with clustering
    map.addSource('pois', {
      type: 'geojson',
      data: buildPOIFeatures(currentPois) as any,
      cluster: true,
      clusterMaxZoom: 15,
      clusterRadius: 50,
    });

    // Cluster background circles
    map.addLayer({
      id: 'poi-clusters',
      type: 'circle',
      source: 'pois',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step', ['get', 'point_count'],
          '#2563eb', 10, '#1d4ed8', 30, '#1e3a8a',
        ],
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 30, 28],
        'circle-opacity': 0.88,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });

    // Cluster count labels
    map.addLayer({
      id: 'poi-cluster-count',
      type: 'symbol',
      source: 'pois',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12,
      },
      paint: { 'text-color': '#ffffff' },
    });

    // Individual POI dots (color-coded by category)
    map.addLayer({
      id: 'poi-points',
      type: 'circle',
      source: 'pois',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['coalesce', ['get', 'color'], DEFAULT_COLOR],
        'circle-radius': 7,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.92,
      },
    });

    // Apply current visibility state
    setPOIVisibility(facilitiesActive);

    // ── Interactions ──────────────────────────────────────────────────────────
    // Click cluster → zoom in
    map.on('click', 'poi-clusters', (e) => {
      const features = map!.queryRenderedFeatures(e.point, { layers: ['poi-clusters'] });
      const clusterId = features[0]?.properties?.cluster_id;
      if (clusterId == null) return;
      (map!.getSource('pois') as mapboxgl.GeoJSONSource).getClusterExpansionZoom(
        clusterId,
        (err, zoom) => {
          if (err || zoom == null) return;
          map!.easeTo({
            center: (features[0].geometry as any).coordinates,
            zoom,
          });
        }
      );
    });

    // Click individual POI → popup
    map.on('click', 'poi-points', (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const coords: [number, number] = (feature.geometry as any).coordinates.slice();
      const { name, category } = feature.properties as any;
      new mapboxgl.Popup({ closeButton: true, maxWidth: '200px' })
        .setLngLat(coords)
        .setHTML(
          `<div style="font-size:13px;font-weight:600">${name}</div>` +
          `<div style="font-size:11px;color:#6b7280;margin-top:2px">${category}</div>`
        )
        .addTo(map!);
    });

    // Cursor changes
    map.on('mouseenter', 'poi-clusters', () => { map!.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'poi-clusters', () => { map!.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'poi-points',   () => { map!.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'poi-points',   () => { map!.getCanvas().style.cursor = ''; });
  }

  // ─── Reactive store subscriptions ───────────────────────────────────────────
  const unsubRadius = analysisRadius.subscribe((radius) => {
    currentRadius = radius;
    if (currentLng && currentLat && map?.isStyleLoaded()) {
      updateCircle(currentLng, currentLat, radius);
    }
  });

  const unsubBrief = brief.subscribe(($brief) => {
    currentPois = $brief?.pois ?? [];
    if (map?.isStyleLoaded()) updatePOISource(currentPois);
  });

  const unsubLayers = layers.subscribe(($layers) => {
    facilitiesActive = $layers.find((l) => l.id === 'facilities')?.active ?? false;
    if (map?.isStyleLoaded()) setPOIVisibility(facilitiesActive);
  });

  // ─── Style toggle ────────────────────────────────────────────────────────────
  function toggleStyle() {
    isSatellite = !isSatellite;
    map?.setStyle(
      isSatellite
        ? 'mapbox://styles/mapbox/satellite-streets-v12'
        : 'mapbox://styles/mapbox/streets-v12'
    );
  }

  // ─── Public API ──────────────────────────────────────────────────────────────
  export function flyTo(lat: number, lon: number) {
    map?.flyTo({ center: [lon, lat], zoom: 15, duration: 1500 });
  }

  // ─── Mount ───────────────────────────────────────────────────────────────────
  onMount(() => {
    if (!PUBLIC_MAPBOX_TOKEN) {
      console.warn('Mapbox token not set.');
      return;
    }
    mapboxgl.accessToken = PUBLIC_MAPBOX_TOKEN;

    map = new mapboxgl.Map({
      container: mapContainer,
      style: 'mapbox://styles/mapbox/streets-v12', // default: OSM-like street view
      center: [12.5683, 55.6761],
      zoom: 12,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // setupCustomLayers fires on every style load (initial + after toggleStyle)
    map.on('style.load', setupCustomLayers);

    // Click on map → reverse geocode → trigger analysis
    map.on('click', async (e) => {
      // Don't trigger if clicking on a POI layer
      const poiFeatures = map!.queryRenderedFeatures(e.point, {
        layers: ['poi-clusters', 'poi-points'],
      });
      if (poiFeatures.length > 0) return;

      const { lng, lat } = e.lngLat;
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
          `?types=address&access_token=${PUBLIC_MAPBOX_TOKEN}`
        );
        const data = await res.json();
        const feature = data.features?.[0];
        const address = feature?.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        const context = feature?.context || [];
        const postcode = context.find((c: any) => c.id?.startsWith('postcode'))?.text || '';
        const neighbourhood =
          context.find((c: any) => c.id?.startsWith('neighborhood') || c.id?.startsWith('locality'))
            ?.text || '';

        if (marker) marker.remove();
        marker = new mapboxgl.Marker({ color: '#2563eb' })
          .setLngLat([lng, lat])
          .addTo(map!);

        updateCircle(lng, lat, currentRadius);

        onPlotSelected({ lat, lon: lng, address, postnr: postcode, neighbourhood, kommunekode: '0101' });
      } catch (err) {
        console.error('Geocoding error:', err);
      }
    });
  });

  onDestroy(() => {
    unsubRadius();
    unsubBrief();
    unsubLayers();
    if (map) map.remove();
  });
</script>

<div class="map-container" bind:this={mapContainer}>
  {#if !PUBLIC_MAPBOX_TOKEN}
    <div class="map-placeholder">
      <p>Set PUBLIC_MAPBOX_TOKEN in .env to enable the map</p>
    </div>
  {/if}

  <!-- Style toggle button -->
  <button class="style-toggle" onclick={toggleStyle} title={isSatellite ? 'Switch to street view' : 'Switch to satellite'}>
    {#if isSatellite}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    {:else}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.22 4.22l2.12 2.12m11.32 11.32 2.12 2.12M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
      </svg>
    {/if}
  </button>

  <!-- Legend (shown when facilities layer is active) -->
  {#if facilitiesActive && currentPois.length > 0}
    <div class="poi-legend">
      <div class="legend-row"><span class="legend-dot" style="background:#ef4444"></span>Healthcare</div>
      <div class="legend-row"><span class="legend-dot" style="background:#3b82f6"></span>Education</div>
      <div class="legend-row"><span class="legend-dot" style="background:#f97316"></span>Food & Drink</div>
      <div class="legend-row"><span class="legend-dot" style="background:#22c55e"></span>Recreation</div>
      <div class="legend-row"><span class="legend-dot" style="background:#6b7280"></span>Other</div>
    </div>
  {/if}
</div>

<style>
  .map-container {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .map-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: #1a1a2e;
    color: #6b7280;
    font-size: 14px;
  }

  /* Style toggle button — bottom-left */
  .style-toggle {
    position: absolute;
    bottom: 28px;
    left: 10px;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 6px;
    border: none;
    background: white;
    color: #374151;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: background 0.15s;
  }

  .style-toggle:hover {
    background: #f3f4f6;
  }

  /* POI category legend — bottom-left above toggle */
  .poi-legend {
    position: absolute;
    bottom: 72px;
    left: 10px;
    z-index: 10;
    background: rgba(255, 255, 255, 0.94);
    border-radius: 8px;
    padding: 8px 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .legend-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #374151;
    font-weight: 500;
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 1.5px solid rgba(255,255,255,0.8);
  }
</style>
