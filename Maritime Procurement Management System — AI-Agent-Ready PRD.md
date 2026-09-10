# Maritime Procurement Management System
## Product Requirements Document — MVP

**Version:** 1.0  
**Purpose:** Assignment / Working Prototype  
**Target:** Internal ERP Procurement Module for a Maritime Shipping Company  
**Primary Objective:** Build a functional end-to-end procurement workflow that can be demonstrated to non-technical business stakeholders.

---

# 1. Executive Summary

The company operates maritime vessels and requires software to manage procurement of spare parts, consumables, equipment, and other supplies required for vessel operations.

The company currently has an initial ERP system developed by an outsourced technology partner. The internal technology team is being established to maintain the existing ERP and develop additional features.

This project is an MVP/prototype of a **Procurement Management module**.

The system must demonstrate a complete procurement lifecycle:

**Purchase Request → Approval → RFQ → Vendor Quotations → Quote Comparison → Vendor Selection → Purchase Order → PO Approval → Delivery → Goods Receipt → Completion**

The application should prioritize:

1. Correct business workflow
2. Functional backend and database
3. Clear user experience
4. Simple but professional UI
5. Role-based access
6. Auditability
7. Maintainable code

Visual complexity is not a priority.

---

# 2. Product Vision

Create a centralized procurement workflow where employees can request materials for vessels, authorized personnel can approve requests, procurement officers can obtain and compare supplier quotations, purchase orders can be generated and approved, and deliveries can be recorded.

The system should provide a single source of truth for the lifecycle and status of every procurement request.

---

# 3. Goals

## 3.1 Primary Goals

The MVP must allow users to:

- Authenticate into the application
- View a procurement dashboard
- Create purchase requests
- Associate requests with vessels
- Submit requests for approval
- Approve or reject requests
- Manage vendors
- Create RFQs
- Associate multiple vendors with an RFQ
- Record vendor quotations
- Compare quotations
- Select a vendor
- Generate a purchase order
- Approve or reject a PO
- Record delivery
- Record received quantities
- Complete procurement
- View the complete audit history of a procurement

---

# 4. Non-Goals

The following are intentionally excluded from the MVP:

- Real payment processing
- Real accounting integration
- Real vendor email integration
- Vendor self-service portal
- Mobile application
- Advanced inventory management
- Warehouse management
- Vessel GPS tracking
- Crew management
- Payroll
- Customs management
- Advanced tax/accounting calculations
- AI-based supplier recommendation
- Complex multi-company accounting
- SSO
- MFA
- Real-time notifications through external services
- Microservices architecture
- Kubernetes
- Complex DevOps infrastructure

These may be considered in future versions.

---

# 5. Target Users and Roles

The MVP supports four roles.

## 5.1 Requester

Typical user:

- Chief Engineer
- Chief Officer
- Vessel Superintendent

Permissions:

- View dashboard
- Create purchase requests
- View own purchase requests
- View request status
- View request history

A requester cannot approve their own request.

---

## 5.2 Procurement Officer

Permissions:

- View approved purchase requests
- Create RFQs
- Manage vendors
- Add vendors to RFQs
- Enter quotations
- Compare quotations
- Select vendors
- Generate purchase orders
- View purchase orders
- Record deliveries
- View procurement history

---

## 5.3 Approver

Typical user:

- Procurement Manager
- Operations Manager

Permissions:

- View pending approvals
- View purchase request details
- Approve purchase requests
- Reject purchase requests
- Approve purchase orders
- Reject purchase orders
- Add approval comments
- View audit history

An approver cannot approve an item that is not in a pending approval state.

---

## 5.4 Administrator

Permissions:

- All normal system permissions
- Manage users
- Manage vendors
- Manage vessels
- Activate/deactivate vendors
- Activate/deactivate users
- View audit logs

The administrator should not be required for the primary procurement workflow.

---

# 6. Authentication

The MVP requires basic authentication.

## 6.1 Login

The login page must contain:

- Email
- Password
- Login button

Example:

```text
Maritime Procurement

Email
[ procurement@example.com ]

Password
[ *************** ]

[ Login ]
```

---

## 6.2 Authentication Requirements

After successful login:

- Create an authenticated session.
- Store authentication state securely.
- Redirect the user to the dashboard.
- Display the user's name and role.
- Protect authenticated routes.

Unauthenticated users attempting to access protected pages should be redirected to `/login`.

---

## 6.3 Password Requirements

Minimum requirements:

- Password must not be empty.
- Password should contain at least 8 characters.
- Password must be stored hashed in the database.
- Plain-text passwords must never be stored.

For the assignment, password reset functionality is not required.

---

## 6.4 Role-Based Authorization

