import { Response, NextFunction } from 'express';
import prisma from '../../config/prisma.js';
import { AuthenticatedRequest, PrStatus, PoStatus } from '../../types/index.js';

export async function getPendingApprovals(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const pendingRequests = await prisma.purchaseRequest.findMany({
      where: { status: PrStatus.PENDING_APPROVAL },
      include: {
        vessel: true,
        requester: { select: { id: true, name: true, email: true, department: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const pendingOrders = await prisma.purchaseOrder.findMany({
      where: { status: PoStatus.PENDING_APPROVAL },
      include: {
        vendor: true,
        vessel: true,
        purchaseRequest: { select: { prNumber: true, department: true, reason: true } },
        createdBy: { select: { id: true, name: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        totalPending: pendingRequests.length + pendingOrders.length,
        purchaseRequests: pendingRequests,
        purchaseOrders: pendingOrders,
      },
    });
  } catch (error) {
    next(error);
  }
}
