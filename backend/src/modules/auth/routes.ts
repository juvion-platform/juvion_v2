import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as ctrl from './controller';

const router = Router();

// Public routes (no auth required)
router.post('/login', ctrl.login);

// Protected routes
router.get('/me', authenticate, ctrl.me);

export default router;