Frontend navigation should be role-aware.

Backend authorization is mandatory.

The backend must not rely solely on hidden frontend buttons for security.

Example:

```text
Requester
    → Can create PR
    → Cannot approve PR

Procurement Officer
    → Can create RFQ
    → Can add quotations
    → Cannot approve PO unless explicitly assigned approval permission

Approver
    → Can approve PR
    → Can approve PO

Administrator
    → Full access
```

---

# 7. Application Navigation

The authenticated application should use a simple sidebar.

```text
Maritime Procurement

Dashboard

Procurement
  Purchase Requests
  Approvals
  RFQs & Quotations
  Purchase Orders
  Deliveries

Master Data
  Vendors

Administration
  Users
  Vessels

Audit Log
```

Navigation should be hidden or disabled where the current role does not have permission.

The MVP does not require separate administration screens for every possible master-data entity.

---

# 8. Core Procurement Workflow

The primary workflow is:

```text
Purchase Request
        ↓
Pending Approval
        ↓
Approved
        ↓
RFQ Created
        ↓
Quotations Received
        ↓
Vendor Selected
        ↓
PO Created
        ↓
PO Pending Approval
        ↓
PO Approved
        ↓
Ordered
        ↓
Delivery
        ↓
Goods Received
        ↓
Completed
```

Rejected states:

```text
Purchase Request
       ↓
Rejected

OR

Purchase Order
       ↓
Rejected
```

A rejected purchase request cannot proceed to RFQ.

A rejected PO cannot proceed to delivery until it is corrected and resubmitted.

---

# 9. Purchase Request Module

## 9.1 Purchase Request List

The page should display:

- Request number
- Vessel
- Department
- Requester
- Priority
- Estimated amount
- Required date
- Status
- Created date

Example:

```text
PR Number | Vessel        | Item          | Amount | Status
-------------------------------------------------------------
PR-1001   | MV Ocean Star | Fuel Filters  | ₹85K   | Pending Approval
PR-1002   | MV Neptune    | Safety Gear   | ₹1.2L  | Approved
PR-1003   | MV Atlantic   | Lubricant     | ₹65K   | RFQ
```

Provide:

- Search
- Status filter
- Vessel filter
- Priority filter

Pagination is recommended if the dataset grows beyond 20 records.

---

# 10. Create Purchase Request

The requester must be able to create a request.

## Required Fields

### Header

- Vessel
- Department
- Priority
- Required By
- Reason

### Item

- Item name
- Description
- Quantity
- Unit
- Estimated unit price

The system should calculate:

```text
Estimated Total =
Quantity × Estimated Unit Price
```

---

## 10.1 Example

```text
Create Purchase Request

Vessel
[ MV Ocean Star ]

Department
[ Engine ]

Priority
[ High ]

Required By
[ 20/09/2026 ]

Item
[ Fuel Filter ]

Description
[ Main engine fuel filter ]

Quantity
[ 10 ]

Unit
[ Pieces ]

Estimated Unit Price
[ ₹8,500 ]

Estimated Total
₹85,000

Reason
[ Required for scheduled engine maintenance ]

[ Submit Request ]
```

---

# 11. Purchase Request Validation

Required fields must be validated.

Rules:

- Vessel is mandatory.
- Department is mandatory.
- Priority is mandatory.
- Required date is mandatory.
- Required date cannot be in the past.
- Item name is mandatory.
- Quantity must be greater than zero.
- Estimated unit price cannot be negative.
- Reason is mandatory.

The backend must repeat critical validation.

---

# 12. Purchase Request Statuses

Use the following statuses:

```text
DRAFT
PENDING_APPROVAL
APPROVED
REJECTED
RFQ_CREATED
VENDOR_SELECTED
PO_CREATED
COMPLETED
```

The application must not allow arbitrary status changes from the frontend.

Status transitions must be controlled by backend business logic.

---

# 13. Purchase Request Approval

Approvers should have an approval queue.

Example:

```text
Pending Approvals

PR-1001
MV Ocean Star
Fuel Filter × 10
₹85,000
High Priority

[ View ] [ Approve ] [ Reject ]
```

---

## 13.1 Approval

When the approver selects Approve:

1. Verify the request is `PENDING_APPROVAL`.
2. Verify the user has approval permission.
3. Create an approval record.
4. Update request status to `APPROVED`.
5. Create an audit-log entry.

---

## 13.2 Rejection

When selecting Reject:

A rejection reason is mandatory.

Example:

```text
Reject Purchase Request

Reason
[ Budget not approved for current maintenance cycle ]

[ Cancel ] [ Reject Request ]
```

The request status becomes:

`REJECTED`

---

# 14. Vendor Management

The system requires a basic vendor directory.

