import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { User } from '../../types/index.js';
import {
  FileCheck,
  History,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Search,
  Calendar,
  X,
  Eye,
  Lock,
  ExternalLink,
  Layers,
  Sparkles,
  RefreshCw
} from 'lucide-react';

interface AdminAuditAndComplianceModalProps {
  currentUser: User;
  onClose: () => void;
}

export const AdminAuditAndComplianceModal: React.FC<AdminAuditAndComplianceModalProps> = ({
  currentUser,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'DOCUMENTS' | 'AUDIT_LOGS' | 'RBAC' | 'MATURITY'>('DOCUMENTS');
  const [docs, setDocs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [rbacRoles, setRbacRoles] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [chainIntegrity, setChainIntegrity] = useState<{ isValid: boolean; checkedCount: number; brokenSequence?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dRes, aRes, rRes, fRes, vRes] = await Promise.all([
        api.getAdminComplianceDocs(),
        api.getAdminAuditLogs(),
        api.getAdminRbacRoles(),
        api.getAdminFeatures(),
        api.verifyAuditLogChain()
      ]);
      if (dRes?.documents) setDocs(dRes.documents);
      if (aRes?.logs) setAuditLogs(aRes.logs);
      if (rRes?.permissions) setRbacRoles(rRes.permissions);
      if (fRes?.features) setFeatures(fRes.features);
      if (vRes) setChainIntegrity(vRes);
    } catch (e) {
      console.warn('Failed to load compliance/audit data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDoc = async (docId: string, status: 'APPROVED' | 'REJECTED') => {
    let reason = undefined;
    if (status === 'REJECTED') {
      const input = prompt('Please enter rejection reason code (e.g. Expired document / Blurry photo):');
      if (!input) return;
      reason = input;
    }
    try {
      const res = await api.verifyComplianceDoc(docId, { status, rejectionReason: reason });
      if (res.success) {
        setActionSuccess(`Document successfully marked as ${status}!`);
        loadData();
        setTimeout(() => setActionSuccess(''), 2500);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update document verification');
    }
  };

  const filteredLogs = auditLogs.filter(l => 
    !searchQuery ||
    l.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.actor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.entity_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.event_hash?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getMaturityBadgeColor = (mat: string) => {
    switch (mat) {
      case 'PRODUCTION_CERTIFIED':
        return 'bg-emerald-950 text-emerald-300 border-emerald-700';
      case 'SECURITY_TESTED':
      case 'LOAD_TESTED':
      case 'PRODUCTION_INTEGRATED':
      case 'END_TO_END':
        return 'bg-cyan-950 text-cyan-300 border-cyan-700';
      case 'BACKEND_PARTIAL':
        return 'bg-amber-950 text-amber-300 border-amber-700';
      case 'UI_ONLY':
        return 'bg-purple-950 text-purple-300 border-purple-700';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Compliance, KYC & Audit Governance Hub</h3>
              <p className="text-xs text-slate-400">Driver onboarding verification, tamper-evident audit chain & maturity lifecycle</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-2 gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('DOCUMENTS')}
            className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'DOCUMENTS'
                ? 'bg-indigo-600 text-white shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileCheck className="w-4 h-4 shrink-0" />
            <span className="truncate">KYC Documents ({docs.filter(d => d.verification_status === 'PENDING').length})</span>
          </button>
          <button
            onClick={() => setActiveTab('AUDIT_LOGS')}
            className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'AUDIT_LOGS'
                ? 'bg-indigo-600 text-white shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span className="truncate">Audit Chain ({auditLogs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('MATURITY')}
            className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'MATURITY'
                ? 'bg-indigo-600 text-white shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span className="truncate">Feature Maturity ({features.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('RBAC')}
            className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'RBAC'
                ? 'bg-indigo-600 text-white shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Lock className="w-4 h-4 shrink-0" />
            <span className="truncate">RBAC Permissions</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          
          {actionSuccess && (
            <div className="p-3.5 bg-emerald-950/80 border border-emerald-500 rounded-2xl flex items-center space-x-2.5 text-emerald-300 text-xs font-bold animate-in zoom-in-95">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* TAB 1: DRIVER KYC & COMPLIANCE DOCUMENTS */}
          {activeTab === 'DOCUMENTS' && (
            <div className="space-y-3">
              {docs.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No driver documents found.</div>
              ) : (
                docs.map(doc => (
                  <div key={doc.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-sm text-white">{doc.document_type.replace(/_/g, ' ')}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          doc.verification_status === 'APPROVED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : doc.verification_status === 'REJECTED'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                        }`}>
                          {doc.verification_status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">
                        Number: <span className="text-slate-200 font-bold">{doc.document_number}</span> • Expiry: {doc.expiry_date || 'N/A'}
                      </p>
                      <p className="text-xs text-indigo-400 font-semibold">
                        Driver: {doc.driver_name} ({doc.driver_phone})
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <a
                        href={doc.document_url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold border border-slate-800 flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </a>

                      {doc.verification_status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleVerifyDoc(doc.id, 'APPROVED')}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleVerifyDoc(doc.id, 'REJECTED')}
                            className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: CRYPTOGRAPHICALLY HASH-CHAINED AUDIT LOGS */}
          {activeTab === 'AUDIT_LOGS' && (
            <div className="space-y-4">
              {/* Chain Verification Badge */}
              <div className="p-4 bg-gradient-to-r from-emerald-950/40 via-slate-950 to-indigo-950/40 border border-emerald-500/40 rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white">SHA-256 Tamper-Evident Hash Chain</h4>
                    <p className="text-[11px] text-slate-400">
                      {chainIntegrity?.isValid
                        ? `✅ Chain Integrity 100% Verified (${chainIntegrity.checkedCount} cryptographic blocks linked)`
                        : '⚠️ Chain Integrity Check Failed'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={loadData}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Verify</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter audit logs by action, actor, entity, or SHA256 hash..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-2.5">
                {filteredLogs.map(log => (
                  <div key={log.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {log.sequence_number && (
                          <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 font-mono text-[10px] font-bold rounded-md border border-indigo-800">
                            #{log.sequence_number}
                          </span>
                        )}
                        <span className="font-mono font-bold text-indigo-400">{log.action}</span>
                        <span className="text-[10px] text-slate-500 font-mono bg-slate-900 px-1.5 py-0.5 rounded">
                          {log.entity_type}:{log.entity_id}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{log.created_at}</span>
                    </div>

                    <div className="text-slate-300">
                      Actor: <span className="font-semibold text-white">{log.actor_name || log.actor_user_id}</span> ({log.actor_role}) • IP: {log.ip_address || '127.0.0.1'}
                    </div>

                    {log.event_hash && (
                      <div className="p-2 bg-slate-900 rounded-xl space-y-1 font-mono text-[10px]">
                        <div className="text-slate-400 truncate">
                          <span className="text-slate-500">Hash: </span>
                          <span className="text-emerald-400 font-bold">{log.event_hash}</span>
                        </div>
                        {log.previous_event_hash && (
                          <div className="text-slate-500 truncate">
                            Prev: {log.previous_event_hash}
                          </div>
                        )}
                      </div>
                    )}

                    {log.new_values && (
                      <pre className="p-2 bg-slate-900 rounded-xl text-[10px] text-slate-400 overflow-x-auto font-mono">
                        {log.new_values}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: FEATURE MATURITY MATRIX */}
          {activeTab === 'MATURITY' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between text-xs text-slate-400">
                <span>PRD §15.2 Feature Maturity Lifecycle Tracking</span>
                <span className="font-bold text-white">Showing {features.length} Features</span>
              </div>

              <div className="space-y-2">
                {features.map(f => (
                  <div key={f.key} className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-xs text-white">{f.key}</span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${getMaturityBadgeColor(f.maturity)}`}>
                          {f.maturity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{f.description}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-xl ${
                        f.enabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {f.enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: RBAC CATALOGUE */}
          {activeTab === 'RBAC' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Explicit role-based access control matrix adhering to PRD Appendix A:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {rbacRoles.map(r => (
                  <div key={r.code} className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-indigo-400 text-xs">{r.code}</span>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md">{r.module}</span>
                    </div>
                    <p className="text-xs text-slate-300">{r.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
