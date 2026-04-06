import { z } from 'zod';

// ═══ Conversations ═══════════════════════════════════════

export const createConversationSchema = z.object({
  userId: z.string().min(1),
  personaType: z.string().min(1),
  startedAt: z.string().optional(),
  lastMessageAt: z.string().optional(),
  messageCount: z.number().int().min(0).optional(),
  status: z.enum(['active', 'closed', 'archived']).optional(),
});
export const updateConversationSchema = createConversationSchema.partial();

// ═══ Messages ════════════════════════════════════════════

export const createMessageSchema = z.object({
  conversationId: z.string().min(1),
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string().min(1),
  intent: z.string().optional(),
  entities: z.any().optional(),
  toolCalls: z.array(z.object({
    tool: z.string().min(1),
    params: z.any().optional(),
    result: z.any().optional(),
  })).optional(),
  tokens: z.number().int().min(0).optional(),
});
export const updateMessageSchema = createMessageSchema.partial();

// ═══ Actions ═════════════════════════════════════════════

export const createActionSchema = z.object({
  conversationId: z.string().min(1),
  actionType: z.enum(['query', 'create', 'update', 'delete', 'navigate', 'report']),
  module: z.string().min(1),
  entity: z.string().min(1),
  operation: z.string().min(1),
  payload: z.any().optional(),
  result: z.any().optional(),
  status: z.enum(['pending', 'executed', 'failed', 'rolled_back']).optional(),
  executedAt: z.string().optional(),
});
export const updateActionSchema = createActionSchema.partial();

// ═══ Insights ════════════════════════════════════════════

export const createInsightSchema = z.object({
  type: z.enum(['anomaly', 'trend', 'prediction', 'recommendation', 'alert']),
  module: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  data: z.any().optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  targetPersonas: z.array(z.string()).optional(),
  isActionable: z.boolean().optional(),
  actionSuggestion: z.string().optional(),
  generatedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  status: z.enum(['new', 'seen', 'acted_upon', 'dismissed', 'expired']).optional(),
});
export const updateInsightSchema = createInsightSchema.partial();

// ═══ Knowledge Base ══════════════════════════════════════

export const createKnowledgeBaseSchema = z.object({
  category: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
  isActive: z.boolean().optional(),
  usageCount: z.number().int().min(0).optional(),
});
export const updateKnowledgeBaseSchema = createKnowledgeBaseSchema.partial();

// ═══ Persona Configs ═════════════════════════════════════

export const createPersonaConfigSchema = z.object({
  personaType: z.string().min(1),
  displayName: z.string().min(1),
  systemPrompt: z.string().min(1),
  availableModules: z.array(z.string()).optional(),
  availableActions: z.array(z.string()).optional(),
  maxTokensPerResponse: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});
export const updatePersonaConfigSchema = createPersonaConfigSchema.partial();

// ═══ Feedback ════════════════════════════════════════════

export const createFeedbackSchema = z.object({
  messageId: z.string().min(1),
  userId: z.string().min(1),
  rating: z.number().min(-1).max(1),
  feedback: z.string().optional(),
});
export const updateFeedbackSchema = createFeedbackSchema.partial();

// ═══ Usage Metrics ═══════════════════════════════════════

export const createUsageMetricSchema = z.object({
  date: z.string().min(1),
  personaType: z.string().min(1),
  totalConversations: z.number().int().min(0).optional(),
  totalMessages: z.number().int().min(0).optional(),
  totalTokens: z.number().int().min(0).optional(),
  avgResponseTime: z.number().min(0).optional(),
  satisfactionScore: z.number().min(0).optional(),
  topIntents: z.array(z.object({
    intent: z.string().min(1),
    count: z.number().int().min(0),
  })).optional(),
});
export const updateUsageMetricSchema = createUsageMetricSchema.partial();
