/**
 * import-schemas/validators — shared field-level validators for the
 * bulk-import schema registry.
 *
 * `validString`, `validNumber` and `validEnum` are moved verbatim out of
 * `bulk-import-registry.ts` so entity schema modules (student, faculty,
 * staff, applicant, programme) can import them without duplicating logic.
 * The registry itself still uses them for the other four entity types
 * and re-imports them from here rather than keeping its own copies.
 *
 * `validDate`, `validPhone`, `validAadhaar` and `validEmail` are new here —
 * the pre-existing student schema inlined these checks per-field; the
 * enriched schema (Task 6) uses these shared, parameterised versions
 * instead.
 */

type Res<T> = { ok: true; value: T } | { ok: false; error: string };

export function validString(opts: { min?: number; max?: number; required: boolean }) {
  return (raw: string): Res<string> => {
    const v = raw.trim();
    if (!v) {
      return opts.required ? { ok: false, error: 'required' } : { ok: true, value: '' };
    }
    if (opts.min !== undefined && v.length < opts.min) {
      return { ok: false, error: `min length ${opts.min}` };
    }
    if (opts.max !== undefined && v.length > opts.max) {
      return { ok: false, error: `max length ${opts.max}` };
    }
    return { ok: true, value: v };
  };
}

export function validNumber(opts: { required: boolean; min?: number; max?: number }) {
  return (raw: string): Res<number> => {
    const v = raw.trim();
    if (!v) {
      return opts.required ? { ok: false, error: 'required' } : { ok: true, value: NaN };
    }
    const n = Number(v);
    if (Number.isNaN(n)) return { ok: false, error: 'must be a number' };
    if (opts.min !== undefined && n < opts.min) return { ok: false, error: `min ${opts.min}` };
    if (opts.max !== undefined && n > opts.max) return { ok: false, error: `max ${opts.max}` };
    return { ok: true, value: n };
  };
}

export function validEnum(opts: { required: boolean; values: ReadonlyArray<string> }) {
  return (raw: string): Res<string> => {
    const v = raw.trim();
    if (!v) {
      return opts.required ? { ok: false, error: 'required' } : { ok: true, value: '' };
    }
    if (!opts.values.includes(v)) {
      return { ok: false, error: `must be one of: ${opts.values.join(', ')}` };
    }
    return { ok: true, value: v };
  };
}

export function validPhone(opts: { required: boolean }) {
  return (raw: string): Res<string> => {
    const v = raw.trim();
    if (!v) return opts.required ? { ok: false, error: 'required' } : { ok: true, value: '' };
    if (!/^[0-9]{10}$/.test(v)) return { ok: false, error: 'must be a 10-digit phone number' };
    return { ok: true, value: v };
  };
}

export function validAadhaar(opts: { required: boolean }) {
  return (raw: string): Res<string> => {
    const v = raw.trim();
    if (!v) return opts.required ? { ok: false, error: 'required' } : { ok: true, value: '' };
    if (!/^[0-9]{12}$/.test(v)) return { ok: false, error: 'must be 12 digits' };
    return { ok: true, value: v };
  };
}

export function validDate(opts: { required: boolean }) {
  return (raw: string): Res<string> => {
    const v = raw.trim();
    if (!v) return opts.required ? { ok: false, error: 'required' } : { ok: true, value: '' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, error: 'must be YYYY-MM-DD' };
    if (Number.isNaN(new Date(v).getTime())) return { ok: false, error: 'not a real date' };
    return { ok: true, value: v };
  };
}

export function validEmail(opts: { required: boolean }) {
  return (raw: string): Res<string> => {
    const v = raw.trim();
    if (!v) return opts.required ? { ok: false, error: 'required' } : { ok: true, value: '' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { ok: false, error: 'invalid email format' };
    return { ok: true, value: v };
  };
}
