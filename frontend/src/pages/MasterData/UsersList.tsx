import React, { useEffect, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Shield,
  Edit2,
  Power,
  Lock,
  Anchor,
  Building2,
} from 'lucide-react';
import { usersApi, vesselsApi, vendorsApi } from '../../services/api.js';
import { User, UserRole, UserStatus, Vessel, Vendor } from '../../types/index.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { Card } from '../../components/Card.js';
import { Modal } from '../../components/Modal.js';
import { useAuth } from '../../context/AuthContext.js';

export const UsersList: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isOfficer = currentUser?.role === 'PROCUREMENT_OFFICER';
  const [users, setUsers] = useState<User[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('REQUESTER');
  const [department, setDepartment] = useState('Engine');
  const [vesselId, setVesselId] = useState<string>('');
  const [vendorId, setVendorId] = useState<string>('');
  const [status, setStatus] = useState<UserStatus>('ACTIVE');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await usersApi.list({
        search: search.trim() || undefined,
        role: isOfficer ? 'VENDOR' : (roleFilter || undefined),
      });
      setUsers(res.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load user directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter]);

  useEffect(() => {
    Promise.all([
      vesselsApi.list({ status: 'ACTIVE' }),
      vendorsApi.list(),
    ])
      .then(([vesselsRes, vendorsRes]) => {
        setVessels(vesselsRes.vessels || []);
        setVendors(vendorsRes.vendors || []);
      })
      .catch(() => {});
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('Password123!');
    setRole(isOfficer ? 'VENDOR' : 'REQUESTER');
    setDepartment(isOfficer ? 'Commercial / Sales' : 'Engine');
    setVesselId('');
    setVendorId('');
    setStatus('ACTIVE');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (targetUser: User) => {
    setEditingUser(targetUser);
    setName(targetUser.name);
    setEmail(targetUser.email);
    setPassword('');
    setRole(targetUser.role);
    setDepartment(targetUser.department || 'Operations');
    setVesselId(targetUser.vesselId || targetUser.vessel?.id || '');
    setVendorId(targetUser.vendorId || targetUser.vendor?.id || '');
    setStatus(targetUser.status);
    setFormError(null);
    setModalOpen(true);
  };

  const handleToggleStatus = async (targetUser: User) => {
    if (targetUser.id === currentUser?.id) {
      alert('You cannot deactivate your own administrative account.');
      return;
    }
    const nextStatus = targetUser.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await usersApi.update(targetUser.id, { status: nextStatus });
      await loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to change user status.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !email.trim()) {
      setFormError('Name and email are required.');
      return;
    }

    if (!editingUser && (!password || password.length < 8)) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    if (role === 'VENDOR' && !vendorId) {
      setFormError('Please select an assigned Vendor Company for this account.');
      return;
    }

    try {
      setSaving(true);
      const assignedVessel = role === 'REQUESTER' ? (vesselId || null) : null;
      const assignedVendor = role === 'VENDOR' ? (vendorId || null) : null;

      if (editingUser) {
        await usersApi.update(editingUser.id, {
          name: name.trim(),
          role,
          department: department.trim(),
          vesselId: assignedVessel,
          vendorId: assignedVendor,
          status,
          password: password.trim() ? password.trim() : undefined,
        });
      } else {
        await usersApi.create({
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
          role,
          department: department.trim(),
          vesselId: assignedVessel,
          vendorId: assignedVendor,
        });
      }

      setModalOpen(false);
      await loadUsers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save user.');
    } finally {
      setSaving(false);
    }
  };

  const getRoleTag = (userRole: string) => {
    switch (userRole) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'APPROVER':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'PROCUREMENT_OFFICER':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'VENDOR':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'REQUESTER':
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            {isOfficer ? (
              <Building2 className="w-5 h-5 text-indigo-600" />
            ) : (
              <Users className="w-5 h-5 text-purple-600" />
            )}
            <span>{isOfficer ? 'Vendor User Accounts' : 'User & Role Management'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isOfficer
              ? 'Provision and maintain portal login credentials for approved marine suppliers'
              : 'Role-based access control, departmental assignments, and authentication status'}
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{isOfficer ? 'Add Vendor User' : 'Add System User'}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder={isOfficer ? 'Search vendor users by name or email...' : 'Search users by name or email...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50/50"
          />
        </div>

        {!isOfficer && (
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
          >
            <option value="">All Roles</option>
            <option value="REQUESTER">Requester</option>
            <option value="PROCUREMENT_OFFICER">Procurement Officer</option>
            <option value="APPROVER">Approver</option>
            <option value="ADMIN">Administrator</option>
            <option value="VENDOR">Vendor Portal</option>
          </select>
        )}

        <button
          onClick={loadUsers}
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

      {/* Users Table */}
      <Card>
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Fetching user directory...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">No Users Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {isOfficer
                ? 'No vendor portal user accounts found. Click "Add Vendor User" to provision credentials for an approved supplier.'
                : 'No system user accounts match the current filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
              <thead className="bg-slate-50/70 font-semibold text-slate-600">
                <tr>
                  <th className="py-3.5 px-6">Name</th>
                  <th className="py-3.5 px-4">Email Address</th>
                  <th className="py-3.5 px-4">System Role</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Assigned Scope / Entity</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {users.map((targetUser) => (
                  <tr key={targetUser.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {targetUser.name}
                      {targetUser.id === currentUser?.id && (
                        <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                          (You)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {targetUser.email}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRoleTag(
                          targetUser.role
                        )}`}
                      >
                        {targetUser.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {targetUser.department || 'Operations'}
                    </td>
                    <td className="py-3.5 px-4">
                      {targetUser.role === 'REQUESTER' ? (() => {
                        const assignedVessel =
                          targetUser.vessel ||
                          vessels.find((v) => v.id === targetUser.vesselId);
                        return assignedVessel ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-800 font-medium">
                            <Anchor className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate max-w-[150px]" title={assignedVessel.name}>
                              {assignedVessel.name}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                            Unassigned Vessel
                          </span>
                        );
                      })() : targetUser.role === 'VENDOR' ? (() => {
                        const assignedVendor =
                          targetUser.vendor ||
                          vendors.find((v) => v.id === targetUser.vendorId);
                        return assignedVendor ? (
                          <div className="flex items-center gap-1.5 text-xs text-indigo-900 font-medium">
                            <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="truncate max-w-[150px]" title={assignedVendor.name}>
                              {assignedVendor.name}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                            Unassigned Vendor
                          </span>
                        );
                      })() : (
                        <span className="text-slate-400 text-[11px] italic">Fleet-wide (Internal)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={targetUser.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-6 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(targetUser)}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition-colors"
                        title="Edit user details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {targetUser.id !== currentUser?.id && (
                        <button
                          onClick={() => handleToggleStatus(targetUser)}
                          className={`p-1.5 rounded transition-colors ${
                            targetUser.status === 'ACTIVE'
                              ? 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                              : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'
                          }`}
                          title={targetUser.status === 'ACTIVE' ? 'Deactivate user' : 'Activate user'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? `Edit User: ${editingUser.name}` : isOfficer ? 'Provision Vendor Portal Account' : 'Register System User'}
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
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chief Engineer"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              disabled={!!editingUser}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. user@demo.com"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {editingUser ? 'Reset Password (Leave blank to keep current)' : 'Password'} {!editingUser && <span className="text-rose-500">*</span>}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={editingUser ? 'Enter new password (optional)' : 'Minimum 8 characters'}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned Role <span className="text-rose-500">*</span>
              </label>
              <select
                value={role}
                disabled={isOfficer}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100"
              >
                {isOfficer ? (
                  <option value="VENDOR">Vendor Portal</option>
                ) : (
                  <>
                    <option value="REQUESTER">Requester</option>
                    <option value="PROCUREMENT_OFFICER">Procurement Officer</option>
                    <option value="APPROVER">Approver</option>
                    <option value="ADMIN">Administrator</option>
                    <option value="VENDOR">Vendor Portal</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Engine / Deck"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          {role === 'REQUESTER' && (
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Anchor className="w-3.5 h-3.5 text-blue-600" />
                  Assigned Vessel <span className="text-rose-500">*</span>
                </span>
                <span className="text-[10px] text-blue-700 font-normal">Chief Engineer Scope</span>
              </label>
              <select
                value={vesselId}
                onChange={(e) => setVesselId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-blue-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600"
              >
                <option value="">-- Select Vessel Assignment --</option>
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.type} • IMO {v.imoNumber})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">
                This user will only be able to create PRs and view data for this specific vessel.
              </p>
            </div>
          )}

          {role === 'VENDOR' && (
            <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-lg space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  Assigned Vendor Entity <span className="text-rose-500">*</span>
                </span>
                <span className="text-[10px] text-indigo-700 font-normal">Registered Suppliers</span>
              </label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-indigo-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-600"
              >
                <option value="">-- Select Vendor Entity --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.vendorCode} • {v.categories})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">
                This user will log in to the Vendor Portal to bid on RFQs and fulfill orders for this supplier.
              </p>
            </div>
          )}

          {editingUser && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-600"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
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
              {saving ? 'Saving...' : editingUser ? 'Update User' : 'Register User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
