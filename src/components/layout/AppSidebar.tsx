import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  MessageSquare,
  FileEdit,
  Database,
  FolderOpen,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Globe,
  Zap,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", path: "/", icon: LayoutDashboard },
  { title: "AI Chat", path: "/chat", icon: MessageSquare, badge: true },
  { title: "Generate RFI", path: "/generate", icon: FileEdit },
  { title: "Knowledge Base", path: "/knowledge", icon: Database },
  { title: "Documents", path: "/documents", icon: FolderOpen },
  { title: "RFI History", path: "/history", icon: History },
];

const regions = [
  { name: "Gulf", active: true },
  { name: "KSA", active: true },
  { name: "Egypt", active: true },
  { name: "Israel", active: true },
  { name: "Levant", active: true },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="h-screen sticky top-0 flex flex-col border-r border-border bg-sidebar overflow-hidden z-50"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--gradient-primary)" }}>
          <Zap className="w-4 h-4 text-primary-foreground" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <span className="font-heading font-bold text-sm text-foreground">RFI Intelligence</span>
              <span className="block text-[10px] text-muted-foreground -mt-0.5">Engine</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group relative ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-sidebar-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary"
                />
              )}
              <item.icon className="w-5 h-5 shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {item.title}
                  </motion.span>
                )}
              </AnimatePresence>
              {item.badge && !collapsed && (
                <span className="gradient-badge ml-auto">AI</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Region Indicator */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-3 border-t border-border"
          >
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
              <Globe className="w-3 h-3" />
              <span className="uppercase tracking-wider font-medium">MEA Coverage</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {regions.map((r) => (
                <span
                  key={r.name}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                >
                  {r.name}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin + Collapse */}
      <div className="border-t border-border p-2 space-y-1">
        <NavLink
          to="/admin"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
            location.pathname === "/admin"
              ? "bg-primary/10 text-primary font-medium"
              : "text-sidebar-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <Settings className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Admin Panel</span>}
        </NavLink>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-all w-full"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
}
