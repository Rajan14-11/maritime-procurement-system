import { Router } from 'express';
import {
  listPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  approvePurchaseOrder,
  rejectPurchaseOrder,
} from './purchaseOrders.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../types/index.js';

const router = Router();

router.use(authenticateToken);

router.get('/', listPurchaseOrders);
router.get('/:id', getPurchaseOrderById);
router.post(
  '/',
  requireRole(UserRole.PROCUREMENT_OFFICER, UserRole.ADMIN),
  createPurchaseOrder
);
router.post(
  '/:id/approve',
  requireRole(UserRole.APPROVER, UserRole.ADMIN),
  approvePurchaseOrder
);
router.post(
  '/:id/reject',
  requireRole(UserRole.APPROVER, UserRole.ADMIN),
  rejectPurchaseOrder
);

export default router;
