/**
 * Product analytics from the app (notifications spec §7.3, NFR-11). Only
 * allow-listed names, and props that are ids, enums, numbers or booleans — that
 * is how "no content or PII" is enforced on the server. Invalid events are
 * dropped one by one.
 */
import { z } from 'zod';
import { JuviEvent, JuviEventProps } from '../../../models/juvi/JuviEvent';
import { MobileContext } from '../middleware/authenticate-mobile';

export const EVENT_NAMES = [
  'app.opened', 'account.signed_in',
  'onboarding.step_completed', 'onboarding.completed',
  'settings.changed', 'channel.muted',
  'notice.seen', 'notice.acknowledged', 'notice.dismissed',
  'notification.opened', 'notification.permission',
  'permission_card.shown', 'permission_card.dismissed',
  'timeline.class_opened', 'glance.opened',
  'post_class_prompt.shown', 'post_class_prompt.opened',
] as const;

export const EVENTS_MAX = 100;
export const PROPS_MAX_KEYS = 10;
export const PROPS_MAX_BYTES = 1024;
const PROP_STRING = /^[A-Za-z0-9_.:-]*$/;
const propString = z.string().max(64).regex(PROP_STRING);

/** One event. Each prop value is a string of ≤ 64 id-like characters, a number or a boolean: free text is refused. */
export const eventItemSchema = z.object({
  name: z.enum(EVENT_NAMES),
  at: z.string().datetime({ offset: true }),
  props: z.record(propString, z.union([propString, z.number().finite(), z.boolean()]))
    .refine((p) => Object.keys(p).length <= PROPS_MAX_KEYS, `At most ${PROPS_MAX_KEYS} props`)
    .refine((p) => Buffer.byteLength(JSON.stringify(p)) <= PROPS_MAX_BYTES, 'Props must serialise to 1 KB or less')
    .default({}),
}).strict();

export interface ValidEvent { name: (typeof EVENT_NAMES)[number]; at: Date; props: JuviEventProps }

/** The event if it passes every rule, otherwise null. */
export function validEvent(raw: unknown): ValidEvent | null {
  const r = eventItemSchema.safeParse(raw);
  return r.success ? { name: r.data.name, at: new Date(r.data.at), props: r.data.props } : null;
}

export async function ingestEvents(
  ctx: MobileContext, events: unknown[], meta: { appVersion: string; platform: string }, now: Date = new Date(),
): Promise<{ accepted: number; rejected: number }> {
  const valid = events.map(validEvent).filter((e): e is ValidEvent => e !== null);
  if (valid.length > 0) {
    await JuviEvent.insertMany(valid.map((e) => ({
      collegeId: ctx.collegeId, accountId: ctx.accountId, name: e.name, at: e.at, props: e.props,
      appVersion: meta.appVersion.slice(0, 32), platform: meta.platform.slice(0, 16), receivedAt: now,
    })));
  }
  return { accepted: valid.length, rejected: events.length - valid.length };
}
