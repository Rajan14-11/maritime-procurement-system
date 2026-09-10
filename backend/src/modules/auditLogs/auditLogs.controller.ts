import { Response, NextFunction } from 'express';
import prisma from '../../config/prisma.js';
import { AuthenticatedRequest } from '../../types/index.js';

export async function listAuditLogs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { search, entityType, entityId, action, limit = '50' } = req.query;

    const where: any = {};
    if (search && search !== 'undefined') {
      where.OR = [
        { description: { contains: String(search) } },
        { userName: { contains: String(search) } },
        { action: { contains: String(search) } },
        { entityId: { contains: String(search) } },
      ];
    }
    if (entityType && entityType !== 'undefined' && entityType !== 'ALL') {
      where.entityType = String(entityType);
    }
    if (entityId && entityId !== 'undefined') {
      where.entityId = String(entityId);
    }
    if (action && action !== 'undefined' && action !== 'ALL') {
      where.action = String(action);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: Math.min(Number(limit) || 50, 100),
    });

    res.json({
      success: true,
      data: { logs },
    });
  } catch (error) {
    next(error);
  }
}
