const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Maritime Procurement System Database Seeding...');

  // 1. Clean existing data
  console.log('Cleaning old data...');
  await prisma.auditLog.deleteMany();
  await prisma.goodsReceiptItem.deleteMany();
  await prisma.goodsReceipt.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.quotationItem.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.rfqVendor.deleteMany();
  await prisma.rfq.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.purchaseRequestItem.deleteMany();
  await prisma.purchaseRequest.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.vessel.deleteMany();
  await prisma.user.deleteMany();

  // 2. Seed Vessels first
  console.log('Seeding Vessels...');
  const oceanStar = await prisma.vessel.create({
    data: {
      name: 'MV Ocean Star',
      imoNumber: 'IMO-9876543',
      type: 'Container Ship',
      flag: 'India',
      status: 'ACTIVE',
    },
  });

  const neptune = await prisma.vessel.create({
    data: {
      name: 'MV Neptune',
      imoNumber: 'IMO-9765432',
      type: 'Bulk Carrier',
      flag: 'Singapore',
      status: 'ACTIVE',
    },
  });

  const atlantic = await prisma.vessel.create({
    data: {
      name: 'MV Atlantic',
      imoNumber: 'IMO-9654321',
      type: 'Oil Tanker',
      flag: 'Panama',
      status: 'ACTIVE',
    },
  });

  const pacific = await prisma.vessel.create({
    data: {
      name: 'MV Pacific',
      imoNumber: 'IMO-9543210',
      type: 'Chemical Tanker',
      flag: 'Marshall Islands',
      status: 'ACTIVE',
    },
  });

  console.log('✓ 4 Vessels created');

  // 3. Seed Users
  console.log('Seeding Demo Users...');
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const chiefEngineer = await prisma.user.create({
    data: {
      name: 'Chief Engineer',
      email: 'chief.engineer@demo.com',
      passwordHash,
      role: 'REQUESTER',
      department: 'Engine',
      status: 'ACTIVE',
      vesselId: oceanStar.id,
    },
  });

  const secondEngineer = await prisma.user.create({
    data: {
      name: '2nd Engineer Neptune',
      email: 'engineer.neptune@demo.com',
      passwordHash,
      role: 'REQUESTER',
      department: 'Engine',
      status: 'ACTIVE',
      vesselId: neptune.id,
    },
  });

  const procurementOfficer = await prisma.user.create({
    data: {
      name: 'Procurement Officer',
      email: 'procurement@demo.com',
      passwordHash,
      role: 'PROCUREMENT_OFFICER',
      department: 'Procurement',
      status: 'ACTIVE',
      vesselId: null,
    },
  });

  const procurementManager = await prisma.user.create({
    data: {
      name: 'Procurement Manager',
      email: 'manager@demo.com',
      passwordHash,
      role: 'APPROVER',
      department: 'Procurement Management',
      status: 'ACTIVE',
      vesselId: null,
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: 'System Administrator',
      email: 'admin@demo.com',
      passwordHash,
      role: 'ADMIN',
      department: 'Administration',
      status: 'ACTIVE',
      vesselId: null,
    },
  });

  console.log('✓ Demo Users created with assigned vessels (Password: Password123!)');

  // 4. Seed Vendors
  console.log('Seeding Vendors...');
  const marineParts = await prisma.vendor.create({
    data: {
      vendorCode: 'VEN-001',
      name: 'MarineParts Ltd.',
      contactPerson: 'David Miller',
      email: 'sales@marineparts.com',
      phone: '+1-555-0199',
      address: '742 Evergreen Quay, Singapore Port',
      categories: 'Engine Parts, Propulsion Systems',
      paymentTerms: '30 Days',
      status: 'ACTIVE',
    },
  });

  const oceanSupply = await prisma.vendor.create({
    data: {
      vendorCode: 'VEN-002',
      name: 'OceanSupply Co.',
      contactPerson: 'Sarah Jenkins',
      email: 'orders@oceansupply.com',
      phone: '+44-20-7946-0912',
      address: '12 Harbor Wharf, Rotterdam',
      categories: 'Safety Equipment, Deck Consumables',
      paymentTerms: '45 Days',
      status: 'ACTIVE',
    },
  });

  const shipTech = await prisma.vendor.create({
    data: {
      vendorCode: 'VEN-003',
      name: 'ShipTech Marine',
      contactPerson: 'Alex Wong',
      email: 'info@shiptechmarine.com',
      phone: '+65-6789-0123',
      address: '88 Jurong Island Way, Singapore',
      categories: 'Engine Parts, Electrical, Filtration',
      paymentTerms: '30 Days',
      status: 'ACTIVE',
    },
  });

  const globalMarine = await prisma.vendor.create({
    data: {
      vendorCode: 'VEN-004',
      name: 'Global Marine Equipment',
      contactPerson: 'Lars Nielsen',
      email: 'contact@globalmarine.com',
      phone: '+45-33-12-34-56',
      address: '45 Fjord Quay, Copenhagen',
      categories: 'Deck Machinery, Navigation Systems',
      paymentTerms: '60 Days',
      status: 'ACTIVE',
    },
  });

  console.log('✓ 4 Vendors created');

  // 4b. Seed Vendor Portal Demo Users
  console.log('Seeding Vendor Portal Demo Users...');
  const vendorMarineUser = await prisma.user.create({
    data: {
      name: 'MarineParts Rep',
      email: 'vendor.marineparts@demo.com',
      passwordHash,
      role: 'VENDOR',
      department: 'Commercial & Sales',
      status: 'ACTIVE',
      vendorId: marineParts.id,
    },
  });

  const vendorOceanUser = await prisma.user.create({
    data: {
      name: 'OceanSupply Rep',
      email: 'vendor.oceansupply@demo.com',
      passwordHash,
      role: 'VENDOR',
      department: 'Order Fulfillment',
      status: 'ACTIVE',
      vendorId: oceanSupply.id,
    },
  });

  const vendorShipTechUser = await prisma.user.create({
    data: {
      name: 'ShipTech Marine Rep',
      email: 'vendor.shiptech@demo.com',
      passwordHash,
      role: 'VENDOR',
      department: 'Logistics Operations',
      status: 'ACTIVE',
      vendorId: shipTech.id,
    },
  });

  console.log('✓ 3 Vendor Portal demo users created (Password: Password123!)');

  // 5. Seed Historical PRs
  console.log('Seeding Initial PRs & Workflows...');

  const pr1002Date = new Date();
  pr1002Date.setDate(pr1002Date.getDate() + 14);

  const pr1002 = await prisma.purchaseRequest.create({
    data: {
      prNumber: 'PR-1002',
      vesselId: oceanStar.id,
      department: 'Deck',
      priority: 'MEDIUM',
      requiredDate: pr1002Date,
      estimatedTotal: 120000,
      reason: 'Mandatory replacement of SOLAS lifejackets and immersion suits.',
      status: 'APPROVED',
      requesterId: chiefEngineer.id,
      items: {
        create: [
          {
            itemName: 'SOLAS Lifejackets Type-A',
            description: 'Approved foam lifejackets with whistle and light',
            quantity: 20,
            unit: 'Pieces',
            estimatedUnitPrice: 6000,
            estimatedTotal: 120000,
          },
        ],
      },
    },
  });

  await prisma.approval.create({
    data: {
      entityType: 'PURCHASE_REQUEST',
      entityId: pr1002.id,
      purchaseRequestId: pr1002.id,
      approverId: procurementManager.id,
      decision: 'APPROVED',
      comments: 'Safety gear approved under emergency maintenance budget.',
    },
  });

  const pr1003Date = new Date();
  pr1003Date.setDate(pr1003Date.getDate() + 10);

  const pr1003 = await prisma.purchaseRequest.create({
    data: {
      prNumber: 'PR-1003',
      vesselId: neptune.id,
      department: 'Engine',
      priority: 'HIGH',
      requiredDate: pr1003Date,
      estimatedTotal: 65000,
      reason: 'Cylinder lubricant stock running below minimum voyage threshold.',
      status: 'RFQ_CREATED',
      requesterId: secondEngineer.id,
      items: {
        create: [
          {
            itemName: 'Marine Cylinder Lubricant 50BN',
            description: '208L Barrels for slow-speed 2-stroke diesel engine',
            quantity: 50,
            unit: 'Barrels',
            estimatedUnitPrice: 1300,
            estimatedTotal: 65000,
          },
        ],
      },
    },
  });

  const rfq1001Deadline = new Date();
  rfq1001Deadline.setDate(rfq1001Deadline.getDate() + 5);

  const rfq1001 = await prisma.rfq.create({
    data: {
      rfqNumber: 'RFQ-1001',
      purchaseRequestId: pr1003.id,
      deadline: rfq1001Deadline,
      status: 'OPEN',
      rfqVendors: {
        create: [
          { vendorId: marineParts.id },
          { vendorId: shipTech.id },
        ],
      },
    },
  });

  const pr1004Date = new Date();
  pr1004Date.setDate(pr1004Date.getDate() + 21);

  await prisma.purchaseRequest.create({
    data: {
      prNumber: 'PR-1004',
      vesselId: oceanStar.id,
      department: 'Navigation',
      priority: 'HIGH',
      requiredDate: pr1004Date,
      estimatedTotal: 240000,
      reason: 'X-Band Radar magnetron and transceiver unit overhaul required prior to drydock.',
      status: 'PENDING_APPROVAL',
      requesterId: chiefEngineer.id,
      items: {
        create: [
          {
            itemName: 'X-Band Magnetron 25kW',
            description: 'High power magnetron for Furuno radar suite',
            quantity: 2,
            unit: 'Sets',
            estimatedUnitPrice: 120000,
            estimatedTotal: 240000,
          },
        ],
      },
    },
  });

  // 6. Seed initial audit log entries
  await prisma.auditLog.createMany({
    data: [
      {
        userId: admin.id,
        userName: admin.name,
        userRole: admin.role,
        action: 'SYSTEM_INITIALIZATION',
        entityType: 'SYSTEM',
        entityId: 'SYSTEM-INIT',
        description: 'System master data and demo configuration initialized successfully.',
      },
      {
        userId: chiefEngineer.id,
        userName: chiefEngineer.name,
        userRole: chiefEngineer.role,
        action: 'CREATE_PURCHASE_REQUEST',
        entityType: 'PURCHASE_REQUEST',
        entityId: pr1002.id,
        description: 'Purchase request PR-1002 created for vessel MV Ocean Star.',
      },
      {
        userId: procurementManager.id,
        userName: procurementManager.name,
        userRole: procurementManager.role,
        action: 'APPROVE_PURCHASE_REQUEST',
        entityType: 'PURCHASE_REQUEST',
        entityId: pr1002.id,
        description: 'Purchase request PR-1002 approved by Procurement Manager.',
      },
      {
        userId: secondEngineer.id,
        userName: secondEngineer.name,
        userRole: secondEngineer.role,
        action: 'CREATE_PURCHASE_REQUEST',
        entityType: 'PURCHASE_REQUEST',
        entityId: pr1003.id,
        description: 'Purchase request PR-1003 created for vessel MV Neptune.',
      },
      {
        userId: procurementOfficer.id,
        userName: procurementOfficer.name,
        userRole: procurementOfficer.role,
        action: 'CREATE_RFQ',
        entityType: 'RFQ',
        entityId: rfq1001.id,
        description: 'Created RFQ-1001 for PR-1003 with MarineParts Ltd. and ShipTech Marine.',
      },
    ],
  });

  console.log('✓ Initial PRs, RFQ, and Audit Logs seeded successfully!');
  console.log('🎉 Database seeding complete.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
