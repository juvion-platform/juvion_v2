import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
// Sub-domains: SPACE, HOME, COMPANION, NOTICE, CONTENT, MOD, FAC, LIFECYCLE
const router = Router();
router.use(authenticate);
router.get('/', (_req, res) => res.json({ module: 'juvi' }));
export default router;
