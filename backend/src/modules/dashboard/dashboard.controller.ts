import { Response, NextFunction } from 'express';
import prisma from '../../config/prisma.js';
import { AuthenticatedRequest, PrStatus, PoStatus, RfqStatus } from '../../types/index.js';

export async function getDashboardSummary(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const [
      totalPrs,
      pendingPrApprovals,
      pendingPoApprovals,
      openRfqs,
      activePos,
      pendingDeliveries,
      completedProcurements,
      totalSpendResult,
    ] = await Promise.all([
      prisma.purchaseRequest.count(),
      prisma.purchaseRequest.count({
        where: { status: PrStatus.PENDING_APPROVAL as string },
      }),
      prisma.purchaseOrder.count({
        where: { status: PoStatus.PENDING_APPROVAL as string },
      }),
      prisma.rfq.count({
        where: { status: RfqStatus.OPEN as string },
      }),
      prisma.purchaseOrder.count({
        where: {
          status: {
            in: [PoStatus.ORDERED as string, PoStatus.PARTIALLY_RECEIVED as string],
          },
        },
      }),
      prisma.purchaseOrder.count({
        where: {
          status: {
            in: [PoStatus.ORDERED as string, PoStatus.PARTIALLY_RECEIVED as string],
          },
        },
      }),
      prisma.purchaseRequest.count({
        where: { status: PrStatus.COMPLETED as string },
      }),
      prisma.purchaseOrder.aggregate({
        _sum: { total: true },
        where: {
          status: {
            in: [
              PoStatus.ORDERED as string,
              PoStatus.PARTIALLY_RECEIVED as string,
              PoStatus.RECEIVED as string,
              PoStatus.COMPLETED as string,
            ],
          },
        },
      }),
    ]);

    const recentPrs = await prisma.purchaseRequest.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: {
        vessel: true,
        requester: { select: { name: true, department: true } },
        items: true,
      },
    });

    const pendingPrs = await prisma.purchaseRequest.findMany({
      where: { status: PrStatus.PENDING_APPROVAL as string },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        vessel: true,
        requester: { select: { name: true, department: true } },
        items: true,
      },
    });

    const pendingPos = await prisma.purchaseOrder.findMany({
      where: { status: PoStatus.PENDING_APPROVAL as string },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: true,
        vessel: true,
        createdBy: { select: { name: true } },
      },
    });

    const recentActivity = await prisma.auditLog.findMany({
      take: 8,
      orderBy: { timestamp: 'desc' },
    });

    res.json({
      success: true,
      data: {
        kpis: {
          purchaseRequests: totalPrs,
          pendingApprovals: pendingPrApprovals + pendingPoApprovals,
          openRfqs,
          activePos,
          pendingDeliveries,
          completedProcurements,
          totalSpend: totalSpendResult._sum.total || 0,
        },
        recentPurchaseRequests: recentPrs,
        pendingApprovals: {
          purchaseRequests: pendingPrs,
          purchaseOrders: pendingPos,
        },
        recentActivity,
      },
    });
  } catch (error) {
    next(error);
  }
}
