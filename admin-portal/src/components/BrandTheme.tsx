import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { resolveRamp } from '../lib/brand-ramp';
import { applyRamp } from '../lib/apply-ramp';

/**
 * Applies the current college's brand ramp to the document.
 *
 * Renders nothing. It re-runs whenever the stored accent changes, which covers
 * all three ways that happens: the boot-time /auth/me hydrate, a fresh login,
 * and a superadmin switching college from the selector.
 */
export default function BrandTheme() {
  const accent = useAuthStore((s) => s.collegeAccent);

  useEffect(() => {
    // resolveRamp never throws and never returns a partial ramp, so there is no
    // error path here: a missing or malformed accent simply yields the legacy
    // palette.
    applyRamp(resolveRamp(accent));
  }, [accent]);

  return null;
}
