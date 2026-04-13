import { Policy } from '../../models/platform/Policy';

interface CreatePolicyOpts {
  role: string;
  module: string;
  action: string;
  effect: 'allow' | 'deny';
  personaType?: string;
  scope?: { departmentOnly?: boolean; selfOnly?: boolean; subDomain?: string };
  priority?: number;
  description?: string;
}

export async function createTestPolicy(collegeId: string, opts: CreatePolicyOpts) {
  return Policy.create({
    collegeId,
    role: opts.role,
    personaType: opts.personaType ?? null,
    module: opts.module,
    action: opts.action,
    effect: opts.effect,
    scope: opts.scope,
    priority: opts.priority ?? 650,
    description: opts.description ?? `Test policy: ${opts.role} ${opts.effect} ${opts.module}:${opts.action}`,
    isActive: true,
    createdBy: 'test',
  });
}
