/**
 * AI command bar + inline chat thread — the same widget on every agent page,
 * pointed at a different SSE endpoint. Streams via `streamAgentQuery`.
 *
 * UX:
 *   - Always-visible compact bar with ✦ icon + input + ⌘K hint + suggestion chips
 *   - Focus or submit opens an inline thread panel below the bar
 *   - ⌘K / Ctrl+K anywhere on the page focuses the input
 *   - Esc blurs the input; if a stream is in flight, also aborts it
 *   - Close button in the thread header collapses + cancels in-flight streams
 *
 * State:
 *   - `conversationId` is persisted to localStorage per college + module so
 *     history survives reloads (the backend keeps the last 10 turns).
 *   - The active AbortController is held in a ref and torn down on unmount
 *     or when the user clears the thread.
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Sparkles, X } from 'lucide-react';

import { streamAgentQuery, type AgentChatFinal } from '../../services/agent';
import { useAuthStore } from '../../stores/authStore';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  pending?: boolean;
  final?: AgentChatFinal;
  error?: boolean;
}

export interface CommandBarProps {
  /** SSE path relative to the API base, e.g. `/juvi/people-agent/query`. */
  endpoint: string;
  /** Thread header, e.g. "Finance AI assistant". */
  title: string;
  /** localStorage namespace for the conversation id (suffixed with the college id). */
  storageKey: string;
  placeholder: string;
  suggestions: readonly string[];
  footer: string;
  /** Extra request body the backend understands (finance passes dashboard filters). */
  context?: unknown;
  /** Budget exceeded — input disabled, chips hidden. */
  degraded?: boolean;
}

/** Friendly, status-aware error text for an HTTP failure from the SSE endpoint. */
function errorMessageForStatus(status: number | undefined, fallback: string): string {
  if (status === 429) return 'Slow down — try again in a minute.';
  if (status === 503) return 'AI assistant is temporarily unavailable.';
  if (status === 401) return 'Session expired — please log in again.';
  if (status === 403) return "You don't have access to the AI assistant.";
  return fallback || 'AI assistant is temporarily unavailable.';
}

