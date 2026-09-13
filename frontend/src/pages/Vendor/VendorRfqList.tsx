import React, { useEffect, useState } from 'react';
import {
  Layers,
  Search,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  DollarSign,
  Truck,
  Edit3,
  Check,
  Send,
  Building2,
  Anchor,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { rfqsApi } from '../../services/api.js';
import { Rfq, Quotation, PurchaseRequestItem } from '../../types/index.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { Card } from '../../components/Card.js';
import { Modal } from '../../components/Modal.js';
import { useAuth } from '../../context/AuthContext.js';

interface QuotationItemDraft {
  purchaseRequestItemId?: string;
  itemName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export const VendorRfqList: React.FC = () => {
  const { user } = useAuth();
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Submit / Revise Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<Rfq | null>(null);
  const [existingQuote, setExistingQuote] = useState<Quotation | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Form State
  const [quotationNumber, setQuotationNumber] = useState('');
  const [deliveryDays, setDeliveryDays] = useState(7);
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days');
  const [notes, setNotes] = useState('');
  const [itemDrafts, setItemDrafts] = useState<QuotationItemDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
      setError(err.message || 'Failed to load tender invitations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRfqs();
  }, [statusFilter]);

  // Open modal for new quote or revision
  const handleOpenQuoteModal = (rfq: Rfq, readOnlyMode = false) => {
    setSelectedRfq(rfq);
    setIsReadOnly(readOnlyMode);
    setFormError(null);

    // Find vendor's own quotation if already submitted (backend strictly scopes quotations for vendors)
    const myQuote =
      rfq.quotations?.find((q) => q.vendorId === user?.vendorId) ||
      (rfq.quotations && rfq.quotations.length > 0 ? rfq.quotations[0] : null);
    setExistingQuote(myQuote);

    const prItems = rfq.purchaseRequest?.items || [];

    if (myQuote) {
      setQuotationNumber(myQuote.quotationNumber);
      setDeliveryDays(myQuote.deliveryDays || 7);
      setPaymentTerms(myQuote.paymentTerms || user?.vendor?.paymentTerms || 'Net 30 Days');
      setNotes(myQuote.notes || '');

      // Initialize line items from quotation items or fallback to PR items
      if (myQuote.items && myQuote.items.length > 0) {
        setItemDrafts(
          myQuote.items.map((qi) => ({
            purchaseRequestItemId: qi.purchaseRequestItemId || '',
            itemName: qi.itemName,
            description: qi.description || '',
            quantity: qi.quantity,
            unit: qi.unit,
            unitPrice: qi.unitPrice,
            total: qi.total,
          }))
        );
      } else {
        // Distribute or single item
        setItemDrafts(
          prItems.map((pi) => {
            const up = pi.quantity > 0 ? myQuote.totalPrice / pi.quantity : 0;
            return {
              purchaseRequestItemId: pi.id,
              itemName: pi.itemName,
              description: pi.description || '',
              quantity: pi.quantity,
              unit: pi.unit,
              unitPrice: Math.round(up * 100) / 100,
              total: Math.round(up * pi.quantity * 100) / 100,
            };
          })
        );
      }
    } else {
      // New quote preparation
      setQuotationNumber(`QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setDeliveryDays(7);
      setPaymentTerms(user?.vendor?.paymentTerms || 'Net 30 Days');
      setNotes('');

      setItemDrafts(
        prItems.map((pi: PurchaseRequestItem) => ({
          purchaseRequestItemId: pi.id,
          itemName: pi.itemName,
          description: pi.description || '',
          quantity: pi.quantity,
          unit: pi.unit,
          unitPrice: pi.estimatedUnitPrice || 0,
          total: (pi.estimatedUnitPrice || 0) * pi.quantity,
        }))
      );
    }

    setModalOpen(true);
  };

  const handleUnitPriceChange = (index: number, newPrice: number) => {
    setItemDrafts((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      item.unitPrice = Math.max(0, newPrice);
      item.total = Math.round(item.unitPrice * item.quantity * 100) / 100;
      updated[index] = item;
      return updated;
    });
  };

  const calculatedSubtotal = itemDrafts.reduce((sum, itm) => sum + itm.total, 0);

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRfq) return;
    setFormError(null);

    if (!quotationNumber.trim()) {
      setFormError('Quotation number is required.');
      return;
    }

    if (calculatedSubtotal <= 0) {
      setFormError('Total quotation price must be greater than zero. Please provide item unit prices.');
      return;
    }

    try {
      setSubmitting(true);
      await rfqsApi.addQuotation(selectedRfq.id, {
        quotationNumber: quotationNumber.trim(),
        totalPrice: calculatedSubtotal,
        deliveryDays: Number(deliveryDays) || 0,
        paymentTerms: paymentTerms.trim(),
        notes: notes.trim() || undefined,
        items: itemDrafts.map((d) => ({
          purchaseRequestItemId: d.purchaseRequestItemId,
          itemName: d.itemName,
          description: d.description,
          quantity: d.quantity,
          unit: d.unit,
          unitPrice: d.unitPrice,
          total: d.total,
        })),
      });

      setModalOpen(false);
      await loadRfqs();
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit quotation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Tender Invitations & Quotations
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
              Vendor Portal
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Review RFQs invited by procurement officers, submit blind competitive bids, and update pricing prior to deadlines.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Blind Tendering Protection Active</span>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by RFQ #, PR #, vessel, or item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadRfqs()}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-slate-50/50"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-600"
        >
          <option value="">All Tender Statuses</option>
          <option value="OPEN">Open for Bidding</option>
          <option value="CLOSED">Closed / Under Review</option>
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

      {/* Tender List */}
      <Card>
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading tender invitations...</span>
          </div>
        ) : rfqs.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">No Tender Invitations</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You currently have no active or historical RFQ invitations matching your filters. When procurement officers invite your company to bid, tenders will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
              <thead className="bg-slate-50/70 font-semibold text-slate-600">
                <tr>
                  <th className="py-3.5 px-6">Tender #</th>
                  <th className="py-3.5 px-4">Vessel & PR Ref</th>
                  <th className="py-3.5 px-4">Requested Items</th>
                  <th className="py-3.5 px-4">Submission Deadline</th>
                  <th className="py-3.5 px-4">Tender Status</th>
                  <th className="py-3.5 px-4">Your Bid Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {rfqs.map((rfq) => {
                  const myQuote =
                    rfq.quotations?.find((q) => q.vendorId === user?.vendorId) ||
                    (rfq.quotations && rfq.quotations.length > 0 ? rfq.quotations[0] : null);
                  const isDeadlinePassed = new Date(rfq.deadline) < new Date();
                  const canSubmitOrRevise = rfq.status === 'OPEN' && !isDeadlinePassed;

                  return (
                    <tr key={rfq.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-6 font-bold text-indigo-700">
                        {rfq.rfqNumber}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <Anchor className="w-3.5 h-3.5 text-blue-600" />
                          <span>{rfq.purchaseRequest?.vessel?.name || 'Vessel Fleet'}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          PR Ref: <span className="font-mono font-medium">{rfq.purchaseRequest?.prNumber}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-medium truncate max-w-[200px]" title={rfq.purchaseRequest?.items?.map(i => i.itemName).join(', ')}>
                          {rfq.purchaseRequest?.items?.[0]?.itemName}
                          {(rfq.purchaseRequest?.items?.length || 0) > 1 && (
                            <span className="ml-1 text-slate-400 font-normal">
                              +{((rfq.purchaseRequest?.items?.length || 1) - 1)} more
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {rfq.purchaseRequest?.department || 'Operations'} Department
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Clock className={`w-3.5 h-3.5 ${isDeadlinePassed ? 'text-rose-500' : 'text-amber-600'}`} />
                          <span>{new Date(rfq.deadline).toLocaleDateString()}</span>
                        </div>
                        <div className="text-[10px] mt-0.5">
                          {isDeadlinePassed ? (
                            <span className="text-rose-600 font-semibold">Deadline passed</span>
                          ) : (
                            <span className="text-emerald-700 font-medium">Accepting quotes</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={rfq.status} size="sm" />
                      </td>

                      <td className="py-3.5 px-4">
                        {myQuote ? (
                          myQuote.status === 'SELECTED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Check className="w-3 h-3" />
                              Awarded (${Number(myQuote.totalPrice || 0).toLocaleString()})
                            </span>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                                Submitted: ${Number(myQuote.totalPrice || 0).toLocaleString()}
                              </span>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {myQuote.quotationNumber}
                              </div>
                            </div>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                            Quote Pending
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-6 text-right">
                        {canSubmitOrRevise ? (
                          myQuote ? (
                            <button
                              onClick={() => handleOpenQuoteModal(rfq, false)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Revise Quote</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenQuoteModal(rfq, false)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Submit Bid</span>
                            </button>
                          )
                        ) : (
                          myQuote && (
                            <button
                              onClick={() => handleOpenQuoteModal(rfq, true)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-500" />
                              <span>View Quote</span>
                            </button>
                          )
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

      {/* Submit / Revise Quotation Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          isReadOnly
            ? `Quotation Details: ${selectedRfq?.rfqNumber}`
            : existingQuote
            ? `Revise Bid: ${selectedRfq?.rfqNumber}`
            : `Submit Quotation: ${selectedRfq?.rfqNumber}`
        }
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmitQuote} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
              {formError}
            </div>
          )}

          {/* Tender Meta Info Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Vessel & Fleet</span>
              <span className="font-semibold text-slate-900 flex items-center gap-1 mt-0.5">
                <Anchor className="w-3.5 h-3.5 text-blue-600" />
                {selectedRfq?.purchaseRequest?.vessel?.name}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">PR Reference</span>
              <span className="font-mono font-medium text-slate-800 mt-0.5 block">
                {selectedRfq?.purchaseRequest?.prNumber}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Bidding Deadline</span>
              <span className="font-semibold text-amber-700 mt-0.5 block">
                {selectedRfq && new Date(selectedRfq.deadline).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Itemized Pricing Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Requested Item Specifications & Pricing
              </h3>
              <span className="text-[11px] text-slate-500">
                All prices quoted in USD ($)
              </span>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2 px-3 text-left">Item Description</th>
                    <th className="py-2 px-3 text-center w-20">Qty</th>
                    <th className="py-2 px-3 text-right w-32">Unit Price ($)</th>
                    <th className="py-2 px-3 text-right w-28">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {itemDrafts.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{item.itemName}</div>
                        {item.description && (
                          <div className="text-[11px] text-slate-500">{item.description}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-700 font-medium">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {isReadOnly ? (
                          <span className="font-mono font-semibold text-slate-900">
                            ${Number(item.unitPrice || 0).toFixed(2)}
                          </span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={item.unitPrice || ''}
                            onChange={(e) => handleUnitPriceChange(idx, parseFloat(e.target.value) || 0)}
                            className="w-full text-right px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-600 bg-white"
                            placeholder="0.00"
                          />
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        ${Number(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold">
                  <tr>
                    <td colSpan={3} className="py-2 px-3 text-right text-slate-700">
                      Quotation Subtotal:
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-sm font-bold text-indigo-700">
                      ${Number(calculatedSubtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Quotation Details Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quotation Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isReadOnly}
                value={quotationNumber}
                onChange={(e) => setQuotationNumber(e.target.value)}
                placeholder="e.g. QT-2026-9102"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-600 disabled:bg-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lead Time (Days) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                required
                disabled={isReadOnly}
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(parseInt(e.target.value) || 0)}
                placeholder="e.g. 7"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-600 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Terms <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isReadOnly}
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g. Net 30 Days"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-600 disabled:bg-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Vendor Remarks & Delivery Conditions
            </label>
            <textarea
              rows={2}
              disabled={isReadOnly}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. FOB Singapore anchorage; Class certification certificates included."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-600 disabled:bg-slate-100"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Quotes can be revised anytime before the deadline.</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              {!isReadOnly && (
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Saving...' : existingQuote ? 'Save Revision' : 'Submit Quotation'}</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
