import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Zap, CheckSquare, RotateCw, Download, Copy, ChevronRight, Sparkles, AlertCircle, CheckCheck, Square } from "lucide-react";
import { toast } from "sonner";
import { rfiApi } from "@/services/api";

const vendors = ["HPE", "Cisco", "Dell", "IBM"];
const regions = ["Africa", "Gulf", "Saudi", "Levant", "Israel", "Pan-Regional"];
const countries = ["Egypt", "Morocco", "UAE", "Qatar", "Bahrain", "Oman", "Saudi Arabia", "Lebanon", "Israel"];
const verticals = ["Infrastructure (DC/Networking)", "Cybersecurity", "AI & HPC", "Enterprise Software", "DC-POS"];
const formats = ["Formal Executive", "Technical Detail", "Summary Brief"];

const SECTIONS = [
  { id: 1, name: "Company Overview" },
  { id: 2, name: "Financial Stability" },
  { id: 3, name: "Organizational Structure" },
  { id: 4, name: "Vendor-Specific Capability" },
  { id: 5, name: "Country-Specific Execution" },
  { id: 6, name: "Technical Capability by Vertical" },
  { id: 7, name: "Logistics & Operations" },
  { id: 8, name: "Compliance & Governance" },
];

interface GeneratedSection { title: string; content: string; confidence: number; }

