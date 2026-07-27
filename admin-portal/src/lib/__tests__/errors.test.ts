import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import { extractErrorMessage, defaultSuccessTitle } from '../errors';

function axiosErr(partial: Partial<AxiosError>): AxiosError {
  return { isAxiosError: true, ...partial } as AxiosError;
}

describe('extractErrorMessage', () => {
  it('prefers the API error field', () => {
    expect(extractErrorMessage(axiosErr({ response: { data: { error: 'Roll number already taken' } } as any })))
      .toBe('Roll number already taken');
  });

  it('falls back to the message field', () => {
    expect(extractErrorMessage(axiosErr({ response: { data: { message: 'Nope' } } as any })))
      .toBe('Nope');
  });

  it('flattens Zod-style field errors', () => {
    const err = axiosErr({
      response: { data: { errors: [{ path: ['body', 'email'], message: 'Invalid email' }] } } as any,
    });
    expect(extractErrorMessage(err)).toBe('body.email: Invalid email');
  });

  it('handles a plain string body', () => {
    expect(extractErrorMessage(axiosErr({ response: { data: 'Server exploded' } as any })))
      .toBe('Server exploded');
  });

  it('explains a network failure rather than showing the axios code', () => {
    expect(extractErrorMessage(axiosErr({ code: 'ERR_NETWORK' })))
      .toMatch(/Network unreachable/);
  });

  it('maps bare status codes to something a user can act on', () => {
    expect(extractErrorMessage(axiosErr({ response: { status: 403, data: {} } as any })))
      .toMatch(/do not have permission/);
    expect(extractErrorMessage(axiosErr({ response: { status: 409, data: {} } as any })))
      .toMatch(/already exists|conflicts/);
    expect(extractErrorMessage(axiosErr({ response: { status: 500, data: {} } as any })))
      .toMatch(/server encountered an error/i);
  });

  it('uses a plain Error message', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('falls back for an unrecognised value', () => {
    expect(extractErrorMessage(null, 'fallback')).toBe('fallback');
  });
});

describe('defaultSuccessTitle', () => {
  it('maps known actions to past tense', () => {
    expect(defaultSuccessTitle('create')).toBe('Created successfully');
    expect(defaultSuccessTitle('update')).toBe('Changes saved');
    expect(defaultSuccessTitle('delete')).toBe('Deleted successfully');
  });

  it('has a neutral default', () => {
    expect(defaultSuccessTitle()).toBe('Saved successfully');
  });
});
