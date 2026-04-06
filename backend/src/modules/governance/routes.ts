import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
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
router.get('/stats', ctrl.dashboardStats);

// Committees
router.get('/committees', ctrl.listCommittees);
router.get('/committees/:id', ctrl.getCommittee);
router.post('/committees', validate(createCommitteeSchema), ctrl.createCommittee);
router.put('/committees/:id', validate(updateCommitteeSchema), ctrl.updateCommittee);
router.delete('/committees/:id', ctrl.deleteCommittee);

// Committee Meetings
router.get('/meetings', ctrl.listMeetings);
router.get('/meetings/:id', ctrl.getMeeting);
router.post('/meetings', validate(createMeetingSchema), ctrl.createMeeting);
router.put('/meetings/:id', validate(updateMeetingSchema), ctrl.updateMeeting);
router.delete('/meetings/:id', ctrl.deleteMeeting);

// Policies
router.get('/policies', ctrl.listPolicies);
router.get('/policies/:id', ctrl.getPolicy);
router.post('/policies', validate(createPolicySchema), ctrl.createPolicy);
router.put('/policies/:id', validate(updatePolicySchema), ctrl.updatePolicy);
router.delete('/policies/:id', ctrl.deletePolicy);

// Governing Body Members
router.get('/board-members', ctrl.listBoardMembers);
router.get('/board-members/:id', ctrl.getBoardMember);
router.post('/board-members', validate(createBoardMemberSchema), ctrl.createBoardMember);
router.put('/board-members/:id', validate(updateBoardMemberSchema), ctrl.updateBoardMember);
router.delete('/board-members/:id', ctrl.deleteBoardMember);

// Strategic Goals
router.get('/goals', ctrl.listGoals);
router.get('/goals/:id', ctrl.getGoal);
router.post('/goals', validate(createGoalSchema), ctrl.createGoal);
router.put('/goals/:id', validate(updateGoalSchema), ctrl.updateGoal);
router.delete('/goals/:id', ctrl.deleteGoal);

export default router;