## Vendor Fields

- Vendor ID
- Vendor Name
- Contact Person
- Email
- Phone
- Address
- Categories
- Payment Terms
- Status
- Created Date

Vendor status:

```text
ACTIVE
INACTIVE
```

Inactive vendors cannot be selected for new RFQs.

---

# 15. Vendor List

Display:

```text
Vendor             Category        Payment Terms    Status
-----------------------------------------------------------
MarineParts Ltd.   Engine Parts    30 Days          Active
OceanSupply Co.    Safety          45 Days          Active
ShipTech Marine    Engine Parts    30 Days          Active
```

Actions:

- View
- Edit
- Activate/deactivate

---

# 16. RFQ Module

An approved purchase request can be converted into an RFQ.

The procurement officer selects:

- Purchase request
- Vendors
- Quotation deadline

Example:

```text
Create RFQ

Purchase Request
PR-1001

Vessel
MV Ocean Star

Item
Fuel Filter × 10

Quotation Deadline
12/09/2026

Select Vendors

☑ MarineParts Ltd.
☑ OceanSupply Co.
☑ ShipTech Marine

[ Create RFQ ]
```

---

# 17. RFQ Rules

- Only approved requests can generate RFQs.
- At least one active vendor is required.
- A vendor cannot be added twice to the same RFQ.
- RFQ deadline must not be in the past.
- An RFQ must reference a valid purchase request.
- An RFQ cannot be created twice for the same request unless explicitly supported by the business logic.

For MVP, assume one active RFQ per purchase request.

---

# 18. Quotation Management

Procurement officers can record quotations manually.

No actual external vendor portal or email integration is required.

Quotation fields:

- Vendor
- RFQ
- Quotation number
- Quotation date
- Total price
- Delivery time in days
- Payment terms
- Notes

Example:

```text
Vendor:
ShipTech Marine

Quotation Number:
QT-2026-145

Price:
₹91,000

Delivery:
3 days

Payment Terms:
30 Days
```

---

# 19. Quote Comparison

The application must provide a comparison view.

Example:

```text
QUOTE COMPARISON

Vendor           Price       Delivery      Payment
---------------------------------------------------
MarineParts      ₹82,000     5 days        30 Days
OceanSupply      ₹78,000     12 days       45 Days
ShipTech         ₹91,000     3 days        30 Days
```

The procurement officer can select one quotation.

The system must not automatically select the cheapest vendor.

The user must explicitly select the winning quotation.

---

# 20. Vendor Selection

When selecting a quotation:

- Verify quotation belongs to the RFQ.
- Verify vendor is active.
- Verify quotation has not already been rejected/selected.
- Mark selected quotation as `SELECTED`.
- Mark other quotations as `REJECTED`.
- Update RFQ status.
- Update Purchase Request status to `VENDOR_SELECTED`.
- Create audit log.

Optional selection reason:

```text
Selection Reason:
Fastest delivery required due to vessel maintenance schedule.
```

The selection reason should be stored.

---

# 21. Purchase Order Module

After vendor selection, the procurement officer can generate a PO.

PO should contain:

- PO number
- Vendor
- Vessel
- Purchase request
- RFQ
- Items
- Quantity
- Unit price
- Subtotal
- Tax, if applicable
- Total
- Delivery date
- Payment terms
- Status
- Created by
- Created date

For the MVP, tax can be optional or a configurable percentage.

---

# 22. PO Number

PO numbers should be generated by the backend.

Example:

```text
PO-1001
PO-1002
PO-1003
```

Users should not manually enter PO numbers.

---

# 23. PO Statuses

```text
DRAFT
PENDING_APPROVAL
APPROVED
REJECTED
ORDERED
PARTIALLY_RECEIVED
RECEIVED
COMPLETED
```

---

# 24. PO Approval

An approver can review:

```text
PO-1001

Vendor:
ShipTech Marine

Vessel:
MV Ocean Star

Item:
Fuel Filter × 10

Subtotal:
₹91,000

Total:
₹91,000

Expected Delivery:
15/09/2026

Payment Terms:
30 Days

[ Approve PO ] [ Reject PO ]
```

Approval requirements:

- PO must be `PENDING_APPROVAL`.
- Approver must have permission.
- Rejection requires a reason.
- Approval/rejection must be audited.

After approval:

`PENDING_APPROVAL → APPROVED → ORDERED`

The MVP may automatically transition an approved PO to `ORDERED`.

---

# 25. Delivery Module

The delivery module allows procurement staff to record receipt of goods.

Delivery fields:

- PO
- Delivery date
- Item
- Ordered quantity
- Received quantity
- Condition
- Notes

Condition options:

