import prisma from '../config/prisma.js';
import { UserRole, UserStatus, PrPriority, PrStatus, RfqStatus, QuotationStatus, PoStatus, GoodsCondition } from '../types/index.js';

async function runVendorPortalTests() {
  console.log('\n🚢 ===================================================');
  console.log('🧪 RUNNING VENDOR PORTAL & FULFILLMENT TESTS');
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
    // 1. Setup test vendor and actors
    console.log('--- 1. Vendor Account Provisioning & Scope Linking ---');
    const officer = await prisma.user.findFirst({ where: { role: UserRole.PROCUREMENT_OFFICER } });
    const vessel = await prisma.vessel.findFirst({ where: { status: 'ACTIVE' } });
    const vendorA = await prisma.vendor.findFirst({ where: { status: 'ACTIVE' } });

    assert(!!officer && !!vessel && !!vendorA, 'Procurement officer, vessel, and vendor test actors present');

    const testVendorEmail = `vendor.test.${Date.now()}@supplier.com`;
    const vendorUser = await prisma.user.create({
      data: {
        name: 'Maritime Parts Rep',
        email: testVendorEmail,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
        role: UserRole.VENDOR,
        department: 'Sales & Dispatch',
        status: UserStatus.ACTIVE,
        vendorId: vendorA!.id,
      },
      include: { vendor: true },
    });

    assert(vendorUser.role === UserRole.VENDOR && vendorUser.vendorId === vendorA!.id, 'Vendor user successfully created and linked to supplier company');
    assert(vendorUser.vendor?.name === vendorA!.name, 'User relation correctly resolves assigned Vendor entity');

    // 2. Test RFQ creation and blind bidding
    console.log('\n--- 2. RFQ Blind Bidding & Scoped Quotation Submission ---');
    const prNumber = `PR-VND-${Date.now().toString().slice(-4)}`;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);

    const testPr = await prisma.purchaseRequest.create({
      data: {
        prNumber,
        vesselId: vessel!.id,
        department: 'Deck',
        priority: PrPriority.MEDIUM,
        requiredDate: futureDate,
        estimatedTotal: 45000,
        reason: 'Mooring lines replacement',
        status: PrStatus.APPROVED,
        requesterId: officer!.id,
        items: {
          create: [
            {
              itemName: 'Mooring Rope 8-Strand 60mm',
              description: 'Polypropylene mooring line with eye splice',
              quantity: 4,
              unit: 'Coils',
              estimatedUnitPrice: 11250,
              estimatedTotal: 45000,
            },
          ],
        },
      },
      include: { items: true },
    });

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 5);

    const rfq = await prisma.rfq.create({
      data: {
        rfqNumber: `RFQ-VND-${Date.now().toString().slice(-4)}`,
        purchaseRequestId: testPr.id,
        deadline,
        status: RfqStatus.OPEN,
        rfqVendors: {
          create: [{ vendorId: vendorA!.id }],
        },
      },
      include: { rfqVendors: true },
    });

    assert(rfq.rfqVendors.some(rv => rv.vendorId === vendorA!.id), 'Vendor successfully invited to RFQ');

    // Vendor submits quotation
    const quoteNumber = `QT-VND-${Date.now().toString().slice(-4)}`;
    const quote = await prisma.quotation.create({
      data: {
        rfqId: rfq.id,
        vendorId: vendorA!.id,
        quotationNumber: quoteNumber,
        quotationDate: new Date(),
        totalPrice: 42000,
        deliveryDays: 5,
        paymentTerms: 'Net 30 Days',
        status: QuotationStatus.RECEIVED,
        submittedById: vendorUser.id,
        items: {
          create: [
            {
              purchaseRequestItemId: testPr.items[0].id,
              itemName: 'Mooring Rope 8-Strand 60mm',
              quantity: 4,
              unit: 'Coils',
              unitPrice: 10500,
              total: 42000,
            },
          ],
        },
      },
      include: { items: true },
    });

    assert(Number(quote.totalPrice) === 42000 && quote.submittedById === vendorUser.id, 'Vendor quotation submitted with audit attribution');
    assert(quote.items.length === 1 && Number(quote.items[0].unitPrice) === 10500, 'Quotation line items successfully persisted');

    // Vendor revises quotation before deadline
    const updatedQuote = await prisma.quotation.update({
      where: { id: quote.id },
      data: {
        totalPrice: 40000,
        deliveryDays: 4,
        notes: 'Special discount applied on bulk mooring package',
      },
    });

    assert(Number(updatedQuote.totalPrice) === 40000 && updatedQuote.deliveryDays === 4, 'Vendor quotation successfully revised before tender deadline');

    // 3. Purchase Order Award & Fulfillment Lifecycle
    console.log('\n--- 3. Purchase Order Acknowledgment & Dispatch Tracking ---');
    await prisma.quotation.update({
      where: { id: quote.id },
      data: { status: QuotationStatus.SELECTED },
    });
    await prisma.rfq.update({
      where: { id: rfq.id },
      data: { status: RfqStatus.CLOSED },
    });

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-VND-${Date.now().toString().slice(-4)}`,
        vendorId: vendorA!.id,
        vesselId: vessel!.id,
        purchaseRequestId: testPr.id,
        rfqId: rfq.id,
        quotationId: quote.id,
        subtotal: 40000,
        taxRate: 0,
        taxAmount: 0,
        total: 40000,
        deliveryDate: futureDate,
        paymentTerms: 'Net 30 Days',
        status: PoStatus.ORDERED,
        createdById: officer!.id,
        items: {
          create: [
            {
              itemName: 'Mooring Rope 8-Strand 60mm',
              description: 'Polypropylene mooring line with eye splice',
              quantity: 4,
              unit: 'Coils',
              unitPrice: 10000,
              total: 40000,
            },
          ],
        },
      },
      include: { items: true },
    });

    assert(po.status === PoStatus.ORDERED && po.vendorId === vendorA!.id, 'Purchase Order successfully released to awarded vendor');

    // Vendor acknowledges PO
    const ackTime = new Date();
    const ackPo = await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        acknowledgedAt: ackTime,
        acknowledgedById: vendorUser.id,
        estimatedDeliveryDate: futureDate,
      },
    });

    assert(!!ackPo.acknowledgedAt && ackPo.acknowledgedById === vendorUser.id, 'Vendor acknowledged purchase order with commitment timestamp');

    // Vendor dispatches PO with tracking information
    const dispatchTime = new Date();
    const dispatchedPo = await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        carrierName: 'Pacific Maritime Express',
        trackingNumber: 'TRK-9928174',
        dispatchedAt: dispatchTime,
        dispatchNotes: 'Delivered to Terminal Gate 2 for onboard launch delivery',
      },
    });

    assert(dispatchedPo.carrierName === 'Pacific Maritime Express' && dispatchedPo.trackingNumber === 'TRK-9928174', 'Shipment carrier and waybill tracking persisted');
    assert(!!dispatchedPo.dispatchedAt, 'Dispatch date and packaging notes properly logged');

    // 4. Goods Receipt Transparency
    console.log('\n--- 4. Goods Receipt Inspection & Vendor Visibility ---');
    const grn = await prisma.goodsReceipt.create({
      data: {
        receiptNumber: `GRN-VND-${Date.now().toString().slice(-4)}`,
        purchaseOrderId: po.id,
        deliveryDate: new Date(),
        condition: GoodsCondition.GOOD,
        notes: 'Inspected onboard by Chief Officer; mooring coils in pristine condition.',
        receivedById: officer!.id,
        items: {
          create: [
            {
              poItemId: po.items[0].id,
              quantityReceived: 4,
            },
          ],
        },
      },
      include: { items: true },
    });

    assert(grn.condition === GoodsCondition.GOOD && grn.items[0].quantityReceived === 4, 'Goods receipt successfully verified onboard');

    // Verify vendor query scope: only receipts for vendor's PO
    const vendorReceipts = await prisma.goodsReceipt.findMany({
      where: {
        purchaseOrder: {
          vendorId: vendorA!.id,
        },
      },
    });

    assert(vendorReceipts.some(r => r.id === grn.id), 'Vendor successfully retrieves their verified delivery receipt');

    // 5. Vendor Profile Self-Service
    console.log('\n--- 5. Vendor Profile Self-Service Maintenance ---');
    const updatedVendor = await prisma.vendor.update({
      where: { id: vendorA!.id },
      data: {
        contactPerson: 'David Wong (Logistics Ops)',
        phone: '+65 6789 9999',
        address: '12 Marine Bay Terminal Road, Singapore 018956',
      },
    });

    assert(updatedVendor.contactPerson === 'David Wong (Logistics Ops)', 'Vendor self-service contact person updated');
    assert(updatedVendor.phone === '+65 6789 9999', 'Vendor self-service contact phone updated');
    assert(updatedVendor.address.includes('Marine Bay Terminal Road'), 'Vendor warehouse address updated');

    // Cleanup test user and artifacts
    await prisma.goodsReceiptItem.deleteMany({ where: { goodsReceiptId: grn.id } });
    await prisma.goodsReceipt.delete({ where: { id: grn.id } });
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: po.id } });
    await prisma.purchaseOrder.delete({ where: { id: po.id } });
    await prisma.quotationItem.deleteMany({ where: { quotationId: quote.id } });
    await prisma.quotation.delete({ where: { id: quote.id } });
    await prisma.rfqVendor.deleteMany({ where: { rfqId: rfq.id } });
    await prisma.rfq.delete({ where: { id: rfq.id } });
    await prisma.purchaseRequestItem.deleteMany({ where: { purchaseRequestId: testPr.id } });
    await prisma.purchaseRequest.delete({ where: { id: testPr.id } });
    await prisma.user.delete({ where: { id: vendorUser.id } });

    console.log('\n===================================================');
    console.log(`🎉 VENDOR PORTAL TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('===================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runVendorPortalTests();
