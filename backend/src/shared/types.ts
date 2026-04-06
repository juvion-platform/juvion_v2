import { Request } from 'express';

export interface AuthRequest extends Request {
  collegeId?: string;
  user?: { id: string; name: string; email: string; role: string; personaType: string };
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
