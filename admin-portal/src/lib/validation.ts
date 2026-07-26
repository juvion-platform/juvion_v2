/**
 * Small shared checks for the "end before start" and "required-when" bugs the
 * audit found repeated across Academics, Placement, Welfare and Compliance.
 * Each returns an error string or null, so a page can render it inline and
 * disable submit without pulling in a form library.
 */

/** True when both bounds are present and `end` is strictly before `start`. */
export function isRangeInverted(start: string, end: string): boolean {
  if (!start || !end) return false;
  return end < start; // ISO date ('2026-01-05') and HH:mm both sort lexically
}

export function rangeError(
  start: string,
  end: string,
  { startLabel = 'start', endLabel = 'end', allowEqual = false } = {},
): string | null {
  if (!start || !end) return null;
  if (end < start) return `The ${endLabel} cannot be before the ${startLabel}.`;
  if (!allowEqual && end === start) return `The ${endLabel} must be after the ${startLabel}.`;
  return null;
}

/** Requires `value` whenever `status` is one of `whenStatusIn`. */
export function requiredWhenStatus(
  value: string,
  status: string,
  whenStatusIn: readonly string[],
  fieldLabel: string,
): string | null {
  if (!whenStatusIn.includes(status)) return null;
  return value ? null : `${fieldLabel} is required when status is “${status}”.`;
}
