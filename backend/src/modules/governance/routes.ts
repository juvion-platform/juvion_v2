import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
// Sub-domains: DASH, POLICY, PREDICT, BOARD, AUDIT, STRATEGY
const router = Router();
router.use(authenticate);
router.get('/', (_req, res) => res.json({ module: 'governance' }));
export default router;
