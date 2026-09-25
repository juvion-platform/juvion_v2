import { useAuthStore } from '../stores/authStore';

export function usePermission(module: string, action: string, subDomain?: string): boolean {
  return useAuthStore((s) => s.hasPermission(module, action, subDomain));
}

export function useCanRead(module: string): boolean {
  return usePermission(module, 'read');
}

export function useCanWrite(module: string): boolean {
  return usePermission(module, 'create');
}

/** 010 P3 — may this user see a sensitivity class (e.g. 'hr.compensation') in a module? */
export function useCanSeeClass(module: string, cls: string): boolean {
  return useAuthStore((s) => s.canSeeClass(module, cls));
}
