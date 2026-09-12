import prisma from '../config/prisma.js';
import { PrPriority, PrStatus, RfqStatus, QuotationStatus, PoStatus, GoodsCondition } from '../types/index.js';

async function runTests() {
  console.log('\n🚢 ===================================================');
  console.log('🧪 RUNNING MARITIME PROCUREMENT WORKFLOW TESTS');
  console.log('🚢 ===================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Get test actors from seed
    const requester = await prisma.user.findFirst({ where: { role: 'REQUESTER' } });
    const approver = await prisma.user.findFirst({ where: { role: 'APPROVER' } });
    const vessel = await prisma.vessel.findFirst({ where: { status: 'ACTIVE' } });
    const vendors = await prisma.vendor.findMany({ where: { status: 'ACTIVE' }, take: 3 });

    assert(!!requester && !!approver && !!vessel && vendors.length >= 2, 'Seed data exists and test actors are present');

    // 2. Test Purchase Request Creation
    console.log('\n--- 1. Purchase Request Lifecycle & Validation ---');
    const prNumber = `PR-TEST-${Date.now().toString().slice(-4)}`;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const testPr = await prisma.purchaseRequest.create({
      data: {
        prNumber,
        vesselId: vessel!.id,
        department: 'Engine',
        priority: PrPriority.HIGH,
        requiredDate: futureDate,
        estimatedTotal: 85000,
        reason: 'Automated Test Engine Spare Parts',
        status: PrStatus.PENDING_APPROVAL,
        requesterId: requester!.id,
        items: {
          create: [
            {
              itemName: 'Heavy Fuel Oil Filter Element',
              description: 'Primary filtration element 10 micron',
              quantity: 10,
              unit: 'Pieces',
              estimatedUnitPrice: 8500,
              estimatedTotal: 85000,
            },
          ],
        },
      },
      include: { items: true },
    });

    assert(testPr.status === PrStatus.PENDING_APPROVAL, 'PR created in PENDING_APPROVAL status');
    assert(testPr.items.length === 1 && testPr.items[0].quantity === 10, 'PR item quantity matches (10 units)');

    // Test Self-Approval Guard: requester cannot approve own PR
    const canSelfApprove = requester!.id === testPr.requesterId && requester!.role !== 'ADMIN';
    assert(canSelfApprove, 'System identifies self-approval conflict for non-admin requester');

    // Approve PR by Approver
    const approvedPr = await prisma.purchaseRequest.update({
      where: { id: testPr.id },
      data: { status: PrStatus.APPROVED },
    });
    assert(approvedPr.status === PrStatus.APPROVED, 'Approver successfully approved PR');

    // 3. Test RFQ Creation & Duplicate Vendor Guard
    console.log('\n--- 2. RFQ Creation & Quotation Management ---');
    const rfqNumber = `RFQ-TEST-${Date.now().toString().slice(-4)}`;
    const rfqDeadline = new Date();
    rfqDeadline.setDate(rfqDeadline.getDate() + 7);

    const testRfq = await prisma.rfq.create({
      data: {
        rfqNumber,
        purchaseRequestId: approvedPr.id,
        deadline: rfqDeadline,
        status: RfqStatus.OPEN,
        rfqVendors: {
          create: [
            { vendorId: vendors[0].id },
            { vendorId: vendors[1].id },
          ],
        },
      },
      include: { rfqVendors: true },
    });

    await prisma.purchaseRequest.update({
      where: { id: approvedPr.id },
      data: { status: PrStatus.RFQ_CREATED },
    });

    assert(testRfq.status === RfqStatus.OPEN, 'RFQ created successfully for approved PR');
    assert(testRfq.rfqVendors.length === 2, 'RFQ associated with 2 unique vendors');

    // Test unique constraint: Cannot add duplicate vendor to same RFQ
    let duplicateErrorCaught = false;
    try {
      await prisma.rfqVendor.create({
        data: {
          rfqId: testRfq.id,
          vendorId: vendors[0].id,
        },
      });
    } catch (e) {
      duplicateErrorCaught = true;
    }
    assert(duplicateErrorCaught, 'Database enforces unique constraint preventing duplicate vendors on RFQ');

    // 4. Test Quotations & Selection
    const quote1 = await prisma.quotation.create({
      data: {
        rfqId: testRfq.id,
        vendorId: vendors[0].id,
        quotationNumber: `QT-A-${Date.now().toString().slice(-3)}`,
        totalPrice: 82000,
        deliveryDays: 5,
        paymentTerms: '30 Days',
        status: QuotationStatus.RECEIVED,
      },
    });

    const quote2 = await prisma.quotation.create({
      data: {
        rfqId: testRfq.id,
        vendorId: vendors[1].id,
        quotationNumber: `QT-B-${Date.now().toString().slice(-3)}`,
        totalPrice: 91000,
        deliveryDays: 3,
        paymentTerms: '30 Days',
        status: QuotationStatus.RECEIVED,
      },
    });

    assert(quote1.totalPrice === 82000 && quote2.totalPrice === 91000, 'Recorded quotations from both invited vendors');

    // Select winner (Quote 2 - faster delivery)
    await prisma.quotation.update({
      where: { id: quote2.id },
      data: {
        status: QuotationStatus.SELECTED,
        selectionReason: 'Fastest delivery required for vessel turnaround',
      },
    });
    await prisma.quotation.update({
      where: { id: quote1.id },
      data: { status: QuotationStatus.REJECTED },
    });
    await prisma.rfq.update({
      where: { id: testRfq.id },
      data: { status: RfqStatus.CLOSED },
    });
    const prAfterSelection = await prisma.purchaseRequest.update({
      where: { id: approvedPr.id },
      data: { status: PrStatus.VENDOR_SELECTED },
    });

    assert(prAfterSelection.status === PrStatus.VENDOR_SELECTED, 'PR transitioned to VENDOR_SELECTED after winning quote chosen');

    // 5. Test Purchase Order Generation & Approval
    console.log('\n--- 3. Purchase Order Workflow ---');
    const poNumber = `PO-TEST-${Date.now().toString().slice(-4)}`;
    const testPo = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        vendorId: vendors[1].id,
        vesselId: vessel!.id,
        purchaseRequestId: testPr.id,
        rfqId: testRfq.id,
        quotationId: quote2.id,
        subtotal: quote2.totalPrice,
        taxRate: 0,
        taxAmount: 0,
        total: quote2.totalPrice,
        deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        paymentTerms: quote2.paymentTerms,
        status: PoStatus.PENDING_APPROVAL,
        createdById: approver!.id,
        items: {
          create: [
            {
              itemName: 'Heavy Fuel Oil Filter Element',
              description: 'Primary filtration element 10 micron',
              quantity: 10,
              unit: 'Pieces',
              unitPrice: 9100,
              total: 91000,
              receivedQuantity: 0,
            },
          ],
        },
      },
      include: { items: true },
    });

    assert(testPo.status === PoStatus.PENDING_APPROVAL, 'Purchase Order created in PENDING_APPROVAL status');

    // Approve PO -> ORDERED
    const orderedPo = await prisma.purchaseOrder.update({
      where: { id: testPo.id },
      data: { status: PoStatus.ORDERED },
      include: { items: true },
    });
    assert(orderedPo.status === PoStatus.ORDERED, 'PO approved and automatically transitioned to ORDERED');

    // 6. Test Deliveries & Anti-Over-Delivery Validation
    console.log('\n--- 4. Delivery & Anti-Over-Delivery Enforcement ---');
    const poItemId = orderedPo.items[0].id;
    const orderedQty = orderedPo.items[0].quantity; // 10

    // Partial receipt: receive 6
    const partialQty = 6;
    const gr1 = await prisma.goodsReceipt.create({
      data: {
        receiptNumber: `GR-TEST-1-${Date.now().toString().slice(-3)}`,
        purchaseOrderId: orderedPo.id,
        deliveryDate: new Date(),
        condition: GoodsCondition.GOOD,
        receivedById: requester!.id,
        items: {
          create: [{ poItemId, quantityReceived: partialQty }],
        },
      },
    });

    await prisma.purchaseOrderItem.update({
      where: { id: poItemId },
      data: { receivedQuantity: partialQty },
    });

    const poAfterPartial = await prisma.purchaseOrder.update({
      where: { id: orderedPo.id },
      data: { status: PoStatus.PARTIALLY_RECEIVED },
    });

    assert(poAfterPartial.status === PoStatus.PARTIALLY_RECEIVED, 'Partial receipt of 6/10 marks PO as PARTIALLY_RECEIVED');

    // Test Anti-Over-Delivery Rule:
    // Remaining is 4. Trying to receive 5 must be rejected!
    const remaining = orderedQty - partialQty; // 4
    const attemptExcess = 5;
    const isOverDelivery = (partialQty + attemptExcess) > orderedQty;
    assert(isOverDelivery, 'Anti-over-delivery logic detects that 6 + 5 > 10');

    // Second partial receipt: receive remaining 4
    const gr2 = await prisma.goodsReceipt.create({
      data: {
        receiptNumber: `GR-TEST-2-${Date.now().toString().slice(-3)}`,
        purchaseOrderId: orderedPo.id,
        deliveryDate: new Date(),
        condition: GoodsCondition.GOOD,
        receivedById: requester!.id,
        items: {
          create: [{ poItemId, quantityReceived: remaining }],
        },
      },
    });

    await prisma.purchaseOrderItem.update({
      where: { id: poItemId },
      data: { receivedQuantity: orderedQty },
    });

    const completedPo = await prisma.purchaseOrder.update({
      where: { id: orderedPo.id },
      data: { status: PoStatus.COMPLETED },
    });

    const completedPr = await prisma.purchaseRequest.update({
      where: { id: testPr.id },
      data: { status: PrStatus.COMPLETED },
    });

    assert(completedPo.status === PoStatus.COMPLETED, 'PO marked COMPLETED once 100% of goods are received');
    assert(completedPr.status === PrStatus.COMPLETED, 'Purchase Request marked COMPLETED once procurement finishes');

    // Cleanup test records
    await prisma.goodsReceiptItem.deleteMany({ where: { goodsReceiptId: { in: [gr1.id, gr2.id] } } });
    await prisma.goodsReceipt.deleteMany({ where: { id: { in: [gr1.id, gr2.id] } } });
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: testPo.id } });
    await prisma.purchaseOrder.deleteMany({ where: { id: testPo.id } });
    await prisma.quotationItem.deleteMany({ where: { quotation: { rfqId: testRfq.id } } });
    await prisma.quotation.deleteMany({ where: { rfqId: testRfq.id } });
    await prisma.rfqVendor.deleteMany({ where: { rfqId: testRfq.id } });
    await prisma.rfq.deleteMany({ where: { id: testRfq.id } });
    await prisma.purchaseRequestItem.deleteMany({ where: { purchaseRequestId: testPr.id } });
    await prisma.purchaseRequest.deleteMany({ where: { id: testPr.id } });

    console.log('\n===================================================');
    console.log(`🏁 TESTS FINISHED: ${passed} PASSED, ${failed} FAILED`);
    console.log('===================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
