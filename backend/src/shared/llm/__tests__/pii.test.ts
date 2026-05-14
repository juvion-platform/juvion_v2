import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { maskPII, unmaskText } from '../pii';

/**
 * Task A1 — PII masker tests (fee-analytics-ai-native).
 *
 * The masker is the load-bearing privacy boundary for the entire
 * fee-analytics-ai-native sprint. Every LLM call routes through it.
 *
 * Contract:
 *   maskPII(input) → { masked, tokenMap }
 *     - masks: phone, email, guardian.name, guardian.phone, guardian.email,
 *              address, aadhaar, pan, dob (case-insensitive on field names)
 *     - preserves: rollNumber, programme, branch, batch, escalationStage,
 *                  amounts, dates (anything not in the masked list)
 *     - tokens: {<category>_<ordinal>}, ordinals reset per call
 *     - same value reused → same token
 *     - null preserved; '' preserved; arrays + nesting traversed in order
 *   unmaskText(text, tokenMap)
 *     - replaces every {token} with mapped value
 *     - unknown tokens left literal + warning logged with [llm:pii-warn]
 */

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Top-level masking ───────────────────────────────────────────────────

describe('maskPII — top-level fields', () => {
  it('masks phone at top level + preserves rollNumber/programme/amount/dueDate', () => {
    const { masked, tokenMap } = maskPII({
      rollNumber: '20CS001',
      programme: 'BTech CSE',
      amount: 50000,
      dueDate: '2026-04-30',
      phone: '+91-9988776655',
    });

    expect(masked.phone).toMatch(/^\{phone_\d+\}$/);
    expect(masked.rollNumber).toBe('20CS001');
    expect(masked.programme).toBe('BTech CSE');
    expect(masked.amount).toBe(50000);
    expect(masked.dueDate).toBe('2026-04-30');
    // tokenMap restores the raw value
    expect(tokenMap[masked.phone]).toBe('+91-9988776655');
  });

  it('masks email at top level', () => {
    const { masked, tokenMap } = maskPII({ email: 'kavya@example.com' });
    expect(masked.email).toMatch(/^\{email_\d+\}$/);
    expect(tokenMap[masked.email]).toBe('kavya@example.com');
  });

  it('masks address, aadhaar, pan, dob at top level', () => {
    const input = {
      address: 'Plot 12, Hyderabad',
      aadhaar: '1234-5678-9012',
      pan: 'ABCDE1234F',
      dob: '2005-08-15',
    };
    const { masked, tokenMap } = maskPII(input);

    expect(masked.address).toMatch(/^\{address_\d+\}$/);
    expect(masked.aadhaar).toMatch(/^\{aadhaar_\d+\}$/);
    expect(masked.pan).toMatch(/^\{pan_\d+\}$/);
    expect(masked.dob).toMatch(/^\{dob_\d+\}$/);
    expect(tokenMap[masked.address]).toBe(input.address);
    expect(tokenMap[masked.aadhaar]).toBe(input.aadhaar);
    expect(tokenMap[masked.pan]).toBe(input.pan);
    expect(tokenMap[masked.dob]).toBe(input.dob);
  });

  it('does NOT mask rollNumber, programme, branch, batch, escalationStage, amount*, *Date, *Id, _id, status, role', () => {
    const input = {
      rollNumber: '20CS001',
      programme: 'BTech CSE',
      branch: 'CSE',
      batch: '2024-2028',
      escalationStage: 'stage_2',
      amount: 50000,
      amountDue: 12000,
      dueDate: '2026-04-30',
      lastReminderDate: '2026-04-10',
      studentId: 'abc',
      _id: 'xyz',
      collegeId: 'col-1',
      status: 'active',
      role: 'student',
    };
    const { masked, tokenMap } = maskPII(input);

    // No tokens emitted for any of these
    expect(Object.keys(tokenMap)).toHaveLength(0);
    expect(masked).toEqual(input);
  });
});

// ── Nested fields ───────────────────────────────────────────────────────

