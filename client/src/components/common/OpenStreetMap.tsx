import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MatchedDriver } from '../../types/index.js';

interface OpenStreetMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  pickup?: { lat: number; lng: number; address?: string };
  destination?: { lat: number; lng: number; address?: string };
  stops?: { lat: number; lng: number; address?: string }[];
  routePolyline?: [number, number][];
  drivers?: MatchedDriver[];
  activeDriver?: { lat: number; lng: number; heading?: number; name?: string; vehicleType?: string };
  className?: string;
  onMapClick?: (lat: number, lng: number) => void;
}

export const OpenStreetMap: React.FC<OpenStreetMapProps> = ({
  center,
  zoom = 14,
  pickup,
  destination,
  stops = [],
  routePolyline = [],
  drivers = [],
  activeDriver,
  className = 'w-full h-full min-h-[420px] rounded-3xl',
  onMapClick
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const polylineLayerRef = useRef<L.Polyline | null>(null);

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
      attributionControl: true
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // High-Speed, Crisp CartoDB Voyager Tile Layer (Optimized for Ride-Hailing & Navigation)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;
    mapInstanceRef.current = map;

    if (onMapClick) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    // Force tile rendering recalculation on mount
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 300);
    const t3 = setTimeout(() => map.invalidateSize(), 800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Invalidate on any prop or container change
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
    }
  });

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

    // 1. Pickup Marker
    if (pickup && pickup.lat && pickup.lng) {
      const pickupIcon = createCustomIcon(`
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px;">
          <div style="position: absolute; width: 38px; height: 38px; border-radius: 9999px; background-color: #10b981; opacity: 0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 34px; height: 34px; border-radius: 9999px; background-color: #059669; border: 2px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; font-weight: bold;">
            📍
          </div>
        </div>
      `);
      const m = L.marker([pickup.lat, pickup.lng], { icon: pickupIcon }).bindPopup(`<b>Pickup Location:</b><br/>${pickup.address || 'Pickup Point'}`);
      group.addLayer(m);
      boundsPoints.push([pickup.lat, pickup.lng]);
    }

    // 2. Intermediate Stops
    stops.forEach((stop, i) => {
      if (stop.lat && stop.lng) {
        const stopIcon = createCustomIcon(`
          <div style="width: 28px; height: 28px; border-radius: 9999px; background-color: #f59e0b; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">
            ${i + 1}
          </div>
        `, [28, 28]);
        const m = L.marker([stop.lat, stop.lng], { icon: stopIcon }).bindPopup(`<b>Stop ${i + 1}:</b><br/>${stop.address || 'Stop'}`);
        group.addLayer(m);
        boundsPoints.push([stop.lat, stop.lng]);
      }
    });

    // 3. Destination Marker
    if (destination && destination.lat && destination.lng) {
      const destIcon = createCustomIcon(`
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px;">
          <div style="position: relative; width: 34px; height: 34px; border-radius: 9999px; background-color: #e11d48; border: 2px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; font-weight: bold;">
            🏁
          </div>
        </div>
      `);
      const m = L.marker([destination.lat, destination.lng], { icon: destIcon }).bindPopup(`<b>Destination:</b><br/>${destination.address || 'Destination'}`);
      group.addLayer(m);
      boundsPoints.push([destination.lat, destination.lng]);
    }

    // 4. Active Tracking Driver Marker
    if (activeDriver && activeDriver.lat && activeDriver.lng) {
      const driverIcon = createCustomIcon(`
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; transform: rotate(${activeDriver.heading || 0}deg); transition: transform 0.3s ease;">
          <div style="width: 40px; height: 40px; border-radius: 12px; background-color: #16a34a; border: 2.5px solid white; box-shadow: 0 6px 16px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 22px;">
            🚕
          </div>
        </div>
      `, [44, 44]);
      const m = L.marker([activeDriver.lat, activeDriver.lng], { icon: driverIcon }).bindPopup(`<b>${activeDriver.name || 'Captain'}</b>`);
      group.addLayer(m);
      boundsPoints.push([activeDriver.lat, activeDriver.lng]);
    } else if (drivers && drivers.length > 0) {
      // 5. Nearby Drivers Markers
      drivers.forEach(d => {
        const vehicleEmoji = d.vehicleCategoryId === 'cat_bike' ? '🏍️' : d.vehicleCategoryId === 'cat_auto' ? '🛺' : '🚗';
        const dIcon = createCustomIcon(`
          <div style="width: 32px; height: 32px; border-radius: 9999px; background-color: #0f172a; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; font-size: 15px; cursor: pointer;">
            ${vehicleEmoji}
          </div>
        `, [32, 32]);
        const m = L.marker([d.currentLat, d.currentLng], { icon: dIcon }).bindPopup(`<b>${d.name}</b><br/>⭐ ${d.ratingAvg} • ${d.vehicleBrand} ${d.vehicleModel}`);
        group.addLayer(m);
      });
    }

    // 6. Draw Polyline Route
    if (polylineLayerRef.current) {
      polylineLayerRef.current.remove();
      polylineLayerRef.current = null;
    }

    if (routePolyline && routePolyline.length > 0) {
      const poly = L.polyline(routePolyline, {
        color: '#16a34a',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      polylineLayerRef.current = poly;
    }

    // Auto-fit bounds
    if (boundsPoints.length >= 2) {
      map.fitBounds(boundsPoints, { padding: [50, 50], maxZoom: 16 });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], zoom);
    }

    map.invalidateSize();
  }, [pickup, destination, stops, routePolyline, drivers, activeDriver]);

  return (
    <div className="relative w-full h-full min-h-[420px] overflow-hidden" style={{ minHeight: '420px' }}>
      <div
        ref={mapContainerRef}
        className={className}
        style={{ width: '100%', height: '100%', minHeight: '420px', backgroundColor: '#0f172a' }}
      />
    </div>
  );
};
