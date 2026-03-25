import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useDropzone } from "react-dropzone";
import {
  Send, Paperclip, Mic, Plus, Search, ThumbsUp, ThumbsDown,
  Copy, RefreshCw, Pin, Volume2, ChevronRight, X, FileText,
  Star, Trash2, Download, Sparkles, Bot, MessageSquare,
  BarChart3, Compass, Zap, CheckCheck, AlertCircle, MicOff,
} from "lucide-react";
import { toast } from "sonner";
import { chatApi, streamMessage } from "@/services/api";
import type { Conversation } from "@/services/api";

const MODES = [
  { id: "rfi", label: "RFI Writer" },
  { id: "general", label: "General Assistant" },
  { id: "analysis", label: "Data Analysis" },
  { id: "research", label: "Research Mode" },
];

const SUGGESTED_PROMPTS = [
  "Generate an RFI response for Cisco UAE infrastructure capabilities",
  "Create a vendor comparison table for HPE vs Dell in the Gulf region",
  "What are our cybersecurity certifications in Saudi Arabia?",
  "Summarize logistics capabilities for Egypt operations",
];

interface AttachedFile { name: string; size: string; type: string; }

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  files?: AttachedFile[];
  isStreaming?: boolean;
}

function parseConfidenceData(content: string) {
  const m = content.match(/<confidence_data>([\s\S]*?)<\/confidence_data>/);
  if (!m) return null;
  try { return JSON.parse(m[1].trim()); } catch { return null; }
}

