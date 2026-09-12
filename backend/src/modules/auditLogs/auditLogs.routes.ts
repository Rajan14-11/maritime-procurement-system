import { Router } from 'express';
import { listAuditLogs } from './auditLogs.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../types/index.js';

const router = Router();

router.use(authenticateToken);
router.get(
  '/',
  requireRole(UserRole.ADMIN, UserRole.APPROVER, UserRole.PROCUREMENT_OFFICER),
  listAuditLogs
);

export default router;
