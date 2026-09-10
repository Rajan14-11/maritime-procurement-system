import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Layers,
  ShoppingCart,
  Send,
  Calendar,
  Anchor,
  User,
  AlertCircle,
  History,
  Check,
  X,
  FileText,
} from 'lucide-react';
import { purchaseRequestsApi } from '../../services/api.js';
import { PurchaseRequest, AuditLog } from '../../types/index.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { PriorityBadge } from '../../components/PriorityBadge.js';
import { WorkflowStepper } from '../../components/WorkflowStepper.js';
import { Card } from '../../components/Card.js';
import { Modal } from '../../components/Modal.js';
import { useAuth } from '../../context/AuthContext.js';

export const PurchaseRequestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const [pr, setPr] = useState<PurchaseRequest | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approval / Rejection modals
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await purchaseRequestsApi.getById(id);
      setPr(res.purchaseRequest);
      setAuditLogs(res.auditLogs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase request.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleApprove = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      await purchaseRequestsApi.approve(id, approvalComments);
      setApproveModalOpen(false);
      setApprovalComments('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Approval failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    if (!rejectionReason.trim()) {
      alert('A rejection reason is mandatory.');
      return;
    }
    try {
      setActionLoading(true);
      await purchaseRequestsApi.reject(id, rejectionReason.trim());
      setRejectModalOpen(false);
      setRejectionReason('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Rejection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitDraft = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      await purchaseRequestsApi.submit(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Submission failed.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span>Loading purchase request record...</span>
      </div>
    );
  }

  if (error || !pr) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
        <h3 className="text-sm font-semibold text-rose-900">Request Not Found</h3>
        <p className="text-xs text-rose-700">{error || 'Purchase request record unavailable.'}</p>
        <Link
          to="/purchase-requests"
          className="inline-block px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700"
        >
          Return to List
        </Link>
      </div>
    );
  }

  const isPendingApproval = pr.status === 'PENDING_APPROVAL';
  const isApproved = pr.status === 'APPROVED';
  const isDraft = pr.status === 'DRAFT';
  const canApprove =
    isPendingApproval &&
    (user?.role === 'APPROVER' || user?.role === 'ADMIN') &&
    (user?.role === 'ADMIN' || pr.requesterId !== user?.id);

  const canCreateRfq =
    isApproved && (user?.role === 'PROCUREMENT_OFFICER' || user?.role === 'ADMIN');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/purchase-requests"
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 font-mono tracking-tight">
                {pr.prNumber}
              </h1>
              <StatusBadge status={pr.status} />
              <PriorityBadge priority={pr.priority} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Vessel: <strong>{pr.vessel?.name}</strong> • Department: {pr.department}
            </p>
          </div>
        </div>

        {/* Dynamic Workflow Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isDraft && (
            <button
              onClick={handleSubmitDraft}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit for Approval</span>
            </button>
          )}

          {canApprove && (
            <>
              <button
                onClick={() => setRejectModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>Reject</span>
              </button>
              <button
                onClick={() => setApproveModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Approve PR</span>
              </button>
            </>
          )}

          {canCreateRfq && !pr.rfq && (
            <Link
              to={`/rfqs?createForPr=${pr.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Issue RFQ to Vendors</span>
            </Link>
          )}

          {pr.rfq && (
            <Link
              to={`/rfqs/${pr.rfq.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-semibold transition-colors shadow-xs"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>View RFQ ({pr.rfq.rfqNumber})</span>
            </Link>
          )}
        </div>
      </div>

      {/* Visual Workflow Stepper */}
      <WorkflowStepper currentStatus={pr.status} isRejected={pr.status === 'REJECTED'} />

      {/* Rejection Alert Callout if Rejected */}
      {pr.status === 'REJECTED' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs">
          <div className="flex items-center gap-2 font-bold text-rose-900">
            <XCircle className="w-4 h-4 text-rose-600" />
            <span>Rejection Notice</span>
          </div>
          <p className="text-rose-800 pl-6">
            <strong>Reason:</strong> {pr.rejectionReason || 'No detailed reason provided.'}
          </p>
        </div>
      )}

      {/* 2-Column Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details & Items */}
        <div className="md:col-span-2 space-y-6">
          {/* Header Info */}
          <Card title="Purchase Request Information">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 font-medium block">Vessel</span>
                <span className="font-semibold text-slate-900 mt-0.5 block flex items-center gap-1.5">
                  <Anchor className="w-3.5 h-3.5 text-blue-600" />
                  {pr.vessel?.name} ({pr.vessel?.type})
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {pr.vessel?.imoNumber} • {pr.vessel?.flag}
                </span>
              </div>

              <div>
                <span className="text-slate-500 font-medium block">Department</span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {pr.department}
                </span>
              </div>

              <div>
                <span className="text-slate-500 font-medium block">Requester</span>
                <span className="font-semibold text-slate-900 mt-0.5 block flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  {pr.requester?.name || 'Chief Engineer'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {pr.requester?.email}
                </span>
              </div>

              <div>
                <span className="text-slate-500 font-medium block">Required On-Board By</span>
                <span className="font-semibold text-slate-900 mt-0.5 block font-mono flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {new Date(pr.requiredDate).toLocaleDateString([], {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <div className="col-span-2 pt-2 border-t border-slate-100">
                <span className="text-slate-500 font-medium block">Justification Reason</span>
                <p className="font-medium text-slate-800 mt-1 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {pr.reason}
                </p>
              </div>
            </div>
          </Card>

          {/* Line Items Table */}
          <Card title="Material & Spare Parts Line Items">
            <div className="overflow-x-auto -mx-6 -my-6">
              <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                <thead className="bg-slate-50/70 font-semibold text-slate-600">
                  <tr>
                    <th className="py-3 px-6">#</th>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-center">Quantity</th>
                    <th className="py-3 px-4 text-right">Est. Unit Price</th>
                    <th className="py-3 px-6 text-right">Estimated Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {pr.items.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="py-3 px-6 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{item.itemName}</td>
                      <td className="py-3 px-4 text-slate-500">{item.description || '—'}</td>
                      <td className="py-3 px-4 text-center font-mono font-semibold">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        ₹{item.estimatedUnitPrice?.toLocaleString()}
                      </td>
                      <td className="py-3 px-6 text-right font-mono font-bold text-slate-900">
                        ₹{item.estimatedTotal?.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/80 font-bold text-slate-900 border-t border-slate-200">
                    <td colSpan={5} className="py-3 px-6 text-right text-xs">
                      Grand Estimated Total:
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-sm text-blue-900">
                      ₹{pr.estimatedTotal?.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>

        {/* Right 1 Col: Approvals & Audit Trail */}
        <div className="space-y-6">
          {/* Approval Status Card */}
          <Card title="Approvals Record">
            {pr.approvals && pr.approvals.length > 0 ? (
              <div className="space-y-3">
                {pr.approvals.map((app) => (
                  <div
                    key={app.id}
                    className={`p-3 rounded-lg border text-xs ${
                      app.decision === 'APPROVED'
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50/70 border-rose-200 text-rose-900'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className="flex items-center gap-1.5">
                        {app.decision === 'APPROVED' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-rose-600" />
                        )}
                        {app.decision}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700">
                      By: <strong>{app.approver?.name || 'Manager'}</strong> ({app.approver?.role})
                    </p>
                    {app.comments && (
                      <p className="text-[11px] text-slate-600 mt-1 italic">
                        "{app.comments}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-500">
                Pending formal managerial review.
              </div>
            )}
          </Card>

          {/* Audit Trail for this PR */}
          <Card title="Audit History">
            <div className="flow-root">
              <ul className="-mb-6">
                {auditLogs.map((log, idx) => (
                  <li key={log.id}>
                    <div className="relative pb-6">
                      {idx !== auditLogs.length - 1 && (
                        <span className="absolute top-4 left-2.5 -ml-px h-full w-0.5 bg-slate-200" />
                      )}
                      <div className="relative flex items-start space-x-2.5">
                        <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold ring-2 ring-white">
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1 text-xs">
                          <p className="font-semibold text-slate-800">
                            {log.action.replace(/_/g, ' ')}
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5">{log.description}</p>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>

      {/* Approve Modal */}
      <Modal
        isOpen={approveModalOpen}
        onClose={() => setApproveModalOpen(false)}
        title={`Approve Purchase Request ${pr.prNumber}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            You are about to authorize <strong>{pr.prNumber}</strong> for vessel{' '}
            <strong>{pr.vessel?.name}</strong> with a total estimated amount of{' '}
            <strong>₹{pr.estimatedTotal.toLocaleString()}</strong>.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Approval Notes / Budget Code (Optional)
            </label>
            <textarea
              rows={3}
              value={approvalComments}
              onChange={(e) => setApprovalComments(e.target.value)}
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
              onClick={handleApprove}
              disabled={actionLoading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
            >
              {actionLoading ? 'Processing...' : 'Confirm Approval'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title={`Reject Purchase Request ${pr.prNumber}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Rejecting this request will terminate the procurement cycle. A mandatory justification
            reason is required per company audit policy.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Rejection Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Budget not approved for current maintenance cycle / item already available in central stock."
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
              onClick={handleReject}
              disabled={actionLoading || !rejectionReason.trim()}
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
