import React from 'react';
import { PrPriority } from '../types/index.js';

interface PriorityBadgeProps {
  priority: PrPriority | string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  let style = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';

  switch (priority.toUpperCase()) {
    case 'LOW':
      style = 'bg-slate-50 text-slate-700 border-slate-200';
      dotColor = 'bg-slate-400';
      break;
    case 'MEDIUM':
      style = 'bg-blue-50 text-blue-700 border-blue-200';
      dotColor = 'bg-blue-500';
      break;
    case 'HIGH':
      style = 'bg-amber-50 text-amber-800 border-amber-300';
      dotColor = 'bg-amber-500';
      break;
    case 'URGENT':
      style = 'bg-rose-50 text-rose-800 border-rose-300 font-semibold';
      dotColor = 'bg-rose-600 animate-ping';
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
      {priority}
    </span>
  );
};
