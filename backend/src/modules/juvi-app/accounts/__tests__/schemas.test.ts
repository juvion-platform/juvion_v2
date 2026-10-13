import { describe, it, expect } from 'vitest';
import { signInSchema } from '../schemas';

const DEVICE = { id: 'device-0001', name: 'Pixel 7', platform: 'android' as const, appVersion: '1.0.0', osVersion: '14' };

const SHAPE_MESSAGE = "That doesn't look like a Juvi ID. It looks like JUV-4K7P-2M9X.";

/** The `juviId` field's messages, in the order zod reports them. */
function juviIdMessages(juviId: string): string[] {
  const r = signInSchema.safeParse({ juviId, password: 'river-lamp-482', device: DEVICE });
  if (r.success) throw new Error('expected the input to be rejected');
  return r.error.issues.filter((i) => i.path.join('.') === 'juviId').map((i) => i.message);
}

describe('signInSchema — R-C names the shape, whatever was mistyped', () => {
  it('names the shape for a roll number', () => {
    expect(juviIdMessages('21CS1042')).toEqual([SHAPE_MESSAGE]);
  });

  // An email is one of the three inputs §13 says stop working, and it is longer than the field's
  // old `max(32)` bound. zod reports the bound before the refine, so a bound below the mistyped
  // length demotes the shape message and the person is told about characters instead of the ID.
  it('names the shape for an email, rather than its length', () => {
    expect(juviIdMessages('ramakrishna.reddy@college.example.in')).toEqual([SHAPE_MESSAGE]);
  });

  it('names the shape for a spaced, grouped transcription that is otherwise plausible', () => {
    expect(juviIdMessages('JUV-4K7P-2M9X-EXTRA')).toEqual([SHAPE_MESSAGE]);
  });
});
