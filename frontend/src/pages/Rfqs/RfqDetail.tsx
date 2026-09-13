import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Layers,
  Plus,
  CheckCircle2,
  Trophy,
  Clock,
  DollarSign,
  AlertCircle,
  Building2,
  Calendar,
  Sparkles,
  ShieldCheck,
  ShoppingCart,
  Send,
  Eye,
  XCircle,
} from 'lucide-react';
import { rfqsApi, purchaseOrdersApi } from '../../services/api.js';
import { Rfq, Quotation, AuditLog } from '../../types/index.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { Card } from '../../components/Card.js';
import { Modal } from '../../components/Modal.js';
import { useAuth } from '../../context/AuthContext.js';

export const RfqDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Quotation Modal State
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [quoteNumber, setQuoteNumber] = useState('');
  const [totalPrice, setTotalPrice] = useState<number | ''>('');
  const [deliveryDays, setDeliveryDays] = useState<number | ''>(5);
  const [paymentTerms, setPaymentTerms] = useState('30 Days');
  const [notes, setNotes] = useState('');
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Winner Selection Modal State
  const [selectWinnerModalOpen, setSelectWinnerModalOpen] = useState(false);
  const [targetQuote, setTargetQuote] = useState<Quotation | null>(null);
  const [selectionReason, setSelectionReason] = useState(
    'Fastest delivery required due to scheduled vessel maintenance.'
  );
  const [selectionSubmitting, setSelectionSubmitting] = useState(false);

  // PO Generation State
  const [generatingPo, setGeneratingPo] = useState(false);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await rfqsApi.getById(id);
      setRfq(res.rfq);
      setAuditLogs(res.auditLogs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load RFQ record.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Open modal with vendor pre-selected
  const openAddQuoteModal = (vendorId?: string) => {
    setQuoteError(null);
    if (vendorId) {
      setSelectedVendorId(vendorId);
    } else {
      const pendingVendor = rfq?.rfqVendors.find(
        (rv) => !rfq.quotations.some((q) => q.vendorId === rv.vendorId)
      );
      if (pendingVendor) setSelectedVendorId(pendingVendor.vendorId);
    }
    setQuoteNumber(`QT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
    setTotalPrice('');
    setDeliveryDays(5);
    setPaymentTerms('30 Days');
    setNotes('');
    setQuoteModalOpen(true);
  };

  // Pre-fill demo quotes per PRD Section 48
  const prefillDemoQuote = (vendorNameSnippet: string) => {
    if (!rfq) return;
    const rv = rfq.rfqVendors.find((v) =>
      v.vendor.name.toLowerCase().includes(vendorNameSnippet.toLowerCase())
    );
    if (rv) {
      setSelectedVendorId(rv.vendorId);
      if (vendorNameSnippet === 'MarineParts') {
        setQuoteNumber('QT-2026-MP82');
        setTotalPrice(82000);
        setDeliveryDays(5);
        setPaymentTerms('30 Days');
        setNotes('Standard OEM replacement filters from Singapore warehouse stock.');
      } else if (vendorNameSnippet === 'OceanSupply') {
        setQuoteNumber('QT-2026-OS78');
        setTotalPrice(78000);
        setDeliveryDays(12);
        setPaymentTerms('45 Days');
        setNotes('Budget bulk pack shipped via Rotterdam distribution hub.');
      } else if (vendorNameSnippet === 'ShipTech') {
        setQuoteNumber('QT-2026-ST91');
        setTotalPrice(91000);
        setDeliveryDays(3);
        setPaymentTerms('30 Days');
        setNotes('Expedited direct launch delivery to vessel anchorage.');
      }
    }
  };

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedVendorId || !quoteNumber.trim() || !totalPrice) {
      setQuoteError('Please complete all required fields.');
      return;
    }

    try {
      setQuoteSubmitting(true);
      await rfqsApi.addQuotation(id, {
        vendorId: selectedVendorId,
        quotationNumber: quoteNumber.trim(),
        totalPrice: Number(totalPrice),
        deliveryDays: Number(deliveryDays) || 0,
        paymentTerms,
        notes: notes.trim() || undefined,
      });

      setQuoteModalOpen(false);
      await loadData();
    } catch (err: any) {
      setQuoteError(err.message || 'Failed to submit quotation.');
    } finally {
      setQuoteSubmitting(false);
    }
  };

  const openSelectWinner = (quote: Quotation) => {
    setTargetQuote(quote);
    if (quote.vendor.name.includes('ShipTech')) {
      setSelectionReason('Fastest delivery required due to scheduled vessel maintenance.');
    } else {
      setSelectionReason('Selected based on optimal price-to-delivery balance for fleet requirements.');
    }
    setSelectWinnerModalOpen(true);
  };

  const handleSelectWinnerSubmit = async () => {
    if (!id || !targetQuote) return;
    try {
      setSelectionSubmitting(true);
      await rfqsApi.selectQuotation(id, {
        quotationId: targetQuote.id,
        selectionReason: selectionReason.trim() || undefined,
      });
      setSelectWinnerModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to select quotation.');
    } finally {
      setSelectionSubmitting(false);
    }
  };

  const handleGeneratePo = async () => {
    if (!rfq) return;
    const activePo = rfq.purchaseRequest?.purchaseOrders?.find((po: any) => po.status !== 'REJECTED');
    if (activePo || ['ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'COMPLETED'].includes(rfq.purchaseRequest?.status as string)) {
      alert(`A purchase order has already been created for this request (${activePo?.poNumber || 'PO Issued'}).`);
      return;
    }
    try {
      setGeneratingPo(true);
      const res = await purchaseOrdersApi.create({
        purchaseRequestId: rfq.purchaseRequestId,
        deliveryDate: new Date(
          Date.now() + ((winningQuote?.deliveryDays || 5) * 24 * 60 * 60 * 1000)
        ).toISOString(),
      });
      navigate(`/purchase-orders/${res.purchaseOrder.id}`);
    } catch (err: any) {
      alert(err.message || 'Failed to generate purchase order.');
    } finally {
      setGeneratingPo(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span>Loading RFQ details & quotes matrix...</span>
      </div>
    );
  }

  if (error || !rfq) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
        <h3 className="text-sm font-semibold text-rose-900">RFQ Not Found</h3>
        <p className="text-xs text-rose-700">{error || 'RFQ record unavailable.'}</p>
        <Link
          to="/rfqs"
          className="inline-block px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700"
        >
          Back to RFQs
        </Link>
      </div>
    );
  }

  const canManageQuotes =
    (user?.role === 'PROCUREMENT_OFFICER' || user?.role === 'ADMIN');

  const winningQuote = rfq.quotations.find((q) => q.status === 'SELECTED');
  const hasWinner = !!winningQuote;
  const activePo = rfq.purchaseRequest?.purchaseOrders?.find((po: any) => po.status !== 'REJECTED');
  const rejectedPo = rfq.purchaseRequest?.purchaseOrders?.find((po: any) => po.status === 'REJECTED');
  const hasActivePo = !!activePo;
  const prStatus = rfq.purchaseRequest?.status;
  const isPoRejected = !hasActivePo && (!!rejectedPo || prStatus === 'PO_CREATED');
  const isPoIssued = hasActivePo || ['ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'COMPLETED'].includes(prStatus as string);
  const isPrCompleted = prStatus === 'COMPLETED';
  const canGeneratePo = canManageQuotes && hasWinner && !hasActivePo && !isPoIssued && !isPrCompleted;

  // Comparison Matrix stats
  const quotesWithPrices = rfq.quotations.filter((q) => q.totalPrice > 0);
  const lowestPrice =
    quotesWithPrices.length > 0
      ? Math.min(...quotesWithPrices.map((q) => q.totalPrice))
      : 0;
  const fastestDelivery =
    quotesWithPrices.length > 0
      ? Math.min(...quotesWithPrices.map((q) => q.deliveryDays))
      : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/rfqs"
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 font-mono tracking-tight">
                {rfq.rfqNumber}
              </h1>
              <StatusBadge status={rfq.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Associated PR: <strong>{rfq.purchaseRequest?.prNumber}</strong> ({rfq.purchaseRequest?.vessel?.name}) •{' '}
              Deadline: {new Date(rfq.deadline).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {canManageQuotes && !hasWinner && (
            <button
              onClick={() => openAddQuoteModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Vendor Quotation</span>
            </button>
          )}

          {isPoIssued && activePo ? (
            <Link
              to={`/purchase-orders/${activePo.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>View Purchase Order ({activePo.poNumber})</span>
            </Link>
          ) : isPoIssued ? (
            <Link
              to="/purchase-orders"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>View Purchase Orders</span>
            </Link>
          ) : (
            canGeneratePo && (
              <div className="flex items-center gap-2">
                {isPoRejected && rejectedPo && (
                  <Link
                    to={`/purchase-orders/${rejectedPo.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>View Rejected PO ({rejectedPo.poNumber})</span>
                  </Link>
                )}
                <button
                  onClick={handleGeneratePo}
                  disabled={generatingPo}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>{generatingPo ? 'Drafting PO...' : isPoRejected ? 'Re-issue Purchase Order' : 'Generate Purchase Order'}</span>
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* PO Rejection Alert Banner */}
      {isPoRejected && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-lg">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-rose-950">
                  Purchase Order Rejected by Manager {rejectedPo ? `(${rejectedPo.poNumber})` : ''}
                </h3>
                <StatusBadge status="PO_REJECTED" size="sm" />
              </div>
              <p className="text-xs text-rose-800 mt-1">
                {rejectedPo?.rejectionReason
                  ? `Manager's rejection note: "${rejectedPo.rejectionReason}"`
                  : 'The previous purchase order was rejected during manager approval.'}
              </p>
              <p className="text-[11px] text-rose-700 mt-0.5">
                Review the rejection feedback. You can re-issue a corrected purchase order or switch to another supplier proposal in the comparison matrix below.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {rejectedPo && (
              <Link
                to={`/purchase-orders/${rejectedPo.id}`}
                className="px-3.5 py-2 bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold shadow-2xs transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
              >
                <span>View Rejected PO</span>
              </Link>
            )}
            {canGeneratePo && (
              <button
                onClick={handleGeneratePo}
                disabled={generatingPo}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>{generatingPo ? 'Drafting PO...' : 'Re-issue Purchase Order →'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Winning Supplier Banner if Selected */}
      {winningQuote && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-lg">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-950">
                Winning Supplier Selected: {winningQuote.vendor?.name}
              </h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Quote #{winningQuote.quotationNumber} • ₹{winningQuote.totalPrice.toLocaleString()} •{' '}
                {winningQuote.deliveryDays} Days Delivery • {winningQuote.paymentTerms}
              </p>
              {winningQuote.selectionReason && (
                <p className="text-xs text-emerald-700 mt-1 italic">
                  Rationale: "{winningQuote.selectionReason}"
                </p>
              )}
            </div>
          </div>
          {isPoIssued ? (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {isPrCompleted ? 'Procurement Completed • ' : ''}PO Issued {activePo ? `(${activePo.poNumber})` : ''}
                </span>
              </span>
              {activePo && (
                <Link
                  to={`/purchase-orders/${activePo.id}`}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs whitespace-nowrap inline-flex items-center gap-1"
                >
                  <span>View PO &rarr;</span>
                </Link>
              )}
            </div>
          ) : canGeneratePo ? (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {isPoRejected && rejectedPo && (
                <span className="text-xs text-rose-700 font-semibold flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>PO {rejectedPo.poNumber} Rejected</span>
                </span>
              )}
              <button
                onClick={handleGeneratePo}
                disabled={generatingPo}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs whitespace-nowrap"
              >
                {isPoRejected ? 'Re-issue Purchase Order \u2192' : 'Issue Purchase Order \u2192'}
              </button>
            </div>
          ) : (
            <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold whitespace-nowrap">
              Awaiting PO Issuance by Officer
            </span>
          )}
        </div>
      )}

      {/* Primary Comparison Matrix Card */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Commercial & Technical Quote Comparison Matrix</span>
          </div>
        }
        subtitle="Side-by-side evaluation of all supplier proposals received against this RFQ"
      >
        {rfq.quotations.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <Clock className="w-8 h-8 text-slate-400 mx-auto" />
            <h4 className="text-xs font-semibold text-slate-800">Awaiting Supplier Responses</h4>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              No quotations have been manually entered yet. Procurement officers can record incoming vendor quotations using the button above.
            </p>
            {canManageQuotes && (
              <button
                onClick={() => openAddQuoteModal()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record First Quotation</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
              <thead className="bg-slate-50/70 font-semibold text-slate-600">
                <tr>
                  <th className="py-3.5 px-6">Vendor Name</th>
                  <th className="py-3.5 px-4">Quotation #</th>
                  <th className="py-3.5 px-4">Total Price (INR)</th>
                  <th className="py-3.5 px-4">Delivery Lead Time</th>
                  <th className="py-3.5 px-4">Payment Terms</th>
                  <th className="py-3.5 px-4">Notes & Remarks</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {rfq.quotations.map((quote) => {
                  const isWinner = quote.status === 'SELECTED';
                  const isLowest = quote.totalPrice === lowestPrice;
                  const isFastest = quote.deliveryDays === fastestDelivery;

                  return (
                    <tr
                      key={quote.id}
                      className={`transition-colors ${
                        isWinner
                          ? 'bg-emerald-50/40 font-medium'
                          : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          {isWinner && <Trophy className="w-3.5 h-3.5 text-emerald-600" />}
                          <span>{quote.vendor?.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {quote.vendor?.vendorCode}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                        {quote.quotationNumber}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900 text-sm">
                          ₹{quote.totalPrice.toLocaleString()}
                        </div>
                        {isLowest && (
                          <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Lowest Price
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900">
                          {quote.deliveryDays} Days
                        </span>
                        {isFastest && (
                          <span className="block text-[9px] font-bold text-blue-700">
                            Fastest Delivery
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">{quote.paymentTerms}</td>

                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                        {quote.notes || '—'}
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={quote.status} size="sm" />
                      </td>

                      <td className="py-3.5 px-6 text-right">
                        {(!hasWinner || isPoRejected) && canManageQuotes && !isWinner ? (
                          <button
                            onClick={() => openSelectWinner(quote)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-slate-900 hover:bg-blue-600 text-white rounded text-xs font-semibold transition-colors shadow-2xs"
                          >
                            <Trophy className="w-3 h-3" />
                            <span>{isPoRejected ? 'Switch Winner' : 'Select Winner'}</span>
                          </button>
                        ) : isWinner ? (
                          <span className="text-xs font-bold text-emerald-700 flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Selected</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Archived</span>
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

      {/* Invited Suppliers Status List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card title="Invited Suppliers Response Tracker">
            <div className="divide-y divide-slate-100">
              {rfq.rfqVendors.map((rv) => {
                const quote = rfq.quotations.find((q) => q.vendorId === rv.vendorId);

                return (
                  <div key={rv.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{rv.vendor.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {rv.vendor.contactPerson} • {rv.vendor.email} • {rv.vendor.phone}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {quote ? (
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-900 font-mono">
                            ₹{quote.totalPrice.toLocaleString()}
                          </span>
                          <span className="block text-[10px] text-emerald-600 font-medium">
                            Quotation Received
                          </span>
                        </div>
                      ) : canManageQuotes && !hasWinner ? (
                        <button
                          onClick={() => openAddQuoteModal(rv.vendorId)}
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-semibold hover:bg-blue-100"
                        >
                          + Record Quote
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Awaiting Quote
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Audit Trail Card */}
        <div>
          <Card title="RFQ Activity Audit">
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

      {/* Record Quotation Modal */}
      <Modal
        isOpen={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
        title="Record Supplier Quotation"
        maxWidth="lg"
      >
        <form onSubmit={handleQuoteSubmit} className="space-y-4">
          {quoteError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
              {quoteError}
            </div>
          )}

          {/* Demo autofill shortcuts */}
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-[11px] font-bold text-blue-900 block mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Autofill PRD Demo Quotations:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => prefillDemoQuote('MarineParts')}
                className="px-2 py-0.5 bg-white border border-blue-300 rounded text-[10px] font-semibold text-blue-800 hover:bg-blue-100"
              >
                MarineParts (₹82K, 5d)
              </button>
              <button
                type="button"
                onClick={() => prefillDemoQuote('OceanSupply')}
                className="px-2 py-0.5 bg-white border border-blue-300 rounded text-[10px] font-semibold text-blue-800 hover:bg-blue-100"
              >
                OceanSupply (₹78K, 12d)
              </button>
              <button
                type="button"
                onClick={() => prefillDemoQuote('ShipTech')}
                className="px-2 py-0.5 bg-white border border-blue-300 rounded text-[10px] font-semibold text-blue-800 hover:bg-blue-100"
              >
                ShipTech (₹91K, 3d)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quoting Supplier <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600"
            >
              {rfq.rfqVendors.map((rv) => (
                <option key={rv.vendorId} value={rv.vendorId}>
                  {rv.vendor.name} ({rv.vendor.categories})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quotation Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={quoteNumber}
                onChange={(e) => setQuoteNumber(e.target.value)}
                placeholder="e.g. QT-2026-145"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Total Price (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                value={totalPrice}
                onChange={(e) => setTotalPrice(Number(e.target.value) || '')}
                placeholder="e.g. 91000"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Delivery Lead Time (Days) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(Number(e.target.value) || '')}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Terms
              </label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g. 30 Days"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supplier Notes & Commercial Conditions
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Price includes seaworthy packaging and delivery to port terminal."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setQuoteModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={quoteSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
            >
              {quoteSubmitting ? 'Recording...' : 'Record Quotation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Select Winner Confirmation Modal */}
      <Modal
        isOpen={selectWinnerModalOpen}
        onClose={() => setSelectWinnerModalOpen(false)}
        title="Confirm Winning Supplier Selection"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            You are selecting <strong>{targetQuote?.vendor.name}</strong> as the winning supplier for{' '}
            <strong>₹{targetQuote?.totalPrice.toLocaleString()}</strong> ({targetQuote?.deliveryDays}{' '}
            days delivery).
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Selection Reason / Audit Justification <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={selectionReason}
              onChange={(e) => setSelectionReason(e.target.value)}
              placeholder="Explain why this supplier was chosen (e.g. fastest delivery, best price, technical compliance)..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSelectWinnerModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSelectWinnerSubmit}
              disabled={selectionSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              {selectionSubmitting ? 'Selecting...' : 'Confirm Winner & Close RFQ'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
