/**
 * measure-llm-baseline.ts — pre-deploy LLM cost baseline for the
 * finance-agent-summary-cache feature (Task C0).
 *
 * Aggregates the existing `AgentAction` audit collection over a
 * configurable rolling window (default 7 days) and emits per-college,
 * per-type call counts + total INR cost. Run before the cache cron is
 * deployed; re-run after a full deploy week to compute the savings %.
 *
 * Without these numbers the success metric ("≥ 80% reduction in LLM
 * cost") is unverifiable.
 *
 * ── CLI ───────────────────────────────────────────────────────────────
 *   npx ts-node backend/src/scripts/measure-llm-baseline.ts
 *   npx ts-node backend/src/scripts/measure-llm-baseline.ts --days=14
 *   npx ts-node backend/src/scripts/measure-llm-baseline.ts --college-id=<id>
 *   npx ts-node backend/src/scripts/measure-llm-baseline.ts --csv
 *
 * ── Output ────────────────────────────────────────────────────────────
 *   Default: a human-readable table grouped by (college, type)
 *   --csv:   one CSV row per (college, type)
 *
 * Spec: .captain/specs/finance-agent-summary-cache/spec.md §Success Metrics
 * Tasks: .captain/specs/finance-agent-summary-cache/tasks.md §Task C0
 */

import mongoose from 'mongoose';

import { College } from '../models/College';
import { AgentAction } from '../models/juvi/AgentAction';

// ── Public types ─────────────────────────────────────────────────────

export interface BaselineRow {
  collegeId: string;
  collegeName: string;
  type: string;
  callCount: number;
  totalCostInr: number;
  inputTokens: number;
  outputTokens: number;
}

export interface BaselineSummary {
  windowDays: number;
  windowStart: Date;
  windowEnd: Date;
  totalCalls: number;
  totalCostInr: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byCollege: BaselineRow[];
  byType: Record<string, { callCount: number; totalCostInr: number }>;
}

export interface MeasureOpts {
  days?: number;          // default 7
  collegeId?: string;     // optional filter
}

// ── Core function (testable) ─────────────────────────────────────────

/**
 * Aggregate AgentAction across the rolling window. Pure async function —
 * caller controls Mongo connection lifecycle.
 */
