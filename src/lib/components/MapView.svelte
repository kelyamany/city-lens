<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import mapboxgl from 'mapbox-gl';
  import { env } from '$env/dynamic/public';
  const PUBLIC_MAPBOX_TOKEN = env.PUBLIC_MAPBOX_TOKEN;
  import { analysisRadius } from '$lib/stores/map';
  import { brief } from '$lib/stores/brief';
  import { layers } from '$lib/stores/layers';

  let { onPlotSelected }: { onPlotSelected: (data: any) => void } = $props();

  let mapContainer: HTMLDivElement;
  let map: mapboxgl.Map | null = $state(null);
  let marker: mapboxgl.Marker | null = null;
  let isSatellite = $state(false);

  // Plain (non-reactive) variables used only in imperative Mapbox calls
  let currentLng = 0;
  let currentLat = 0;
  let currentRadius = 500;
  let currentPois: any[] = [];
  let facilitiesActive = false;

  // ─── Category config ───────────────────────────────────────────────────────
  const CATEGORY: Record<string, { color: string; label: string }> = {
    hospital:      { color: '#ef4444', label: 'Healthcare' },
    pharmacy:      { color: '#ef4444', label: 'Healthcare' },
    clinic:        { color: '#ef4444', label: 'Healthcare' },
    school:        { color: '#3b82f6', label: 'Education' },
    kindergarten:  { color: '#3b82f6', label: 'Education' },
    library:       { color: '#3b82f6', label: 'Education' },
    park:          { color: '#22c55e', label: 'Recreation' },
    playground:    { color: '#22c55e', label: 'Recreation' },
    sports_centre: { color: '#22c55e', label: 'Recreation' },
  };
  const DEFAULT_COLOR = '#6b7280';

  // ─── Reactive state for template only ─────────────────────────────────────
  let showLegend = $state(false);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function createCircleGeoJSON(lng: number, lat: number, radiusMeters: number) {
    const points = 64;
    const coords: [number, number][] = [];
    const R = 6371000;
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const dx = radiusMeters * Math.cos(angle);
      const dy = radiusMeters * Math.sin(angle);
      coords.push([
        lng + (dx / (R * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI),
        lat + (dy / R) * (180 / Math.PI),
      ]);
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
    (map.getSource('radius-circle') as mapboxgl.GeoJSONSource | undefined)?.setData(geojson as any);
  }

  function buildPOIFeatures(pois: any[]) {
    return {
      type: 'FeatureCollection' as const,
      features: pois.map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
        properties: {
          name: p.name ?? 'Unnamed',
          type: p.type ?? '',
          category: CATEGORY[p.type]?.label ?? 'Other',
          color: CATEGORY[p.type]?.color ?? DEFAULT_COLOR,
        },
      })),
    };
  }

  function updatePOISource(pois: any[]) {
    if (!map) return;
    const src = map.getSource('pois') as mapboxgl.GeoJSONSource | undefined;
    src?.setData(buildPOIFeatures(pois) as any);
  }

  function setPOIVisibility(visible: boolean) {
    if (!map) return;
    const vis = visible ? 'visible' : 'none';
    for (const id of ['poi-clusters', 'poi-cluster-count', 'poi-points']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    }
    showLegend = visible && currentPois.length > 0;
  }

  // ─── Named handlers (prevents duplication on style reload) ────────────────
  function onClusterClick(e: mapboxgl.MapMouseEvent) {
    if (!map) return;
    const features = map.queryRenderedFeatures(e.point, { layers: ['poi-clusters'] });
    const clusterId = features[0]?.properties?.cluster_id;
    if (clusterId == null) return;
    (map.getSource('pois') as mapboxgl.GeoJSONSource).getClusterExpansionZoom(
      clusterId,
      (err, zoom) => {
        if (err || zoom == null) return;
        map!.easeTo({ center: (features[0].geometry as any).coordinates, zoom });
      }
    );
  }

  function onPointClick(e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) {
    if (!map || !e.features?.length) return;
    const feature = e.features[0];
    const coords: [number, number] = (feature.geometry as any).coordinates.slice();
    const { name, category } = feature.properties as any;
    new mapboxgl.Popup({ closeButton: true, maxWidth: '200px' })
      .setLngLat(coords)
      .setHTML(
        `<div style="font-size:13px;font-weight:600;color:#1a1a1a">${name}</div>` +
        `<div style="font-size:11px;color:#6b7280;margin-top:2px">${category}</div>`
      )
      .addTo(map);
  }

  function onClusterEnter() { if (map) map.getCanvas().style.cursor = 'pointer'; }
  function onClusterLeave() { if (map) map.getCanvas().style.cursor = ''; }
  function onPointEnter()   { if (map) map.getCanvas().style.cursor = 'pointer'; }
  function onPointLeave()   { if (map) map.getCanvas().style.cursor = ''; }

  // ─── Setup custom layers (called on every style.load) ─────────────────────
  function setupCustomLayers() {
    if (!map) return;

    // Radius circle
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

    // Restore circle if location already selected
    if (currentLng && currentLat) updateCircle(currentLng, currentLat, currentRadius);

    // POI source with clustering
    map.addSource('pois', {
      type: 'geojson',
      data: buildPOIFeatures(currentPois) as any,
      cluster: true,
      clusterMaxZoom: 15,
      clusterRadius: 50,
    });

    map.addLayer({
      id: 'poi-clusters',
      type: 'circle',
      source: 'pois',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': ['step', ['get', 'point_count'], '#2563eb', 10, '#1d4ed8', 30, '#1e3a8a'],
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 30, 28],
        'circle-opacity': 0.88,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });

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

    // Re-register interaction handlers (remove first to avoid duplicates on style change)
    map.off('click', 'poi-clusters', onClusterClick as any);
    map.off('click', 'poi-points',   onPointClick as any);
    map.off('mouseenter', 'poi-clusters', onClusterEnter);
    map.off('mouseleave', 'poi-clusters', onClusterLeave);
    map.off('mouseenter', 'poi-points',   onPointEnter);
    map.off('mouseleave', 'poi-points',   onPointLeave);

    map.on('click', 'poi-clusters', onClusterClick as any);
    map.on('click', 'poi-points',   onPointClick as any);
    map.on('mouseenter', 'poi-clusters', onClusterEnter);
    map.on('mouseleave', 'poi-clusters', onClusterLeave);
    map.on('mouseenter', 'poi-points',   onPointEnter);
    map.on('mouseleave', 'poi-points',   onPointLeave);

    // Apply current visibility
    setPOIVisibility(facilitiesActive);
  }

  // ─── Store subscriptions ──────────────────────────────────────────────────
  const unsubRadius = analysisRadius.subscribe((radius) => {
    currentRadius = radius;
    if (currentLng && currentLat && map?.isStyleLoaded()) {
      updateCircle(currentLng, currentLat, radius);
    }
  });

  const unsubBrief = brief.subscribe((briefVal) => {
    currentPois = briefVal?.pois ?? [];
    if (map?.isStyleLoaded()) {
      updatePOISource(currentPois);
      // Update legend visibility if facilities layer is on
      if (facilitiesActive) showLegend = currentPois.length > 0;
    }
  });

  const unsubLayers = layers.subscribe((layersVal) => {
    const active = layersVal.find((l) => l.id === 'facilities')?.active ?? false;
    facilitiesActive = active;
    if (map?.isStyleLoaded()) setPOIVisibility(active);
  });

  // ─── Style toggle ─────────────────────────────────────────────────────────
  function toggleStyle() {
    isSatellite = !isSatellite;
    map?.setStyle(
      isSatellite
        ? 'mapbox://styles/mapbox/satellite-streets-v12'
        : 'mapbox://styles/mapbox/streets-v12'
    );
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  export function flyTo(lat: number, lon: number) {
    map?.flyTo({ center: [lon, lat], zoom: 15, duration: 1500 });
  }

  // ─── Mount ────────────────────────────────────────────────────────────────
  onMount(() => {
    if (!PUBLIC_MAPBOX_TOKEN) return;
    mapboxgl.accessToken = PUBLIC_MAPBOX_TOKEN;

    map = new mapboxgl.Map({
      container: mapContainer,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [12.5683, 55.6761],
      zoom: 12,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Custom layers are re-added on every style load (handles initial load + style switch)
    map.on('style.load', setupCustomLayers);

    // Map click → reverse geocode → trigger analysis
    map.on('click', async (e) => {
      // Skip if user clicked a POI
      const poiHit = map!.queryRenderedFeatures(e.point, {
        layers: ['poi-clusters', 'poi-points'],
      });
      if (poiHit.length > 0) return;

      const { lng, lat } = e.lngLat;
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
          `?types=address&access_token=${PUBLIC_MAPBOX_TOKEN}`
        );
        const data = await res.json();
        const feature = data.features?.[0];
        const address = feature?.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        const ctx = feature?.context ?? [];
        const postcode = ctx.find((c: any) => c.id?.startsWith('postcode'))?.text ?? '';
        const neighbourhood =
          ctx.find((c: any) => c.id?.startsWith('neighborhood') || c.id?.startsWith('locality'))
            ?.text ?? '';

        if (marker) marker.remove();
        marker = new mapboxgl.Marker({ color: '#2563eb' }).setLngLat([lng, lat]).addTo(map!);
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
    map?.remove();
  });
</script>

<div class="map-container" bind:this={mapContainer}>
  {#if !PUBLIC_MAPBOX_TOKEN}
    <div class="map-placeholder">
      <p>Set PUBLIC_MAPBOX_TOKEN in .env to enable the map</p>
    </div>
  {/if}

  <!-- Style toggle button -->
  <button
    class="map-btn style-toggle"
    onclick={toggleStyle}
    title={isSatellite ? 'Switch to street view' : 'Switch to satellite'}
    aria-label="Toggle map style"
  >
    {#if isSatellite}
      <!-- Grid/street icon -->
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    {:else}
      <!-- Satellite icon -->
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m5 19 3.5-3.5M9 15l4-8 8-4-4 8-8 4Z"/><circle cx="13" cy="11" r="1"/>
        <path d="M19 5 9 15"/>
      </svg>
    {/if}
  </button>

  <!-- POI legend (shown when facilities layer active and POIs exist) -->
  {#if showLegend}
    <div class="poi-legend" role="complementary" aria-label="Facility categories">
      <p class="legend-title">Facilities</p>
      <div class="legend-row"><span class="dot" style="background:#ef4444"></span>Healthcare</div>
      <div class="legend-row"><span class="dot" style="background:#3b82f6"></span>Education</div>
      <div class="legend-row"><span class="dot" style="background:#22c55e"></span>Recreation</div>
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

  /* Shared map button style */
  .map-btn {
    position: absolute;
    z-index: 5;
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

  .map-btn:hover { background: #f3f4f6; }

  .style-toggle {
    bottom: 28px;
    left: 10px;
  }

  /* POI legend */
  .poi-legend {
    position: absolute;
    bottom: 72px;
    left: 10px;
    z-index: 5;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 8px;
    padding: 8px 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 130px;
  }

  .legend-title {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--color-text-muted);
    margin-bottom: 2px;
  }

  .legend-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #374151;
    font-weight: 500;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 1.5px solid rgba(255,255,255,0.8);
    box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
  }
</style>
