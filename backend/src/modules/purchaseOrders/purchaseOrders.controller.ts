import { Response, NextFunction } from 'express';
import prisma from '../../config/prisma.js';
import {
  AuthenticatedRequest,
  PoStatus,
  PrStatus,
  QuotationStatus,
  ApprovalEntityType,
  ApprovalDecision,
  UserRole,
} from '../../types/index.js';
import { logAudit } from '../../utils/audit.js';

export async function listPurchaseOrders(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { search, status, vendorId, vesselId } = req.query;

    const where: any = {};
    if (search) {
      where.OR = [
        { poNumber: { contains: String(search) } },
        { vendor: { name: { contains: String(search) } } },
        { vessel: { name: { contains: String(search) } } },
        { purchaseRequest: { prNumber: { contains: String(search) } } },
      ];
    }
    if (status && Object.values(PoStatus).includes(status as PoStatus)) {
      where.status = status as string;
    }
    if (vendorId) {
      where.vendorId = String(vendorId);
    }
    if (vesselId) {
      where.vesselId = String(vesselId);
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: true,
        vessel: true,
        purchaseRequest: {
          select: { id: true, prNumber: true, department: true, reason: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        items: true,
        goodsReceipts: {
          include: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: { purchaseOrders },
    });
  } catch (error) {
    next(error);
  }
}

export async function getPurchaseOrderById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        vessel: true,
        purchaseRequest: {
          include: {
            requester: { select: { id: true, name: true, email: true } },
          },
        },
        rfq: true,
        quotation: true,
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        items: {
          include: {
            goodsReceiptItems: {
              include: {
                goodsReceipt: {
                  include: {
                    receivedBy: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
        goodsReceipts: {
          include: {
            receivedBy: { select: { id: true, name: true } },
            items: { include: { poItem: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        approvals: {
          include: {
            approver: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!po) {
      res.status(404).json({ success: false, message: 'Purchase order not found.' });
      return;
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'PURCHASE_ORDER', entityId: po.id },
          { entityType: 'DELIVERY', entityId: po.id },
          ...(po.rfqId ? [{ entityType: 'RFQ', entityId: po.rfqId }] : []),
          { entityType: 'PURCHASE_REQUEST', entityId: po.purchaseRequestId },
        ],
      },
      orderBy: { timestamp: 'asc' },
    });

    res.json({
      success: true,
      data: { purchaseOrder: po, auditLogs },
    });
  } catch (error) {
    next(error);
  }
}

export async function createPurchaseOrder(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      purchaseRequestId,
      taxRate = 0,
      deliveryDate,
      paymentTerms,
    } = req.body;

    if (!purchaseRequestId) {
      res.status(400).json({ success: false, message: 'Purchase request ID is required.' });
      return;
    }

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: purchaseRequestId },
      include: {
        vessel: true,
        items: true,
        rfq: {
          include: {
            quotations: {
              where: { status: QuotationStatus.SELECTED },
              include: { vendor: true, items: true },
            },
          },
        },
      },
    });

    if (!pr) {
      res.status(404).json({ success: false, message: 'Purchase request not found.' });
      return;
    }

    if (pr.status !== PrStatus.VENDOR_SELECTED) {
      res.status(400).json({
        success: false,
        message: `A purchase order cannot be created until a vendor is selected. Current PR status: ${pr.status}.`,
      });
      return;
    }

    const selectedQuote = pr.rfq?.quotations[0];
    if (!selectedQuote) {
      res.status(400).json({
        success: false,
        message: 'No selected quotation found for this purchase request.',
      });
      return;
    }

    if (selectedQuote.vendor.status !== 'ACTIVE') {
      res.status(400).json({
        success: false,
        message: `Selected vendor ${selectedQuote.vendor.name} is currently inactive.`,
      });
      return;
    }

    // Guard: Prevent duplicate PO generation for the same quotation or PR
    const existingPo = await prisma.purchaseOrder.findFirst({
      where: {
        OR: [
          { quotationId: selectedQuote.id },
          { purchaseRequestId: pr.id },
        ],
        status: { not: PoStatus.REJECTED },
      },
    });

    if (existingPo) {
      res.status(409).json({
        success: false,
        message: `A purchase order (${existingPo.poNumber}) has already been generated for this quotation / purchase request.`,
      });
      return;
    }

    const lastPo = await prisma.purchaseOrder.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { poNumber: true },
    });
    let nextPoNum = 1001;
    if (lastPo && lastPo.poNumber.startsWith('PO-')) {
      const parsed = parseInt(lastPo.poNumber.replace('PO-', ''), 10);
      if (!isNaN(parsed)) {
        nextPoNum = parsed + 1;
      }
    }
    const poNumber = `PO-${nextPoNum}`;

    const subtotal = Math.round(Number(selectedQuote.totalPrice) * 100) / 100;
    const rate = Number(taxRate) || 0;
    const taxAmount = Math.round(((subtotal * rate) / 100) * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    let expectedDelivery: Date;
    if (deliveryDate) {
      const parsed = new Date(deliveryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (isNaN(parsed.getTime()) || parsed < today) {
        res.status(400).json({
          success: false,
          message: 'Delivery date cannot be in the past.',
        });
        return;
      }
      expectedDelivery = parsed;
    } else {
      expectedDelivery = new Date(Date.now() + (selectedQuote.deliveryDays || 5) * 24 * 60 * 60 * 1000);
    }

    // Calculate PO items directly from the selected vendor's quotation, NOT the PR estimates
    const quoteItems: any[] = (selectedQuote as any).items || [];
    const poItemsData = pr.items.map((prItem) => {
      const matchedQuoteItem = quoteItems.find(
        (qi: any) => qi.purchaseRequestItemId === prItem.id || qi.itemName === prItem.itemName
      );

      let unitPrice: number;
      let lineTotal: number;

      if (matchedQuoteItem) {
        unitPrice = Number(matchedQuoteItem.unitPrice);
        lineTotal = Number(matchedQuoteItem.total);
      } else if (pr.items.length === 1) {
        unitPrice = prItem.quantity > 0 ? (subtotal / prItem.quantity) : 0;
        lineTotal = subtotal;
      } else {
        const prTotal = pr.items.reduce((s, i) => s + Number(i.estimatedTotal), 0);
        const weight = prTotal > 0 ? (Number(prItem.estimatedTotal) / prTotal) : (1 / pr.items.length);
        lineTotal = Math.round(subtotal * weight * 100) / 100;
        unitPrice = prItem.quantity > 0 ? Math.round((lineTotal / prItem.quantity) * 100) / 100 : 0;
      }

      return {
        itemName: prItem.itemName,
        description: prItem.description,
        quantity: prItem.quantity,
        unit: prItem.unit,
        unitPrice: Math.round(unitPrice * 100) / 100,
        total: Math.round(lineTotal * 100) / 100,
        receivedQuantity: 0,
      };
    });

    // Enforce invariant: Sum of line totals must strictly equal PO subtotal
    const sumLineTotals = poItemsData.reduce((s, i) => s + i.total, 0);
    if (poItemsData.length > 0 && Math.abs(sumLineTotals - subtotal) > 0.001) {
      const diff = Math.round((subtotal - sumLineTotals) * 100) / 100;
      const lastIdx = poItemsData.length - 1;
      poItemsData[lastIdx].total = Math.round((poItemsData[lastIdx].total + diff) * 100) / 100;
      poItemsData[lastIdx].unitPrice = poItemsData[lastIdx].quantity > 0
        ? Math.round((poItemsData[lastIdx].total / poItemsData[lastIdx].quantity) * 100) / 100
        : 0;
    }

    const result = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          vendorId: selectedQuote.vendorId,
          vesselId: pr.vesselId,
          purchaseRequestId: pr.id,
          rfqId: pr.rfq?.id,
          quotationId: selectedQuote.id,
          subtotal,
          taxRate: rate,
          taxAmount,
          total,
          deliveryDate: expectedDelivery,
          paymentTerms: paymentTerms?.trim() || selectedQuote.paymentTerms,
          status: PoStatus.PENDING_APPROVAL,
          createdById: req.user!.id,
          items: {
            create: poItemsData,
          },
        },
        include: {
          vendor: true,
          vessel: true,
          items: true,
        },
      });

      await tx.purchaseRequest.update({
        where: { id: pr.id },
        data: { status: PrStatus.PO_CREATED },
      });

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'CREATE_PO',
          entityType: 'PURCHASE_ORDER',
          entityId: po.id,
          description: `Generated Purchase Order ${po.poNumber} for vendor ${selectedQuote.vendor.name} totaling ₹${total.toLocaleString()} (${po.paymentTerms}, delivery by ${expectedDelivery.toISOString().slice(0, 10)}).`,
        },
        tx
      );

      return po;
    });

    res.status(201).json({
      success: true,
      message: `Purchase Order ${result.poNumber} created successfully.`,
      data: { purchaseOrder: result },
    });
  } catch (error) {
    next(error);
  }
}

