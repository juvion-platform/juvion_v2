import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
// Sub-domains: HOSTEL, MESS, TRANSPORT, LIBRARY, LABS, FACILITIES, MAINT
const router = Router();
router.use(authenticate);
router.get('/', (_req, res) => res.json({ module: 'campus-ops' }));
export default router;
