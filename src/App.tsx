import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import AIChat from "./pages/AIChat";
import GenerateRFI from "./pages/GenerateRFI";
import KnowledgeBase from "./pages/KnowledgeBase";
import Documents from "./pages/Documents";
import RFIHistory from "./pages/RFIHistory";
import AdminPanel from "./pages/AdminPanel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
          <Route path="/chat" element={<AppLayout><AIChat /></AppLayout>} />
          <Route path="/generate" element={<AppLayout><GenerateRFI /></AppLayout>} />
          <Route path="/knowledge" element={<AppLayout><KnowledgeBase /></AppLayout>} />
          <Route path="/documents" element={<AppLayout><Documents /></AppLayout>} />
          <Route path="/history" element={<AppLayout><RFIHistory /></AppLayout>} />
          <Route path="/admin" element={<AppLayout><AdminPanel /></AppLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
