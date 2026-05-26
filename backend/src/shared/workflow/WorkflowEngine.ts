// ─── Workflow Engine ────────────────────────────────────────
// Lightweight state-machine that drives workflow instances through
// their defined phases and steps. Emits events for cross-module orchestration.

import { WorkflowInstance, IWorkflowInstance } from '../../models/workflow/WorkflowInstance';
import { WorkflowTask, IWorkflowTask } from '../../models/workflow/WorkflowTask';
import { getWorkflowDef, WorkflowStepDef, WorkflowStatus } from './WorkflowDefinition';
import { executeWorkflowStepHandler } from './StepHandlers';
import { eventBus } from '../events';
import { createAuditLog } from '../audit';
import { AppError } from '../../middleware/errorHandler';

export interface StartWorkflowInput {
  workflowId: string;              // e.g. 'W01'
  entityType: string;              // e.g. 'Applicant'
  entityId: string;
  collegeId: string;
  academicYearId?: string;
  initiatedBy: string;
  metadata?: Record<string, any>;
}

export interface CompleteTaskInput {
  taskId: string;
  collegeId: string;
  completedBy: string;
  result?: Record<string, any>;
  notes?: string;
}

export interface TriggerWorkflowStepInput {
  instanceId: string;
  collegeId: string;
  stepId: string;
  triggeredBy: string;
  metadata?: Record<string, any>;
  notes?: string;
}

// ─── Start a new workflow instance ──────────────────────────
export async function startWorkflow(input: StartWorkflowInput): Promise<IWorkflowInstance> {
  const def = getWorkflowDef(input.workflowId);
  if (!def) throw new AppError(400, `Workflow definition '${input.workflowId}' not found`);

  const initialStep = def.phases.flatMap(p => p.steps).find(s => s.id === def.initialStep);
  if (!initialStep) throw new AppError(500, `Initial step '${def.initialStep}' not found in workflow '${input.workflowId}'`);

  const instance = await WorkflowInstance.create({
    collegeId: input.collegeId,
    workflowId: def.id,
    workflowVersion: def.version,
    entityType: input.entityType,
    entityId: input.entityId,
    academicYearId: input.academicYearId,
    currentPhase: initialStep.phase,
    currentStep: initialStep.id,
    status: 'active',
    initiatedBy: input.initiatedBy,
    metadata: input.metadata || {},
    history: [{ step: initialStep.id, status: 'in_progress', at: new Date(), by: input.initiatedBy }],
  });

  // Create the first task
  await createTask(instance, initialStep, input.initiatedBy);

  await createAuditLog({
    collegeId: input.collegeId,
    entityType: 'WorkflowInstance',
    entityId: String(instance._id),
    entityName: `${def.name} - ${input.entityType}`,
    action: 'create',
    changes: [],
    performedBy: input.initiatedBy,
  });

  eventBus.emit('workflow:started', {
    instanceId: instance._id,
    workflowId: def.id,
    entityType: input.entityType,
    entityId: input.entityId,
    collegeId: input.collegeId,
  });

  return instance;
}