```text
GOOD
DAMAGED
PARTIALLY_DAMAGED
```

---

# 26. Partial Delivery

The system should support partial delivery.

Example:

```text
Ordered: 10
Received: 6
Remaining: 4
```

PO status:

`PARTIALLY_RECEIVED`

After the remaining 4 arrive:

```text
Ordered: 10
Received: 10
Remaining: 0
```

PO status:

`RECEIVED`

The procurement can then become:

`COMPLETED`

For a simplified implementation, multiple goods-receipt records may be associated with the same PO.

---

# 27. Goods Receipt Validation

The system must prevent:

```text
Received Quantity > Ordered Quantity
```

unless over-delivery is explicitly supported.

For MVP:

**Over-delivery is not allowed.**

Received quantity must be greater than zero.

Delivery date cannot be before the PO order date.

---

# 28. Audit Log

The system must maintain an audit trail for important procurement actions.

Example:

```text
PR-1001 Activity

10 Sep 09:20
Purchase request created
by Rajan

10 Sep 09:25
Purchase request submitted

10 Sep 10:30
Purchase request approved
by Procurement Manager

10 Sep 11:15
RFQ created

11 Sep 14:00
Quotation received from MarineParts

11 Sep 14:10
Quotation received from OceanSupply

11 Sep 14:20
Quotation received from ShipTech

11 Sep 15:00
ShipTech selected

11 Sep 15:05
PO-1001 created

11 Sep 16:00
PO approved

15 Sep 11:00
Goods received
```

Each audit record should contain:

- Timestamp
- User
- Action
- Entity type
- Entity ID
- Optional description

Audit records should not be editable by normal users.

---

# 29. Dashboard

The dashboard should provide a high-level operational overview.

## KPI Cards

```text
Purchase Requests       24
Pending Approvals        6
Open RFQs                8
Active POs              12
Pending Deliveries       4
```

The numbers should be calculated from the database rather than hard-coded.

---

## Recent Purchase Requests

Display the latest requests.

## Pending Approvals

Display requests requiring action.

## Recent Activity

Display recent audit events.

---

# 30. Vessel Management

The MVP requires basic vessel master data.

Vessel fields:

- Vessel ID
- Vessel Name
- IMO Number
- Vessel Type
- Flag
- Status

Example:

```text
MV Ocean Star
IMO: 9876543
Type: Container Ship
Flag: India
Status: Active
```

Vessels should be selectable when creating purchase requests.

Only active vessels can be selected for new requests.

---

# 31. User Management

Administrator should be able to:

- View users
- Create users
- Assign roles
- Activate/deactivate users

Fields:

- Name
- Email
- Password
- Role
- Status

User statuses:

```text
ACTIVE
INACTIVE
```

Inactive users cannot log in.

---

# 32. Database Requirements

Use a relational database.

Recommended:

**PostgreSQL**

Core tables/entities:

```text
users
roles
vessels
purchase_requests
purchase_request_items
approvals
vendors
rfqs
rfq_vendors
quotations
purchase_orders
purchase_order_items
goods_receipts
goods_receipt_items
audit_logs
```

---

# 33. Relationships

Conceptual relationship:

```text
User
 │
 ├── Purchase Requests
 │
 ├── Approvals
 │
 └── Audit Logs


Vessel
 │
 └── Purchase Requests


Purchase Request
 │
 ├── Items
 ├── Approvals
 └── RFQ
       │
       ├── Vendors
       └── Quotations
              │
              ▼
        Selected Quotation
              │
              ▼
        Purchase Order
              │
              ├── Items
              └── Goods Receipts
```

---

# 34. Data Integrity

The backend must enforce important relationships.

Examples:

- Cannot create RFQ for nonexistent request.
- Cannot create RFQ for rejected request.
- Cannot create PO without selected quotation.
- Cannot create PO for inactive vendor.
- Cannot approve already approved request.
- Cannot receive goods for non-approved PO.
- Cannot receive more goods than ordered.
- Cannot delete records that are referenced by completed procurement transactions.

Prefer soft deletion/inactivation for master data such as vendors and users.

---

# 35. API Requirements

The backend should expose REST APIs.

Suggested endpoints:

## Authentication

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

## Users

```text
GET    /api/users
POST   /api/users
GET    /api/users/:id
PATCH  /api/users/:id
```

## Vessels

```text
GET    /api/vessels
POST   /api/vessels
GET    /api/vessels/:id
PATCH  /api/vessels/:id
```

## Purchase Requests

```text
GET    /api/purchase-requests
POST   /api/purchase-requests
GET    /api/purchase-requests/:id
PATCH  /api/purchase-requests/:id
POST   /api/purchase-requests/:id/submit
POST   /api/purchase-requests/:id/approve
POST   /api/purchase-requests/:id/reject
```

