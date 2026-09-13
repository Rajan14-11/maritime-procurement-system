import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare,
  CheckCircle2,
  XCircle,
  FileText,
  ShoppingCart,
  Anchor,
  Clock,
  AlertCircle,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { approvalsApi, purchaseRequestsApi, purchaseOrdersApi } from '../../services/api.js';
import { PurchaseRequest, PurchaseOrder } from '../../types/index.js';
import { PriorityBadge } from '../../components/PriorityBadge.js';
import { Card } from '../../components/Card.js';
import { Modal } from '../../components/Modal.js';
import { useAuth } from '../../context/AuthContext.js';

export const ApprovalsQueue: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  // Modals state
  const [activeTab, setActiveTab] = useState<'ALL' | 'PRS' | 'POS'>('ALL');
  const [selectedEntity, setSelectedEntity] = useState<{
    type: 'PR' | 'PO';
    id: string;
    code: string;
    amount: number;
  } | null>(null);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [comments, setComments] = useState('');
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadPending = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await approvalsApi.getPending();
      setPurchaseRequests(res.purchaseRequests || []);
      setPurchaseOrders(res.purchaseOrders || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pending approval queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const openApprove = (type: 'PR' | 'PO', id: string, code: string, amount: number) => {
    setSelectedEntity({ type, id, code, amount });
    setComments('');
    setApproveModalOpen(true);
  };

  const openReject = (type: 'PR' | 'PO', id: string, code: string, amount: number) => {
    setSelectedEntity({ type, id, code, amount });
    setReason('');
    setRejectModalOpen(true);
  };

  const handleApproveSubmit = async () => {
    if (!selectedEntity) return;
    try {
      setActionLoading(true);
      if (selectedEntity.type === 'PR') {
        await purchaseRequestsApi.approve(selectedEntity.id, comments);
      } else {
        await purchaseOrdersApi.approve(selectedEntity.id, comments);
      }
      setApproveModalOpen(false);
      await loadPending();
    } catch (err: any) {
      alert(err.message || 'Approval action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!selectedEntity) return;
    if (!reason.trim()) {
      alert('Rejection reason is mandatory.');
      return;
    }
    try {
      setActionLoading(true);
      if (selectedEntity.type === 'PR') {
        await purchaseRequestsApi.reject(selectedEntity.id, reason.trim());
      } else {
        await purchaseOrdersApi.reject(selectedEntity.id, reason.trim());
      }
      setRejectModalOpen(false);
      await loadPending();
    } catch (err: any) {
      alert(err.message || 'Rejection action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const totalCount = purchaseRequests.length + purchaseOrders.length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-amber-600" />
            Authorization & Approvals Queue
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Managerial oversight for vessel purchase demands and supplier purchase orders
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center p-1 bg-slate-200/70 rounded-lg text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Pending ({totalCount})
          </button>
          <button
            onClick={() => setActiveTab('PRS')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'PRS'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            PR Demands ({purchaseRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('POS')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'POS'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Purchase Orders ({purchaseOrders.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-xs text-rose-800 font-medium">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
          <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading authorization queue...</span>
        </div>
      ) : totalCount === 0 ? (
        <div className="p-16 bg-white border border-slate-200 rounded-2xl text-center space-y-3">
          <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">All Clear! No Pending Approvals</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            There are currently no purchase requests or purchase orders awaiting your approval.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section 1: Purchase Requests */}
          {(activeTab === 'ALL' || activeTab === 'PRS') && purchaseRequests.length > 0 && (
            <Card
              title={
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Purchase Requests Awaiting Authorization ({purchaseRequests.length})</span>
                </div>
              }
            >
              <div className="overflow-x-auto -mx-6 -my-6">
                <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                  <thead className="bg-slate-50/70 font-semibold text-slate-600">
                    <tr>
                      <th className="py-3 px-6">PR Number</th>
                      <th className="py-3 px-4">Vessel</th>
                      <th className="py-3 px-4">Dept</th>
                      <th className="py-3 px-4">Requester</th>
                      <th className="py-3 px-4">Line Items</th>
                      <th className="py-3 px-4">Est. Total</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-6 text-right">Decisions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {purchaseRequests.map((pr) => (
                      <tr key={pr.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-6 font-bold text-blue-600 font-mono">
                          <Link to={`/purchase-requests/${pr.id}`} className="hover:underline">
                            {pr.prNumber}
                          </Link>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {pr.vessel?.name}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{pr.department}</td>
                        <td className="py-3 px-4 text-slate-600">{pr.requester?.name}</td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          {pr.items && pr.items.length > 0
                            ? `${pr.items[0].itemName} (${pr.items[0].quantity} ${pr.items[0].unit})`
                            : '—'}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                          ₹{pr.estimatedTotal.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <PriorityBadge priority={pr.priority} />
                        </td>
                        <td className="py-3 px-6 text-right space-x-2">
                          <Link
                            to={`/purchase-requests/${pr.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </Link>
                          {pr.requesterId === user?.id ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 italic"
                              title="Strict Separation of Duties: Requesters cannot approve their own purchase requests. Peer authorization is required."
                            >
                              Self-Request (Approval Blocked)
                            </span>
                          ) : (
                            <button
                              onClick={() =>
                                openApprove('PR', pr.id, pr.prNumber, pr.estimatedTotal)
                              }
                              className="inline-flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                          )}
                          <button
                            onClick={() =>
                              openReject('PR', pr.id, pr.prNumber, pr.estimatedTotal)
                            }
                            className="inline-flex items-center gap-1 px-3 py-1 rounded bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Section 2: Purchase Orders */}
          {(activeTab === 'ALL' || activeTab === 'POS') && purchaseOrders.length > 0 && (
            <Card
              title={
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-purple-600" />
                  <span>Purchase Orders Awaiting Authorization ({purchaseOrders.length})</span>
                </div>
              }
            >
              <div className="overflow-x-auto -mx-6 -my-6">
                <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                  <thead className="bg-slate-50/70 font-semibold text-slate-600">
                    <tr>
                      <th className="py-3 px-6">PO Number</th>
                      <th className="py-3 px-4">Vendor</th>
                      <th className="py-3 px-4">Vessel</th>
                      <th className="py-3 px-4">Created By</th>
                      <th className="py-3 px-4">Payment Terms</th>
                      <th className="py-3 px-4">Total Order Value</th>
                      <th className="py-3 px-6 text-right">Decisions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {purchaseOrders.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-6 font-bold text-purple-600 font-mono">
                          <Link to={`/purchase-orders/${po.id}`} className="hover:underline">
                            {po.poNumber}
                          </Link>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {po.vendor?.name}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{po.vessel?.name}</td>
                        <td className="py-3 px-4 text-slate-500">{po.createdBy?.name}</td>
                        <td className="py-3 px-4 text-slate-600">{po.paymentTerms}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                          ₹{po.total.toLocaleString()}
                        </td>
                        <td className="py-3 px-6 text-right space-x-2">
                          <Link
                            to={`/purchase-orders/${po.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </Link>
                          <button
                            onClick={() => openApprove('PO', po.id, po.poNumber, po.total)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Approve PO</span>
                          </button>
                          <button
                            onClick={() => openReject('PO', po.id, po.poNumber, po.total)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Approve Modal */}
      <Modal
        isOpen={approveModalOpen}
        onClose={() => setApproveModalOpen(false)}
        title={`Authorize ${selectedEntity?.code}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            You are authorizing <strong>{selectedEntity?.code}</strong> valued at{' '}
            <strong>₹{selectedEntity?.amount.toLocaleString()}</strong>.
            {selectedEntity?.type === 'PO' && (
              <span className="block text-emerald-700 font-semibold mt-1">
                Authorizing this PO will immediately transition it to ORDERED status.
              </span>
            )}
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Approval Note (Optional)
            </label>
            <textarea
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="e.g. Approved under voyage maintenance operational allocation."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setApproveModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApproveSubmit}
              disabled={actionLoading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
            >
              {actionLoading ? 'Processing...' : 'Confirm Authorization'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title={`Reject ${selectedEntity?.code}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Rejecting this {selectedEntity?.type === 'PR' ? 'purchase request' : 'purchase order'} will
            halt the workflow. A mandatory reason is required for internal compliance.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Rejection Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide reason for rejecting this item..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-rose-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setRejectModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRejectSubmit}
              disabled={actionLoading || !reason.trim()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