// ─── Complete a task and advance the workflow ────────────────
export async function completeTask(input: CompleteTaskInput): Promise<{ task: IWorkflowTask; instance: IWorkflowInstance }> {
  const task = await WorkflowTask.findOne({ _id: input.taskId, collegeId: input.collegeId });
  if (!task) throw new AppError(404, 'Task not found');
  if (task.status === 'completed') throw new AppError(400, 'Task already completed');

  const instance = await WorkflowInstance.findById(task.workflowInstanceId);
  if (!instance) throw new AppError(500, 'Workflow instance not found for task');

  const def = getWorkflowDef(instance.workflowId, instance.workflowVersion);
  if (!def) throw new AppError(500, 'Workflow definition not found');

  // Mark task complete
  task.status = 'completed';
  task.completedAt = new Date();
  task.completedBy = input.completedBy;
  task.result = input.result || {};
  task.notes = input.notes;
  await task.save();

  let handlerOutcome: Awaited<ReturnType<typeof executeWorkflowStepHandler>>;
  try {
    handlerOutcome = await executeWorkflowStepHandler(def.id, task.stepId, {
      instance,
      task,
      result: task.result || {},
      completedBy: input.completedBy,
    });
    if (handlerOutcome?.result) {
      task.result = handlerOutcome.result;
      await task.save();
    }
  } catch (handlerErr) {
    task.status = 'failed';
    task.result = {
      ...(task.result || {}),
      handlerError: handlerErr instanceof Error ? handlerErr.message : String(handlerErr),
    };
    await task.save();
    throw handlerErr;
  }

  // Record in instance history
  instance.history.push({ step: task.stepId, status: 'completed', at: new Date(), by: input.completedBy });

  // Emit step completion event
  const stepDef = def.phases.flatMap(p => p.steps).find(s => s.id === task.stepId);
  if (stepDef?.onComplete) {
    eventBus.emit(stepDef.onComplete, {
      instanceId: instance._id,
      taskId: task._id,
      entityType: instance.entityType,
      entityId: instance.entityId,
      collegeId: instance.collegeId,
      result: input.result,
    });
  }

  const parentGroupTaskId = typeof task.metadata?.parentGroupTaskId === 'string' ? task.metadata.parentGroupTaskId : undefined;
  if (parentGroupTaskId) {
    const siblingTasks = await WorkflowTask.find({
      collegeId: input.collegeId,
      workflowInstanceId: task.workflowInstanceId,
      'metadata.parentGroupTaskId': parentGroupTaskId,
    });

    if (!siblingTasks.every(t => isTerminalTaskStatus(t.status))) {
      await instance.save();
      return { task, instance };
    }

    const parentGroupTask = await WorkflowTask.findOne({ _id: parentGroupTaskId, collegeId: input.collegeId });
    if (!parentGroupTask) throw new AppError(500, 'Parallel workflow group task not found');

    if (parentGroupTask.status !== 'completed') {
      parentGroupTask.status = 'completed';
      parentGroupTask.completedAt = new Date();
      parentGroupTask.completedBy = input.completedBy;
      parentGroupTask.result = {
        completedSteps: siblingTasks.map(t => t.stepId),
      };
      await parentGroupTask.save();

      instance.history.push({ step: parentGroupTask.stepId, status: 'completed', at: new Date(), by: input.completedBy });

      // Advance ONLY once — inside the guard so concurrent sibling completions
      // don't each trigger advanceWorkflow and create duplicate next-step tasks.
      await advanceWorkflow(instance, def, parentGroupTask.stepId, parentGroupTask.result);
    }
  } else {
    // Use task.result (handler-enriched) not input.result (raw user input) —
    // guards like all_documents_verified depend on fields the handler computes.
    await advanceWorkflow(instance, def, task.stepId, task.result);
  }

  return { task, instance };
}

// ─── Trigger an optional step on an existing workflow ──────
export async function triggerWorkflowStep(input: TriggerWorkflowStepInput): Promise<{ task: IWorkflowTask; instance: IWorkflowInstance }> {
  const instance = await WorkflowInstance.findOne({ _id: input.instanceId, collegeId: input.collegeId });
  if (!instance) throw new AppError(404, 'Workflow instance not found');

  const def = getWorkflowDef(instance.workflowId, instance.workflowVersion);
  if (!def) throw new AppError(500, 'Workflow definition not found');

  const stepDef = def.phases.flatMap((phase) => phase.steps).find((step) => step.id === input.stepId);
  if (!stepDef) throw new AppError(404, `Workflow step '${input.stepId}' not found`);

  const existingOpenTask = await WorkflowTask.findOne({
    collegeId: input.collegeId,
    workflowInstanceId: instance._id,
    stepId: input.stepId,
    status: { $in: ['pending', 'in_progress', 'blocked'] },
  });
  if (existingOpenTask) {
    throw new AppError(400, `Step '${input.stepId}' is already active for this workflow`);
  }

  const existingCompletedTask = await WorkflowTask.findOne({
    collegeId: input.collegeId,
    workflowInstanceId: instance._id,
    stepId: input.stepId,
    status: 'completed',
  });
  if (existingCompletedTask) {
    throw new AppError(400, `Step '${input.stepId}' has already been completed for this workflow`);
  }

  instance.status = 'active';
  instance.completedAt = undefined;
  instance.currentPhase = stepDef.phase;
  instance.currentStep = stepDef.id;
  instance.metadata = {
    ...(instance.metadata || {}),
    ...(input.metadata || {}),
  };
  instance.history.push({
    step: stepDef.id,
    status: 'in_progress',
    at: new Date(),
    by: input.triggeredBy,
    ...(input.notes ? { notes: input.notes } : {}),
  });
  await instance.save();

  const task = await createTask(instance, stepDef, input.triggeredBy);
  if (input.notes || (input.metadata && Object.keys(input.metadata).length > 0)) {
    task.notes = input.notes;
    task.metadata = {
      ...(task.metadata || {}),
      ...(input.metadata || {}),
      triggeredManually: true,
    };
    await task.save();
  }

  return { task, instance };
}

