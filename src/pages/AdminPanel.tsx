import { useState, useEffect } from "react";
import { Settings, Cpu, Shield, BarChart3, Trash2, RefreshCw, Eye, EyeOff, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { adminApi, knowledgeApi } from "@/services/api";

interface AdminStats { totalDocs: number; totalChunks: number; totalRFIs: number; totalConvos: number; totalApiCalls: number; totalTokens: number; estimatedCostUSD: string; health: { api: boolean; db: boolean; storage: boolean }; settings: Record<string, string>; }

export default function AdminPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    Promise.all([adminApi.getStats(), knowledgeApi.getSettings()])
      .then(([s, cfg]) => { setStats(s.data); setSettings(cfg.data); })
      .catch(() => toast.error("Backend offline — start backend first"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try { await knowledgeApi.updateSettings(settings); toast.success("Settings saved"); }
    catch { toast.error("Save failed"); }
    setSaving(false);
  };

  const clearData = async (type: string) => {
    const labels: Record<string, string> = { rfis: "all RFI responses", conversations: "all chat conversations", all: "ALL history" };
    if (!confirm(`Delete ${labels[type]}? This cannot be undone.`)) return;
    try { await adminApi.clearHistory(type); toast.success("Cleared"); }
    catch { toast.error("Failed"); }
  };

  const reindex = async () => {
    try { await adminApi.reindex(); toast.success("Reindexing started"); }
    catch { toast.error("Reindex failed"); }
  };

  if (loading) return <div className="p-8 space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-secondary/30 rounded-xl animate-pulse" />)}</div>;

  const health = stats?.health;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-3"><Settings className="w-6 h-6 text-primary" /> Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">System configuration, monitoring, and management</p>
        </div>
        <button onClick={save} disabled={saving} className="gradient-button flex items-center gap-2 text-sm py-2.5 px-5 rounded-lg disabled:opacity-40">
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Save Settings
        </button>
      </div>

      {/* System health */}
      <div className="glass-panel p-5">
        <h2 className="font-heading font-semibold text-base text-foreground mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> System Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {[
            { label: "Documents", value: stats?.totalDocs || 0 },
            { label: "Knowledge Chunks", value: (stats?.totalChunks || 0).toLocaleString() },
            { label: "RFIs Generated", value: stats?.totalRFIs || 0 },
            { label: "API Calls", value: stats?.totalApiCalls || 0 },
          ].map(({ label, value }) => (
            <div key={label} className="bg-secondary/40 rounded-xl p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-heading font-bold text-2xl text-foreground mt-1">{value}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            {health?.api ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
            <span className={health?.api ? "text-emerald-400" : "text-rose-400"}>AI API {health?.api ? "Connected" : "Disconnected"}</span>
          </div>
          <div className="flex items-center gap-2">
            {health?.db ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
            <span className={health?.db ? "text-emerald-400" : "text-rose-400"}>Database {health?.db ? "OK" : "Error"}</span>
          </div>
          <span className="text-muted-foreground text-xs font-mono ml-auto">Estimated cost: ${stats?.estimatedCostUSD || "0.00"} USD · {((stats?.totalTokens || 0) / 1000).toFixed(1)}K tokens</span>
        </div>
      </div>

      {/* AI Config */}
      <div className="glass-panel p-5">
        <h2 className="font-heading font-semibold text-base text-foreground mb-4 flex items-center gap-2"><Cpu className="w-4 h-4 text-amber-400" /> AI Configuration</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">AI Model</label>
            <select value={settings.ai_model || "gpt-4o"} onChange={e => setSettings(s => ({ ...s, ai_model: e.target.value }))}
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none appearance-none cursor-pointer text-foreground">
              {["gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Max Tokens</label>
            <input type="number" value={settings.max_tokens || "4000"} onChange={e => setSettings(s => ({ ...s, max_tokens: e.target.value }))} min="500" max="8000"
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-foreground mb-1.5 flex items-center justify-between">
              Temperature: <span className="text-primary font-mono">{parseFloat(settings.temperature || "0.3").toFixed(1)}</span>
            </label>
            <input type="range" min="0" max="1" step="0.1" value={settings.temperature || "0.3"} onChange={e => setSettings(s => ({ ...s, temperature: e.target.value }))}
              className="w-full accent-primary" />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5"><span>Precise (0)</span><span>Creative (1)</span></div>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-foreground mb-1.5 flex items-center justify-between">
              Confidence Threshold: <span className="text-primary font-mono">{Math.round(parseFloat(settings.confidence_threshold || "0.7") * 100)}%</span>
            </label>
            <input type="range" min="0.4" max="1" step="0.05" value={settings.confidence_threshold || "0.7"} onChange={e => setSettings(s => ({ ...s, confidence_threshold: e.target.value }))}
              className="w-full accent-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Max Knowledge Chunks per Query</label>
            <input type="number" value={settings.max_chunks_per_query || "15"} onChange={e => setSettings(s => ({ ...s, max_chunks_per_query: e.target.value }))} min="5" max="50"
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Admin Password</label>
            <div className="relative">
              <input type={showKey ? "text" : "password"} value={settings.admin_password || ""} onChange={e => setSettings(s => ({ ...s, admin_password: e.target.value }))}
                className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground pr-10" />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="glass-panel p-5">
        <h2 className="font-heading font-semibold text-base text-foreground mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-400" /> Intelligence Features</h2>
        <div className="space-y-3">
          {[
            { key: "auto_localization", label: "Auto-Localization", desc: "Automatically pull country-specific data when geographic context is detected in prompts" },
            { key: "vendor_positioning", label: "Vendor Positioning Mode", desc: "Apply vendor-specific intelligence rules (Cisco → networking focus, IBM → WatsonX/AI, etc.)" },
            { key: "compliance_guardrails", label: "Compliance Guardrails", desc: "Auto-check for export control language, WHT references, and legal consistency in responses" },
            { key: "streaming_enabled", label: "Streaming Responses", desc: "Stream AI responses token-by-token for a real-time Claude-like experience in the chat" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border">
              <div className="flex-1 mr-4">
                <p className="font-medium text-sm text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
              <button onClick={() => setSettings(s => ({ ...s, [key]: s[key] === "true" ? "false" : "true" }))}
                className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${settings[key] === "true" ? "bg-primary" : "bg-secondary border border-border"}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings[key] === "true" ? "translate-x-7" : "translate-x-1"}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="glass-panel p-5 border-rose-500/20">
        <h2 className="font-heading font-semibold text-base text-foreground mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-400" /> Management</h2>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={reindex} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm hover:bg-primary/20 transition-colors">
            <RefreshCw className="w-4 h-4" /> Reindex Failed Documents
          </button>
          <button onClick={() => clearData("rfis")} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm hover:bg-rose-500/20 transition-colors">
            <Trash2 className="w-4 h-4" /> Clear RFI History
          </button>
          <button onClick={() => clearData("conversations")} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm hover:bg-rose-500/20 transition-colors">
            <Trash2 className="w-4 h-4" /> Clear Chat History
          </button>
          <button onClick={() => clearData("all")} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm hover:bg-rose-500/20 transition-colors font-semibold">
            <Trash2 className="w-4 h-4" /> Clear Everything
          </button>
        </div>
      </div>
    </div>
  );
}
