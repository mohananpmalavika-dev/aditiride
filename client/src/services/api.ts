const API_BASE = '/api';

let inMemoryAccessToken: string | null = sessionStorage.getItem('aditiride_access_token');
let inMemoryRefreshToken: string | null = localStorage.getItem('aditiride_refresh_token');

export function setAuthTokens(accessToken: string, refreshToken?: string) {
  inMemoryAccessToken = accessToken;
  sessionStorage.setItem('aditiride_access_token', accessToken);
  if (refreshToken) {
    inMemoryRefreshToken = refreshToken;
    localStorage.setItem('aditiride_refresh_token', refreshToken);
  }
}

export function clearAuthTokens() {
  inMemoryAccessToken = null;
  inMemoryRefreshToken = null;
  sessionStorage.removeItem('aditiride_access_token');
  localStorage.removeItem('aditiride_refresh_token');
  localStorage.removeItem('aditiride_user');
  localStorage.removeItem('aditiride_token');
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken || localStorage.getItem('aditiride_token');
}

export function getRefreshToken(): string | null {
  return inMemoryRefreshToken;
}

export async function fetchApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {})
  };

  let response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  // Automatic token refresh handling on 401 Unauthorized
  if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const refreshResp = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });

        if (refreshResp.ok) {
          const refreshData = await refreshResp.json();
          setAuthTokens(refreshData.token, refreshData.refreshToken);

          // Retry original request with newly rotated access token
          headers.Authorization = `Bearer ${refreshData.token}`;
          response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
          });
        } else {
          clearAuthTokens();
        }
      } catch {
        clearAuthTokens();
      }
    }
  }

  if (!response.ok) {
    let errorMsg = `API Error: ${response.statusText}`;
    try {
      const errData = await response.json();
      if (errData.error?.message) errorMsg = errData.error.message;
      else if (errData.error) errorMsg = errData.error;
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Auth & Session Management
  login: (identifier: string) => fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ identifier }) }),
  loginWithCredentials: async (identifier: string, password?: string) => {
    const res = await fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    });
    if (res.token) {
      setAuthTokens(res.token, res.refreshToken);
    }
    return res;
  },
  loginWithEmail: async (email: string, password?: string) => {
    const res = await fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.token) {
      setAuthTokens(res.token, res.refreshToken);
    }
    return res;
  },
  loginWithGoogle: async (payload: {
    credential?: string;
    email?: string;
    name?: string;
    googleId?: string;
    avatarUrl?: string;
    role?: string;
    preferredLanguage?: string;
  }) => {
    const res = await fetchApi('/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.token) {
      setAuthTokens(res.token, res.refreshToken);
    }
    return res;
  },
  registerUser: async (payload: any) => {
    const res = await fetchApi('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    if (res.token) {
      setAuthTokens(res.token, res.refreshToken);
    }
    return res;
  },
  registerWithEmail: async (payload: {
    name: string;
    email: string;
    password: string;
    role?: string;
    phone?: string;
    preferredLanguage?: string;
    vehicleCategoryId?: string;
    vehicleBrand?: string;
    vehicleModel?: string;
    vehiclePlate?: string;
    licenseNumber?: string;
    companyName?: string;
  }) => {
    const res = await fetchApi('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.token) {
      setAuthTokens(res.token, res.refreshToken);
    }
    return res;
  },
  registerWithGoogle: async (payload: {
    credential?: string;
    email?: string;
    name?: string;
    googleId?: string;
    avatarUrl?: string;
    role: string;
    phone?: string;
    preferredLanguage?: string;
    vehicleCategoryId?: string;
    vehicleBrand?: string;
    vehicleModel?: string;
    vehiclePlate?: string;
    companyName?: string;
  }) => {
    const res = await fetchApi('/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.token) {
      setAuthTokens(res.token, res.refreshToken);
    }
    return res;
  },
  refreshToken: (refreshToken: string) => fetchApi('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  logout: async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) {
        await fetchApi('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
      }
    } finally {
      clearAuthTokens();
    }
  },
  logoutAll: async () => {
    try {
      await fetchApi('/auth/logout-all', { method: 'POST' });
    } finally {
      clearAuthTokens();
    }
  },
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
  getNearbyDrivers: (lat: number, lng: number, categoryId: string, passengerId?: string, preferredDriverId?: string, destLat?: number, destLng?: number) =>
    fetchApi(`/matching/nearby-drivers?lat=${lat}&lng=${lng}&vehicleCategoryId=${categoryId}&passengerUserId=${passengerId || 'usr_passenger'}&preferredDriverId=${preferredDriverId || ''}${destLat !== undefined ? `&destLat=${destLat}&destLng=${destLng}` : ''}`),

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
  addFavoriteDriver: (driverId: string, passengerId?: string) =>
    fetchApi(`/favorites/drivers/${driverId}`, { method: 'POST', body: JSON.stringify({ passengerId }) }),
  removeFavoriteDriver: (driverId: string, passengerId?: string) =>
    fetchApi(`/favorites/drivers/${driverId}?passengerId=${passengerId || ''}`, { method: 'DELETE' }),
  getBlocks: (userId?: string) => fetchApi(`/blocks?userId=${userId || 'usr_passenger'}`),
  blockUser: (userId: string, payload: any) => fetchApi(`/blocks/${userId}`, { method: 'POST', body: JSON.stringify(payload) }),
  unblockUser: (userId: string, blockerUserId?: string) => fetchApi(`/blocks/${userId}?blockerUserId=${blockerUserId || ''}`, { method: 'DELETE' }),

  // Scheduled & Recurring Rides
  getScheduledRides: (passengerId?: string) => fetchApi(`/scheduled-rides?passengerId=${passengerId || 'usr_passenger'}`),
  createScheduledRide: (payload: any) => fetchApi('/scheduled-rides', { method: 'POST', body: JSON.stringify(payload) }),
  cancelScheduledRide: (id: string) => fetchApi(`/scheduled-rides/${id}/cancel`, { method: 'POST' }),
  dispatchScheduledRideNow: (id: string) => fetchApi(`/scheduled-rides/${id}/dispatch-now`, { method: 'POST' }),

  // Tour Packages & Outstation
  getTourPackages: () => fetchApi('/tour-packages'),
  bookTourPackage: (payload: any) => fetchApi('/tour-packages/book', { method: 'POST', body: JSON.stringify(payload) }),

  // Express Parcels & Local Shop Deliveries
  bookParcelDelivery: (payload: any) => fetchApi('/parcels/book', { method: 'POST', body: JSON.stringify(payload) }),
  getParcelDetails: (bookingId: string) => fetchApi(`/parcels/${bookingId}`),

  // Driver lifecycle helpers
  setDriverStatus: (driverId: string, availabilityStatus: string) =>
    fetchApi('/driver/status', { method: 'PATCH', body: JSON.stringify({ driverId, availabilityStatus }) }),
  updateDriverAvailability: (driverId: string, status: string) =>
    fetchApi('/driver/status', { method: 'PATCH', body: JSON.stringify({ driverId, availabilityStatus: status }) }),
  driverRespondBooking: (bookingId: string, driverId: string, action: 'ACCEPT' | 'REJECT', reason?: string) =>
    fetchApi(`/bookings/${bookingId}/transition`, {
      method: 'POST',
      body: JSON.stringify({
        nextStatus: action === 'ACCEPT' ? 'DRIVER_ACCEPTED' : 'CANCELLED_BY_DRIVER',
        actorUserId: driverId,
        actorRole: 'DRIVER',
        reason
      })
    }),
  driverArrived: (bookingId: string) =>
    fetchApi(`/bookings/${bookingId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ nextStatus: 'DRIVER_ARRIVED', actorRole: 'DRIVER' })
    }),
  startTripWithOTP: (bookingId: string, otp: string) =>
    fetchApi(`/bookings/${bookingId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ nextStatus: 'TRIP_STARTED', actorRole: 'DRIVER', otp })
    }),
  completeTrip: (bookingId: string, payload?: any) =>
    fetchApi(`/bookings/${bookingId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ nextStatus: 'COMPLETED', actorRole: 'DRIVER', metadata: payload })
    }),
  cancelBooking: (bookingId: string, userId: string, userRole: string, reason?: string) =>
    fetchApi(`/bookings/${bookingId}/transition`, {
      method: 'POST',
      body: JSON.stringify({
        nextStatus: userRole === 'PASSENGER' ? 'CANCELLED_BY_PASSENGER' : 'CANCELLED_BY_DRIVER',
        actorUserId: userId,
        actorRole: userRole,
        reason
      })
    }),
  getDriverPricing: (driverId: string) => fetchApi(`/driver/pricing?driverId=${driverId}`),
  updateDriverPricing: (payload: any) => fetchApi('/driver/pricing', { method: 'PUT', body: JSON.stringify(payload) }),
  getDriverEarnings: (driverId: string) => fetchApi(`/driver/earnings?driverId=${driverId}`),

  // Wallet & Payment
  getWallet: (userId?: string) => fetchApi(`/wallet?userId=${userId || 'usr_passenger'}`),
  topupWallet: (userId: string, amount: number) => fetchApi('/wallet/topup', { method: 'POST', body: JSON.stringify({ userId, amount }) }),
  topUpWallet: (userId: string, amount: number) => fetchApi('/wallet/topup', { method: 'POST', body: JSON.stringify({ userId, amount }) }),
  processPayment: (payload: any, idempotencyKey: string = `pay_${Date.now()}`) =>
    fetchApi('/wallet/pay', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(payload) }),
  createPaymentIntent: (bookingId: string, provider: string = 'RAZORPAY') =>
    fetchApi('/payments/create-intent', { method: 'POST', body: JSON.stringify({ bookingId, provider }) }),
  payWithWallet: (bookingId: string) =>
    fetchApi('/wallet/pay', { method: 'POST', body: JSON.stringify({ bookingId }) }),

  // Safety & SOS
  triggerSos: (bookingId: string, lat: number, lng: number, notes?: string) =>
    fetchApi('/safety/sos', { method: 'POST', body: JSON.stringify({ bookingId, lat, lng, notes }) }),
  triggerSOS: (payload: any) => fetchApi('/safety/sos', { method: 'POST', body: JSON.stringify(payload) }),
  getSosEvents: () => fetchApi('/sos/events'),
  resolveSos: (id: string, notes?: string) =>
    fetchApi(`/sos/${id}/resolve`, { method: 'POST', body: JSON.stringify({ notes }) }),
  getMaskedCallSession: (bookingId: string, callerUserId: string) =>
    fetchApi('/safety/call-mask', { method: 'POST', body: JSON.stringify({ bookingId, callerUserId }) }),
  getLiveShareToken: (bookingId: string) => fetchApi(`/safety/share/${bookingId}`, { method: 'POST' }),
  getLiveSharedTrip: (token: string) => fetchApi(`/bookings/public-track/${token}`),

  // Admin
  getAdminDashboard: () => fetchApi('/admin/dashboard'),
  getAuditLogs: () => fetchApi('/admin/audit-logs'),
  getDriverDocuments: () => fetchApi('/admin/documents'),
  verifyDriverDocument: (id: string, payload: any) => fetchApi(`/admin/documents/${id}/verify`, { method: 'POST', body: JSON.stringify(payload) }),
  getFraudAnomalies: () => fetchApi('/admin/fraud'),
  getSurgeZones: () => fetchApi('/admin/surge-zones'),
  createSurgeZone: (payload: any) => fetchApi('/admin/surge-zones', { method: 'POST', body: JSON.stringify(payload) }),
  getFinancialReconciliation: () => fetchApi('/admin/finance/reconciliation'),

  // Chat
  getChatHistory: (bookingId: string) => fetchApi(`/chat/${bookingId}`),
  getChatMessages: (bookingId: string) => fetchApi(`/chat/${bookingId}`),
  sendChatMessage: (bookingId: string, payload: any) => fetchApi(`/chat/${bookingId}`, { method: 'POST', body: JSON.stringify(payload) }),

  // Ratings & Complaints / Grievance Redressal
  getMyRatings: () => fetchApi('/ratings/my'),
  createComplaint: (payload: any) => fetchApi('/complaints', { method: 'POST', body: JSON.stringify(payload) }),
  getMyComplaints: () => fetchApi('/complaints/my'),
  getAdminComplaints: (params?: { status?: string; targetType?: string; severity?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.targetType) q.append('targetType', params.targetType);
    if (params?.severity) q.append('severity', params.severity);
    return fetchApi(`/admin/complaints?${q.toString()}`);
  },
  resolveComplaint: (id: string, payload: any) =>
    fetchApi(`/admin/complaints/${id}/resolve`, { method: 'PUT', body: JSON.stringify(payload) })
};
