export interface GeoPoint {
  lat: number;
  lng: number;
  address?: string;
}

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  polyline: [number, number][];
  summary: string;
}

export interface GeocodedLocation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: 'LANDMARK' | 'AIRPORT' | 'STATION' | 'MALL' | 'HOSPITAL' | 'RESIDENTIAL' | 'WORK';
}

export const PRELOADED_LANDMARKS: GeocodedLocation[] = [
  {
    id: 'loc_swaraj',
    name: 'Swaraj Round',
    address: 'Swaraj Round, Thrissur, Kerala 680001',
    lat: 10.5276,
    lng: 76.2144,
    type: 'LANDMARK'
  },
  {
    id: 'loc_lulu_tcr',
    name: 'Lulu International Shopping Mall Thrissur',
    address: 'NH 544, Puzhakkal, Thrissur, Kerala 680553',
    lat: 10.5360,
    lng: 76.2220,
    type: 'MALL'
  },
  {
    id: 'loc_railway_tcr',
    name: 'Thrissur Central Railway Station',
    address: 'Station Road, Kokkala, Thrissur, Kerala 680021',
    lat: 10.5186,
    lng: 76.2085,
    type: 'STATION'
  },
  {
    id: 'loc_ksrtc_tcr',
    name: 'KSRTC Central Bus Stand Thrissur',
    address: 'Near Railway Station, Thrissur, Kerala 680021',
    lat: 10.5195,
    lng: 76.2112,
    type: 'STATION'
  },
  {
    id: 'loc_cochin_airport',
    name: 'Cochin International Airport (COK)',
    address: 'Airport Rd, Nedumbassery, Kochi, Kerala 683111',
    lat: 10.1518,
    lng: 76.3930,
    type: 'AIRPORT'
  },
  {
    id: 'loc_infopark_kochi',
    name: 'Infopark Phase 1 & 2',
    address: 'Infopark Expressway, Kakkanad, Kochi, Kerala 682042',
    lat: 10.0125,
    lng: 76.3620,
    type: 'WORK'
  },
  {
    id: 'loc_marine_drive_kochi',
    name: 'Marine Drive Promenade',
    address: 'Shanmugham Rd, Marine Drive, Kochi, Kerala 682031',
    lat: 9.9816,
    lng: 76.2750,
    type: 'LANDMARK'
  },
  {
    id: 'loc_amrita_hospital',
    name: 'Amrita Hospital & Institute of Medical Sciences',
    address: 'Ponekkara, Edappally, Kochi, Kerala 682041',
    lat: 10.0322,
    lng: 76.2890,
    type: 'HOSPITAL'
  },
  {
    id: 'loc_technopark_tvm',
    name: 'Technopark Campus Phase 1 & 3',
    address: 'Technopark Rd, Kazhakkoottam, Thiruvananthapuram, Kerala 695581',
    lat: 8.5566,
    lng: 76.8820,
    type: 'WORK'
  },
  {
    id: 'loc_tvm_airport',
    name: 'Trivandrum International Airport (TRV)',
    address: 'Airport Rd, Chacka, Thiruvananthapuram, Kerala 695008',
    lat: 8.4821,
    lng: 76.9200,
    type: 'AIRPORT'
  },
  {
    id: 'loc_home_demo',
    name: 'Home (Sobha City / Ayyanthole)',
    address: 'Flat 4B, Jade Tower, Sobha City, Puzhakkal, Thrissur',
    lat: 10.5410,
    lng: 76.1950,
    type: 'RESIDENTIAL'
  },
  {
    id: 'loc_office_demo',
    name: 'Work (Tech Hub Ayyanthole)',
    address: 'Civil Station Main Gate, Ayyanthole, Thrissur 680003',
    lat: 10.5310,
    lng: 76.1990,
    type: 'WORK'
  }
];