## Vendors

```text
GET    /api/vendors
POST   /api/vendors
GET    /api/vendors/:id
PATCH  /api/vendors/:id
```

## RFQs

```text
GET    /api/rfqs
POST   /api/rfqs
GET    /api/rfqs/:id
POST   /api/rfqs/:id/quotations
POST   /api/rfqs/:id/select-quotation
```

## Purchase Orders

```text
GET    /api/purchase-orders
POST   /api/purchase-orders
GET    /api/purchase-orders/:id
POST   /api/purchase-orders/:id/approve
POST   /api/purchase-orders/:id/reject
```

## Deliveries

```text
GET    /api/deliveries
POST   /api/purchase-orders/:id/receipts
```

## Dashboard

```text
GET /api/dashboard/summary
GET /api/dashboard/recent-activity
```

---

# 36. API Design Principles

All APIs should:

- Return consistent JSON.
- Return appropriate HTTP status codes.
- Validate input.
- Return useful error messages.
- Authenticate protected requests.
- Authorize based on role.
- Avoid exposing passwords or sensitive credentials.
- Use transactions for multi-step state changes.

Example error:

```json
{
  "success": false,
  "message": "Purchase request must be approved before an RFQ can be created."
}
```

---

# 37. Transaction Requirements

Workflow operations that modify multiple records should use database transactions.

Example: selecting a vendor may require:

1. Mark selected quotation as selected.
2. Mark other quotations as rejected.
3. Update RFQ.
4. Update purchase request.
5. Create audit record.

These operations should succeed or fail together.

---

# 38. Frontend Requirements

Recommended stack:

```text
React
React Router
TanStack Query
Tailwind CSS
```

The exact libraries may be changed by the implementation agent if there is a strong reason.

The UI should prioritize:

- Clarity
- Consistency
- Fast navigation
- Forms
- Tables
- Status badges
- Confirmation dialogs
- Empty states
- Loading states
- Error states

No elaborate animations are required.

---

# 39. UI Design Principles

Use a professional enterprise ERP style.

Prefer:

- White/light background
- Clear typography
- Simple cards
- Tables
- Status badges
- Side navigation
- Modal/dialog for confirmations
- Consistent buttons

Avoid:

- Excessive gradients
- Large animations
- Decorative landing pages
- Complex charts
- Excessive colors
- Unnecessary visual effects

The interface should feel like an internal business application.

---

# 40. Required Screens

The MVP should contain approximately the following screens:

### Authentication

1. Login

### Main application

2. Dashboard
3. Purchase Request List
4. Create Purchase Request
5. Purchase Request Details
6. Approvals
7. Vendor List
8. Vendor Details/Create/Edit
9. RFQ List
10. RFQ Details
11. Quote Comparison
12. Purchase Order List
13. Purchase Order Details
14. Deliveries
15. Delivery Details
16. Audit Activity

### Administration

17. Users
18. Vessels

Some screens may be implemented as drawers/modals instead of separate routes.

---

# 41. Search and Filtering

The following lists should support basic search/filtering:

### Purchase Requests

- Search by PR number
- Search by item
- Filter by vessel
- Filter by status
- Filter by priority

### Vendors

- Search by name
- Filter by status

### RFQs

- Search by RFQ number
- Filter by status

### Purchase Orders

- Search by PO number
- Filter by status
- Filter by vendor
- Filter by vessel

Advanced filtering is not required.

---

# 42. Loading and Error States

Every API-backed screen must handle:

### Loading

Show a spinner or skeleton.

### Empty

Example:

```text
No pending approvals.
```

### Error

Example:

```text
Unable to load purchase requests.

[ Retry ]
```

### Mutation failure

Example:

```text
Unable to approve this request.
Please try again.
```

---

# 43. Confirmation Requirements

Destructive or workflow-changing actions require confirmation.

Examples:

```text
Approve Purchase Request?
```

```text
Reject Purchase Request?
A rejection reason is required.
```

```text
Select ShipTech Marine as the winning vendor?
```

```text
Confirm Goods Receipt?
```

---

# 44. Demo Seed Data

The application must include realistic seed data.

## Vessels

```text
MV Ocean Star
MV Neptune
MV Atlantic
MV Pacific
```

## Vendors

```text
MarineParts Ltd.
OceanSupply Co.
ShipTech Marine
Global Marine Equipment
```

## Users

```text
Chief Engineer
chief.engineer@demo.com

Procurement Officer
procurement@demo.com

Procurement Manager
manager@demo.com

Administrator
admin@demo.com
```

All demo users may use a documented demo password.

---

# 45. Primary Demo Scenario

