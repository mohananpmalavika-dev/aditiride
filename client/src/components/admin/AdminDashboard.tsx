import React, { useState, useEffect } from 'react';
import { User, LanguageCode, VehicleCategory } from '../../types/index.js';
import { api } from '../../services/api.js';
import { OpenStreetMap } from '../common/OpenStreetMap.js';
import {
  Shield,
  Activity,
  DollarSign,
  Users,
  AlertTriangle,
  FileCheck,
  CheckCircle,
  XCircle,
  Sliders,
  MapPin,
  Clock,
  Car,
  Search,
  Zap,
  Lock,
  Layers
} from 'lucide-react';

interface AdminDashboardProps {
  currentUser: User;
  language: LanguageCode;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, language }) => {
  const [activeTab, setActiveTab] = useState<'OPERATIONS' | 'PRICING' | 'DOCUMENTS' | 'BLOCKS' | 'FRAUD' | 'AUDIT'>('OPERATIONS');

  const [metrics, setMetrics] = useState<any>({
    totalBookings: 0,
    activeTrips: 0,
    completedTrips: 0,
    onlineDrivers: 0,
    grossMerchandiseValue: 0,
    platformCommission: 0,
    activeSOSAlerts: 0,
    pendingDocumentReviews: 0
  });

  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [surgeZones, setSurgeZones] = useState<any[]>([]);

  // Editing Category state
  const [editingCategory, setEditingCategory] = useState<VehicleCategory | null>(null);

  const loadAdminData = async () => {
    try {
      const dashRes = await api.getAdminDashboard();
      setMetrics(dashRes.metrics);

      const catRes = await api.getCategories();
      setCategories(catRes.categories || []);

      const docRes = await api.getDriverDocuments();
      setDocuments(docRes.documents || []);

      const auditRes = await api.getAuditLogs();
      setAuditLogs(auditRes.logs || []);

      const fraudRes = await api.getFraudAnomalies();
      setAnomalies(fraudRes.anomalies || []);

      const surgeRes = await api.getSurgeZones();
      setSurgeZones(surgeRes.zones || []);
    } catch (err) {
      console.error('Error loading admin data:', err);
    }
  };

  useEffect(() => {
    loadAdminData();
    const interval = setInterval(loadAdminData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleVerifyDoc = async (docId: string, status: 'VERIFIED' | 'REJECTED') => {
    try {
      await api.verifyDriverDocument(docId, {
        adminUserId: currentUser.id,
        status,
        rejectionReason: status === 'REJECTED' ? 'Document expired or illegible scan' : undefined
      });
      loadAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveCategoryPricing = async (cat: VehicleCategory) => {
    try {
      await api.updateCategory(cat.id, {
        base_fare: cat.base_fare,
        per_km_rate: cat.per_km_rate,
        minimum_fare: cat.minimum_fare,
        max_deviation_percent: cat.max_deviation_percent,
        driver_custom_fare_allowed: cat.driver_custom_fare_allowed ? 1 : 0
      });
      alert(`Category ${cat.name} pricing updated successfully!`);
      setEditingCategory(null);
      loadAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 space-y-6">
      
      {/* Admin Header */}
      <div className="p-6 bg-slate-900 text-white rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-500 to-emerald-400 flex items-center justify-center text-white shadow-lg">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-extrabold">AditiRide Admin Control Center</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold border border-emerald-500/30">
                LIVE PRODUCTION
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Super Admin: {currentUser.name} • Full Marketplace Governance & Control
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-800 rounded-2xl border border-slate-700">
          {[
            { id: 'OPERATIONS', label: 'Live Ops', icon: Activity },
            { id: 'PRICING', label: 'Pricing & Categories', icon: Sliders },
            { id: 'DOCUMENTS', label: `KYC (${documents.filter(d => d.verification_status === 'PENDING').length})`, icon: FileCheck },
            { id: 'FRAUD', label: `Risk (${anomalies.length})`, icon: AlertTriangle },
            { id: 'AUDIT', label: 'Audit Trail', icon: Layers }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Bookings (GMV)</p>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">₹{metrics.grossMerchandiseValue}</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Platform Commission</p>
          <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">₹{metrics.platformCommission}</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active In-Trip</p>
          <p className="text-xl font-extrabold text-brand-600 dark:text-brand-400 mt-1">{metrics.activeTrips}</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Online Captains</p>
          <p className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">{metrics.onlineDrivers}</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completed Rides</p>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{metrics.completedTrips}</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active SOS Alerts</p>
          <p className="text-xl font-extrabold text-rose-600 mt-1">{metrics.activeSOSAlerts}</p>
        </div>
      </div>

      {/* Tab 1: Live Operations Room */}
      {activeTab === 'OPERATIONS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-[520px] rounded-3xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 relative">
            <OpenStreetMap center={{ lat: 10.5276, lng: 76.2144 }} className="w-full h-full" />
          </div>

          <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Active Geofences & Surge Multipliers</h3>
            <div className="space-y-3">
              {surgeZones.map(z => (
                <div key={z.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-900 dark:text-white truncate">{z.name}</span>
                    <span className="text-amber-600 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-md font-extrabold">
                      {z.surge_multiplier}x Surge
                    </span>
                  </div>
                  <p className="text-slate-500">{z.city} • Radius {z.radius_meters}m</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Pricing & Vehicle Category Management */}
      {activeTab === 'PRICING' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Vehicle Categories & Fare Policies</h3>
              <p className="text-xs text-slate-500">Configure base rates, per-km rates, and driver custom fare deviation bounds.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(cat => (
              <div key={cat.id} className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{cat.display_name}</h4>
                  <span className="text-xs font-mono font-bold text-brand-600">{cat.code}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase">Base Fare</label>
                    <input
                      type="number"
                      value={cat.base_fare}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setCategories(categories.map(c => c.id === cat.id ? { ...c, base_fare: val } : c));
                      }}
                      className="w-full mt-0.5 p-2 bg-white dark:bg-slate-900 rounded-xl border font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase">Per KM Rate</label>
                    <input
                      type="number"
                      value={cat.per_km_rate}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setCategories(categories.map(c => c.id === cat.id ? { ...c, per_km_rate: val } : c));
                      }}
                      className="w-full mt-0.5 p-2 bg-white dark:bg-slate-900 rounded-xl border font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase">Min Fare</label>
                    <input
                      type="number"
                      value={cat.minimum_fare}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setCategories(categories.map(c => c.id === cat.id ? { ...c, minimum_fare: val } : c));
                      }}
                      className="w-full mt-0.5 p-2 bg-white dark:bg-slate-900 rounded-xl border font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase">Max Driver Dev (%)</label>
                    <input
                      type="number"
                      value={cat.max_deviation_percent}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setCategories(categories.map(c => c.id === cat.id ? { ...c, max_deviation_percent: val } : c));
                      }}
                      className="w-full mt-0.5 p-2 bg-white dark:bg-slate-900 rounded-xl border font-bold text-xs"
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleSaveCategoryPricing(cat)}
                  className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs shadow-sm transition-colors"
                >
                  Save Category Parameters
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Driver KYC Document Review Queue */}
      {activeTab === 'DOCUMENTS' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Driver KYC Verification Queue</h3>
          
          <div className="space-y-3">
            {documents.map(doc => (
              <div key={doc.id} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl flex items-center justify-between text-xs border border-slate-200/70 dark:border-slate-700/70">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-slate-900 dark:text-white text-sm">{doc.driver_name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                      {doc.doc_type}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      doc.verification_status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {doc.verification_status}
                    </span>
                  </div>
                  <p className="text-slate-500 font-mono mt-0.5">Doc #: {doc.doc_number} • Expiry: {doc.expiry_date}</p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleVerifyDoc(doc.id, 'VERIFIED')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center space-x-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>

                  <button
                    onClick={() => handleVerifyDoc(doc.id, 'REJECTED')}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center space-x-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Fraud & Risk Monitor */}
      {activeTab === 'FRAUD' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Fraud & Risk Anomaly Engine</h3>
          
          {anomalies.length === 0 ? (
            <p className="text-xs text-slate-400">No active anomalies detected across the platform.</p>
          ) : (
            <div className="space-y-3">
              {anomalies.map(anom => (
                <div key={anom.id} className="p-4 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-rose-700 dark:text-rose-400">{anom.type}</span>
                    <span className="px-2 py-0.5 bg-rose-600 text-white rounded-full text-[10px] font-bold">
                      {anom.severity} RISK
                    </span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 font-medium">{anom.details}</p>
                  <p className="text-[11px] text-slate-500">Action: {anom.recommendedAction}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Immutable Audit Logs */}
      {activeTab === 'AUDIT' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Immutable Platform Audit Logs</h3>
          
          <div className="space-y-2">
            {auditLogs.map(log => (
              <div key={log.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs flex items-center justify-between font-mono">
                <div>
                  <span className="font-bold text-brand-600">{log.action}</span>
                  <span className="text-slate-500 ml-2">by {log.actor_role} ({log.actor_user_id})</span>
                </div>
                <span className="text-slate-400 text-[10px]">{log.created_at}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
