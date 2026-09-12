import { Response, NextFunction } from 'express';
import prisma from '../../config/prisma.js';
import { AuthenticatedRequest, PrStatus, PoStatus, RfqStatus, UserRole } from '../../types/index.js';

export async function getDashboardSummary(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const isRequester = req.user?.role === UserRole.REQUESTER;
    const userId = req.user?.id;

    // Build role-scoped filters
    const prScope = isRequester && userId ? { requesterId: userId } : {};
    const poScope = isRequester && userId ? { purchaseRequest: { requesterId: userId } } : {};
    const rfqScope = isRequester && userId ? { purchaseRequest: { requesterId: userId } } : {};

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
      // Total PRs
      prisma.purchaseRequest.count({ where: prScope }),

      // Pending PR approvals (requesters have 0 actionable approvals)
      isRequester
        ? Promise.resolve(0)
        : prisma.purchaseRequest.count({
            where: { status: PrStatus.PENDING_APPROVAL as string },
          }),

      // Pending PO approvals (requesters have 0 actionable approvals)
      isRequester
        ? Promise.resolve(0)
        : prisma.purchaseOrder.count({
            where: { status: PoStatus.PENDING_APPROVAL as string },
          }),

      // Open RFQs (scoped to requester's requests if requester)
      prisma.rfq.count({
        where: {
          status: RfqStatus.OPEN as string,
          ...rfqScope,
        },
      }),

      // Active POs: All in-flight purchasing orders
      prisma.purchaseOrder.count({
        where: {
          status: {
            in: [
              PoStatus.PENDING_APPROVAL as string,
              PoStatus.APPROVED as string,
              PoStatus.ORDERED as string,
              PoStatus.PARTIALLY_RECEIVED as string,
            ],
          },
          ...poScope,
        },
      }),

      // Pending Deliveries: Orders dispatched to vendor awaiting physical delivery at port
      prisma.purchaseOrder.count({
        where: {
          status: {
            in: [PoStatus.ORDERED as string, PoStatus.PARTIALLY_RECEIVED as string],
          },
          ...poScope,
        },
      }),

      // Completed Procurements
      prisma.purchaseRequest.count({
        where: {
          status: PrStatus.COMPLETED as string,
          ...prScope,
        },
      }),

      // Total Spend
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
          ...poScope,
        },
      }),
    ]);

    // Recent PRs (scoped)
    const recentPrs = await prisma.purchaseRequest.findMany({
      where: prScope,
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: {
        vessel: true,
        requester: { select: { name: true, department: true } },
        items: true,
      },
    });

    // Pending queues (only for approvers/admins)
    const pendingPrs = isRequester
      ? []
      : await prisma.purchaseRequest.findMany({
          where: { status: PrStatus.PENDING_APPROVAL as string },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            vessel: true,
            requester: { select: { name: true, department: true } },
            items: true,
          },
        });

    const pendingPos = isRequester
      ? []
      : await prisma.purchaseOrder.findMany({
          where: { status: PoStatus.PENDING_APPROVAL as string },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            vendor: true,
            vessel: true,
            createdBy: { select: { name: true } },
          },
        });

    // Recent activity: requesters only see their own activity
    const activityScope = isRequester && userId ? { userId } : {};
    const recentActivity = await prisma.auditLog.findMany({
      where: activityScope,
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
