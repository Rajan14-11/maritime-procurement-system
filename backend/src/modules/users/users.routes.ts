import { Router } from 'express';
import { listUsers, getUserById, createUser, updateUser } from './users.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../types/index.js';

const router = Router();

router.use(authenticateToken);

router.get('/', listUsers);
router.get('/:id', getUserById);
router.post('/', requireRole(UserRole.ADMIN), createUser);
router.patch('/:id', requireRole(UserRole.ADMIN), updateUser);

export default router;
