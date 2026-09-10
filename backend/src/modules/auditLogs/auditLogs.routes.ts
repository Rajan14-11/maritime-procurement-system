import { Router } from 'express';
import { listAuditLogs } from './auditLogs.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.get('/', listAuditLogs);

export default router;
