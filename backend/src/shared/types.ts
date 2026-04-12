import { Request } from 'express';
import { AuthScope } from './rbac/types';

export interface AuthRequest extends Request {
  collegeId?: string;
  user?: { id: string; name: string; email: string; role: string; personaType: string };
  authScope?: AuthScope;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface AuditEntry {
  collegeId: string;
  entityType: string;
  entityId: string;
  entityName: string;
  action: 'create' | 'update' | 'delete';
  changes: FieldChange[];
  performedBy: string;
  studentId?: string;
}

export interface FieldChange {
  field: string;
  displayName: string;
  oldValue: any;
  newValue: any;
}
