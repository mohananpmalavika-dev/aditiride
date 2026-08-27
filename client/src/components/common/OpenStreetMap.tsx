import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MatchedDriver } from '../../types/index.js';
import { Layers } from 'lucide-react';

interface OpenStreetMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  pickup?: { lat: number; lng: number; address?: string };
  destination?: { lat: number; lng: number; address?: string };
  stops?: { lat: number; lng: number; address?: string }[];
  routePolyline?: [number, number][];
  drivers?: MatchedDriver[];
  activeDriver?: { lat: number; lng: number; heading?: number; name?: string; vehicleType?: string };
  passengerLiveLocation?: { lat: number; lng: number; heading?: number; name?: string };
  className?: string;
  onMapClick?: (lat: number, lng: number) => void;
}

type MapProviderKey = 'STREETS' | 'VOYAGER' | 'OSM' | 'SATELLITE';

const MAP_PROVIDERS: Record<MapProviderKey, { name: string; url: string; subdomains?: string; maxZoom: number; attribution: string }> = {
  STREETS: {
    name: 'Streets',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri'
  },
  VOYAGER: {
    name: 'Navigation',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: '&copy; CARTO &copy; OpenStreetMap'
  },
  OSM: {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  },
  SATELLITE: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar'
  }
};

export const OpenStreetMap: React.FC<OpenStreetMapProps> = ({
  center,
  zoom = 14,
  pickup,
  destination,
  stops = [],
  routePolyline = [],
  drivers = [],
  activeDriver,
  passengerLiveLocation,
  className = 'w-full h-full min-h-[420px] rounded-3xl',
  onMapClick
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const polylineLayerRef = useRef<L.Polyline | null>(null);

  // Keep latest onMapClick in ref to avoid stale closures
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  const [selectedProvider, setSelectedProvider] = useState<MapProviderKey>('STREETS');
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = center?.lat || 10.5276;
    const initialLng = center?.lng || 76.2144;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: zoom,
      zoomControl: false,
      attributionControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial Tile Layer
    const provider = MAP_PROVIDERS[selectedProvider];
    const tileLayer = L.tileLayer(provider.url, {
      subdomains: provider.subdomains || 'abc',
      maxZoom: provider.maxZoom,
      crossOrigin: true
    }).addTo(map);

    currentTileLayerRef.current = tileLayer;

    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;
    mapInstanceRef.current = map;

    // Direct Map Click Handler delegating to onMapClickRef
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClickRef.current) {
        onMapClickRef.current(e.latlng.lat, e.latlng.lng);
      }
    });

    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer when selectedProvider changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }

    const provider = MAP_PROVIDERS[selectedProvider];
    const newLayer = L.tileLayer(provider.url, {
      subdomains: provider.subdomains || 'abc',
      maxZoom: provider.maxZoom,
      crossOrigin: true
    }).addTo(map);

    currentTileLayerRef.current = newLayer;
    newLayer.bringToBack();
    map.invalidateSize();
  }, [selectedProvider]);

  // Update Markers & Polylines
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const boundsPoints: [number, number][] = [];

    const createCustomIcon = (html: string, iconSize: [number, number] = [38, 38]) => {
      return L.divIcon({
        html,
        className: 'leaflet-custom-marker',
        iconSize,
        iconAnchor: [iconSize[0] / 2, iconSize[1] / 2]
      });
    };

    // 1. Pickup Marker (Green Pin)
    if (pickup && pickup.lat && pickup.lng) {
      const pickupIcon = createCustomIcon(`
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;">
          <div style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background-color: #10b981; opacity: 0.35; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 36px; height: 36px; border-radius: 9999px; background-color: #059669; border: 3px solid white; box-shadow: 0 4px 16px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; font-weight: bold;">
            📍
          </div>
          <span style="margin-top: 2px; font-size: 10px; font-weight: 800; color: #ffffff; background-color: #064e3b; padding: 1px 6px; border-radius: 6px; border: 1px solid #059669; box-shadow: 0 2px 6px rgba(0,0,0,0.3); white-space: nowrap;">
            PICKUP
          </span>
        </div>
      `, [44, 56]);
      const m = L.marker([pickup.lat, pickup.lng], { icon: pickupIcon })
        .bindPopup(`<b>📍 Pickup Point:</b><br/>${pickup.address || 'Pickup Point'}`)
        .addTo(group);
      boundsPoints.push([pickup.lat, pickup.lng]);
    }

    // 2. Intermediate Stops
    stops.forEach((stop, i) => {
      if (stop.lat && stop.lng) {
        const stopIcon = createCustomIcon(`
          <div style="width: 30px; height: 30px; border-radius: 9999px; background-color: #d97706; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 13px; font-weight: bold;">
            ${i + 1}
          </div>
        `, [30, 30]);
        const m = L.marker([stop.lat, stop.lng], { icon: stopIcon })
          .bindPopup(`<b>Stop ${i + 1}:</b><br/>${stop.address || 'Stop'}`)
          .addTo(group);
        boundsPoints.push([stop.lat, stop.lng]);
      }
    });

    // 3. Destination Marker (Red Flag Pin)
    if (destination && destination.lat && destination.lng) {
      const destIcon = createCustomIcon(`
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;">
          <div style="position: relative; width: 36px; height: 36px; border-radius: 9999px; background-color: #e11d48; border: 3px solid white; box-shadow: 0 4px 16px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; font-weight: bold;">
            🏁
          </div>
          <span style="margin-top: 2px; font-size: 10px; font-weight: 800; color: #ffffff; background-color: #881337; padding: 1px 6px; border-radius: 6px; border: 1px solid #e11d48; box-shadow: 0 2px 6px rgba(0,0,0,0.3); white-space: nowrap;">
            DESTINATION
          </span>
        </div>
      `, [44, 56]);
      const m = L.marker([destination.lat, destination.lng], { icon: destIcon })
        .bindPopup(`<b>🏁 Destination:</b><br/>${destination.address || 'Destination'}`)
        .addTo(group);
      boundsPoints.push([destination.lat, destination.lng]);
    }

    // 4. Active Tracking Driver Marker
    if (activeDriver && activeDriver.lat && activeDriver.lng) {
      const driverIcon = createCustomIcon(`
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; transform: rotate(${activeDriver.heading || 0}deg); transition: transform 0.3s ease;">
          <div style="width: 40px; height: 40px; border-radius: 14px; background-color: #16a34a; border: 2.5px solid white; box-shadow: 0 6px 16px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 22px;">
            🚕
          </div>
        </div>
      `, [44, 44]);
      const m = L.marker([activeDriver.lat, activeDriver.lng], { icon: driverIcon })
        .bindPopup(`<b>${activeDriver.name || 'Captain'}</b>`)
        .addTo(group);
      boundsPoints.push([activeDriver.lat, activeDriver.lng]);
    }

    // 5. Passenger Live Real-Time Location Marker (Mutual Sharing)
    if (passengerLiveLocation && passengerLiveLocation.lat && passengerLiveLocation.lng) {
      const passengerIcon = createCustomIcon(`
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;">
          <div style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background-color: #3b82f6; opacity: 0.4; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 36px; height: 36px; border-radius: 9999px; background-color: #2563eb; border: 3px solid white; box-shadow: 0 4px 16px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;">
            🚶
          </div>
          <span style="margin-top: 2px; font-size: 10px; font-weight: 800; color: #ffffff; background-color: #1e3a8a; padding: 1px 6px; border-radius: 6px; border: 1px solid #3b82f6; box-shadow: 0 2px 6px rgba(0,0,0,0.3); white-space: nowrap;">
            ${passengerLiveLocation.name ? passengerLiveLocation.name.split(' ')[0] : 'Passenger'} Live
          </span>
        </div>
      `, [44, 56]);
      L.marker([passengerLiveLocation.lat, passengerLiveLocation.lng], { icon: passengerIcon })
        .bindPopup(`<b>🚶 ${passengerLiveLocation.name || 'Passenger'} Live Location</b>`)
        .addTo(group);
      boundsPoints.push([passengerLiveLocation.lat, passengerLiveLocation.lng]);
    } else if (drivers && drivers.length > 0 && !activeDriver) {
      // 6. Nearby Drivers Markers
      drivers.forEach(d => {
        const vehicleEmoji = d.vehicleCategoryId === 'cat_bike' ? '🏍️' : d.vehicleCategoryId === 'cat_auto' ? '🛺' : '🚗';
        const dIcon = createCustomIcon(`
          <div style="width: 32px; height: 32px; border-radius: 9999px; background-color: #0f172a; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; font-size: 15px; cursor: pointer;">
            ${vehicleEmoji}
          </div>
        `, [32, 32]);
        L.marker([d.currentLat, d.currentLng], { icon: dIcon })
          .bindPopup(`<b>${d.name}</b><br/>⭐ ${d.ratingAvg} • ${d.vehicleBrand} ${d.vehicleModel}`)
          .addTo(group);
      });
    }

    // 6. Draw Real-Road Polyline Route
    if (polylineLayerRef.current) {
      polylineLayerRef.current.remove();
      polylineLayerRef.current = null;
    }

    if (routePolyline && routePolyline.length > 0) {
      const poly = L.polyline(routePolyline, {
        color: '#16a34a',
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      polylineLayerRef.current = poly;
    }

    // Auto-fit bounds
    if (boundsPoints.length >= 2) {
      map.fitBounds(boundsPoints, { padding: [60, 60], maxZoom: 16 });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], zoom);
    }

    map.invalidateSize();
  }, [pickup, destination, stops, routePolyline, drivers, activeDriver]);

  return (
    <div className="relative w-full h-full min-h-[420px] overflow-hidden" style={{ minHeight: '420px' }}>
      
      {/* Map Style Switcher Floating Pill */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col items-end space-y-1">
        <button
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          className="p-2.5 bg-slate-900/90 hover:bg-slate-800 text-white rounded-2xl shadow-xl border border-slate-700 backdrop-blur-md transition-all flex items-center space-x-1.5 text-xs font-bold"
          title="Change Map Style"
        >
          <Layers className="w-4 h-4 text-brand-400" />
          <span className="hidden sm:inline-block">{MAP_PROVIDERS[selectedProvider].name}</span>
        </button>

        {showLayerMenu && (
          <div className="p-1.5 bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700 flex flex-col space-y-1 z-50 animate-in fade-in slide-in-from-top-2">
            {(Object.keys(MAP_PROVIDERS) as MapProviderKey[]).map(key => (
              <button
                key={key}
                onClick={() => {
                  setSelectedProvider(key);
                  setShowLayerMenu(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-left text-xs font-bold transition-all ${
                  selectedProvider === key
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {MAP_PROVIDERS[key].name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Leaflet DOM Container */}
      <div
        ref={mapContainerRef}
        className={className}
        style={{ width: '100%', height: '100%', minHeight: '420px', backgroundColor: '#e2e8f0' }}
      />
    </div>
  );
};
