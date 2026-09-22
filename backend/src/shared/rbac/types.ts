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

export type AssignedVia = 'mentees' | 'sections' | 'courses';

export interface PolicyScope {
  departmentOnly?: boolean;
  selfOnly?: boolean;
  subDomain?: string;          // comma-separated: 'hostel,mess'
  /** 010 P2 — relationship resolvers that narrow rows to "my" students/sections/courses. */
  assignedVia?: AssignedVia[];
  /** 010 P3 — sensitivity classes the persona may see. undefined = all, [] = none. */
  sensitivity?: string[];
}

/** Ids a person reaches through their assignments (resolved once per request, cached per person). */
export interface AssignedIds {
  studentIds: string[];
  sectionIds: string[];
  courseOfferingIds: string[];
}

export interface AuthScope {
  departmentOnly: boolean;
  departmentId?: string;
  /** Branches under `departmentId`; used for student-shaped rows keyed by `branchId`. */
  branchIds?: string[];
  selfOnly: boolean;
  userId: string;
  personId?: string;
  subDomain?: string[];
  assignedVia?: AssignedVia[];
  assigned?: AssignedIds;
  /** Classes the caller may see; undefined = unrestricted. */
  sensitivity?: string[];
  resolvedPermissions: string[];
}

export interface RbacOptions {
  subDomain?: string;
}
