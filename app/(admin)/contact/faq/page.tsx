"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Trash2, Edit2, Plus } from "lucide-react";

export default function FAQPage() {
  const [items, setItems] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: "", description: "" });

  useEffect(() => { fetchItems(); }, []);
  const fetchItems = async () => {
    const snap = await getDocs(collection(db, "faqs"));
    setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => b.createdAt - a.createdAt));
  };

  const handleSave = async (e: any) => {
    e.preventDefault();
    if (editingId) {
      await updateDoc(doc(db, "faqs", editingId), formData);
    } else {
      await addDoc(collection(db, "faqs"), { ...formData, createdAt: Date.now() });
    }
    setIsModalOpen(false);
    fetchItems();
  };

  return (
    <div className="flex flex-col h-full font-inter">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-montserrat font-bold text-[#0F172A] tracking-tight">FAQ</h2>
        <button onClick={() => { setFormData({title:"", description:""}); setEditingId(null); setIsModalOpen(true); }} className="bg-[#F59E0B] text-white px-6 h-14 rounded-[18px] font-semibold flex items-center gap-2 hover:scale-[1.03] shadow-[0_10px_40px_rgba(245,158,11,0.3)] transition-all">
          <Plus className="h-5 w-5" /> Add FAQ
        </button>
      </div>
      <div className="space-y-4 overflow-y-auto pb-8">
        {items.map(item => (
          <div key={item.id} className="bg-white/55 backdrop-blur-[24px] border border-white/35 rounded-[20px] shadow-[0_10px_40px_rgba(15,23,42,0.08)] p-6">
            <h3 className="font-bold text-[#0F172A] text-lg mb-2">{item.title}</h3>
            <p className="text-slate-600 mb-4">{item.description}</p>
            <div className="flex items-center gap-4 border-t border-slate-200/50 pt-4">
              <button onClick={() => { setFormData(item); setEditingId(item.id); setIsModalOpen(true); }} className="text-blue-500 hover:text-blue-700 text-[10px] font-bold uppercase flex items-center gap-1"><Edit2 className="w-4 h-4"/> Edit</button>
              <button onClick={() => { if(confirm("Delete?")) { deleteDoc(doc(db, "faqs", item.id)); fetchItems(); } }} className="text-red-500 hover:text-red-700 text-[10px] font-bold uppercase flex items-center gap-1"><Trash2 className="w-4 h-4"/> Delete</button>
            </div>
          </div>
        ))}
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#020617]/40 backdrop-blur-sm p-4">
          <form onSubmit={handleSave} className="bg-white/95 backdrop-blur-3xl border border-white/40 p-8 rounded-[32px] w-full max-w-lg shadow-[0_25px_60px_rgba(0,0,0,0.45)]">
            <h3 className="text-2xl font-bold font-montserrat tracking-tight mb-6">{editingId ? 'Edit' : 'Add'} FAQ</h3>
            <div className="space-y-4">
              <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Question</label><input required className="w-full bg-slate-50 border border-slate-200 rounded-[18px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.title} onChange={e=>setFormData({...formData, title:e.target.value})} /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Answer</label><textarea required rows={4} className="w-full bg-slate-50 border border-slate-200 rounded-[18px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.description} onChange={e=>setFormData({...formData, description:e.target.value})} /></div>
            </div>
            <div className="mt-8 flex gap-3">
              <button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 h-14 rounded-[18px] bg-white border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
              <button type="submit" className="flex-1 h-14 rounded-[18px] bg-[#F59E0B] font-bold text-white shadow-[0_10px_40px_rgba(245,158,11,0.3)] hover:scale-[1.02] transition-all">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}