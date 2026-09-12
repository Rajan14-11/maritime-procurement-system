import { Response, NextFunction } from 'express';
import prisma from '../../config/prisma.js';
import {
  AuthenticatedRequest,
  PoStatus,
  PrStatus,
  GoodsCondition,
  UserRole,
} from '../../types/index.js';
import { logAudit } from '../../utils/audit.js';

export async function listDeliveries(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { search, condition, vesselId } = req.query;

    const where: any = {};
    if (search) {
      where.OR = [
        { receiptNumber: { contains: String(search) } },
        { purchaseOrder: { poNumber: { contains: String(search) } } },
        { purchaseOrder: { vendor: { name: { contains: String(search) } } } },
        { purchaseOrder: { vessel: { name: { contains: String(search) } } } },
      ];
    }
    if (condition && Object.values(GoodsCondition).includes(condition as GoodsCondition)) {
      where.condition = condition as string;
    }
    if (vesselId) {
      where.purchaseOrder = { vesselId: String(vesselId) };
    }

    const receipts = await prisma.goodsReceipt.findMany({
      where,
      include: {
        purchaseOrder: {
          include: {
            vendor: true,
            vessel: true,
            purchaseRequest: true,
          },
        },
        receivedBy: {
          select: { id: true, name: true, email: true },
        },
        items: {
          include: { poItem: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: { receipts },
    });
  } catch (error) {
    next(error);
  }
}

export async function recordGoodsReceipt(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { deliveryDate, condition = GoodsCondition.GOOD, notes, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'At least one item must be included in the goods receipt.',
      });
      return;
    }

    for (const itemInput of items) {
      const qty = Number(itemInput.quantityReceived);
      if (isNaN(qty) || qty <= 0) {
        res.status(400).json({
          success: false,
          message: 'Received quantity must be greater than zero for all items.',
        });
        return;
      }
    }

    const count = await prisma.goodsReceipt.count();
    const entropy = Math.floor(100 + Math.random() * 900);
    const receiptNumber = `GR-${1001 + count}-${entropy}`;
    const receiptDate = deliveryDate ? new Date(deliveryDate) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      // Concurrency & Race Protection: Pessimistic row-level lock on the PO row in PostgreSQL
      try {
        await tx.$queryRawUnsafe(`SELECT id FROM purchase_orders WHERE id = $1 FOR UPDATE`, id);
      } catch {
        // Safe fallback for engines without FOR UPDATE support
      }

      // Fetch PO and its line items inside the serialized transaction
      const po = await tx.purchaseOrder.findUnique({
        where: { id },
        include: {
          items: true,
          vendor: true,
          vessel: true,
          purchaseRequest: true,
        },
      });

      if (!po) {
        const err: any = new Error('Purchase order not found.');
        err.statusCode = 404;
        throw err;
      }

      if (po.status !== PoStatus.ORDERED && po.status !== PoStatus.PARTIALLY_RECEIVED) {
        const err: any = new Error(
          `Goods receipt can only be recorded for an ORDERED or PARTIALLY_RECEIVED PO. Current status: ${po.status}.`
        );
        err.statusCode = 400;
        throw err;
      }

      const validatedReceiptItems: { poItemId: string; quantityReceived: number }[] = [];

      for (const itemInput of items) {
        const { poItemId, quantityReceived } = itemInput;
        const poItem = po.items.find((i: any) => i.id === poItemId);

        if (!poItem) {
          const err: any = new Error(
            `PO Item ${poItemId} does not exist in Purchase Order ${po.poNumber}.`
          );
          err.statusCode = 400;
          throw err;
        }

        const qty = Number(quantityReceived);
        const newTotalReceived = poItem.receivedQuantity + qty;

        if (newTotalReceived > poItem.quantity) {
          const err: any = new Error(
            `Over-delivery not allowed: Attempting to receive ${qty} unit(s) for "${poItem.itemName}", but only ${poItem.quantity - poItem.receivedQuantity} unit(s) remaining (Ordered: ${poItem.quantity}, Already Received: ${poItem.receivedQuantity}).`
          );
          err.statusCode = 400;
          throw err;
        }

        validatedReceiptItems.push({
          poItemId,
          quantityReceived: qty,
        });
      }

      const gr = await tx.goodsReceipt.create({
        data: {
          receiptNumber,
          purchaseOrderId: po.id,
          deliveryDate: receiptDate,
          condition: (condition as GoodsCondition) || GoodsCondition.GOOD,
          notes: notes?.trim() || null,
          receivedById: req.user!.id,
          items: {
            create: validatedReceiptItems.map((v) => ({
              poItemId: v.poItemId,
              quantityReceived: v.quantityReceived,
            })),
          },
        },
        include: {
          items: { include: { poItem: true } },
          receivedBy: { select: { id: true, name: true } },
        },
      });

      for (const v of validatedReceiptItems) {
        await tx.purchaseOrderItem.update({
          where: { id: v.poItemId },
          data: { receivedQuantity: { increment: v.quantityReceived } },
        });
      }

      const allPoItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: po.id },
      });

      const isFullyReceived = allPoItems.every(
        (item: any) => item.receivedQuantity >= item.quantity
      );

      const newPoStatus = isFullyReceived
        ? PoStatus.RECEIVED
        : PoStatus.PARTIALLY_RECEIVED;

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: newPoStatus },
      });

      if (isFullyReceived) {
        await tx.purchaseRequest.update({
          where: { id: po.purchaseRequestId },
          data: { status: PrStatus.COMPLETED },
        });

        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: { status: PoStatus.COMPLETED },
        });
      }

      const totalQtyReceived = validatedReceiptItems.reduce(
        (sum, item) => sum + item.quantityReceived,
        0
      );
      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'RECORD_GOODS_RECEIPT',
          entityType: 'DELIVERY',
          entityId: gr.id,
          description: `Recorded goods receipt ${gr.receiptNumber} for ${po.poNumber} (${totalQtyReceived} items, condition: ${gr.condition}). PO Status: ${newPoStatus}${isFullyReceived ? ' -> Procurement COMPLETED' : ''}.`,
        },
        tx
      );

      if (isFullyReceived) {
        await logAudit(
          {
            userId: req.user!.id,
            userName: req.user!.name,
            userRole: req.user!.role,
            action: 'COMPLETE_PROCUREMENT',
            entityType: 'PURCHASE_REQUEST',
            entityId: po.purchaseRequestId,
            description: `Procurement lifecycle completed for ${po.purchaseRequest.prNumber} (Vessel: ${po.vessel.name}). All goods received in full.`,
          },
          tx
        );
      }

      return { gr, newPoStatus, isFullyReceived };
    });

    res.status(201).json({
      success: true,
      message: `Goods receipt ${result.gr.receiptNumber} recorded successfully. PO status updated to ${result.newPoStatus}.`,
      data: {
        goodsReceipt: result.gr,
        poStatus: result.newPoStatus,
        completed: result.isFullyReceived,
      },
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}
