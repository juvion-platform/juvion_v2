import { IWorkflowInstance } from '../../models/workflow/WorkflowInstance';
import { IWorkflowTask } from '../../models/workflow/WorkflowTask';

export interface WorkflowStepHandlerContext {
  instance: IWorkflowInstance;
  task: IWorkflowTask;
  result: Record<string, any>;
  completedBy: string;
}

export interface WorkflowStepHandlerOutcome {
  result?: Record<string, any>;
}

type WorkflowStepHandler = (context: WorkflowStepHandlerContext) => Promise<WorkflowStepHandlerOutcome | void>;

const registry = new Map<string, WorkflowStepHandler>();

function key(workflowId: string, stepId: string): string {
  return `${workflowId}:${stepId}`;
}

export function registerWorkflowStepHandler(workflowId: string, stepId: string, handler: WorkflowStepHandler): void {
  registry.set(key(workflowId, stepId), handler);
}

export async function executeWorkflowStepHandler(
  workflowId: string,
  stepId: string,
  context: WorkflowStepHandlerContext,
): Promise<WorkflowStepHandlerOutcome | void> {
  const handler = registry.get(key(workflowId, stepId));
  if (!handler) return;
  return handler(context);
}
