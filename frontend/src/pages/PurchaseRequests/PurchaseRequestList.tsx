import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Filter,
  ArrowRight,
  Anchor,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { purchaseRequestsApi, vesselsApi } from '../../services/api.js';
import { PurchaseRequest, Vessel, PrStatus, PrPriority } from '../../types/index.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { PriorityBadge } from '../../components/PriorityBadge.js';
import { Card } from '../../components/Card.js';
import { useAuth } from '../../context/AuthContext.js';

export const PurchaseRequestList: React.FC = () => {
  const { user } = useAuth();
  const canCreatePr = user?.role === 'REQUESTER' || user?.role === 'ADMIN';
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vesselFilter, setVesselFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [prRes, vesselsRes] = await Promise.all([
        purchaseRequestsApi.list({
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          vesselId: vesselFilter || undefined,
          priority: priorityFilter || undefined,
        }),
        vesselsApi.list(),
      ]);

      setPurchaseRequests(prRes.purchaseRequests || []);
      setVessels(vesselsRes.vessels || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, vesselFilter, priorityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setVesselFilter('');
    setPriorityFilter('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Purchase Requests
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Material and technical spare parts demands initiated for fleet operations
          </p>
        </div>
        {canCreatePr && (
          <Link
            to="/purchase-requests/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Purchase Request</span>
          </Link>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by PR #, item name, reason or vessel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-slate-50/50"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="RFQ_CREATED">RFQ Created</option>
              <option value="VENDOR_SELECTED">Vendor Selected</option>
              <option value="PO_CREATED">PO Created</option>
              <option value="COMPLETED">Completed</option>
            </select>

            {/* Vessel Filter */}
            <select
              value={vesselFilter}
              onChange={(e) => setVesselFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="">All Vessels</option>
              {vessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>

            <button
              type="submit"
              className="px-3.5 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              Search
            </button>

            {(search || statusFilter || vesselFilter || priorityFilter) && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 font-medium"
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Main Table Card */}
      <Card>
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
            <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Fetching purchase requests...</span>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-xs text-rose-600">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
            <p>{error}</p>
            <button
              onClick={loadData}
              className="mt-3 px-3 py-1.5 bg-rose-600 text-white rounded text-xs"
            >
              Retry
            </button>
          </div>
        ) : purchaseRequests.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">No Purchase Requests Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              There are no purchase requests matching your criteria. Create a new demand to initiate the lifecycle.
            </p>
            <Link
              to="/purchase-requests/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Request</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
              <thead className="bg-slate-50/70 font-semibold text-slate-600">
                <tr>
                  <th className="py-3.5 px-6">PR Number</th>
                  <th className="py-3.5 px-4">Vessel</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Requester</th>
                  <th className="py-3.5 px-4">Items Summary</th>
                  <th className="py-3.5 px-4">Estimated Total</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Required Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {purchaseRequests.map((pr) => (
                  <tr
                    key={pr.id}
                    className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                    onClick={() => (window.location.href = `/purchase-requests/${pr.id}`)}
                  >
                    <td className="py-3.5 px-6 font-bold text-blue-600 group-hover:underline">
                      {pr.prNumber}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {pr.vessel?.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{pr.department}</td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {pr.requester?.name || 'Chief Engineer'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                      {pr.items && pr.items.length > 0
                        ? `${pr.items[0].itemName} (${pr.items[0].quantity} ${pr.items[0].unit})${
                            pr.items.length > 1 ? ` +${pr.items.length - 1} more` : ''
                          }`
                        : 'No items'}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      ₹{pr.estimatedTotal?.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <PriorityBadge priority={pr.priority} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono">
                      {new Date(pr.requiredDate).toLocaleDateString([], {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={pr.status} />
                    </td>
                    <td className="py-3.5 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <Link
                        to={`/purchase-requests/${pr.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </Link>
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
