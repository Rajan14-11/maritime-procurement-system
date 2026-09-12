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
