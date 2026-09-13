import React, { useEffect, useState } from 'react';
import {
  Truck,
  Search,
  CheckCircle,
  AlertTriangle,
  Anchor,
  Calendar,
  FileCheck,
  UserCheck,
  Eye,
  Package,
} from 'lucide-react';
import { deliveriesApi } from '../../services/api.js';
import { GoodsReceipt } from '../../types/index.js';
import { Card } from '../../components/Card.js';
import { Modal } from '../../components/Modal.js';

export const VendorDeliveriesList: React.FC = () => {
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');

  // View Details Modal
  const [selectedReceipt, setSelectedReceipt] = useState<GoodsReceipt | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadReceipts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await deliveriesApi.list({
        search: search.trim() || undefined,
        condition: conditionFilter || undefined,
      });
      setReceipts(res.receipts || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load delivery inspection records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, [conditionFilter]);

  const openViewModal = (grn: GoodsReceipt) => {
    setSelectedReceipt(grn);
    setModalOpen(true);
  };

  const getConditionBadge = (condition: string) => {
    switch (condition) {
      case 'GOOD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            Accepted (Good Condition)
          </span>
        );
      case 'DAMAGED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Damaged
          </span>
        );
      case 'INCOMPLETE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Discrepancy / Incomplete
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
            {condition}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-600" />
              Delivery Receipts & Vessel Inspections
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
              Vendor Portal
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent view into vessel crew inspection notes, verified physical counts, and signed goods receipt notices (GRNs).
          </p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by GRN #, PO #, or vessel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadReceipts()}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-slate-50/50"
          />
        </div>

        <select
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-600"
        >
          <option value="">All Inspection Conditions</option>
          <option value="GOOD">Good / Accepted</option>
          <option value="DAMAGED">Damaged</option>
          <option value="INCOMPLETE">Incomplete</option>
        </select>

        <button
          onClick={loadReceipts}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
        >
          Search
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-xs text-rose-800 font-medium">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Receipts Table */}
      <Card>
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading goods receipt records...</span>
          </div>
        ) : receipts.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <FileCheck className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">No Goods Receipts Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              When vessel officers receive and inspect your dispatched deliveries onboard, confirmed GRNs will be cataloged here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
              <thead className="bg-slate-50/70 font-semibold text-slate-600">
                <tr>
                  <th className="py-3.5 px-6">GRN Number</th>
                  <th className="py-3.5 px-4">PO Reference</th>
                  <th className="py-3.5 px-4">Receiving Vessel</th>
                  <th className="py-3.5 px-4">Inspection Date</th>
                  <th className="py-3.5 px-4">Condition</th>
                  <th className="py-3.5 px-4">Inspected By</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {receipts.map((grn) => (
                  <tr key={grn.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-6 font-bold text-indigo-700">
                      {grn.receiptNumber}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                      {grn.purchaseOrder?.poNumber || 'N/A'}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Anchor className="w-3.5 h-3.5 text-blue-600" />
                        <span>{grn.purchaseOrder?.vessel?.name || 'Vessel'}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(grn.deliveryDate).toLocaleDateString()}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {getConditionBadge(grn.condition)}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        <span>{grn.receivedBy?.name || 'Vessel Crew'}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => openViewModal(grn)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>Inspection Note</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* View GRN Details Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Goods Receipt Note: ${selectedReceipt?.receiptNumber}`}
        maxWidth="lg"
      >
        {selectedReceipt && (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">PO Reference</span>
                <span className="font-mono font-semibold text-slate-900">
                  {selectedReceipt.purchaseOrder?.poNumber}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Vessel</span>
                <span className="font-semibold text-slate-900">
                  {selectedReceipt.purchaseOrder?.vessel?.name}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Inspection Date</span>
                <span className="font-semibold text-slate-900">
                  {new Date(selectedReceipt.deliveryDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Result</span>
                <div>{getConditionBadge(selectedReceipt.condition)}</div>
              </div>
            </div>

            {selectedReceipt.notes && (
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg text-xs">
                <span className="font-bold text-blue-900 block mb-1">Vessel Inspection Remarks:</span>
                <p className="text-blue-800 leading-relaxed">{selectedReceipt.notes}</p>
              </div>
            )}

            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Received Line Items & Verified Counts
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold">
                    <tr>
                      <th className="py-2 px-3 text-left">Item Name</th>
                      <th className="py-2 px-3 text-center">Ordered Qty</th>
                      <th className="py-2 px-3 text-center">Verified Received</th>
                      <th className="py-2 px-3 text-center">Receipt Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {selectedReceipt.items?.map((item) => {
                      const orderedQty = item.poItem?.quantity || item.quantityReceived;
                      const isComplete = item.quantityReceived >= orderedQty;

                      return (
                        <tr key={item.id}>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {item.poItem?.itemName || 'Delivered Item'}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                            {orderedQty} {item.poItem?.unit || 'Units'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                            {item.quantityReceived} {item.poItem?.unit || 'Units'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isComplete ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                <CheckCircle className="w-3 h-3" />
                                100% Received
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                                <AlertTriangle className="w-3 h-3" />
                                Partial
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
