import { Response, NextFunction } from 'express';
import prisma from '../../config/prisma.js';
import { AuthenticatedRequest, PrStatus, PoStatus, RfqStatus, UserRole } from '../../types/index.js';

export async function getDashboardSummary(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (req.user?.role === UserRole.VENDOR) {
      const vendorId = req.user.vendorId;
      if (!vendorId) {
        res.json({
          success: true,
          data: {
            kpis: {
              openRfqs: 0,
              submittedQuotes: 0,
              activePos: 0,
              pendingDispatches: 0,
              completedDeliveries: 0,
              totalSpend: 0,
            },
            recentRfqs: [],
            recentOrders: [],
            recentActivity: [],
          },
        });
        return;
      }

      const [
        openRfqsCount,
        submittedQuotesCount,
        activePosCount,
        pendingDispatchesCount,
        completedDeliveriesCount,
        awardedSpendResult,
        recentRfqs,
        recentOrders,
        recentActivity,
      ] = await Promise.all([
        prisma.rfq.count({
          where: {
            status: RfqStatus.OPEN,
            rfqVendors: { some: { vendorId } },
          },
        }),
        prisma.quotation.count({
          where: { vendorId },
        }),
        prisma.purchaseOrder.count({
          where: {
            vendorId,
            status: { in: [PoStatus.ORDERED, PoStatus.PARTIALLY_RECEIVED] },
          },
        }),
        prisma.purchaseOrder.count({
          where: {
            vendorId,
            status: PoStatus.ORDERED,
            dispatchedAt: null,
          },
        }),
        prisma.purchaseOrder.count({
          where: {
            vendorId,
            status: { in: [PoStatus.RECEIVED, PoStatus.COMPLETED] },
          },
        }),
        prisma.purchaseOrder.aggregate({
          _sum: { total: true },
          where: {
            vendorId,
            status: {
              in: [
                PoStatus.ORDERED,
                PoStatus.PARTIALLY_RECEIVED,
                PoStatus.RECEIVED,
                PoStatus.COMPLETED,
              ],
            },
          },
        }),
        prisma.rfq.findMany({
          where: { rfqVendors: { some: { vendorId } } },
          take: 6,
          orderBy: { createdAt: 'desc' },
          include: {
            purchaseRequest: {
              include: { vessel: true, items: true },
            },
            quotations: {
              where: { vendorId },
              include: { vendor: true },
            },
          },
        }),
        prisma.purchaseOrder.findMany({
          where: {
            vendorId,
            status: {
              in: [
                PoStatus.ORDERED,
                PoStatus.PARTIALLY_RECEIVED,
                PoStatus.RECEIVED,
                PoStatus.COMPLETED,
              ],
            },
          },
          take: 6,
          orderBy: { createdAt: 'desc' },
          include: { vessel: true, items: true },
        }),
        prisma.auditLog.findMany({
          where: {
            OR: [
              { userId: req.user.id },
              ...(req.user.vendor?.name
                ? [{ description: { contains: req.user.vendor.name } }]
                : []),
            ],
          },
          take: 8,
          orderBy: { timestamp: 'desc' },
        }),
      ]);

      res.json({
        success: true,
        data: {
          kpis: {
            openRfqs: openRfqsCount,
            submittedQuotes: submittedQuotesCount,
            activePos: activePosCount,
            pendingDispatches: pendingDispatchesCount,
            completedDeliveries: completedDeliveriesCount,
            totalSpend: Number(awardedSpendResult._sum?.total || 0),
          },
          recentRfqs,
          recentOrders,
          recentActivity,
        },
      });
      return;
    }

    const isRequester = req.user?.role === UserRole.REQUESTER;
    const isApproverOrOfficer =
      req.user?.role === UserRole.APPROVER || req.user?.role === UserRole.PROCUREMENT_OFFICER;
    const userId = req.user?.id;

    // Build role-scoped filters: Requesters only see their own PRs; Approvers/Officers only see submitted demands (no drafts)
    const requesterPrScope = isRequester && userId ? { requesterId: userId } : {};
    const prScope = isRequester && userId
      ? { requesterId: userId }
      : isApproverOrOfficer
      ? { status: { not: PrStatus.DRAFT } }
      : {};
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
      awaitingRfqPrs,
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

      // Completed Procurements (PR marked COMPLETED once delivery is 100% received)
      prisma.purchaseRequest.count({
        where: {
          status: PrStatus.COMPLETED,
          ...requesterPrScope,
        },
      }),

      // All Approved PRs / Demands across the procurement lifecycle
      // Once approved, PRs proceed: APPROVED -> RFQ_CREATED -> VENDOR_SELECTED -> PO_CREATED -> COMPLETED
      prisma.purchaseRequest.count({
        where: {
          status: {
            in: [
              PrStatus.APPROVED,
              PrStatus.RFQ_CREATED,
              PrStatus.VENDOR_SELECTED,
              PrStatus.PO_CREATED,
              PrStatus.COMPLETED,
            ],
          },
          ...requesterPrScope,
        },
      }),

      // Approved PRs specifically awaiting RFQ sourcing (PR status = APPROVED)
      prisma.purchaseRequest.count({
        where: {
          status: PrStatus.APPROVED,
          ...requesterPrScope,
        },
      }),

      // PRs currently in review / pending approval
      prisma.purchaseRequest.count({
        where: {
          status: PrStatus.PENDING_APPROVAL,
          ...requesterPrScope,
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
          awaitingRfqPrs,
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
