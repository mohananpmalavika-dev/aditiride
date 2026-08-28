import React, { useState, useEffect } from 'react';
import { User, LanguageCode, VehicleCategory } from '../../types/index.js';
import { api } from '../../services/api.js';
import { OpenStreetMap } from '../common/OpenStreetMap.js';
import { AdminAuditAndComplianceModal } from './AdminAuditAndComplianceModal.js';
import { LostAndFoundModal } from '../common/LostAndFoundModal.js';
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
  Layers,
  ShieldAlert,
  PackageSearch,
  ShieldCheck
} from 'lucide-react';

interface AdminDashboardProps {
  currentUser: User;
  language: LanguageCode;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, language }) => {
  const [activeTab, setActiveTab] = useState<'OPERATIONS' | 'PRICING' | 'DOCUMENTS' | 'COMPLAINTS' | 'FRAUD' | 'AUDIT'>('OPERATIONS');

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
  const [complaints, setComplaints] = useState<any[]>([]);

  // Complaints Resolution State
  const [selectedComplaint, setSelectedComplaint] = useState<any | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<'RESOLVED' | 'UNDER_REVIEW' | 'REJECTED'>('RESOLVED');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionAction, setResolutionAction] = useState<'NONE' | 'REFUND_WALLET' | 'SUSPEND_DRIVER' | 'WARN_USER'>('NONE');
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [isResolving, setIsResolving] = useState(false);

  // Editing Category state
  const [editingCategory, setEditingCategory] = useState<VehicleCategory | null>(null);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [showLostAndFoundModal, setShowLostAndFoundModal] = useState(false);

  const loadAdminData = async () => {
    try {
      const [dashRes, catRes, docRes, auditRes, fraudRes, surgeRes, compRes] = await Promise.all([
        api.getAdminDashboard(),
        api.getCategories(),
        api.getDriverDocuments(),
        api.getAuditLogs(),
        api.getFraudAnomalies(),
        api.getSurgeZones(),
        api.getAdminComplaints()
      ]);

      if (dashRes.metrics) setMetrics(dashRes.metrics);
      if (catRes.categories) setCategories(catRes.categories);
      if (docRes.documents) setDocuments(docRes.documents);
      if (auditRes.logs) setAuditLogs(auditRes.logs);
      if (fraudRes.anomalies) setAnomalies(fraudRes.anomalies);
      if (surgeRes.zones) setSurgeZones(surgeRes.zones);
      if (compRes.complaints) setComplaints(compRes.complaints);
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

  const handleResolveComplaint = async () => {
    if (!selectedComplaint) return;
    setIsResolving(true);
    try {
      await api.resolveComplaint(selectedComplaint.id, {
        status: resolutionStatus,
        resolutionNotes,
        action: resolutionAction,
        refundAmount: resolutionAction === 'REFUND_WALLET' ? refundAmount : 0
      });
      alert(`Complaint #${selectedComplaint.ticket_number} resolved successfully!`);
      setSelectedComplaint(null);
      setResolutionNotes('');
      setResolutionAction('NONE');
      setRefundAmount(0);
      loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to resolve complaint');
    } finally {
      setIsResolving(false);
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

        {/* Tab Navigation & PRD Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-800 rounded-2xl border border-slate-700">
          {[
            { id: 'OPERATIONS', label: 'Live Ops', icon: Activity },
            { id: 'PRICING', label: 'Pricing & Categories', icon: Sliders },
            { id: 'DOCUMENTS', label: `KYC (${documents.filter(d => d.verification_status === 'PENDING').length})`, icon: FileCheck },
            { id: 'COMPLAINTS', label: `Grievances (${complaints.filter(c => c.status === 'OPEN' || c.status === 'UNDER_REVIEW').length})`, icon: ShieldAlert },
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

          <button
            onClick={() => setShowComplianceModal(true)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>KYC & Audit Hub</span>
          </button>

          <button
            onClick={() => setShowLostAndFoundModal(true)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-950/80 hover:bg-sky-900 border border-sky-700/60 text-sky-300 transition-colors"
          >
            <PackageSearch className="w-3.5 h-3.5 text-sky-400" />
            <span>Lost & Found</span>
          </button>
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

      {/* Tab: Grievance & Complaints Investigation and Resolution */}
      {activeTab === 'COMPLAINTS' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Grievance & Dispute Resolution Desk</h3>
              <p className="text-xs text-slate-400">Investigate complaints against drivers, passengers, rides, fares, and safety issues</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-400">Total Cases: {complaints.length}</span>
            </div>
          </div>

          {complaints.length === 0 ? (
            <p className="text-xs text-slate-400">No active grievances or complaints filed on the platform.</p>
          ) : (
            <div className="space-y-3">
              {complaints.map(comp => {
                const isResolved = comp.status === 'RESOLVED';
                const isUnderReview = comp.status === 'UNDER_REVIEW';
                const isCritical = comp.severity === 'CRITICAL';
                return (
                  <div
                    key={comp.id}
                    className={`p-5 rounded-2xl border transition-all space-y-3 text-xs ${
                      isCritical
                        ? 'bg-rose-950/20 border-rose-800/80'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-brand-500 bg-brand-950 px-2 py-0.5 rounded-lg border border-brand-800">
                          #{comp.ticket_number}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 uppercase">
                          Target: {comp.target_type}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            isCritical
                              ? 'bg-rose-600 text-white animate-pulse'
                              : comp.severity === 'HIGH'
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-600 text-slate-200'
                          }`}
                        >
                          {comp.severity} SEVERITY
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isResolved
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                              : isUnderReview
                              ? 'bg-amber-950 text-amber-400 border border-amber-700'
                              : 'bg-rose-950 text-rose-400 border border-rose-700'
                          }`}
                        >
                          {comp.status}
                        </span>

                        <button
                          onClick={() => {
                            setSelectedComplaint(comp);
                            setResolutionStatus(comp.status === 'OPEN' ? 'RESOLVED' : comp.status);
                            setResolutionNotes(comp.resolution_notes || '');
                          }}
                          className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs shadow-sm"
                        >
                          Investigate & Resolve
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{comp.title}</h4>
                      <p className="text-slate-600 dark:text-slate-300 font-medium mt-1">{comp.description}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-white/60 dark:bg-slate-950/60 rounded-xl text-[11px] border border-slate-200 dark:border-slate-800">
                      <div>
                        <span className="text-slate-400 block font-semibold">Complainant ({comp.complainant_role}):</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {comp.complainant_name} ({comp.complainant_phone || 'No phone'})
                        </span>
                      </div>

                      {comp.target_user_name && (
                        <div>
                          <span className="text-slate-400 block font-semibold">Target Entity:</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {comp.target_user_name} ({comp.target_user_phone || 'No phone'})
                          </span>
                        </div>
                      )}

                      {comp.booking_number && (
                        <div>
                          <span className="text-slate-400 block font-semibold">Associated Ride:</span>
                          <span className="font-mono font-bold text-brand-400">
                            #{comp.booking_number} (₹{comp.final_fare || comp.fare_estimate})
                          </span>
                        </div>
                      )}
                    </div>

                    {comp.resolution_notes && (
                      <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs space-y-0.5">
                        <p className="font-bold text-emerald-400">Official Admin Resolution:</p>
                        <p className="text-slate-300 text-[11px]">{comp.resolution_notes}</p>
                        {comp.resolved_by_name && (
                          <p className="text-[10px] text-slate-500">
                            Investigated by {comp.resolved_by_name} on {new Date(comp.resolved_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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

      {/* Complaint Resolution Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in zoom-in-95">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-brand-400 font-bold bg-brand-950 px-2 py-0.5 rounded border border-brand-800">
                  GRIEVANCE #{selectedComplaint.ticket_number}
                </span>
                <h3 className="text-base font-extrabold mt-1">Investigate & Resolve Ticket</h3>
              </div>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1 text-xs">
              <p className="font-bold text-slate-200">{selectedComplaint.title}</p>
              <p className="text-slate-400 text-[11px]">{selectedComplaint.description}</p>
            </div>

            {/* Status Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Set Resolution Status</label>
              <div className="grid grid-cols-3 gap-2">
                {(['RESOLVED', 'UNDER_REVIEW', 'REJECTED'] as const).map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setResolutionStatus(st)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      resolutionStatus === st
                        ? st === 'RESOLVED'
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : st === 'UNDER_REVIEW'
                          ? 'bg-amber-600 border-amber-500 text-white'
                          : 'bg-rose-600 border-rose-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Disciplinary / Remedial Action */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Remedial Action</label>
              <select
                value={resolutionAction}
                onChange={e => setResolutionAction(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-brand-500 font-medium"
              >
                <option value="NONE">No Disciplinary Action (Standard Resolution)</option>
                <option value="REFUND_WALLET">💰 Credit Wallet Refund to Complainant</option>
                <option value="SUSPEND_DRIVER">🚫 Suspend Target Driver Account</option>
                <option value="WARN_USER">⚠️ Issue Formal Warning Notice</option>
              </select>
            </div>

            {resolutionAction === 'REFUND_WALLET' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Refund Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={refundAmount || ''}
                  onChange={e => setRefundAmount(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 150"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-brand-500 font-bold"
                />
              </div>
            )}

            {/* Resolution Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Investigation Notes & Redressal Decision *</label>
              <textarea
                rows={3}
                placeholder="Document finding details and action taken for customer / captain record..."
                value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-brand-500 resize-none font-medium"
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedComplaint(null)}
                className="w-1/2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResolving || !resolutionNotes.trim()}
                onClick={handleResolveComplaint}
                className="w-1/2 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl font-extrabold text-xs shadow-lg shadow-brand-500/25"
              >
                {isResolving ? 'Updating...' : 'Save Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compliance & Audit Governance Hub (PRD §15 & Appendix A) */}
      {showComplianceModal && (
        <AdminAuditAndComplianceModal
          currentUser={currentUser}
          onClose={() => setShowComplianceModal(false)}
        />
      )}

      {/* Lost & Found Desk (PRD §14.3) */}
      {showLostAndFoundModal && (
        <LostAndFoundModal
          currentUser={currentUser}
          onClose={() => setShowLostAndFoundModal(false)}
        />
      )}

    </div>
  );
};
