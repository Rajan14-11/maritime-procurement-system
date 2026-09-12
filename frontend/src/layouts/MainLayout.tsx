import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Layers,
  ShoppingCart,
  Truck,
  Building2,
  Anchor,
  Users,
  History,
  LogOut,
  Ship,
  Bell,
  Menu,
  X,
  ChevronRight,
  Shield,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { approvalsApi } from '../services/api.js';

export const MainLayout: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    // Fetch pending count for badges
    if (user?.role === 'APPROVER' || user?.role === 'ADMIN') {
      approvalsApi
        .getPending()
        .then((res) => {
          if (isMounted) {
            setPendingApprovalsCount(res.totalPending || 0);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [location.pathname, user]);

  const navigation = [
    {
      name: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      roles: ['REQUESTER', 'PROCUREMENT_OFFICER', 'APPROVER', 'ADMIN'],
    },
    {
      name: 'Purchase Requests',
      href: '/purchase-requests',
      icon: FileText,
      roles: ['REQUESTER', 'PROCUREMENT_OFFICER', 'APPROVER', 'ADMIN'],
    },
    {
      name: 'Approvals Queue',
      href: '/approvals',
      icon: CheckSquare,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
      roles: ['APPROVER', 'ADMIN'],
    },
    {
      name: 'RFQs & Quotes',
      href: '/rfqs',
      icon: Layers,
      roles: ['PROCUREMENT_OFFICER', 'ADMIN', 'APPROVER'],
    },
    {
      name: 'Purchase Orders',
      href: '/purchase-orders',
      icon: ShoppingCart,
      roles: ['PROCUREMENT_OFFICER', 'ADMIN', 'APPROVER'],
    },
    {
      name: 'Deliveries',
      href: '/deliveries',
      icon: Truck,
      roles: ['PROCUREMENT_OFFICER', 'ADMIN', 'APPROVER'],
    },
  ];

  const masterDataNav = [
    {
      name: 'Vendors Directory',
      href: '/vendors',
      icon: Building2,
      roles: ['PROCUREMENT_OFFICER', 'ADMIN', 'APPROVER'],
    },
    {
      name: 'Vessels Fleet',
      href: '/vessels',
      icon: Anchor,
      roles: ['ADMIN', 'APPROVER', 'PROCUREMENT_OFFICER'],
    },
    {
      name: 'User Management',
      href: '/users',
      icon: Users,
      roles: ['ADMIN'],
    },
    {
      name: 'System Audit Logs',
      href: '/audit-logs',
      icon: History,
      roles: ['ADMIN', 'APPROVER', 'PROCUREMENT_OFFICER'],
    },
  ];

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'APPROVER':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'PROCUREMENT_OFFICER':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'REQUESTER':
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Administrator';
      case 'APPROVER':
        return 'Approver (Procurement Mgr)';
      case 'PROCUREMENT_OFFICER':
        return 'Procurement Officer';
      case 'REQUESTER':
        return 'Requester (Chief Engineer)';
      default:
        return role || 'User';
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } border-r border-slate-800 shadow-xl lg:shadow-none h-screen`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-950/40">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md group-hover:bg-blue-500 transition-colors">
              <Ship className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wider flex items-center gap-1.5">
                MARITIME ERP
              </h1>
              <p className="text-[11px] text-blue-400 font-medium">Procurement Suite</p>
            </div>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav Links */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Main Workflows */}
          <div>
            <p className="px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Procurement Operations
            </p>
            <nav className="space-y-1">
              {navigation
                .filter((item) => !item.roles || item.roles.includes(user?.role || ''))
                .map((item) => {
                  const isActive =
                    item.href === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm font-semibold'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon
                          className={`w-4 h-4 ${
                            isActive ? 'text-white' : 'text-slate-400'
                          }`}
                        />
                        <span>{item.name}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-slate-950">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
            </nav>
          </div>

          {/* Master Data & Admin */}
          <div>
            <p className="px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Master Data & Governance
            </p>
            <nav className="space-y-1">
              {masterDataNav
                .filter((item) => !item.roles || item.roles.includes(user?.role || ''))
                .map((item) => {
                  const isActive = location.pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm font-semibold'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon
                          className={`w-4 h-4 ${
                            isActive ? 'text-white' : 'text-slate-400'
                          }`}
                        />
                        <span>{item.name}</span>
                      </div>
                    </Link>
                  );
                })}
            </nav>
          </div>
        </div>

        {/* User Card & Logout Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-200 text-xs font-bold border border-slate-600">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border mt-0.5 ${getRoleBadgeColor(
                  user?.role
                )}`}
              >
                {user?.role}
              </span>
              {user?.vessel && (
                <div className="flex items-center gap-1 text-[11px] text-blue-400 mt-1 truncate" title={user.vessel.name}>
                  <Anchor className="w-3 h-3 shrink-0" />
                  <span className="truncate">{user.vessel.name}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-xs h-16 flex items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                <Shield className="w-3.5 h-3.5 text-blue-600" />
                Fleet Operations
              </span>
              <span>/</span>
              <span className="text-slate-600">{getRoleLabel(user?.role)}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Pending approvals quick banner for Approvers */}
            {(user?.role === 'APPROVER' || user?.role === 'ADMIN') && pendingApprovalsCount > 0 && (
              <button
                onClick={() => navigate('/approvals')}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-full text-xs font-medium text-amber-900 hover:bg-amber-100 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span>{pendingApprovalsCount} Pending Approval{pendingApprovalsCount > 1 ? 's' : ''}</span>
              </button>
            )}

            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-slate-800">{user?.name}</p>
                <p className="text-[11px] text-slate-500">{user?.department || 'Operations'}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Routed Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
