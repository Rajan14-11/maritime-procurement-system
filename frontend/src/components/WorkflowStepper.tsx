import React from 'react';
import { Check, Clock, AlertCircle } from 'lucide-react';
import { PrStatus } from '../types/index.js';

interface WorkflowStepperProps {
  currentStatus: PrStatus | string;
  isRejected?: boolean;
  isPoRejected?: boolean;
  rejectedPoNumber?: string;
  rejectionReason?: string | null;
}

const STEPS = [
  { key: 'PR_CREATED', label: '1. Request', desc: 'PR Submitted' },
  { key: 'PR_APPROVED', label: '2. Approval', desc: 'Manager Approved' },
  { key: 'RFQ_CREATED', label: '3. RFQ', desc: 'Suppliers Invited' },
  { key: 'QUOTES_RECEIVED', label: '4. Quotes', desc: 'Offers Received' },
  { key: 'VENDOR_SELECTED', label: '5. Selection', desc: 'Winner Chosen' },
  { key: 'PO_CREATED', label: '6. PO Issued', desc: 'Order Drafted' },
  { key: 'PO_APPROVED', label: '7. PO Approved', desc: 'Order Placed' },
  { key: 'DELIVERY', label: '8. Delivery', desc: 'Goods Receipt' },
  { key: 'COMPLETED', label: '9. Completed', desc: 'Fully Received' },
];

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  currentStatus,
  isRejected,
  isPoRejected,
  rejectedPoNumber,
  rejectionReason,
}) => {
  // Map PR / PO status to step index (0-8)
  const getStepIndex = (status: string): number => {
    switch (status) {
      case 'DRAFT':
        return 0;
      case 'PENDING_APPROVAL':
        return 0;
      case 'APPROVED':
        return 1;
      case 'RFQ_CREATED':
        return 2;
      case 'VENDOR_SELECTED':
        return 4;
      case 'PO_CREATED':
        return 5;
      case 'ORDERED':
        return 6;
      case 'PARTIALLY_RECEIVED':
        return 7;
      case 'RECEIVED':
      case 'COMPLETED':
        return 8;
      case 'REJECTED':
      case 'PO_REJECTED':
        return -1;
      default:
        return 0;
    }
  };

  const activeIndex = getStepIndex(currentStatus);
  const displayStatus = isPoRejected ? 'PO REJECTED' : currentStatus.replace(/_/g, ' ');

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
          Procurement Lifecycle Progression
        </h3>
        <span className="text-xs text-slate-500 font-medium">
          Current State: <strong className={isPoRejected ? 'text-rose-600' : 'text-slate-900'}>{displayStatus}</strong>
        </span>
      </div>

      {isPoRejected ? (
        <div className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <p className="font-semibold">Purchase Order {rejectedPoNumber ? `(${rejectedPoNumber}) ` : ''}Rejected by Approver</p>
            <p className="text-xs text-rose-700 mt-0.5">
              {rejectionReason ? `Reason: "${rejectionReason}" — ` : ''}The drafted Purchase Order was rejected. Procurement Officer may review terms, select another quotation, or draft a revised PO.
            </p>
          </div>
        </div>
      ) : isRejected || currentStatus === 'REJECTED' ? (
        <div className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <p className="font-semibold">Workflow Terminated (Request Rejected)</p>
            <p className="text-xs text-rose-600">
              This purchase request was rejected by an approver. A new request or correction is required.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative">
          {/* Progress track */}
          <div className="overflow-x-auto pb-2">
            <div className="flex items-center min-w-[700px] justify-between relative">
              {/* Connecting line */}
              <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-200 -z-0"></div>
              <div
                className="absolute top-4 left-4 h-0.5 bg-emerald-500 transition-all duration-500 -z-0"
                style={{
                  width: `${(Math.min(activeIndex, STEPS.length - 1) / (STEPS.length - 1)) * 95}%`,
                }}
              ></div>

              {STEPS.map((step, idx) => {
                const isPassed = idx < activeIndex;
                const isCurrent = idx === activeIndex;

                return (
                  <div key={step.key} className="flex flex-col items-center relative z-10">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                        isPassed
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : isCurrent
                          ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-md scale-110'
                          : 'bg-white border-2 border-slate-300 text-slate-400'
                      }`}
                    >
                      {isPassed ? (
                        <Check className="w-4 h-4" />
                      ) : isCurrent ? (
                        <Clock className="w-4 h-4 animate-spin" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span
                      className={`mt-2 text-xs font-semibold text-center whitespace-nowrap ${
                        isCurrent
                          ? 'text-blue-700 font-bold'
                          : isPassed
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                    <span className="text-[10px] text-slate-400 text-center whitespace-nowrap">
                      {step.desc}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
