import { Router } from 'express';
import { getDashboardSummary } from './dashboard.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.get('/summary', getDashboardSummary);

export default router;
