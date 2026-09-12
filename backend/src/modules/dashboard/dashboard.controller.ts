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
      approvedPrs,
      pendingReviewPrs,
      totalSpendResult,
    ] = await Promise.all([
      // Total PRs
      prisma.purchaseRequest.count({ where: prScope }),

      // Pending PR approvals (requesters have 0 actionable approvals)
      isRequester
        ? Promise.resolve(0)
        : prisma.purchaseRequest.count({
            where: { status: PrStatus.PENDING_APPROVAL },
          }),

      // Pending PO approvals (requesters have 0 actionable approvals)
      isRequester
        ? Promise.resolve(0)
        : prisma.purchaseOrder.count({
            where: { status: PoStatus.PENDING_APPROVAL },
          }),

      // Open RFQs (scoped to requester's requests if requester)
      prisma.rfq.count({
        where: {
          status: RfqStatus.OPEN,
          ...rfqScope,
        },
      }),

      // Active POs: All in-flight purchasing orders
      prisma.purchaseOrder.count({
        where: {
          status: {
            in: [
              PoStatus.PENDING_APPROVAL,
              PoStatus.APPROVED,
              PoStatus.ORDERED,
              PoStatus.PARTIALLY_RECEIVED,
            ],
          },
          ...poScope,
        },
      }),

      // Pending Deliveries: Orders dispatched to vendor awaiting physical delivery at port
      prisma.purchaseOrder.count({
        where: {
          status: {
            in: [PoStatus.ORDERED, PoStatus.PARTIALLY_RECEIVED],
          },
          ...poScope,
        },
      }),

      // Completed Procurements
      prisma.purchaseRequest.count({
        where: {
          status: PrStatus.COMPLETED,
          ...prScope,
        },
      }),

      // Approved PRs awaiting RFQ sourcing (PR status = APPROVED)
      prisma.purchaseRequest.count({
        where: {
          status: PrStatus.APPROVED,
          ...prScope,
        },
      }),

      // PRs currently in review / pending approval
      prisma.purchaseRequest.count({
        where: {
          status: PrStatus.PENDING_APPROVAL,
          ...prScope,
        },
      }),

      // Total Spend
      prisma.purchaseOrder.aggregate({
        _sum: { total: true },
        where: {
          status: {
            in: [
              PoStatus.ORDERED,
              PoStatus.PARTIALLY_RECEIVED,
              PoStatus.RECEIVED,
              PoStatus.COMPLETED,
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
          where: { status: PrStatus.PENDING_APPROVAL },
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
          where: { status: PoStatus.PENDING_APPROVAL },
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
          pendingApprovals:
            req.user?.role === UserRole.APPROVER || req.user?.role === UserRole.ADMIN
              ? pendingPrApprovals + pendingPoApprovals
              : 0,
          approvedPrs,
          pendingReviewPrs,
          openRfqs,
          activePos,
          pendingDeliveries,
          completedProcurements,
          totalSpend: Number(totalSpendResult._sum?.total || 0),
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
