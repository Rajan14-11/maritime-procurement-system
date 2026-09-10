import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import vesselsRoutes from './modules/vessels/vessels.routes.js';
import vendorsRoutes from './modules/vendors/vendors.routes.js';
import purchaseRequestsRoutes from './modules/purchaseRequests/purchaseRequests.routes.js';
import rfqsRoutes from './modules/rfqs/rfqs.routes.js';
import purchaseOrdersRoutes from './modules/purchaseOrders/purchaseOrders.routes.js';
import deliveriesRoutes from './modules/deliveries/deliveries.routes.js';
import approvalsRoutes from './modules/approvals/approvals.routes.js';
import auditLogsRoutes from './modules/auditLogs/auditLogs.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Maritime Procurement System API',
      timestamp: new Date().toISOString(),
    });
  });

  // REST API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/vessels', vesselsRoutes);
  app.use('/api/vendors', vendorsRoutes);
  app.use('/api/purchase-requests', purchaseRequestsRoutes);
  app.use('/api/rfqs', rfqsRoutes);
  app.use('/api/purchase-orders', purchaseOrdersRoutes);
  app.use('/api/deliveries', deliveriesRoutes);
  app.use('/api/approvals', approvalsRoutes);
  app.use('/api/audit-logs', auditLogsRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // 404 Route
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: `Resource not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export default createApp;
