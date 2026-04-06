import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
// Sub-domains: CRM, PROFILE, DRIVES, OFFERS, TRAIN, PORTAL, ALUMNI
const router = Router();
router.use(authenticate);
router.get('/', (_req, res) => res.json({ module: 'placement' }));
export default router;
