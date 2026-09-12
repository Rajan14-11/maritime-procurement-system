import { Response, NextFunction } from 'express';
import prisma from '../../config/prisma.js';
import {
  AuthenticatedRequest,
  PrStatus,
  RfqStatus,
  QuotationStatus,
  UserRole,
} from '../../types/index.js';
import { logAudit } from '../../utils/audit.js';

export async function listRfqs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { search, status } = req.query;

    const where: any = {};
    if (search) {
      where.OR = [
        { rfqNumber: { contains: String(search) } },
        { purchaseRequest: { prNumber: { contains: String(search) } } },
        { purchaseRequest: { vessel: { name: { contains: String(search) } } } },
      ];
    }
    if (status && Object.values(RfqStatus).includes(status as RfqStatus)) {
      where.status = status as string;
    }

    const rfqs = await prisma.rfq.findMany({
      where,
      include: {
        purchaseRequest: {
          include: {
            vessel: true,
            items: true,
          },
        },
        rfqVendors: {
          include: { vendor: true },
        },
        quotations: {
          include: { vendor: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: { rfqs },
    });
  } catch (error) {
    next(error);
  }
}

export async function getRfqById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;

    const rfq = await prisma.rfq.findUnique({
      where: { id },
      include: {
        purchaseRequest: {
          include: {
            vessel: true,
            requester: { select: { id: true, name: true, email: true } },
            items: true,
          },
        },
        rfqVendors: {
          include: { vendor: true },
        },
        quotations: {
          include: { vendor: true },
          orderBy: { totalPrice: 'asc' },
        },
      },
    });

    if (!rfq) {
      res.status(404).json({ success: false, message: 'RFQ not found.' });
      return;
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'RFQ', entityId: rfq.id },
          { entityType: 'PURCHASE_REQUEST', entityId: rfq.purchaseRequestId },
        ],
      },
      orderBy: { timestamp: 'asc' },
    });

    res.json({
      success: true,
      data: { rfq, auditLogs },
    });
  } catch (error) {
    next(error);
  }
}

export async function createRfq(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { purchaseRequestId, vendorIds, deadline } = req.body;

    if (!purchaseRequestId) {
      res.status(400).json({ success: false, message: 'Purchase request ID is required.' });
      return;
    }

    if (!deadline) {
      res.status(400).json({ success: false, message: 'Quotation deadline is required.' });
      return;
    }

    const deadlineDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (deadlineDate < today) {
      res.status(400).json({
        success: false,
        message: 'Quotation deadline cannot be in the past.',
      });
      return;
    }

    if (!vendorIds || !Array.isArray(vendorIds) || vendorIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'At least one active vendor must be selected.',
      });
      return;
    }

    const uniqueVendorIds = [...new Set(vendorIds)] as string[];
    if (uniqueVendorIds.length !== vendorIds.length) {
      res.status(400).json({
        success: false,
        message: 'Duplicate vendors detected. Each vendor can only be added once.',
      });
      return;
    }

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: purchaseRequestId },
      include: { rfq: true, vessel: true },
    });

    if (!pr) {
      res.status(404).json({ success: false, message: 'Purchase request not found.' });
      return;
    }

    if (pr.status !== PrStatus.APPROVED) {
      res.status(400).json({
        success: false,
        message: `Purchase request must be APPROVED before creating an RFQ. Current status: ${pr.status}.`,
      });
      return;
    }

    if (pr.rfq) {
      res.status(400).json({
        success: false,
        message: `An RFQ (${pr.rfq.rfqNumber}) has already been created for this purchase request.`,
      });
      return;
    }

    const vendors = await prisma.vendor.findMany({
      where: { id: { in: uniqueVendorIds } },
    });

    if (vendors.length !== uniqueVendorIds.length) {
      res.status(400).json({
        success: false,
        message: 'One or more selected vendors could not be found.',
      });
      return;
    }

    const inactiveVendor = vendors.find((v) => v.status !== 'ACTIVE');
    if (inactiveVendor) {
      res.status(400).json({
        success: false,
        message: `Vendor "${inactiveVendor.name}" is inactive and cannot be included in an RFQ.`,
      });
      return;
    }

    const count = await prisma.rfq.count();
    const rfqNumber = `RFQ-${1001 + count}`;

    const result = await prisma.$transaction(async (tx) => {
      const rfq = await tx.rfq.create({
        data: {
          rfqNumber,
          purchaseRequestId: pr.id,
          deadline: deadlineDate,
          status: RfqStatus.OPEN as string,
          rfqVendors: {
            create: uniqueVendorIds.map((vId) => ({ vendorId: vId })),
          },
        },
        include: {
          rfqVendors: { include: { vendor: true } },
          purchaseRequest: true,
        },
      });

      await tx.purchaseRequest.update({
        where: { id: pr.id },
        data: { status: PrStatus.RFQ_CREATED as string },
      });

      const vendorNames = vendors.map((v) => v.name).join(', ');
      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'CREATE_RFQ',
          entityType: 'RFQ',
          entityId: rfq.id,
          description: `Created ${rfq.rfqNumber} for ${pr.prNumber} (${pr.vessel.name}) with ${vendors.length} vendor(s): ${vendorNames}. Deadline: ${deadlineDate.toISOString().slice(0, 10)}.`,
        },
        tx
      );

      return rfq;
    });

    res.status(201).json({
      success: true,
      message: `RFQ ${result.rfqNumber} created successfully.`,
      data: { rfq: result },
    });
  } catch (error) {
    next(error);
  }
}

