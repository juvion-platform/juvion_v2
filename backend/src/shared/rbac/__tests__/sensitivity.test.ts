import { describe, it, expect, vi } from 'vitest';

// A stand-in for the registered schemas: two annotated paths, one plain.
vi.mock('mongoose', () => {
  const paths: [string, { options: Record<string, unknown> }][] = [
    ['name', { options: {} }],
    ['salary', { options: { sensitive: 'hr.compensation' } }],
    ['id.aadhaar', { options: { sensitive: 'people.identity' } }],
  ];
  return { default: { modelNames: () => ['Probe'], model: () => ({ schema: { eachPath: (fn: any) => paths.forEach(([p, t]) => fn(p, t)) } }) } };
});

import { maskFields, findHiddenKey, hiddenClassesFor, SENSITIVITY_CLASSES } from '../sensitivity';

class Opaque { constructor(public v = 1) {} }

/** 010 P3 — one walker for responses, report rows and AI context. */

describe('hiddenClassesFor', () => {
  const base = { departmentOnly: false, selfOnly: false, userId: 'u', resolvedPermissions: [] };
  it('unrestricted when the scope grants no list', () => expect(hiddenClassesFor({ ...base })).toEqual([]));
  it('hides everything not granted', () => {
    expect(hiddenClassesFor({ ...base, sensitivity: [] })).toEqual([...SENSITIVITY_CLASSES]);
    expect(hiddenClassesFor({ ...base, sensitivity: ['hr.compensation'] })).not.toContain('hr.compensation');
  });
});

describe('maskFields', () => {
  const doc = { name: 'A', salary: 100, id: { aadhaar: '1234' }, items: [{ salary: 5, keep: 1 }] };
  it('strips hidden keys at any depth, including arrays', () => {
    expect(maskFields(doc, ['hr.compensation'])).toEqual({ name: 'A', id: { aadhaar: '1234' }, items: [{ keep: 1 }] });
    expect(maskFields(doc, ['people.identity']).id).toEqual({});
  });
  it('returns the same object when nothing is hidden', () => expect(maskFields(doc, [])).toBe(doc));
  it('leaves non-plain values (dates, ids) alone', () => {
    const d = new Date(); const oid = new Opaque();
    expect(maskFields({ d, oid, salary: 1 }, ['hr.compensation'])).toEqual({ d, oid });
  });
});

describe('findHiddenKey', () => {
  it('finds a hidden key in a write body, nested or not', () => {
    expect(findHiddenKey({ name: 'x', salary: 1 }, ['hr.compensation'])).toBe('salary');
    expect(findHiddenKey({ id: { aadhaar: '1' } }, ['people.identity'])).toBe('aadhaar');
    expect(findHiddenKey({ name: 'x' }, ['hr.compensation'])).toBeNull();
    expect(findHiddenKey({ salary: 1 }, [])).toBeNull();
  });
});
