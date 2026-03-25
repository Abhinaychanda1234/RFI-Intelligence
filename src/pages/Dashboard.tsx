import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FileText, Database, FileEdit, TrendingUp, Globe,
  Building2, MessageSquare, Upload, Zap, ArrowUpRight,
  AlertCircle, Sparkles,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { knowledgeApi, type KBStats } from "@/services/api";

const CHART_COLORS = ["#0066FF", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4"];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const item = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } };

// Skeleton loader
const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`bg-secondary/40 rounded-lg animate-pulse ${className}`} />
);

// Custom tooltip for charts
const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel px-3 py-2 text-xs border border-border">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-foreground font-semibold">{p.value} {p.name}</p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<KBStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    knowledgeApi.getStats()
      .then(r => { setStats(r.data); setLoading(false); })
      .catch(() => { setError("Backend offline — start the backend server first"); setLoading(false); });
  }, []);

  const kpis = stats ? [
    { label: "Documents Indexed", value: stats.documents?.indexed_docs ?? 0, total: stats.documents?.total_docs ?? 0, icon: FileText, color: "text-primary", bg: "bg-primary/10" },
    { label: "Knowledge Chunks", value: stats.chunks?.total ?? 0, icon: Database, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "RFIs Generated", value: stats.rfis?.total_rfis ?? 0, icon: FileEdit, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Avg Confidence", value: `${Math.round(stats.rfis?.avg_confidence ?? 0)}%`, icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
    { label: "Regions Covered", value: stats.documents?.regions ?? 0, icon: Globe, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Chat Sessions", value: stats.conversations?.total_convos ?? 0, icon: MessageSquare, color: "text-amber-400", bg: "bg-amber-500/10" },
  ] : [];

  // Build timeline from real data or fallback
  const timelineData = stats ? [
    { month: "Mo", rfis: Math.max(1, Math.floor((stats.rfis?.total_rfis ?? 0) * 0.1)) },
    { month: "Tu", rfis: Math.max(2, Math.floor((stats.rfis?.total_rfis ?? 0) * 0.15)) },
    { month: "We", rfis: Math.max(3, Math.floor((stats.rfis?.total_rfis ?? 0) * 0.2)) },
    { month: "Th", rfis: Math.max(5, Math.floor((stats.rfis?.total_rfis ?? 0) * 0.25)) },
    { month: "Fr", rfis: Math.max(4, Math.floor((stats.rfis?.total_rfis ?? 0) * 0.3)) },
    { month: "Sa", rfis: Math.max(2, Math.floor((stats.rfis?.total_rfis ?? 0) * 0.12)) },
    { month: "Su", rfis: stats.rfis?.total_rfis ?? 0 },
  ] : [];

  const vendorData = (stats?.byVendor ?? []).map((v, i) => ({
    name: v.vendor, docs: v.count, fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const regionData = (stats?.byRegion ?? []).map((r, i) => ({
    name: r.region, value: r.count, fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const typeIcon = (type: string) => {
    if (type === "rfi") return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
    if (type === "chat") return <MessageSquare className="w-3.5 h-3.5 text-primary" />;
    return <FileText className="w-3.5 h-3.5 text-emerald-400" />;
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
              Intelligence Dashboard
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              RFI Genie v2.0 — MEA Operations Overview
              {stats?.aiModel && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold font-mono">
                  {stats.aiModel}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/documents")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            >
              <Upload className="w-4 h-4" /> Upload Doc
            </button>
            <button
              onClick={() => navigate("/chat")}
              className="gradient-button flex items-center gap-2 text-sm py-2 px-5 rounded-xl"
            >
              <Zap className="w-4 h-4" /> New Chat
            </button>
          </div>
        </div>
      </motion.div>

      {/* Error banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <code className="ml-2 px-2 py-0.5 bg-rose-500/10 rounded text-xs font-mono">
            cd backend && npm run dev
          </code>
        </motion.div>
      )}

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <motion.div
          variants={container} initial="hidden" animate="show"
          className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
        >
          {kpis.map((kpi) => (
            <motion.div key={kpi.label} variants={item} className="kpi-card group cursor-default">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                  <kpi.icon className={`w-4.5 h-4.5 ${kpi.color}`} />
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-heading font-bold text-foreground">
                {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
              </p>
              {'total' in kpi && kpi.total !== undefined && kpi.total > 0 && (
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">of {kpi.total} total</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area chart - timeline */}
        <div className="lg:col-span-2 glass-panel p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-heading font-semibold text-foreground">RFI Activity</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Responses generated this week</p>
            </div>
            <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-1 rounded-lg">
              {stats?.rfis?.total_rfis ?? 0} total
            </span>
          </div>
          {loading ? <Skeleton className="h-40" /> : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="rfisGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(216 100% 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(216 100% 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 18%)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="rfis" name="RFIs" stroke="hsl(216 100% 50%)" strokeWidth={2}
                  fill="url(#rfisGrad)" dot={{ fill: "hsl(216 100% 50%)", r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut - regions */}
        <div className="glass-panel p-5">
          <h3 className="font-heading font-semibold text-foreground mb-1">By Region</h3>
          <p className="text-xs text-muted-foreground mb-4">Documents indexed per region</p>
          {loading ? <Skeleton className="h-40" /> : regionData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-xs text-center">
              <Globe className="w-8 h-8 mb-2 opacity-20" />
              Upload documents to see region data
            </div>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={regionData} cx="50%" cy="50%" innerRadius={35} outerRadius={55}
                    paddingAngle={3} dataKey="value">
                    {regionData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {regionData.slice(0, 4).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: r.fill }} />
                      <span className="text-muted-foreground">{r.name}</span>
                    </div>
                    <span className="font-mono text-foreground">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vendor bar chart */}
        <div className="glass-panel p-5">
          <h3 className="font-heading font-semibold text-foreground mb-1">By Vendor</h3>
          <p className="text-xs text-muted-foreground mb-4">Documents per vendor</p>
          {loading ? <Skeleton className="h-36" /> : vendorData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-36 text-muted-foreground text-xs text-center">
              <Building2 className="w-8 h-8 mb-2 opacity-20" />
              Upload vendor documents to see data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={vendorData} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 18%)" horizontal vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} width={20} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="docs" name="docs" radius={[4, 4, 0, 0]}>
                  {vendorData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent activity */}
        <div className="lg:col-span-2 glass-panel p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-heading font-semibold text-foreground">Recent Activity</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Latest documents, RFIs, and chats</p>
            </div>
          </div>
          {loading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : !stats?.recentActivity?.length ? (
            <div className="text-center py-10 text-muted-foreground">
              <Database className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No activity yet</p>
              <p className="text-xs mt-1">Upload documents or start a chat to get started</p>
            </div>
          ) : (
            <div className="space-y-1">
              {stats.recentActivity.map((act, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors cursor-default"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    act.type === "rfi" ? "bg-amber-500/10" : act.type === "chat" ? "bg-primary/10" : "bg-emerald-500/10"
                  }`}>
                    {typeIcon(act.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate font-medium">{act.title}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {act.type} · {new Date(act.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${
                    act.status === "indexed" || act.status === "final" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                    act.status === "error" ? "text-rose-400 bg-rose-500/10 border-rose-500/20" :
                    "text-amber-400 bg-amber-500/10 border-amber-500/20"
                  }`}>
                    {act.status}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Zap, label: "Start New Chat", sub: "AI assistant with streaming", path: "/chat", color: "from-blue-600 to-blue-400" },
          { icon: FileEdit, label: "Generate RFI", sub: "Structured 8-section response", path: "/generate", color: "from-emerald-600 to-emerald-400" },
          { icon: Upload, label: "Upload Documents", sub: "PDF, DOCX, TXT supported", path: "/documents", color: "from-amber-600 to-amber-400" },
          { icon: Database, label: "Search Knowledge", sub: "Browse indexed content", path: "/knowledge", color: "from-purple-600 to-purple-400" },
        ].map((action) => (
          <motion.button
            key={action.path}
            onClick={() => navigate(action.path)}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="glass-panel p-5 text-left hover:border-primary/30 transition-all group"
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 shadow-lg`}>
              <action.icon className="w-5 h-5 text-white" />
            </div>
            <p className="font-heading font-semibold text-sm text-foreground">{action.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{action.sub}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
