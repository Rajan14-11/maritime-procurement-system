import { Response, NextFunction } from 'express';
import prisma from '../../config/prisma.js';
import {
  AuthenticatedRequest,
  PrPriority,
  PrStatus,
  UserRole,
  ApprovalEntityType,
  ApprovalDecision,
} from '../../types/index.js';
import { logAudit } from '../../utils/audit.js';

export async function listPurchaseRequests(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { search, status, vesselId, priority } = req.query;

    const where: any = {};

    if (req.user?.role === UserRole.REQUESTER) {
      where.requesterId = req.user.id;
      if (req.user.vesselId) {
        where.vesselId = req.user.vesselId;
      }
    }

    if (search) {
      where.OR = [
        { prNumber: { contains: String(search) } },
        { department: { contains: String(search) } },
        { reason: { contains: String(search) } },
        { vessel: { name: { contains: String(search) } } },
        {
          items: {
            some: {
              itemName: { contains: String(search) },
            },
          },
        },
      ];
    }

    const isApproverOrOfficer =
      req.user?.role === UserRole.APPROVER || req.user?.role === UserRole.PROCUREMENT_OFFICER;

    if (isApproverOrOfficer) {
      // Approvers and Procurement Officers only see submitted demands, never unsubmitted DRAFTs
      if (status && status !== PrStatus.DRAFT && Object.values(PrStatus).includes(status as PrStatus)) {
        where.status = status as string;
      } else if (status === PrStatus.DRAFT) {
        where.status = '__no_drafts_allowed__';
      } else {
        where.status = { not: PrStatus.DRAFT };
      }
    } else if (status && Object.values(PrStatus).includes(status as PrStatus)) {
      where.status = status as string;
    }

    if (vesselId) {
      where.vesselId = String(vesselId);
    }

    if (priority && Object.values(PrPriority).includes(priority as PrPriority)) {
      where.priority = priority as string;
    }

    const purchaseRequests = await prisma.purchaseRequest.findMany({
      where,
      include: {
        vessel: true,
        requester: {
          select: { id: true, name: true, email: true, department: true },
        },
        items: true,
        rfq: {
          select: { id: true, rfqNumber: true, status: true },
        },
        purchaseOrders: {
          select: { id: true, poNumber: true, status: true, total: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: { purchaseRequests },
    });
  } catch (error) {
    next(error);
  }
}

export async function getPurchaseRequestById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;

    const pr = await prisma.purchaseRequest.findFirst({
      where: {
        OR: [{ id }, { prNumber: id }],
      },
      include: {
        vessel: true,
        requester: {
          select: { id: true, name: true, email: true, department: true },
        },
        items: true,
        approvals: {
          include: {
            approver: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        rfq: {
          include: {
            rfqVendors: { include: { vendor: true } },
            quotations: { include: { vendor: true } },
          },
        },
        purchaseOrders: {
          include: {
            vendor: true,
            goodsReceipts: true,
          },
        },
      },
    });

    if (!pr) {
      res.status(404).json({
        success: false,
        message: 'Purchase request not found.',
      });
      return;
    }

    if (req.user?.role === UserRole.REQUESTER && pr.requesterId !== req.user.id) {
      res.status(403).json({
        success: false,
        message: 'You are not authorized to view this purchase request.',
      });
      return;
    }

    if (pr.status === PrStatus.DRAFT && req.user?.role !== UserRole.ADMIN && pr.requesterId !== req.user?.id) {
      res.status(403).json({
        success: false,
        message: 'Draft purchase requests can only be viewed by the creating requester.',
      });
      return;
    }

    const prData = pr as any;
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'PURCHASE_REQUEST', entityId: pr.id },
          ...(prData.rfq ? [{ entityType: 'RFQ', entityId: prData.rfq.id }] : []),
          ...(prData.purchaseOrders ? prData.purchaseOrders.map((po: any) => ({
            entityType: 'PURCHASE_ORDER',
            entityId: po.id,
          })) : []),
        ],
      },
      orderBy: { timestamp: 'asc' },
    });

    res.json({
      success: true,
      data: {
        purchaseRequest: pr,
        auditLogs,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createPurchaseRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      vesselId,
      department,
      priority,
      requiredDate,
      reason,
      items,
      submitImmediately = true,
    } = req.body;

    if (req.user?.role !== UserRole.REQUESTER && req.user?.role !== UserRole.ADMIN) {
      res.status(403).json({
        success: false,
        message: 'Only vessel Requesters (Chief Engineers) and Fleet Admins are authorized to create purchase requests.',
      });
      return;
    }

    let targetVesselId = vesselId;

    if (req.user?.role === UserRole.REQUESTER) {
      if (!req.user.vesselId) {
        res.status(400).json({
          success: false,
          message: 'Requester is not assigned to a vessel.',
        });
        return;
      }
      if (vesselId && vesselId !== req.user.vesselId) {
        res.status(403).json({
          success: false,
          message: 'You are only authorized to create purchase requests for your assigned vessel.',
        });
        return;
      }
      targetVesselId = req.user.vesselId;
    } else {
      if (!targetVesselId) {
        res.status(400).json({ success: false, message: 'Vessel is mandatory.' });
        return;
      }
    }

    if (!department || !department.trim()) {
      res.status(400).json({ success: false, message: 'Department is mandatory.' });
      return;
    }
    if (!priority || !Object.values(PrPriority).includes(priority)) {
      res.status(400).json({ success: false, message: 'Valid priority is mandatory.' });
      return;
    }
    if (!requiredDate) {
      res.status(400).json({ success: false, message: 'Required date is mandatory.' });
      return;
    }

    const reqDate = new Date(requiredDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(reqDate.getTime()) || reqDate < today) {
      res.status(400).json({
        success: false,
        message: 'Required date cannot be in the past.',
      });
      return;
    }

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, message: 'Reason is mandatory.' });
      return;
    }

    const vessel = await prisma.vessel.findUnique({ where: { id: targetVesselId } });
    if (!vessel) {
      res.status(404).json({ success: false, message: 'Vessel not found.' });
      return;
    }
    if (vessel.status !== 'ACTIVE') {
      res.status(400).json({
        success: false,
        message: `Vessel ${vessel.name} is currently inactive and cannot be selected.`,
      });
      return;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'At least one line item is mandatory.',
      });
      return;
    }

    let calculatedTotal = 0;
    const validatedItems: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.itemName || !item.itemName.trim()) {
        res.status(400).json({
          success: false,
          message: `Item #${i + 1}: Item name is mandatory.`,
        });
        return;
      }
      const quantity = Number(item.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        res.status(400).json({
          success: false,
          message: `Item #${i + 1}: Quantity must be greater than zero.`,
        });
        return;
      }
      const unitPrice = Number(item.estimatedUnitPrice || 0);
      if (isNaN(unitPrice) || unitPrice < 0) {
        res.status(400).json({
          success: false,
          message: `Item #${i + 1}: Estimated unit price cannot be negative.`,
        });
        return;
      }

      const itemTotal = quantity * unitPrice;
      calculatedTotal += itemTotal;

      validatedItems.push({
        itemName: item.itemName.trim(),
        description: item.description?.trim() || '',
        quantity,
        unit: item.unit?.trim() || 'Pieces',
        estimatedUnitPrice: unitPrice,
        estimatedTotal: itemTotal,
      });
    }

    const lastPr = await prisma.purchaseRequest.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { prNumber: true },
    });
    let nextNum = 1001;
    if (lastPr && lastPr.prNumber.startsWith('PR-')) {
      const parsed = parseInt(lastPr.prNumber.replace('PR-', ''), 10);
      if (!isNaN(parsed)) {
        nextNum = parsed + 1;
      }
    }
    const prNumber = `PR-${nextNum}`;

    const initialStatus = submitImmediately
      ? PrStatus.PENDING_APPROVAL
      : PrStatus.DRAFT;

    const result = await prisma.$transaction(async (tx) => {
      const pr = await tx.purchaseRequest.create({
        data: {
          prNumber,
          vesselId: targetVesselId,
          department: department.trim(),
          priority: priority as PrPriority,
          requiredDate: reqDate,
          estimatedTotal: calculatedTotal,
          reason: reason.trim(),
          status: initialStatus,
          requesterId: req.user!.id,
          items: {
            create: validatedItems,
          },
        },
        include: {
          vessel: true,
          items: true,
          requester: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'CREATE_PURCHASE_REQUEST',
          entityType: 'PURCHASE_REQUEST',
          entityId: pr.id,
          description: `Purchase request ${pr.prNumber} created for vessel ${vessel.name} with ${items.length} item(s) totaling ₹${calculatedTotal.toLocaleString()}.`,
        },
        tx
      );

      if (submitImmediately) {
        await logAudit(
          {
            userId: req.user!.id,
            userName: req.user!.name,
            userRole: req.user!.role,
            action: 'SUBMIT_PURCHASE_REQUEST',
            entityType: 'PURCHASE_REQUEST',
            entityId: pr.id,
            description: `Purchase request ${pr.prNumber} submitted for approval.`,
          },
          tx
        );
      }

      return pr;
    });

    res.status(201).json({
      success: true,
      message: `Purchase request ${result.prNumber} created successfully.`,
      data: { purchaseRequest: result },
    });
  } catch (error) {
    next(error);
  }
}

