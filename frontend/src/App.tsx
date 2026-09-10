import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { MainLayout } from './layouts/MainLayout.js';

// Pages
import { Login } from './pages/Login.js';
import { Dashboard } from './pages/Dashboard.js';
import { PurchaseRequestList } from './pages/PurchaseRequests/PurchaseRequestList.js';
import { CreatePurchaseRequest } from './pages/PurchaseRequests/CreatePurchaseRequest.js';
import { PurchaseRequestDetail } from './pages/PurchaseRequests/PurchaseRequestDetail.js';
import { ApprovalsQueue } from './pages/Approvals/ApprovalsQueue.js';
import { RfqList } from './pages/Rfqs/RfqList.js';
import { RfqDetail } from './pages/Rfqs/RfqDetail.js';
import { PurchaseOrderList } from './pages/PurchaseOrders/PurchaseOrderList.js';
import { PurchaseOrderDetail } from './pages/PurchaseOrders/PurchaseOrderDetail.js';
import { DeliveriesList } from './pages/Deliveries/DeliveriesList.js';
import { VendorsList } from './pages/Vendors/VendorsList.js';
import { VesselsList } from './pages/MasterData/VesselsList.js';
import { UsersList } from './pages/MasterData/UsersList.js';
import { AuditLogsList } from './pages/AuditLogs/AuditLogsList.js';
import { UserRole } from './types/index.js';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, token, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-400">Loading Maritime ERP session...</p>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(...allowedRoles)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Application Routes inside MainLayout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Navigate to="/" replace />} />

            {/* Purchase Requests */}
            <Route path="purchase-requests" element={<PurchaseRequestList />} />
            <Route path="purchase-requests/new" element={<CreatePurchaseRequest />} />
            <Route path="purchase-requests/:id" element={<PurchaseRequestDetail />} />

            {/* Approvals Queue (Approvers & Admin) */}
            <Route
              path="approvals"
              element={
                <ProtectedRoute allowedRoles={['APPROVER', 'ADMIN']}>
                  <ApprovalsQueue />
                </ProtectedRoute>
              }
            />

            {/* RFQs & Quotations */}
            <Route
              path="rfqs"
              element={
                <ProtectedRoute allowedRoles={['PROCUREMENT_OFFICER', 'ADMIN', 'APPROVER']}>
                  <RfqList />
                </ProtectedRoute>
              }
            />
            <Route
              path="rfqs/:id"
              element={
                <ProtectedRoute allowedRoles={['PROCUREMENT_OFFICER', 'ADMIN', 'APPROVER']}>
                  <RfqDetail />
                </ProtectedRoute>
              }
            />

            {/* Purchase Orders */}
            <Route
              path="purchase-orders"
              element={
                <ProtectedRoute allowedRoles={['PROCUREMENT_OFFICER', 'ADMIN', 'APPROVER']}>
                  <PurchaseOrderList />
                </ProtectedRoute>
              }
            />
            <Route
              path="purchase-orders/:id"
              element={
                <ProtectedRoute allowedRoles={['PROCUREMENT_OFFICER', 'ADMIN', 'APPROVER']}>
                  <PurchaseOrderDetail />
                </ProtectedRoute>
              }
            />

            {/* Deliveries / Goods Receipts */}
            <Route
              path="deliveries"
              element={
                <ProtectedRoute allowedRoles={['PROCUREMENT_OFFICER', 'ADMIN', 'APPROVER']}>
                  <DeliveriesList />
                </ProtectedRoute>
              }
            />

            {/* Vendors Master */}
            <Route
              path="vendors"
              element={
                <ProtectedRoute allowedRoles={['PROCUREMENT_OFFICER', 'ADMIN', 'APPROVER']}>
                  <VendorsList />
                </ProtectedRoute>
              }
            />

            {/* Vessels Fleet */}
            <Route path="vessels" element={<VesselsList />} />

            {/* Admin User Management */}
            <Route
              path="users"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <UsersList />
                </ProtectedRoute>
              }
            />

            {/* Audit Logs */}
            <Route
              path="audit-logs"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'APPROVER', 'PROCUREMENT_OFFICER']}>
                  <AuditLogsList />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
