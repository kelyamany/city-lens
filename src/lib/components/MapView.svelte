<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import mapboxgl from 'mapbox-gl';
  import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
  import { analysisRadius } from '$lib/stores/map';

  let { onPlotSelected }: { onPlotSelected: (data: any) => void } = $props();

  let mapContainer: HTMLDivElement;
  let map: mapboxgl.Map | null = $state(null);
  let marker: mapboxgl.Marker | null = null;
  let currentLng = 0;
  let currentLat = 0;

  function createCircleGeoJSON(lng: number, lat: number, radiusMeters: number) {
    const points = 64;
    const coords: [number, number][] = [];
    const earthRadius = 6371000;

    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const dx = radiusMeters * Math.cos(angle);
      const dy = radiusMeters * Math.sin(angle);
      const newLat = lat + (dy / earthRadius) * (180 / Math.PI);
      const newLng = lng + (dx / (earthRadius * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
      coords.push([newLng, newLat]);
    }

    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [coords],
      },
      properties: {},
    };
  }

  function updateCircle(lng: number, lat: number, radius: number) {
    if (!map) return;
    currentLng = lng;
    currentLat = lat;
    const geojson = createCircleGeoJSON(lng, lat, radius);
    const source = map.getSource('radius-circle') as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson as any);
    }
  }

  const unsubRadius = analysisRadius.subscribe((radius) => {
    if (currentLng && currentLat && map) {
      updateCircle(currentLng, currentLat, radius);
    }
  });

  export function flyTo(lat: number, lon: number) {
    map?.flyTo({ center: [lon, lat], zoom: 15, duration: 1500 });
  }

  onMount(() => {
    if (!PUBLIC_MAPBOX_TOKEN) {
      console.warn('Mapbox token not set.');
      return;
    }
    mapboxgl.accessToken = PUBLIC_MAPBOX_TOKEN;

    map = new mapboxgl.Map({
      container: mapContainer,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [12.5683, 55.6761],
      zoom: 12,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      map!.addSource('radius-circle', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [[]] },
          properties: {},
        },
      });

      map!.addLayer({
        id: 'radius-circle-line',
        type: 'line',
        source: 'radius-circle',
        paint: {
          'line-color': '#2563eb',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });
    });

    map.on('click', async (e) => {
      const { lng, lat } = e.lngLat;

      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=address&access_token=${PUBLIC_MAPBOX_TOKEN}`
        );
        const data = await res.json();
        const feature = data.features?.[0];

        const address = feature?.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        const context = feature?.context || [];
        const postcode = context.find((c: any) => c.id?.startsWith('postcode'))?.text || '';
        const neighbourhood = context.find((c: any) => c.id?.startsWith('neighborhood') || c.id?.startsWith('locality'))?.text || '';

        if (marker) marker.remove();
        marker = new mapboxgl.Marker({ color: '#2563eb' }).setLngLat([lng, lat]).addTo(map!);

        let currentRadius = 500;
        const unsub = analysisRadius.subscribe((r) => (currentRadius = r));
        unsub();
        updateCircle(lng, lat, currentRadius);

        onPlotSelected({
          lat,
          lon: lng,
          address,
          postnr: postcode,
          neighbourhood,
          kommunekode: '0101',
        });
      } catch (err) {
        console.error('Geocoding error:', err);
      }
    });
  });

  onDestroy(() => {
    unsubRadius();
    if (map) map.remove();
  });
</script>

<div class="map-container" bind:this={mapContainer}>
  {#if !PUBLIC_MAPBOX_TOKEN}
    <div class="map-placeholder">
      <p>Set PUBLIC_MAPBOX_TOKEN in .env to enable the map</p>
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
    color: #6B7280;
    font-size: 14px;
  }
</style>
