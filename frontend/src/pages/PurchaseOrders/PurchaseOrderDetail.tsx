import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  Truck,
  Anchor,
  Building2,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  FileCheck,
  Package,
} from 'lucide-react';
import { purchaseOrdersApi, deliveriesApi } from '../../services/api.js';
import { PurchaseOrder, AuditLog } from '../../types/index.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { Card } from '../../components/Card.js';
import { Modal } from '../../components/Modal.js';
import { useAuth } from '../../context/AuthContext.js';

export const PurchaseOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approval/Rejection Modals
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [comments, setComments] = useState('');
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Record Delivery Modal
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [condition, setCondition] = useState('GOOD');
  const [notes, setNotes] = useState('');
  const [receivedInputs, setReceivedInputs] = useState<Record<string, number>>({});
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [submittingDelivery, setSubmittingDelivery] = useState(false);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await purchaseOrdersApi.getById(id);
      setPo(res.purchaseOrder);
      setAuditLogs(res.auditLogs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase order.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleApprovePo = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      await purchaseOrdersApi.approve(id, comments);
      setApproveModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Approval failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectPo = async () => {
    if (!id) return;
    if (!reason.trim()) {
      alert('A rejection reason is mandatory.');
      return;
    }
    try {
      setActionLoading(true);
      await purchaseOrdersApi.reject(id, reason.trim());
      setRejectModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Rejection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open delivery recording dialog and initialize remaining quantities
  const openDeliveryModal = () => {
    if (!po) return;
    setDeliveryError(null);
    const initialInputs: Record<string, number> = {};
    po.items.forEach((item) => {
      const remaining = Math.max(0, item.quantity - item.receivedQuantity);
      initialInputs[item.id] = remaining; // default to remaining
    });
    setReceivedInputs(initialInputs);
    setCondition('GOOD');
    setNotes('Goods received in satisfactory condition and verified by vessel staff.');
    setDeliveryModalOpen(true);
  };

  // Demo fill for PRD Section 52 scenario
  const prefillFullDemoDelivery = () => {
    if (!po) return;
    const inputs: Record<string, number> = {};
    po.items.forEach((item) => {
      inputs[item.id] = item.quantity - item.receivedQuantity;
    });
    setReceivedInputs(inputs);
    setCondition('GOOD');
    setNotes('Delivered to MV Ocean Star anchorage via supply launch. Inspected and verified intact.');
  };

  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !po) return;
    setDeliveryError(null);

    const itemsToSubmit = Object.entries(receivedInputs).map(([poItemId, qty]) => ({
      poItemId,
      quantityReceived: Number(qty),
    }));

    // Client validation
    for (const item of itemsToSubmit) {
      const poItem = po.items.find((i) => i.id === item.poItemId);
      if (poItem) {
        if (item.quantityReceived <= 0) {
          setDeliveryError(`Received quantity for "${poItem.itemName}" must be greater than zero.`);
          return;
        }
        const remaining = poItem.quantity - poItem.receivedQuantity;
        if (item.quantityReceived > remaining) {
          setDeliveryError(
            `Over-delivery not allowed: Attempting to receive ${item.quantityReceived} units of "${poItem.itemName}", but only ${remaining} unit(s) remaining.`
          );
          return;
        }
      }
    }

    if (deliveryDate) {
      const parsedDate = new Date(deliveryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (isNaN(parsedDate.getTime()) || parsedDate < today) {
        setDeliveryError('Receipt / delivery date cannot be in the past.');
        return;
      }
    }

    try {
      setSubmittingDelivery(true);
      await deliveriesApi.recordReceipt(id, {
        deliveryDate,
        condition,
        notes: notes.trim() || undefined,
        items: itemsToSubmit,
      });

      setDeliveryModalOpen(false);
      await loadData();
    } catch (err: any) {
      setDeliveryError(err.message || 'Failed to record goods receipt.');
    } finally {
      setSubmittingDelivery(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
        <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        <span>Loading purchase order document...</span>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
        <h3 className="text-sm font-semibold text-rose-900">Purchase Order Not Found</h3>
        <p className="text-xs text-rose-700">{error || 'Record unavailable.'}</p>
        <Link
          to="/purchase-orders"
          className="inline-block px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold"
        >
          Back to Purchase Orders
        </Link>
      </div>
    );
  }

  const isPendingApproval = po.status === 'PENDING_APPROVAL';
  const isOrdered = po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED';
  const isCompleted = po.status === 'COMPLETED' || po.status === 'RECEIVED';
  const canApprove =
    isPendingApproval && (user?.role === 'APPROVER' || user?.role === 'ADMIN');
  const canReceiveGoods =
    isOrdered && (user?.role === 'PROCUREMENT_OFFICER' || user?.role === 'ADMIN');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/purchase-orders"
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 font-mono tracking-tight">
                {po.poNumber}
              </h1>
              <StatusBadge status={po.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Supplier: <strong>{po.vendor?.name}</strong> • Vessel: <strong>{po.vessel?.name}</strong>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {canApprove && (
            <>
              <button
                onClick={() => setRejectModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold shadow-2xs"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>Reject PO</span>
              </button>
              <button
                onClick={() => setApproveModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Authorize & Place Order</span>
              </button>
            </>
          )}

          {canReceiveGoods && (
            <button
              onClick={openDeliveryModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Record Delivery / Goods Receipt</span>
            </button>
          )}

          {isCompleted && (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Procurement Fully Completed</span>
            </div>
          )}
        </div>
      </div>

      {/* Rejection Alert */}
      {po.status === 'REJECTED' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs">
          <div className="flex items-center gap-2 font-bold text-rose-900">
            <XCircle className="w-4 h-4 text-rose-600" />
            <span>Purchase Order Rejected</span>
          </div>
          <p className="text-rose-800 pl-6">
            <strong>Reason:</strong> {po.rejectionReason || 'No reason specified.'}
          </p>
        </div>
      )}

      {/* Official PO Document Surface */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* PO Document Header */}
        <div className="p-8 border-b border-slate-100 bg-slate-50/40">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div>
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                Official Purchase Order Document
              </span>
              <h2 className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-1">
                {po.poNumber}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Generated from Request: <strong className="text-slate-800">{po.purchaseRequest?.prNumber}</strong>
              </p>
            </div>

            <div className="text-right text-xs space-y-1">
              <p className="text-slate-500">
                Issued Date:{' '}
                <strong className="text-slate-900 font-mono">
                  {new Date(po.createdAt).toLocaleDateString([], {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
              </p>
              <p className="text-slate-500">
                Expected Delivery Date:{' '}
                <strong className="text-slate-900 font-mono">
                  {new Date(po.deliveryDate).toLocaleDateString([], {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
              </p>
              <p className="text-slate-500">
                Payment Terms: <strong className="text-slate-900">{po.paymentTerms}</strong>
              </p>
            </div>
          </div>

          {/* Supplier & Ship Entity Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 pt-6 border-t border-slate-200/80">
            <div className="space-y-1 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Vendor / Supplier
              </span>
              <h4 className="text-sm font-bold text-slate-900">{po.vendor?.name}</h4>
              <p className="text-slate-600">Contact: {po.vendor?.contactPerson}</p>
              <p className="text-slate-600">Email: {po.vendor?.email}</p>
              <p className="text-slate-600">Phone: {po.vendor?.phone}</p>
              <p className="text-slate-500">{po.vendor?.address}</p>
            </div>

            <div className="space-y-1 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Vessel & Consignee
              </span>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Anchor className="w-4 h-4 text-blue-600" />
                {po.vessel?.name}
              </h4>
              <p className="text-slate-600">IMO: {po.vessel?.imoNumber} • Type: {po.vessel?.type}</p>
              <p className="text-slate-600">Flag State: {po.vessel?.flag}</p>
              <p className="text-slate-600">
                Demanded By: {po.purchaseRequest?.department} Department
              </p>
            </div>
          </div>
        </div>

        {/* PO Line Items Table */}
        <div className="p-8">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
            Contracted Items & Quantities
          </h3>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 pr-4">#</th>
                  <th className="py-2.5 px-4">Item & Specification</th>
                  <th className="py-2.5 px-4 text-center">Ordered Qty</th>
                  <th className="py-2.5 px-4 text-center">Delivered Qty</th>
                  <th className="py-2.5 px-4 text-center">Remaining</th>
                  <th className="py-2.5 px-4 text-right">Unit Price</th>
                  <th className="py-2.5 pl-4 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {po.items.map((item, idx) => {
                  const remaining = Math.max(0, item.quantity - item.receivedQuantity);
                  const isFulfilled = item.receivedQuantity >= item.quantity;

                  return (
                    <tr key={item.id}>
                      <td className="py-3 pr-4 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{item.itemName}</span>
                        <span className="text-[11px] text-slate-500">{item.description}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700">
                        {item.receivedQuantity} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        {isFulfilled ? (
                          <span className="text-emerald-600 font-bold">Fulfilled</span>
                        ) : (
                          <span className="text-amber-700 font-bold">{remaining} {item.unit}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        ₹{item.unitPrice.toLocaleString()}
                      </td>
                      <td className="py-3 pl-4 text-right font-mono font-bold text-slate-900">
                        ₹{item.total.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td colSpan={6} className="py-2.5 text-right font-semibold text-slate-600">
                    Subtotal:
                  </td>
                  <td className="py-2.5 pl-4 text-right font-mono font-bold text-slate-900">
                    ₹{po.subtotal.toLocaleString()}
                  </td>
                </tr>
                {po.taxAmount > 0 && (
                  <tr>
                    <td colSpan={6} className="py-1 text-right text-slate-500">
                      Tax ({po.taxRate}%):
                    </td>
                    <td className="py-1 pl-4 text-right font-mono text-slate-700">
                      ₹{po.taxAmount.toLocaleString()}
                    </td>
                  </tr>
                )}
                <tr className="border-t border-slate-200 bg-slate-50/50">
                  <td colSpan={6} className="py-3 text-right font-bold text-slate-900 text-sm">
                    Final Purchase Order Total:
                  </td>
                  <td className="py-3 pl-4 text-right font-mono font-extrabold text-blue-950 text-base">
                    ₹{po.total.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Deliveries / Goods Receipt History */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card
            title={
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <span>Goods Receipts Log ({po.goodsReceipts?.length || 0})</span>
              </div>
            }
            subtitle="Recorded physical delivery shipments and condition inspections"
          >
            {!po.goodsReceipts || po.goodsReceipts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No delivery receipts logged yet. Goods will be recorded upon arrival at port or vessel.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {po.goodsReceipts.map((gr) => (
                  <div key={gr.id} className="py-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono">{gr.receiptNumber}</span>
                        <StatusBadge status={gr.condition} size="sm" />
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        {new Date(gr.deliveryDate).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Received by: <strong>{gr.receivedBy?.name || 'Vessel Officer'}</strong>
                    </p>
                    {gr.notes && (
                      <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded border border-slate-100">
                        "{gr.notes}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* PO Audit Trail */}
        <div>
          <Card title="PO Audit History">
            <div className="flow-root">
              <ul className="-mb-6">
                {auditLogs.map((log, idx) => (
                  <li key={log.id}>
                    <div className="relative pb-6">
                      {idx !== auditLogs.length - 1 && (
                        <span className="absolute top-4 left-2.5 -ml-px h-full w-0.5 bg-slate-200" />
                      )}
                      <div className="relative flex items-start space-x-2.5">
                        <div className="h-5 w-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[9px] font-bold ring-2 ring-white">
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1 text-xs">
                          <p className="font-semibold text-slate-800">
                            {log.action.replace(/_/g, ' ')}
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5">{log.description}</p>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                            {new Date(log.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
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
        title={`Authorize Purchase Order ${po.poNumber}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Authorizing <strong>{po.poNumber}</strong> with supplier{' '}
            <strong>{po.vendor?.name}</strong> for a total contract value of{' '}
            <strong>₹{po.total.toLocaleString()}</strong>.
          </p>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 font-medium">
            This will formally place the order and transition status to <strong>ORDERED</strong>.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Authorization Remarks (Optional)
            </label>
            <textarea
              rows={2}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="e.g. Authorized as per approved quotation and maintenance budget."
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
              onClick={handleApprovePo}
              disabled={actionLoading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              {actionLoading ? 'Authorizing...' : 'Authorize & Place Order'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title={`Reject Purchase Order ${po.poNumber}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Rejecting this PO will prevent it from proceeding to delivery until corrected and resubmitted.
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
              placeholder="State reason for rejecting this PO..."
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
              onClick={handleRejectPo}
              disabled={actionLoading || !reason.trim()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Record Delivery Modal */}
      <Modal
        isOpen={deliveryModalOpen}
        onClose={() => setDeliveryModalOpen(false)}
        title={`Record Goods Receipt for ${po.poNumber}`}
        maxWidth="lg"
      >
        <form onSubmit={handleDeliverySubmit} className="space-y-4">
          {deliveryError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{deliveryError}</span>
            </div>
          )}

          {/* PRD Step 8 Demo Fill Shortcut */}
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-950 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              PRD Demo Scenario 8 (Full Receipt):
            </span>
            <button
              type="button"
              onClick={prefillFullDemoDelivery}
              className="px-2.5 py-1 bg-white border border-blue-300 text-blue-800 text-[11px] font-bold rounded hover:bg-blue-100 transition-colors"
            >
              Fill 100% Goods Receipt
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Receipt / Delivery Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                min={new Date().toISOString().slice(0, 10)}
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Condition of Received Goods <span className="text-rose-500">*</span>
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600 font-semibold"
              >
                <option value="GOOD">GOOD (Satisfactory / Verified)</option>
                <option value="DAMAGED">DAMAGED (Rejected on Arrival)</option>
                <option value="PARTIALLY_DAMAGED">PARTIALLY DAMAGED</option>
              </select>
            </div>
          </div>

          {/* Line items quantity verification */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-2">
            <span className="text-xs font-bold text-slate-700 block mb-1">
              Verify Quantities Received Against Order
            </span>
            {po.items.map((item) => {
              const remaining = Math.max(0, item.quantity - item.receivedQuantity);

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 block">{item.itemName}</span>
                    <span className="text-[11px] text-slate-500">
                      Ordered: {item.quantity} • Already Received: {item.receivedQuantity} • Remaining:{' '}
                      <strong className="text-blue-700">{remaining}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-slate-600">Qty Now:</label>
                    <input
                      type="number"
                      min="1"
                      max={remaining}
                      value={receivedInputs[item.id] !== undefined ? receivedInputs[item.id] : remaining}
                      onChange={(e) =>
                        setReceivedInputs({
                          ...receivedInputs,
                          [item.id]: Number(e.target.value),
                        })
                      }
                      className="w-20 px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 text-center"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Delivery Notes / Inspection Remarks
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Delivered to anchorage and verified by 2nd Engineer."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeliveryModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingDelivery}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
            >
              {submittingDelivery ? 'Recording...' : 'Confirm Goods Receipt'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
