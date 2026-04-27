import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
import financeAgentRouter from './finance-agent/routes';
import {
  createConversationSchema, updateConversationSchema,
  createMessageSchema, updateMessageSchema,
  createActionSchema, updateActionSchema,
  createInsightSchema, updateInsightSchema,
  createKnowledgeBaseSchema, updateKnowledgeBaseSchema,
  createPersonaConfigSchema, updatePersonaConfigSchema,
  createFeedbackSchema, updateFeedbackSchema,
  createUsageMetricSchema, updateUsageMetricSchema,
} from './validation';

const router = Router();

// Task A5 — fee-analytics-ai-native finance agent (7 endpoints under
// /api/juvi/finance-agent/*). Mounted FIRST so its own `authenticate`
// + per-route `authorize()` chain is what runs for those paths; the
// outer juvi `authenticate` below still works for the legacy CRUD.
router.use('/finance-agent', financeAgentRouter);

router.use(authenticate);

// Dashboard
router.get('/stats', authorize('juvi', 'read'), ctrl.dashboardStats);

// Conversations
router.get('/conversations', authorize('juvi', 'read'), ctrl.listConversations);
router.get('/conversations/:id', authorize('juvi', 'read'), ctrl.getConversation);
router.post('/conversations', authorize('juvi', 'create'), validate(createConversationSchema), ctrl.createConversation);
router.put('/conversations/:id', authorize('juvi', 'update'), validate(updateConversationSchema), ctrl.updateConversation);
router.delete('/conversations/:id', authorize('juvi', 'delete'), ctrl.deleteConversation);

// Messages
router.get('/messages', authorize('juvi', 'read'), ctrl.listMessages);
router.get('/messages/:id', authorize('juvi', 'read'), ctrl.getMessage);
router.post('/messages', authorize('juvi', 'create'), validate(createMessageSchema), ctrl.createMessage);
router.put('/messages/:id', authorize('juvi', 'update'), validate(updateMessageSchema), ctrl.updateMessage);
router.delete('/messages/:id', authorize('juvi', 'delete'), ctrl.deleteMessage);

// Actions
router.get('/actions', authorize('juvi', 'read'), ctrl.listActions);
router.get('/actions/:id', authorize('juvi', 'read'), ctrl.getAction);
router.post('/actions', authorize('juvi', 'create'), validate(createActionSchema), ctrl.createAction);
router.put('/actions/:id', authorize('juvi', 'update'), validate(updateActionSchema), ctrl.updateAction);
router.delete('/actions/:id', authorize('juvi', 'delete'), ctrl.deleteAction);

// Insights
router.get('/insights', authorize('juvi', 'read'), ctrl.listInsights);
router.get('/insights/:id', authorize('juvi', 'read'), ctrl.getInsight);
router.post('/insights', authorize('juvi', 'create'), validate(createInsightSchema), ctrl.createInsight);
router.put('/insights/:id', authorize('juvi', 'update'), validate(updateInsightSchema), ctrl.updateInsight);
router.delete('/insights/:id', authorize('juvi', 'delete'), ctrl.deleteInsight);

// Knowledge Base
router.get('/knowledge-base', authorize('juvi', 'read'), ctrl.listKnowledgeBase);
router.get('/knowledge-base/:id', authorize('juvi', 'read'), ctrl.getKnowledgeBase);
router.post('/knowledge-base', authorize('juvi', 'create'), validate(createKnowledgeBaseSchema), ctrl.createKnowledgeBase);
router.put('/knowledge-base/:id', authorize('juvi', 'update'), validate(updateKnowledgeBaseSchema), ctrl.updateKnowledgeBase);
router.delete('/knowledge-base/:id', authorize('juvi', 'delete'), ctrl.deleteKnowledgeBase);

// Persona Configs
router.get('/persona-configs', authorize('juvi', 'read'), ctrl.listPersonaConfigs);
router.get('/persona-configs/:id', authorize('juvi', 'read'), ctrl.getPersonaConfig);
router.post('/persona-configs', authorize('juvi', 'create'), validate(createPersonaConfigSchema), ctrl.createPersonaConfig);
router.put('/persona-configs/:id', authorize('juvi', 'update'), validate(updatePersonaConfigSchema), ctrl.updatePersonaConfig);
router.delete('/persona-configs/:id', authorize('juvi', 'delete'), ctrl.deletePersonaConfig);

// Feedback
router.get('/feedback', authorize('juvi', 'read'), ctrl.listFeedback);
router.get('/feedback/:id', authorize('juvi', 'read'), ctrl.getFeedback);
router.post('/feedback', authorize('juvi', 'create'), validate(createFeedbackSchema), ctrl.createFeedback);
router.put('/feedback/:id', authorize('juvi', 'update'), validate(updateFeedbackSchema), ctrl.updateFeedback);
router.delete('/feedback/:id', authorize('juvi', 'delete'), ctrl.deleteFeedback);

// Usage Metrics
router.get('/usage-metrics', authorize('juvi', 'read'), ctrl.listUsageMetrics);
router.get('/usage-metrics/:id', authorize('juvi', 'read'), ctrl.getUsageMetric);
router.post('/usage-metrics', authorize('juvi', 'create'), validate(createUsageMetricSchema), ctrl.createUsageMetric);
router.put('/usage-metrics/:id', authorize('juvi', 'update'), validate(updateUsageMetricSchema), ctrl.updateUsageMetric);
router.delete('/usage-metrics/:id', authorize('juvi', 'delete'), ctrl.deleteUsageMetric);

export default router;
