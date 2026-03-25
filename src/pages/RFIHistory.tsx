import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { History, Sparkles, Trash2, Search, Download, Clock, CheckCircle, Archive } from "lucide-react";
import { toast } from "sonner";
import { rfiApi, type RFIResponse } from "@/services/api";

export default function RFIHistory() {
  const [rfis, setRfis] = useState<RFIResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RFIResponse | null>(null);
  const [search, setSearch] = useState("");
  const [filterVendor, setFilterVendor] = useState("");

  const load = () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (filterVendor) params.vendor = filterVendor;
    setLoading(true);
    rfiApi.list(params).then(r => setRfis(r.data.rfis)).catch(() => toast.error("Failed to load")).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, filterVendor]);

  const viewFull = async (id: string) => {
    try { const r = await rfiApi.get(id); setSelected(r.data); }
    catch { toast.error("Failed to load RFI"); }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this RFI response?")) return;
    try { await rfiApi.delete(id); toast.success("Deleted"); load(); if (selected?.id === id) setSelected(null); }
    catch { toast.error("Delete failed"); }
  };

  const score = (n: number) => n >= 80 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : n >= 60 ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-rose-400 bg-rose-500/10 border-rose-500/20";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* List */}
      <div className="w-80 border-r border-border flex flex-col bg-card/10 shrink-0">
        <div className="p-4 border-b border-border">
          <h1 className="font-heading font-bold text-lg text-foreground flex items-center gap-2"><History className="w-5 h-5 text-primary" /> RFI History</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{rfis.length} responses generated</p>
        </div>
        <div className="p-3 border-b border-border space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search RFIs…"
              className="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground" />
          </div>
          <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs focus:outline-none cursor-pointer appearance-none text-foreground">
            <option value="">All Vendors</option>
            {["HPE", "Cisco", "Dell", "IBM"].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loading && [...Array(6)].map((_, i) => <div key={i} className="h-20 m-2 bg-secondary/30 rounded-lg animate-pulse" />)}
          {!loading && rfis.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No RFIs generated yet</p>
            </div>
          )}
          {rfis.map(rfi => (
            <button key={rfi.id} onClick={() => viewFull(rfi.id)}
              className={`w-full text-left p-4 border-b border-border hover:bg-accent/30 transition-colors ${selected?.id === rfi.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">{rfi.title}</p>
                <span className={`tag shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${score(rfi.confidence_score)}`}>{Math.round(rfi.confidence_score)}%</span>
              </div>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {rfi.vendor && <span className="text-[10px] text-blue-400">{rfi.vendor}</span>}
                {rfi.country && <span className="text-[10px] text-emerald-400">{rfi.country}</span>}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                {rfi.status === "final" ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : rfi.status === "archived" ? <Archive className="w-3 h-3 text-muted-foreground" /> : <Clock className="w-3 h-3 text-muted-foreground" />}
                <p className="text-[10px] text-muted-foreground font-mono">{new Date(rfi.created_at).toLocaleString()}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-center p-16">
            <div>
              <History className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
              <p className="font-heading font-semibold text-lg text-foreground">Select an RFI to view</p>
              <p className="text-sm text-muted-foreground mt-1">Click any item from the list on the left</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between px-8 py-4 border-b border-border bg-background/95 backdrop-blur z-10">
              <div>
                <h2 className="font-heading font-bold text-xl text-foreground">{selected.title}</h2>
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  {selected.vendor && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{selected.vendor}</span>}
                  {selected.country && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{selected.country}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${score(selected.confidence_score)}`}>{Math.round(selected.confidence_score)}% confidence</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => window.open(rfiApi.exportUrl(selected.id, "docx"), "_blank")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs hover:bg-primary/20 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Export DOCX
                </button>
                <button onClick={() => rfiApi.update(selected.id, { status: "final" }).then(() => { toast.success("Marked as Final"); setSelected({ ...selected, status: "final" }); })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs hover:bg-emerald-500/20 transition-colors">
                  <CheckCircle className="w-3.5 h-3.5" /> Mark Final
                </button>
                <button onClick={() => del(selected.id)} className="p-2 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-8 max-w-4xl">
              {/* Original prompt */}
              <div className="glass-panel p-4 mb-6 border-l-4 border-l-primary">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Original Prompt</p>
                <p className="text-sm text-foreground/90">{selected.prompt}</p>
              </div>

              {/* Content */}
              <div className="prose prose-invert prose-sm max-w-none
                [&_h1]:font-heading [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mt-6 [&_h1]:mb-3
                [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-primary [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-2
                [&_h3]:font-heading [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-4 [&_h3]:mb-2
                [&_p]:text-foreground/90 [&_p]:leading-relaxed [&_p]:mb-3
                [&_ul]:my-2 [&_ul]:space-y-1.5 [&_li]:text-foreground/85
                [&_ol]:my-2 [&_ol]:space-y-1.5
                [&_strong]:text-foreground [&_strong]:font-semibold
                [&_blockquote]:border-l-2 [&_blockquote]:border-primary/60 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-3
                [&_code]:bg-secondary [&_code]:text-primary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
                [&_pre]:bg-secondary/80 [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-border
                [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:text-sm [&_table]:overflow-hidden
                [&_thead_tr]:bg-primary/15
                [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wide [&_th]:border-b [&_th]:border-border
                [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-foreground/85 [&_td]:border-b [&_td]:border-border/40
                [&_tbody_tr:last-child_td]:border-b-0
                [&_tbody_tr:nth-child(even)]:bg-secondary/20">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {(selected.response || "").replace(/<confidence_data>[\s\S]*?<\/confidence_data>/g, "").trim()}
                </ReactMarkdown>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-6">Generated: {new Date(selected.created_at).toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
