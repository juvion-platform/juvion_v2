import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
// Sub-domains: LEAVE, ATT, APPR, FDP, RECRUIT, EXIT, DISC
const router = Router();
router.use(authenticate);
router.get('/', (_req, res) => res.json({ module: 'hr' }));
export default router;
