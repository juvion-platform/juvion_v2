import { useAuthStore } from '../stores/authStore';

export function usePermission(module: string, action: string): boolean {
  return useAuthStore((s) => s.hasPermission(module, action));
}

export function useCanRead(module: string): boolean {
  return usePermission(module, 'read');
}

export function useCanWrite(module: string): boolean {
  return usePermission(module, 'create');
}
