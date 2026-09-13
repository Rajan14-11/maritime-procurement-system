# 🚢 Maritime Procurement Management System
## Frontend Architecture, Component Hierarchy & UI/UX Engineering Deep Dive

> **Technical Reference & Interview Preparation Guide**  
> *Everything you need to understand, explain, and defend the frontend architecture of the Maritime Procurement ERP.*

---

## Table of Contents
1. [Executive Frontend Summary & Tech Stack](#1-executive-frontend-summary--tech-stack)
2. [Project Anatomy & Directory Structure](#2-project-anatomy--directory-structure)
3. [Authentication, Session Hydration & Route Protection](#3-authentication-session-hydration--route-protection)
4. [API Client Layer & Error Handling Architecture](#4-api-client-layer--error-handling-architecture)
5. [Complete Page-by-Page Technical Breakdown](#5-complete-page-by-page-technical-breakdown)
   - Login & Quick Persona Switcher (`Login.tsx`)
   - Role-Tailored Operational Dashboard (`Dashboard.tsx`)
   - Requisition Lifecycle (`PurchaseRequestList`, `CreatePurchaseRequest`, `PurchaseRequestDetail`)
   - Authorizations Queue (`ApprovalsQueue.tsx`)
   - Competitive Sourcing & Bidding Matrix (`RfqList`, `RfqDetail`)
   - Purchase Order Governance (`PurchaseOrderList`, `PurchaseOrderDetail`)
   - Delivery Intake & Goods Inspection (`DeliveriesList.tsx`)
   - External Supplier Vendor Portal (`VendorRfqList`, `VendorPoList`, `VendorDeliveriesList`, `VendorProfile`)
   - Master Data & System Administration (`UsersList`, `VesselsList`, `AuditLogsList`)
6. [Design System, Theme & UI Micro-Interactions](#6-design-system-theme--ui-micro-interactions)
7. [Interview Preparation Cheat Sheet (Frontend)](#7-interview-preparation-cheat-sheet-frontend)
   - 10 Hard-Hitting Technical Interview Questions & Answers
   - Architecture Trade-Offs & Front-End Challenges

---

## 1. Executive Frontend Summary & Tech Stack

The frontend application is a modern Single Page Application (SPA) engineered for **desktop-first maritime fleet operations and mobile-responsive vendor portal access**.

```
+-------------------------------------------------------------------------------+
|                               Browser Client                                  |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                      index.html -> src/main.tsx                               |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                             src/App.tsx                                       |
|  +-------------------------------------------------------------------------+  |
|  |                           AuthProvider                                  |  |
|  |   - Hydrates session from localStorage                                  |  |
|  |   - Validates active JWT against GET /api/auth/me                       |  |
|  |   - Provides user, token, login, logout, and hasRole() helper           |  |
|  +-------------------------------------------------------------------------+  |
|                                       |                                       |
|                                       v                                       |
|  +-------------------------------------------------------------------------+  |
|  |                       BrowserRouter & Routes                            |  |
|  |   - Public: /login                                                      |  |
|  |   - Protected: ProtectedRoute with allowedRoles[] checks                |  |
|  +-------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                         src/layouts/MainLayout.tsx                            |
|  +-------------------------------------------------------------------------+  |
|  |  Top Navigation Bar: Brand, Vessel/Role Badges, User Menu, Logout       |  |
|  +-------------------------------------------------------------------------+  |
|  |  Sidebar: Contextual navigation (Fleet vs Vendor Portal)                |  |
|  +-------------------------------------------------------------------------+  |
|  |  Main Content: <Outlet /> (Dynamic view rendering with Suspense/fade)   |  |
|  +-------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------+
```

### Core Technologies:
- **Framework**: React 19 (`react`, `react-dom`).
- **Language**: TypeScript 5.7 (Strict mode, shared domain interfaces).
- **Bundler & Tooling**: Vite 6.2 (Sub-millisecond Hot Module Replacement, Rollup-based production tree-shaking).
- **Styling**: Tailwind CSS v4 (Modern CSS variables design tokens, custom slate/navy color scheme, glassmorphic backdrops).
- **Routing**: React Router v7 (`react-router-dom`).
- **Iconography**: Lucide React (`lucide-react` — Anchor, Ship, FileText, CheckCircle, AlertTriangle, ShieldCheck, Truck, Clock).

---

## 2. Project Anatomy & Directory Structure

```
frontend/src/
├── App.tsx                     # Top-level routing, ProtectedRoute wrapper, role boundaries
├── main.tsx                    # React 19 createRoot DOM mounting
├── index.css                   # Tailwind CSS v4 design tokens and base styles
├── vite-env.d.ts               # Vite environment type augmentations
├── context/
│   └── AuthContext.tsx         # Central auth state, token persistence, role helpers
├── layouts/
│   └── MainLayout.tsx          # Shared application layout (Navbar, Sidebar, Nav badges)
├── services/
│   └── api.ts                  # Centralized fetch client, ApiError class, query string builder
├── types/
│   └── index.ts                # TypeScript interfaces (User, Vessel, Vendor, PR, RFQ, PO, etc.)
└── pages/
    ├── Login.tsx               # Login screen with 1-click demo persona switcher
    ├── Dashboard.tsx           # Multi-role operational dashboard with dynamic KPI cards
    ├── Approvals/
    │   └── ApprovalsQueue.tsx  # Dual-tab queue for PR and PO approvals with modal review
    ├── AuditLogs/
    │   └── AuditLogsList.tsx   # Enterprise audit trail viewer with filters
    ├── Deliveries/
    │   └── DeliveriesList.tsx  # Port delivery intake modal & goods inspection records
    ├── MasterData/
    │   ├── UsersList.tsx       # User management (scoped for Officers vs Admins)
    │   └── VesselsList.tsx     # Fleet vessel administration (IMO, flag, status)
    ├── PurchaseOrders/
    │   ├── PurchaseOrderList.tsx
    │   └── PurchaseOrderDetail.tsx # PO inspection, vendor tracking, rejection alert banner
    ├── PurchaseRequests/
    │   ├── PurchaseRequestList.tsx
    │   ├── CreatePurchaseRequest.tsx # Multi-item requisition builder with live totals
    │   └── PurchaseRequestDetail.tsx # PR stepper, vessel scoping, active PO navigation
    ├── Rfqs/
    │   ├── RfqList.tsx         # RFQ tender creation from approved PRs
    │   └── RfqDetail.tsx       # Quote Comparison Matrix & winner selection modal
    ├── Vendor/
    │   ├── VendorRfqList.tsx   # Blind bidding workspace & quotation revision modal
    │   ├── VendorPoList.tsx    # Awarded orders, PO acknowledge & dispatch modal
    │   ├── VendorDeliveriesList.tsx # Verified Goods Receipts view
    │   └── VendorProfile.tsx   # Self-service supplier profile update form
    └── Vendors/
        └── VendorsList.tsx     # Fleet supplier directory (categories, payment terms)
```

---

## 3. Authentication, Session Hydration & Route Protection

### A. AuthContext Architecture (`src/context/AuthContext.tsx`)
Authentication state is managed globally through a custom React Context:
```typescript
interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}
```

#### How Session Hydration Works:
1. When the user loads or refreshes the page, `AuthProvider` checks `localStorage.getItem('maritime_token')`.
2. If a token exists, it calls `authApi.getMe()` (`GET /api/auth/me`).
3. If the token is valid, the server returns the fresh user entity (with updated vessel and vendor links), storing it in React state `user`.
4. If the token has expired or the account was deactivated, the catch block clears `maritime_token` and `maritime_user` from `localStorage`, setting `user = null` and redirecting the user to `/login`.
5. `loading` is set to `false`, unblocking route rendering.

### B. Route Protection & Role Boundary Guards (`src/App.tsx`)
```typescript
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, token, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  // 1. Unauthenticated redirect to login with return path
  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Role-based authorization check
  if (allowedRoles && allowedRoles.length > 0 && !hasRole(...allowedRoles)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
```
- **Admin Bypass**: Inside `hasRole()`, `if (user.role === 'ADMIN') return true;` grants System Administrators access to all views.
- **Route Isolation**: External Marine Suppliers (`role: VENDOR`) are restricted to `/vendor/*` routes and their custom dashboard. Attempting to navigate to internal fleet routes (`/purchase-requests`, `/rfqs`, `/approvals`) automatically bounces them back to `/`.

---

## 4. API Client Layer & Error Handling Architecture

Located in [`src/services/api.ts`](file:///d:/web%20development/procurementSystem/frontend/src/services/api.ts):

### A. The Custom `request<T>` Wrapper
Rather than pulling in heavy third-party Axios bundles, the app uses a lightweight, type-safe native `fetch` abstraction:
- **Base URL**: Automatically reads `import.meta.env.VITE_API_URL || '/api'`, seamlessly supporting both local Vite proxying and cloud deployments (e.g. Vercel / Railway).
- **Bearer Token Injection**: Automatically pulls `localStorage.getItem('maritime_token')` and appends `Authorization: Bearer <token>` to request headers.
- **401 Unauthorized Interceptor**: If the backend returns `401 Unauthorized` on any non-login endpoint, the client automatically clears stored session credentials and forces a clean redirect to `/login`.
- **Custom `ApiError` Class**:
  ```typescript
  export class ApiError extends Error {
    statusCode: number;
    data: any;
    constructor(message: string, statusCode: number, data?: any) {
      super(message);
      this.name = 'ApiError';
      this.statusCode = statusCode;
      this.data = data;
    }
  }
  ```
  This allows UI catch blocks to inspect `err.statusCode` and display tailored alerts (e.g., showing a special conflict modal on `403 Forbidden` or a duplicate warning on `409 Conflict`).

### B. Dynamic Query String Serialization
```typescript
function buildQuery(params?: Record<string, any>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '' && val !== 'undefined' && val !== 'ALL') {
      searchParams.append(key, String(val));
    }
  });
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}
```
This utility strips out empty strings, `null`, and `'ALL'` filter values, preventing dirty API queries like `?status=ALL&search=`.

---

## 5. Complete Page-by-Page Technical Breakdown

### 1. Login Page (`src/pages/Login.tsx`)
- **Key Feature: One-Click Demo Persona Switcher**:
  - Contains pre-configured buttons for:
    1. **Chief Engineer** (`chief.engineer@demo.com`)
    2. **Procurement Officer** (`procurement@demo.com`)
    3. **Procurement Manager** (`manager@demo.com`)
    4. **System Administrator** (`admin@demo.com`)
    5. **MarineParts Ltd. (Vendor)** (`vendor@marineparts.com`)
    6. **OceanSupply Co. (Vendor)** (`vendor@oceansupply.com`)
  - Clicking any persona card automatically pre-fills credentials and triggers `login(email, password)`.
- **Visual Design**: Dark maritime slate background with animated glowing accents, shield badge icons, and clear error banners for invalid credentials.

---

### 2. Operational Dashboard (`src/pages/Dashboard.tsx`)
- **Dynamic 5-Persona Customization**:
  The dashboard changes completely depending on `user.role`:
  - **Chief Engineer**: Focuses on vessel requisitions (`MV Ocean Star`), showing PR status distribution, draft counts, and incoming vessel goods.
  - **Procurement Officer**: Shows commercial pipeline: approved PRs waiting for RFQ, active RFQs, received quotes waiting for award, and pending POs.
  - **Procurement Manager**: Displays authorization queue count, total financial spend commitments, and PR/PO approval buttons.
  - **Marine Vendor**: Supplier fulfillment console displaying awarded purchase orders, RFQ invitation tenders, pending order acknowledgments, and logistics dispatch status.
- **Recent Activity Feed Privacy**:
  - Officers only see procurement lifecycle events. Staff account creations and administrative vessel events are strictly hidden.
  - The "View full audit" button is restricted to `ADMIN` and `APPROVER`.

---

### 3. Purchase Request Lifecycle
#### A. `PurchaseRequestList.tsx`
- Filterable by Status (`DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `COMPLETED`), Priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), and search term.
- Requesters only see requisitions tied to their vessel.

#### B. `CreatePurchaseRequest.tsx` (Dynamic Requisition Builder)
- **Interactive Multi-Item Form**: Users can dynamically add, edit, or remove line items.
- **Live Financial Calculation**: Automatically calculates `lineTotal = quantity * estimatedUnitPrice` and sums `estimatedTotal` in real time.
- **Validation**: Rejects past `requiredDate`. Enforces vessel scoping.

#### C. `PurchaseRequestDetail.tsx` (Requisition Command Center)
- **Workflow Stepper**: Visual progress bar (`Draft -> Manager Approval -> Sourcing RFQ -> Vendor Awarded -> PO Issued -> Completed`).
- **Dynamic Active PO Link**:
  - When an older PO was rejected and a new PO was re-issued, `activePo = pr.purchaseOrders?.find((po) => po.status !== 'REJECTED') || pr.purchaseOrders?.[0]`.
  - The top "View Purchase Order" button and card link dynamically point to `activePo.id`.
- **PO Rejection Alert Banner**: If the latest PO was rejected by management, renders a rose alert box showing the manager's exact rejection remarks and a one-click button to re-issue or switch vendors.

---

### 4. Authorizations Queue (`src/pages/Approvals/ApprovalsQueue.tsx`)
- **Dual-Tab Interface**: Allows managers to switch between **Purchase Requests (PR)** and **Purchase Orders (PO)** pending authorization.
- **One-Click Approval / Rejection Modals**:
  - Approvals prompt for optional management remarks.
  - Rejections enforce mandatory comments to explain why the requisition was declined.
- **Universal SoD Enforcement in UI**:
  - When `pr.requesterId === user.id`, the Approve button is disabled and replaced with a prominent amber badge:
    `Self-Request (Approval Blocked)`.
  - Explains to the user that peer authorization is required.

---

### 5. Competitive Sourcing & RFQs
#### A. `RfqList.tsx`
- Sourcing officers select an approved PR and invite multiple qualified marine suppliers.
- **Redundancy Filter**: PR selection dropdown is filtered with `(prsRes.purchaseRequests || []).filter((pr) => !pr.rfq)` so already-tendered PRs cannot be selected again.

#### B. `RfqDetail.tsx` (Quote Comparison Matrix)
- **Benchmarking Table**:
  - Renders all submitted supplier bids side-by-side.
  - **Lowest Total Price**: Highlighted with an emerald green badge.
  - **Fastest Lead Time**: Highlighted with a blue badge.
  - Displays supplier payment terms and technical remarks.
- **Winner Award Modal**: Requires the officer to input a `selectionReason` (e.g. *"Best price and complies with OEM specs"*), logging an audit record.
- **Switch Winner Capability**: If a PO was rejected by management, the officer can return to this screen and select a different quotation with one click.

---

### 6. Purchase Orders (`PurchaseOrderList.tsx` & `PurchaseOrderDetail.tsx`)
- **Quotation Price Locking**: Line items reflect the selected supplier's quoted prices (`₹`), not the engineer's rough estimates.
- **Tax Calculation**: Displays subtotal, tax rate %, tax amount, and final total.
- **Fulfillment Stepper**: Tracks `PENDING_APPROVAL -> ORDERED -> ACKNOWLEDGED -> DISPATCHED -> COMPLETED`.
- **Logistics Information Card**: Shows Carrier Name, Tracking / Waybill Number, Dispatch Date, and Port Delivery Notes.

---

### 7. Delivery Intake & Goods Inspection (`src/pages/Deliveries/DeliveriesList.tsx`)
- **Port Intake Modal**:
  - Officers select an approved/ordered PO.
  - For each line item, the modal shows `Ordered Quantity`, `Previously Received Quantity`, and an input for `Quantity Receiving Today`.
- **Condition Inspection**: Allows the inspector to classify incoming goods as `GOOD`, `DAMAGED`, or `PARTIALLY_DAMAGED` with notes.
- **Client-Side Anti-Over-Delivery Guard**: Prevents inputting a quantity where `previouslyReceived + quantityReceivingToday > orderedQuantity`, providing immediate error feedback before hitting the server.

---

### 8. External Supplier Vendor Portal (`src/pages/Vendor/`)
- **`VendorRfqList.tsx` (Blind Bidding & Revisions)**:
  - Suppliers see only RFQs they were invited to.
  - Competitor quotes are completely hidden.
  - Suppliers enter itemized unit prices in Indian Rupees (`₹`), delivery lead time in days, and payment terms.
  - Supports bid revisions up until tender deadline.
- **`VendorPoList.tsx` (Order Acknowledgment & Dispatch Tracking)**:
  - Step 1: **Acknowledge Order** modal confirming commitment to order specs and estimated delivery date.
  - Step 2: **Shipment Dispatch** modal inputting Carrier Name (e.g. Maersk, DHL Marine), Tracking Number, Dispatch Date, and Packaging Notes.
- **`VendorDeliveriesList.tsx`**: Transparency portal showing physical Goods Receipt Notes recorded onboard by shipboard engineers.
- **`VendorProfile.tsx`**: Self-service maintenance for contact representative, operations phone, and warehouse dispatch address.

---

### 9. Master Data & Administration
- **`UsersList.tsx`**:
  - Role-scoped: Procurement Officers can only see and create external `VENDOR` users.
  - Admins can provision all fleet accounts and update vessel assignments.
- **`VesselsList.tsx`**: Fleet registry showing IMO number, vessel type, flag state, and active operational status.
- **`AuditLogsList.tsx`**: Searchable, tamper-evident audit log table restricted to `ADMIN` and `APPROVER`.

---

## 6. Design System, Theme & UI Micro-Interactions

### A. Color Palette & Semantics
- **Backgrounds**: Slate-900 (`#0f172a`), Slate-800 (`#1e293b`), Slate-950 (`#020617`).
- **Brand Accent**: Maritime Navy / Blue-600 (`#2563eb`) with Blue-500 hover states.
- **Success / Awarded**: Emerald-500 (`#10b981`) for lowest prices, approved statuses, and completed orders.
- **Urgent / Rejections**: Rose-500 (`#f43f5e`) for rejected POs, urgent requisitions, and error banners.
- **Warnings / Pending**: Amber-500 (`#f59e0b`) for pending approvals and self-approval block badges.

### B. Currency Standardization
- Standardized on **Indian Rupees (`₹` INR)** across all views (Buyer Fleet and Vendor Portal) to avoid commercial quotation conversion ambiguity.

### C. Client-Side Navigation (SPA Experience)
- All navigation uses React Router's `navigate(...)` hook instead of `window.location.href`, eliminating full-page reload flicker and preserving client state.

---

## 7. Interview Preparation Cheat Sheet (Frontend)

### Q1: "How do you manage authentication and session persistence in React?"
> **Answer**: "We built an `AuthProvider` wrapping React Context. On login, the JWT and user profile are saved in `localStorage`. On application mount or refresh, the provider calls `GET /api/auth/me` to hydrate the user state with fresh vessel and vendor relations. If the token is expired or invalid, the provider clears `localStorage` and redirects to `/login`. In our API service layer, a fetch interceptor automatically appends the Bearer token and listens for `401 Unauthorized` responses to purge stale sessions."

### Q2: "How does your frontend handle role-based access control (RBAC)?"
> **Answer**: "We enforce RBAC through a two-tier approach:
> 1. **Route Level**: `ProtectedRoute` checks `allowedRoles`. If the current user lacks the required role, it redirects them away from restricted views.
> 2. **Component Level**: Views use `hasRole()` to conditionally render action buttons. For example, the 'Approve' button on requisitions is hidden from Officers, and when an Approver views their own requisition, the button is disabled with a `Self-Request (Approval Blocked)` badge. All actions are redundantly validated by the backend."

### Q3: "How does the UI adapt for external suppliers vs internal fleet operators?"
> **Answer**: "When a user logs in with `role: VENDOR`, `MainLayout` switches to a dedicated `vendorNav` sidebar and navbar with links to Invited Tenders, Purchase Orders, Deliveries, and Company Profile. Internal fleet features (vessel fleet management, approvals queue, internal PRs) are omitted from navigation. Furthermore, currency labels and forms adapt to supplier fulfillment actions (acknowledgment and dispatch tracking)."

### Q4: "How did you solve the PO Rejection Navigation bug?"
> **Answer**: "When a manager rejects a PO and the buyer issues a new one, the PR has multiple PO records. A naive implementation linking to `purchaseOrders[0]` would take the user to the old rejected PO. We resolved this by computing `activePo = pr.purchaseOrders?.find((po) => po.status !== 'REJECTED') || pr.purchaseOrders?.[0]`. Both the top action button and the PO card dynamically point to the active PO's ID."

### Q5: "How do you ensure competitive blind bidding in the frontend?"
> **Answer**: "In `VendorRfqList`, invited suppliers only see their own quotation card and line-item inputs. The Quote Comparison Matrix (which displays competitor pricing side-by-side) is strictly encapsulated inside `RfqDetail.tsx`, a route protected by `allowedRoles: ['PROCUREMENT_OFFICER', 'ADMIN', 'APPROVER']`. Even if a vendor attempts to inspect network traffic, the backend strips competitor data before sending the response."

### Q6: "How do you handle real-time price calculations in complex forms?"
> **Answer**: "In `CreatePurchaseRequest`, line items are held in React state as an array of item objects. When a user modifies `quantity` or `estimatedUnitPrice`, an `updateItem` handler computes `lineTotal = quantity * unitPrice` and immediately updates state. The form footer derives `estimatedTotal` via `items.reduce((sum, item) => sum + (item.quantity * item.estimatedUnitPrice), 0)`. We use standard currency formatting to ensure precision."

### Q7: "Why use Vite 6 instead of Create React App (CRA) or Next.js?"
> **Answer**: "Create React App is deprecated and uses sluggish Webpack bundling. Next.js introduces server-side rendering (SSR) complexity that is unnecessary for an authenticated, intranet enterprise ERP. Vite leverages native browser ES modules during development for instant cold starts and Hot Module Replacement (HMR), while using Rollup for optimized, tree-shaken static production bundles."

### Q8: "How does the Goods Receipt intake prevent over-delivery in the UI?"
> **Answer**: "In `DeliveriesList`, the intake modal displays `Ordered Quantity` and `Previously Received Quantity` for each line item. The input field sets `max = orderedQuantity - previouslyReceived`. If the user types a higher quantity, the form marks the input red, displays an inline warning ('Cannot exceed remaining balance of X units'), and disables the submit button, providing instant validation before hitting backend concurrency locks."

### Q9: "What is your strategy for state management?"
> **Answer**: "We avoided unnecessary Redux/MobX boilerplate. For global concerns (authentication, user profile, theme), we use React Context (`AuthContext`). For server data (PRs, RFQs, POs), we manage data through declarative `useState` and `useEffect` patterns with loading spinners and error states. When a mutation occurs (such as approving a PR), the handler re-invokes the fetcher to guarantee fresh synchronization with the backend."

### Q10: "How do you ensure smooth navigation without page reloads in a complex ERP?"
> **Answer**: "We systematically eliminated all legacy `window.location.href` calls in favor of React Router's `useNavigate()` hook. This prevents browser full-page reload cycles, preserves React state and cache, and allows instant transitions between requisition lists, detail views, and comparison matrices."
