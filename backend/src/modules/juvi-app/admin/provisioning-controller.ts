import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../../../middleware/authenticate';
import { createProvisioningRun } from '../accounts/provisioning-worker';
import { createRunSchema, pageQuerySchema, credentialsQuerySchema } from './schemas';
import * as svc from './provisioning-service';

const who = (req: AuthRequest) => req.user?.name || 'System';

export async function createRun(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = createRunSchema.parse(req.body);
    const run = await createProvisioningRun({
      collegeId: req.collegeId!, performedBy: who(req),
      filter: {
        kinds: body.kinds,
        programmeIds: body.programmeIds?.map((id) => new Types.ObjectId(id)),
        batchIds: body.batchIds?.map((id) => new Types.ObjectId(id)),
        departmentIds: body.departmentIds?.map((id) => new Types.ObjectId(id)),
      },
      options: { resetExistingPasswords: body.resetExistingPasswords },
    });
    res.status(202).json(run);
  } catch (e) { next(e); }
}
export async function listRuns(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { page, limit } = pageQuerySchema.parse(req.query); res.json(await svc.listRuns(req.collegeId!, page, limit)); } catch (e) { next(e); }
}
export async function getRun(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getRun(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function credentialGroups(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.credentialGroups(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function credentialsCsv(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const filter = credentialsQuerySchema.parse(req.query);
    const csv = await svc.credentialsCsv(req.collegeId!, req.params.id as string, filter, who(req));
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="juvi-credentials-${stamp}.csv"`);
    res.send(csv);
  } catch (e) { next(e); }
}