export async function addQuotation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const {
      vendorId,
      quotationNumber,
      quotationDate,
      totalPrice,
      deliveryDays,
      paymentTerms,
      notes,
    } = req.body;

    if (!vendorId) {
      res.status(400).json({ success: false, message: 'Vendor ID is required.' });
      return;
    }
    if (!quotationNumber || !quotationNumber.trim()) {
      res.status(400).json({ success: false, message: 'Quotation number is required.' });
      return;
    }
    const price = Number(totalPrice);
    if (isNaN(price) || price <= 0) {
      res.status(400).json({ success: false, message: 'Total price must be greater than zero.' });
      return;
    }
    const days = Number(deliveryDays);
    if (isNaN(days) || days < 0) {
      res.status(400).json({ success: false, message: 'Delivery days cannot be negative.' });
      return;
    }

    const rfq = await prisma.rfq.findUnique({
      where: { id },
      include: {
        rfqVendors: true,
        purchaseRequest: {
          include: { items: true },
        },
      },
    });

    if (!rfq) {
      res.status(404).json({ success: false, message: 'RFQ not found.' });
      return;
    }

    if (rfq.status !== RfqStatus.OPEN) {
      res.status(400).json({
        success: false,
        message: `Quotations cannot be added to an RFQ with status ${rfq.status}.`,
      });
      return;
    }

    const isInvited = rfq.rfqVendors.some((rv: any) => rv.vendorId === vendorId);
    if (!isInvited) {
      res.status(400).json({
        success: false,
        message: 'This vendor was not invited to this RFQ.',
      });
      return;
    }

    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor || vendor.status !== 'ACTIVE') {
      res.status(400).json({
        success: false,
        message: 'Quotation cannot be recorded for an inactive vendor.',
      });
      return;
    }

    const existing = await prisma.quotation.findUnique({
      where: {
        rfqId_vendorId: {
          rfqId: rfq.id,
          vendorId,
        },
      },
    });

    if (existing) {
      res.status(400).json({
        success: false,
        message: `A quotation from ${vendor.name} has already been recorded for this RFQ.`,
      });
      return;
    }

    const quotation = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.create({
        data: {
          rfqId: rfq.id,
          vendorId,
          quotationNumber: quotationNumber.trim(),
          quotationDate: quotationDate ? new Date(quotationDate) : new Date(),
          totalPrice: price,
          deliveryDays: days,
          paymentTerms: paymentTerms?.trim() || vendor.paymentTerms,
          notes: notes?.trim() || null,
          status: QuotationStatus.RECEIVED as string,
        },
        include: { vendor: true },
      });

      // Populate quotation items:
      const prItems = rfq.purchaseRequest.items || [];
      if (Array.isArray(req.body.items) && req.body.items.length > 0) {
        for (const itm of req.body.items) {
          await tx.quotationItem.create({
            data: {
              quotationId: q.id,
              purchaseRequestItemId: itm.purchaseRequestItemId || itm.prItemId || null,
              itemName: itm.itemName,
              description: itm.description || null,
              quantity: Number(itm.quantity),
              unit: itm.unit || 'Pieces',
              unitPrice: Math.round(Number(itm.unitPrice) * 100) / 100,
              total: Math.round(Number(itm.total) * 100) / 100,
            },
          });
        }
      } else if (prItems.length === 1) {
        const prItem = prItems[0];
        const unitPrice = prItem.quantity > 0 ? Math.round((price / prItem.quantity) * 100) / 100 : 0;
        await tx.quotationItem.create({
          data: {
            quotationId: q.id,
            purchaseRequestItemId: prItem.id,
            itemName: prItem.itemName,
            description: prItem.description,
            quantity: prItem.quantity,
            unit: prItem.unit,
            unitPrice,
            total: price,
          },
        });
      } else if (prItems.length > 1) {
        const prTotal = prItems.reduce((s, i) => s + i.estimatedTotal, 0);
        let allocatedSum = 0;
        for (let idx = 0; idx < prItems.length; idx++) {
          const prItem = prItems[idx];
          const isLast = idx === prItems.length - 1;
          const weight = prTotal > 0 ? (prItem.estimatedTotal / prTotal) : (1 / prItems.length);
          const lineTotal = isLast
            ? Math.round((price - allocatedSum) * 100) / 100
            : Math.round(price * weight * 100) / 100;
          allocatedSum += lineTotal;
          const unitPrice = prItem.quantity > 0 ? Math.round((lineTotal / prItem.quantity) * 100) / 100 : 0;
          await tx.quotationItem.create({
            data: {
              quotationId: q.id,
              purchaseRequestItemId: prItem.id,
              itemName: prItem.itemName,
              description: prItem.description,
              quantity: prItem.quantity,
              unit: prItem.unit,
              unitPrice,
              total: lineTotal,
            },
          });
        }
      }

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'ADD_QUOTATION',
          entityType: 'RFQ',
          entityId: rfq.id,
          description: `Received quotation ${q.quotationNumber} from ${vendor.name} for ₹${price.toLocaleString()} (${days} days delivery, ${q.paymentTerms}).`,
        },
        tx
      );

      return q;
    });

    const refreshed = await prisma.quotation.findUnique({
      where: { id: quotation.id },
      include: { vendor: true, items: true },
    });

    res.status(201).json({
      success: true,
      message: `Quotation from ${vendor.name} recorded successfully.`,
      data: { quotation: refreshed || quotation },
    });
  } catch (error) {
    next(error);
  }
}

