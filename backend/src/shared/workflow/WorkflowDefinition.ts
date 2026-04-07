// ─── Workflow Definition Types ──────────────────────────────
// Lightweight state-machine definitions for Juvion workflows.
// Each workflow (W01–W10) is defined as a set of phases, steps, and transitions.

export type WorkflowStatus = 'active' | 'completed' | 'cancelled' | 'suspended' | 'failed';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'blocked';
export type TaskType = 'manual' | 'automated' | 'approval' | 'parallel_group';

export interface WorkflowTransition {
  from: string;
  to: string;
  event: string;
  guard?: string;   // name of a guard function to evaluate
  action?: string;  // name of a side-effect action to fire
}

export interface WorkflowStepDef {
  id: string;
  name: string;
  phase: string;
  type: TaskType;
  assigneeRole?: string;           // e.g. 'admissions_staff', 'hod', 'principal'
  aiAutonomy?: 'autonomous' | 'flags_for_review' | 'assists' | 'none';
  requiredFields?: string[];       // entity fields that must exist before step can start
  timeout?: number;                // max duration in hours
  parallelSteps?: string[];        // for parallel_group type: sub-steps that run concurrently
  onComplete?: string;             // event name emitted on completion
  onFail?: string;                 // event name emitted on failure
  metadata?: Record<string, any>;
}

export interface WorkflowPhaseDef {
  id: string;
  name: string;
  description: string;
  order: number;
  steps: WorkflowStepDef[];
}

export interface WorkflowDefinition {
  id: string;                      // e.g. 'W01'
  name: string;                    // e.g. 'Student Intake & Onboarding'
  version: number;
  entityType: string;              // primary entity: 'Applicant', 'Employee', etc.
  phases: WorkflowPhaseDef[];
  transitions: WorkflowTransition[];
  initialStep: string;
  terminalSteps: string[];         // step IDs that mark workflow as complete
}

// Registry of all workflow definitions
const registry = new Map<string, WorkflowDefinition>();

export function registerWorkflow(def: WorkflowDefinition): void {
  registry.set(`${def.id}:v${def.version}`, def);
  // Also register as latest
  registry.set(def.id, def);
}

export function getWorkflowDef(id: string, version?: number): WorkflowDefinition | undefined {
  if (version) return registry.get(`${id}:v${version}`);
  return registry.get(id);
}

export function listWorkflowDefs(): WorkflowDefinition[] {
  // Return only latest (non-versioned keys)
  const seen = new Set<string>();
  const result: WorkflowDefinition[] = [];
  for (const [key, def] of registry) {
    if (!key.includes(':v') && !seen.has(def.id)) {
      seen.add(def.id);
      result.push(def);
    }
  }
  return result;
}
