import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { ChannelTemplate } from '../../models/juvi/ChannelTemplate';
import { seedChannelTemplates } from '../../shared/seed/channel-templates';

let fx: BaseFixtures;
beforeAll(async () => { await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

describe('seedChannelTemplates', () => {
  it('inserts five rows once and preserves admin edits on re-run', async () => {
    expect(await seedChannelTemplates(fx.collegeId)).toEqual({ created: 5, existing: 0 });
    await ChannelTemplate.updateOne({ collegeId: fx.collegeId, code: 'batch' }, { $set: { replyRule: 'announcement_only' } });
    expect(await seedChannelTemplates(fx.collegeId)).toEqual({ created: 0, existing: 5 });
    expect((await ChannelTemplate.findOne({ collegeId: fx.collegeId, code: 'batch' }).lean())?.replyRule).toBe('announcement_only');
    expect(await ChannelTemplate.countDocuments({ collegeId: fx.collegeId })).toBe(5);
  });
});
