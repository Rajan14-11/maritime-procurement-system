import { Router } from 'express';
import { login, getCurrentUser, logout } from './auth.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.post('/logout', authenticateToken, logout);
router.get('/me', authenticateToken, getCurrentUser);

export default router;
