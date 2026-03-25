import { useState } from "react";
import { Search, Database, Globe, Building2, Layers, FileText } from "lucide-react";
import { knowledgeApi } from "@/services/api";
import { toast } from "sonner";

const VENDORS = ["HPE", "Cisco", "Dell", "IBM"];
const REGIONS = ["Africa", "Gulf", "Saudi", "Levant", "Israel", "Pan-Regional"];
const SECTIONS = ["Company Overview", "Financial Stability", "Organizational Structure", "Technical Capabilities", "Logistics", "Marketing & GTM", "Compliance", "Reporting Systems", "Risk Management"];

interface Result { id: string; content: string; section_type: string; doc_name: string; confidence: number; region?: string; vendor?: string; country?: string; }

export default function KnowledgeBase() {
  const [query, setQuery] = useState("");
  const [vendor, setVendor] = useState("");
  const [region, setRegion] = useState("");
  const [section, setSection] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setSearched(true);
    try {
      const r = await knowledgeApi.search({ q: query, ...(vendor && { vendor }), ...(region && { region }), ...(section && { vertical: section }) });
      setResults(r.data.results);
    } catch { toast.error("Search failed"); setResults([]); }
    setLoading(false);
  };

  const conf = (n: number) => n >= 0.8 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : n >= 0.6 ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-rose-400 bg-rose-500/10 border-rose-500/20";

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-3"><Database className="w-7 h-7 text-emerald-400" /> Knowledge Base</h1>
        <p className="text-sm text-muted-foreground mt-1">Full-text search across all indexed document content</p>
      </div>

      <form onSubmit={search} className="glass-panel p-5 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your knowledge base… (e.g. 'Cisco revenue UAE', 'warehouse Egypt capacity')"
              className="w-full bg-secondary/50 border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <button type="submit" disabled={loading || !query.trim()} className="gradient-button px-6 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-40">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />} Search
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { v: vendor, s: setVendor, label: "Vendor", opts: VENDORS, icon: Building2 },
            { v: region, s: setRegion, label: "Region", opts: REGIONS, icon: Globe },
            { v: section, s: setSection, label: "Section Type", opts: SECTIONS, icon: Layers },
          ].map(({ v, s, label, opts }) => (
            <select key={label} value={v} onChange={e => s(e.target.value)}
              className="bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none cursor-pointer appearance-none">
              <option value="">All {label}s</option>
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          ))}
        </div>
      </form>

      {loading && <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-secondary/30 rounded-xl animate-pulse" />)}</div>}

      {!loading && searched && results.length === 0 && (
        <div className="glass-panel p-16 text-center">
          <Database className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
          <p className="font-heading font-semibold text-foreground">No results found</p>
          <p className="text-sm text-muted-foreground mt-1">Try different keywords or upload more knowledge documents</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div>
          <p className="text-sm text-muted-foreground mb-4 font-mono">{results.length} chunks found</p>
          <div className="space-y-3">
            {results.map(r => (
              <div key={r.id} className="glass-panel p-5 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-semibold text-foreground">{r.doc_name}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">·</span>
                    <span className="text-xs text-primary">{r.section_type}</span>
                    {r.vendor && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{r.vendor}</span>}
                    {r.region && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{r.region}</span>}
                    {r.country && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">{r.country}</span>}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${conf(r.confidence)}`}>{Math.round(r.confidence * 100)}%</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-5 mt-2">{r.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!searched && (
        <div className="text-center py-24 text-muted-foreground">
          <Search className="w-16 h-16 mx-auto mb-4 opacity-10" />
          <p className="font-heading text-lg font-semibold">Search your indexed knowledge</p>
          <p className="text-sm mt-2">Find content across all uploaded and indexed documents</p>
        </div>
      )}
    </div>
  );
}
