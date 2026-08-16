"use client";
import { useAuth } from "@/components/auth-provider";
import { Sidebar } from "@/components/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null; // handled by AuthProvider
  if (!user) return null; // handled by AuthProvider redirect

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-[#0F172A] overflow-hidden font-inter selection:bg-amber-500/30">
      <div className="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100 via-transparent to-transparent"></div>
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative z-10 p-4 lg:p-8">
        <div className="flex-1 overflow-auto bg-white/55 backdrop-blur-[24px] border border-white/35 shadow-[0_10px_40px_rgba(15,23,42,0.08)] rounded-[28px]">
          <div className="p-4 sm:p-6 min-h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
