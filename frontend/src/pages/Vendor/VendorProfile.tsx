import React, { useEffect, useState } from 'react';
import {
  Building2,
  Phone,
  User,
  MapPin,
  Mail,
  ShieldCheck,
  CreditCard,
  Star,
  CheckCircle,
  AlertCircle,
  Save,
  Lock,
} from 'lucide-react';
import { vendorsApi } from '../../services/api.js';
import { Vendor } from '../../types/index.js';
import { Card } from '../../components/Card.js';
import { useAuth } from '../../context/AuthContext.js';

export const VendorProfile: React.FC = () => {
  const { user } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editable Form State
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await vendorsApi.getMyProfile();
      const v = res.vendor;
      setVendor(v);
      setContactPerson(v.contactPerson || '');
      setPhone(v.phone || '');
      setAddress(v.address || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load supplier company profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await vendorsApi.updateMyProfile({
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });
      setVendor(res.vendor);
      setSuccess('Operational contact and dispatch address successfully updated.');
    } catch (err: any) {
      setError(err.message || 'Failed to update company profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <span>Loading company profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Supplier Entity Profile
          </h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            Vendor Portal
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Maintain operational dispatch details, authorized representative contacts, and review maritime qualification status.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-xs text-rose-800 font-medium">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs text-emerald-800 font-medium">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Verified Corporate Metadata (Read-Only) */}
      <Card>
        <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Verified Enterprise Profile (Managed by Procurement Officers)
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
            <Lock className="w-3 h-3" />
            Verified Record
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Company Legal Name</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">{vendor?.name}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Vendor Code</span>
            <span className="font-mono font-semibold text-slate-800 text-sm mt-0.5 block">
              {vendor?.vendorCode}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Supply Categories</span>
            <span className="font-semibold text-slate-800 mt-0.5 block">{vendor?.categories}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Supplier Status</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mt-0.5">
              <CheckCircle className="w-3 h-3" />
              {vendor?.status}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Contract Payment Terms</span>
            <span className="font-semibold text-slate-800 mt-0.5 block flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
              {vendor?.paymentTerms}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Maritime Compliance</span>
            <span className="font-semibold text-emerald-700 mt-0.5 block flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Audited & Approved
            </span>
          </div>

          <div className="sm:col-span-2">
            <span className="text-slate-400 block text-[11px]">Registered Billing Email</span>
            <span className="font-mono text-slate-700 mt-0.5 block flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              {vendor?.email}
            </span>
          </div>
        </div>
      </Card>

      {/* Self-Service Operational Details */}
      <Card>
        <div className="border-b border-slate-100 pb-3 mb-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Operational Contact & Dispatch Headquarters
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Update your primary representative and warehouse/dispatch address for shipping logistics.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Primary Account Representative
              </label>
              <input
                type="text"
                required
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. Robert Chen (Key Account Manager)"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                Operations Direct Phone
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +65 6789 0123"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              Warehouse / Dispatch Address
            </label>
            <textarea
              rows={3}
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 15 Jurong Port Road, Warehouse Complex 4, Singapore 619110"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-600"
            />
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Updating...' : 'Save Profile Details'}</span>
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
};
