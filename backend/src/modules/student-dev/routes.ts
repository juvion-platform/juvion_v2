import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
// Sub-domains: ORG, EVT, ACH, BUD, PORT
const router = Router();
router.use(authenticate);
router.get('/', (_req, res) => res.json({ module: 'student-dev' }));
export default router;
