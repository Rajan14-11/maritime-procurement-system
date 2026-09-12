import { Router } from 'express';
import {
  listPurchaseRequests,
  getPurchaseRequestById,
  createPurchaseRequest,
  updatePurchaseRequest,
  submitPurchaseRequest,
  approvePurchaseRequest,
  rejectPurchaseRequest,
} from './purchaseRequests.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../types/index.js';

const router = Router();

router.use(authenticateToken);

router.get('/', listPurchaseRequests);
router.get('/:id', getPurchaseRequestById);
router.post('/', createPurchaseRequest);
router.patch('/:id', updatePurchaseRequest);
router.post('/:id/submit', submitPurchaseRequest);
router.post(
  '/:id/approve',
  requireRole(UserRole.APPROVER, UserRole.ADMIN),
  approvePurchaseRequest
);
router.post(
  '/:id/reject',
  requireRole(UserRole.APPROVER, UserRole.ADMIN),
  rejectPurchaseRequest
);

export default router;
