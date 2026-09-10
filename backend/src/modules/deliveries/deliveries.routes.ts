import { Router } from 'express';
import { listDeliveries, recordGoodsReceipt } from './deliveries.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../types/index.js';

const router = Router();

router.use(authenticateToken);

router.get('/', listDeliveries);
router.post(
  '/:id/receipts',
  requireRole(UserRole.PROCUREMENT_OFFICER, UserRole.ADMIN),
  recordGoodsReceipt
);

export default router;
