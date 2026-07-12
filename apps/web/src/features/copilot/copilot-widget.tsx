"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { createBrowserApiClient } from "@/lib/browser-api-client";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface Message {
  role: "user" | "assistant";
  text: string;
  reasoning?: string;
}

interface CopilotResponse {
  answer: string;
  sources: unknown[];
  model: string;
  stub: boolean;
}

const DEFAULT_BUILDING_ID = "9a83477a-4b19-444a-9345-0e07f90d16b0";
const PROXY_PREFIX = "/api/proxy";

const SUGGESTIONS = [
  "Summarise building health in 3 bullets.",
  "Which assets need attention right now?",
  "What should the facility manager check first?",
  "Why did the latest alert trigger?",
];

/* ─── Markdown renderer ──────────────────────────────────────────────────── */

const MD: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 text-[13px]">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc pl-4 last:mb-0 text-[13px]">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 last:mb-0 text-[13px]">{children}</ol>,
  li: ({ children }) => <li className="mb-0.5 leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith("language-");
    return (
      <code
        className={
          isBlock
            ? "block rounded bg-slate-100 px-1.5 py-0.5 text-[12px] font-mono text-slate-800"
            : "rounded bg-slate-100 px-1 py-0.5 text-[12px] font-mono text-slate-800"
        }
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-900 p-3 text-[12px] leading-relaxed last:mb-0">
      {children}
    </pre>
  ),
};

/* ─── SSE stream parser ──────────────────────────────────────────────────── */

async function* parseSSEStream(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") return;
          try {
            yield JSON.parse(data);
          } catch {
            /* skip malformed */
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface CopilotWidgetProps {
  /** Context hint to pass to the AI (e.g. page context) */
  contextHint?: string;
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function CopilotWidget({ contextHint }: CopilotWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant" as const, text: "Hi, I'm the facility AI copilot. Ask me anything about your building." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Streaming send ──
  const handleSend = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || loadingRef.current) return;

      setInput("");
      setMessages((prev) => [...prev, { role: "user", text: q }]);
      setLoading(true);
      loadingRef.current = true;

      setMessages((prev) => [...prev, { role: "assistant", text: "" }]);

      const body = JSON.stringify({
        question: q,
        building_id: DEFAULT_BUILDING_ID,
        context: contextHint || undefined,
      });

      try {
        const streamUrl = `${PROXY_PREFIX}/ai/copilot/query/stream`;
        const res = await fetch(streamUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          credentials: "same-origin",
        });

        if (!res.ok || !res.body) throw new Error("Stream unavailable");

        let accumulated = "";
        let accumulatedReasoning = "";
        let lastUpdate = Date.now();

        for await (const event of parseSSEStream(res.body)) {
          if (event.done) {
            setMessages((prev) => {
              const updated = [...prev];
              if (updated.length > 0) {
                updated[updated.length - 1] = {
                  role: "assistant",
                  text: accumulated,
                  reasoning: accumulatedReasoning || undefined,
                };
              }
              return updated;
            });
            break;
          }

          let updatedState = false;
          if (event.reasoning) {
            accumulatedReasoning += event.reasoning;
            updatedState = true;
          }
          if (event.token) {
            accumulated += event.token;
            updatedState = true;
          }

          if (updatedState) {
            const now = Date.now();
            if (now - lastUpdate > 60) {
              setMessages((prev) => {
                const updated = [...prev];
                if (updated.length > 0) {
                  updated[updated.length - 1] = {
                    role: "assistant",
                    text: accumulated,
                    reasoning: accumulatedReasoning || undefined,
                  };
                }
                return updated;
              });
              lastUpdate = now;
            }
          }
        }

        // Final flush
        setMessages((prev) => {
          const updated = [...prev];
          if (updated.length > 0) {
            updated[updated.length - 1] = {
              role: "assistant",
              text: accumulated,
              reasoning: accumulatedReasoning || undefined,
            };
          }
          return updated;
        });
      } catch {
        try {
          const api = createBrowserApiClient();
          const res = await api.post<CopilotResponse>("/ai/copilot/query", {
            question: q,
            building_id: DEFAULT_BUILDING_ID,
          });

          setMessages((prev) => {
            const updated = [...prev];
            if (updated.length > 0) {
              updated[updated.length - 1] = { role: "assistant", text: res.answer };
            }
            return updated;
          });
        } catch {
          setMessages((prev) => {
            const updated = [...prev];
            if (updated.length > 0) {
              updated[updated.length - 1] = {
                role: "assistant",
                text: "Sorry, I could not reach the AI service. Please check the connection and try again.",
              };
            }
            return updated;
          });
        }
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [contextHint],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  }

  return (
    <>
      {/* Floating pill button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-[#355fe5] to-[#3c73ff] px-4 py-3 text-[14px] font-medium text-white shadow-[0_8px_24px_rgba(53,95,229,0.35)] transition hover:shadow-[0_10px_30px_rgba(53,95,229,0.45)] hover:brightness-110 active:scale-95"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path d="M12 2a10 10 0 0 1 10 10c0 2.76-1.12 5.26-2.93 7.07"/>
          <circle cx="12" cy="12" r="4"/>
          <path d="M2 12a10 10 0 0 1 10-10"/>
        </svg>
        AI Copilot
      </button>

      {/* Slide-over panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="relative flex w-full max-w-[420px] flex-col bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#355fe5] to-[#3c73ff] text-white shadow-[0_4px_12px_rgba(50,92,255,0.2)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4M12 8h.01"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-[14px] font-semibold">AI Copilot</h2>
                  <p className="text-[11px] text-slate-500">Ask about your building</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[#355fe5] text-white"
                          : "border border-slate-200 bg-white text-slate-800 shadow-sm"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <p>{msg.text}</p>
                      ) : (
                        <div>
                          {msg.reasoning && (
                            <div className="mb-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2 text-[11px] text-slate-500">
                              <details open>
                                <summary className="cursor-pointer select-none text-[11px] font-medium text-slate-600">
                                  Thinking…
                                </summary>
                                <div className="mt-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed border-t border-slate-200/60 pt-1.5 text-slate-500/90">
                                  {msg.reasoning}
                                </div>
                              </details>
                            </div>
                          )}
                          {msg.text ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>
                              {msg.text}
                            </ReactMarkdown>
                          ) : (
                            !msg.reasoning && (
                              <div className="flex gap-1">
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Suggestions on first open */}
                {messages.length <= 2 && !loading && (
                  <div className="pt-2">
                    <p className="mb-2 text-[12px] font-medium text-slate-500">Try asking:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleSend(s)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-600 shadow-sm transition hover:border-[#355fe5] hover:text-[#355fe5]"
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
            <div className="border-t border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your building…"
                  disabled={loading}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[14px] outline-none transition focus:border-[#355fe5] focus:bg-white focus:shadow-[0_0_0_3px_rgba(53,95,229,0.1)] disabled:opacity-50"
                />
                <button
                  onClick={() => handleSend(input)}
                  disabled={!input.trim() || loading}
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-[#355fe5] text-white transition hover:bg-[#2a50cc] disabled:opacity-40"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 -rotate-90">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
