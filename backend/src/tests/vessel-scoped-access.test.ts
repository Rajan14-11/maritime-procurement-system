import http from 'http';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import config from '../config/env.js';
import { createApp } from '../app.js';
import { UserRole, PrStatus, PrPriority } from '../types/index.js';

function generateToken(user: { id: string; email: string; role: string }) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

async function runVesselScopedAccessTests() {
  console.log('\n🚢 ===================================================');
  console.log('🧪 RUNNING VESSEL-SCOPED REQUESTER ACCESS TEST SUITE');
  console.log('🚢 ===================================================\n');

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

  const createdPrIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdVesselIds: string[] = [];

  try {
    // 0. Load test actors and vessels
    const requester1 = await prisma.user.findFirst({
      where: { email: 'chief.engineer@demo.com' },
      include: { vessel: true },
    });
    const requester2 = await prisma.user.findFirst({
      where: { email: 'engineer.neptune@demo.com' },
      include: { vessel: true },
    });
    const officer = await prisma.user.findFirst({ where: { role: UserRole.PROCUREMENT_OFFICER } });
    const admin = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
    const oceanStar = await prisma.vessel.findFirst({ where: { name: { contains: 'Ocean Star' } } });
    const neptune = await prisma.vessel.findFirst({ where: { name: { contains: 'Neptune' } } });

    if (!requester1 || !requester2 || !officer || !admin || !oceanStar || !neptune) {
      throw new Error('Seed data missing required test actors (Chief Engineer, 2nd Engineer, Officer, Admin, or Vessels)');
    }

    const requester1Token = generateToken(requester1);
    const requester2Token = generateToken(requester2);
    const officerToken = generateToken(officer);
    const adminToken = generateToken(admin);

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

    // =========================================================================
    // TEST 1: Requester Vessel Scoping (Vessel List)
    // Requester only sees their assigned vessel on GET /api/vessels
    // =========================================================================
    console.log('--- Test 1: Requester Vessel List Scoping ---');
    const req1VesselsRes = await api('/api/vessels', {
      method: 'GET',
      token: requester1Token,
    });

    assert(
      req1VesselsRes.status === 200 &&
        Array.isArray(req1VesselsRes.data.data?.vessels) &&
        req1VesselsRes.data.data.vessels.length === 1 &&
        req1VesselsRes.data.data.vessels[0].id === requester1.vesselId,
      '1. Requester only sees their assigned vessel in GET /api/vessels',
      `Returned count: ${req1VesselsRes.data.data?.vessels?.length}, vessel: ${req1VesselsRes.data.data?.vessels?.[0]?.name}`
    );

    // =========================================================================
    // TEST 2: Requester Direct Access to Foreign Vessel Forbidden
    // Requester gets 403 Forbidden when accessing unassigned vessel by ID
    // =========================================================================
    console.log('\n--- Test 2: Foreign Vessel Access Blocked (HTTP 403) ---');
    const foreignVesselRes = await api(`/api/vessels/${neptune.id}`, {
      method: 'GET',
      token: requester1Token,
    });

    assert(
      foreignVesselRes.status === 403,
      '2. Requester receives 403 Forbidden when accessing unassigned vessel by ID',
      `Got status ${foreignVesselRes.status}: ${foreignVesselRes.data.message}`
    );

    // Also verify requester CAN access their own assigned vessel by ID
    const ownVesselRes = await api(`/api/vessels/${oceanStar.id}`, {
      method: 'GET',
      token: requester1Token,
    });
    assert(
      ownVesselRes.status === 200 && ownVesselRes.data.data?.vessel?.id === oceanStar.id,
      '2b. Requester successfully accesses own assigned vessel by ID (HTTP 200)',
      `Got status ${ownVesselRes.status}`
    );

    // =========================================================================
    // TEST 3: Requester PR Creation Scoped to Assigned Vessel
    // Requester creates PR with their assigned vessel ID -> succeeds (201)
    // =========================================================================
    console.log('\n--- Test 3: PR Creation Scoped to Assigned Vessel ---');
    const prCreationRes = await api('/api/purchase-requests', {
      method: 'POST',
      token: requester1Token,
      body: {
        vesselId: oceanStar.id,
        department: 'Engine',
        priority: 'HIGH',
        requiredDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        reason: 'Automated test spare part demand for Ocean Star',
        items: [
          {
            itemName: 'Lube Oil Purifier Disc Stack',
            quantity: 2,
            unit: 'Sets',
            estimatedUnitPrice: 14000,
          },
        ],
        submitImmediately: false,
      },
    });

    const createdPr = prCreationRes.data.data?.purchaseRequest;
    if (createdPr?.id) createdPrIds.push(createdPr.id);

    assert(
      prCreationRes.status === 201 && createdPr?.vesselId === oceanStar.id,
      '3. Requester creates PR bound to assigned vessel (HTTP 201)',
      `Status: ${prCreationRes.status}, PR ID: ${createdPr?.id}`
    );

    // =========================================================================
    // TEST 4: Requester Cannot Create PR for Another Vessel
    // Requester attempts to supply a different vesselId -> 403 Forbidden
    // =========================================================================
    console.log('\n--- Test 4: Cross-Vessel PR Creation Blocked (HTTP 403) ---');
    const invalidPrRes = await api('/api/purchase-requests', {
      method: 'POST',
      token: requester1Token,
      body: {
        vesselId: neptune.id, // Requester 1 is assigned to Ocean Star, NOT Neptune
        department: 'Engine',
        priority: 'NORMAL',
        requiredDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        reason: 'Attempting to order parts for unauthorized vessel',
        items: [
          {
            itemName: 'Main Engine Injector Nozzle',
            quantity: 4,
            unit: 'Pieces',
            estimatedUnitPrice: 5000,
          },
        ],
      },
    });

    assert(
      invalidPrRes.status === 403,
      '4. Requester cannot create PR for another vessel (HTTP 403)',
      `Got status ${invalidPrRes.status}: ${invalidPrRes.data.message}`
    );

    // =========================================================================
    // TEST 5: Cross-Requester PR Access Forbidden
    // Requester B cannot view/access Requester A's PR (HTTP 403 Forbidden)
    // =========================================================================
    console.log('\n--- Test 5: Cross-Requester PR Access Blocked (HTTP 403) ---');
    // Requester 2 (Neptune) tries to access PR created by Requester 1 (Ocean Star)
    const crossPrRes = await api(`/api/purchase-requests/${createdPr.id}`, {
      method: 'GET',
      token: requester2Token,
    });

    assert(
      crossPrRes.status === 403,
      '5. Requester B cannot access Requester A PR (HTTP 403)',
      `Got status ${crossPrRes.status}: ${crossPrRes.data.message}`
    );

    // Requester 1 CAN access their own PR
    const ownPrRes = await api(`/api/purchase-requests/${createdPr.id}`, {
      method: 'GET',
      token: requester1Token,
    });

    assert(
      ownPrRes.status === 200 && ownPrRes.data.data?.purchaseRequest?.id === createdPr.id,
      '5b. Requester A can access their own PR (HTTP 200)',
      `Got status ${ownPrRes.status}`
    );

    // =========================================================================
    // TEST 6: Admin Can Assign Vessel to Requester & Audit Log Recorded
    // Admin creates new requester user with vesselId & updates vesselId
    // =========================================================================
    console.log('\n--- Test 6: Admin User Vessel Assignment & Audit Log ---');
    const newRequesterEmail = `chief.test.${Date.now()}@demo.com`;
    const createUserRes = await api('/api/users', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Test Third Engineer',
        email: newRequesterEmail,
        password: 'Password123!',
        role: UserRole.REQUESTER,
        department: 'Engine',
        vesselId: oceanStar.id,
      },
    });

    const newUserId = createUserRes.data.data?.user?.id;
    if (newUserId) createdUserIds.push(newUserId);

    assert(
      createUserRes.status === 201 && createUserRes.data.data?.user?.vesselId === oceanStar.id,
      '6a. Admin registers requester with assigned vesselId (HTTP 201)',
      `User ID: ${newUserId}, vesselId: ${createUserRes.data.data?.user?.vesselId}`
    );

    // Admin reassigns user to Neptune
    const updateUserRes = await api(`/api/users/${newUserId}`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        vesselId: neptune.id,
      },
    });

    assert(
      updateUserRes.status === 200 && updateUserRes.data.data?.user?.vesselId === neptune.id,
      '6b. Admin updates requester vessel assignment to another vessel (HTTP 200)',
      `New vesselId: ${updateUserRes.data.data?.user?.vesselId}`
    );

    // Check audit log for vessel reassignment
    const auditRes = await api(`/api/audit-logs?entityType=USER&entityId=${newUserId}`, {
      method: 'GET',
      token: adminToken,
    });
    const logs = auditRes.data.data?.logs || [];
    const reassignmentLog = logs.find((l: any) => l.action === 'VESSEL_ASSIGNMENT_CHANGED');
    const metadata = typeof reassignmentLog?.metadata === 'string'
      ? JSON.parse(reassignmentLog.metadata)
      : reassignmentLog?.metadata;

    assert(
      reassignmentLog !== undefined && metadata?.newVesselId === neptune.id,
      '6c. Audit log created for VESSEL_ASSIGNMENT_CHANGED with metadata',
      `Audit entry found: ${!!reassignmentLog}, metadata: ${JSON.stringify(metadata)}`
    );

    // =========================================================================
    // TEST 7: Admin Vessel CRUD Maintained
    // Admin can list all vessels, create a new vessel, and update it
    // =========================================================================
    console.log('\n--- Test 7: Admin Vessel CRUD ---');
    const adminVesselsRes = await api('/api/vessels', {
      method: 'GET',
      token: adminToken,
    });

    assert(
      adminVesselsRes.status === 200 && (adminVesselsRes.data.data?.vessels?.length || 0) >= 2,
      '7a. Admin lists all fleet vessels (HTTP 200, count >= 2)',
      `Total fleet vessels: ${adminVesselsRes.data.data?.vessels?.length}`
    );

    const testImo = `${Math.floor(1000000 + Math.random() * 9000000)}`;
    const createVesselRes = await api('/api/vessels', {
      method: 'POST',
      token: adminToken,
      body: {
        name: `MV Test Voyager ${testImo.slice(-4)}`,
        imoNumber: testImo,
        flag: 'Panama',
        type: 'Container Ship',
        buildYear: 2021,
        capacity: 15000,
        capacityUnit: 'TEU',
        status: 'ACTIVE',
      },
    });

    const createdVesselId = createVesselRes.data.data?.vessel?.id;
    if (createdVesselId) createdVesselIds.push(createdVesselId);

    assert(
      createVesselRes.status === 201 && createdVesselId,
      '7b. Admin creates new fleet vessel (HTTP 201)',
      `Vessel ID: ${createdVesselId}`
    );

    // Update vessel
    const updateVesselRes = await api(`/api/vessels/${createdVesselId}`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        flag: 'Liberia',
      },
    });

    assert(
      updateVesselRes.status === 200 && updateVesselRes.data.data?.vessel?.flag === 'Liberia',
      '7c. Admin updates vessel details (HTTP 200)',
      `Updated flag: ${updateVesselRes.data.data?.vessel?.flag}`
    );

    // =========================================================================
    // TEST 8: Procurement Officer Fleet Visibility Maintained
    // Procurement Officer sees all fleet vessels and can view PRs across vessels
    // =========================================================================
    console.log('\n--- Test 8: Procurement Officer Fleet Visibility ---');
    const officerVesselsRes = await api('/api/vessels', {
      method: 'GET',
      token: officerToken,
    });

    assert(
      officerVesselsRes.status === 200 && (officerVesselsRes.data.data?.vessels?.length || 0) >= 2,
      '8a. Procurement Officer has full fleet vessel visibility (HTTP 200, count >= 2)',
      `Total vessels seen: ${officerVesselsRes.data.data?.vessels?.length}`
    );

    // Submit Requester 1's PR so it enters PENDING_APPROVAL and is visible to fleet officers
    await api(`/api/purchase-requests/${createdPr.id}/submit`, {
      method: 'POST',
      token: requester1Token,
    });

    // Procurement Officer can view Requester 1's PR
    const officerPrRes = await api(`/api/purchase-requests/${createdPr.id}`, {
      method: 'GET',
      token: officerToken,
    });

    assert(
      officerPrRes.status === 200 && officerPrRes.data.data?.purchaseRequest?.id === createdPr.id,
      '8b. Procurement Officer views PR across fleet (HTTP 200)',
      `Status: ${officerPrRes.status}`
    );

  } catch (err: any) {
    console.error('💥 Unhandled error in vessel scoped test suite:', err);
    failed++;
  } finally {
    // Cleanup created test records
    try {
      if (createdPrIds.length > 0) {
        await prisma.purchaseRequestItem.deleteMany({ where: { purchaseRequestId: { in: createdPrIds } } });
        await prisma.purchaseRequest.deleteMany({ where: { id: { in: createdPrIds } } });
      }
      if (createdUserIds.length > 0) {
        await prisma.auditLog.deleteMany({ where: { entityId: { in: createdUserIds } } });
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
      if (createdVesselIds.length > 0) {
        await prisma.vessel.deleteMany({ where: { id: { in: createdVesselIds } } });
      }
    } catch (cleanupErr) {
      console.warn('Test cleanup warning:', cleanupErr);
    }

    server.close();
  }

  console.log('\n===================================================');
  console.log(`📊 VESSEL-SCOPED ACCESS SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('===================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVesselScopedAccessTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
