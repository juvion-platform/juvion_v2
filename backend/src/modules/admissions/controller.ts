import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as svc from './service';

const who = (req: AuthRequest) => req.user?.name || 'System';

// ─── Inquiries ───────────────────────────────────────────────
export async function listInquiries(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', status } = req.query as any;
    res.json(await svc.listInquiries(req.collegeId!, +page, +limit, status, req.authScope));
  } catch (e) { next(e); }
}

export async function getInquiry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getInquiry(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}

export async function createInquiry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createInquiry(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}

export async function updateInquiry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateInquiry(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}

export async function deleteInquiry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteInquiry(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

export async function convertInquiry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.convertInquiryToApplicant(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}

// ─── Applicants ──────────────────────────────────────────────
export async function listApplicants(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', status } = req.query as any;
    res.json(await svc.listApplicants(req.collegeId!, +page, +limit, status, req.authScope));
  } catch (e) { next(e); }
}

export async function getApplicant(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getApplicant(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}

export async function createApplicant(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createApplicant(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}

export async function updateApplicant(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateApplicant(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}

// ─── Entrance Exam Scores ────────────────────────────────────
export async function listExamScores(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', applicantId } = req.query as any;
    res.json(await svc.listExamScores(req.collegeId!, +page, +limit, applicantId, req.authScope));
  } catch (e) { next(e); }
}

export async function createExamScore(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createExamScore(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}

export async function updateExamScore(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateExamScore(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}

// ─── Counseling Allotments ───────────────────────────────────
export async function listCounselingAllotments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', applicantId } = req.query as any;
    res.json(await svc.listCounselingAllotments(req.collegeId!, +page, +limit, applicantId, req.authScope));
  } catch (e) { next(e); }
}

export async function createCounselingAllotment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createCounselingAllotment(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}

export async function updateCounselingAllotment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateCounselingAllotment(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}

// ─── Admission Offers ────────────────────────────────────────
export async function listOffers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', status } = req.query as any;
    res.json(await svc.listOffers(req.collegeId!, +page, +limit, status, req.authScope));
  } catch (e) { next(e); }
}

export async function createOffer(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createOffer(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}

export async function updateOffer(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateOffer(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}

// ─── Document Checklists ─────────────────────────────────────
export async function listDocumentChecklists(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', status } = req.query as any;
    res.json(await svc.listDocumentChecklists(req.collegeId!, +page, +limit, status, req.authScope));
  } catch (e) { next(e); }
}

export async function getDocumentChecklist(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getDocumentChecklist(req.collegeId!, req.params.applicantId as string)); } catch (e) { next(e); }
}

export async function upsertDocumentChecklist(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.upsertDocumentChecklist(req.collegeId!, req.params.applicantId as string, req.body, who(req))); } catch (e) { next(e); }
}

// ─── Admissions ──────────────────────────────────────────────
export async function listAdmissions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query as any;
    res.json(await svc.listAdmissions(req.collegeId!, +page, +limit, req.authScope));
  } catch (e) { next(e); }
}

export async function getAdmission(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getAdmission(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}

export async function createAdmission(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createAdmission(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}

// ─── Applicant Photo Upload ──────────────────────────────────
export async function uploadApplicantPhoto(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No photo file provided. Use multipart/form-data with field "photo".' });
      return;
    }
    const result = await svc.uploadApplicantPhoto(
      req.collegeId!,
      req.params.id as string,
      { buffer: req.file.buffer, mimetype: req.file.mimetype },
      who(req),
    );
    res.json(result);
  } catch (e) { next(e); }
}

// ─── Dashboard ───────────────────────────────────────────────
export async function dashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getDashboardStats(req.collegeId!)); } catch (e) { next(e); }
}
