import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'events';
import type { Request, Response } from 'express';

import { streamSse, type SseChunk } from '../sse';

function fakeRes() {
  const headers: Record<string, string> = {};
  const out: string[] = [];
  let ended = false;
  const res = {
    setHeader: (k: string, v: string) => { headers[k] = v; },
    flushHeaders: () => undefined,
    write: (s: string) => { out.push(s); return true; },
    end: () => { ended = true; },
  } as unknown as Response;
  return { res, headers, out, isEnded: () => ended };
}

describe('streamSse', () => {
  it('writes delta/done events in wire format, sets no-buffer headers, ends the response', async () => {
    const req = new EventEmitter() as unknown as Request;
    const { res, headers, out, isEnded } = fakeRes();
    async function* run(): AsyncIterable<SseChunk> {
      yield { type: 'delta', text: 'hi' };
      yield { type: 'done', final: { model: 'm' } };
    }
    await streamSse(req, res, run);
    expect(headers['Content-Type']).toBe('text/event-stream');
    expect(headers['X-Accel-Buffering']).toBe('no');
    expect(out).toEqual([
      'event: delta\ndata: {"text":"hi"}\n\n',
      'event: done\ndata: {"model":"m"}\n\n',
    ]);
    expect(isEnded()).toBe(true);
  });

  it('turns a mid-stream throw into an error event and aborts upstream on client close', async () => {
    const req = new EventEmitter() as unknown as Request;
    const { res, out, isEnded } = fakeRes();
    let seenSignal: AbortSignal | undefined;
    async function* run(signal: AbortSignal): AsyncIterable<SseChunk> {
      seenSignal = signal;
      yield { type: 'delta', text: 'a' };
      (req as unknown as EventEmitter).emit('close');
      throw new Error('upstream died');
    }
    await streamSse(req, res, run);
    expect(seenSignal?.aborted).toBe(true);
    expect(out[1]).toBe('event: error\ndata: {"message":"upstream died"}\n\n');
    expect(isEnded()).toBe(true);
  });
});
