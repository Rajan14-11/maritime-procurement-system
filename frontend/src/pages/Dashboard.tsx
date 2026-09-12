import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  Layers,
  ShoppingCart,
  Truck,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  ShieldAlert,
  Ship,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { dashboardApi } from '../services/api.js';
import { DashboardSummary } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { PriorityBadge } from '../components/PriorityBadge.js';
import { Card } from '../components/Card.js';
import { useAuth } from '../context/AuthContext.js';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = React.useRef(true);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await dashboardApi.getSummary();
      if (isMountedRef.current) setData(res);
    } catch (err: any) {
      if (isMountedRef.current) setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchSummary();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-medium">Loading operational metrics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center max-w-lg mx-auto mt-8">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-rose-900">Dashboard Unavailable</h3>
        <p className="text-xs text-rose-700 mt-1">{error || 'Could not fetch summary data.'}</p>
        <button
          onClick={fetchSummary}
          className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700"
        >
          Retry Load
        </button>
      </div>
    );
  }

  const { kpis, recentPurchaseRequests, pendingApprovals, recentActivity } = data;

  const statCards = [
    {
      title: 'Purchase Requests',
      value: kpis.purchaseRequests,
      icon: FileText,
      color: 'text-blue-600 bg-blue-50 border-blue-100',
      href: '/purchase-requests',
    },
    {
      title: 'Pending Approvals',
      value: kpis.pendingApprovals,
      icon: Clock,
      color: 'text-amber-600 bg-amber-50 border-amber-100',
      href: '/approvals',
      alert: kpis.pendingApprovals > 0,
    },
    {
      title: 'Open RFQs',
      value: kpis.openRfqs,
      icon: Layers,
      color: 'text-sky-600 bg-sky-50 border-sky-100',
      href: '/rfqs',
    },
    {
      title: 'Active POs',
      value: kpis.activePos,
      icon: ShoppingCart,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
      href: '/purchase-orders',
    },
    {
      title: 'Pending Deliveries',
      value: kpis.pendingDeliveries,
      icon: Truck,
      color: 'text-orange-600 bg-orange-50 border-orange-100',
      href: '/deliveries',
    },
    {
      title: 'Completed Cycles',
      value: kpis.completedProcurements,
      icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      href: '/purchase-requests?status=COMPLETED',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            Operational Overview
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Welcome back, <strong>{user?.name}</strong> ({user?.role}). Fleet procurement is running live.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/purchase-requests/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Create Purchase Request</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <Link
            key={stat.title}
            to={stat.href}
            className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-blue-400 hover:shadow-md transition-all group relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`p-2 rounded-lg border ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </span>
              {stat.alert && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">
              {stat.value}
            </p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{stat.title}</p>
          </Link>
        ))}
      </div>

      {/* Main Grid: Approvals Queue + Recent Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Purchase Requests */}
        <div className="lg:col-span-2 space-y-6">
          <Card
            title="Recent Purchase Requests"
            subtitle="Latest requirements raised across active vessels"
            action={
              <Link
                to="/purchase-requests"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            }
          >
            {recentPurchaseRequests.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No purchase requests raised yet.
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 -my-6">
                <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                  <thead className="bg-slate-50/60 font-semibold text-slate-600">
                    <tr>
                      <th className="py-3 px-6">PR Number</th>
                      <th className="py-3 px-4">Vessel</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Est. Total</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-6">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {recentPurchaseRequests.map((pr) => (
                      <tr
                        key={pr.id}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => window.location.href = `/purchase-requests/${pr.id}`}
                      >
                        <td className="py-3 px-6 font-semibold text-blue-600">
                          {pr.prNumber}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {pr.vessel?.name}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{pr.department}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          ₹{pr.estimatedTotal?.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <PriorityBadge priority={pr.priority} />
                        </td>
                        <td className="py-3 px-6">
                          <StatusBadge status={pr.status} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Pending Approvals Widget for Approvers */}
          {(user?.role === 'APPROVER' || user?.role === 'ADMIN') && (
            <Card
              title={
                <div className="flex items-center gap-2 text-amber-800">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Pending Authorizations</span>
                </div>
              }
              subtitle="Requests and orders requiring immediate managerial review"
              action={
                <Link
                  to="/approvals"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <span>Open Approvals Queue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              }
            >
              {pendingApprovals.purchaseRequests.length === 0 &&
              pendingApprovals.purchaseOrders.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>No pending items in your approval queue.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingApprovals.purchaseRequests.map((pr) => (
                    <div
                      key={pr.id}
                      className="flex items-center justify-between p-3.5 bg-amber-50/50 border border-amber-200/80 rounded-lg hover:bg-amber-50 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{pr.prNumber}</span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            • {pr.vessel?.name} ({pr.department})
                          </span>
                          <PriorityBadge priority={pr.priority} />
                        </div>
                        <p className="text-[11px] text-slate-600 truncate max-w-md">
                          {pr.reason}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-slate-900">
                          ₹{pr.estimatedTotal.toLocaleString()}
                        </span>
                        <Link
                          to={`/purchase-requests/${pr.id}`}
                          className="px-3 py-1 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 rounded text-xs font-semibold transition-colors"
                        >
                          Review &rarr;
                        </Link>
                      </div>
                    </div>
                  ))}

                  {pendingApprovals.purchaseOrders.map((po) => (
                    <div
                      key={po.id}
                      className="flex items-center justify-between p-3.5 bg-blue-50/50 border border-blue-200/80 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{po.poNumber}</span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            • Vendor: {po.vendor?.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Vessel: {po.vessel?.name} • PO Pending Authorization
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-slate-900">
                          ₹{po.total.toLocaleString()}
                        </span>
                        <Link
                          to={`/purchase-orders/${po.id}`}
                          className="px-3 py-1 bg-white border border-blue-300 text-blue-900 hover:bg-blue-100 rounded text-xs font-semibold transition-colors"
                        >
                          Review PO &rarr;
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right 1 Col: Audit Activity Feed */}
        <div>
          <Card
            title="Procurement Activity Trail"
            subtitle="Real-time chronological events from database"
            action={
              <Link
                to="/audit-logs"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                View full audit
              </Link>
            }
          >
            <div className="flow-root">
              <ul className="-mb-8">
                {recentActivity.map((log, logIdx) => (
                  <li key={log.id}>
                    <div className="relative pb-6">
                      {logIdx !== recentActivity.length - 1 ? (
                        <span
                          className="absolute top-4 left-3 -ml-px h-full w-0.5 bg-slate-200"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div className="relative flex items-start space-x-3">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center ring-4 ring-white shrink-0 text-[10px] font-bold">
                          {log.userName ? log.userName[0].toUpperCase() : 'A'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-slate-900">
                            <span className="font-semibold text-slate-800">{log.userName}</span>{' '}
                            <span className="text-[10px] text-slate-500 uppercase font-mono">
                              [{log.action.replace(/_/g, ' ')}]
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                            {log.description}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                            {new Date(log.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: 'short',
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
    </div>
  );
};
