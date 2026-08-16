"use client";
import { useEffect, useState } from "react";
import { collection, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function DashboardPage() {
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [blogCount, setBlogCount] = useState<number | null>(null);
  const [noticeCount, setNoticeCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const leadersSnap = await getCountFromServer(collection(db, "leadership_members"));
        setMemberCount(leadersSnap.data().count);
        
        const blogsSnap = await getCountFromServer(collection(db, "blogs"));
        setBlogCount(blogsSnap.data().count);

        const noticesSnap = await getCountFromServer(collection(db, "notices"));
        setNoticeCount(noticesSnap.data().count);
      } catch (err: any) {
        console.error("Error fetching stats:", err);
        setError(err.message || "Failed to load database stats. Check permissions.");
      }
    }
    fetchCounts();
  }, []);

  return (
    <div className="space-y-6 h-full flex flex-col font-inter">
      <div className="flex items-center justify-between shrink-0 mb-8">
        <h2 className="text-3xl font-montserrat font-bold text-[#0F172A] tracking-tight">Operational Overview</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
            <span>System Healthy</span>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-[16px] relative shadow-sm" role="alert">
          <strong className="font-bold">Database Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 shrink-0">
        <div className="bg-white/55 backdrop-blur-[24px] p-6 rounded-[28px] border border-white/35 shadow-[0_10px_40px_rgba(15,23,42,0.08)] hover:-translate-y-2 hover:shadow-[0_25px_60px_rgba(15,23,42,0.16)] transition-all">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Members</p>
          <h3 className="text-4xl font-black text-[#0F172A]">
            {memberCount === null ? "..." : memberCount === 0 ? "Empty" : memberCount}
          </h3>
          <p className="text-xs text-slate-500 mt-2 font-medium">In Leadership Directory</p>
        </div>

        <div className="bg-white/55 backdrop-blur-[24px] p-6 rounded-[28px] border border-white/35 shadow-[0_10px_40px_rgba(15,23,42,0.08)] hover:-translate-y-2 hover:shadow-[0_25px_60px_rgba(15,23,42,0.16)] transition-all">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Blogs</p>
          <h3 className="text-4xl font-black text-[#0F172A]">
            {blogCount === null ? "..." : blogCount === 0 ? "Empty" : blogCount}
          </h3>
          <p className="text-xs text-slate-500 mt-2 font-medium">Published Posts</p>
        </div>

        <div className="bg-white/55 backdrop-blur-[24px] p-6 rounded-[28px] border border-white/35 shadow-[0_10px_40px_rgba(15,23,42,0.08)] hover:-translate-y-2 hover:shadow-[0_25px_60px_rgba(15,23,42,0.16)] transition-all">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Notices</p>
          <h3 className="text-4xl font-black text-[#0F172A]">
            {noticeCount === null ? "..." : noticeCount === 0 ? "Empty" : noticeCount}
          </h3>
          <p className="text-xs text-slate-500 mt-2 font-medium">Active Announcements</p>
        </div>

        <div className="bg-[#0F172A] p-6 rounded-[28px] border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.45)] hover:-translate-y-2 transition-all">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Storage Usage</p>
          <h3 className="text-4xl font-black text-white">Healthy</h3>
          <p className="text-xs text-slate-400 mt-2 font-medium">Firebase Storage</p>
        </div>
      </div>
    </div>
  );
}