export class LocationService {
  /**
   * Search address / landmark autocomplete (Async with Nominatim + Local fallback)
   */
  public static async searchLocations(queryStr: string): Promise<GeocodedLocation[]> {
    if (!queryStr || queryStr.trim().length === 0) {
      return PRELOADED_LANDMARKS.slice(0, 5);
    }

    const q = queryStr.toLowerCase().trim();
    const localMatches = PRELOADED_LANDMARKS.filter(
      loc => loc.name.toLowerCase().includes(q) || loc.address.toLowerCase().includes(q)
    );

    if (localMatches.length > 0) return localMatches;

    // Query OpenStreetMap Nominatim for real Indian / Kerala locations
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}&countrycodes=in&limit=6`,
        { headers: { 'User-Agent': 'AditiRide-App/1.0' } }
      );
      if (resp.ok) {
        const data: any = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((item: any) => ({
            id: `nom_${item.place_id}`,
            name: item.display_name.split(',')[0],
            address: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            type: 'LANDMARK' as const
          }));
        }
      }
    } catch {}

    return this.searchLocationsSync(queryStr);
  }

  public static searchLocationsSync(queryStr: string): GeocodedLocation[] {
    if (!queryStr || queryStr.trim().length === 0) {
      return PRELOADED_LANDMARKS.slice(0, 5);
    }
    const q = queryStr.toLowerCase().trim();
    const localMatches = PRELOADED_LANDMARKS.filter(
      loc => loc.name.toLowerCase().includes(q) || loc.address.toLowerCase().includes(q)
    );
    if (localMatches.length > 0) return localMatches;

    return [
      {
        id: `dyn_${Date.now()}`,
        name: queryStr,
        address: `${queryStr}, Kerala`,
        lat: 10.5276 + (Math.random() - 0.5) * 0.04,
        lng: 76.2144 + (Math.random() - 0.5) * 0.04,
        type: 'LANDMARK'
      }
    ];
  }

  /**
   * Reverse geocode coordinates to friendly street address
   */
  public static async reverseGeocode(lat: number, lng: number): Promise<string> {
    let closest = PRELOADED_LANDMARKS[0];
    let minDistance = Infinity;

    for (const loc of PRELOADED_LANDMARKS) {
      const dist = this.haversine(lat, lng, loc.lat, loc.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closest = loc;
      }
    }

    if (minDistance < 0.25) {
      return closest.name + ' (' + closest.address + ')';
    }

    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'User-Agent': 'AditiRide-App/1.0' } }
      );
      if (resp.ok) {
        const data: any = await resp.json();
        if (data && data.display_name) {
          const parts = data.display_name.split(',');
          return parts.slice(0, 3).join(',').trim();
        }
      }
    } catch {}

    return this.reverseGeocodeSync(lat, lng);
  }

  public static reverseGeocodeSync(lat: number, lng: number): string {
    let closest = PRELOADED_LANDMARKS[0];
    let minDistance = Infinity;

    for (const loc of PRELOADED_LANDMARKS) {
      const dist = this.haversine(lat, lng, loc.lat, loc.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closest = loc;
      }
    }

    if (minDistance < 0.8) {
      return closest.name + ' (' + closest.address + ')';
    }

    return `Near (${lat.toFixed(4)}, ${lng.toFixed(4)}), Kerala`;
  }

  /**
   * Calculate turn-by-turn road route distance, duration and geometry via OSRM
   */
  public static async calculateRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    stops: { lat: number; lng: number }[] = []
  ): Promise<RouteResult> {
    const waypoints = [origin, ...stops, destination];
    const waypointsStr = waypoints.map(w => `${w.lng},${w.lat}`).join(';');

    try {
      const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${waypointsStr}?overview=full&geometries=geojson`;
      const resp = await fetch(osrmUrl);
      
      if (resp.ok) {
        const data: any = await resp.json();
        if (data && data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const primaryRoute = data.routes[0];
          const distKm = Math.round((primaryRoute.distance / 1000) * 10) / 10;
          const durMin = Math.max(3, Math.round(primaryRoute.duration / 60));
          
          // Map OSRM GeoJSON [lng, lat] to Leaflet [lat, lng]
          const leafletPolyline: [number, number][] = primaryRoute.geometry.coordinates.map(
            (coord: [number, number]) => [coord[1], coord[0]]
          );

          return {
            distanceKm: distKm,
            durationMin: durMin,
            polyline: leafletPolyline,
            summary: `${distKm} km • ${durMin} mins`
          };
        }
      }
    } catch (err) {
      console.warn('OSRM routing fetch failed, using fallback interpolation:', err);
    }

    return this.calculateRouteSync(origin, destination, stops);
  }

  public static calculateRouteSync(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    stops: { lat: number; lng: number }[] = []
  ): RouteResult {
    const waypoints = [origin, ...stops, destination];
    let totalDistKm = 0;
    const polyline: [number, number][] = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];
      const legDist = this.haversine(p1.lat, p1.lng, p2.lat, p2.lng);
      const roadDist = legDist * 1.28;
      totalDistKm += roadDist;

      const steps = Math.max(16, Math.floor(roadDist * 6));
      for (let s = 0; s <= steps; s++) {
        const ratio = s / steps;
        const lat = p1.lat + (p2.lat - p1.lat) * ratio;
        const lng = p1.lng + (p2.lng - p1.lng) * ratio;
        polyline.push([lat, lng]);
      }
    }

    totalDistKm = Math.round(totalDistKm * 10) / 10;
    if (totalDistKm < 1.0) totalDistKm = 1.2;
    const durationMin = Math.max(4, Math.round((totalDistKm / 24) * 60));

    return {
      distanceKm: totalDistKm,
      durationMin,
      polyline,
      summary: `${totalDistKm} km • ${durationMin} mins`
    };
  }

  public static haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