export default function GenerateRFI() {
  const [question, setQuestion] = useState("");
  const [vendor, setVendor] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [vertical, setVertical] = useState("");
  const [format, setFormat] = useState("Formal Executive");
  const [selectedSections, setSelectedSections] = useState(SECTIONS.map(s => s.id));
  const [activeSection, setActiveSection] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [sections, setSections] = useState<GeneratedSection[]>([]);
  const [fullContent, setFullContent] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [rfiId, setRfiId] = useState<string | null>(null);
  const [context, setContext] = useState<{ vendor?: string; country?: string; vertical?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [detectingCtx, setDetectingCtx] = useState(false);

  useEffect(() => {
    if (question.length < 15) return;
    const t = setTimeout(async () => {
      setDetectingCtx(true);
      try {
        const r = await rfiApi.detectContext(question);
        const c = r.data;
        if (c.vendor && !vendor) setVendor(c.vendor);
        if (c.country && !country) setCountry(c.country);
        if (c.vertical && !vertical) setVertical(c.vertical);
      } catch {}
      setDetectingCtx(false);
    }, 600);
    return () => clearTimeout(t);
  }, [question]);

  const toggleSection = (id: number) => setSelectedSections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const handleGenerate = async () => {
    if (!question.trim()) { toast.error("Please enter an RFI question"); return; }
    setGenerating(true); setSections([]); setFullContent(""); setRfiId(null);
    try {
      const r = await rfiApi.generate({
        prompt: question,
        vendor: vendor || undefined,
        country: country || undefined,
        region: region || undefined,
        vertical: vertical || undefined,
        sections: SECTIONS.filter(s => selectedSections.includes(s.id)).map(s => s.name),
      });
      setSections(r.data.sections || []);
      setFullContent(r.data.content);
      setConfidence(r.data.confidence || r.data.confidence_score || 0);
      setRfiId(r.data.id);
      setContext(r.data.context as { vendor?: string; country?: string; vertical?: string });
      setActiveSection(0);
      toast.success("RFI response generated successfully!");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Generation failed — check backend & API key";
      toast.error(msg);
    }
    setGenerating(false);
  };

  const copyAll = () => {
    navigator.clipboard.writeText(fullContent);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  const exportDocx = () => {
    if (!rfiId) { toast.error("Generate an RFI first"); return; }
    window.open(rfiApi.exportUrl(rfiId, "docx"), "_blank");
  };

  const scoreColor = (s: number) => s >= 80 ? "bg-emerald-500" : s >= 60 ? "bg-amber-500" : "bg-rose-500";
  const scoreText = (s: number) => s >= 80 ? "text-emerald-400" : s >= 60 ? "text-amber-400" : "text-rose-400";

  const activeSectionData = sections[activeSection];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left config panel */}
      <div className="w-96 border-r border-border p-5 overflow-y-auto scrollbar-thin space-y-5 shrink-0 bg-card/10">
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">Generate RFI</h1>
          <p className="text-xs text-muted-foreground mt-1">AI-powered structured response generation</p>
        </div>

        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">RFI Question / Prompt *</label>
          <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="Paste your RFI question here or describe what you need…" rows={5}
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
          {detectingCtx && <p className="text-[10px] text-primary mt-1 animate-pulse">⚡ Auto-detecting context…</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Vendor", val: vendor, set: setVendor, opts: vendors, placeholder: "Auto-detect" },
            { label: "Country", val: country, set: setCountry, opts: countries, placeholder: "Auto-detect" },
            { label: "Region", val: region, set: setRegion, opts: regions, placeholder: "Auto-detect" },
            { label: "Vertical", val: vertical, set: setVertical, opts: verticals, placeholder: "All verticals" },
          ].map(({ label, val, set, opts, placeholder }) => (
            <div key={label}>
              <label className="text-xs font-medium text-foreground mb-1.5 block">{label}</label>
              <select value={val} onChange={e => set(e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer">
                <option value="">{placeholder}</option>
                {opts.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">Output Format</label>
          <div className="flex gap-2">
            {formats.map(f => (
              <button key={f} onClick={() => setFormat(f)}
                className={`flex-1 text-xs py-2 rounded-lg border transition-all ${format === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                {f.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-foreground">Sections to Include</label>
            <div className="flex gap-2">
              <button onClick={() => setSelectedSections(SECTIONS.map(s => s.id))} className="text-[10px] text-primary hover:underline">All</button>
              <button onClick={() => setSelectedSections([])} className="text-[10px] text-muted-foreground hover:underline">None</button>
            </div>
          </div>
          <div className="space-y-1.5">
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => toggleSection(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs transition-all ${selectedSections.includes(s.id) ? "border-primary/30 bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-border"}`}>
                {selectedSections.includes(s.id) ? <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0" /> : <Square className="w-3.5 h-3.5 shrink-0" />}
                {s.id}. {s.name}
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleGenerate} disabled={generating || !question.trim()}
          className="gradient-button w-full flex items-center justify-center gap-2 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold">
          {generating ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating… (30–60s)</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Generate RFI Response</>
          )}
        </button>
      </div>

      {/* Right output panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {sections.length === 0 && !generating ? (
          <div className="flex-1 flex items-center justify-center text-center p-12">
            <div>
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "var(--gradient-primary)" }}>
                <Zap className="w-10 h-10 text-white" />
              </div>
              <h2 className="font-heading font-bold text-2xl text-foreground mb-2">Ready to Generate</h2>
              <p className="text-sm text-muted-foreground max-w-sm">Configure your RFI parameters on the left, then click Generate. The AI will produce a structured, professional response with confidence scores per section.</p>
              <div className="flex flex-wrap gap-2 mt-6 justify-center">
                {["Supports Markdown tables", "8-section framework", "Vendor intelligence", "MEA knowledge base"].map(f => (
                  <span key={f} className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground">{f}</span>
                ))}
              </div>
            </div>
          </div>
        ) : generating ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-5" />
              <p className="font-heading font-semibold text-lg text-foreground">Generating RFI Response</p>
              <p className="text-sm text-muted-foreground mt-2">Analyzing knowledge base · Applying vendor intelligence · Structuring response</p>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/10 shrink-0">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-heading font-semibold text-foreground">Generated Response</p>
                  <p className="text-[10px] text-muted-foreground">{sections.length} sections · {context?.vendor && <span className="text-blue-400">{context.vendor}</span>}{context?.country && <span className="text-emerald-400"> · {context.country}</span>}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${confidence >= 80 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : confidence >= 60 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"}`}>
                  {confidence}% confidence
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={copyAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-accent text-xs text-muted-foreground hover:text-foreground transition-colors border border-border">
                  {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy All"}
                </button>
                <button onClick={exportDocx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-xs text-primary transition-colors border border-primary/20">
                  <Download className="w-3.5 h-3.5" /> Export DOCX
                </button>
                <button onClick={handleGenerate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-accent text-xs text-muted-foreground hover:text-foreground transition-colors border border-border">
                  <RotateCw className="w-3.5 h-3.5" /> Regenerate
                </button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Section navigator */}
              <div className="w-52 shrink-0 border-r border-border overflow-y-auto p-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-2 font-medium">Sections</p>
                {sections.map((s, i) => (
                  <button key={i} onClick={() => setActiveSection(i)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-all text-xs ${activeSection === i ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent"}`}>
                    <div className="font-medium truncate">{s.title}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className={`h-1 flex-1 rounded-full ${scoreColor(s.confidence)}`} style={{ opacity: 0.7 }} />
                      <span className={`text-[10px] font-mono ${scoreText(s.confidence)}`}>{s.confidence}%</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Section content */}
              <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
                {activeSectionData && (
                  <motion.div key={activeSection} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h2 className="font-heading font-bold text-2xl text-foreground">{activeSectionData.title}</h2>
                        <p className="text-xs text-muted-foreground mt-1">Section {activeSection + 1} of {sections.length}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${activeSectionData.confidence >= 80 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : activeSectionData.confidence >= 60 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"}`}>
                        {activeSectionData.confidence}% confidence
                      </span>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none
                      [&_h1]:font-heading [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mt-4 [&_h1]:mb-3
                      [&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-primary [&_h2]:mt-4 [&_h2]:mb-2
                      [&_h3]:font-heading [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-3 [&_h3]:mb-2
                      [&_p]:text-foreground/90 [&_p]:leading-relaxed [&_p]:mb-3
                      [&_ul]:my-2 [&_ul]:space-y-1.5 [&_li]:text-foreground/85 [&_li]:leading-relaxed
                      [&_ol]:my-2 [&_ol]:space-y-1.5
                      [&_strong]:text-foreground [&_strong]:font-semibold
                      [&_blockquote]:border-l-2 [&_blockquote]:border-primary/60 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-3
                      [&_code]:bg-secondary [&_code]:text-primary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
                      [&_pre]:bg-secondary/80 [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-border
                      [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:text-sm [&_table]:rounded-xl [&_table]:overflow-hidden
                      [&_thead_tr]:bg-primary/15
                      [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-heading [&_th]:font-semibold [&_th]:text-foreground [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wide [&_th]:border-b [&_th]:border-border
                      [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-foreground/85 [&_td]:border-b [&_td]:border-border/40
                      [&_tbody_tr:last-child_td]:border-b-0
                      [&_tbody_tr:nth-child(even)]:bg-secondary/20
                      [&_hr]:border-border [&_hr]:my-4">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeSectionData.content.replace(/<confidence_data>[\s\S]*?<\/confidence_data>/g, "").trim()}</ReactMarkdown>
                    </div>
                    {activeSection < sections.length - 1 && (
                      <button onClick={() => setActiveSection(i => i + 1)}
                        className="mt-8 flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
                        Next: {sections[activeSection + 1]?.title} <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Confidence sidebar */}
              <div className="w-52 shrink-0 border-l border-border p-4 space-y-4 overflow-y-auto">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Overall Score</p>
                  <div className="relative w-20 h-20 mx-auto">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--primary))" strokeWidth="10"
                        strokeDasharray={`${confidence * 2.51} 251`} strokeLinecap="round" className="transition-all duration-700" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-heading font-bold">{confidence}%</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">All Sections</p>
                  <div className="space-y-2">
                    {sections.map((s, i) => (
                      <button key={i} onClick={() => setActiveSection(i)} className={`w-full text-left ${activeSection === i ? "opacity-100" : "opacity-60 hover:opacity-100"} transition-opacity`}>
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-muted-foreground truncate pr-1">{s.title.split(" ")[0]}</span>
                          <span className={scoreText(s.confidence)}>{s.confidence}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary">
                          <div className={`h-full rounded-full ${scoreColor(s.confidence)}`} style={{ width: s.confidence + "%" }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