// ─── Fail a task ────────────────────────────────────────────
export async function failTask(taskId: string, collegeId: string, failedBy: string, reason: string): Promise<IWorkflowTask> {
  const task = await WorkflowTask.findOne({ _id: taskId, collegeId });
  if (!task) throw new AppError(404, 'Task not found');

  task.status = 'failed';
  task.completedAt = new Date();
  task.completedBy = failedBy;
  task.notes = reason;
  await task.save();

  const instance = await WorkflowInstance.findById(task.workflowInstanceId);
  if (instance) {
    instance.history.push({ step: task.stepId, status: 'failed', at: new Date(), by: failedBy });

    const def = getWorkflowDef(instance.workflowId, instance.workflowVersion);
    const stepDef = def?.phases.flatMap(p => p.steps).find(s => s.id === task.stepId);
    if (stepDef?.onFail) {
      eventBus.emit(stepDef.onFail, {
        instanceId: instance._id,
        taskId: task._id,
        entityType: instance.entityType,
        entityId: instance.entityId,
        collegeId: instance.collegeId,
        reason,
      });
    }
    await instance.save();
  }

  return task;
}

// ─── Skip a task ────────────────────────────────────────────
export async function skipTask(taskId: string, collegeId: string, skippedBy: string, reason: string): Promise<IWorkflowTask> {
  const task = await WorkflowTask.findOne({ _id: taskId, collegeId });
  if (!task) throw new AppError(404, 'Task not found');

  task.status = 'skipped';
  task.completedAt = new Date();
  task.completedBy = skippedBy;
  task.notes = reason;
  await task.save();

  const instance = await WorkflowInstance.findById(task.workflowInstanceId);
  if (instance) {
    instance.history.push({ step: task.stepId, status: 'skipped', at: new Date(), by: skippedBy });
    await instance.save();
  }

  return task;
}

// ─── Get workflow status ────────────────────────────────────
export async function getWorkflowStatus(instanceId: string, collegeId: string) {
  const instance = await WorkflowInstance.findOne({ _id: instanceId, collegeId }).lean();
  if (!instance) throw new AppError(404, 'Workflow instance not found');

  const tasks = await WorkflowTask.find({ workflowInstanceId: instanceId, collegeId }).sort({ createdAt: 1 }).lean();

  const def = getWorkflowDef(instance.workflowId, instance.workflowVersion);

  return {
    instance,
    tasks,
    definition: def ? { id: def.id, name: def.name, phases: def.phases.map(p => ({ id: p.id, name: p.name, order: p.order })) } : null,
  };
}

// ─── List workflow instances ────────────────────────────────
export async function listWorkflowInstances(collegeId: string, filters: {
  workflowId?: string;
  entityType?: string;
  entityId?: string;
  status?: WorkflowStatus;
  page?: number;
  limit?: number;
}) {
  const filter: any = { collegeId };
  if (filters.workflowId) filter.workflowId = filters.workflowId;
  if (filters.entityType) filter.entityType = filters.entityType;
  if (filters.entityId) filter.entityId = filters.entityId;
  if (filters.status) filter.status = filters.status;

  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    WorkflowInstance.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    WorkflowInstance.countDocuments(filter),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) };
}

// ─── Helper: create a task from a step definition ───────────
async function createTask(instance: IWorkflowInstance, stepDef: WorkflowStepDef, createdBy: string): Promise<IWorkflowTask> {
  return WorkflowTask.create({
    collegeId: instance.collegeId,
    workflowInstanceId: instance._id,
    workflowId: instance.workflowId,
    stepId: stepDef.id,
    stepName: stepDef.name,
    phase: stepDef.phase,
    type: stepDef.type,
    assigneeRole: stepDef.assigneeRole,
    aiAutonomy: stepDef.aiAutonomy,
    entityType: instance.entityType,
    entityId: instance.entityId,
    status: stepDef.type === 'automated' || stepDef.type === 'parallel_group' ? 'in_progress' : 'pending',
    dueAt: stepDef.timeout ? new Date(Date.now() + stepDef.timeout * 3600000) : undefined,
    metadata: stepDef.metadata || {},
    createdBy,
  });
}