export async function submitPurchaseRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id },
    });

    if (!pr) {
      res.status(404).json({ success: false, message: 'Purchase request not found.' });
      return;
    }

    if (pr.status !== PrStatus.DRAFT) {
      res.status(400).json({
        success: false,
        message: `Only DRAFT requests can be submitted. Current status is ${pr.status}.`,
      });
      return;
    }

    if (req.user?.role !== UserRole.ADMIN && pr.requesterId !== req.user?.id) {
      res.status(403).json({
        success: false,
        message: 'You are not authorized to submit this purchase request.',
      });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedPr = await tx.purchaseRequest.update({
        where: { id },
        data: { status: PrStatus.PENDING_APPROVAL },
      });

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'SUBMIT_PURCHASE_REQUEST',
          entityType: 'PURCHASE_REQUEST',
          entityId: pr.id,
          description: `Purchase request ${pr.prNumber} submitted for approval.`,
        },
        tx
      );

      return updatedPr;
    });

    res.json({
      success: true,
      message: `Purchase request ${pr.prNumber} submitted for approval.`,
      data: { purchaseRequest: updated },
    });
  } catch (error) {
    next(error);
  }
}

export async function approvePurchaseRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { comments } = req.body;

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id },
    });

    if (!pr) {
      res.status(404).json({ success: false, message: 'Purchase request not found.' });
      return;
    }

    if (pr.status !== PrStatus.PENDING_APPROVAL) {
      res.status(400).json({
        success: false,
        message: `Purchase request must be in PENDING_APPROVAL status. Current status is ${pr.status}.`,
      });
      return;
    }

    if (pr.requesterId === req.user!.id && req.user!.role !== UserRole.ADMIN) {
      res.status(403).json({
        success: false,
        message: 'Conflict of interest: Requesters cannot approve their own purchase requests.',
      });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.approval.create({
        data: {
          entityType: ApprovalEntityType.PURCHASE_REQUEST,
          entityId: pr.id,
          purchaseRequestId: pr.id,
          approverId: req.user!.id,
          decision: ApprovalDecision.APPROVED,
          comments: comments?.trim() || null,
        },
      });

      const updatedPr = await tx.purchaseRequest.update({
        where: { id },
        data: { status: PrStatus.APPROVED },
      });

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'APPROVE_PURCHASE_REQUEST',
          entityType: 'PURCHASE_REQUEST',
          entityId: pr.id,
          description: `Purchase request ${pr.prNumber} approved by ${req.user!.name} (${req.user!.role}).${comments ? ` Comments: "${comments}"` : ''}`,
        },
        tx
      );

      return updatedPr;
    });

    res.json({
      success: true,
      message: `Purchase request ${pr.prNumber} has been approved.`,
      data: { purchaseRequest: updated },
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectPurchaseRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({
        success: false,
        message: 'A rejection reason is mandatory when rejecting a purchase request.',
      });
      return;
    }

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id },
    });

    if (!pr) {
      res.status(404).json({ success: false, message: 'Purchase request not found.' });
      return;
    }

    if (pr.status !== PrStatus.PENDING_APPROVAL) {
      res.status(400).json({
        success: false,
        message: `Only requests in PENDING_APPROVAL status can be rejected. Current status is ${pr.status}.`,
      });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.approval.create({
        data: {
          entityType: ApprovalEntityType.PURCHASE_REQUEST,
          entityId: pr.id,
          purchaseRequestId: pr.id,
          approverId: req.user!.id,
          decision: ApprovalDecision.REJECTED,
          comments: reason.trim(),
        },
      });

      const updatedPr = await tx.purchaseRequest.update({
        where: { id },
        data: {
          status: PrStatus.REJECTED,
          rejectionReason: reason.trim(),
        },
      });

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'REJECT_PURCHASE_REQUEST',
          entityType: 'PURCHASE_REQUEST',
          entityId: pr.id,
          description: `Purchase request ${pr.prNumber} rejected by ${req.user!.name}. Reason: ${reason.trim()}`,
        },
        tx
      );

      return updatedPr;
    });

    res.json({
      success: true,
      message: `Purchase request ${pr.prNumber} has been rejected.`,
      data: { purchaseRequest: updated },
    });
  } catch (error) {
    next(error);
  }
}

