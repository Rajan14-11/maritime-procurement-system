import { Router } from 'express';
import { getPendingApprovals } from './approvals.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../types/index.js';

const router = Router();

router.use(authenticateToken);

router.get(
  '/pending',
  requireRole(UserRole.APPROVER, UserRole.ADMIN),
  getPendingApprovals
);

export default router;
