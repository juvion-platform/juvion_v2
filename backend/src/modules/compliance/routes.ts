import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
// Sub-domains: EVID, CRIT, READY, REPORT, REMED, VISIT
const router = Router();
router.use(authenticate);
router.get('/', (_req, res) => res.json({ module: 'compliance' }));
export default router;
