import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
import { Upload, FileText, Trash2, RefreshCw, CheckCircle, XCircle, Clock, Search, X, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { documentsApi, type Document } from "@/services/api";

const VENDORS = ["HPE", "Cisco", "Dell", "IBM"];
const REGIONS = ["Africa", "Gulf", "Saudi", "Levant", "Israel", "Pan-Regional"];
const COUNTRIES = ["Egypt", "Morocco", "UAE", "Qatar", "Bahrain", "Oman", "Saudi Arabia", "Lebanon", "Israel"];
const VERTICALS = ["Infrastructure", "Cybersecurity", "AI & HPC", "Enterprise Software", "DC-POS"];
const DOC_TYPES = ["RFI", "RFP", "Financial Report", "Org Chart", "Vendor Agreement", "Certification", "Marketing Deck", "Warehouse Report", "Compliance Doc", "Other"];

const StatusIcon = ({ status }: { status: Document["status"] }) => ({
  indexed: <CheckCircle className="w-4 h-4 text-emerald-400" />,
  error: <XCircle className="w-4 h-4 text-rose-400" />,
  processing: <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />,
  indexing: <Loader2 className="w-4 h-4 text-primary animate-spin" />,
  queued: <Clock className="w-4 h-4 text-muted-foreground" />,
}[status] || null);

const StatusText = ({ status }: { status: Document["status"] }) => {
  const map = { indexed: "text-emerald-400", error: "text-rose-400", processing: "text-amber-400", indexing: "text-primary", queued: "text-muted-foreground" };
  return <span className={`text-xs font-medium capitalize ${map[status] || ""}`}>{status}</span>;
};

const fmt = (b: number) => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(1) + " MB";

interface UploadMeta { region: string; country: string; vendor: string; vertical: string; doc_type: string; year: string; }

export default function Documents() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterVendor, setFilterVendor] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [meta, setMeta] = useState<UploadMeta>({ region: "", country: "", vendor: "", vertical: "", doc_type: "", year: String(new Date().getFullYear()) });

  const load = useCallback(() => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (filterVendor) params.vendor = filterVendor;
    setLoading(true);
    documentsApi.list(params)
      .then(r => setDocuments(r.data.documents))
      .catch(() => toast.error("Failed to load documents"))
      .finally(() => setLoading(false));
  }, [search, filterVendor]);

  useEffect(() => { load(); }, [load]);

  // Poll processing docs
  useEffect(() => {
    const processing = documents.filter(d => d.status === "processing" || d.status === "indexing" || d.status === "queued");
    if (!processing.length) return;
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, [documents, load]);

  const onDrop = useCallback((files: File[]) => { setPendingFiles(files); setShowModal(true); }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"], "application/msword": [".doc"], "text/plain": [".txt"] }, multiple: true });

  const handleUpload = async () => {
    if (!pendingFiles.length) return;
    setUploading(true);
    try {
      for (const file of pendingFiles) {
        const fd = new FormData();
        fd.append("file", file);
        Object.entries(meta).forEach(([k, v]) => { if (v) fd.append(k, v); });
        await documentsApi.upload(fd);
      }
      toast.success(`${pendingFiles.length} file(s) uploaded and processing`);
      setShowModal(false); setPendingFiles([]); setMeta({ region: "", country: "", vendor: "", vertical: "", doc_type: "", year: String(new Date().getFullYear()) });
      setTimeout(load, 800);
    } catch { toast.error("Upload failed"); }
    setUploading(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try { await documentsApi.delete(id); toast.success("Deleted"); load(); }
    catch { toast.error("Delete failed"); }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Knowledge Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload RFIs, financial reports, org charts, certifications, and vendor agreements</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowModal(true)} className="gradient-button flex items-center gap-2 text-sm py-2 px-4 rounded-lg">
            <Upload className="w-4 h-4" /> Upload Document
          </button>
        </div>
      </div>

      {/* Drop zone */}
      <div {...getRootProps()} className={`glass-panel p-10 text-center cursor-pointer transition-all border-2 border-dashed ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
        <input {...getInputProps()} />
        <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragActive ? "text-primary" : "text-muted-foreground"}`} />
        <p className="font-heading font-semibold text-foreground">{isDragActive ? "Drop files here" : "Drag & drop documents"}</p>
        <p className="text-sm text-muted-foreground mt-1">PDF, DOCX, DOC, TXT — up to 50MB each</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents…"
            className="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)}
          className="bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none cursor-pointer appearance-none min-w-32">
          <option value="">All Vendors</option>
          {VENDORS.map(v => <option key={v}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-secondary/30 rounded-xl animate-pulse" />)}</div>
      ) : documents.length === 0 ? (
        <div className="glass-panel p-20 text-center">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
          <p className="font-heading font-semibold text-foreground">No documents yet</p>
          <p className="text-sm text-muted-foreground mt-1">Upload knowledge documents to power RFI generation</p>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Document", "Tags", "Chunks", "Size", "Added", "Status", ""].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documents.map(doc => (
                <motion.tr key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-accent/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground truncate max-w-48">{doc.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono uppercase">{doc.file_type}{doc.year ? ` · ${doc.year}` : ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {doc.vendor && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{doc.vendor}</span>}
                      {doc.country && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{doc.country}</span>}
                      {doc.vertical && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">{doc.vertical.split(" ")[0]}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono">{doc.chunk_count || "—"}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono">{fmt(doc.file_size)}</td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground font-mono">{new Date(doc.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5"><StatusIcon status={doc.status} /><StatusText status={doc.status} /></div>
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => handleDelete(doc.id, doc.name)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload modal */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-bold text-lg text-foreground">Document Metadata</h2>
              <button onClick={() => { setShowModal(false); setPendingFiles([]); }} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {pendingFiles.length > 0 && (
              <div className="mb-5 space-y-1.5">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <FileText className="w-4 h-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{f.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{fmt(f.size)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { k: "doc_type", label: "Document Type", opts: DOC_TYPES },
                { k: "vendor", label: "Vendor", opts: VENDORS },
                { k: "region", label: "Region", opts: REGIONS },
                { k: "country", label: "Country", opts: COUNTRIES },
                { k: "vertical", label: "Technology Vertical", opts: VERTICALS },
              ].map(({ k, label, opts }) => (
                <div key={k}>
                  <label className="text-xs font-medium text-foreground mb-1 block">{label}</label>
                  <select value={meta[k as keyof UploadMeta]} onChange={e => setMeta(m => ({ ...m, [k]: e.target.value }))}
                    className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer text-foreground">
                    <option value="">Select…</option>
                    {opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Year</label>
                <input type="number" value={meta.year} onChange={e => setMeta(m => ({ ...m, year: e.target.value }))} min="2015" max="2030"
                  className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setShowModal(false); setPendingFiles([]); }}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">Cancel</button>
              <button onClick={handleUpload} disabled={uploading || !pendingFiles.length}
                className="flex-1 gradient-button py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40">
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : <><Upload className="w-4 h-4" /> Upload & Process</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