export default function CommandBar({
  endpoint, title, storageKey, placeholder, suggestions, footer, context, degraded = false,
}: CommandBarProps) {
  const collegeId = useAuthStore((s) => s.collegeId);
  const convoStorageKey = collegeId ? `${storageKey}:${collegeId}` : null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(() => {
    if (!convoStorageKey) return undefined;
    return localStorage.getItem(convoStorageKey) ?? undefined;
  });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  // Auto-scroll the THREAD BOX only, and only while the reader is at its
  // bottom — never the page, never against someone re-reading an answer.
  const stickToBottom = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        if (document.activeElement === inputRef.current) inputRef.current?.blur();
        if (abortRef.current && !abortRef.current.signal.aborted) abortRef.current.abort();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = threadRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);
  const onThreadScroll = () => {
    const el = threadRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  useEffect(() => {
    return () => {
      if (abortRef.current && !abortRef.current.signal.aborted) abortRef.current.abort();
    };
  }, []);

  const patchPending = (id: string, patch: (m: ChatMessage) => ChatMessage) =>
    setMessages((m) => m.map((msg) => (msg.id === id ? patch(msg) : msg)));

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (abortRef.current && !abortRef.current.signal.aborted) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const userMsgId = `u-${Date.now()}`;
    const pendingMsgId = `a-${Date.now() + 1}`;
    setMessages((m) => [
      ...m,
      { id: userMsgId, role: 'user', text: trimmed },
      { id: pendingMsgId, role: 'ai', text: '', pending: true },
    ]);
    setInput('');
    setIsOpen(true);
    stickToBottom.current = true;
    // Keep the caret in the composer without letting focus() scroll the page.
    inputRef.current?.focus({ preventScroll: true });
    // Opening the thread is the ONE deliberate page move: bring the panel to the
    // top so the whole conversation (capped to fit) is in view. After that the
    // page never moves — the transcript scrolls inside itself.
    if (messages.length === 0) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ block: 'start' }));
    }

    try {
      for await (const evt of streamAgentQuery(endpoint, {
        prompt: trimmed, conversationId, context, signal: ac.signal,
      })) {
        if (evt.type === 'delta') {
          patchPending(pendingMsgId, (msg) => ({ ...msg, text: msg.text + evt.text, pending: true }));
        } else if (evt.type === 'done') {
          patchPending(pendingMsgId, (msg) => ({ ...msg, pending: false, final: evt.final }));
          if (evt.final.conversationId) {
            setConversationId(evt.final.conversationId);
            if (convoStorageKey) localStorage.setItem(convoStorageKey, evt.final.conversationId);
          }
        } else if (evt.type === 'error') {
          // After deltas, keep the partial text and mark the drop; otherwise
          // replace the pending bubble with a status-specific message.
          patchPending(pendingMsgId, (msg) =>
            msg.text && evt.error === 'connection lost'
              ? { ...msg, text: `${msg.text} (connection lost)`, pending: false, error: true }
              : { ...msg, text: errorMessageForStatus(evt.status, evt.error), pending: false, error: true },
          );
        }
      }
    } catch (e) {
      const cancelled = e instanceof Error && e.name === 'AbortError';
      patchPending(pendingMsgId, (msg) => ({
        ...msg,
        text: cancelled ? (msg.text ? `${msg.text} (cancelled)` : 'Cancelled.') : 'AI assistant is temporarily unavailable.',
        pending: false,
        error: true,
      }));
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const clear = () => {
    if (abortRef.current && !abortRef.current.signal.aborted) abortRef.current.abort();
    setMessages([]);
    setIsOpen(false);
    setInput('');
  };

  const hasThread = isOpen && messages.length > 0;

  return (
    <div ref={panelRef} className="mb-4 scroll-mt-4" data-testid="command-bar" style={{ overflowAnchor: 'none' }}>
      <div
        className={`bg-white border rounded-2xl transition-shadow ${
          isOpen
            ? 'border-violet-300 shadow-[0_0_0_2px_rgba(139,92,246,0.12),0_4px_20px_rgba(139,92,246,0.1)]'
            : 'border-violet-200 shadow-[0_0_0_1px_rgba(139,92,246,0.08),0_2px_10px_rgba(139,92,246,0.05)]'
        }`}
      >
        {/* Thread — above the composer, like every chat; scrolls inside itself. */}
        {hasThread && (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
                  <Sparkles size={11} />
                </div>
                <div className="text-xs font-semibold text-slate-700">{title}</div>
                <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">
                  Preview
                </span>
              </div>
              <button
                type="button"
                onClick={clear}
                aria-label="Clear conversation"
                className="h-6 w-6 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>
            <div
              ref={threadRef}
              onScroll={onThreadScroll}
              data-testid="command-bar-thread"
              className="max-h-[55vh] overflow-y-auto px-4 py-3 space-y-3 border-b border-slate-100"
            >
              {messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[80%] bg-gradient-to-br from-blue-600 to-teal-500 text-white text-sm rounded-2xl rounded-br-sm px-3.5 py-2">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex flex-col">
                    <div className="flex justify-start gap-2">
                      <div className="flex-shrink-0 h-6 w-6 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white mt-0.5">
                        <Sparkles size={11} />
                      </div>
                      <div
                        className={`max-w-[80%] text-sm rounded-2xl rounded-bl-sm px-3.5 py-2 border whitespace-pre-wrap ${
                          m.error ? 'bg-red-50 text-red-800 border-red-200' : 'bg-slate-50 text-slate-800 border-slate-100'
                        }`}
                      >
                        {m.pending && !m.text ? (
                          <span className="inline-flex items-center gap-2 text-slate-500">
                            <Loader2 size={12} className="animate-spin" />
                            Thinking…
                          </span>
                        ) : (
                          <>
                            {m.text}
                            {m.pending && (
                              <span className="inline-block ml-1 w-1.5 h-3 bg-slate-400 align-middle animate-pulse" />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {m.final && !m.error && (
                      <div className="text-[10px] text-slate-400 mt-1 ml-8">
                        {`\u2726 ${m.final.provider} \u00B7 ${m.final.model} \u00B7 ${(m.final.durationMs / 1000).toFixed(1)}s \u00B7 ${m.final.inputTokens}\u2192${m.final.outputTokens} tokens`}
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          </>
        )}

        {/* Composer — always visible, always at the bottom of the panel. */}
        <form onSubmit={onSubmit} className="flex items-center gap-3 px-4 py-3">
          <div className="flex-shrink-0 h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
            <Sparkles size={14} />
          </div>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={degraded ? 'AI assistant disabled — weekly budget exceeded.' : hasThread ? 'Ask a follow-up…' : placeholder}
            disabled={degraded}
            aria-disabled={degraded}
            aria-label={title}
            className="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
          />
          {input.trim() ? (
            <button
              type="submit"
              aria-label="Send"
              disabled={degraded}
              className="flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white flex items-center justify-center hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={14} />
            </button>
          ) : (
            <kbd className="flex-shrink-0 text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
              ⌘K
            </kbd>
          )}
        </form>
        {!degraded && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-3 border-t border-slate-50 pt-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="text-[11px] font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {hasThread && (
          <div className="px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400">{footer}</div>
        )}
      </div>
    </div>
  );
}
