import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
// Sub-domains: IAC, COMMS, AI, INTG, TENANT, DPS, OBS, API
const router = Router();
router.use(authenticate);
router.get('/', (_req, res) => res.json({ module: 'platform' }));
export default router;
