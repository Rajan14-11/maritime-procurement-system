export type UserRole = 'REQUESTER' | 'PROCUREMENT_OFFICER' | 'APPROVER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type VesselStatus = 'ACTIVE' | 'INACTIVE';
export type VendorStatus = 'ACTIVE' | 'INACTIVE';
export type PrPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type PrStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'RFQ_CREATED'
  | 'VENDOR_SELECTED'
  | 'PO_CREATED'
  | 'COMPLETED';

export type RfqStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export type QuotationStatus = 'RECEIVED' | 'SELECTED' | 'REJECTED';
export type PoStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ORDERED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'COMPLETED';

export type GoodsCondition = 'GOOD' | 'DAMAGED' | 'PARTIALLY_DAMAGED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string | null;
  status: UserStatus;
  vesselId?: string | null;
  vessel?: Vessel | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Vessel {
  id: string;
  name: string;
  imoNumber: string;
  type: string;
  flag: string;
  status: VesselStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  vendorCode: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  categories: string;
  paymentTerms: string;
  status: VendorStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseRequestItem {
  id?: string;
  itemName: string;
  description: string;
  quantity: number;
  unit: string;
  estimatedUnitPrice: number;
  estimatedTotal: number;
}

export interface Approval {
  id: string;
  entityType: 'PURCHASE_REQUEST' | 'PURCHASE_ORDER';
  entityId: string;
  approverId: string;
  approver?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
  decision: 'APPROVED' | 'REJECTED';
  comments?: string | null;
  createdAt: string;
}

export interface PurchaseRequest {
  id: string;
  prNumber: string;
  vesselId: string;
  vessel: Vessel;
  department: string;
  priority: PrPriority;
  requiredDate: string;
  estimatedTotal: number;
  reason: string;
  status: PrStatus;
  requesterId: string;
  requester?: {
    id: string;
    name: string;
    email: string;
    department?: string;
  };
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseRequestItem[];
  approvals?: Approval[];
  rfq?: {
    id: string;
    rfqNumber: string;
    status: RfqStatus;
    rfqVendors?: { vendor: Vendor }[];
    quotations?: Quotation[];
  } | null;
  purchaseOrders?: {
    id: string;
    poNumber: string;
    status: PoStatus;
    total: number;
  }[];
}

export interface RfqVendor {
  id: string;
  rfqId: string;
  vendorId: string;
  vendor: Vendor;
}

export interface QuotationItem {
  id?: string;
  quotationId?: string;
  purchaseRequestItemId?: string | null;
  itemName: string;
  description?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface Quotation {
  id: string;
  rfqId: string;
  vendorId: string;
  vendor: Vendor;
  quotationNumber: string;
  quotationDate: string;
  totalPrice: number;
  deliveryDays: number;
  paymentTerms: string;
  notes?: string | null;
  status: QuotationStatus;
  selectionReason?: string | null;
  items?: QuotationItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Rfq {
  id: string;
  rfqNumber: string;
  purchaseRequestId: string;
  purchaseRequest: PurchaseRequest;
  deadline: string;
  status: RfqStatus;
  createdAt: string;
  updatedAt: string;
  rfqVendors: RfqVendor[];
  quotations: Quotation[];
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  itemName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  receivedQuantity: number;
}

export interface GoodsReceiptItem {
  id: string;
  goodsReceiptId: string;
  poItemId: string;
  poItem?: PurchaseOrderItem;
  quantityReceived: number;
}

export interface GoodsReceipt {
  id: string;
  receiptNumber: string;
  purchaseOrderId: string;
  purchaseOrder?: {
    poNumber: string;
    vendor: Vendor;
    vessel: Vessel;
  };
  deliveryDate: string;
  condition: GoodsCondition;
  notes?: string | null;
  receivedById: string;
  receivedBy?: { id: string; name: string; email?: string };
  createdAt: string;
  items: GoodsReceiptItem[];
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendor: Vendor;
  vesselId: string;
  vessel: Vessel;
  purchaseRequestId: string;
  purchaseRequest?: PurchaseRequest;
  rfqId?: string | null;
  quotationId?: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  deliveryDate: string;
  paymentTerms: string;
  status: PoStatus;
  createdById: string;
  createdBy?: { id: string; name: string; email: string; role?: string };
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseOrderItem[];
  goodsReceipts?: GoodsReceipt[];
  approvals?: Approval[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId?: string | null;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  metadata?: string | null;
}

export interface DashboardSummary {
  kpis: {
    purchaseRequests: number;
    pendingApprovals: number;
    approvedPrs?: number;
    awaitingRfqPrs?: number;
    pendingReviewPrs?: number;
    openRfqs: number;
    activePos: number;
    pendingDeliveries: number;
    completedProcurements: number;
    totalSpend: number;
  };
  recentPurchaseRequests: PurchaseRequest[];
  pendingApprovals: {
    purchaseRequests: PurchaseRequest[];
    purchaseOrders: PurchaseOrder[];
  };
  recentActivity: AuditLog[];
}
