import prisma from '../config/prisma.js';
import { Prisma } from '@prisma/client';

export interface AuditParams {
  userId?: string | null;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  metadata?: Record<string, any> | null;
}

export async function logAudit(
  params: AuditParams,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;
  try {
    return await client.auditLog.create({
      data: {
        userId: params.userId || undefined,
        userName: params.userName,
        userRole: params.userRole,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        description: params.description,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // Audit log failure shouldn't necessarily crash non-critical paths, but will be logged
  }
}
