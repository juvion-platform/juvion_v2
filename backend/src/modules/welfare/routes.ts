import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
// Sub-domains: GGM, ARC, ICC, SCST, GRC, MENT, COUNS, DISC, CCD
const router = Router();
router.use(authenticate);
router.get('/', (_req, res) => res.json({ module: 'welfare' }));
export default router;
