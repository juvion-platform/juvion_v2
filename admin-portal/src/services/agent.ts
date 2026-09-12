/**
 * Generic agent client — the ONE SSE parser in the portal.
 *
 * Every module command bar streams through `streamAgentQuery(path, opts)`;
 * `services/finance-agent.ts` is a thin wrapper that pins the finance path.
 * Uses native `fetch` + a stream reader because `EventSource` cannot send a
 * POST body or an Authorization header.
 *
 * Backend wire format (see backend/src/shared/ai/sse.ts):
 *
 *   event: delta\ndata: {"text":"..."}\n\n
 *   event: done\ndata: {"provider":..,"model":..,"auditId":..,"conversationId":..}\n\n
 *   event: error\ndata: {"message":"..."}\n\n
 */
import api from './api';
import { useAuthStore } from '../stores/authStore';

export interface BudgetWarning {
  spent: number;
  limit: number;
  /** 0..100 */
  pct: number;
  /** ISO timestamp; next Monday 00:00 UTC. */
  resetsAt: string;
}

export interface AgentChatFinal {
  provider: 'claude' | 'openai';
  model: string;
  inputTokens: number;
  outputTokens: number;
  costInr: number;
  durationMs: number;
  auditId: string;
  conversationId: string;
  budgetWarning?: BudgetWarning;
}

export type StreamQueryEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; final: AgentChatFinal }
  | { type: 'error'; status?: number; error: string };

export interface StreamQueryOpts {
  prompt: string;
  conversationId?: string;
  /** Module-specific extra body (finance passes dashboard filters). */
  context?: unknown;
  signal?: AbortSignal;
}

/**
 * Parse one SSE event block (everything between two blank lines) into a
 * `{ event, data }` pair. Returns `null` for blocks without both lines or
 * with malformed JSON. Tolerates `\r\n` line endings.
 */
function parseSseEvent(block: string): { event: string; data: unknown } | null {
  let event = '';
  let dataRaw = '';
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice('event:'.length).trim();
    else if (line.startsWith('data:')) dataRaw += (dataRaw ? '\n' : '') + line.slice('data:'.length).trim();
  }
  if (!event || !dataRaw) return null;
  try {
    return { event, data: JSON.parse(dataRaw) };
  } catch {
    return null;
  }
}

function toEvent(parsed: { event: string; data: unknown } | null): StreamQueryEvent | null {
  if (!parsed) return null;
  if (parsed.event === 'delta') {
    const text = (parsed.data as { text?: unknown } | null)?.text;
    return typeof text === 'string' ? { type: 'delta', text } : null;
  }
  if (parsed.event === 'done') return { type: 'done', final: parsed.data as AgentChatFinal };
  if (parsed.event === 'error') {
    const message = (parsed.data as { message?: unknown } | null)?.message;
    return { type: 'error', error: typeof message === 'string' ? message : 'Stream error' };
  }
  return null;
}

/**
 * Stream a chat query against an agent SSE endpoint. `path` is relative to
 * the API base (`/juvi/finance-agent/query`), so the production build with
 * `VITE_API_URL` set reaches the same host axios does.
 *
 * Error handling:
 *  - non-2xx HTTP → single `{ type: 'error', status, error }` then return
 *  - aborted by signal → `AbortError` propagates; caller should catch
 *  - connection drops mid-stream → synthetic `'connection lost'` error event
 */
export async function* streamAgentQuery(
  path: string,
  opts: StreamQueryOpts,
): AsyncGenerator<StreamQueryEvent, void, void> {
  const { token, collegeId } = useAuthStore.getState();
  const base = (api.defaults.baseURL ?? '/api').replace(/\/$/, '');

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(collegeId ? { 'x-college-id': collegeId } : {}),
      },
      body: JSON.stringify({
        prompt: opts.prompt,
        conversationId: opts.conversationId,
        context: opts.context,
      }),
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    yield { type: 'error', error: e instanceof Error ? e.message : 'Network error' };
    return;
  }

  if (!response.ok) {
    yield { type: 'error', status: response.status, error: `HTTP ${response.status}` };
    return;
  }
  if (!response.body) {
    yield { type: 'error', error: 'Empty response body' };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawDone = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Events are separated by a blank line; the remainder stays buffered.
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? '';
      for (const block of parts) {
        const evt = toEvent(block.trim() ? parseSseEvent(block) : null);
        if (!evt) continue;
        if (evt.type === 'done') sawDone = true;
        yield evt;
      }
    }
    // Flush a final event the server did not terminate with a blank line.
    const tail = toEvent(buffer.trim() ? parseSseEvent(buffer.trim()) : null);
    if (tail) {
      if (tail.type === 'done') sawDone = true;
      yield tail;
    }
    if (!sawDone) yield { type: 'error', error: 'connection lost' };
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // releaseLock throws if a read is still pending; safe to ignore.
    }
  }
}
