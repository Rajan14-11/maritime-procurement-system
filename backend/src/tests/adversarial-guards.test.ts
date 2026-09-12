import http from 'http';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import config from '../config/env.js';
import { createApp } from '../app.js';
import { UserRole, PrStatus, RfqStatus, PoStatus, QuotationStatus } from '../types/index.js';

function generateToken(user: { id: string; email: string; role: string }) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

async function runAdversarialTests() {
  console.log('\n🛡️ ===================================================');
  console.log('🧪 RUNNING ADVERSARIAL & INVARIANT SECURITY TESTS');
  console.log('🛡️ ===================================================\n');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  }

  // Cleanup helper tracking created IDs
  const createdPrIds: string[] = [];
  const createdRfqIds: string[] = [];
  const createdPoIds: string[] = [];
  const createdGrIds: string[] = [];
  let inactiveVendorId: string | null = null;

  try {
    // 0. Load test actors
    const requester = await prisma.user.findFirst({ where: { role: UserRole.REQUESTER } });
    const approver = await prisma.user.findFirst({ where: { role: UserRole.APPROVER } });
    const officer = await prisma.user.findFirst({ where: { role: UserRole.PROCUREMENT_OFFICER } });
    const admin = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
    const vessel = await prisma.vessel.findFirst({ where: { status: 'ACTIVE' } });
    const vendors = await prisma.vendor.findMany({ where: { status: 'ACTIVE' }, take: 3 });

    if (!requester || !approver || !officer || !admin || !vessel || vendors.length < 2) {
      throw new Error('Seed data missing required test actors');
    }

    const requesterToken = generateToken(requester);
    const approverToken = generateToken(approver);
    const officerToken = generateToken(officer);
    const adminToken = generateToken(admin);

    // Create an inactive vendor for negative testing
    const inactiveVendor = await prisma.vendor.create({
      data: {
        vendorCode: `VEN-INACT-${Date.now().toString().slice(-4)}`,
        name: 'Blacklisted Supplies Corp',
        contactPerson: 'Banned Trader',
        email: 'banned@blacklisted.com',
        phone: '+99-0000-0000',
        address: 'Unknown Warehouse',
        categories: 'Substandard Spares',
        status: 'INACTIVE',
      },
    });
    inactiveVendorId = inactiveVendor.id;

    // Helper fetch wrapper
    async function api(
      path: string,
      options: { method?: string; token?: string; body?: any }
    ): Promise<{ status: number; data: any }> {
      const res = await fetch(`${baseUrl}${path}`, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const data: any = await res.json().catch(() => ({}));
      return { status: res.status, data };
    }

    // --- TEST 1: Requester cannot approve own PR (HTTP 403) ---
    console.log('\n--- Category 1: Authorization & Separation of Duties ---');
    const pr1Res = await api('/api/purchase-requests', {
      method: 'POST',
      token: requesterToken,
      body: {
        vesselId: vessel.id,
        department: 'Engine',
        priority: 'HIGH',
        requiredDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        reason: 'PR Self-Approval Prevention Test',
        items: [
          { itemName: 'Impeller Pump Seal', quantity: 5, unit: 'Pieces', estimatedUnitPrice: 1000 },
        ],
        submitImmediately: true,
      },
    });
    const pr1Id = pr1Res.data.data.purchaseRequest.id;
    createdPrIds.push(pr1Id);

    const approveSelfRes = await api(`/api/purchase-requests/${pr1Id}/approve`, {
      method: 'POST',
      token: requesterToken,
      body: { comments: 'Self approval attempt' },
    });
    assert(
      approveSelfRes.status === 403,
      '1. Requester cannot approve own PR (HTTP 403 returned)',
      `Got status ${approveSelfRes.status}: ${approveSelfRes.data.message}`
    );

    // --- TEST 2: Non-approver (Procurement Officer) cannot approve PR (HTTP 403) ---
    const officerApproveRes = await api(`/api/purchase-requests/${pr1Id}/approve`, {
      method: 'POST',
      token: officerToken,
      body: { comments: 'Officer unauthorized approval' },
    });
    assert(
      officerApproveRes.status === 403,
      '2. Procurement Officer cannot approve PR (HTTP 403 returned)',
      `Got status ${officerApproveRes.status}`
    );

    // --- TEST 3: User cannot submit another user\'s draft PR (HTTP 403) ---
    const draftPrRes = await api('/api/purchase-requests', {
      method: 'POST',
      token: requesterToken,
      body: {
        vesselId: vessel.id,
        department: 'Deck',
        priority: 'LOW',
        requiredDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        reason: 'Draft PR Ownership Isolation Test',
        items: [{ itemName: 'Paint Thinner', quantity: 2, estimatedUnitPrice: 500 }],
        submitImmediately: false,
      },
    });
    const draftPrId = draftPrRes.data.data.purchaseRequest.id;
    createdPrIds.push(draftPrId);

    // Officer attempts to submit requester's draft PR
    const otherSubmitRes = await api(`/api/purchase-requests/${draftPrId}/submit`, {
      method: 'POST',
      token: officerToken,
    });
    assert(
      otherSubmitRes.status === 403,
      "3. User cannot submit another user's restricted draft PR (HTTP 403 returned)",
      `Got status ${otherSubmitRes.status}: ${otherSubmitRes.data.message}`
    );

    // --- TEST 4: Cannot create RFQ from non-approved PR (HTTP 400) ---
    console.log('\n--- Category 2: Procurement State Machine Guards ---');
    const invalidRfqRes = await api('/api/rfqs', {
      method: 'POST',
      token: officerToken,
      body: {
        purchaseRequestId: draftPrId, // Still in DRAFT status!
        vendorIds: [vendors[0].id, vendors[1].id],
        deadline: new Date(Date.now() + 5 * 86400000).toISOString(),
      },
    });
    assert(
      invalidRfqRes.status === 400,
      '4. Cannot create RFQ from non-approved (DRAFT/REJECTED) PR (HTTP 400 returned)',
      `Got status ${invalidRfqRes.status}`
    );

    // Now properly approve pr1 by Manager to proceed with RFQ tests
    await api(`/api/purchase-requests/${pr1Id}/approve`, {
      method: 'POST',
      token: approverToken,
      body: { comments: 'Authorized by Manager' },
    });

    // Create RFQ with 2 vendors
    const validRfqRes = await api('/api/rfqs', {
      method: 'POST',
      token: officerToken,
      body: {
        purchaseRequestId: pr1Id,
        vendorIds: [vendors[0].id, vendors[1].id],
        deadline: new Date(Date.now() + 5 * 86400000).toISOString(),
      },
    });
    const rfqId = validRfqRes.data.data.rfq.id;
    createdRfqIds.push(rfqId);

    // Add 2 quotations with DIFFERENT prices than PR estimate (PR estimate: 5 x 1000 = 5,000)
    // Quote A: 5 x 1,200 = 6,000
    // Quote B: 5 x 1,100 = 5,500
    const quoteARes = await api(`/api/rfqs/${rfqId}/quotations`, {
      method: 'POST',
      token: officerToken,
      body: {
        vendorId: vendors[0].id,
        quotationNumber: `QT-ADV-A-${Date.now().toString().slice(-4)}`,
        totalPrice: 6000,
        deliveryDays: 3,
        paymentTerms: '30 Days',
      },
    });
    const quoteAId = quoteARes.data.data.quotation.id;

    const quoteBRes = await api(`/api/rfqs/${rfqId}/quotations`, {
      method: 'POST',
      token: officerToken,
      body: {
        vendorId: vendors[1].id,
        quotationNumber: `QT-ADV-B-${Date.now().toString().slice(-4)}`,
        totalPrice: 5500,
        deliveryDays: 5,
        paymentTerms: '30 Days',
      },
    });
    const quoteBId = quoteBRes.data.data.quotation.id;

    // --- TEST 5: Cannot select inactive vendor (HTTP 400) ---
    // Try to record / select quotation for inactive vendor
    const inactQuoteRes = await api(`/api/rfqs/${rfqId}/quotations`, {
      method: 'POST',
      token: officerToken,
      body: {
        vendorId: inactiveVendorId,
        quotationNumber: 'QT-BAD',
        totalPrice: 1000,
        deliveryDays: 1,
      },
    });
    assert(
      inactQuoteRes.status === 400,
      '5. Cannot record quotation or select inactive vendor (HTTP 400 returned)',
      `Got status ${inactQuoteRes.status}: ${inactQuoteRes.data.message}`
    );

    // Select Quote A as winner
    const selectWinnerRes = await api(`/api/rfqs/${rfqId}/select-quotation`, {
      method: 'POST',
      token: officerToken,
      body: {
        quotationId: quoteAId,
        selectionReason: 'Fastest delivery required',
      },
    });
    assert(selectWinnerRes.status === 200, 'Winning quote selected successfully');

    // --- TEST 6: Cannot select a second winner for an RFQ (HTTP 409 / 400) ---
    const secondWinnerRes = await api(`/api/rfqs/${rfqId}/select-quotation`, {
      method: 'POST',
      token: officerToken,
      body: {
        quotationId: quoteBId,
        selectionReason: 'Attempting duplicate winner',
      },
    });
    assert(
      secondWinnerRes.status === 409 || secondWinnerRes.status === 400,
      '6. Cannot select a second winner for an RFQ (HTTP 409/400 returned)',
      `Got status ${secondWinnerRes.status}: ${secondWinnerRes.data.message}`
    );

    // --- TEST 7: Cannot select quote from closed RFQ ---
    const closedRfqSelectRes = await api(`/api/rfqs/${rfqId}/select-quotation`, {
      method: 'POST',
      token: officerToken,
      body: { quotationId: quoteAId },
    });
    assert(
      closedRfqSelectRes.status === 400 || closedRfqSelectRes.status === 409,
      '7. Cannot select quote from a closed RFQ (HTTP 400/409 returned)',
      `Got status ${closedRfqSelectRes.status}`
    );

    // --- TEST 8: PO values match selected quotation, NOT PR estimated price ---
    console.log('\n--- Category 3: Purchase Order & Line-Item Consistency ---');
    // Generate PO
    const createPoRes = await api('/api/purchase-orders', {
      method: 'POST',
      token: officerToken,
      body: {
        purchaseRequestId: pr1Id,
        taxRate: 10, // 10% tax on 6,000 subtotal = 600 tax -> total = 6,600
      },
    });
    assert(createPoRes.status === 201, 'PO created successfully');
    const createdPo = createPoRes.data.data.purchaseOrder;
    createdPoIds.push(createdPo.id);

    const poLine = createdPo.items[0];
    const expectedQuotedUnitPrice = 1200; // Quote A was 6000 for 5 units = 1200 / unit (PR was 1000)
    const expectedSubtotal = 6000;
    const expectedTax = 600;
    const expectedTotal = 6600;

    assert(
      poLine.unitPrice === expectedQuotedUnitPrice,
      `8a. PO line item displays vendor's quoted unit price (₹${poLine.unitPrice} vs quoted ₹${expectedQuotedUnitPrice}, NOT PR estimate ₹1000)`,
      `Expected ${expectedQuotedUnitPrice}, got ${poLine.unitPrice}`
    );
    assert(
      poLine.total === expectedSubtotal,
      `8b. PO line total equals quantity x quoted unit price (₹${poLine.total})`
    );
    assert(
      createdPo.subtotal === expectedSubtotal,
      `8c. PO subtotal equals sum of line totals (₹${createdPo.subtotal})`
    );
    assert(
      createdPo.total === expectedTotal,
      `8d. PO total equals subtotal + tax (₹${createdPo.total} = ₹${expectedSubtotal} + ₹${expectedTax})`
    );

    // --- TEST 9: Cannot create duplicate PO from the same quotation / PR (HTTP 409) ---
    const dupPoRes = await api('/api/purchase-orders', {
      method: 'POST',
      token: officerToken,
      body: { purchaseRequestId: pr1Id },
    });
    assert(
      dupPoRes.status === 409 || dupPoRes.status === 400,
      '9. Cannot create duplicate PO from the same quotation (HTTP 409/400 returned)',
      `Got status ${dupPoRes.status}: ${dupPoRes.data.message}`
    );

    // --- TEST 10: Requester cannot access restricted audit logs (HTTP 403) ---
    console.log('\n--- Category 4: Audit Trail Security & RBAC ---');
    const auditRes = await api('/api/audit-logs', {
      token: requesterToken,
    });
    assert(
      auditRes.status === 403,
      '10. Requester cannot access restricted audit logs endpoint (HTTP 403 returned)',
      `Got status ${auditRes.status}`
    );

    const adminAuditRes = await api('/api/audit-logs', {
      token: adminToken,
    });
    assert(
      adminAuditRes.status === 200 && Array.isArray(adminAuditRes.data.data.logs),
      '10b. Admin / Manager can access audit logs (HTTP 200 returned)'
    );

    // --- TEST 11: Non-Admin cannot create or update vessels (HTTP 403) ---
    const approverVesselRes = await api('/api/vessels', {
      method: 'POST',
      token: approverToken,
      body: {
        name: 'Unauthorized Vessel',
        imoNumber: 'IMO-0000000',
        type: 'Tanker',
        flag: 'Panama',
      },
    });
    assert(
      approverVesselRes.status === 403,
      '11. Approver cannot create vessels (Admin only, HTTP 403 returned)',
      `Got status ${approverVesselRes.status}`
    );

    // --- TEST 12: Cannot receive goods for unapproved/unordered PO (HTTP 400) ---
    console.log('\n--- Category 5: Delivery & Concurrency Invariants ---');
    const unapprovedDeliveryRes = await api(`/api/deliveries/${createdPo.id}/receipts`, {
      method: 'POST',
      token: officerToken,
      body: {
        items: [{ poItemId: poLine.id, quantityReceived: 2 }],
      },
    });
    assert(
      unapprovedDeliveryRes.status === 400,
      '12. Cannot receive goods for PENDING_APPROVAL / unapproved PO (HTTP 400 returned)',
      `Got status ${unapprovedDeliveryRes.status}: ${unapprovedDeliveryRes.data.message}`
    );

    // Approve PO by Manager -> ORDERED
    await api(`/api/purchase-orders/${createdPo.id}/approve`, {
      method: 'POST',
      token: approverToken,
      body: { comments: 'Approved for delivery' },
    });

    // --- TEST 13: Cannot receive more than ordered quantity (Anti-Over-Delivery) ---
    // Ordered quantity is 5. Attempting to receive 6 must be rejected!
    const overDeliveryRes = await api(`/api/deliveries/${createdPo.id}/receipts`, {
      method: 'POST',
      token: officerToken,
      body: {
        items: [{ poItemId: poLine.id, quantityReceived: 6 }],
      },
    });
    assert(
      overDeliveryRes.status === 400,
      '13. Anti-over-delivery rejects receiving 6 when ordered is 5 (HTTP 400 returned)',
      `Got status ${overDeliveryRes.status}: ${overDeliveryRes.data.message}`
    );

    // Partial delivery: receive 3 of 5
    const partialDeliveryRes = await api(`/api/deliveries/${createdPo.id}/receipts`, {
      method: 'POST',
      token: officerToken,
      body: {
        items: [{ poItemId: poLine.id, quantityReceived: 3 }],
      },
    });
    assert(
      partialDeliveryRes.status === 201 && partialDeliveryRes.data.data.poStatus === 'PARTIALLY_RECEIVED',
      '13b. Partial receipt of 3/5 marks PO as PARTIALLY_RECEIVED'
    );
    if (partialDeliveryRes.data.data.goodsReceipt?.id) {
      createdGrIds.push(partialDeliveryRes.data.data.goodsReceipt.id);
    }

    // Remaining is 2. Attempting to receive 3 more must be rejected!
    const excessRemainingRes = await api(`/api/deliveries/${createdPo.id}/receipts`, {
      method: 'POST',
      token: officerToken,
      body: {
        items: [{ poItemId: poLine.id, quantityReceived: 3 }],
      },
    });
    assert(
      excessRemainingRes.status === 400,
      '13c. Anti-over-delivery rejects 3 units when only 2 remain (HTTP 400 returned)',
      `Got status ${excessRemainingRes.status}: ${excessRemainingRes.data.message}`
    );

    // Complete delivery with remaining 2
    const completeDeliveryRes = await api(`/api/deliveries/${createdPo.id}/receipts`, {
      method: 'POST',
      token: officerToken,
      body: {
        items: [{ poItemId: poLine.id, quantityReceived: 2 }],
      },
    });
    assert(
      completeDeliveryRes.status === 201 && completeDeliveryRes.data.data.completed === true,
      '13d. Receipt of final 2 units marks procurement COMPLETED'
    );
    if (completeDeliveryRes.data.data.goodsReceipt?.id) {
      createdGrIds.push(completeDeliveryRes.data.data.goodsReceipt.id);
    }

    // --- TEST 14: Concurrent Delivery Race Condition Simulation ---
    console.log('\n--- Category 6: Concurrency Stress Simulation ---');
    // Create a new PO for concurrency test: ordered = 10 units
    const pr2Res = await api('/api/purchase-requests', {
      method: 'POST',
      token: requesterToken,
      body: {
        vesselId: vessel.id,
        department: 'Engine',
        priority: 'MEDIUM',
        requiredDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        reason: 'Concurrency Race Condition Test',
        items: [{ itemName: 'Main Engine Fuel Injector Nozzle', quantity: 10, estimatedUnitPrice: 5000 }],
        submitImmediately: true,
      },
    });
    const pr2Id = pr2Res.data.data.purchaseRequest.id;
    createdPrIds.push(pr2Id);

    await api(`/api/purchase-requests/${pr2Id}/approve`, {
      method: 'POST',
      token: approverToken,
    });

    const rfq2Res = await api('/api/rfqs', {
      method: 'POST',
      token: officerToken,
      body: {
        purchaseRequestId: pr2Id,
        vendorIds: [vendors[0].id],
        deadline: new Date(Date.now() + 5 * 86400000).toISOString(),
      },
    });
    const rfq2Id = rfq2Res.data.data.rfq.id;
    createdRfqIds.push(rfq2Id);

    const q2Res = await api(`/api/rfqs/${rfq2Id}/quotations`, {
      method: 'POST',
      token: officerToken,
      body: {
        vendorId: vendors[0].id,
        quotationNumber: `QT-CONC-${Date.now().toString().slice(-4)}`,
        totalPrice: 48000,
        deliveryDays: 2,
      },
    });

    await api(`/api/rfqs/${rfq2Id}/select-quotation`, {
      method: 'POST',
      token: officerToken,
      body: { quotationId: q2Res.data.data.quotation.id },
    });

    const po2Res = await api('/api/purchase-orders', {
      method: 'POST',
      token: officerToken,
      body: { purchaseRequestId: pr2Id },
    });
    const po2 = po2Res.data.data.purchaseOrder;
    createdPoIds.push(po2.id);

    await api(`/api/purchase-orders/${po2.id}/approve`, {
      method: 'POST',
      token: approverToken,
    });

    const po2Item = po2.items[0]; // quantity = 10

    // Fire two simultaneous delivery requests of 6 units each (total 12 > 10)
    // Exactly ONE must succeed (6 units) and ONE must fail (400 Over-delivery)
    const [sim1, sim2] = await Promise.all([
      api(`/api/deliveries/${po2.id}/receipts`, {
        method: 'POST',
        token: officerToken,
        body: { items: [{ poItemId: po2Item.id, quantityReceived: 6 }] },
      }),
      api(`/api/deliveries/${po2.id}/receipts`, {
        method: 'POST',
        token: officerToken,
        body: { items: [{ poItemId: po2Item.id, quantityReceived: 6 }] },
      }),
    ]);

    const hasSuccess = sim1.status === 201 || sim2.status === 201;
    const hasRejection = sim1.status === 400 || sim2.status === 400;
    const oneSuccessOneFail = hasSuccess && hasRejection;
    assert(
      oneSuccessOneFail,
      '14. Concurrent delivery race condition: 2 simultaneous requests for 6/10 items result in 1 success and 1 over-delivery rejection',
      `Statuses: ${sim1.status}, ${sim2.status}`
    );

    const freshPo2Item = await prisma.purchaseOrderItem.findUnique({ where: { id: po2Item.id } });
    assert(
      freshPo2Item?.receivedQuantity === 6,
      '14b. Database state verified: exactly 6 units received in total (zero data corruption or lost updates)'
    );

    if (sim1.data.data?.goodsReceipt?.id) createdGrIds.push(sim1.data.data.goodsReceipt.id);
    if (sim2.data.data?.goodsReceipt?.id) createdGrIds.push(sim2.data.data.goodsReceipt.id);

    // Clean up test records
    if (createdGrIds.length > 0) {
      await prisma.goodsReceiptItem.deleteMany({ where: { goodsReceiptId: { in: createdGrIds } } });
      await prisma.goodsReceipt.deleteMany({ where: { id: { in: createdGrIds } } });
    }
    if (createdPoIds.length > 0) {
      await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: { in: createdPoIds } } });
      await prisma.purchaseOrder.deleteMany({ where: { id: { in: createdPoIds } } });
    }
    if (createdRfqIds.length > 0) {
      await prisma.quotationItem.deleteMany({ where: { quotation: { rfqId: { in: createdRfqIds } } } });
      await prisma.quotation.deleteMany({ where: { rfqId: { in: createdRfqIds } } });
      await prisma.rfqVendor.deleteMany({ where: { rfqId: { in: createdRfqIds } } });
      await prisma.rfq.deleteMany({ where: { id: { in: createdRfqIds } } });
    }
    if (createdPrIds.length > 0) {
      await prisma.approval.deleteMany({ where: { purchaseRequestId: { in: createdPrIds } } });
      await prisma.purchaseRequestItem.deleteMany({ where: { purchaseRequestId: { in: createdPrIds } } });
      await prisma.purchaseRequest.deleteMany({ where: { id: { in: createdPrIds } } });
    }
    if (inactiveVendorId) {
      await prisma.vendor.delete({ where: { id: inactiveVendorId } });
    }

    console.log('\n===================================================');
    console.log(`🏁 ADVERSARIAL TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('===================================================\n');

    server.close();

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error in adversarial test suite:', error);
    server.close();
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAdversarialTests();
