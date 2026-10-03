/**
 * Juvi notices: pure helpers shared by the portal's notice screens (spec §8).
 * Limits and the MIME list mirror backend/src/models/juvi/Notice.ts; the
 * admin roles mirror notices/publisher-scope.ts ADMIN_ROLES. The phone
 * notification wording mirrors the notifications spec §6.6.
 */
import type { AxiosError } from 'axios';
import { extractErrorMessage } from './errors';
import type { AudienceRuleKind, DeliveryCounts, NoticePriority, NoticeRow, PendingDelivery, PendingPerson } from '../services/notices';

export const NOTICE_TITLE_MAX = 120;
export const NOTICE_BODY_MAX = 5000;
export const NOTICE_ATTACHMENTS_MAX = 5;
export const NOTICE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
/** PDF, PNG, JPEG, WEBP, DOCX, XLSX, PPTX (spec §6.1). */
export const NOTICE_ATTACHMENT_MIMES: readonly string[] = [
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
export const NOTICE_ATTACHMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.pptx';

/** Every notice in the college, reach CSV, retry delivery (the server enforces each). */
export const NOTICE_ADMIN_ROLES: readonly string[] = ['admin', 'super_admin', 'principal'];
export const isNoticeAdmin = (role?: string | null): boolean => Boolean(role && NOTICE_ADMIN_ROLES.includes(role));

export const KIND_ORDER: readonly AudienceRuleKind[] = ['all', 'role', 'department', 'programme', 'batch', 'section', 'course_offering', 'hostel_block', 'custom'];
export const KIND_LABELS: Record<AudienceRuleKind, string> = {
  all: 'Everyone', role: 'Roles', department: 'Departments', programme: 'Programmes', batch: 'Batches',
  section: 'Sections', course_offering: 'Courses', hostel_block: 'Hostel blocks', custom: 'People',
};
export const ROLE_LABELS: Record<string, string> = { student: 'All students', faculty: 'All faculty', staff: 'All staff', hod: 'All HODs' };
export const roleLabel = (id: string): string => ROLE_LABELS[id] ?? id;

export const PRIORITY_LABELS: Record<NoticePriority, string> = { routine: 'Routine', important: 'Important', urgent: 'Urgent' };
export const URGENT_NOTE = 'Urgent bypasses quiet hours once push arrives. Until then every notice reaches the app on its next refresh.';

export const PENDING_STATE_LABELS: Record<PendingPerson['state'], string> = { seen: 'Seen, not acknowledged', not_seen: 'Not seen', not_on_juvi: 'Not on Juvi' };

// ── Phone notifications (notifications spec §6.5, §6.6, §7.4, §9) ─────────

/** `urgentReason` length, as backend/src/models/juvi/Notice.ts URGENT_REASON_MIN / URGENT_REASON_MAX. */
export const URGENT_REASON_MIN = 10;
export const URGENT_REASON_MAX = 300;
export const NEED_URGENT_HINT = 'Need Urgent? Ask an IT admin.';
export const URGENT_NOT_ALLOWED_MESSAGE = 'Your account cannot publish Urgent notices. Go back and choose Routine or Important, or ask an IT admin.';

/** The Confidential helper text (spec §9), with the office the notice is published from. */
export const confidentialHelp = (office: string): string =>
  `The phone notification will say only 'New notice from ${office || 'your office'}'. The content opens in the app.`;

/**
 * What the phone shows for one notice (spec §6.6), as the two lines of an
 * Android notification. The office is always there; a confidential notice
 * never shows its title. The Flutter handler renders the same strings.
 */
export function trayNotification(i: { office: string; title: string; confidential: boolean; variant: 'published' | 'reminder' }): { title: string; text: string | null } {
  const title = i.title.trim() || 'Notice title';
  if (i.confidential) return { title: i.variant === 'reminder' ? `Reminder from ${i.office}` : `New notice from ${i.office}`, text: null };
  return { title: i.office, text: i.variant === 'reminder' ? `Reminder: ${title}` : title };
}

/** How each tier reaches the phone (spec §2 goals 1–3, §6.3, §6.4). */
export const TRAY_ALERT: Record<NoticePriority, string> = {
  urgent: 'Rings at once, even during quiet hours and when the channel is muted.',
  important: 'Plays a sound. During someone\'s quiet hours (22:00–07:00 unless they change them) it waits until they end.',
  routine: 'Silent. Routine notices from one office within 15 minutes arrive as one notification.',
};

/** The Reach pending list's delivery column (spec §9); the CSV uses the same words, with an empty cell for `none`. */
export const PENDING_DELIVERY_LABELS: Record<PendingDelivery, string> = {
  not_delivered: 'Not delivered', delivered: 'Delivered', opened: 'Opened', muted: 'Muted', tier_off: 'Notifications off',
  no_device: 'No device', scheduled: 'Scheduled', none: '—',
};

/** Everyone the published notification was decided for: each person is in exactly one count. */
export const deliveryTotal = (d: DeliveryCounts): number =>
  d.scheduled + d.sent + d.delivered + d.opened + d.failed + d.cancelled + d.suppressed.muted + d.suppressed.tierOff + d.suppressed.noDevice;

// ── College-timezone dates ──────────────────────────────────────────────

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function zoneParts(utcMs: number, tz: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  return Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
}

/** The zone's UTC offset at an instant, in ms (positive east of UTC). */
function offsetMs(utcMs: number, tz: string): number {
  const p = zoneParts(utcMs, tz);
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** A `datetime-local` value ("2026-10-05T17:00") read as wall-clock time in `tz`, as an ISO instant. */
export function zonedLocalToIso(local: string, tz: string): string {
  const m = LOCAL_RE.exec(local);
  if (!m) throw new Error(`Not a date and time: ${local}`);
  const naive = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  const first = naive - offsetMs(naive, tz);
  // A second pass settles instants near a DST change, where the offset differs.
  return new Date(naive - offsetMs(first, tz)).toISOString();
}

/** An ISO instant as a `datetime-local` value in `tz`. */
export function isoToZonedLocal(iso: string, tz: string): string {
  const p = zoneParts(new Date(iso).getTime(), tz);
  const two = (n: number | undefined) => String(n ?? 0).padStart(2, '0');
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`;
}

/** "5 Oct 2026, 5:00 pm" in `tz`. */
export function formatInZone(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

/** Read-only timestamps, in the viewer's zone like the rest of the portal. */
export const formatWhen = (iso: string | null | undefined): string =>
  (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ── ERP errors ─────────────────────────────────────────────────────────

type ErpErrorBody = { error?: string; details?: { path?: string; message?: string }[]; detail?: unknown };
const bodyOf = (err: unknown): ErpErrorBody | undefined => {
  const data = (err as AxiosError<ErpErrorBody> | undefined)?.response?.data;
  return data && typeof data === 'object' ? data : undefined;
};

/** The HTTP status of a failed call; undefined for a network error or a non-HTTP throw. */
export function errorStatus(err: unknown): number | undefined {
  return (err as AxiosError | undefined)?.response?.status;
}

/**
 * The server's message for a failed notices call, shown verbatim. ERP bodies
 * carry no machine-readable code (the one exception is the Urgent gate's
 * `detail.code`, see isUrgentNotAllowed), so screens branch on errorStatus()
 * and never on this text. A Zod 400 lists its field messages, not "Validation failed".
 */
export function noticeErrorMessage(err: unknown, fallback?: string): string {
  const body = bodyOf(err);
  if (body?.error === 'Validation failed' && Array.isArray(body.details) && body.details.length > 0) {
    return body.details.map((d) => d.message).filter(Boolean).join('; ');
  }
  return extractErrorMessage(err, fallback);
}

/** The structured `detail` some errors carry (a REMINDER_LIMIT 409 carries `{ reminders }`). */
export function errorDetail<T>(err: unknown): T | undefined {
  const detail = bodyOf(err)?.detail;
  return detail && typeof detail === 'object' ? (detail as T) : undefined;
}

/** The Urgent gate's refusal: 403 `{ error, detail: { code: 'URGENT_NOT_ALLOWED' } }` (notifications spec §6.5). */
export function isUrgentNotAllowed(err: unknown): boolean {
  return errorStatus(err) === 403 && errorDetail<{ code?: unknown }>(err)?.code === 'URGENT_NOT_ALLOWED';
}

/** A failed publish: the Urgent refusal in the portal's words, anything else as noticeErrorMessage. */
export function publishErrorMessage(err: unknown): string {
  return isUrgentNotAllowed(err) ? URGENT_NOT_ALLOWED_MESSAGE : noticeErrorMessage(err);
}

// ── List and reach wording ───────────────────────────────────────────────

export function noticeStatus(row: Pick<NoticeRow, 'status' | 'delivery'>): { label: string; variant: 'info' | 'danger' | 'success' | 'default' } {
  if (row.delivery.state === 'failed') return { label: 'Delivery failed', variant: 'danger' };
  if (row.delivery.state === 'delivering') return { label: 'Delivering…', variant: 'info' };
  if (row.status === 'archived') return { label: 'Archived', variant: 'default' };
  return { label: 'Published', variant: 'success' };
}

export function deadlineText(row: Pick<NoticeRow, 'ackRequired' | 'deadline' | 'deadlineState'>): string {
  if (!row.ackRequired) return 'No acknowledgement';
  if (row.deadlineState === 'none' || !row.deadline) return 'No deadline';
  return `${row.deadlineState === 'open' ? 'Due' : 'Closed'} ${formatWhen(row.deadline)}`;
}

/** "acknowledged / seen / total"; acknowledged is a dash when none is asked for. */
export function countsText(row: Pick<NoticeRow, 'ackRequired' | 'acknowledged' | 'seen' | 'counts'>): string {
  return `${row.ackRequired ? row.acknowledged : '—'} / ${row.seen} / ${row.counts.audience}`;
}

/** The pending list as plain text, grouped as the server sorts it (US-4.2: copyable as text). */
export function pendingAsText(title: string, people: PendingPerson[]): string {
  const lines = [`Pending for "${title}": ${people.length}`];
  let group: string | null = null;
  for (const p of people) {
    if (p.group !== group) { group = p.group; lines.push('', group); }
    const id = p.identifier ? ` (${p.identifier})` : '';
    const seen = p.lastSeenInApp ? `, last in the app ${formatWhen(p.lastSeenInApp)}` : '';
    lines.push(`- ${p.name}${id}: ${PENDING_STATE_LABELS[p.state]}${seen}`);
  }
  return lines.join('\n');
}
