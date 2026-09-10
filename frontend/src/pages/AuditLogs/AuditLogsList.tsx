import React, { useEffect, useState } from 'react';
import {
  History,
  Search,
  Calendar,
  AlertCircle,
  Filter,
  User,
  Shield,
} from 'lucide-react';
import { auditLogsApi } from '../../services/api.js';
import { AuditLog } from '../../types/index.js';
import { Card } from '../../components/Card.js';

export const AuditLogsList: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await auditLogsApi.list({
        search: search.trim() || undefined,
        entityType: entityType || undefined,
        action: action || undefined,
        limit: 100,
      });
      setLogs(res.logs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load system audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [entityType, action]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs();
  };

  const getActionTagColor = (act: string) => {
    if (act.includes('APPROVE')) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (act.includes('REJECT')) return 'bg-rose-100 text-rose-800 border-rose-300';
    if (act.includes('COMPLETE')) return 'bg-teal-100 text-teal-800 border-teal-300';
    if (act.includes('CREATE_PO') || act.includes('ORDER')) return 'bg-purple-100 text-purple-800 border-purple-300';
    if (act.includes('RFQ') || act.includes('QUOTATION')) return 'bg-sky-100 text-sky-800 border-sky-300';
    if (act.includes('RECEIPT')) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            System Audit Trail & Compliance Log
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of state changes, authorizations, quotations, and goods receipts across the procurement lifecycle
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search description, user or entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50/50"
          />
        </div>

        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
        >
          <option value="">All Entities</option>
          <option value="PURCHASE_REQUEST">Purchase Requests</option>
          <option value="RFQ">RFQs & Quotations</option>
          <option value="PURCHASE_ORDER">Purchase Orders</option>
          <option value="DELIVERY">Deliveries</option>
          <option value="USER">User Directory</option>
          <option value="SYSTEM">System Initialization</option>
        </select>

        <button
          onClick={loadLogs}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
        >
          Search
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-xs text-rose-800 font-medium">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table */}
      <Card>
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Fetching compliance audit records...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <History className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">No Audit Events Logged</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No audit records match the current filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
              <thead className="bg-slate-50/70 font-semibold text-slate-600">
                <tr>
                  <th className="py-3.5 px-6">Timestamp</th>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Entity</th>
                  <th className="py-3.5 px-6">Event Details & Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-6 font-mono text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString([], {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{log.userName}</span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-600 whitespace-nowrap">
                      {log.userRole}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold border ${getActionTagColor(
                          log.action
                        )}`}
                      >
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {log.entityType}
                    </td>
                    <td className="py-3.5 px-6 text-slate-800 leading-relaxed max-w-xl">
                      {log.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
