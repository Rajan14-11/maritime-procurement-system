import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalized = status.toUpperCase().replace(/\s+/g, '_');

  let style = 'bg-slate-100 text-slate-700 border-slate-200';

  switch (normalized) {
    case 'DRAFT':
      style = 'bg-slate-100 text-slate-600 border-slate-300';
      break;
    case 'PENDING_APPROVAL':
      style = 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse';
      break;
    case 'APPROVED':
      style = 'bg-emerald-50 text-emerald-800 border-emerald-300';
      break;
    case 'REJECTED':
    case 'PO_REJECTED':
      style = 'bg-rose-50 text-rose-800 border-rose-300';
      break;
    case 'RFQ_CREATED':
      style = 'bg-sky-50 text-sky-800 border-sky-300';
      break;
    case 'VENDOR_SELECTED':
      style = 'bg-indigo-50 text-indigo-800 border-indigo-300';
      break;
    case 'PO_CREATED':
      style = 'bg-purple-50 text-purple-800 border-purple-300';
      break;
    case 'ORDERED':
      style = 'bg-blue-50 text-blue-800 border-blue-300';
      break;
    case 'PARTIALLY_RECEIVED':
      style = 'bg-orange-50 text-orange-800 border-orange-300';
      break;
    case 'RECEIVED':
      style = 'bg-teal-50 text-teal-800 border-teal-300';
      break;
    case 'COMPLETED':
      style = 'bg-emerald-100 text-emerald-900 border-emerald-400 font-semibold';
      break;
    case 'OPEN':
      style = 'bg-blue-50 text-blue-800 border-blue-300';
      break;
    case 'CLOSED':
      style = 'bg-slate-100 text-slate-700 border-slate-300';
      break;
    case 'SELECTED':
      style = 'bg-emerald-50 text-emerald-800 border-emerald-300';
      break;
    case 'ACTIVE':
      style = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      break;
    case 'INACTIVE':
      style = 'bg-slate-100 text-slate-500 border-slate-200';
      break;
    case 'GOOD':
      style = 'bg-emerald-50 text-emerald-800 border-emerald-300';
      break;
    case 'DAMAGED':
      style = 'bg-rose-50 text-rose-800 border-rose-300';
      break;
    case 'PARTIALLY_DAMAGED':
      style = 'bg-amber-50 text-amber-800 border-amber-300';
      break;
    default:
      style = 'bg-slate-100 text-slate-700 border-slate-200';
  }

  const formattedLabel = normalized === 'PO_REJECTED'
    ? 'PO Rejected'
    : status
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());

  const paddingClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${paddingClass} ${style}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
      {formattedLabel}
    </span>
  );
};
