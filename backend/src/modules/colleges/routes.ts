import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
import { createCollegeSchema, updateCollegeSchema } from './validation';

function superAdminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'super_admin') return res.status(403).json({ error: 'Super admin access required' });
  next();
}

const router = Router();
router.use(authenticate);
router.use(superAdminOnly);

router.get('/stats', ctrl.stats);
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', validate(createCollegeSchema), ctrl.create);
router.put('/:id', validate(updateCollegeSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
