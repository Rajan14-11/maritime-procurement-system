import { Request } from 'express';

export enum UserRole {
  REQUESTER = 'REQUESTER',
  PROCUREMENT_OFFICER = 'PROCUREMENT_OFFICER',
  APPROVER = 'APPROVER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum VesselStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum VendorStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum PrPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum PrStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RFQ_CREATED = 'RFQ_CREATED',
  VENDOR_SELECTED = 'VENDOR_SELECTED',
  PO_CREATED = 'PO_CREATED',
  COMPLETED = 'COMPLETED',
}

export enum RfqStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum QuotationStatus {
  RECEIVED = 'RECEIVED',
  SELECTED = 'SELECTED',
  REJECTED = 'REJECTED',
}

export enum PoStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ORDERED = 'ORDERED',
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
  RECEIVED = 'RECEIVED',
  COMPLETED = 'COMPLETED',
}

export enum GoodsCondition {
  GOOD = 'GOOD',
  DAMAGED = 'DAMAGED',
  PARTIALLY_DAMAGED = 'PARTIALLY_DAMAGED',
}

export enum ApprovalEntityType {
  PURCHASE_REQUEST = 'PURCHASE_REQUEST',
  PURCHASE_ORDER = 'PURCHASE_ORDER',
}

export enum ApprovalDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string | null;
  status: UserStatus;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: any;
}
