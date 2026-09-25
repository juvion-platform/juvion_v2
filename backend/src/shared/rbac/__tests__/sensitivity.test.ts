import { describe, it, expect, vi } from 'vitest';

// A stand-in for the registered schemas: annotated paths.
vi.mock('mongoose', () => {
  const paths: [string, { options: Record<string, unknown> }][] = [
    ['name', { options: {} }],
    ['salary', { options: { sensitive: 'hr.compensation' } }],
    ['id.aadhaar', { options: { sensitive: 'people.aadhaar' } }],
    ['phone', { options: { sensitive: 'people.identity' } }],
  ];
  return { default: { modelNames: () => ['Probe'], model: () => ({ schema: { eachPath: (fn: any) => paths.forEach(([p, t]) => fn(p, t)) } }) } };
});

import { maskFields, findHiddenKey, hiddenClassesFor, maskedClassesFor, resolveSensitivityMasks, formatMaskedAadhaar, SENSITIVITY_CLASSES } from '../sensitivity';

class Opaque { constructor(public v = 1) {} }

/** 010 P3 — one walker for responses, report rows and AI context. */

describe('formatMaskedAadhaar', () => {
  it('masks standard 12-digit aadhaar with last 4 visible', () => {
    expect(formatMaskedAadhaar('123456789012')).toBe('••••••••9012');
  });
  it('handles already masked values idempotently', () => {
    expect(formatMaskedAadhaar('••••••••9012')).toBe('••••••••9012');
    expect(formatMaskedAadhaar('XXXXXXXX9012')).toBe('XXXXXXXX9012');
  });
});

describe('resolveSensitivityMasks and hiddenClassesFor', () => {
  const base = { departmentOnly: false, selfOnly: false, userId: 'u', resolvedPermissions: [] };
  it('unrestricted when the scope grants no list', () => {
    expect(hiddenClassesFor({ ...base })).toEqual([]);
    expect(maskedClassesFor({ ...base })).toEqual([]);
  });
  it('hides everything not granted', () => {
    expect(hiddenClassesFor({ ...base, sensitivity: [] })).toEqual([...SENSITIVITY_CLASSES]);
    expect(hiddenClassesFor({ ...base, sensitivity: ['hr.compensation'] })).not.toContain('hr.compensation');
  });
  it('separates full and masked classes', () => {
    const res = resolveSensitivityMasks({ ...base, sensitivity: ['people.identity', 'people.aadhaar:masked'] });
    expect(res.hidden).not.toContain('people.identity');
    expect(res.hidden).not.toContain('people.aadhaar');
    expect(res.masked).toContain('people.aadhaar');
  });
});

describe('maskFields', () => {
  const doc = { name: 'A', salary: 100, id: { aadhaar: '123456789012' }, items: [{ salary: 5, keep: 1 }] };
  it('strips hidden keys at any depth, including arrays', () => {
    expect(maskFields(doc, ['hr.compensation'])).toEqual({ name: 'A', id: { aadhaar: '123456789012' }, items: [{ keep: 1 }] });
    expect(maskFields(doc, ['people.aadhaar']).id).toEqual({});
  });
  it('formats masked keys into masked Aadhaar string', () => {
    const masked = maskFields(doc, [], ['people.aadhaar']);
    expect(masked.id.aadhaar).toBe('••••••••9012');
  });
  it('returns the same object when nothing is hidden or masked', () => expect(maskFields(doc, [], [])).toBe(doc));
  it('leaves non-plain values (dates, ids) alone', () => {
    const d = new Date(); const oid = new Opaque();
    expect(maskFields({ d, oid, salary: 1 }, ['hr.compensation'])).toEqual({ d, oid });
  });
});

describe('findHiddenKey', () => {
  it('finds a hidden key in a write body, nested or not', () => {
    expect(findHiddenKey({ name: 'x', salary: 1 }, ['hr.compensation'])).toBe('salary');
    expect(findHiddenKey({ id: { aadhaar: '1' } }, ['people.aadhaar'])).toBe('aadhaar');
    expect(findHiddenKey({ name: 'x' }, ['hr.compensation'])).toBeNull();
    expect(findHiddenKey({ salary: 1 }, [])).toBeNull();
  });
  it('finds a masked key in a write body to reject writes', () => {
    expect(findHiddenKey({ id: { aadhaar: '123456789012' } }, [], ['people.aadhaar'])).toBe('aadhaar');
  });
});
