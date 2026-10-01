import { useEffect, useState } from 'react';

/**
 * `value` once it has stopped changing for `ms`. Pass a primitive (a string
 * key, not a fresh array): a new object on every render would restart the
 * timer forever.
 */
export function useDebouncedValue<T extends string | number | boolean | null | undefined>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
