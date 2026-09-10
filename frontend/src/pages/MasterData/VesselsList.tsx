import React, { useEffect, useState } from 'react';
import {
  Anchor,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Ship,
  Edit2,
  Power,
} from 'lucide-react';
import { vesselsApi } from '../../services/api.js';
import { Vessel } from '../../types/index.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { Card } from '../../components/Card.js';
import { Modal } from '../../components/Modal.js';
import { useAuth } from '../../context/AuthContext.js';

export const VesselsList: React.FC = () => {
  const { user } = useAuth();
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVessel, setEditingVessel] = useState<Vessel | null>(null);
  const [name, setName] = useState('');
  const [imoNumber, setImoNumber] = useState('');
  const [type, setType] = useState('Container Ship');
  const [flag, setFlag] = useState('India');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadVessels = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await vesselsApi.list({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
      });
      setVessels(res.vessels || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load vessel fleet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVessels();
  }, [statusFilter]);

  const openCreateModal = () => {
    setEditingVessel(null);
    setName('');
    setImoNumber('');
    setType('Container Ship');
    setFlag('India');
    setStatus('ACTIVE');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (vessel: Vessel) => {
    setEditingVessel(vessel);
    setName(vessel.name);
    setImoNumber(vessel.imoNumber);
    setType(vessel.type);
    setFlag(vessel.flag);
    setStatus(vessel.status);
    setFormError(null);
    setModalOpen(true);
  };

  const handleToggleStatus = async (vessel: Vessel) => {
    const nextStatus = vessel.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await vesselsApi.update(vessel.id, { status: nextStatus });
      await loadVessels();
    } catch (err: any) {
      alert(err.message || 'Failed to update vessel status.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !imoNumber.trim() || !type.trim() || !flag.trim()) {
      setFormError('All fields are required.');
      return;
    }

    try {
      setSaving(true);
      if (editingVessel) {
        await vesselsApi.update(editingVessel.id, {
          name: name.trim(),
          type: type.trim(),
          flag: flag.trim(),
          status,
        });
      } else {
        await vesselsApi.create({
          name: name.trim(),
          imoNumber: imoNumber.trim(),
          type: type.trim(),
          flag: flag.trim(),
        });
      }

      setModalOpen(false);
      await loadVessels();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save vessel.');
    } finally {
      setSaving(false);
    }
  };

  const canManage = user?.role === 'ADMIN' || user?.role === 'APPROVER';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Anchor className="w-5 h-5 text-blue-600" />
            Vessel Fleet Master Data
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registered commercial vessels and floating assets in the company fleet
          </p>
        </div>

        {canManage && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Register Vessel</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search vessels by name or IMO number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadVessels()}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50/50"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active in Service</option>
          <option value="INACTIVE">Decommissioned / Drydock</option>
        </select>

        <button
          onClick={loadVessels}
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

      {/* Vessels Table */}
      <Card>
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Fetching vessel fleet register...</span>
          </div>
        ) : vessels.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Anchor className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">No Vessels Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No registered vessels match the active filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
              <thead className="bg-slate-50/70 font-semibold text-slate-600">
                <tr>
                  <th className="py-3.5 px-6">Vessel Name</th>
                  <th className="py-3.5 px-4">IMO Number</th>
                  <th className="py-3.5 px-4">Vessel Type</th>
                  <th className="py-3.5 px-4">Flag State</th>
                  <th className="py-3.5 px-4">Operational Status</th>
                  {canManage && <th className="py-3.5 px-6 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {vessels.map((vessel) => (
                  <tr key={vessel.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-6 font-bold text-slate-900 flex items-center gap-2">
                      <Ship className="w-4 h-4 text-blue-600" />
                      <span>{vessel.name}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-600">
                      {vessel.imoNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">{vessel.type}</td>
                    <td className="py-3.5 px-4 text-slate-700">{vessel.flag}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={vessel.status} size="sm" />
                    </td>
                    {canManage && (
                      <td className="py-3.5 px-6 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(vessel)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition-colors"
                          title="Edit details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(vessel)}
                          className={`p-1.5 rounded transition-colors ${
                            vessel.status === 'ACTIVE'
                              ? 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                              : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'
                          }`}
                          title={vessel.status === 'ACTIVE' ? 'Deactivate vessel' : 'Activate vessel'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Vessel Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingVessel ? `Edit Vessel: ${editingVessel.name}` : 'Register Fleet Vessel'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Vessel Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MV Ocean Star"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              IMO Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={!!editingVessel}
              value={imoNumber}
              onChange={(e) => setImoNumber(e.target.value)}
              placeholder="e.g. IMO-9876543"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600 font-mono disabled:bg-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vessel Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600"
              >
                <option value="Container Ship">Container Ship</option>
                <option value="Bulk Carrier">Bulk Carrier</option>
                <option value="Oil Tanker">Oil Tanker</option>
                <option value="Chemical Tanker">Chemical Tanker</option>
                <option value="LNG Carrier">LNG Carrier</option>
                <option value="Offshore Supply Vessel">Offshore Supply Vessel</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Flag State <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
                placeholder="e.g. India"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          {editingVessel && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Operational Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600"
              >
                <option value="ACTIVE">ACTIVE (In Service)</option>
                <option value="INACTIVE">INACTIVE (Decommissioned)</option>
              </select>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingVessel ? 'Update Vessel' : 'Register Vessel'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
