import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
import {
  createCommitteeSchema, updateCommitteeSchema,
  createMeetingSchema, updateMeetingSchema,
  createPolicySchema, updatePolicySchema,
  createBoardMemberSchema, updateBoardMemberSchema,
  createGoalSchema, updateGoalSchema,
} from './validation';

const router = Router();
router.use(authenticate);

// Dashboard
router.get('/stats', authorize('governance', 'read'), ctrl.dashboardStats);

// Committees
router.get('/committees', authorize('governance', 'read'), ctrl.listCommittees);
router.get('/committees/:id', authorize('governance', 'read'), ctrl.getCommittee);
router.post('/committees', authorize('governance', 'create'), validate(createCommitteeSchema), ctrl.createCommittee);
router.put('/committees/:id', authorize('governance', 'update'), validate(updateCommitteeSchema), ctrl.updateCommittee);
router.delete('/committees/:id', authorize('governance', 'delete'), ctrl.deleteCommittee);

// Committee Meetings
router.get('/meetings', authorize('governance', 'read'), ctrl.listMeetings);
router.get('/meetings/:id', authorize('governance', 'read'), ctrl.getMeeting);
router.post('/meetings', authorize('governance', 'create'), validate(createMeetingSchema), ctrl.createMeeting);
router.put('/meetings/:id', authorize('governance', 'update'), validate(updateMeetingSchema), ctrl.updateMeeting);
router.delete('/meetings/:id', authorize('governance', 'delete'), ctrl.deleteMeeting);

// Policies
router.get('/policies', authorize('governance', 'read'), ctrl.listPolicies);
router.get('/policies/:id', authorize('governance', 'read'), ctrl.getPolicy);
router.post('/policies', authorize('governance', 'create'), validate(createPolicySchema), ctrl.createPolicy);
router.put('/policies/:id', authorize('governance', 'update'), validate(updatePolicySchema), ctrl.updatePolicy);
router.delete('/policies/:id', authorize('governance', 'delete'), ctrl.deletePolicy);

// Governing Body Members
router.get('/board-members', authorize('governance', 'read'), ctrl.listBoardMembers);
router.get('/board-members/:id', authorize('governance', 'read'), ctrl.getBoardMember);
router.post('/board-members', authorize('governance', 'create'), validate(createBoardMemberSchema), ctrl.createBoardMember);
router.put('/board-members/:id', authorize('governance', 'update'), validate(updateBoardMemberSchema), ctrl.updateBoardMember);
router.delete('/board-members/:id', authorize('governance', 'delete'), ctrl.deleteBoardMember);

// Strategic Goals
router.get('/goals', authorize('governance', 'read'), ctrl.listGoals);
router.get('/goals/:id', authorize('governance', 'read'), ctrl.getGoal);
router.post('/goals', authorize('governance', 'create'), validate(createGoalSchema), ctrl.createGoal);
router.put('/goals/:id', authorize('governance', 'update'), validate(updateGoalSchema), ctrl.updateGoal);
router.delete('/goals/:id', authorize('governance', 'delete'), ctrl.deleteGoal);

export default router;