describe('maskPII — nested guardian.* + arrays', () => {
  it('masks guardian.phone, guardian.email, guardian.name', () => {
    const { masked, tokenMap } = maskPII({
      rollNumber: '20CS001',
      guardian: {
        name: 'Rajesh Rao',
        phone: '+91-9988776655',
        email: 'rajesh@example.com',
        relation: 'father',
      },
    });

    expect(masked.guardian.name).toMatch(/^\{guardian_name_\d+\}$/);
    expect(masked.guardian.phone).toMatch(/^\{guardian_phone_\d+\}$/);
    expect(masked.guardian.email).toMatch(/^\{guardian_email_\d+\}$/);
    // relation is not in the mask list
    expect(masked.guardian.relation).toBe('father');
    expect(masked.rollNumber).toBe('20CS001');

    expect(tokenMap[masked.guardian.name]).toBe('Rajesh Rao');
    expect(tokenMap[masked.guardian.phone]).toBe('+91-9988776655');
    expect(tokenMap[masked.guardian.email]).toBe('rajesh@example.com');
  });

  it('handles array of students; ordinals increment across the array', () => {
    const input = {
      students: [
        { rollNumber: 'A1', phone: '+91-1', guardian: { phone: '+91-101' } },
        { rollNumber: 'A2', phone: '+91-2', guardian: { phone: '+91-102' } },
      ],
    };
    const { masked, tokenMap } = maskPII(input);

    expect(masked.students[0].rollNumber).toBe('A1');
    expect(masked.students[1].rollNumber).toBe('A2');
    expect(masked.students[0].phone).toMatch(/^\{phone_\d+\}$/);
    expect(masked.students[1].phone).toMatch(/^\{phone_\d+\}$/);
    expect(masked.students[0].phone).not.toBe(masked.students[1].phone);
    expect(masked.students[0].guardian.phone).toMatch(/^\{guardian_phone_\d+\}$/);
    expect(masked.students[1].guardian.phone).toMatch(/^\{guardian_phone_\d+\}$/);
    expect(masked.students[0].guardian.phone).not.toBe(masked.students[1].guardian.phone);

    expect(tokenMap[masked.students[0].phone]).toBe('+91-1');
    expect(tokenMap[masked.students[1].phone]).toBe('+91-2');
    expect(tokenMap[masked.students[0].guardian.phone]).toBe('+91-101');
    expect(tokenMap[masked.students[1].guardian.phone]).toBe('+91-102');
  });

  it('handles deeply nested arrays-in-objects-in-arrays (students[i].guardians[j].phone)', () => {
    const input = {
      students: [
        {
          rollNumber: 'X1',
          guardians: [
            { phone: '+91-A1' },
            { phone: '+91-A2' },
          ],
        },
      ],
    };
    const { masked, tokenMap } = maskPII(input);

    expect(masked.students[0].guardians[0].phone).toMatch(/^\{guardians_phone_\d+\}$|^\{guardian_phone_\d+\}$/);
    expect(masked.students[0].guardians[1].phone).toMatch(/^\{guardians_phone_\d+\}$|^\{guardian_phone_\d+\}$/);
    expect(masked.students[0].guardians[0].phone).not.toBe(masked.students[0].guardians[1].phone);
    expect(tokenMap[masked.students[0].guardians[0].phone]).toBe('+91-A1');
    expect(tokenMap[masked.students[0].guardians[1].phone]).toBe('+91-A2');
  });
});

// ── Determinism + edge cases ────────────────────────────────────────────

