import { Router } from 'express';
import { listVessels, getVesselById, createVessel, updateVessel } from './vessels.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../types/index.js';

const router = Router();

router.use(authenticateToken);

router.get('/', listVessels);
router.get('/:id', getVesselById);
router.post('/', requireRole(UserRole.ADMIN, UserRole.APPROVER), createVessel);
router.patch('/:id', requireRole(UserRole.ADMIN, UserRole.APPROVER), updateVessel);

export default router;
