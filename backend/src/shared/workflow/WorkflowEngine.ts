// ─── Workflow Engine ────────────────────────────────────────
// Lightweight state-machine that drives workflow instances through
// their defined phases and steps. Emits events for cross-module orchestration.

import { WorkflowInstance, IWorkflowInstance } from '../../models/workflow/WorkflowInstance';
import { WorkflowTask, IWorkflowTask } from '../../models/workflow/WorkflowTask';
import { getWorkflowDef, WorkflowStepDef, WorkflowStatus } from './WorkflowDefinition';
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

  // Find next step via transitions
  const nextTransition = def.transitions.find(t => t.from === task.stepId && t.event === 'complete');

  if (!nextTransition || def.terminalSteps.includes(task.stepId)) {
    // Workflow complete
    instance.status = 'completed';
    instance.completedAt = new Date();
    instance.currentStep = task.stepId;
    await instance.save();

    eventBus.emit('workflow:completed', {
      instanceId: instance._id,
      workflowId: def.id,
      entityType: instance.entityType,
      entityId: instance.entityId,
      collegeId: instance.collegeId,
    });
  } else {
    // Advance to next step
    const nextStep = def.phases.flatMap(p => p.steps).find(s => s.id === nextTransition.to);
    if (!nextStep) throw new AppError(500, `Next step '${nextTransition.to}' not found`);

    instance.currentStep = nextStep.id;
    instance.currentPhase = nextStep.phase;
    instance.history.push({ step: nextStep.id, status: 'in_progress', at: new Date(), by: 'system' });
    await instance.save();

    // Create the next task(s)
    if (nextStep.type === 'parallel_group' && nextStep.parallelSteps?.length) {
      for (const subStepId of nextStep.parallelSteps) {
        const subStep = def.phases.flatMap(p => p.steps).find(s => s.id === subStepId);
        if (subStep) await createTask(instance, subStep, 'system');
      }
    } else {
      await createTask(instance, nextStep, 'system');
    }
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
    status: stepDef.type === 'automated' ? 'in_progress' : 'pending',
    dueAt: stepDef.timeout ? new Date(Date.now() + stepDef.timeout * 3600000) : undefined,
    metadata: stepDef.metadata || {},
    createdBy,
  });
}
