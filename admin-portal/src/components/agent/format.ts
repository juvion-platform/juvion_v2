/** Display formatters shared by the agent widgets and the pages that host them. */

export function formatInrCompact(value: number | undefined | null): string {
  const v = value ?? 0;
  const abs = Math.abs(v);
  if (abs >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
  if (abs >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toLocaleString('en-IN')}`;
}

export function formatInrFull(value: number | undefined | null): string {
  return `₹${(value ?? 0).toLocaleString('en-IN')}`;
}

export function formatCachedAt(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
