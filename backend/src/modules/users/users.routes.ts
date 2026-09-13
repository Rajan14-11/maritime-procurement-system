import { Router } from 'express';
import { listUsers, getUserById, createUser, updateUser } from './users.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../types/index.js';

const router = Router();

router.use(authenticateToken);

router.get('/', listUsers);
router.get('/:id', getUserById);
router.post('/', requireRole(UserRole.ADMIN, UserRole.PROCUREMENT_OFFICER), createUser);
router.patch('/:id', requireRole(UserRole.ADMIN, UserRole.PROCUREMENT_OFFICER), updateUser);

export default router;
