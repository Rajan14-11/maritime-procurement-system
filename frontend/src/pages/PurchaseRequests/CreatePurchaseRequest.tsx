import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FileText,
  Plus,
  Trash2,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  Save,
  Send,
} from 'lucide-react';
import { purchaseRequestsApi, vesselsApi } from '../../services/api.js';
import { Vessel } from '../../types/index.js';
import { Card } from '../../components/Card.js';

interface ItemForm {
  itemName: string;
  description: string;
  quantity: number;
  unit: string;
  estimatedUnitPrice: number;
}

export const CreatePurchaseRequest: React.FC = () => {
  const navigate = useNavigate();
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [vesselId, setVesselId] = useState('');
  const [department, setDepartment] = useState('Engine');
  const [priority, setPriority] = useState('HIGH');
  const [requiredDate, setRequiredDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().slice(0, 10);
  });
  const [reason, setReason] = useState('');
  const [items, setItems] = useState<ItemForm[]>([
    {
      itemName: '',
      description: '',
      quantity: 1,
      unit: 'Pieces',
      estimatedUnitPrice: 0,
    },
  ]);

  useEffect(() => {
    vesselsApi
      .list({ status: 'ACTIVE' })
      .then((res) => {
        const activeVessels = res.vessels || [];
        setVessels(activeVessels);
        if (activeVessels.length > 0) {
          setVesselId(activeVessels[0].id);
        }
      })
      .catch((err) => {
        setError('Failed to load fleet vessels.');
      });
  }, []);

  // Pre-fill exact PRD Section 45 primary scenario
  const fillDemoScenario = () => {
    const oceanStar = vessels.find((v) => v.name.includes('Ocean Star')) || vessels[0];
    if (oceanStar) setVesselId(oceanStar.id);
    setDepartment('Engine');
    setPriority('HIGH');
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 10);
    setRequiredDate(targetDate.toISOString().slice(0, 10));
    setReason('Required for scheduled engine maintenance.');
    setItems([
      {
        itemName: 'Fuel Filter',
        description: 'Main engine fuel filter 10 micron rating',
        quantity: 10,
        unit: 'Pieces',
        estimatedUnitPrice: 8500,
      },
    ]);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        itemName: '',
        description: '',
        quantity: 1,
        unit: 'Pieces',
        estimatedUnitPrice: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ItemForm, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => {
      const q = Number(item.quantity) || 0;
      const p = Number(item.estimatedUnitPrice) || 0;
      return sum + q * p;
    }, 0);
  };

  const handleSubmit = async (submitImmediately: boolean) => {
    setError(null);

    // Validation
    if (!vesselId) {
      setError('Please select a vessel.');
      return;
    }
    if (!department) {
      setError('Please select a department.');
      return;
    }
    if (!requiredDate) {
      setError('Required by date is mandatory.');
      return;
    }
    const reqDate = new Date(requiredDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (reqDate < today) {
      setError('Required date cannot be in the past.');
      return;
    }
    if (!reason.trim()) {
      setError('Justification reason is mandatory.');
      return;
    }
    for (let i = 0; i < items.length; i++) {
      if (!items[i].itemName.trim()) {
        setError(`Item #${i + 1}: Item name is required.`);
        return;
      }
      if (Number(items[i].quantity) <= 0) {
        setError(`Item #${i + 1}: Quantity must be greater than 0.`);
        return;
      }
      if (Number(items[i].estimatedUnitPrice) < 0) {
        setError(`Item #${i + 1}: Estimated price cannot be negative.`);
        return;
      }
    }

    try {
      setLoading(true);
      const res = await purchaseRequestsApi.create({
        vesselId,
        department,
        priority,
        requiredDate,
        reason: reason.trim(),
        items,
        submitImmediately,
      });

      navigate(`/purchase-requests/${res.purchaseRequest.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to submit purchase request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/purchase-requests"
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Create Purchase Request
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Initiate a formal material demand for vessel spares and equipment
            </p>
          </div>
        </div>

        {/* Demo Scenario Autofill Shortcut */}
        <button
          type="button"
          onClick={fillDemoScenario}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-colors self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Fill PRD Demo Scenario (Fuel Filters x10)</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-xs text-rose-800 font-medium">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form Content */}
      <div className="space-y-6">
        {/* Header Metadata Card */}
        <Card title="1. Request Header & Vessel Association">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Vessel <span className="text-rose-500">*</span>
              </label>
              <select
                value={vesselId}
                onChange={(e) => setVesselId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              >
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ship Department <span className="text-rose-500">*</span>
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              >
                <option value="Engine">Engine</option>
                <option value="Deck">Deck</option>
                <option value="Navigation">Navigation</option>
                <option value="Electrical">Electrical</option>
                <option value="Safety">Safety</option>
                <option value="Catering">Catering / Hotel</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority Level <span className="text-rose-500">*</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              >
                <option value="LOW">Low (Routine replenishment)</option>
                <option value="MEDIUM">Medium (Next port call)</option>
                <option value="HIGH">High (Scheduled maintenance)</option>
                <option value="URGENT">Urgent (Vessel holding / Critical)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Required On-Board By <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600 focus:border-blue-600 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Operational Reason & Technical Justification <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Required for scheduled 10,000 hour main engine maintenance prior to Colombo transit."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
          </div>
        </Card>

        {/* Dynamic Items Table Card */}
        <Card
          title="2. Requested Material & Technical Line Items"
          action={
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Item</span>
            </button>
          }
        >
          <div className="space-y-4">
            {items.map((item, idx) => {
              const itemTotal = (Number(item.quantity) || 0) * (Number(item.estimatedUnitPrice) || 0);

              return (
                <div
                  key={idx}
                  className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px]">
                        {idx + 1}
                      </span>
                      Item Details
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Item Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Fuel Filter Element"
                        value={item.itemName}
                        onChange={(e) => handleItemChange(idx, 'itemName', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600"
                      />
                    </div>

                    <div className="sm:col-span-7">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Technical Description / Specifications
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Main engine fuel filter 10 micron rating"
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Quantity <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600 font-mono"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Unit
                      </label>
                      <select
                        value={item.unit}
                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600"
                      >
                        <option value="Pieces">Pieces</option>
                        <option value="Sets">Sets</option>
                        <option value="Liters">Liters</option>
                        <option value="Barrels">Barrels</option>
                        <option value="Meters">Meters</option>
                        <option value="Kgs">Kgs</option>
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Est. Unit Price (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={item.estimatedUnitPrice}
                        onChange={(e) =>
                          handleItemChange(idx, 'estimatedUnitPrice', Number(e.target.value))
                        }
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600 font-mono"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Item Subtotal
                      </label>
                      <div className="px-3 py-1.5 text-xs font-bold text-slate-900 bg-slate-100 rounded-lg font-mono flex items-center">
                        ₹{itemTotal.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Grand Total Summary Bar */}
            <div className="flex items-center justify-between p-4 bg-blue-50/60 border border-blue-200 rounded-xl">
              <div>
                <p className="text-xs font-semibold text-blue-900">Total Estimated Budget</p>
                <p className="text-[11px] text-blue-700">
                  Calculated across {items.length} line item{items.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xl font-extrabold text-blue-950 font-mono">
                  ₹{calculateGrandTotal().toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Buttons Footer */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 shadow-2xs"
          >
            <Save className="w-4 h-4 text-slate-500" />
            <span>Save as Draft</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{loading ? 'Submitting...' : 'Submit for Approval'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