export async function selectQuotation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { quotationId, selectionReason } = req.body;

    if (!quotationId) {
      res.status(400).json({ success: false, message: 'Quotation ID is required.' });
      return;
    }

    const rfq = await prisma.rfq.findUnique({
      where: { id },
      include: {
        purchaseRequest: true,
        quotations: { include: { vendor: true, items: true } },
      },
    });

    if (!rfq) {
      res.status(404).json({ success: false, message: 'RFQ not found.' });
      return;
    }

    if (rfq.status !== RfqStatus.OPEN) {
      res.status(400).json({
        success: false,
        message: `Cannot select a quotation from an RFQ with status ${rfq.status}. RFQ must be OPEN.`,
      });
      return;
    }

    const alreadySelected = rfq.quotations.some((q: any) => q.status === QuotationStatus.SELECTED);
    if (alreadySelected) {
      res.status(409).json({
        success: false,
        message: 'A winning quotation has already been selected for this RFQ.',
      });
      return;
    }

    if (rfq.purchaseRequest.status !== PrStatus.RFQ_CREATED) {
      res.status(400).json({
        success: false,
        message: `Purchase request is not in a valid state for vendor selection. Current PR status: ${rfq.purchaseRequest.status}.`,
      });
      return;
    }

    const targetQuote = rfq.quotations.find((q: any) => q.id === quotationId);
    if (!targetQuote) {
      res.status(400).json({
        success: false,
        message: 'Selected quotation does not belong to this RFQ.',
      });
      return;
    }

    if (targetQuote.vendor.status !== 'ACTIVE') {
      res.status(400).json({
        success: false,
        message: 'Cannot select a quotation from an inactive vendor.',
      });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const selectedQuote = await tx.quotation.update({
        where: { id: quotationId },
        data: {
          status: QuotationStatus.SELECTED as string,
          selectionReason: selectionReason?.trim() || null,
        },
        include: { vendor: true, items: true },
      });

      await tx.quotation.updateMany({
        where: {
          rfqId: rfq.id,
          id: { not: quotationId },
        },
        data: { status: QuotationStatus.REJECTED as string },
      });

      await tx.rfq.update({
        where: { id: rfq.id },
        data: { status: RfqStatus.CLOSED as string },
      });

      await tx.purchaseRequest.update({
        where: { id: rfq.purchaseRequestId },
        data: { status: PrStatus.VENDOR_SELECTED as string },
      });

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'SELECT_VENDOR',
          entityType: 'RFQ',
          entityId: rfq.id,
          description: `Selected ${selectedQuote.vendor.name} (${selectedQuote.quotationNumber}, ₹${selectedQuote.totalPrice.toLocaleString()}) for RFQ ${rfq.rfqNumber}.${selectionReason ? ` Reason: ${selectionReason.trim()}` : ''}`,
        },
        tx
      );

      return selectedQuote;
    });

    res.json({
      success: true,
      message: `Vendor ${result.vendor.name} has been selected successfully.`,
      data: { selectedQuotation: result },
    });
  } catch (error) {
    next(error);
  }
}
