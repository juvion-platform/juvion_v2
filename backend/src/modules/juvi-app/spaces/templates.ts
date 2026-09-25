import { TemplateCode, ChannelScopeType, ReplyRule, ChannelPriority, ArchiveRule } from '../../../models/juvi/ChannelTemplate';

export interface TemplateDef {
  code: TemplateCode;
  name: string;
  namePattern: string;
  aboutPattern: string;
  scopeType: ChannelScopeType;
  membershipStrategy: TemplateCode;
  postingRule: 'publishers_only';
  replyRule: ReplyRule;
  defaultPriority: ChannelPriority;
  archiveRule: ArchiveRule;
}

/** Spec §9. D4: College is announcement-only; everything else allows replies. */
export const DEFAULT_CHANNEL_TEMPLATES: readonly TemplateDef[] = [
  { code: 'college', name: 'College', namePattern: '{{college.name}}', aboutPattern: 'Official notices and announcements for everyone at {{college.name}}. Published by the college office.', scopeType: 'college', membershipStrategy: 'college', postingRule: 'publishers_only', replyRule: 'announcement_only', defaultPriority: 'important', archiveRule: 'never' },
  { code: 'department', name: 'Department', namePattern: '{{department.name}}', aboutPattern: 'Everything from the {{department.name}} department. Published by the HOD and the office.', scopeType: 'department', membershipStrategy: 'department', postingRule: 'publishers_only', replyRule: 'allowed', defaultPriority: 'important', archiveRule: 'never' },
  { code: 'batch', name: 'Batch', namePattern: '{{batch.code}} Batch', aboutPattern: 'Everything for the {{batch.code}} batch. Published by class coordinators, the HOD and the registrar.', scopeType: 'batch', membershipStrategy: 'batch', postingRule: 'publishers_only', replyRule: 'allowed', defaultPriority: 'routine', archiveRule: 'never' },
  { code: 'course', name: 'Course', namePattern: '{{course.code}} {{course.name}} · {{section.name}}', aboutPattern: '{{course.code}} {{course.name}} for section {{section.name}}. Published by the course faculty.', scopeType: 'course_offering', membershipStrategy: 'course', postingRule: 'publishers_only', replyRule: 'allowed', defaultPriority: 'routine', archiveRule: 'on_semester_end' },
  { code: 'hostel', name: 'Hostel', namePattern: '{{block.name}} Hostel', aboutPattern: 'Notices for residents of {{block.name}}. Published by the wardens.', scopeType: 'hostel_block', membershipStrategy: 'hostel', postingRule: 'publishers_only', replyRule: 'allowed', defaultPriority: 'routine', archiveRule: 'never' },
];

export function renderPattern(pattern: string, vars: Record<string, string | undefined>): string {
  return pattern
    .replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, key: string) => vars[key] ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
