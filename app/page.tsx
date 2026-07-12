"use client";
import { useState, useRef, useEffect, type CSSProperties, type KeyboardEvent, type HTMLAttributes } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

type Mode = "chat" | "document" | "research";
// All 5 pipeline steps surfaced individually
type TraceStep = "plan" | "retrieve" | "analysis" | "refine" | "output";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;
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
function ChatArea({ messages, chatRef, mode }: { messages: Message[]; chatRef: React.RefObject<HTMLDivElement | null>; mode: Mode }) {
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div ref={chatRef} style={{
      position: "fixed", top: 0, 
      left: mode === "document" ? "calc(50% + 140px)" : "50%",
      transform: "translateX(-50%)",
      width: "62%", maxWidth: 780, minWidth: 320,
      height: "calc(100vh - 180px)",
      overflowY: "auto", padding: "40px 8px 24px", scrollbarWidth: "none",
      transition: "left 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
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
interface DocumentFile {
  name: string;
  status: "processing" | "completed" | "failed";
  selected: boolean;
}

function TextBox({ 
  onSend, 
  loading, 
  hasMessages,
  mode,
  onModeChange,
  documents,
  onUpload,
  onToggleSelect,
  isUploading
}: {
  onSend: (query: string, mode: Mode, frontendIteration: number) => void;
  loading: boolean;
  hasMessages: boolean;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  documents: DocumentFile[];
  onUpload: (file: File) => Promise<void>;
  onToggleSelect: (name: string) => void;
  isUploading: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const completedCount = documents.filter(d => d.status === "completed").length;

  function handleSend() {
    if (!value.trim() || loading) return;
    if (mode === "document" && completedCount === 0) {
      alert("Please upload and index a PDF first.");
      return;
    }
    onSend(value.trim(), mode, 1);
    setValue("");
  }

  return (
    <div style={{
      position: "fixed",
      bottom: hasMessages ? 24 : "40%",
      left: mode === "document" ? "calc(50% + 140px)" : "50%",
      transform: "translateX(-50%)",
      width: "62%", maxWidth: 780, minWidth: 320,
      zIndex: 20,
      transition: "bottom 0.5s cubic-bezier(0.16,1,0.3,1), left 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
    }}>
      <div style={{
        background: "rgba(255,255,255,0.032)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 24,
        padding: "8px",
        backdropFilter: "blur(20px)",
        boxShadow: "0 20px 80px rgba(0,0,0,0.8)",
      }}>
        
        {/* Selected Files Chips in TextBox */}
        {mode === "document" && documents.filter(d => d.selected).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 12px" }}>
            {documents.filter(d => d.selected).map(doc => (
              <div key={doc.name} style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                background: "rgba(255,255,255,0.06)",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)",
                fontSize: 12,
                color: "rgba(255,255,255,0.8)"
              }}>
                <span style={{ opacity: 0.6 }}>📄</span>
                <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {doc.name}
                </span>
                <button 
                  onClick={() => onToggleSelect(doc.name)}
                  style={{ background: "none", border: "none", color: "#ff4d4d", cursor: "pointer", marginLeft: 4 }}
                >✕</button>
              </div>
            ))}
          </div>
        )}

        <textarea 
          ref={textareaRef} 
          value={value} 
          onChange={(e) => setValue(e.target.value)}
          placeholder={mode === "document" ? "Ask about your PDF(s)..." : "Type a message..."}
          rows={1}
          style={{
            width: "100%", resize: "none", border: "none", outline: "none",
            background: "transparent", color: "#fff", padding: "12px 16px",
            fontSize: 15, fontFamily: "inherit"
          }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ModeSelector mode={mode} onChange={onModeChange} />
            
            {/* Integrated Upload Button (Visible in Document mode) */}
            {mode === "document" && (
              <label style={{
                cursor: "pointer",
                padding: "6px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: isUploading ? "transparent" : "rgba(255,255,255,0.05)",
                transition: "0.2s"
              }}>
                <input type="file" accept=".pdf" hidden onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                }} />
                {isUploading ? (
                   <span style={{ width: 16, height: 16, border: "2px solid #555", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.82-2.82l8.49-8.48" />
                  </svg>
                )}
              </label>
            )}
          </div>

          <button 
            onClick={handleSend} 
            disabled={(!value.trim() && (mode === "document" && completedCount === 0)) || loading}
            style={{
              width: 32, height: 32, borderRadius: "50%", border: "none",
              background: (value.trim()) ? "#fff" : "rgba(255,255,255,0.1)",
              cursor: "pointer"
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 14V2M8 2L3 7M8 2L13 7" stroke="#000" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [mouse, setMouse] = useState({ x: -1000, y: -1000 });
  const chatRef = useRef<HTMLDivElement | null>(null);

  // PDF integration states
  const [mode, setMode] = useState<Mode>("chat");
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Load documents from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("decon_documents");
    if (saved) {
      try {
        setDocuments(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved documents", e);
      }
    }
  }, []);

  // Save documents to localStorage when modified
  useEffect(() => {
    localStorage.setItem("decon_documents", JSON.stringify(documents));
  }, [documents]);

  // Poll status for all processing files
  useEffect(() => {
    const processingDocs = documents.filter(d => d.status === "processing");
    if (processingDocs.length === 0) return;

    const pdfServiceUrl = process.env.NEXT_PUBLIC_RAG_SERVER_URL || BASE_URL || "http://localhost:8000";

    const intervals = processingDocs.map(doc => {
      const filename = doc.name;
      const intervalId = setInterval(async () => {
        try {
          const res = await fetch(`${pdfServiceUrl}/upload/status?filename=${encodeURIComponent(filename)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === "completed" || data.status === "failed") {
              setDocuments(prev => prev.map(d => d.name === filename ? { ...d, status: data.status } : d));
              clearInterval(intervalId);
            }
          }
        } catch (err) {
          console.error("Error checking status of", filename, err);
        }
      }, 3000);

      return { filename, intervalId };
    });

    return () => {
      intervals.forEach(item => clearInterval(item.intervalId));
    };
  }, [documents]);

  const onUpload = async (file: File) => {
    if (file.type !== "application/pdf") return;
    
    if (documents.some(d => d.name === file.name)) {
      alert("File already exists in library.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("pdf", file);

    const pdfServiceUrl = process.env.NEXT_PUBLIC_RAG_SERVER_URL || BASE_URL || "http://localhost:8000";

    try {
      const res = await fetch(`${pdfServiceUrl}/upload/pdf`, {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("Upload failed");

      setDocuments(prev => [
        ...prev,
        { name: file.name, status: "processing", selected: true }
      ]);
    } catch (err) {
      alert("Upload failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    function handleMouse(e: MouseEvent) { setMouse({ x: e.clientX, y: e.clientY }); }
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  function updateMessage(id: number, patch: Partial<Message>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  async function sendChat(query: string, mode: Mode, frontendIteration: number) {
    const backendIterationMap: Record<number, number> = { 1: 4, 2: 5, 3: 6, 4: 7, 5: 9 };
    const backendIteration = backendIterationMap[frontendIteration] ?? 4;

    let displayContent = query;
    let selectedFiles: string[] = [];

    if (mode === "document") {
      selectedFiles = documents.filter(d => d.selected && d.status === "completed").map(d => d.name);
      if (selectedFiles.length > 0) {
        displayContent = `[Files: ${selectedFiles.join(", ")}] ${query}`;
      }
    }

    const userMsg: Message = { id: Date.now(), role: "user", content: displayContent, time: timestamp(), traces: [], sources: null };
    const assistantMsg: Message = { id: Date.now() + 1, role: "assistant", content: "", mode, time: timestamp(), traces: [], sources: null };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setLoading(true);

    try {
      if (mode === "research") {
        await handleResearch(query, assistantMsg.id, backendIteration);
      } else if (mode === "document") {
        const pdfServiceUrl = process.env.NEXT_PUBLIC_RAG_SERVER_URL || BASE_URL || "http://localhost:8000";
        
        const payload: any = { question: query };
        if (selectedFiles.length === 1) {
          payload.filename = selectedFiles[0];
        }
        // If multiple files are selected, we omit the 'filename' parameter
        // to query across all files in the collection, preventing backend HTTP 500 crash.

        const res = await fetch(`${pdfServiceUrl}/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        const uniqueSources = Array.from(new Set(
          data.sourceDocuments
            ?.map((doc: any) => doc.metadata?.source_filename)
            .filter(Boolean)
        )) as string[];

        updateMessage(assistantMsg.id, { 
          content: data.answer,
          sources: uniqueSources.length > 0 ? uniqueSources : null
        });
      } else {
        // mode === "chat"
        const res = await fetch(`${BASE_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            query, 
            mode, 
            iteration: backendIteration
          }),
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
            <div style={{
              position: "fixed",
              top: "32%",
              left: mode === "document" ? "calc(50% + 140px)" : "50%",
              transform: "translateX(-50%)",
              textAlign: "center",
              pointerEvents: "none",
              transition: "left 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
            }}>
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

          {/* Floating Glassmorphic Sidebar */}
          <div style={{
            position: "fixed",
            top: "40px",
            bottom: "40px",
            left: mode === "document" ? "24px" : "-320px",
            width: "280px",
            zIndex: 30,
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "20px",
            backdropFilter: "blur(20px)",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
            pointerEvents: mode === "document" ? "auto" : "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "rgba(255, 255, 255, 0.9)", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>📚</span> Document Library
              </span>
              {documents.length > 0 && (
                <button 
                  onClick={() => {
                    if (confirm("Remove all documents from library?")) {
                      setDocuments([]);
                    }
                  }}
                  style={{
                    background: "none", border: "none", color: "rgba(255, 77, 77, 0.75)", fontSize: "11px", cursor: "pointer"
                  }}
                >
                  Clear All
                </button>
              )}
            </div>

            {documents.length > 0 && (
              <div style={{ display: "flex", gap: 10, marginBottom: 14, fontSize: 11, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 10 }}>
                <button 
                  onClick={() => setDocuments(prev => prev.map(d => ({ ...d, selected: true })))}
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: 0 }}
                >
                  Select All
                </button>
                <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
                <button 
                  onClick={() => setDocuments(prev => prev.map(d => ({ ...d, selected: false })))}
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: 0 }}
                >
                  Select None
                </button>
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" }}>
              {documents.length === 0 ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.25)" }}>
                  <span style={{ fontSize: "28px", marginBottom: "10px" }}>📁</span>
                  <span style={{ fontSize: "12px", fontWeight: 400 }}>No documents uploaded.</span>
                  <span style={{ fontSize: "10px", marginTop: "4px", opacity: 0.7 }}>Upload a PDF to start querying.</span>
                </div>
              ) : (
                documents.map((doc) => {
                  const isSelected = doc.selected;
                  return (
                    <div 
                      key={doc.name} 
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 12px",
                        borderRadius: "12px",
                        background: isSelected ? "rgba(255, 255, 255, 0.05)" : "transparent",
                        border: isSelected ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid transparent",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <input 
                        type="checkbox"
                        checked={doc.selected}
                        disabled={doc.status !== "completed"}
                        onChange={() => {
                          setDocuments(prev => prev.map(d => d.name === doc.name ? { ...d, selected: !d.selected } : d));
                        }}
                        style={{ cursor: doc.status === "completed" ? "pointer" : "default" }}
                      />
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                        <span 
                          title={doc.name}
                          style={{
                            fontSize: "12px",
                            fontWeight: 500,
                            color: isSelected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {doc.name}
                        </span>
                        <span style={{ fontSize: "10px", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                          {doc.status === "processing" && (
                            <>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#e68c28", display: "inline-block", animation: "dotPulse 1.2s infinite" }} />
                              <span style={{ color: "rgba(230, 140, 40, 0.7)" }}>Processing...</span>
                            </>
                          )}
                          {doc.status === "completed" && (
                            <>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#3cc878", display: "inline-block" }} />
                              <span style={{ color: "rgba(60, 200, 120, 0.7)" }}>Ready</span>
                            </>
                          )}
                          {doc.status === "failed" && (
                            <>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ff4d4d", display: "inline-block" }} />
                              <span style={{ color: "rgba(255, 77, 77, 0.7)" }}>Failed</span>
                            </>
                          )}
                        </span>
                      </div>
                      
                      <button 
                        onClick={() => {
                          setDocuments(prev => prev.filter(d => d.name !== doc.name));
                        }}
                        style={{
                          background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: "12px", padding: "4px"
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = "#ff4d4d"}
                        onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.25)"}
                      >
                        🗑️
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ marginTop: "16px" }}>
              <label style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "14px",
                borderRadius: "14px",
                border: "1px dashed rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.015)",
                cursor: "pointer",
                transition: "0.2s"
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"}
              >
                <input type="file" accept=".pdf" hidden onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                }} />
                {isUploading ? (
                  <span style={{ width: 18, height: 18, border: "2px solid #555", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                ) : (
                  <>
                    <span style={{ fontSize: "16px", marginBottom: "4px" }}>📤</span>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>Upload PDF Document</span>
                  </>
                )}
              </label>
            </div>
          </div>

          <ChatArea messages={messages} chatRef={chatRef} mode={mode} />
          <TextBox 
            onSend={sendChat} 
            loading={loading} 
            hasMessages={messages.length > 0} 
            mode={mode}
            onModeChange={setMode}
            documents={documents}
            onUpload={onUpload}
            onToggleSelect={(name) => setDocuments(prev => prev.map(d => d.name === name ? { ...d, selected: !d.selected } : d))}
            isUploading={isUploading}
          />
        </div>
      </div>
    </>
  );
}