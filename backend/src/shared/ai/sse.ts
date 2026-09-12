import type { Request, Response } from 'express';

/**
 * The one SSE writer. Every agent `/query` endpoint streams through here so
 * the wire format (`event: delta|done|error` + JSON `data:`), the nginx
 * no-buffer header and the client-disconnect → upstream-abort wiring exist
 * exactly once. The admin-portal parser in `services/agent.ts` is the other
 * half of this contract.
 */
export interface SseChunk {
  type: 'delta' | 'done' | 'error';
  text?: string;
  final?: unknown;
  error?: string;
}

export async function streamSse(
  req: Request,
  res: Response,
  run: (signal: AbortSignal) => AsyncIterable<SseChunk>,
): Promise<void> {
  // Headers go out BEFORE the first write. `X-Accel-Buffering: no` keeps
  // nginx from buffering the stream in production deployments.
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const ac = new AbortController();
  const onClose = (): void => {
    if (!ac.signal.aborted) ac.abort();
  };
  req.on('close', onClose);

  const write = (event: string, data: unknown): void => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    for await (const chunk of run(ac.signal)) {
      if (chunk.type === 'delta') write('delta', { text: chunk.text ?? '' });
      else if (chunk.type === 'done') write('done', chunk.final ?? {});
      else write('error', { message: chunk.error ?? 'unknown' });
    }
  } catch (e) {
    // Headers are already flushed, so Express' error handler cannot turn
    // this into a status code. Tell the client on the stream instead.
    write('error', { message: e instanceof Error ? e.message : String(e) });
  } finally {
    req.off('close', onClose);
    res.end();
  }
}
