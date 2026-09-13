import { Router } from 'express';
import {
  listVendors,
  getVendorById,
  createVendor,
  updateVendor,
  getMyVendorProfile,
  updateMyVendorProfile,
} from './vendors.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../types/index.js';

const router = Router();

router.use(authenticateToken);

router.get('/profile/me', requireRole(UserRole.VENDOR), getMyVendorProfile);
router.patch('/profile/me', requireRole(UserRole.VENDOR), updateMyVendorProfile);
router.get('/', listVendors);
router.get('/:id', getVendorById);
router.post(
  '/',
  requireRole(UserRole.PROCUREMENT_OFFICER, UserRole.ADMIN),
  createVendor
);
router.patch(
  '/:id',
  requireRole(UserRole.PROCUREMENT_OFFICER, UserRole.ADMIN),
  updateVendor
);

export default router;
