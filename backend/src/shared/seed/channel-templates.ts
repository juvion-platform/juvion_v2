import { ChannelTemplate } from '../../models/juvi/ChannelTemplate';
import { DEFAULT_CHANNEL_TEMPLATES } from '../../modules/juvi-app/spaces/templates';

/**
 * Idempotent: inserts any of the five templates the college lacks and never
 * overwrites an existing row, so admin edits (sub-project 6) survive re-seeds.
 */
export async function seedChannelTemplates(collegeId: string): Promise<{ created: number; existing: number }> {
  let created = 0; let existing = 0;
  for (const t of DEFAULT_CHANNEL_TEMPLATES) {
    const result = await ChannelTemplate.updateOne(
      { collegeId, code: t.code },
      { $setOnInsert: { ...t, collegeId, isEnabled: true } },
      { upsert: true },
    );
    if (result.upsertedCount && result.upsertedCount > 0) created += 1; else existing += 1;
  }
  return { created, existing };
}
