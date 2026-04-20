"use client";
import { useState, useRef, useEffect, type CSSProperties, type KeyboardEvent, type HTMLAttributes } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

type Mode = "chat" | "document" | "research";
// All 5 pipeline steps surfaced individually
type TraceStep = "plan" | "retrieve" | "analysis" | "refine" | "output";

const BASE_URL = process.env.BASE_URL;
interface Trace {
  step: TraceStep;
  trace: string;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  time: string;
  mode?: Mode;
  traces: Trace[];
  sources: string[] | null;
}

// ─── Utility ────────────────────────────────────────────────────────────────
function timestamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Markdown renderer ──────────────────────────────────────────────────────
function MDContent({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({
          inline,
          className,
          children,
          ...props
        }: HTMLAttributes<HTMLElement> & { inline?: boolean; className?: string }) {
          const match = /language-(\w+)/.exec(className || "");
          return !inline && match ? (
            <SyntaxHighlighter
              style={oneDark as Record<string, CSSProperties>}
              language={match[1]}
              PreTag="div"
            >
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          ) : (
            <code
              style={{
                background: "rgba(255,255,255,0.07)",
                padding: "2px 6px",
                borderRadius: 5,
                fontFamily: "monospace",
                fontSize: "0.88em",
                color: "rgba(255,255,255,0.85)",
              }}
              {...props}
            >
              {children}
            </code>
          );
        },
        p: ({ children }) => <p style={{ margin: "0 0 8px", lineHeight: 1.65 }}>{children}</p>,
        ul: ({ children }) => <ul style={{ paddingLeft: 18, margin: "4px 0 8px" }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ paddingLeft: 18, margin: "4px 0 8px" }}>{children}</ol>,
        li: ({ children }) => <li style={{ marginBottom: 3 }}>{children}</li>,
        h1: ({ children }) => <h1 style={{ fontSize: "1.25em", fontWeight: 600, margin: "12px 0 6px", color: "rgba(255,255,255,0.92)" }}>{children}</h1>,
        h2: ({ children }) => <h2 style={{ fontSize: "1.1em", fontWeight: 600, margin: "10px 0 5px", color: "rgba(255,255,255,0.88)" }}>{children}</h2>,
        h3: ({ children }) => <h3 style={{ fontSize: "1em", fontWeight: 600, margin: "8px 0 4px", color: "rgba(255,255,255,0.85)" }}>{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote style={{ borderLeft: "2px solid rgba(255,255,255,0.15)", paddingLeft: 12, margin: "6px 0", color: "rgba(255,255,255,0.55)", fontStyle: "italic" }}>
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer" style={{ color: "rgba(180,160,255,0.85)", textDecoration: "underline" }}>
            {children}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

// ─── Research trace bubble ───────────────────────────────────────────────────
const STEP_META: Record<TraceStep, { label: string; color: string; dot: string }> = {
  plan:     { label: "Planning",    color: "rgba(110,70,240,0.25)",  dot: "rgba(150,110,255,0.9)" },
  retrieve: { label: "Retrieving",  color: "rgba(60,140,255,0.20)",  dot: "rgba(100,170,255,0.9)" },
  analysis: { label: "Analyzing",   color: "rgba(230,140,40,0.20)",  dot: "rgba(255,180,60,0.9)"  },
  refine:   { label: "Refining",    color: "rgba(60,190,160,0.20)",  dot: "rgba(80,215,185,0.9)"  },
  output:   { label: "Output",      color: "rgba(60,200,120,0.18)",  dot: "rgba(80,220,140,0.9)"  },
};

function TraceBubble({ step, trace }: { step: TraceStep; trace: string }) {
  // output panel starts open; all others start closed but open as soon as content arrives
  const [open, setOpen] = useState(step === "output");
  const prevTraceLen = useRef(0);

  // Auto-open the panel when new content streams in for the first time
  useEffect(() => {
    if (trace.length > 0 && prevTraceLen.current === 0) {
      setOpen(true);
    }
    prevTraceLen.current = trace.length;
  }, [trace]);

  const meta = STEP_META[step] ?? STEP_META.plan;

  return (
    <div style={{
      marginBottom: 6,
      borderRadius: 10,
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.06)",
      background: meta.color,
      backdropFilter: "blur(8px)",
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "7px 12px", background: "transparent", border: "none",
          cursor: "pointer", color: "rgba(255,255,255,0.7)",
          fontSize: 12, fontWeight: 500, fontFamily: "inherit",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.dot, flexShrink: 0 }} />
        <span style={{ textTransform: "uppercase", letterSpacing: "0.6px" }}>{meta.label}</span>
        {/* Streaming indicator – a tiny pulsing dot while content is short / growing */}
        {trace.length > 0 && trace.length < 800 && (
          <span style={{
            width: 5, height: 5, borderRadius: "50%",
            background: meta.dot,
            animation: "dotPulse 1.2s ease-in-out infinite",
            marginLeft: 2,
          }} />
        )}
        <span style={{
          marginLeft: "auto", opacity: 0.5, fontSize: 10,
          transition: "transform 0.2s", display: "inline-block",
          transform: open ? "rotate(180deg)" : "none",
        }}>▼</span>
      </button>

      {open && (
        <div style={{ padding: "0 12px 10px", fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.6 }}>
          {trace ? <MDContent>{trace}</MDContent> : <LoadingDots />}
        </div>
      )}
    </div>
  );
}

// ─── Message bubble ──────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", marginBottom: 18 }}>
      <div style={{
        fontSize: 10, color: "rgba(255,255,255,0.25)", marginBottom: 5,
        letterSpacing: "0.5px", textTransform: "uppercase",
        paddingLeft: isUser ? 0 : 4, paddingRight: isUser ? 4 : 0,
      }}>
        {isUser ? "You" : "Assistant"} · {msg.time}
      </div>

      <div style={{
        maxWidth: "82%",
        padding: "12px 16px",
        borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        background: isUser ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.042)",
        border: isUser ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.058)",
        boxShadow: isUser ? "0 4px 20px rgba(0,0,0,0.4)" : "0 4px 20px rgba(0,0,0,0.3)",
        fontSize: 14,
        color: "rgba(255,255,255,0.88)",
        lineHeight: 1.65,
        backdropFilter: "blur(10px)",
        fontWeight: 400,
      }}>
        {isUser ? (
          <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
        ) : (
          <>
            {/* Research traces */}
            {msg.traces && msg.traces.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                {msg.traces.map((t, i) => (
                  <TraceBubble key={t.step + i} step={t.step} trace={t.trace} />
                ))}
              </div>
            )}

            {/* Main answer — streams character-by-character */}
            {msg.content ? (
              <MDContent>{msg.content}</MDContent>
            ) : (
              <LoadingDots />
            )}

            {/* Sources */}
            {msg.sources && msg.sources.length > 0 && (
              <div style={{
                marginTop: 12, paddingTop: 10,
                borderTop: "1px solid rgba(255,255,255,0.07)",
                fontSize: 12, color: "rgba(255,255,255,0.4)",
              }}>
                <span style={{ fontWeight: 500, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 6 }}>
                  Sources
                </span>
                <ul style={{ paddingLeft: 16, margin: 0 }}>
                  {msg.sources.map((src, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      <a href={src} target="_blank" rel="noreferrer"
                        style={{ color: "rgba(180,160,255,0.85)", textDecoration: "underline", wordBreak: "break-all" }}>
                        {src}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {msg.mode && (
              <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                <ModeBadge mode={msg.mode} small />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "2px 0" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "rgba(255,255,255,0.4)",
          animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

function ModeBadge({ mode, small }: { mode: Mode; small?: boolean }) {
  const colors: Record<Mode, string> = {
    chat: "rgba(255,255,255,0.12)",
    document: "rgba(110,70,240,0.25)",
    research: "rgba(60,140,255,0.22)",
  };
  const labels: Record<Mode, string> = { chat: "Chat", document: "Document", research: "Research" };
  return (
    <span style={{
      padding: small ? "2px 8px" : "4px 12px",
      borderRadius: 20,
      fontSize: small ? 10 : 12,
      fontWeight: 500,
      letterSpacing: "0.4px",
      background: colors[mode] || colors.chat,
      color: "rgba(255,255,255,0.6)",
      border: "1px solid rgba(255,255,255,0.08)",
      textTransform: "uppercase",
    }}>
      {labels[mode]}
    </span>
  );
}

// ─── ChatArea ────────────────────────────────────────────────────────────────
function ChatArea({ messages, chatRef }: { messages: Message[]; chatRef: React.RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div ref={chatRef} style={{
      position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)",
      width: "62%", maxWidth: 780, minWidth: 320,
      height: "calc(100vh - 180px)",
      overflowY: "auto", padding: "40px 8px 24px", scrollbarWidth: "none",
    }}>
      {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
    </div>
  );
}

// ─── Mode selector ───────────────────────────────────────────────────────────
function ModeSelector({ mode, onChange, disabled }: { mode: Mode; onChange: (mode: Mode) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const modes = [
    { id: "chat" as Mode, icon: "💬", label: "Chat", desc: "Fast conversational answers" },
    { id: "document" as Mode, icon: "📄", label: "Document", desc: "Long-form structured content" },
    { id: "research" as Mode, icon: "🔬", label: "Research", desc: "Multi-step reasoning + sources" },
  ];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = modes.find((m) => m.id === mode) ?? modes[0];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => !disabled && setOpen((v) => !v)} disabled={disabled}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 22,
          background: open ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.055)",
          border: "1px solid rgba(255,255,255,0.09)",
          color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500,
          cursor: disabled ? "default" : "pointer", fontFamily: "inherit", transition: "all 0.2s",
        }}>
        <span>{current.icon}</span>
        <span>{current.label}</span>
        <span style={{ opacity: 0.45, fontSize: 10, transform: open ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.2s" }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: 0,
          background: "rgba(18,18,22,0.97)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14,
          overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.8)", minWidth: 220, zIndex: 50,
        }}>
          {modes.map((m) => (
            <button key={m.id} onClick={() => { onChange(m.id); setOpen(false); }}
              style={{
                width: "100%", display: "flex", alignItems: "flex-start", gap: 12,
                padding: "12px 16px", background: m.id === mode ? "rgba(255,255,255,0.06)" : "transparent",
                border: "none", cursor: "pointer", color: "rgba(255,255,255,0.82)",
                fontFamily: "inherit", textAlign: "left", transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { if (m.id !== mode) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={(e) => { if (m.id !== mode) e.currentTarget.style.background = "transparent"; }}>
              <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{m.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{m.label}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>{m.desc}</div>
              </div>
              {m.id === mode && <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.5)", fontSize: 14, flexShrink: 0 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TextBox ─────────────────────────────────────────────────────────────────
function TextBox({ onSend, loading, hasMessages }: {
  onSend: (query: string, mode: Mode, frontendIteration: number) => void;
  loading: boolean;
  hasMessages: boolean;
}) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<Mode>("chat");
  const [iteration, setIteration] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, window.innerHeight * 0.45) + "px";
  }, [value]);

  function handleSend() {
    if (!value.trim() || loading) return;
    onSend(value.trim(), mode, iteration);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  return (
    <div style={{
      position: "fixed",
      bottom: hasMessages ? 24 : "32%",
      left: "50%",
      transform: hasMessages ? "translateX(-50%)" : "translate(-50%, 50%)",
      width: "62%", maxWidth: 780, minWidth: 320,
      transition: "bottom 0.5s cubic-bezier(0.16,1,0.3,1), transform 0.5s cubic-bezier(0.16,1,0.3,1)",
      zIndex: 20,
    }}>
      <div style={{
        background: "rgba(255,255,255,0.032)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        boxShadow: "0 0 0 1px rgba(255,255,255,0.03) inset, 0 30px 80px rgba(0,0,0,0.8)",
        backdropFilter: "blur(20px)",
      }}>
        <textarea ref={textareaRef} value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown} disabled={loading}
          placeholder={
            mode === "chat" ? "Ask me anything…" :
            mode === "document" ? "Describe the document you want…" :
            "What do you want to research?"
          }
          rows={1}
          style={{
            width: "100%", resize: "none", border: "none", outline: "none",
            background: "transparent", color: "rgba(255,255,255,0.88)",
            fontFamily: "Outfit, sans-serif", fontSize: 15, fontWeight: 400,
            padding: "18px 20px 4px", lineHeight: 1.6, boxSizing: "border-box",
            overflowY: "auto", maxHeight: "45vh", scrollbarWidth: "none",
          }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px 12px" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <ModeSelector mode={mode} onChange={setMode} disabled={loading} />
            {mode === "research"}
          </div>

          <button onClick={handleSend} disabled={!value.trim() || loading}
            style={{
              width: 38, height: 38, borderRadius: "50%", border: "none",
              background: value.trim() && !loading ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.07)",
              color: value.trim() && !loading ? "#000" : "rgba(255,255,255,0.25)",
              cursor: value.trim() && !loading ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)", flexShrink: 0,
            }}>
            {loading ? (
              <span style={{
                width: 14, height: 14, borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "rgba(255,255,255,0.7)",
                animation: "spin 0.8s linear infinite", display: "block",
              }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 14V2M8 2L3 7M8 2L13 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {!hasMessages && !value && (
        <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 12, letterSpacing: "0.3px" }}>
          Shift + Enter for new line · Enter to send
        </p>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [mouse, setMouse] = useState({ x: -1000, y: -1000 });
  const chatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleMouse(e: MouseEvent) { setMouse({ x: e.clientX, y: e.clientY }); }
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  function updateMessage(id: number, patch: Partial<Message>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  async function sendChat(query: string, mode: Mode, frontendIteration: number) {
    const endpoint = mode === "chat" ? "/chat" : mode === "document" ? "/document" : "/research";
    const backendIterationMap: Record<number, number> = { 1: 4, 2: 5, 3: 6, 4: 7, 5: 9 };
    const backendIteration = backendIterationMap[frontendIteration] ?? 4;

    const userMsg: Message = { id: Date.now(), role: "user", content: query, time: timestamp(), traces: [], sources: null };
    const assistantMsg: Message = { id: Date.now() + 1, role: "assistant", content: "", mode, time: timestamp(), traces: [], sources: null };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setLoading(true);

    try {
      if (mode === "research") {
        await handleResearch(query, assistantMsg.id, backendIteration);
      } else {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, mode, iteration: backendIteration }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        updateMessage(assistantMsg.id, { content: data.answer });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateMessage(assistantMsg.id, { content: `⚠️ Error: ${message}` });
    } finally {
      setLoading(false);
    }
  }

  async function handleResearch(query: string, assistantId: number, iteration: number) {
    const res = await fetch(`${BASE_URL}/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, mode: "research", iteration }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!res.body) throw new Error("No response body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          const raw = line.slice(5).trim();
          if (!raw) continue;

          try {
            const payload = JSON.parse(raw);

            if (currentEvent === "step") {
              // Upsert trace: update existing entry for this step, or append new one.
              // This fires repeatedly as lines stream in, updating content in-place.
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantId) return m;
                  const existing = m.traces ?? [];
                  const idx = existing.findIndex((t) => t.step === (payload.step as TraceStep));
                  if (idx >= 0) {
                    const updated = [...existing];
                    updated[idx] = { step: payload.step as TraceStep, trace: payload.content };
                    return { ...m, traces: updated };
                  }
                  return { ...m, traces: [...existing, { step: payload.step as TraceStep, trace: payload.content }] };
                })
              );

            } else if (currentEvent === "output_token") {
              // Append single character to content — triggers character-by-character rendering
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + (payload.char as string) } : m
                )
              );

            } else if (currentEvent === "done") {
              updateMessage(assistantId, { sources: payload.sources ?? [] });

            } else if (currentEvent === "error") {
              updateMessage(assistantId, { content: `⚠️ ${payload.error}` });
            }
          } catch {
            // ignore malformed JSON
          }

          currentEvent = null;
        }
      }
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #000; overflow: hidden; }
        ::-webkit-scrollbar { display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes drift1 {
          0%, 100% { transform: translate(0, 0); }
          40% { transform: translate(14px, -22px); }
          70% { transform: translate(-8px, 10px); }
        }
        @keyframes drift2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-20px, -18px); }
        }
        textarea::placeholder { color: rgba(255,255,255,0.2); font-weight: 300; }
      `}</style>

      <div style={{ width: "100vw", height: "100vh", background: "#050505", fontFamily: "Outfit, sans-serif", overflow: "hidden", position: "relative" }}>
        {/* Spotlight */}
        <div style={{
          position: "fixed", width: 700, height: 700, left: mouse.x, top: mouse.y,
          transform: "translate(-50%,-50%)",
          background: "radial-gradient(circle at center, rgba(255,255,255,0.065) 0%, rgba(180,140,255,0.03) 30%, transparent 65%)",
          filter: "blur(1px)", pointerEvents: "none", zIndex: 1,
          transition: "left 0.07s ease-out, top 0.07s ease-out",
        }} />

        {/* Film grain */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 2, pointerEvents: "none", opacity: 0.04,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "180px 180px",
        }} />

        {/* Ambient orbs */}
        <div style={{ position: "fixed", width: 350, height: 350, top: "5%", left: "5%", borderRadius: "50%", background: "radial-gradient(circle, rgba(110,70,240,0.09), transparent 70%)", filter: "blur(70px)", pointerEvents: "none", zIndex: 0, animation: "drift1 11s ease-in-out infinite" }} />
        <div style={{ position: "fixed", width: 250, height: 250, bottom: "10%", right: "10%", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.04), transparent 70%)", filter: "blur(70px)", pointerEvents: "none", zIndex: 0, animation: "drift2 14s ease-in-out infinite" }} />
        <div style={{ position: "fixed", width: 180, height: 180, bottom: "25%", left: "8%", borderRadius: "50%", background: "radial-gradient(circle, rgba(60,140,255,0.07), transparent 70%)", filter: "blur(70px)", pointerEvents: "none", zIndex: 0, animation: "drift1 18s ease-in-out infinite reverse" }} />

        {/* Hairline rules */}
        <div style={{ position: "fixed", left: 0, right: 0, top: "28%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.045) 20%, rgba(255,255,255,0.045) 80%, transparent)", pointerEvents: "none", zIndex: 1 }} />
        <div style={{ position: "fixed", left: 0, right: 0, bottom: "28%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.045) 20%, rgba(255,255,255,0.045) 80%, transparent)", pointerEvents: "none", zIndex: 1 }} />

        <div style={{ position: "relative", zIndex: 10 }}>
          {messages.length === 0 && (
            <div style={{ position: "fixed", top: "32%", left: "50%", transform: "translateX(-50%)", textAlign: "center", pointerEvents: "none" }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.25)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 14 }}>
                LangGraph AI
              </div>
              <h1 style={{
                fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 600, letterSpacing: "-1.2px", lineHeight: 1.15,
                background: "linear-gradient(160deg, rgba(255,255,255,0.95) 30%, rgba(255,255,255,0.38) 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                Think deeper,<br />answer better.
              </h1>
            </div>
          )}

          <ChatArea messages={messages} chatRef={chatRef} />
          <TextBox onSend={sendChat} loading={loading} hasMessages={messages.length > 0} />
        </div>
      </div>
    </>
  );
}