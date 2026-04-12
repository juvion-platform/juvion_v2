import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as ctrl from './controller';

const router = Router();

// Public routes (no auth required)
router.get('/health', ctrl.health);
router.post('/login', ctrl.login);

// Protected routes
router.get('/me', authenticate, ctrl.me);
router.post('/refresh', authenticate, ctrl.refresh);

export default router;
