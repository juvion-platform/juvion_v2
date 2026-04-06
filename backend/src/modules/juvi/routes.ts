import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
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
router.use(authenticate);

// Dashboard
router.get('/stats', ctrl.dashboardStats);

// Conversations
router.get('/conversations', ctrl.listConversations);
router.get('/conversations/:id', ctrl.getConversation);
router.post('/conversations', validate(createConversationSchema), ctrl.createConversation);
router.put('/conversations/:id', validate(updateConversationSchema), ctrl.updateConversation);
router.delete('/conversations/:id', ctrl.deleteConversation);

// Messages
router.get('/messages', ctrl.listMessages);
router.get('/messages/:id', ctrl.getMessage);
router.post('/messages', validate(createMessageSchema), ctrl.createMessage);
router.put('/messages/:id', validate(updateMessageSchema), ctrl.updateMessage);
router.delete('/messages/:id', ctrl.deleteMessage);

// Actions
router.get('/actions', ctrl.listActions);
router.get('/actions/:id', ctrl.getAction);
router.post('/actions', validate(createActionSchema), ctrl.createAction);
router.put('/actions/:id', validate(updateActionSchema), ctrl.updateAction);
router.delete('/actions/:id', ctrl.deleteAction);

// Insights
router.get('/insights', ctrl.listInsights);
router.get('/insights/:id', ctrl.getInsight);
router.post('/insights', validate(createInsightSchema), ctrl.createInsight);
router.put('/insights/:id', validate(updateInsightSchema), ctrl.updateInsight);
router.delete('/insights/:id', ctrl.deleteInsight);

// Knowledge Base
router.get('/knowledge-base', ctrl.listKnowledgeBase);
router.get('/knowledge-base/:id', ctrl.getKnowledgeBase);
router.post('/knowledge-base', validate(createKnowledgeBaseSchema), ctrl.createKnowledgeBase);
router.put('/knowledge-base/:id', validate(updateKnowledgeBaseSchema), ctrl.updateKnowledgeBase);
router.delete('/knowledge-base/:id', ctrl.deleteKnowledgeBase);

// Persona Configs
router.get('/persona-configs', ctrl.listPersonaConfigs);
router.get('/persona-configs/:id', ctrl.getPersonaConfig);
router.post('/persona-configs', validate(createPersonaConfigSchema), ctrl.createPersonaConfig);
router.put('/persona-configs/:id', validate(updatePersonaConfigSchema), ctrl.updatePersonaConfig);
router.delete('/persona-configs/:id', ctrl.deletePersonaConfig);

// Feedback
router.get('/feedback', ctrl.listFeedback);
router.get('/feedback/:id', ctrl.getFeedback);
router.post('/feedback', validate(createFeedbackSchema), ctrl.createFeedback);
router.put('/feedback/:id', validate(updateFeedbackSchema), ctrl.updateFeedback);
router.delete('/feedback/:id', ctrl.deleteFeedback);

// Usage Metrics
router.get('/usage-metrics', ctrl.listUsageMetrics);
router.get('/usage-metrics/:id', ctrl.getUsageMetric);
router.post('/usage-metrics', validate(createUsageMetricSchema), ctrl.createUsageMetric);
router.put('/usage-metrics/:id', validate(updateUsageMetricSchema), ctrl.updateUsageMetric);
router.delete('/usage-metrics/:id', ctrl.deleteUsageMetric);

export default router;