The application must support the following scenario end-to-end.

## Step 1 — Create Purchase Request

Login as:

**Chief Engineer**

Create:

```text
Vessel:
MV Ocean Star

Department:
Engine

Priority:
High

Item:
Fuel Filter

Quantity:
10

Estimated Unit Price:
₹8,500

Estimated Total:
₹85,000

Required By:
20 September 2026

Reason:
Required for scheduled engine maintenance.
```

Submit.

Status:

**PENDING_APPROVAL**

---

# 46. Step 2 — Approve Request

Login as:

**Procurement Manager**

Open Approvals.

Open:

**PR-1001**

Approve.

Status:

**APPROVED**

---

# 47. Step 3 — Create RFQ

Login as:

**Procurement Officer**

Create RFQ for PR-1001.

Select:

```text
MarineParts Ltd.
OceanSupply Co.
ShipTech Marine
```

---

# 48. Step 4 — Enter Quotations

Enter:

```text
MarineParts
Price: ₹82,000
Delivery: 5 days
Payment: 30 Days

OceanSupply
Price: ₹78,000
Delivery: 12 days
Payment: 45 Days

ShipTech Marine
Price: ₹91,000
Delivery: 3 days
Payment: 30 Days
```

---

# 49. Step 5 — Select Vendor

Select:

**ShipTech Marine**

Selection reason:

```text
Fastest delivery required due to scheduled vessel maintenance.
```

---

# 50. Step 6 — Generate PO

Generate:

```text
PO-1001

Vendor:
ShipTech Marine

Vessel:
MV Ocean Star

Item:
Fuel Filter × 10

Total:
₹91,000

Expected Delivery:
15 September 2026

Payment Terms:
30 Days
```

Status:

**PENDING_APPROVAL**

---

# 51. Step 7 — Approve PO

Login as:

**Procurement Manager**

Approve PO-1001.

Status:

**ORDERED**

---

# 52. Step 8 — Receive Goods

Login as:

**Procurement Officer**

Record:

```text
Received Quantity: 10
Condition: Good
Delivery Date: 15 September 2026
```

Confirm receipt.

PO status:

**RECEIVED**

Procurement status:

**COMPLETED**

---

# 53. Final Demo Result

Dashboard should now reflect the completed procurement.

The activity timeline should show:

```text
Request Created
        ↓
Request Approved
        ↓
RFQ Created
        ↓
3 Quotations Received
        ↓
ShipTech Selected
        ↓
PO Created
        ↓
PO Approved
        ↓
Goods Received
        ↓
Procurement Completed
```

This complete workflow is the primary success criterion of the assignment.

---

# 54. Security Requirements

Minimum security requirements:

- Passwords must be hashed.
- Authentication required for protected endpoints.
- Authorization required for role-specific actions.
- Users cannot approve their own purchase requests.
- Inactive users cannot authenticate.
- Sensitive information must not be returned unnecessarily.
- Server-side authorization must be implemented.
- API inputs must be validated.
- SQL injection must be prevented through ORM/parameterized queries.
- CORS should be configured appropriately.
- Authentication secrets must be stored in environment variables.

For this assignment, advanced security such as SSO, MFA, OAuth, or enterprise identity providers is not required.

---

# 55. Error Handling

The backend should use meaningful HTTP status codes.

Examples:

```text
400 — Invalid input
401 — Not authenticated
403 — Not authorized
404 — Resource not found
409 — Invalid state/conflict
500 — Unexpected server error
```

Example:

```json
{
  "success": false,
  "message": "A purchase order cannot be created until a quotation has been selected."
}
```

---

# 56. Environment Configuration

Secrets and configuration must not be hardcoded.

Use environment variables for:

```text
DATABASE_URL
JWT_SECRET / SESSION_SECRET
PORT
FRONTEND_URL
```

Provide:

```text
.env.example
```

---

# 57. Development Requirements

The application should provide:

```text
README.md
.env.example
Database migrations
Seed script
Local development instructions
```

README should explain:

1. Prerequisites
2. Installation
3. Environment variables
4. Database setup
5. Migration
6. Seed data
7. Starting backend
8. Starting frontend
9. Demo credentials

---

# 58. Testing Requirements

The MVP should have basic tests for critical business logic.

At minimum test:

### Purchase Request

- Cannot submit invalid request.
- Cannot approve already approved request.
- Rejection requires reason.

### RFQ

- Cannot create RFQ from rejected request.
- Cannot create RFQ without vendor.
- Cannot add duplicate vendor.

### Quotation

- Cannot select quotation from another RFQ.
- Cannot select inactive vendor.

### Purchase Order

- Cannot create PO without selected quotation.
- Cannot approve already approved PO.

