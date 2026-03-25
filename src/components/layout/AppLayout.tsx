import { AppSidebar } from "./AppSidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden animated-bg">
      <AppSidebar />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
