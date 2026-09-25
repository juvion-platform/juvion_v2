import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../middleware/authenticate';
import { Channel } from '../../../models/juvi/Channel';
import { ChannelTemplate } from '../../../models/juvi/ChannelTemplate';
import { paginate } from '../../../shared/pagination';
import { enqueueReconcile } from '../spaces/reconcile-worker';
import { pageQuerySchema } from './schemas';
import { assertJuviEnabled } from './settings-service';

const channelsQuery = pageQuerySchema.extend({ status: z.enum(['active', 'archived']).optional() });
const TEMPLATE_ORDER = ['college', 'department', 'batch', 'course', 'hostel'];

export async function listChannels(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = channelsQuery.parse(req.query);
    const filter: Record<string, unknown> = { collegeId: req.collegeId! };
    if (status) filter.status = status;
    res.json(await paginate(Channel, filter, page, limit, { templateCode: 1, name: 1 }));
  } catch (e) { next(e); }
}

export async function listTemplates(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const items = await ChannelTemplate.find({ collegeId: req.collegeId! }).lean();
    items.sort((a, b) => TEMPLATE_ORDER.indexOf(a.code) - TEMPLATE_ORDER.indexOf(b.code));
    res.json({ items });
  } catch (e) { next(e); }
}

export async function reconcileNow(req: AuthRequest, res: Response, next: NextFunction) {
  try { await assertJuviEnabled(req.collegeId!); await enqueueReconcile(req.collegeId!); res.status(202).json({ queued: true }); } catch (e) { next(e); }
}
