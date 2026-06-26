"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { createBrowserApiClient } from '@/lib/browser-api-client';

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

interface CopilotResponse {
  answer: string;
  sources: unknown[];
  model: string;
  stub: boolean;
}

const DEFAULT_BUILDING_ID = '9a83477a-4b19-444a-9345-0e07f90d16b0';
const PROXY_PREFIX = '/api/proxy';

/* ─── Suggested questions ─────────────────────────────────────────────────── */

const SUGGESTIONS = [
  'Summarise building health in 3 bullets.',
  'Which assets need attention right now?',
  'What should the facility manager check first?',
  'Why did the latest alert trigger?',
];

/* ─── Markdown renderer overrides ─────────────────────────────────────────── */

const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="mb-0.5 leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith('language-');
    return (
      <code
        className={
          isBlock
            ? 'block rounded-md bg-slate-100 px-1.5 py-0.5 text-[13px] font-mono text-slate-800'
            : 'rounded-md bg-slate-100 px-1.5 py-0.5 text-[13px] font-mono text-slate-800'
        }
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 p-4 text-[13px] leading-relaxed last:mb-0">
      {children}
    </pre>
  ),
  h1: ({ children }) => <h1 className="mb-2 text-lg font-semibold last:mb-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 text-[17px] font-semibold last:mb-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 text-[15px] font-semibold last:mb-0">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-4 border-slate-300 pl-4 italic text-slate-600 last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-slate-200" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#355fe5] underline underline-offset-2 hover:text-[#2a50cc]"
    >
      {children}
    </a>
  ),
};

/* ─── SSE stream parser ──────────────────────────────────────────────────── */

async function* parseSSEStream(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last partial line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          try {
            yield JSON.parse(data);
          } catch {
            // skip malformed lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant' as const, text: "Hi, I'm the facility AI copilot. Ask me anything about your building." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading]);

  // ── Streaming send ──
  const handleSend = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || loadingRef.current) return;

    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    loadingRef.current = true;

    // Add a placeholder assistant message that will be filled incrementally
    const msgIdx = messages.length + 1; // after the user message we're about to add
    setMessages((prev) => [...prev, { role: 'assistant', text: '' }]);

    const body = JSON.stringify({
      question: q,
      building_id: DEFAULT_BUILDING_ID,
    });

    try {
      // Attempt streaming first
      const streamUrl = `${PROXY_PREFIX}/ai/copilot/query/stream`;
      const res = await fetch(streamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        credentials: 'same-origin',
      });

      if (!res.ok || !res.body) {
        throw new Error('Stream unavailable');
      }

      let accumulated = '';

      for await (const event of parseSSEStream(res.body)) {
        if (event.done) {
          // Stream complete — verify the message is finalised
          setMessages((prev) => {
            const updated = [...prev];
            if (updated.length > 0) {
              updated[updated.length - 1] = {
                role: 'assistant',
                text: accumulated,
              };
            }
            return updated;
          });
          break;
        }

        if (event.token) {
          accumulated += event.token;
          setMessages((prev) => {
            const updated = [...prev];
            if (updated.length > 0) {
              updated[updated.length - 1] = {
                role: 'assistant',
                text: accumulated,
              };
            }
            return updated;
          });
        }
      }
    } catch {
      // Streaming failed — fall back to non-streaming
      try {
        const api = createBrowserApiClient();
        const res = await api.post<CopilotResponse>('/ai/copilot/query', {
          question: q,
          building_id: DEFAULT_BUILDING_ID,
        });

        setMessages((prev) => {
          const updated = [...prev];
          if (updated.length > 0) {
            updated[updated.length - 1] = { role: 'assistant', text: res.answer };
          }
          return updated;
        });
      } catch (err: unknown) {
        const fallback = 'Sorry, I could not reach the AI service. Please check the connection and try again.';
        setMessages((prev) => {
          const updated = [...prev];
          if (updated.length > 0) {
            updated[updated.length - 1] = {
              role: 'assistant',
              text: err instanceof Error ? err.message : fallback,
            };
          }
          return updated;
        });
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [messages, loadingRef]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#355fe5] to-[#3c73ff] text-white shadow-[0_4px_12px_rgba(50,92,255,0.2)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4M12 8h.01"/>
            </svg>
          </div>
          <div>
            <h1 className="text-[17px] font-semibold">AI Copilot</h1>
            <p className="text-[13px] text-slate-500">Building intelligence, in real time</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#355fe5] text-white shadow-[0_4px_14px_rgba(53,95,229,0.25)]'
                    : 'bg-white border border-slate-200 text-slate-800 shadow-sm'
                }`}
              >
                {msg.role === 'user' ? (
                  <p>{msg.text}</p>
                ) : (
                  <div className="prose prose-slate prose-sm max-w-none">
                    {msg.text ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                        {msg.text}
                      </ReactMarkdown>
                    ) : (
                      <div className="flex gap-1.5">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading dots for the non-streaming fallback case — hidden when streaming is active */}
          {loading && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.text === '' && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">
              {error}
            </div>
          )}

          {/* Suggestions shown when there are only initial messages */}
          {messages.length <= 2 && !loading && (
            <div className="pt-4">
              <p className="mb-3 text-[13px] font-medium text-slate-500">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] text-slate-600 shadow-sm transition hover:border-[#355fe5] hover:text-[#355fe5]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI copilot anything..."
            disabled={loading}
            className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] outline-none transition focus:border-[#355fe5] focus:bg-white focus:shadow-[0_0_0_3px_rgba(53,95,229,0.1)] disabled:opacity-50"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || loading}
            className="flex h-[46px] w-[46px] items-center justify-center rounded-2xl bg-[#355fe5] text-white shadow-[0_4px_12px_rgba(53,95,229,0.25)] transition hover:bg-[#2a50cc] disabled:opacity-40 disabled:shadow-none"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 -rotate-90">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
