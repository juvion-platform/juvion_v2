/**
 * R1 money boundary. ERP finance stores rupees (2dp); the Juvi /v1 contract carries
 * integer paise. Convert exactly once at reader boundaries — never inside ERP finance
 * code, and never again on values that are already paise. Plan 3's Dart client divides by 100.
 */
export function toPaise(amount: number): number;
export function toPaise(amount: number | null): number | null;
export function toPaise(amount: number | null): number | null {
  return amount === null ? null : Math.round(amount * 100);
}