### Delivery

- Cannot receive more than ordered quantity.
- Cannot receive goods for unapproved PO.

---

# 59. Architecture

Use a **modular monolith**.

Recommended:

```text
                    React Frontend
                          │
                       REST API
                          │
                 Node.js / Express
                          │
                     Prisma ORM
                          │
                     PostgreSQL
```

Backend modules:

```text
auth
users
vessels
purchaseRequests
approvals
vendors
rfqs
quotations
purchaseOrders
deliveries
auditLogs
dashboard
```

Do not create microservices for this MVP.

---

# 60. Suggested Project Structure

Example:

```text
project/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── purchaseRequests/
│   │   │   ├── approvals/
│   │   │   ├── vendors/
│   │   │   ├── rfqs/
│   │   │   ├── purchaseOrders/
│   │   │   └── deliveries/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── routes/
│   │
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── vessels/
│   │   │   ├── purchaseRequests/
│   │   │   ├── approvals/
│   │   │   ├── vendors/
│   │   │   ├── rfqs/
│   │   │   ├── quotations/
│   │   │   ├── purchaseOrders/
│   │   │   ├── deliveries/
│   │   │   └── auditLogs/
│   │   ├── middleware/
│   │   ├── database/
│   │   └── app.js
│   │
│   └── package.json
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.js
│
└── README.md
```

The implementation agent may modify this structure if necessary, but functionality and separation of concerns must be preserved.

---

# 61. Important Implementation Rule

Do not implement the application as a collection of disconnected CRUD pages.

The core requirement is a **workflow-driven system**.

For example:

Incorrect:

```text
Click Approve
→ Change text from "Pending" to "Approved"
```

Correct:

```text
POST /purchase-requests/:id/approve

→ Validate authorization
→ Validate current status
→ Update database
→ Create approval record
→ Create audit log
→ Return updated entity
```

The database must be the source of truth.

---

# 62. State Transition Rules

Implement explicit state transitions.

Example:

```text
PENDING_APPROVAL
       │
       ├── approve → APPROVED
       │
       └── reject  → REJECTED
```

Do not allow:

```text
PENDING_APPROVAL → COMPLETED
```

or any other invalid transition.

A centralized state-transition/service layer is recommended.

---

# 63. Auditability Requirement

Every major state-changing action should create an audit record.

Minimum audited actions:

```text
CREATE_PURCHASE_REQUEST
SUBMIT_PURCHASE_REQUEST
APPROVE_PURCHASE_REQUEST
REJECT_PURCHASE_REQUEST
CREATE_RFQ
ADD_QUOTATION
SELECT_VENDOR
CREATE_PO
APPROVE_PO
REJECT_PO
RECORD_GOODS_RECEIPT
COMPLETE_PROCUREMENT
```

---

# 64. Accessibility and Usability

The MVP should:

- Use readable font sizes.
- Clearly distinguish buttons.
- Use meaningful labels.
- Avoid relying solely on color to communicate status.
- Provide confirmation for destructive actions.
- Provide visible validation messages.

---

# 65. Performance

The MVP does not require large-scale optimization.

However:

- Avoid unnecessary API calls.
- Use pagination for large lists.
- Use database indexes on frequently searched fields.
- Avoid loading all records when only summary information is required.
- Use appropriate database relations/includes.

---

# 66. Future Enhancements

Potential future versions could include:

## Procurement

- Automated RFQ emails
- Vendor portal
- Vendor quotation uploads
- Approval hierarchy
- Budget controls
- Purchase contracts
- Recurring procurement

## Inventory

- Vessel inventory
- Stock levels
- Spare-part catalog
- Reorder points
- Warehouse management

## Finance

- Invoice matching
- Three-way matching
- Payment tracking
- Accounting integration

## Maritime

- Planned maintenance integration
- Vessel maintenance schedules
- Port delivery management
- Vessel-specific procurement history

## Enterprise

- SSO
- MFA
- Advanced RBAC
- Multi-company
- Multi-currency
- Multi-language
- Advanced reporting

## Infrastructure

- Centralized logging
- Monitoring
- Alerting
- Backup automation
- Disaster recovery
- High availability
- Automated deployments

---

# 67. Production Considerations

The current project is an MVP/prototype, but the system is intended for a business operating in a 24×7 maritime environment.

A production version should eventually consider:

- High availability
- Database backups
- Disaster recovery
- Monitoring
- Error tracking
- Application logging
- Alerting
- Health checks
- Database replication
- Deployment rollback
- Infrastructure redundancy
- Security auditing
- Role-based access control
- Data retention
- Automated testing
- CI/CD

These are not required to be fully implemented in the assignment.

---

# 68. MVP Acceptance Criteria

