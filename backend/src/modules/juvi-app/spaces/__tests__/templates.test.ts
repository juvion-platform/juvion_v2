import { describe, it, expect } from 'vitest';
import { DEFAULT_CHANNEL_TEMPLATES, renderPattern } from '../templates';

describe('channel templates', () => {
  it('ships the five templates with the spec rules', () => {
    expect(DEFAULT_CHANNEL_TEMPLATES.map((t) => t.code)).toEqual(['college', 'department', 'batch', 'course', 'hostel']);
    const byCode = Object.fromEntries(DEFAULT_CHANNEL_TEMPLATES.map((t) => [t.code, t]));
    expect(byCode.college).toMatchObject({ scopeType: 'college', replyRule: 'announcement_only', defaultPriority: 'important', archiveRule: 'never' });
    expect(byCode.course).toMatchObject({ scopeType: 'course_offering', replyRule: 'allowed', defaultPriority: 'routine', archiveRule: 'on_semester_end' });
    expect(byCode.hostel!.namePattern).toBe('{{block.name}} Hostel');
    for (const t of DEFAULT_CHANNEL_TEMPLATES) expect(t.membershipStrategy).toBe(t.code);
  });

  it('renders {{a.b}} tokens, collapses whitespace, blanks unknown tokens', () => {
    expect(renderPattern('{{course.code}} {{course.name}} · {{section.name}}', { 'course.code': 'CS201', 'course.name': 'DBMS', 'section.name': 'A' })).toBe('CS201 DBMS · A');
    expect(renderPattern('{{batch.code}} Batch', { 'batch.code': '2024' })).toBe('2024 Batch');
    expect(renderPattern('{{missing}} Hostel', {})).toBe('Hostel');
  });
});
