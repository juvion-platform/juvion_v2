export function juviStartupProblems(env: NodeJS.ProcessEnv): string[] {
  const problems: string[] = [];
  const production = env.NODE_ENV === 'production';
  const key = env.JUVI_CREDENTIAL_KEY;
  if (production && !key) problems.push('JUVI_CREDENTIAL_KEY must be set in production (32 bytes, base64)');
  if (key && Buffer.from(key, 'base64').length !== 32) problems.push('JUVI_CREDENTIAL_KEY must decode to exactly 32 bytes');

  // Notification receipts are HMAC-signed with it (notifications spec §7.2, §10).
  const receiptKey = env.JUVI_RECEIPT_KEY;
  if (production && !receiptKey) problems.push('JUVI_RECEIPT_KEY must be set in production (at least 32 characters)');
  if (receiptKey && receiptKey.length < 32) problems.push('JUVI_RECEIPT_KEY must be at least 32 characters');

  const firebase = env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (production && env.JUVI_PUSH_REQUIRED === 'true' && !firebase) problems.push('FIREBASE_SERVICE_ACCOUNT_JSON must be set when JUVI_PUSH_REQUIRED=true');
  if (firebase) {
    let ok = false;
    try {
      const sa = JSON.parse(firebase) as Record<string, unknown>;
      ok = typeof sa.project_id === 'string' && typeof sa.client_email === 'string' && typeof sa.private_key === 'string';
    } catch { /* not JSON */ }
    if (!ok) problems.push('FIREBASE_SERVICE_ACCOUNT_JSON must be a service-account JSON with project_id, client_email and private_key');
  }
  return problems;
}