async function advanceWorkflow(
  instance: IWorkflowInstance,
  def: NonNullable<ReturnType<typeof getWorkflowDef>>,
  completedStepId: string,
  result?: Record<string, any>,
): Promise<void> {
  const nextTransition = getNextTransition(def, completedStepId, instance.metadata, result);

  if (!nextTransition || def.terminalSteps.includes(completedStepId)) {
    instance.status = isCancellationTerminalStep(def, completedStepId) ? 'cancelled' : 'completed';
    instance.completedAt = new Date();
    instance.currentStep = completedStepId;
    await instance.save();

    eventBus.emit('workflow:completed', {
      instanceId: instance._id,
      workflowId: def.id,
      entityType: instance.entityType,
      entityId: instance.entityId,
      collegeId: instance.collegeId,
    });
    return;
  }

  const nextStep = def.phases.flatMap(p => p.steps).find(s => s.id === nextTransition.to);
  if (!nextStep) throw new AppError(500, `Next step '${nextTransition.to}' not found`);

  instance.currentStep = nextStep.id;
  instance.currentPhase = nextStep.phase;
  instance.history.push({ step: nextStep.id, status: 'in_progress', at: new Date(), by: 'system' });
  await instance.save();

  if (nextStep.type === 'parallel_group' && nextStep.parallelSteps?.length) {
    const groupTask = await createTask(instance, nextStep, 'system');
    for (const subStepId of nextStep.parallelSteps) {
      const subStep = def.phases.flatMap(p => p.steps).find(s => s.id === subStepId);
      if (!subStep) continue;
      await createTask(instance, {
        ...subStep,
        metadata: {
          ...(subStep.metadata || {}),
          parentGroupTaskId: String(groupTask._id),
          parentGroupStepId: nextStep.id,
        },
      }, 'system');
    }
    return;
  }

  await createTask(instance, nextStep, 'system');
}

function getNextTransition(
  def: NonNullable<ReturnType<typeof getWorkflowDef>>,
  stepId: string,
  instanceMetadata: Record<string, any>,
  result?: Record<string, any>,
) {
  return def.transitions.find((transition) => (
    transition.from === stepId
    && transition.event === 'complete'
    && evaluateGuard(transition.guard, instanceMetadata, result)
  ));
}

function evaluateGuard(
  guard: string | undefined,
  instanceMetadata: Record<string, any>,
  result?: Record<string, any>,
): boolean {
  if (!guard) return true;

  const context = {
    ...(instanceMetadata || {}),
    ...(result || {}),
  };

  switch (guard) {
    case 'has_flagged_documents':
      return context.hasFlaggedDocuments === true || Number(context.flaggedDocumentsCount || 0) > 0;
    case 'all_documents_verified':
      if (context.allDocumentsVerified === true) return true;
      if (context.hasFlaggedDocuments === false) return true;
      if (context.flaggedDocumentsCount !== undefined) return Number(context.flaggedDocumentsCount) === 0;
      return false;
    case 'is_edge_case':
      return context.isEdgeCase === true;
    case 'is_eligible':
      return context.isEligible === true || context.eligibilityStatus === 'eligible';
    case 'negotiation_requested':
      return context.negotiationRequested === true;
    case 'no_negotiation':
      if (context.noNegotiation === true) return true;
      if (context.negotiationRequested === false) return true;
      return context.negotiationRequested === undefined;
    default:
      return Boolean(context[guard]);
  }
}

function isTerminalTaskStatus(status: string): boolean {
  return ['completed', 'failed', 'skipped'].includes(status);
}

function isCancellationTerminalStep(
  def: NonNullable<ReturnType<typeof getWorkflowDef>>,
  stepId: string,
): boolean {
  if (!def.terminalSteps.includes(stepId)) return false;

  const step = def.phases.flatMap((phase) => phase.steps).find((item) => item.id === stepId);
  return step?.phase === 'M01.6_CANCEL';
}