describe('maskPII — determinism + edges', () => {
  it('reuses the same token for identical values within a single call', () => {
    const { masked, tokenMap } = maskPII({
      a: { phone: '+91-9999911111' },
      b: { phone: '+91-9999911111' }, // same value!
      c: { phone: '+91-9999922222' }, // different
    });
    expect(masked.a.phone).toBe(masked.b.phone);
    expect(masked.a.phone).not.toBe(masked.c.phone);
    expect(tokenMap[masked.a.phone]).toBe('+91-9999911111');
    expect(tokenMap[masked.c.phone]).toBe('+91-9999922222');
    // Only two unique tokens emitted, not three
    expect(Object.keys(tokenMap)).toHaveLength(2);
  });

  it('ordinals reset per call — fresh request gets fresh tokens', () => {
    const r1 = maskPII({ phone: '+91-X' });
    const r2 = maskPII({ phone: '+91-Y' });
    // First token issued in each call should both be the lowest ordinal
    expect(r1.masked.phone).toBe('{phone_1}');
    expect(r2.masked.phone).toBe('{phone_1}');
    // But token maps are independent
    expect(r1.tokenMap['{phone_1}']).toBe('+91-X');
    expect(r2.tokenMap['{phone_1}']).toBe('+91-Y');
  });

  it('preserves null values (does not mask null)', () => {
    const { masked, tokenMap } = maskPII({
      phone: null,
      email: null,
      address: null,
      rollNumber: '20CS001',
    });
    expect(masked.phone).toBeNull();
    expect(masked.email).toBeNull();
    expect(masked.address).toBeNull();
    expect(masked.rollNumber).toBe('20CS001');
    expect(Object.keys(tokenMap)).toHaveLength(0);
  });

  it('preserves empty strings (does not mask "")', () => {
    const { masked, tokenMap } = maskPII({ phone: '', email: '' });
    expect(masked.phone).toBe('');
    expect(masked.email).toBe('');
    expect(Object.keys(tokenMap)).toHaveLength(0);
  });

  it('handles empty input cleanly', () => {
    const r1 = maskPII({});
    expect(r1).toEqual({ masked: {}, tokenMap: {} });

    const r2 = maskPII([]);
    expect(r2.masked).toEqual([]);
    expect(r2.tokenMap).toEqual({});
  });

  it('handles a 100-student payload in under 50ms', () => {
    const students = Array.from({ length: 100 }, (_, i) => ({
      rollNumber: `R${i.toString().padStart(4, '0')}`,
      programme: 'BTech CSE',
      amount: 50_000 + i,
      phone: `+91-99${i.toString().padStart(8, '0')}`,
      email: `s${i}@example.com`,
      guardian: {
        name: `Parent ${i}`,
        phone: `+91-88${i.toString().padStart(8, '0')}`,
        email: `parent${i}@example.com`,
      },
    }));
    const start = Date.now();
    const { masked, tokenMap } = maskPII(students);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(50);
    expect(masked).toHaveLength(100);
    // 5 PII fields per student × 100 students = 500 token entries
    expect(Object.keys(tokenMap).length).toBe(500);
  });
});

// ── Round trip via unmaskText ───────────────────────────────────────────

describe('unmaskText — round trip', () => {
  it('restores all known tokens in a free-form LLM-style sentence', () => {
    const { masked, tokenMap } = maskPII({
      rollNumber: '20CS001',
      phone: '+91-9988776655',
      guardian: { name: 'Rajesh Rao', phone: '+91-7766554433' },
    });

    const llmText =
      `Roll ${masked.rollNumber}: contact at ${masked.phone}, ` +
      `guardian ${masked.guardian.name} on ${masked.guardian.phone}.`;
    const unmasked = unmaskText(llmText, tokenMap);

    expect(unmasked).toBe(
      'Roll 20CS001: contact at +91-9988776655, guardian Rajesh Rao on +91-7766554433.',
    );
  });

  it('replaces every occurrence of a token (token used multiple times)', () => {
    const tokenMap = { '{phone_1}': '+91-1' };
    const text = '{phone_1} is the same as {phone_1}.';
    expect(unmaskText(text, tokenMap)).toBe('+91-1 is the same as +91-1.');
  });

  it('leaves unknown tokens literal + emits [llm:pii-warn] log', () => {
    const tokenMap = { '{phone_1}': '+91-1' };
    const text = 'Known {phone_1}, unknown {student_name_99}.';
    const out = unmaskText(text, tokenMap);

    expect(out).toBe('Known +91-1, unknown {student_name_99}.');
    expect(console.warn).toHaveBeenCalled();
    const warnArg = (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .map((c: unknown[]) => String(c[0]))
      .join('\n');
    expect(warnArg).toMatch(/\[llm:pii-warn\]/);
    expect(warnArg).toMatch(/student_name_99/);
  });

  it('passes through plain text with no tokens unchanged', () => {
    expect(unmaskText('No tokens here.', {})).toBe('No tokens here.');
  });
});
