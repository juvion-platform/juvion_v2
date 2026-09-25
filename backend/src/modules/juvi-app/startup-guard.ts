export function juviStartupProblems(env: NodeJS.ProcessEnv): string[] {
  const problems: string[] = [];
  const key = env.JUVI_CREDENTIAL_KEY;
  if (env.NODE_ENV === 'production' && !key) problems.push('JUVI_CREDENTIAL_KEY must be set in production (32 bytes, base64)');
  if (key && Buffer.from(key, 'base64').length !== 32) problems.push('JUVI_CREDENTIAL_KEY must decode to exactly 32 bytes');
  return problems;
}
