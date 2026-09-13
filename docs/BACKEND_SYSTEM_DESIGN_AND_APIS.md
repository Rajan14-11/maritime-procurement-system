# 🚢 Maritime Procurement Management System
## Backend Architecture, API Specification & Prisma Engineering Deep Dive

> **Technical Reference & Interview Preparation Guide**  
> *Everything you need to understand, explain, and defend the backend architecture of the Maritime Procurement ERP.*

---

## Table of Contents
1. [Executive Architectural Summary](#1-executive-architectural-summary)
2. [Prisma ORM: Comprehensive Guide for Developers](#2-prisma-orm-comprehensive-guide-for-developers)
   - What is Prisma & How Does it Work?
   - Schema Anatomy (`schema.prisma`)
   - Data Layer Models & Relationships
   - Prisma Client Query Methods Used in this Project
   - Database Connection Pooling (Supabase vs SQLite)
3. [Core Security & Invariant Enforcement Engines](#3-core-security--invariant-enforcement-engines)
   - Universal Separation of Duties (SoD) & Peer Authorization
   - Anti-Over-Delivery Concurrency Protection (Interactive Transactions)
   - RFQ Blind Bidding & Data Isolation Engine
   - Quotation Price Inheritance & Line-Item Consistency
   - Purchase Order Rejection Recovery State Machine
   - Monotonic Sequential RFQ Number Generation
   - Synchronous, Transaction-Safe Audit Logging
4. [Complete REST API Specification](#4-complete-rest-api-specification)
   - Authentication Module (`/api/auth`)
   - User Management Module (`/api/users`)
   - Vessel Fleet Module (`/api/vessels`)
   - Vendor Supplier Module (`/api/vendors`)
   - Purchase Request Module (`/api/purchase-requests`)
   - Request for Quotation (RFQ) Module (`/api/rfqs`)
   - Purchase Order Module (`/api/purchase-orders`)
   - Delivery & Goods Receipt Module (`/api/deliveries`)
   - Approvals Queue Module (`/api/approvals`)
   - Audit Trail Module (`/api/audit-logs`)
   - Operational Dashboard Module (`/api/dashboard`)
5. [Database ER Diagram & State Transition Diagrams](#5-database-er-diagram--state-transition-diagrams)
6. [Interview Preparation Cheat Sheet (Backend)](#6-interview-preparation-cheat-sheet-backend)
   - 10 Hard-Hitting Technical Interview Questions & Answers
   - Architectural Trade-Offs & Design Decisions

---

## 1. Executive Architectural Summary

The backend is built as a **modular monolith** using **Node.js, Express, TypeScript, and Prisma ORM**. It is engineered specifically for commercial vessel fleet management, adhering to maritime procurement compliance rules (Separation of Duties, blind competitive bidding, vessel scoping, and delivery concurrency).

```
                      +------------------------------------------+
                      |         Incoming Client Request          |
                      +------------------------------------------+
                                           |
                                           v
                      +------------------------------------------+
                      |   CORS & express.json({ limit: '10mb' })  |
                      +------------------------------------------+
                                           |
                                           v
                      +------------------------------------------+
                      |    authenticateToken (JWT Middleware)     |
                      |   - Extracts Bearer token                |
                      |   - Queries DB for active user & scope   |
                      |   - Attaches req.user                    |
                      +------------------------------------------+
                                           |
                                           v
                      +------------------------------------------+
                      |    requireRole(...allowedRoles)           |
                      |   - Enforces RBAC permissions            |
                      |   - Admin bypass                         |
                      +------------------------------------------+
                                           |
                                           v
                      +------------------------------------------+
                      |   Domain Controller                      |
                      |   - Business rules & input validation    |
                      |   - Vessel & Vendor data scoping         |
                      +------------------------------------------+
                                           |
                                           v
                      +------------------------------------------+
                      |   Prisma ORM Client / $transaction       |
                      |   - Type-safe query engine               |
                      |   - Connection pooling (PgBouncer)       |
                      +------------------------------------------+
                                           |
                                           v
                      +------------------------------------------+
                      |   PostgreSQL / Supabase Database         |
                      +------------------------------------------+
```

### Key Technical Highlights:
- **Language**: TypeScript 5.7 running on Node.js (ES Modules, target: ES2022).
- **Framework**: Express 4.21.
- **ORM & Data Layer**: Prisma ORM 6.19 interfacing with PostgreSQL (hosted on Supabase) in production, with fallback support for SQLite during local development.
- **Authentication**: Stateless JSON Web Tokens (JWT) signed using HMAC-SHA256 (`jsonwebtoken`).
- **Security**: Password hashing via `bcryptjs` (salt rounds: 10).
- **Automated Testing**: Custom automated test harness executing 84 tests across workflow, adversarial security, vessel access, and vendor portal domains.

---

## 2. Prisma ORM: Comprehensive Guide for Developers

### A. What is Prisma & How Does it Work?
If you come from raw SQL or traditional ORMs (like Hibernate, Mongoose, or Sequelize), here is how Prisma works:
1. **Declarative Schema (`schema.prisma`)**: You define your data models, enums, relations, and database connection in a single declarative file.
2. **Prisma CLI (`prisma`)**:
   - `npx prisma db push`: Pushes the schema directly into the database without creating SQL migration files (ideal for rapid development and prototypes).
   - `npx prisma generate`: Reads `schema.prisma` and generates a customized, 100% type-safe TypeScript client directly into `node_modules/@prisma/client`.
3. **Prisma Client (`@prisma/client`)**: An auto-generated query builder. Unlike traditional ORMs that use runtime reflection and string-based queries, Prisma generates static TypeScript types for every model, relation, and query payload. If a column name changes, your TypeScript compiler immediately catches errors at build time.
4. **Rust Query Engine**: Under the hood, the TypeScript client communicates with a high-performance compiled query engine written in Rust that optimizes SQL generation and prevents SQL injection by default through parameterized queries.

---

### B. Schema Anatomy (`backend/prisma/schema.prisma`)
The schema contains 15 models and 12 enums:

#### 1. Models Overview:
- `User`: Accounts for Chief Engineers, Officers, Approvers, Admins, and external Marine Vendors. Holds optional foreign keys `vesselId` and `vendorId`.
- `Vessel`: Ocean vessels (IMO number, vessel name, type, flag).
- `Vendor`: Marine suppliers (vendor code, company name, categories, payment terms).
- `PurchaseRequest` & `PurchaseRequestItem`: Onboard technical requisitions created by ship engineers with estimated pricing.
- `Approval`: Audit records for management authorizations or rejections of PRs and POs.
- `Rfq` & `RfqVendor`: Request for Quotations sent to a curated subset of invited vendors.
- `Quotation` & `QuotationItem`: Supplier bids submitted via the Vendor Portal with quoted unit prices and delivery terms.
- `PurchaseOrder` & `PurchaseOrderItem`: Legally binding commitments inheriting quoted vendor prices and tracking logistics dispatch.
- `GoodsReceipt` & `GoodsReceiptItem`: Verification logs of delivered quantities and condition recorded onboard.
- `AuditLog`: Immutable trail of every state change, user mutation, and financial approval.

#### 2. Prisma Attributes & Modifiers Explained:
- `@id`: Marks the primary key.
- `@default(cuid())`: Auto-generates a collision-resistant unique identifier (CUID) instead of auto-incrementing integers, preventing enumeration attacks.
- `@unique`: Creates a database-level unique constraint (e.g., `email`, `imoNumber`, `prNumber`, `poNumber`, `rfqNumber`).
- `@@unique([rfqId, vendorId])`: Composite unique constraint ensuring an invited vendor can submit only one active quotation per RFQ.
- `@relation(...)`: Defines foreign key relationships between tables:
  ```prisma
  vesselId String
  vessel   Vessel @relation(fields: [vesselId], references: [id])
  ```
- `onDelete: Cascade`: When a parent record (e.g., `PurchaseRequest`) is deleted, all dependent children (e.g., `PurchaseRequestItem`) are automatically cleaned up.
- `@db.Decimal(12, 2)`: Maps to an exact SQL `DECIMAL(12, 2)` data type to prevent floating-point rounding errors in financial transactions.
- `@@map("table_name")`: Maps TypeScript PascalCase model names (`PurchaseRequest`) to snake_case SQL tables (`purchase_requests`).
- `@@index([...])`: Creates database B-tree indexes for fast querying (e.g., indexing `[entityType, entityId]` and `[timestamp]` on `AuditLog`).

---

### C. Prisma Client Query Methods Used in This Codebase

Here is how our controllers interact with Prisma, using real examples from the code:

#### 1. `findUnique` (Fast Lookup by Primary Key or Unique Key)
Used when querying a record by its `id`, `email`, or `@unique` field:
```typescript
const user = await prisma.user.findUnique({
  where: { id: decoded.id },
  select: {
    id: true,
    name: true,
    email: true,
    role: true,
    vesselId: true,
  },
});
```
*Why `select`?* By explicitly declaring `select`, Prisma only fetches the specified columns from the database, preventing accidental leakage of `passwordHash`.

#### 2. `findFirst` (Ordering & Deterministic Lookups)
Used in monotonic RFQ sequence generation to find the latest created RFQ:
```typescript
const latestRfq = await prisma.rfq.findFirst({
  where: {
    rfqNumber: {
      startsWith: `RFQ-${currentYear}-`,
    },
  },
  orderBy: {
    createdAt: 'desc',
  },
});
```
*Why not `count()`?* If records 1, 2, 3 exist and record 2 is deleted, `count()` returns 2. Creating `count() + 1` creates record 3 again, crashing the server with a unique constraint violation. `findFirst({ orderBy: { createdAt: 'desc' } })` inspects the actual latest sequential number and increments safely.

#### 3. `findMany` (Filtering, Pagination & Relations)
Used across list endpoints with dynamic `where` clauses:
```typescript
const purchaseRequests = await prisma.purchaseRequest.findMany({
  where: {
    vesselId: req.user.vesselId, // Vessel scoping
    status: { not: 'DRAFT' },    // Do not show unsubmitted drafts to managers
  },
  include: {
    vessel: true,
    requester: { select: { id: true, name: true, email: true } },
    items: true,
    rfq: true,
  },
  orderBy: { createdAt: 'desc' },
});
```
*Notice `include`:* Prisma performs an optimized SQL `JOIN` (or batched multi-query) to return related records in a single structured JSON response without N+1 query problems.

#### 4. `create` (Nested Creation)
Used when creating a Purchase Request and all its line items simultaneously:
```typescript
const pr = await prisma.purchaseRequest.create({
  data: {
    prNumber,
    vesselId: req.user.vesselId,
    requesterId: req.user.id,
    department,
    priority,
    requiredDate: new Date(requiredDate),
    reason,
    estimatedTotal,
    status: 'DRAFT',
    items: {
      create: items.map((item) => ({
        itemName: item.itemName,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        estimatedUnitPrice: item.estimatedUnitPrice,
        estimatedTotal: item.quantity * item.estimatedUnitPrice,
      })),
    },
  },
  include: { items: true },
});
```
Prisma wraps this nested write in an internal SQL transaction automatically. If any line item fails validation, the entire PR creation rolls back.

#### 5. `update` (Field Mutation & Numeric Increment)
Used in Goods Receipt recording to update delivered balances:
```typescript
await tx.purchaseOrderItem.update({
  where: { id: item.poItemId },
  data: {
    receivedQuantity: {
      increment: item.quantityReceived, // Atomic SQL increment: "receivedQuantity" = "receivedQuantity" + X
    },
  },
});
```

#### 6. Interactive Transactions (`prisma.$transaction`)
Used when multiple operations must either succeed together or fail together with ACID guarantees:
```typescript
const result = await prisma.$transaction(async (tx) => {
  // 1. Re-read PO item balances inside the transaction
  const poItem = await tx.purchaseOrderItem.findUnique({ where: { id } });
  
  // 2. Validate anti-over-delivery invariants
  if (poItem.receivedQuantity + qty > poItem.quantity) {
    throw new Error('Over-delivery detected');
  }

  // 3. Create goods receipt record
  const receipt = await tx.goodsReceipt.create({ ... });

  // 4. Update PO item received quantity
  await tx.purchaseOrderItem.update({ ... });

  // 5. Write audit log synchronously
  await logAudit({ ... }, tx);

  return receipt;
});
```
If any error is thrown inside `prisma.$transaction(async (tx) => { ... })`, the entire block rolls back.

---

### D. Database Connection Pooling (Supabase vs SQLite)
- **Supabase / PostgreSQL**: Uses PgBouncer on port `6543` (transaction mode) for connection pooling in serverless/cloud environments, while migrations use port `5432` (`DIRECT_URL`).
- **SQLite**: Local single-file zero-config database (`dev.db`), ideal for offline development and local test execution.

---

## 3. Core Security & Invariant Enforcement Engines

### 1. Universal Separation of Duties (SoD) & Peer Authorization
- **The Problem**: In maritime procurement, requisitions involve substantial financial commitments. Allowing a user to approve their own requisition invites financial fraud.
- **The Implementation**: Located in [`purchaseRequests.controller.ts`](file:///d:/web%20development/procurementSystem/backend/src/modules/purchaseRequests/purchaseRequests.controller.ts):
  ```typescript
  if (pr.requesterId === req.user.id) {
    res.status(403).json({
      success: false,
      message: 'Conflict of interest: Requesters cannot approve their own purchase requests. Peer authorization is required.',
    });
    return;
  }
  ```
- **Universal Enforcement**: Applies to **all roles**, including System Administrators. If an Admin raises a requisition for vessel spares, a peer Manager or co-Admin must authorize it.

### 2. Anti-Over-Delivery Concurrency Protection (Interactive Transactions)
- **The Problem**: If two receiving officers simultaneously log deliveries for the same line item (e.g. two deliveries of 6 units for an order of 10), a naive read-then-write creates a race condition where 12 units are accepted.
- **The Implementation**: Located in [`deliveries.controller.ts`](file:///d:/web%20development/procurementSystem/backend/src/modules/deliveries/deliveries.controller.ts):
  1. Opens `prisma.$transaction(async (tx) => ...)`.
  2. Re-reads current `receivedQuantity` directly within the transaction lock.
  3. Verifies `receivedQuantity + quantityReceived <= quantity`.
  4. Increments `receivedQuantity` atomically.
  5. Computes whether the entire PO is now 100% delivered, transitioning PO and PR to `COMPLETED`.

### 3. RFQ Blind Bidding & Data Isolation Engine
- **The Problem**: Suppliers must not see competitor bids, nor should they see RFQs they were not invited to.
- **The Implementation**: Located in [`rfqs.controller.ts`](file:///d:/web%20development/procurementSystem/backend/src/modules/rfqs/rfqs.controller.ts):
  - When `req.user.role === 'VENDOR'`:
    - Only queries RFQs where `rfqVendors.some(v => v.vendorId === req.user.vendorId)`.
    - Automatically filters `quotations` to only include the calling vendor's own quotation:
      ```typescript
      if (req.user.role === 'VENDOR') {
        rfq.quotations = rfq.quotations.filter(q => q.vendorId === req.user.vendorId);
      }
      ```
    - Competitor pricing, delivery terms, and vendor names are completely stripped before sending the response over the wire.

### 4. Quotation Price Inheritance & Line-Item Consistency
- **The Problem**: PRs contain rough *budget estimates* (e.g. ₹1,000). Winning quotes contain *actual negotiated supplier prices* (e.g. ₹1,200). If a PO uses PR estimates, billing and accounting are corrupted.
- **The Implementation**: Located in [`purchaseOrders.controller.ts`](file:///d:/web%20development/procurementSystem/backend/src/modules/purchaseOrders/purchaseOrders.controller.ts):
  - PO generation reads line items from `winningQuotation.items`.
  - Sets `item.unitPrice = quotationItem.unitPrice` and `item.total = quantity * quotationItem.unitPrice`.
  - Computes exact subtotal, tax rate, tax amount, and grand total.

### 5. Purchase Order Rejection Recovery State Machine
- **The Problem**: If a manager rejects a PO (e.g., wrong delivery terms or vendor credit issue), traditional systems terminate the entire requisition, forcing the vessel to restart from draft.
- **The Implementation**:
  - When `POST /api/purchase-orders/:id/reject` is called:
    - PO status becomes `REJECTED`.
    - PR status automatically rolls back to `VENDOR_SELECTED`.
    - Procurement Officers can either:
      1. Correct the commercial terms and re-issue the PO to the same vendor.
      2. Navigate back to the Quote Comparison Matrix and **Switch Winner** to a runner-up quote.

### 6. Monotonic Sequential RFQ Number Generation
- **The Algorithm**:
  ```typescript
  const currentYear = new Date().getFullYear();
  const latestRfq = await prisma.rfq.findFirst({
    where: { rfqNumber: { startsWith: `RFQ-${currentYear}-` } },
    orderBy: { createdAt: 'desc' },
  });

  let nextSeq = 1;
  if (latestRfq && latestRfq.rfqNumber) {
    const parts = latestRfq.rfqNumber.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) nextSeq = lastNum + 1;
  }
  const rfqNumber = `RFQ-${currentYear}-${String(nextSeq).padStart(4, '0')}`;
  ```

### 7. Synchronous, Transaction-Safe Audit Logging
- [`audit.ts`](file:///d:/web%20development/procurementSystem/backend/src/utils/audit.ts) accepts an optional `tx?: Prisma.TransactionClient`.
- If an audit write fails inside a transaction, it throws an error that forces the entire database transaction to roll back, guaranteeing an unbreakable audit trail for compliance.

---

## 4. Complete REST API Specification

### 1. Authentication Module (`/api/auth`)

#### `POST /api/auth/login`
- **Access**: Public
- **Purpose**: Authenticates credentials and issues a signed JWT.
- **Request Body**:
  ```json
  {
    "email": "chief.engineer@demo.com",
    "password": "Password123!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "cuid-user-01",
      "name": "Chief Engineer",
      "email": "chief.engineer@demo.com",
      "role": "REQUESTER",
      "department": "Engine Department",
      "status": "ACTIVE",
      "vesselId": "cuid-vessel-01",
      "vessel": { "id": "cuid-vessel-01", "name": "MV Ocean Star", "imoNumber": "IMO9123456" }
    }
  }
  ```
- **Error Codes**: `400` (Missing fields), `401` (Invalid credentials / deactivated).

#### `GET /api/auth/me`
- **Access**: Authenticated (`Bearer <token>`)
- **Purpose**: Returns current session user with hydrated relations (`vessel`, `vendor`).
- **Response (200 OK)**: Current user object.

#### `POST /api/auth/logout`
- **Access**: Authenticated
- **Purpose**: Server-side audit acknowledgment.

---

### 2. User Management Module (`/api/users`)

#### `GET /api/users`
- **Access**: Authenticated
- **Scoping Rule**:
  - `ADMIN`: Returns all users.
  - `PROCUREMENT_OFFICER`: Strictly scoped to `role: VENDOR` users. Internal staff (Chief Engineers, Managers, Admins) are completely hidden.
- **Query Params**: `?search=&role=&status=`
- **Response (200 OK)**: `{ "users": [ ... ] }`

#### `POST /api/users`
- **Access**: `ADMIN` or `PROCUREMENT_OFFICER` (Officers can only create `VENDOR` role users).
- **Request Body**:
  ```json
  {
    "name": "Supplier Agent",
    "email": "agent@supplier.com",
    "password": "Password123!",
    "role": "VENDOR",
    "vendorId": "cuid-vendor-01"
  }
  ```
- **Response (201 Created)**: Created user object. Logs `USER_CREATED` audit trail.

#### `PATCH /api/users/:id`
- **Access**: `ADMIN` or `PROCUREMENT_OFFICER` (Officers restricted to vendor accounts).
- **Request Body**: `{ "name": "...", "status": "ACTIVE|INACTIVE", "vesselId": "..." }`
- **Response (200 OK)**: Updated user. Logs `VESSEL_ASSIGNMENT_CHANGED` if vessel assignment is modified.

---

### 3. Vessel Fleet Module (`/api/vessels`)

#### `GET /api/vessels`
- **Access**: Authenticated
- **Scoping Rule**:
  - `REQUESTER`: Returns only their assigned vessel (`id === req.user.vesselId`).
  - `PROCUREMENT_OFFICER`, `APPROVER`, `ADMIN`: Returns all fleet vessels.
- **Response (200 OK)**: `{ "vessels": [ ... ] }`

#### `GET /api/vessels/:id`
- **Access**: Authenticated (Requesters blocked with `403 Forbidden` if querying unassigned vessels).

#### `POST /api/vessels` & `PATCH /api/vessels/:id`
- **Access**: `ADMIN` only.
- **Request Body**: `{ "name": "MV Pacific Titan", "imoNumber": "IMO9876543", "type": "Container Ship", "flag": "Panama" }`

---

### 4. Vendor Supplier Module (`/api/vendors`)

#### `GET /api/vendors`
- **Access**: Authenticated
- **Response (200 OK)**: `{ "vendors": [ ... ] }`

#### `GET /api/vendors/profile/me` & `PATCH /api/vendors/profile/me`
- **Access**: `VENDOR` only.
- **Purpose**: Self-service profile updates (contact person, phone, warehouse dispatch address).

---

### 5. Purchase Request Module (`/api/purchase-requests`)

#### `GET /api/purchase-requests`
- **Access**: Authenticated
- **Scoping & Filtering**:
  - `REQUESTER`: Only PRs for their assigned vessel; drafts restricted to own creator ID.
  - `APPROVER`: Excludes unsubmitted `DRAFT` PRs.
  - `PROCUREMENT_OFFICER`: Excludes `DRAFT` and `REJECTED` PRs.

#### `POST /api/purchase-requests`
- **Access**: `REQUESTER` or `ADMIN`.
- **Validation**: Rejects past `requiredDate` (`400 Bad Request`). Enforces assigned `vesselId`.
- **Request Body**:
  ```json
  {
    "department": "Engine",
    "priority": "HIGH",
    "requiredDate": "2026-10-15T00:00:00.000Z",
    "reason": "Main Engine Turbocharger maintenance spares",
    "items": [
      {
        "itemName": "Oil Seal Ring",
        "description": "OEM Part #OS-9921",
        "quantity": 5,
        "unit": "Pieces",
        "estimatedUnitPrice": 2400
      }
    ]
  }
  ```
- **Response (201 Created)**: Created PR with items and generated `PR-2026-XXXX`.

#### `POST /api/purchase-requests/:id/submit`
- **Access**: `REQUESTER` or `ADMIN`.
- **Guard**: Only the creating user can submit. Status transitions: `DRAFT -> PENDING_APPROVAL`.

#### `POST /api/purchase-requests/:id/approve`
- **Access**: `APPROVER` or `ADMIN`.
- **Guard**: **Universal SoD**: If `pr.requesterId === req.user.id`, returns `403 Forbidden`.
- **Status Transition**: `PENDING_APPROVAL -> APPROVED`.

#### `POST /api/purchase-requests/:id/reject`
- **Access**: `APPROVER` or `ADMIN`.
- **Request Body**: `{ "reason": "Budget cap exceeded for current quarter" }`
- **Status Transition**: `PENDING_APPROVAL -> REJECTED`.

---

### 6. Request for Quotation (RFQ) Module (`/api/rfqs`)

#### `POST /api/rfqs`
- **Access**: `PROCUREMENT_OFFICER` or `ADMIN`.
- **Validation**: PR must be in `APPROVED` status. Deadline must be future date.
- **Request Body**:
  ```json
  {
    "purchaseRequestId": "cuid-pr-01",
    "vendorIds": ["cuid-ven-01", "cuid-ven-02"],
    "deadline": "2026-10-01T23:59:59.000Z"
  }
  ```
- **Response (201 Created)**: Created RFQ, transitions PR to `RFQ_CREATED`.

#### `POST /api/rfqs/:id/quotations`
- **Access**: `PROCUREMENT_OFFICER`, `ADMIN`, or `VENDOR`.
- **Purpose**: Submit or revise blind quotation.
- **Request Body**:
  ```json
  {
    "vendorId": "cuid-ven-01",
    "quotationNumber": "QT-MAR-2026-088",
    "deliveryDays": 7,
    "paymentTerms": "30 Days Net",
    "notes": "Includes customs clearance at port",
    "items": [
      { "itemName": "Oil Seal Ring", "quantity": 5, "unitPrice": 2200 }
    ]
  }
  ```

#### `POST /api/rfqs/:id/select-quotation`
- **Access**: `PROCUREMENT_OFFICER` or `ADMIN`.
- **Purpose**: Award RFQ tender to winning vendor.
- **Request Body**: `{ "quotationId": "cuid-qt-01", "selectionReason": "Lowest price and fastest delivery" }`
- **Status Transitions**: RFQ -> `CLOSED`, Quotation -> `SELECTED`, PR -> `VENDOR_SELECTED`.

---

### 7. Purchase Order Module (`/api/purchase-orders`)

#### `POST /api/purchase-orders`
- **Access**: `PROCUREMENT_OFFICER` or `ADMIN`.
- **Purpose**: Generates PO inheriting line items and prices from the selected quote.
- **Request Body**:
  ```json
  {
    "purchaseRequestId": "cuid-pr-01",
    "taxRate": 10,
    "deliveryDate": "2026-10-20T00:00:00.000Z",
    "paymentTerms": "30 Days"
  }
  ```
- **Response (201 Created)**: Created PO in `PENDING_APPROVAL`, transitions PR to `PO_CREATED`.

#### `POST /api/purchase-orders/:id/approve`
- **Access**: `APPROVER` or `ADMIN`.
- **Status Transition**: `PENDING_APPROVAL -> ORDERED`.

#### `POST /api/purchase-orders/:id/reject`
- **Access**: `APPROVER` or `ADMIN`.
- **Status Transitions**: PO -> `REJECTED`, PR -> rolls back to `VENDOR_SELECTED`.

#### `POST /api/purchase-orders/:id/acknowledge`
- **Access**: `VENDOR` (or Officer/Admin).
- **Request Body**: `{ "estimatedDeliveryDate": "2026-10-18T00:00:00.000Z" }`
- **Action**: Stamps `acknowledgedAt` timestamp and committed delivery date.

#### `POST /api/purchase-orders/:id/dispatch`
- **Access**: `VENDOR` (or Officer/Admin).
- **Request Body**:
  ```json
  {
    "carrierName": "DHL Express Marine",
    "trackingNumber": "WAYBILL-9948201",
    "dispatchNotes": "Packed in wooden crate with IMO HAZMAT label",
    "estimatedDeliveryDate": "2026-10-18T14:00:00.000Z"
  }
  ```

---

### 8. Delivery & Goods Receipt Module (`/api/deliveries`)

#### `POST /api/deliveries/:id/receipts`
- **Access**: `PROCUREMENT_OFFICER` or `ADMIN`.
- **Protected by**: Interactive Transaction (`prisma.$transaction`) with Anti-Over-Delivery validation.
- **Request Body**:
  ```json
  {
    "condition": "GOOD",
    "notes": "Verified onboard by Chief Engineer",
    "items": [
      { "poItemId": "cuid-po-item-01", "quantityReceived": 5 }
    ]
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "goodsReceipt": { "id": "...", "receiptNumber": "GRN-2026-0001" },
      "poStatus": "COMPLETED",
      "completed": true
    }
  }
  ```

---

### 9. Approvals Queue Module (`/api/approvals`)

#### `GET /api/approvals/pending`
- **Access**: `APPROVER` or `ADMIN`.
- **Response (200 OK)**:
  ```json
  {
    "totalPending": 3,
    "purchaseRequests": [ ... ],
    "purchaseOrders": [ ... ]
  }
  ```

---

### 10. Audit Trail Module (`/api/audit-logs`)

#### `GET /api/audit-logs`
- **Access**: `ADMIN` or `APPROVER` only (`403 Forbidden` for Officers and Requesters).
- **Query Params**: `?search=&entityType=&action=&limit=50`
- **Response (200 OK)**: `{ "logs": [ ... ] }`

---

### 11. Operational Dashboard Module (`/api/dashboard`)

#### `GET /api/dashboard/summary`
- **Access**: Authenticated (dynamically tailored to caller's role).
- **Chief Engineer**: Requisitions raised, awaiting approval, approved, onboard deliveries.
- **Procurement Officer**: Active RFQs, quotes pending review, POs awaiting authorization, deliveries intake.
- **Procurement Manager**: Total pending approvals, financial spend pipeline, monthly commitments.
- **Vendor**: Awarded orders, pending RFQ bids, pending PO acknowledgments, active shipments.

---

## 5. Database ER Diagram & State Transition Diagrams

```
+---------------------------------------------------------------------------------+
|                       PURCHASE REQUEST (PR) LIFECYCLE                           |
+---------------------------------------------------------------------------------+

  [ DRAFT ] 
      |
      | (Submit by Requester)
      v
  [ PENDING_APPROVAL ] 
      |
      +---> (Manager Rejection) ------------> [ REJECTED ] (Terminated)
      |
      | (Manager Approval - Peer SoD)
      v
  [ APPROVED ] 
      |
      | (Officer creates RFQ)
      v
  [ RFQ_CREATED ] 
      |
      | (Officer selects winning quotation)
      v
  [ VENDOR_SELECTED ] <--------------------+
      |                                    | (Manager PO Rejection
      | (Officer issues PO)                |  Rollback Recovery)
      v                                    |
  [ PO_CREATED ] --------------------------+
      |
      | (100% Goods verified onboard via GRN)
      v
  [ COMPLETED ]
```

---

## 6. Interview Preparation Cheat Sheet (Backend)

### Q1: "How does your system enforce Separation of Duties (SoD)?"
> **Answer**: "We enforce strict Separation of Duties at both middleware and controller levels. For Purchase Requests, no user—including System Administrators—can approve their own requisition (`pr.requesterId === req.user.id`). Attempting self-approval returns `HTTP 403 Forbidden`. Requisitions require peer review. Furthermore, Requesters cannot issue POs, Procurement Officers cannot approve PRs or POs, and Managers cannot raise requisitions."

### Q2: "How did you prevent race conditions and over-delivery in Goods Receipts?"
> **Answer**: "We wrapped delivery logging inside an interactive database transaction (`prisma.$transaction`). Inside the transaction, we re-read the fresh line-item balance directly from the database to avoid dirty reads, verify that `receivedQuantity + incomingQuantity <= orderedQuantity`, and execute an atomic increment update on the purchase order item. If any line item exceeds ordered quantity, the transaction throws an error and completely rolls back."

### Q3: "How does Prisma handle connection pooling with Supabase?"
> **Answer**: "Supabase uses PgBouncer for connection pooling. In `schema.prisma`, we provide two URLs: `DATABASE_URL` pointing to PgBouncer on port `6543` in transaction mode (used by the application runtime), and `DIRECT_URL` pointing directly to PostgreSQL on port `5432` (used by Prisma CLI for schema migrations and introspections)."

### Q4: "Why did you choose CUID over auto-incrementing integer IDs?"
> **Answer**: "Auto-incrementing integer IDs (`/api/purchase-orders/123`) are vulnerable to sequential enumeration attacks, allowing competitors to estimate company order volume. CUIDs (`cuid()`) are collision-resistant, URL-safe, time-ordered identifiers that prevent ID harvesting and support distributed database scaling without central ID coordination."

### Q5: "How do you guarantee that external suppliers cannot see competitor bids?"
> **Answer**: "Through server-side data isolation. When a user with `role: VENDOR` queries RFQs, the query filter strictly limits RFQs to those where the vendor is explicitly invited. Furthermore, in the controller before serializing to JSON, we filter the `quotations` array so it only contains records where `vendorId === req.user.vendorId`. Competitor quotation items, pricing, and notes are never fetched or sent over the network."

### Q6: "What happens when a manager rejects a Purchase Order?"
> **Answer**: "Instead of terminating the requisition, we implemented a Rejection Recovery State Machine. The PO status transitions to `REJECTED`, and the PR status automatically rolls back to `VENDOR_SELECTED`. This keeps the requisition active and allows the buyer to either re-issue a corrected PO with amended payment terms or switch the winner to runner-up quotations without having to re-tender."

### Q7: "How is audit logging made transaction-safe?"
> **Answer**: "Our `logAudit` helper accepts an optional Prisma transaction client (`tx`). In critical financial mutations (PO creation, delivery intake, approval), the audit log write is executed using `tx.auditLog.create`. If the audit write fails for any reason (e.g. constraint or disk issue), it rethrows, causing the parent business mutation to roll back completely. This ensures compliance."

### Q8: "How do you generate sequential RFQ and PO numbers without collisions?"
> **Answer**: "We avoid naive table counting (`count() + 1`) because deleting records or running database seeds creates sequence gaps that result in unique constraint crashes. Instead, we query `findFirst({ where: { rfqNumber: { startsWith: 'RFQ-YYYY-' } }, orderBy: { createdAt: 'desc' } })`, parse the numeric suffix with integer regex, and increment monotonically."

### Q9: "Why use TypeScript with Prisma?"
> **Answer**: "Prisma generates TypeScript types based directly on our database schema. When we query a model with `include` or `select`, Prisma infers the exact returned shape at compile time. This eliminates runtime typing errors, guarantees that frontend contracts match backend schemas, and catches database mismatches during compilation."

### Q10: "How do you test critical edge cases in your backend?"
> **Answer**: "We built an adversarial test suite (`adversarial-guards.test.ts`) with 37 targeted security tests, covering cross-user draft access, self-approval blocking, non-approved RFQ creation, duplicate winner selection, price quotation inheritance, concurrent delivery race conditions, and future-only date validations. The entire suite of 84 tests runs against the live database with zero failures."
