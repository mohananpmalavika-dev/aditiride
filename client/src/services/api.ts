const API_BASE = '/api';

export async function fetchApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorMsg = `API Error: ${response.statusText}`;
    try {
      const errData = await response.json();
      if (errData.error) errorMsg = errData.error;
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Auth
  login: (identifier: string) => fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ identifier }) }),
  loginWithCredentials: (identifier: string, password?: string) =>
    fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }),
  registerUser: (payload: any) => fetchApi('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  getUsers: () => fetchApi('/auth/users'),
  
  // Catalogue & Categories
  getCategories: () => fetchApi('/categories'),
  updateCategory: (id: string, updates: any) => fetchApi(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),

  // Location & Routes
  searchLocations: (q: string) => fetchApi(`/location/search?q=${encodeURIComponent(q)}`),
  reverseGeocode: (lat: number, lng: number) => fetchApi(`/location/reverse?lat=${lat}&lng=${lng}`),
  calculateRoute: (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }, stops: any[] = []) =>
    fetchApi('/location/route', { method: 'POST', body: JSON.stringify({ origin, destination, stops }) }),

  // Fares
  estimateFare: (payload: any) => fetchApi('/fare/estimate', { method: 'POST', body: JSON.stringify(payload) }),
  getAllEstimates: (origin: any, destination: any, driverId?: string) =>
    fetchApi('/fare/all-estimates', { method: 'POST', body: JSON.stringify({ origin, destination, driverId }) }),
  validateDriverPricing: (payload: any) => fetchApi('/fare/validate-driver-pricing', { method: 'POST', body: JSON.stringify(payload) }),

  // Matching
  getNearbyDrivers: (lat: number, lng: number, categoryId: string, passengerId?: string, preferredDriverId?: string) =>
    fetchApi(`/matching/nearby-drivers?lat=${lat}&lng=${lng}&vehicleCategoryId=${categoryId}&passengerUserId=${passengerId || 'usr_passenger'}&preferredDriverId=${preferredDriverId || ''}`),

  // Bookings
  createBooking: (payload: any, idempotencyKey: string = `book_${Date.now()}`) =>
    fetchApi('/bookings', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload)
    }),
  getRecentBookings: (passengerId?: string) => fetchApi(`/bookings/recent?passengerId=${passengerId || 'usr_passenger'}`),
  getActiveBooking: (userId: string, role: string) => fetchApi(`/bookings/active?userId=${userId}&role=${role}`),
  getBooking: (id: string) => fetchApi(`/bookings/${id}`),
  transitionBooking: (id: string, payload: any) => fetchApi(`/bookings/${id}/transition`, { method: 'POST', body: JSON.stringify(payload) }),
  rateBooking: (id: string, payload: any) => fetchApi(`/bookings/${id}/rate`, { method: 'POST', body: JSON.stringify(payload) }),

  // Voice Engine
  parseVoiceIntent: (text: string, currentLat?: number, currentLng?: number, preferredLanguage?: string) =>
    fetchApi('/voice/intent', { method: 'POST', body: JSON.stringify({ text, currentLat, currentLng, preferredLanguage }) }),

  // Favorites & Blocks
  getFavoriteDrivers: (passengerId?: string) => fetchApi(`/favorites/drivers?passengerId=${passengerId || 'usr_passenger'}`),
  addFavoriteDriver: (driverId: string, passengerId: string) =>
    fetchApi(`/favorites/drivers/${driverId}`, { method: 'POST', body: JSON.stringify({ passengerId }) }),
  removeFavoriteDriver: (driverId: string, passengerId: string) =>
    fetchApi(`/favorites/drivers/${driverId}?passengerId=${passengerId}`, { method: 'DELETE' }),
  getBlocks: (userId?: string) => fetchApi(`/blocks?userId=${userId || 'usr_passenger'}`),
  blockUser: (userId: string, payload: any) => fetchApi(`/blocks/${userId}`, { method: 'POST', body: JSON.stringify(payload) }),
  unblockUser: (userId: string, blockerUserId: string) => fetchApi(`/blocks/${userId}?blockerUserId=${blockerUserId}`, { method: 'DELETE' }),

  // Scheduled Rides
  getScheduledRides: (passengerId?: string) => fetchApi(`/scheduled-rides?passengerId=${passengerId || 'usr_passenger'}`),
  createScheduledRide: (payload: any) => fetchApi('/scheduled-rides', { method: 'POST', body: JSON.stringify(payload) }),

  // Driver
  setDriverStatus: (driverId: string, availabilityStatus: string) =>
    fetchApi('/driver/status', { method: 'PATCH', body: JSON.stringify({ driverId, availabilityStatus }) }),
  getDriverPricing: (driverId: string) => fetchApi(`/driver/pricing?driverId=${driverId}`),
  updateDriverPricing: (payload: any) => fetchApi('/driver/pricing', { method: 'PUT', body: JSON.stringify(payload) }),
  getDriverEarnings: (driverId: string) => fetchApi(`/driver/earnings?driverId=${driverId}`),

  // Wallet & Payment
  getWallet: (userId?: string) => fetchApi(`/wallet?userId=${userId || 'usr_passenger'}`),
  topUpWallet: (userId: string, amount: number) => fetchApi('/wallet/topup', { method: 'POST', body: JSON.stringify({ userId, amount }) }),
  processPayment: (payload: any, idempotencyKey: string = `pay_${Date.now()}`) =>
    fetchApi('/wallet/pay', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(payload) }),

  // Safety & SOS
  triggerSOS: (payload: any) => fetchApi('/safety/sos', { method: 'POST', body: JSON.stringify(payload) }),
  getMaskedCallSession: (bookingId: string, callerUserId: string) =>
    fetchApi('/safety/call-mask', { method: 'POST', body: JSON.stringify({ bookingId, callerUserId }) }),
  getLiveShareToken: (bookingId: string) => fetchApi(`/safety/share/${bookingId}`, { method: 'POST' }),

  // Admin
  getAdminDashboard: () => fetchApi('/admin/dashboard'),
  getAuditLogs: () => fetchApi('/admin/audit-logs'),
  getDriverDocuments: () => fetchApi('/admin/documents'),
  verifyDriverDocument: (id: string, payload: any) => fetchApi(`/admin/documents/${id}/verify`, { method: 'POST', body: JSON.stringify(payload) }),
  getFraudAnomalies: () => fetchApi('/admin/fraud'),
  getSurgeZones: () => fetchApi('/admin/surge-zones'),
  createSurgeZone: (payload: any) => fetchApi('/admin/surge-zones', { method: 'POST', body: JSON.stringify(payload) }),

  // Chat
  getChatMessages: (bookingId: string) => fetchApi(`/chat/${bookingId}`),
  sendChatMessage: (bookingId: string, payload: any) => fetchApi(`/chat/${bookingId}`, { method: 'POST', body: JSON.stringify(payload) })
};
