import { Request, Response, NextFunction } from 'express';
import { isS3Configured, getPresignedUrl } from '../../../shared/s3/s3-client';
import { MobileRequest, requireMobile } from '../middleware/authenticate-mobile';
import { MobileApiError } from '../errors';
import { ONBOARDING_STEPS } from '../accounts/onboarding';
import { lookupInstitutionByCode, getJuviConfig } from './institution-config';

async function logoUrl(key?: string): Promise<string | null> {
  if (!key) return null;
  if (/^https?:\/\//.test(key)) return key;
  if (!isS3Configured()) return null;
  try { return (await getPresignedUrl(key, { expiresIn: 86_400 })).url; } catch { return null; }
}

export async function lookupInstitution(req: Request, res: Response, next: NextFunction) {
  try {
    const cfg = await lookupInstitutionByCode(String(req.params.code ?? ''));
    if (!cfg) throw new MobileApiError(404, 'NOT_FOUND', "We couldn't find that college code.");
    res.json({
      collegeId: cfg.collegeId, name: cfg.name, logoUrl: await logoUrl(cfg.logo), accentColor: cfg.accentColor ?? null,
      paused: cfg.paused, pausedMessage: cfg.pausedMessage ?? null, minAppVersion: cfg.minAppVersion ?? null,
    });
  } catch (e) { next(e); }
}

export async function getConfig(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    const ctx = requireMobile(req);
    const cfg = await getJuviConfig(ctx.collegeId);
    if (!cfg) throw new MobileApiError(404, 'NOT_FOUND', 'Institution not found');
    res.json({
      name: cfg.name, code: cfg.code, logoUrl: await logoUrl(cfg.logo), accentColor: cfg.accentColor ?? null,
      supportContact: cfg.supportContact ?? null, quietHoursDefault: cfg.quietHoursDefault, timezone: cfg.timezone,
      featureFlags: cfg.featureFlags, minAppVersion: cfg.minAppVersion ?? null, onboardingSteps: [...ONBOARDING_STEPS],
    });
  } catch (e) { next(e); }
}