export async function approvePurchaseOrder(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { comments } = req.body;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { vendor: true, vessel: true },
    });

    if (!po) {
      res.status(404).json({ success: false, message: 'Purchase order not found.' });
      return;
    }

    if (po.status !== PoStatus.PENDING_APPROVAL) {
      res.status(400).json({
        success: false,
        message: `PO must be in PENDING_APPROVAL status. Current status: ${po.status}.`,
      });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.approval.create({
        data: {
          entityType: ApprovalEntityType.PURCHASE_ORDER,
          entityId: po.id,
          purchaseOrderId: po.id,
          approverId: req.user!.id,
          decision: ApprovalDecision.APPROVED,
          comments: comments?.trim() || null,
        },
      });

      const updatedPo = await tx.purchaseOrder.update({
        where: { id },
        data: { status: PoStatus.ORDERED },
        include: { vendor: true, vessel: true, items: true },
      });

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'APPROVE_PO',
          entityType: 'PURCHASE_ORDER',
          entityId: po.id,
          description: `Approved Purchase Order ${po.poNumber} and marked as ORDERED with vendor ${po.vendor.name}.${comments ? ` Comments: "${comments}"` : ''}`,
        },
        tx
      );

      return updatedPo;
    });

    res.json({
      success: true,
      message: `Purchase Order ${po.poNumber} approved and marked as ORDERED.`,
      data: { purchaseOrder: updated },
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectPurchaseOrder(
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
        message: 'A rejection reason is mandatory when rejecting a purchase order.',
      });
      return;
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { vendor: true },
    });

    if (!po) {
      res.status(404).json({ success: false, message: 'Purchase order not found.' });
      return;
    }

    if (po.status !== PoStatus.PENDING_APPROVAL) {
      res.status(400).json({
        success: false,
        message: `Only purchase orders in PENDING_APPROVAL status can be rejected. Current status: ${po.status}.`,
      });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.approval.create({
        data: {
          entityType: ApprovalEntityType.PURCHASE_ORDER,
          entityId: po.id,
          purchaseOrderId: po.id,
          approverId: req.user!.id,
          decision: ApprovalDecision.REJECTED,
          comments: reason.trim(),
        },
      });

      const updatedPo = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: PoStatus.REJECTED,
          rejectionReason: reason.trim(),
        },
      });

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'REJECT_PO',
          entityType: 'PURCHASE_ORDER',
          entityId: po.id,
          description: `Rejected Purchase Order ${po.poNumber}. Reason: ${reason.trim()}`,
        },
        tx
      );

      return updatedPo;
    });

    res.json({
      success: true,
      message: `Purchase Order ${po.poNumber} has been rejected.`,
      data: { purchaseOrder: updated },
    });
  } catch (error) {
    next(error);
  }
}
