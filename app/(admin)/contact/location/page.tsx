"use client";
import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function LocationPage() {
  const [formData, setFormData] = useState({ mapIframe: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, "site_settings", "location"));
      if (snap.exists()) setFormData({ mapIframe: snap.data().mapIframe || "" });
    }
    load();
  }, []);

  const handleSave = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    await setDoc(doc(db, "site_settings", "location"), { ...formData, updatedAt: Date.now() }, { merge: true });
    setSaving(false);
    alert("Saved successfully!");
  };

  return (
    <div className="flex flex-col h-full font-inter">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-montserrat font-bold text-[#0F172A] tracking-tight">Location</h2>
      </div>
      <form onSubmit={handleSave} className="bg-white/55 backdrop-blur-[24px] border border-white/35 p-8 rounded-[28px] max-w-xl shadow-[0_10px_40px_rgba(15,23,42,0.08)]">
        <div className="space-y-6">
          <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Google Maps Iframe HTML</label><textarea required rows={4} className="w-full bg-slate-50 border border-slate-200 rounded-[18px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm" value={formData.mapIframe} onChange={e=>setFormData({...formData, mapIframe:e.target.value})} placeholder='<iframe src="..."></iframe>' /></div>
          <button type="submit" disabled={saving} className="w-full h-14 rounded-[18px] bg-[#F59E0B] font-bold text-white shadow-[0_10px_40px_rgba(245,158,11,0.3)] hover:scale-[1.02] transition-all">{saving ? "Saving..." : "Save Settings"}</button>
        </div>
      </form>
    </div>
  );
}