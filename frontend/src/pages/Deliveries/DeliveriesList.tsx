import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
  Calendar,
  Anchor,
  Building2,
  Eye,
} from 'lucide-react';
import { deliveriesApi } from '../../services/api.js';
import { GoodsReceipt } from '../../types/index.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { Card } from '../../components/Card.js';

export const DeliveriesList: React.FC = () => {
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');

  const loadDeliveries = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await deliveriesApi.list({
        search: search.trim() || undefined,
        condition: conditionFilter || undefined,
      });
      setReceipts(res.receipts || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch deliveries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, [conditionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDeliveries();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-600" />
            Deliveries & Goods Receipts (GRNs)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Physical receipt of materials, condition inspection records, and vessel delivery confirmations
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by GR #, PO #, vendor or vessel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadDeliveries()}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50/50"
          />
        </div>

        <select
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
        >
          <option value="">All Inspection Conditions</option>
          <option value="GOOD">Good (Verified / Accepted)</option>
          <option value="DAMAGED">Damaged</option>
          <option value="PARTIALLY_DAMAGED">Partially Damaged</option>
        </select>

        <button
          onClick={loadDeliveries}
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
            <div className="w-8 h-8 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Fetching delivery logs...</span>
          </div>
        ) : receipts.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Package className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">No Goods Receipts Logged</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Deliveries can be recorded on an approved & ordered Purchase Order once goods arrive.
            </p>
            <Link
              to="/purchase-orders"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
            >
              <span>View Active Purchase Orders</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
              <thead className="bg-slate-50/70 font-semibold text-slate-600">
                <tr>
                  <th className="py-3.5 px-6">Receipt #</th>
                  <th className="py-3.5 px-4">Purchase Order</th>
                  <th className="py-3.5 px-4">Vendor</th>
                  <th className="py-3.5 px-4">Vessel</th>
                  <th className="py-3.5 px-4">Delivery Date</th>
                  <th className="py-3.5 px-4">Items Received</th>
                  <th className="py-3.5 px-4">Condition</th>
                  <th className="py-3.5 px-4">Received By</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {receipts.map((gr) => (
                  <tr key={gr.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-6 font-bold text-orange-600 font-mono">
                      {gr.receiptNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-purple-700">
                      <Link
                        to={`/purchase-orders/${gr.purchaseOrderId}`}
                        className="hover:underline"
                      >
                        {gr.purchaseOrder?.poNumber}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {gr.purchaseOrder?.vendor?.name}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {gr.purchaseOrder?.vessel?.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {new Date(gr.deliveryDate).toLocaleDateString([], {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      {gr.items && gr.items.length > 0 ? (
                        <div className="space-y-0.5">
                          {gr.items.map((it) => (
                            <span key={it.id} className="block text-[11px] font-medium text-slate-700">
                              {it.poItem?.itemName}: <strong>{it.quantityReceived} units</strong>
                            </span>
                          ))}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={gr.condition} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {gr.receivedBy?.name || 'Vessel Officer'}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <Link
                        to={`/purchase-orders/${gr.purchaseOrderId}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View PO</span>
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