export async function measureLLMBaseline(opts: MeasureOpts = {}): Promise<BaselineSummary> {
  const days = opts.days ?? 7;
  if (days <= 0) {
    throw new Error('--days must be a positive integer');
  }
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - days * 24 * 60 * 60 * 1000);

  // Build the aggregation match stage; `collegeId` filter is optional.
  const match: Record<string, unknown> = {
    createdAt: { $gte: windowStart, $lte: windowEnd },
  };
  if (opts.collegeId) {
    match.collegeId = new mongoose.Types.ObjectId(opts.collegeId);
  }

  type PipelineRow = {
    _id: { collegeId: mongoose.Types.ObjectId; type: string };
    callCount: number;
    totalCostInr: number;
    inputTokens: number;
    outputTokens: number;
  };

  const rows = await AgentAction.aggregate<PipelineRow>([
    { $match: match },
    {
      $group: {
        _id: { collegeId: '$collegeId', type: '$type' },
        callCount: { $sum: 1 },
        totalCostInr: { $sum: '$costInr' },
        inputTokens: { $sum: '$inputTokens' },
        outputTokens: { $sum: '$outputTokens' },
      },
    },
    {
      // Stable ordering for reproducible CLI output: newest college first
      // by callCount desc, then by type alphabetically.
      $sort: { callCount: -1, '_id.type': 1 },
    },
  ]);

  // Resolve college names in one round-trip.
  const collegeIds = Array.from(new Set(rows.map((r) => r._id.collegeId.toHexString())));
  const colleges = await College.find({
    _id: { $in: collegeIds.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select({ _id: 1, name: 1 })
    .lean();
  const nameById = new Map<string, string>();
  for (const c of colleges) {
    nameById.set(String(c._id), c.name);
  }

  const byCollege: BaselineRow[] = rows.map((r) => ({
    collegeId: r._id.collegeId.toHexString(),
    collegeName: nameById.get(r._id.collegeId.toHexString()) ?? '<unknown college>',
    type: r._id.type,
    callCount: r.callCount,
    totalCostInr: round4(r.totalCostInr),
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
  }));

  const totals = byCollege.reduce(
    (acc, r) => {
      acc.totalCalls += r.callCount;
      acc.totalCostInr = round4(acc.totalCostInr + r.totalCostInr);
      acc.totalInputTokens += r.inputTokens;
      acc.totalOutputTokens += r.outputTokens;
      return acc;
    },
    { totalCalls: 0, totalCostInr: 0, totalInputTokens: 0, totalOutputTokens: 0 },
  );

  // Per-type roll-up across all colleges.
  const byType: Record<string, { callCount: number; totalCostInr: number }> = {};
  for (const r of byCollege) {
    if (!byType[r.type]) {
      byType[r.type] = { callCount: 0, totalCostInr: 0 };
    }
    byType[r.type]!.callCount += r.callCount;
    byType[r.type]!.totalCostInr = round4(byType[r.type]!.totalCostInr + r.totalCostInr);
  }

  return {
    windowDays: days,
    windowStart,
    windowEnd,
    totalCalls: totals.totalCalls,
    totalCostInr: totals.totalCostInr,
    totalInputTokens: totals.totalInputTokens,
    totalOutputTokens: totals.totalOutputTokens,
    byCollege,
    byType,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ── Output formatting ────────────────────────────────────────────────

/**
 * Human-readable table. Returns a string so callers can capture it for
 * the baseline.md doc instead of dumping straight to stdout.
 */
export function formatTable(summary: BaselineSummary): string {
  if (summary.byCollege.length === 0) {
    return [
      `LLM cost baseline — ${summary.windowDays}-day window`,
      `  ${summary.windowStart.toISOString()} → ${summary.windowEnd.toISOString()}`,
      '',
      '  No AgentAction rows in window.',
      '',
    ].join('\n');
  }

  const lines: string[] = [];
  lines.push(`LLM cost baseline — ${summary.windowDays}-day window`);
  lines.push(`  ${summary.windowStart.toISOString()} → ${summary.windowEnd.toISOString()}`);
  lines.push('');

  // Per-college / per-type rows
  const colWidth = {
    college: Math.max(20, ...summary.byCollege.map((r) => r.collegeName.length)),
    type: 18,
    calls: 10,
    cost: 14,
  };
  const sep = `+-${'-'.repeat(colWidth.college)}-+-${'-'.repeat(colWidth.type)}-+-${'-'.repeat(colWidth.calls)}-+-${'-'.repeat(colWidth.cost)}-+`;
  lines.push(sep);
  lines.push(
    `| ${'College'.padEnd(colWidth.college)} | ${'Type'.padEnd(colWidth.type)} | ${'Calls'.padStart(colWidth.calls)} | ${'Cost (INR)'.padStart(colWidth.cost)} |`,
  );
  lines.push(sep);
  for (const r of summary.byCollege) {
    lines.push(
      `| ${r.collegeName.padEnd(colWidth.college)} | ${r.type.padEnd(colWidth.type)} | ${String(r.callCount).padStart(colWidth.calls)} | ${`₹${r.totalCostInr.toFixed(4)}`.padStart(colWidth.cost)} |`,
    );
  }
  lines.push(sep);

  // Per-type roll-up
  lines.push('');
  lines.push('Per-type totals (all colleges):');
  for (const [type, t] of Object.entries(summary.byType).sort()) {
    lines.push(`  ${type.padEnd(20)} ${String(t.callCount).padStart(8)} calls   ₹${t.totalCostInr.toFixed(4)}`);
  }

  // Grand total
  lines.push('');
  lines.push(
    `Grand total: ${summary.totalCalls} calls / ₹${summary.totalCostInr.toFixed(4)} / in=${summary.totalInputTokens} out=${summary.totalOutputTokens} tokens`,
  );

  return lines.join('\n');
}

/**
 * CSV output: one row per (college, type). Headers included. Easy to
 * paste into a spreadsheet or commit as a structured file.
 */
export function formatCsv(summary: BaselineSummary): string {
  const headers = [
    'collegeId',
    'collegeName',
    'type',
    'callCount',
    'totalCostInr',
    'inputTokens',
    'outputTokens',
    'windowStart',
    'windowEnd',
  ];
  const rows = summary.byCollege.map((r) =>
    [
      r.collegeId,
      escapeCsv(r.collegeName),
      r.type,
      r.callCount,
      r.totalCostInr,
      r.inputTokens,
      r.outputTokens,
      summary.windowStart.toISOString(),
      summary.windowEnd.toISOString(),
    ].join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ── CLI ──────────────────────────────────────────────────────────────

function parseArg(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return undefined;
  return arg.slice(`--${name}=`.length).replace(/^["']|["']$/g, '');
}

async function main(): Promise<void> {
  const daysRaw = parseArg('days');
  const days = daysRaw ? Number(daysRaw) : 7;
  const collegeId = parseArg('college-id');
  const csv = process.argv.includes('--csv');

  if (!Number.isFinite(days) || days <= 0) {
    console.error('[ERROR] --days must be a positive integer');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/juvion_v2';
  await mongoose.connect(mongoUri);
  try {
    const summary = await measureLLMBaseline({ days, collegeId });
    if (csv) {
      console.log(formatCsv(summary));
    } else {
      console.log(formatTable(summary));
    }
  } catch (e) {
    console.error('[ERROR]', (e as Error).message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}
