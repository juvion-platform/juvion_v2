import { NextFunction, Request, Response } from 'express';

import { requireMobile } from '../middleware/authenticate-mobile';
import { homeTeaching, homeToday, meAcademics } from './service';

export async function today(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await homeToday(requireMobile(req)));
  } catch (e) { next(e); }
}

export async function teaching(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await homeTeaching(requireMobile(req)));
  } catch (e) { next(e); }
}

export async function academics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await meAcademics(requireMobile(req)));
  } catch (e) { next(e); }
}