export async function updatePurchaseRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { department, priority, requiredDate, reason, items, vesselId } = req.body;

    const pr = await prisma.purchaseRequest.findFirst({
      where: {
        OR: [{ id }, { prNumber: id }],
      },
      include: { items: true },
    });

    if (!pr) {
      res.status(404).json({ success: false, message: 'Purchase request not found.' });
      return;
    }

    if (req.user?.role !== UserRole.REQUESTER && req.user?.role !== UserRole.ADMIN) {
      res.status(403).json({
        success: false,
        message: 'Only vessel Requesters (Chief Engineers) and Fleet Admins are authorized to edit purchase requests.',
      });
      return;
    }

    if (req.user?.role === UserRole.REQUESTER && pr.requesterId !== req.user.id) {
      res.status(403).json({
        success: false,
        message: 'You are not authorized to edit this purchase request.',
      });
      return;
    }

    if (pr.status !== PrStatus.DRAFT) {
      res.status(400).json({
        success: false,
        message: `Only DRAFT purchase requests can be edited. Current status is ${pr.status}.`,
      });
      return;
    }

    if (req.user?.role === UserRole.REQUESTER) {
      if (vesselId && vesselId !== req.user.vesselId) {
        res.status(403).json({
          success: false,
          message: 'You cannot change the purchase request to another vessel.',
        });
        return;
      }
    }

    const updateData: any = {};
    if (department && department.trim()) updateData.department = department.trim();
    if (priority && Object.values(PrPriority).includes(priority)) updateData.priority = priority as PrPriority;
    if (requiredDate) {
      const reqDate = new Date(requiredDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (isNaN(reqDate.getTime()) || reqDate < today) {
        res.status(400).json({ success: false, message: 'Required date cannot be in the past.' });
        return;
      }
      updateData.requiredDate = reqDate;
    }
    if (reason && reason.trim()) updateData.reason = reason.trim();
    if (vesselId && req.user?.role === UserRole.ADMIN) {
      const v = await prisma.vessel.findUnique({ where: { id: vesselId } });
      if (!v || v.status !== 'ACTIVE') {
        res.status(400).json({ success: false, message: 'Invalid or inactive vessel selected.' });
        return;
      }
      updateData.vesselId = vesselId;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Array.isArray(items) && items.length > 0) {
        let calculatedTotal = 0;
        const validatedItems: any[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (!item.itemName || !item.itemName.trim()) {
            throw new Error(`Item #${i + 1}: Item name is mandatory.`);
          }
          const quantity = Number(item.quantity);
          const unitPrice = Number(item.estimatedUnitPrice || 0);
          if (isNaN(quantity) || quantity <= 0) {
            throw new Error(`Item #${i + 1}: Quantity must be greater than zero.`);
          }
          const itemTotal = quantity * unitPrice;
          calculatedTotal += itemTotal;
          validatedItems.push({
            itemName: item.itemName.trim(),
            description: item.description?.trim() || '',
            quantity,
            unit: item.unit?.trim() || 'Pieces',
            estimatedUnitPrice: unitPrice,
            estimatedTotal: itemTotal,
          });
        }
        await tx.purchaseRequestItem.deleteMany({ where: { purchaseRequestId: pr.id } });
        updateData.items = { create: validatedItems };
        updateData.estimatedTotal = calculatedTotal;
      }

      const resPr = await tx.purchaseRequest.update({
        where: { id: pr.id },
        data: updateData,
        include: { vessel: true, items: true, requester: true },
      });

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'UPDATE_PURCHASE_REQUEST',
          entityType: 'PURCHASE_REQUEST',
          entityId: pr.id,
          description: `Purchase request ${pr.prNumber} updated by ${req.user!.name}.`,
        },
        tx
      );

      return resPr;
    });

    res.json({
      success: true,
      message: `Purchase request ${pr.prNumber} updated successfully.`,
      data: { purchaseRequest: updated },
    });
  } catch (error: any) {
    if (error.message && error.message.includes('Item #')) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

