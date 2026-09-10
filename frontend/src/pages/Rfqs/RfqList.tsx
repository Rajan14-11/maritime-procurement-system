import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Layers,
  Plus,
  Search,
  Calendar,
  Building2,
  Anchor,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Check,
  Sparkles,
} from 'lucide-react';
import { rfqsApi, purchaseRequestsApi, vendorsApi } from '../../services/api.js';
import { Rfq, PurchaseRequest, Vendor } from '../../types/index.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { Card } from '../../components/Card.js';
import { Modal } from '../../components/Modal.js';
import { useAuth } from '../../context/AuthContext.js';

export const RfqList: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Create RFQ Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [approvedPrs, setApprovedPrs] = useState<PurchaseRequest[]>([]);
  const [activeVendors, setActiveVendors] = useState<Vendor[]>([]);
  const [selectedPrId, setSelectedPrId] = useState('');
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadRfqs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await rfqsApi.list({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
      });
      setRfqs(res.rfqs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load RFQs.');
    } finally {
      setLoading(false);
    }
  };

  const loadModalData = async () => {
    try {
      const [prsRes, vendorsRes] = await Promise.all([
        purchaseRequestsApi.list({ status: 'APPROVED' }),
        vendorsApi.list({ status: 'ACTIVE' }),
      ]);
      setApprovedPrs(prsRes.purchaseRequests || []);
      setActiveVendors(vendorsRes.vendors || []);

      const queryPrId = searchParams.get('createForPr');
      if (queryPrId) {
        setSelectedPrId(queryPrId);
        setCreateModalOpen(true);
      } else if (prsRes.purchaseRequests && prsRes.purchaseRequests.length > 0) {
        setSelectedPrId(prsRes.purchaseRequests[0].id);
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadRfqs();
  }, [statusFilter]);

  useEffect(() => {
    loadModalData();
  }, [searchParams]);

  const handleOpenCreateModal = () => {
    setFormError(null);
    loadModalData();
    setCreateModalOpen(true);
  };

  const toggleVendor = (vendorId: string) => {
    if (selectedVendorIds.includes(vendorId)) {
      setSelectedVendorIds(selectedVendorIds.filter((id) => id !== vendorId));
    } else {
      setSelectedVendorIds([...selectedVendorIds, vendorId]);
    }
  };

  // Demo shortcut: Select the 3 PRD vendors (MarineParts, OceanSupply, ShipTech)
  const selectDemoVendors = () => {
    const matched = activeVendors.filter(
      (v) =>
        v.name.includes('MarineParts') ||
        v.name.includes('OceanSupply') ||
        v.name.includes('ShipTech')
    );
    setSelectedVendorIds(matched.map((v) => v.id));
  };

  const handleCreateRfqSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedPrId) {
      setFormError('Please select an approved purchase request.');
      return;
    }
    if (selectedVendorIds.length === 0) {
      setFormError('Please select at least one vendor to invite.');
      return;
    }
    if (!deadline) {
      setFormError('Quotation deadline date is mandatory.');
      return;
    }

    try {
      setCreating(true);
      const res = await rfqsApi.create({
        purchaseRequestId: selectedPrId,
        vendorIds: selectedVendorIds,
        deadline,
      });

      setCreateModalOpen(false);
      setSelectedVendorIds([]);
      await loadRfqs();
      window.location.href = `/rfqs/${res.rfq.id}`;
    } catch (err: any) {
      setFormError(err.message || 'Failed to create RFQ.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Requests for Quotation (RFQs)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Competitive supplier price solicitations and quotation comparative analysis
          </p>
        </div>

        {(user?.role === 'PROCUREMENT_OFFICER' || user?.role === 'ADMIN') && (
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create New RFQ</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search RFQs by number, PR code, or vessel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadRfqs()}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50/50"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
        >
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed (Vendor Selected)</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <button
          onClick={loadRfqs}
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
            <span>Fetching RFQ repository...</span>
          </div>
        ) : rfqs.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">No RFQs Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No requests for quotation match your search criteria. You can create an RFQ from an approved purchase request.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
              <thead className="bg-slate-50/70 font-semibold text-slate-600">
                <tr>
                  <th className="py-3.5 px-6">RFQ Number</th>
                  <th className="py-3.5 px-4">Purchase Request</th>
                  <th className="py-3.5 px-4">Vessel</th>
                  <th className="py-3.5 px-4">Deadline</th>
                  <th className="py-3.5 px-4">Invited Vendors</th>
                  <th className="py-3.5 px-4">Quotes Received</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {rfqs.map((rfq) => (
                  <tr
                    key={rfq.id}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                    onClick={() => (window.location.href = `/rfqs/${rfq.id}`)}
                  >
                    <td className="py-3.5 px-6 font-bold text-blue-600 font-mono group-hover:underline">
                      {rfq.rfqNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                      {rfq.purchaseRequest?.prNumber}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      {rfq.purchaseRequest?.vessel?.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono">
                      {new Date(rfq.deadline).toLocaleDateString([], {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {rfq.rfqVendors.map((rv) => (
                          <span
                            key={rv.id}
                            className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200"
                          >
                            {rv.vendor.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-bold text-slate-900">
                        {rfq.quotations.length} / {rfq.rfqVendors.length}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={rfq.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <Link
                        to={`/rfqs/${rfq.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Compare</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create RFQ Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Issue Request for Quotation (RFQ)"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateRfqSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Approved Purchase Request <span className="text-rose-500">*</span>
            </label>
            {approvedPrs.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                No approved purchase requests currently available. Please approve a pending PR first.
              </div>
            ) : (
              <select
                value={selectedPrId}
                onChange={(e) => setSelectedPrId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600"
              >
                {approvedPrs.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.prNumber} — {pr.vessel?.name} ({pr.department}) • Est: ₹
                    {pr.estimatedTotal.toLocaleString()}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quotation Submission Deadline <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600 font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Invite Active Suppliers / Vendors <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={selectDemoVendors}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto-select 3 PRD Demo Vendors</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50/50">
              {activeVendors.map((vendor) => {
                const isChecked = selectedVendorIds.includes(vendor.id);
                return (
                  <label
                    key={vendor.id}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-blue-50 border-blue-300 text-blue-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleVendor(vendor.id)}
                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold block truncate">{vendor.name}</span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {vendor.categories} • {vendor.paymentTerms}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Selected: <strong>{selectedVendorIds.length}</strong> vendor(s)
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || approvedPrs.length === 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
            >
              {creating ? 'Creating RFQ...' : 'Dispatch RFQ'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