The project is considered complete when all of the following work:

### Authentication

- [ ] User can log in.
- [ ] Invalid credentials are rejected.
- [ ] Protected routes require authentication.
- [ ] Role-based permissions work.
- [ ] User can log out.

### Purchase Request

- [ ] Requester can create a PR.
- [ ] Required fields are validated.
- [ ] PR is persisted.
- [ ] PR can be submitted.
- [ ] PR status changes to pending approval.

### Approval

- [ ] Approver sees pending PRs.
- [ ] Approver can approve.
- [ ] Approver can reject.
- [ ] Rejection requires reason.
- [ ] Status changes correctly.
- [ ] Audit record is created.

### Vendors

- [ ] Vendor list works.
- [ ] Vendor can be created.
- [ ] Vendor can be edited.
- [ ] Vendor can be activated/deactivated.
- [ ] Inactive vendors cannot be selected for new RFQs.

### RFQ

- [ ] Approved PR can create RFQ.
- [ ] Multiple vendors can be selected.
- [ ] Duplicate vendors are prevented.
- [ ] RFQ is persisted.

### Quotations

- [ ] Quotations can be entered.
- [ ] Quotations are associated with vendors.
- [ ] Quote comparison works.
- [ ] Vendor can be selected.

### Purchase Order

- [ ] PO can be generated from selected quotation.
- [ ] PO number is generated automatically.
- [ ] PO can be approved/rejected.
- [ ] PO status changes correctly.

### Delivery

- [ ] Delivery can be recorded.
- [ ] Received quantity is validated.
- [ ] Partial receipt works.
- [ ] Full receipt changes status correctly.
- [ ] Procurement can be completed.

### Audit

- [ ] Major actions are logged.
- [ ] Timeline can be viewed.

### Dashboard

- [ ] KPI values come from database.
- [ ] Recent activity is displayed.
- [ ] Pending approvals are displayed.

---

# 69. Definition of Done

The MVP is considered done when:

1. A fresh developer can clone the repository.
2. Follow README instructions.
3. Configure environment variables.
4. Run migrations.
5. Seed demo data.
6. Start frontend/backend.
7. Log in using demo credentials.
8. Complete the primary procurement scenario without manually modifying the database.
9. Refreshing the application does not lose workflow state.
10. Invalid workflow transitions are rejected.
11. Critical actions are recorded in the audit log.
12. The application can be demonstrated without requiring external services.

---

# 70. AI Agent Implementation Instructions

The coding agent should follow these principles.

## Priority Order

When making implementation decisions, prioritize:

1. Correct business workflow
2. Data integrity
3. Backend authorization
4. Working end-to-end flow
5. Error handling
6. Maintainability
7. UI polish

Do not sacrifice workflow correctness for visual polish.

---

## Development Strategy

Implement incrementally.

Recommended order:

```text
Phase 1
Project setup
Database
Authentication
Seed data

↓

Phase 2
Layout
Dashboard
Roles

↓

Phase 3
Purchase Requests
Approval

↓

Phase 4
Vendors
RFQ
Quotations

↓

Phase 5
Quote Comparison
Vendor Selection
PO

↓

Phase 6
Delivery
Goods Receipt
Completion

↓

Phase 7
Audit Logs
Search
Filtering
Error handling

↓

Phase 8
Testing
Bug fixing
Demo preparation
```

After each phase, verify functionality before continuing.

---

# 71. AI Agent Constraints

The coding agent must:

- Not invent additional business requirements without documenting them.
- Prefer simple implementations.
- Avoid unnecessary dependencies.
- Avoid microservices.
- Avoid unnecessary abstractions.
- Keep the application runnable locally.
- Use environment variables for secrets.
- Never hardcode authentication secrets.
- Keep database operations transactional where necessary.
- Implement authorization server-side.
- Preserve existing working functionality when adding features.
- Test existing workflows after significant changes.
- Seed realistic demo data.
- Keep the README updated.

If a requirement is ambiguous, choose the simplest reasonable implementation that preserves the documented workflow.

---

# 72. Final Product Principle

The most important requirement of the entire project is:

> **The procurement lifecycle must work from beginning to end.**

The application should allow a business stakeholder to understand:

```text
"We need something for our vessel."
            ↓
"We submit a request."
            ↓
"Someone approves it."
            ↓
"Procurement asks suppliers for quotes."
            ↓
"We compare the suppliers."
            ↓
"We select one."
            ↓
"We create a purchase order."
            ↓
"The PO is approved."
            ↓
"The goods arrive."
            ↓
"We record what we received."
            ↓
"The procurement is complete."
```

The application should make this workflow obvious without requiring technical knowledge.

**End of PRD**