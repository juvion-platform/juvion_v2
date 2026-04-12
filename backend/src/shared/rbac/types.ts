export interface PolicyDoc {
  _id?: string;
  collegeId?: string;          // null = system default
  role: string;                // 'super_admin' | 'admin' | ... | '*'
  personaType?: string | null; // 'ST-WARDEN' | 'F-HOD-*' | null
  module: string;              // 'finance' | '*'
  action: string;              // 'read' | 'create' | 'update' | 'delete' | 'approve' | '*'
  effect: 'allow' | 'deny';
  scope?: PolicyScope;
  priority: number;
  description?: string;
  isActive: boolean;
}

export interface PolicyScope {
  departmentOnly?: boolean;
  selfOnly?: boolean;
  subDomain?: string;          // comma-separated: 'hostel,mess'
}

export interface AuthScope {
  departmentOnly: boolean;
  departmentId?: string;
  selfOnly: boolean;
  userId: string;
  personId?: string;
  subDomain?: string[];
  resolvedPermissions: string[];
}

export interface RbacOptions {
  subDomain?: string;
}
