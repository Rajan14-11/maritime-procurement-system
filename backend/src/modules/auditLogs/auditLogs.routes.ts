import { Router } from 'express';
import { listAuditLogs } from './auditLogs.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../types/index.js';

const router = Router();

router.use(authenticateToken);
router.get(
  '/',
  requireRole(UserRole.ADMIN, UserRole.APPROVER),
  listAuditLogs
);

export default router;
