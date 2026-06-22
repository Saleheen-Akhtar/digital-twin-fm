"use client";

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { createBrowserApiClient, type BrowserApiClient } from '@/lib/browser-api-client';

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

/* ─── Suggested questions ─────────────────────────────────────────────────── */

const SUGGESTIONS = [
  'Summarise building health in 3 bullets.',
  'Which assets need attention right now?',
  'What should the facility manager check first?',
  'Why did the latest alert trigger?',
];

/* ─── Context fetching ─────────────────────────────────────────────────────── */

interface CopilotContext {
  building_health: Record<string, unknown> | null;
  active_alerts: unknown[];
  sensor_summary: Record<string, unknown>;
}

async function fetchCopilotContext(api: BrowserApiClient): Promise<CopilotContext> {
  const defaults: CopilotContext = {
    building_health: null,
    active_alerts: [],
    sensor_summary: {},
  };

  try {
    const [buildingRes, alerts] = await Promise.all([
      api.get<{ found: boolean; snapshot: Record<string, unknown> }>(
        `/building/snapshot?buildingId=${DEFAULT_BUILDING_ID}`,
      ),
      api.get<unknown[]>('/alerts?limit=20'),
    ]);

    return {
      building_health: buildingRes?.found ? buildingRes.snapshot : null,
      active_alerts: Array.isArray(alerts) ? alerts.slice(0, 20) : [],
      sensor_summary: {},
    };
  } catch {
    // Context fetch failure is non-fatal — copilot still works with less info
    return defaults;
  }
}

/* ─── Markdown renderer overrides ─────────────────────────────────────────── */

const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="mb-0.5 leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  code: ({ children }) => (
    <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[13px] font-mono text-slate-800">
      {children}
    </code>
  ),
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
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#355fe5] underline underline-offset-2 hover:text-[#2a50cc]">
      {children}
    </a>
  ),
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant' as const, text: 'Hi, I\'m the facility AI copilot. Ask me anything about your building.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading]);

  async function handleSend(question: string) {
    const q = question.trim();
    if (!q || loading) return;

    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setLoading(true);

    try {
      const api = createBrowserApiClient();

      // Fetch building context, then send the copilot query with it
      const context = await fetchCopilotContext(api);

      const res = await api.post<CopilotResponse>('/ai/copilot/query', {
        question: q,
        building_id: DEFAULT_BUILDING_ID,
        context: context as unknown as Record<string, unknown>,
      });

      setMessages((prev) => [...prev, { role: 'assistant', text: res.answer }]);
    } catch (err: unknown) {
      const fallback = 'Sorry, I couldn\'t reach the AI service. Please check the connection and try again.';
      setMessages((prev) => [...prev, { role: 'assistant', text: err instanceof Error ? err.message : fallback }]);
    } finally {
      setLoading(false);
    }
  }

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
            <p className="text-[13px] text-slate-500">DeepSeek V4 Flash via OpenCode Zen</p>
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
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        ...MARKDOWN_COMPONENTS,
                        code: ({ className, children, ...props }) => {
                          const isBlock = className?.startsWith('language-');
                          if (isBlock) {
                            return (
                              <code
                                className="block rounded-md bg-slate-100 px-1.5 py-0.5 text-[13px] font-mono text-slate-800"
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          }
                          return (
                            <code
                              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[13px] font-mono text-slate-800"
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
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
