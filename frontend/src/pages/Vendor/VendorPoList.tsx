import React, { useEffect, useState } from 'react';
import {
  ShoppingCart,
  Search,
  CheckCircle,
  Truck,
  Anchor,
  Clock,
  AlertCircle,
  FileText,
  Calendar,
  Send,
  Eye,
  Package,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { purchaseOrdersApi } from '../../services/api.js';
import { PurchaseOrder } from '../../types/index.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { Card } from '../../components/Card.js';
import { Modal } from '../../components/Modal.js';
import { useAuth } from '../../context/AuthContext.js';

export const VendorPoList: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected PO for view or action
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  // Acknowledge Modal
  const [ackModalOpen, setAckModalOpen] = useState(false);
  const [ackDeliveryDate, setAckDeliveryDate] = useState('');
  const [ackNotes, setAckNotes] = useState('');
  const [acking, setAcking] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);

  // Dispatch Modal
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [carrierName, setCarrierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [dispatchDate, setDispatchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [dispatchEstDate, setDispatchEstDate] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await purchaseOrdersApi.list({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
      });
      setOrders(res.purchaseOrders || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const openAcknowledgeModal = (po: PurchaseOrder) => {
    setSelectedPo(po);
    setAckDeliveryDate(po.deliveryDate ? po.deliveryDate.slice(0, 10) : '');
    setAckNotes('');
    setAckError(null);
    setAckModalOpen(true);
  };

  const handleAcknowledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPo) return;
    try {
      setAcking(true);
      setAckError(null);
      await purchaseOrdersApi.acknowledge(selectedPo.id, {
        estimatedDeliveryDate: ackDeliveryDate ? new Date(ackDeliveryDate).toISOString() : undefined,
        notes: ackNotes.trim() || undefined,
      });
      setAckModalOpen(false);
      await loadOrders();
    } catch (err: any) {
      setAckError(err.message || 'Failed to acknowledge purchase order.');
    } finally {
      setAcking(false);
    }
  };

  const openDispatchModal = (po: PurchaseOrder) => {
    setSelectedPo(po);
    setCarrierName(po.carrierName || '');
    setTrackingNumber(po.trackingNumber || '');
    setDispatchDate(po.dispatchedAt ? po.dispatchedAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setDispatchEstDate(po.estimatedDeliveryDate ? po.estimatedDeliveryDate.slice(0, 10) : (po.deliveryDate ? po.deliveryDate.slice(0, 10) : ''));
    setDispatchNotes(po.dispatchNotes || '');
    setDispatchError(null);
    setDispatchModalOpen(true);
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPo) return;
    if (!carrierName.trim() || !trackingNumber.trim()) {
      setDispatchError('Carrier name and tracking number are required.');
      return;
    }

    try {
      setDispatching(true);
      setDispatchError(null);
      await purchaseOrdersApi.dispatch(selectedPo.id, {
        carrierName: carrierName.trim(),
        trackingNumber: trackingNumber.trim(),
        dispatchedAt: dispatchDate ? new Date(dispatchDate).toISOString() : undefined,
        estimatedDeliveryDate: dispatchEstDate ? new Date(dispatchEstDate).toISOString() : undefined,
        dispatchNotes: dispatchNotes.trim() || undefined,
      });
      setDispatchModalOpen(false);
      await loadOrders();
    } catch (err: any) {
      setDispatchError(err.message || 'Failed to submit shipment dispatch details.');
    } finally {
      setDispatching(false);
    }
  };

  const openViewModal = (po: PurchaseOrder) => {
    setSelectedPo(po);
    setViewModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-indigo-600" />
              Purchase Orders & Dispatch Fulfillment
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
              Vendor Portal
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Acknowledge awarded maritime purchase orders, record shipment logistics tracking, and monitor vessel delivery receipts.
          </p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by PO #, Vessel, or PR ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadOrders()}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-slate-50/50"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-600"
        >
          <option value="">All PO Statuses</option>
          <option value="APPROVED">Approved / Issued</option>
          <option value="ORDERED">Dispatched / In Transit</option>
          <option value="RECEIVED">Received by Vessel</option>
        </select>

        <button
          onClick={loadOrders}
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

      {/* Purchase Orders Table */}
      <Card>
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading purchase orders...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Package className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">No Purchase Orders Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              When procurement officers award tenders and release official purchase orders to your company, they will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
              <thead className="bg-slate-50/70 font-semibold text-slate-600">
                <tr>
                  <th className="py-3.5 px-6">PO Number</th>
                  <th className="py-3.5 px-4">Vessel Destination</th>
                  <th className="py-3.5 px-4">Order Value</th>
                  <th className="py-3.5 px-4">Target Delivery</th>
                  <th className="py-3.5 px-4">Order Status</th>
                  <th className="py-3.5 px-4">Shipment Fulfillment</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {orders.map((po) => {
                  const isAcknowledged = !!po.acknowledgedAt;
                  const isDispatched = !!po.dispatchedAt;
                  const isDelivered = po.status === 'RECEIVED' || po.status === 'COMPLETED';

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-6 font-bold text-indigo-700">
                        {po.poNumber}
                        <div className="text-[10px] text-slate-400 font-normal font-mono">
                          PR: {po.purchaseRequest?.prNumber || 'N/A'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <Anchor className="w-3.5 h-3.5 text-blue-600" />
                          <span>{po.vessel?.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          IMO: {po.vessel?.imoNumber} • {po.vessel?.flag}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 font-mono text-sm">
                          ${po.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {po.paymentTerms || 'Standard Terms'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(po.deliveryDate).toLocaleDateString()}</span>
                        </div>
                        {po.estimatedDeliveryDate && (
                          <div className="text-[10px] text-indigo-600 font-medium">
                            Vendor Est: {new Date(po.estimatedDeliveryDate).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={po.status} size="sm" />
                      </td>

                      <td className="py-3.5 px-4">
                        {isDelivered ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle className="w-3 h-3" />
                            Delivered to Vessel
                          </span>
                        ) : isDispatched ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
                              <Truck className="w-3 h-3 text-indigo-600" />
                              Dispatched ({po.carrierName})
                            </span>
                            <div className="text-[10px] font-mono text-slate-500">
                              Track: {po.trackingNumber}
                            </div>
                          </div>
                        ) : isAcknowledged ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              <CheckCircle className="w-3 h-3 text-blue-600" />
                              Acknowledged
                            </span>
                            <div className="text-[10px] text-slate-400">
                              Awaiting Shipment
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Acknowledgment Needed
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-6 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => openViewModal(po)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-indigo-600 transition-colors inline-flex items-center"
                          title="View PO Line Items"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {!isAcknowledged && !isDelivered && (
                          <button
                            onClick={() => openAcknowledgeModal(po)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
                          >
                            <CheckCircle className="w-3 h-3" />
                            <span>Acknowledge</span>
                          </button>
                        )}

                        {!isDelivered && (
                          <button
                            onClick={() => openDispatchModal(po)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
                          >
                            <Truck className="w-3 h-3" />
                            <span>{isDispatched ? 'Update Tracking' : 'Dispatch'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Acknowledge PO Modal */}
      <Modal
        isOpen={ackModalOpen}
        onClose={() => setAckModalOpen(false)}
        title={`Acknowledge Purchase Order: ${selectedPo?.poNumber}`}
        maxWidth="md"
      >
        <form onSubmit={handleAcknowledgeSubmit} className="space-y-4">
          {ackError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
              {ackError}
            </div>
          )}

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 leading-relaxed">
            By acknowledging this order, you confirm acceptance of the specified terms, quantities, and schedule for vessel{' '}
            <strong>{selectedPo?.vessel?.name}</strong>.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Estimated Vessel Delivery Date
            </label>
            <input
              type="date"
              value={ackDeliveryDate}
              onChange={(e) => setAckDeliveryDate(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-600"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Contract target date: {selectedPo?.deliveryDate && new Date(selectedPo.deliveryDate).toLocaleDateString()}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Acknowledgment Notes / Confirmation Remarks
            </label>
            <textarea
              rows={3}
              value={ackNotes}
              onChange={(e) => setAckNotes(e.target.value)}
              placeholder="e.g. Order processed; items currently being packaged in warehouse."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAckModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={acking}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{acking ? 'Confirming...' : 'Confirm Acknowledgment'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Dispatch Shipment Modal */}
      <Modal
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        title={`Submit Dispatch & Logistics Info: ${selectedPo?.poNumber}`}
        maxWidth="md"
      >
        <form onSubmit={handleDispatchSubmit} className="space-y-4">
          {dispatchError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
              {dispatchError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Carrier / Logistics Provider <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                placeholder="e.g. DHL Global / Port Launch"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tracking / Waybill # <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. AWB-92817401"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-600 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dispatch Date
              </label>
              <input
                type="date"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estimated Delivery to Vessel
              </label>
              <input
                type="date"
                value={dispatchEstDate}
                onChange={(e) => setDispatchEstDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Dispatch Instructions & Packaging Notes
            </label>
            <textarea
              rows={3}
              value={dispatchNotes}
              onChange={(e) => setDispatchNotes(e.target.value)}
              placeholder="e.g. Packed in 2 wooden crates with maritime waterproof wrapping. Delivered to Terminal 3 Cargo Gate."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setDispatchModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={dispatching}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>{dispatching ? 'Saving Tracking...' : 'Save Dispatch Tracking'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* View PO Details Modal */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title={`Purchase Order Details: ${selectedPo?.poNumber}`}
        maxWidth="lg"
      >
        {selectedPo && (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Vessel</span>
                <span className="font-semibold text-slate-900">{selectedPo.vessel?.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Target Date</span>
                <span className="font-semibold text-slate-900">
                  {new Date(selectedPo.deliveryDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Payment Terms</span>
                <span className="font-semibold text-slate-900">{selectedPo.paymentTerms}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Status</span>
                <StatusBadge status={selectedPo.status} size="sm" />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Order Line Items
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold">
                    <tr>
                      <th className="py-2 px-3 text-left">Item Name</th>
                      <th className="py-2 px-3 text-center">Qty</th>
                      <th className="py-2 px-3 text-right">Unit Price</th>
                      <th className="py-2 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {selectedPo.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{item.itemName}</div>
                          {item.description && (
                            <div className="text-[11px] text-slate-500">{item.description}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-700 font-medium">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          ${item.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          ${item.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold">
                    <tr>
                      <td colSpan={3} className="py-2 px-3 text-right text-slate-700">
                        Order Total:
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-sm font-bold text-indigo-700">
                        ${selectedPo.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