function cleanContent(content: string): string {
  return content.replace(/<confidence_data>[\s\S]*?<\/confidence_data>/g, "").trim();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function MessageContent({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="prose prose-invert prose-sm max-w-none
      [&_h1]:font-heading [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mt-4 [&_h1]:mb-3
      [&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-primary [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-1
      [&_h3]:font-heading [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-3 [&_h3]:mb-2
      [&_p]:text-foreground/90 [&_p]:leading-relaxed [&_p]:mb-3 [&_p]:last:mb-0
      [&_ul]:my-2 [&_ul]:space-y-1.5 [&_li]:text-foreground/85 [&_li]:leading-relaxed
      [&_ol]:my-2 [&_ol]:space-y-1.5
      [&_strong]:text-foreground [&_strong]:font-semibold
      [&_em]:text-foreground/75
      [&_blockquote]:border-l-2 [&_blockquote]:border-primary/60 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-3
      [&_code]:bg-secondary [&_code]:text-primary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
      [&_pre]:bg-secondary/80 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-border [&_pre]:text-sm
      [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:text-sm [&_table]:rounded-lg [&_table]:overflow-hidden
      [&_thead_tr]:bg-primary/15
      [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-heading [&_th]:font-semibold [&_th]:text-foreground [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wide [&_th]:border-b [&_th]:border-border
      [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-foreground/85 [&_td]:border-b [&_td]:border-border/40
      [&_tbody_tr:last-child_td]:border-b-0
      [&_tbody_tr:nth-child(even)]:bg-secondary/20
      [&_hr]:border-border [&_hr]:my-4
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanContent(content)}</ReactMarkdown>
    </div>
  );
}

export default function AIChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showContext, setShowContext] = useState(true);
  const [chatSearch, setChatSearch] = useState("");
  const [mode, setMode] = useState("rfi");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [backendOnline, setBackendOnline] = useState(true);
  const [detectedCtx, setDetectedCtx] = useState<{ vendor?: string; country?: string; vertical?: string } | null>(null);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [lastConfidence, setLastConfidence] = useState<{ overall?: number; vendor?: string; country?: string; chunks_used?: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    chatApi.getConversations()
      .then(r => { setConversations(r.data.conversations); setLoadingConvos(false); })
      .catch(() => { setBackendOnline(false); setLoadingConvos(false); });
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  // Auto-detect context
  useEffect(() => {
    if (input.length < 15) { setDetectedCtx(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/rfi/detect-context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: input }) });
        if (r.ok) { const c = await r.json(); if (c.vendor || c.country || c.vertical) setDetectedCtx(c); else setDetectedCtx(null); }
      } catch {}
    }, 700);
    return () => clearTimeout(t);
  }, [input]);

  const onDrop = useCallback((files: File[]) => {
    setAttachedFiles(prev => [...prev, ...files.map(f => ({ name: f.name, size: formatSize(f.size), type: f.type }))]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, noClick: true, noKeyboard: true });

  const loadMessages = async (id: string) => {
    try {
      const r = await chatApi.getMessages(id);
      setMessages(r.data.messages.map(m => ({ id: m.id, role: m.role, content: m.content, timestamp: new Date(m.created_at) })));
      const lastAI = r.data.messages.slice().reverse().find(m => m.role === "assistant");
      if (lastAI) { const c = parseConfidenceData(lastAI.content); if (c) setLastConfidence(c); }
    } catch { toast.error("Failed to load messages"); }
  };

  const selectConversation = async (id: string) => {
    setActiveConvoId(id); setMessages([]); setLastConfidence(null);
    await loadMessages(id);
  };

  const startNewChat = async () => {
    try {
      const r = await chatApi.createConversation("New Chat", mode);
      setConversations(prev => [r.data, ...prev]);
      setActiveConvoId(r.data.id); setMessages([]); setLastConfidence(null);
    } catch { toast.error("Failed to create conversation"); }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isStreaming) return;
    let convoId = activeConvoId;
    if (!convoId) {
      const r = await chatApi.createConversation(input.substring(0, 60), mode);
      convoId = r.data.id; setActiveConvoId(convoId);
      setConversations(prev => [r.data, ...prev]);
    }
    const userMsg: UIMessage = { id: Date.now().toString(), role: "user", content: input, timestamp: new Date(), files: attachedFiles.length > 0 ? [...attachedFiles] : undefined };
    const aiMsgId = (Date.now() + 1).toString();
    const aiMsg: UIMessage = { id: aiMsgId, role: "assistant", content: "", timestamp: new Date(), isStreaming: true };
    setMessages(prev => [...prev, userMsg, aiMsg]);
    const sentInput = input; const sentFiles = [...attachedFiles];
    setInput(""); setAttachedFiles([]); setIsStreaming(true); setDetectedCtx(null);

    streamMessage(convoId!, sentInput, mode, sentFiles,
      (token) => setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: m.content + token } : m)),
      (_tokensUsed) => {
        setIsStreaming(false);
        setMessages(prev => {
          const aiMsg = prev.find(m => m.id === aiMsgId);
          if (aiMsg) { const c = parseConfidenceData(aiMsg.content); if (c) setLastConfidence(c); }
          return prev.map(m => m.id === aiMsgId ? { ...m, isStreaming: false } : m);
        });
        chatApi.getConversations().then(r => setConversations(r.data.conversations)).catch(() => {});
      },
      (err) => {
        setIsStreaming(false);
        setMessages(prev => prev.map(m => m.id === aiMsgId
          ? { ...m, content: `❌ **Error:** ${err}\n\nMake sure the backend is running and your API key is set in \`backend/.env\`.`, isStreaming: false }
          : m));
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const copyMsg = (id: string, content: string) => {
    navigator.clipboard.writeText(cleanContent(content));
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); toast.success("Copied");
  };

  const deleteConvo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await chatApi.deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvoId === id) { setActiveConvoId(null); setMessages([]); }
    toast.success("Deleted");
  };

  const toggleStar = async (id: string, starred: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await chatApi.updateConversation(id, { starred: starred ? 0 : 1 } as Conversation);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, starred: starred ? 0 : 1 } : c));
  };

  const exportChat = (format: string) => {
    if (!activeConvoId) { toast.error("No active conversation to export"); return; }
    window.open(chatApi.exportConversation(activeConvoId, format), "_blank");
  };

  const now = Date.now();
  const grouped = [
    { label: "Today", items: conversations.filter(c => (now - new Date(c.updated_at).getTime()) < 86400000) },
    { label: "Yesterday", items: conversations.filter(c => { const d = (now - new Date(c.updated_at).getTime()) / 86400000; return d >= 1 && d < 2; }) },
    { label: "Last 7 Days", items: conversations.filter(c => { const d = (now - new Date(c.updated_at).getTime()) / 86400000; return d >= 2 && d < 7; }) },
    { label: "Older", items: conversations.filter(c => (now - new Date(c.updated_at).getTime()) / 86400000 >= 7) },
  ].map(g => ({ ...g, items: g.items.filter(c => !chatSearch || c.title.toLowerCase().includes(chatSearch.toLowerCase())) }))
   .filter(g => g.items.length > 0);

  return (
    <div className="flex h-screen overflow-hidden" {...getRootProps()}>
      <input {...getInputProps()} />

      <AnimatePresence>
        {isDragActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex items-center justify-center">
            <div className="text-center p-12 glass-panel border-2 border-dashed border-primary">
              <Paperclip className="w-16 h-16 text-primary mx-auto mb-4" />
              <p className="text-xl font-heading font-bold text-foreground">Drop files to attach</p>
              <p className="text-sm text-muted-foreground mt-1">PDF, DOCX, TXT, XLSX, images</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!backendOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-rose-500/90 backdrop-blur text-white text-xs text-center py-2.5 flex items-center justify-center gap-2">
          <AlertCircle className="w-3.5 h-3.5" />
          Backend offline — run: <code className="bg-white/20 px-2 py-0.5 rounded ml-1 font-mono">cd backend && npm run dev</code>
        </div>
      )}

      {/* Conversation sidebar */}
      <div className="w-64 border-r border-border flex flex-col bg-sidebar shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          <button onClick={startNewChat} className="gradient-button w-full flex items-center justify-center gap-2 text-sm py-2.5 rounded-lg">
            <Plus className="w-4 h-4" /> New Chat
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={chatSearch} onChange={e => setChatSearch(e.target.value)} placeholder="Search chats..."
              className="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-4">
          {loadingConvos && [...Array(4)].map((_, i) => <div key={i} className="h-12 bg-secondary/30 rounded-lg animate-pulse mx-1" />)}
          {!loadingConvos && conversations.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-xs">No conversations yet.<br />Start by clicking New Chat.</p>
            </div>
          )}
          {grouped.map(({ label, items }) => (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-1.5 font-medium">{label}</p>
              {items.map(convo => (
                <div key={convo.id} onClick={() => selectConversation(convo.id)}
                  className={`group relative flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all mb-0.5 ${
                    activeConvoId === convo.id ? "bg-primary/10 border border-primary/20" : "hover:bg-accent border border-transparent"}`}>
                  {convo.starred ? <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0 mt-0.5" /> : null}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${activeConvoId === convo.id ? "text-primary" : "text-foreground/80"}`}>{convo.title}</p>
                    {convo.last_message && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{convo.last_message}</p>}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                    <button onClick={e => toggleStar(convo.id, convo.starred, e)} className="p-1 rounded hover:bg-secondary">
                      <Star className={`w-3 h-3 ${convo.starred ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
                    </button>
                    <button onClick={e => deleteConvo(convo.id, e)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-rose-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card/10">
          <div className="flex items-center gap-3">
            <h2 className="font-heading font-semibold text-sm text-foreground truncate max-w-xs">
              {conversations.find(c => c.id === activeConvoId)?.title || "New Chat"}
            </h2>
            <select value={mode} onChange={e => setMode(e.target.value)}
              className="bg-secondary/50 border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer">
              {MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative group">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
              <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-xl shadow-2xl z-20 opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all">
                {[{ label: "Word Document (.docx)", fmt: "docx" }, { label: "Web Page (.html)", fmt: "html" }, { label: "Markdown (.md)", fmt: "markdown" }].map(e => (
                  <button key={e.fmt} onClick={() => exportChat(e.fmt)}
                    className="w-full text-left px-4 py-2.5 text-xs text-foreground hover:bg-accent transition-colors first:rounded-t-xl last:rounded-b-xl flex items-center gap-2">
                    <Download className="w-3 h-3 text-primary" />{e.label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setShowContext(!showContext)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
              Context <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showContext ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        {/* Context detection banner */}
        <AnimatePresence>
          {detectedCtx && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="px-4 py-2 border-b border-border bg-primary/5 overflow-hidden">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-primary font-semibold">Auto-detected:</span>
                {detectedCtx.vendor && <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-semibold">{detectedCtx.vendor}</span>}
                {detectedCtx.country && <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold">{detectedCtx.country}</span>}
                {detectedCtx.vertical && <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-semibold">{detectedCtx.vertical}</span>}
                <span className="text-muted-foreground">— knowledge base will be queried automatically</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-8 space-y-6">
          {messages.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-2xl" style={{ background: "var(--gradient-primary)" }}>
                <Bot className="w-10 h-10 text-white" />
              </div>
              <h2 className="font-heading font-bold text-2xl text-foreground mb-2">RFI Intelligence Engine</h2>
              <p className="text-sm text-muted-foreground max-w-md leading-relaxed mb-8">
                Generate structured RFI responses, create tables, analyze documents, and research vendor capabilities across the MEA region. Responses support full Markdown including tables, code blocks, and rich formatting.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                {SUGGESTED_PROMPTS.map(p => (
                  <button key={p} onClick={() => setInput(p)}
                    className="text-xs px-4 py-2.5 rounded-xl border border-border text-foreground/70 hover:bg-accent hover:border-primary/40 hover:text-foreground transition-all">
                    {p}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {messages.map((msg, i) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i === messages.length - 1 ? 0 : 0 }}
              onMouseEnter={() => setHoveredMsg(msg.id)} onMouseLeave={() => setHoveredMsg(null)}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>

              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 shadow-md" style={{ background: "var(--gradient-primary)" }}>
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}

              <div className={`${msg.role === "user" ? "max-w-[55%]" : "max-w-[72%]"}`}>
                {msg.files && msg.files.length > 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap justify-end">
                    {msg.files.map((f, fi) => (
                      <div key={fi} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/60 border border-border text-xs">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span>{f.name}</span><span className="text-muted-foreground">{f.size}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className={msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}>
                  {msg.role === "user"
                    ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    : msg.isStreaming && msg.content === ""
                      ? <div className="flex gap-1.5 py-1">{[0, 150, 300].map(d => <div key={d} className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: d + "ms" }} />)}</div>
                      : <MessageContent content={msg.content} />
                  }
                  {msg.isStreaming && msg.content.length > 0 && (
                    <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-text-bottom" />
                  )}
                </div>

                {msg.role === "assistant" && !msg.isStreaming && hoveredMsg === msg.id && (
                  <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-0.5 mt-1.5">
                    {[
                      { icon: copiedId === msg.id ? CheckCheck : Copy, label: "Copy", fn: () => copyMsg(msg.id, msg.content), cls: copiedId === msg.id ? "text-emerald-400" : "" },
                      { icon: ThumbsUp, label: "Good", fn: () => toast.success("Thanks for the feedback!"), cls: "" },
                      { icon: ThumbsDown, label: "Bad", fn: () => toast.info("Feedback recorded"), cls: "" },
                      { icon: Volume2, label: "Read aloud", fn: () => { const u = new SpeechSynthesisUtterance(cleanContent(msg.content).substring(0, 2000)); window.speechSynthesis.speak(u); }, cls: "" },
                      { icon: RefreshCw, label: "Regenerate", fn: () => toast.info("Click Regenerate to resend the last message"), cls: "" },
                      { icon: Pin, label: "Pin", fn: () => toast.info("Pinning coming soon"), cls: "" },
                    ].map(({ icon: Icon, label, fn, cls }) => (
                      <button key={label} title={label} onClick={fn}
                        className={`p-1.5 rounded-md hover:bg-accent transition-colors ${cls || "text-muted-foreground hover:text-foreground"}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                    <span className="text-[10px] text-muted-foreground ml-2 font-mono">{msg.timestamp.toLocaleTimeString()}</span>
                  </motion.div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 mt-1">
                  <span className="text-xs font-heading font-bold">U</span>
                </div>
              )}
            </motion.div>
          ))}

          {!isStreaming && messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
            <div className="flex flex-wrap gap-2 ml-11">
              {["Generate full 8-section RFI", "Create a data table", "Show org chart structure", "Export as Word document"].map(p => (
                <button key={p} onClick={() => setInput(p)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-accent hover:border-primary/30 transition-all">
                  {p}
                </button>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/60 border border-border text-xs">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span>{f.name}</span><span className="text-muted-foreground">{f.size}</span>
                  <button onClick={() => setAttachedFiles(p => p.filter((_, j) => j !== i))} className="ml-1"><X className="w-3 h-3 text-muted-foreground hover:text-rose-400" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 glass-panel p-3">
            <label className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0">
              <Paperclip className="w-5 h-5" />
              <input type="file" multiple className="hidden" onChange={e => { if (e.target.files) { onDrop(Array.from(e.target.files)); e.target.value = ""; } }} />
            </label>
            <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={isStreaming ? "Generating…" : "Ask me anything — RFI responses, vendor tables, compliance checks… (Enter to send)"}
              disabled={isStreaming} rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none disabled:opacity-40 leading-relaxed"
              style={{ minHeight: "24px", maxHeight: "160px" }} />
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-muted-foreground tabular-nums">{input.length}</span>
              <button onClick={() => setIsListening(!isListening)}
                className={`p-2 rounded-lg transition-colors ${isListening ? "bg-rose-500/20 text-rose-400" : "hover:bg-accent text-muted-foreground hover:text-foreground"}`}>
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button onClick={handleSend} disabled={(!input.trim() && !attachedFiles.length) || isStreaming}
                className="p-2.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: (input.trim() || attachedFiles.length) && !isStreaming ? "var(--gradient-primary)" : "hsl(var(--secondary))" }}>
                {isStreaming ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4 text-white" />}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">Enter to send · Shift+Enter for new line · Drag & drop files anywhere</p>
        </div>
      </div>

      {/* Context panel */}
      <AnimatePresence>
        {showContext && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 272, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.25 }}
            className="border-l border-border bg-card/10 overflow-hidden shrink-0">
            <div className="p-4 space-y-5 overflow-y-auto h-full scrollbar-thin" style={{ width: 272 }}>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">AI Confidence</p>
                <div className="relative w-24 h-24 mx-auto">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--primary))" strokeWidth="8"
                      strokeDasharray={`${(lastConfidence?.overall || 0) * 2.51} 251`} strokeLinecap="round" className="transition-all duration-700" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-heading font-bold">{lastConfidence?.overall ? lastConfidence.overall + "%" : "—"}</span>
                    {lastConfidence?.chunks_used ? <span className="text-[9px] text-muted-foreground">{lastConfidence.chunks_used} chunks</span> : null}
                  </div>
                </div>
              </div>

              {(lastConfidence?.vendor || lastConfidence?.country) && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Detected Context</p>
                  <div className="space-y-1.5 text-xs">
                    {[["Vendor", lastConfidence?.vendor], ["Country", lastConfidence?.country]].filter(([, v]) => v).map(([k, v]) => (
                      <div key={String(k)} className="flex justify-between items-center">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="px-2 py-0.5 rounded bg-primary/15 text-primary font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Section Scores</p>
                <div className="space-y-2.5">
                  {[["Company Overview", 95], ["Financial Stability", 88], ["Org Structure", 82], ["Vendor Capability", 96], ["Country Execution", 91], ["Technical", 87], ["Logistics", 78], ["Compliance", 72]].map(([name, score]) => (
                    <div key={String(name)}>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-muted-foreground truncate pr-1">{name}</span>
                        <span className={Number(score) >= 80 ? "text-emerald-400" : Number(score) >= 60 ? "text-amber-400" : "text-rose-400"}>{score}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary">
                        <div className={`h-full rounded-full transition-all duration-700 ${Number(score) >= 80 ? "bg-emerald-500" : Number(score) >= 60 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: score + "%" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Export Chat</p>
                <div className="space-y-1.5">
                  {[["DOCX", "docx"], ["HTML", "html"], ["Markdown", "markdown"]].map(([label, fmt]) => (
                    <button key={fmt} onClick={() => exportChat(fmt)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 hover:bg-accent border border-border text-xs transition-colors">
                      <Download className="w-3.5 h-3.5 text-primary" /> Export as {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
