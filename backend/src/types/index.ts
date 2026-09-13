import { Request } from 'express';
import {
  UserRole,
  UserStatus,
  VesselStatus,
  VendorStatus,
  PrPriority,
  PrStatus,
  RfqStatus,
  QuotationStatus,
  PoStatus,
  GoodsCondition,
  ApprovalEntityType,
  ApprovalDecision,
} from '@prisma/client';

export {
  UserRole,
  UserStatus,
  VesselStatus,
  VendorStatus,
  PrPriority,
  PrStatus,
  RfqStatus,
  QuotationStatus,
  PoStatus,
  GoodsCondition,
  ApprovalEntityType,
  ApprovalDecision,
};

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string | null;
  status: UserStatus;
  vesselId?: string | null;
  vessel?: {
    id: string;
    name: string;
    imoNumber: string;
    status: VesselStatus;
  } | null;
  vendorId?: string | null;
  vendor?: {
    id: string;
    vendorCode: string;
    name: string;
    status: VendorStatus;
  } | null;
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
