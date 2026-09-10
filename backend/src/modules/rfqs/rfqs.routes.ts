import { Router } from 'express';
import {
  listRfqs,
  getRfqById,
  createRfq,
  addQuotation,
  selectQuotation,
} from './rfqs.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../types/index.js';

const router = Router();

router.use(authenticateToken);

router.get('/', listRfqs);
router.get('/:id', getRfqById);
router.post(
  '/',
  requireRole(UserRole.PROCUREMENT_OFFICER, UserRole.ADMIN),
  createRfq
);
router.post(
  '/:id/quotations',
  requireRole(UserRole.PROCUREMENT_OFFICER, UserRole.ADMIN),
  addQuotation
);
router.post(
  '/:id/select-quotation',
  requireRole(UserRole.PROCUREMENT_OFFICER, UserRole.ADMIN),
  selectQuotation
);

export default router;
