"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Trash2, Edit2, Plus } from "lucide-react";

interface EventLog {
  id: string;
  title: string;
  coverImageUrl: string;
  facebookUrl: string;
  googleFormUrl: string;
  eventDate: string;
  time: string;
  location: string;
  descriptionMarkdown: string;
  createdAt: number;
}

export default function LogPage() {
  const [events, setEvents] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    coverImageUrl: "",
    facebookUrl: "",
    googleFormUrl: "",
    eventDate: "",
    time: "",
    location: "",
    descriptionMarkdown: ""
  });

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "event_logs"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as EventLog)));
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  const handleSave = async (e: any) => {
    e.preventDefault();
    if (editingId) {
      await updateDoc(doc(db, "event_logs", editingId), formData);
    } else {
      await addDoc(collection(db, "event_logs"), { ...formData, createdAt: Date.now() });
    }
    setIsModalOpen(false);
    fetchEvents();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this event log?")) {
      await deleteDoc(doc(db, "event_logs", id));
      fetchEvents();
    }
  };

  return (
    <div className="flex flex-col h-full font-inter">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-montserrat font-bold text-[#0F172A] tracking-tight">Event Log</h2>
        <button onClick={() => { setFormData({title:"", coverImageUrl:"", facebookUrl:"", googleFormUrl:"", eventDate:"", time:"", location:"", descriptionMarkdown:""}); setEditingId(null); setIsModalOpen(true); }} className="bg-[#F59E0B] text-white px-6 h-14 rounded-[18px] font-semibold flex items-center gap-2 hover:scale-[1.03] shadow-[0_10px_40px_rgba(245,158,11,0.3)] transition-all">
          <Plus className="h-5 w-5" /> Add Event
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto pb-8 space-y-4">
        {events.map(ev => (
          <div key={ev.id} className="bg-white/55 backdrop-blur-[24px] border border-white/35 p-6 rounded-[28px] shadow-[0_10px_40px_rgba(15,23,42,0.08)] flex justify-between items-center hover:shadow-[0_25px_60px_rgba(15,23,42,0.16)] transition-all">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-slate-200 rounded-2xl overflow-hidden shrink-0">
                {ev.coverImageUrl && <img src={ev.coverImageUrl} alt={ev.title || "Event cover"} className="w-full h-full object-cover" />}
              </div>
              <div>
                <h3 className="font-bold text-[#0F172A] text-xl mb-1">{ev.title}</h3>
                <p className="text-slate-500 text-sm">{ev.eventDate} | {ev.time} | {ev.location}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => { setFormData(ev); setEditingId(ev.id); setIsModalOpen(true); }} className="text-blue-500 hover:text-blue-700 text-sm font-bold uppercase"><Edit2 className="w-4 h-4 inline mr-1"/> Edit</button>
              <button onClick={() => handleDelete(ev.id)} className="text-red-500 hover:text-red-700 text-sm font-bold uppercase"><Trash2 className="w-4 h-4 inline mr-1"/> Delete</button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#020617]/40 backdrop-blur-sm p-4 overflow-y-auto">
          <form onSubmit={handleSave} className="bg-white/95 backdrop-blur-3xl border border-white/40 p-8 rounded-[32px] w-full max-w-2xl shadow-[0_25px_60px_rgba(0,0,0,0.45)] my-8 mt-24">
            <h3 className="text-2xl font-bold font-montserrat tracking-tight mb-6">{editingId ? 'Edit' : 'Add'} Event Log</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Title</label>
                <input required className="w-full bg-slate-50 border border-slate-200 rounded-[18px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.title} onChange={e=>setFormData({...formData, title:e.target.value})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Date</label>
                  <input required type="date" className="w-full bg-slate-50 border border-slate-200 rounded-[18px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.eventDate} onChange={e=>setFormData({...formData, eventDate:e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Time</label>
                  <input type="time" className="w-full bg-slate-50 border border-slate-200 rounded-[18px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.time} onChange={e=>setFormData({...formData, time:e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Location</label>
                <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-[18px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.location} onChange={e=>setFormData({...formData, location:e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Cover Image URL</label>
                <input required type="url" className="w-full bg-slate-50 border border-slate-200 rounded-[18px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.coverImageUrl} onChange={e=>setFormData({...formData, coverImageUrl:e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Facebook Event URL</label>
                <input type="url" className="w-full bg-slate-50 border border-slate-200 rounded-[18px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.facebookUrl} onChange={e=>setFormData({...formData, facebookUrl:e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Google Form URL</label>
                <input type="url" className="w-full bg-slate-50 border border-slate-200 rounded-[18px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.googleFormUrl} onChange={e=>setFormData({...formData, googleFormUrl:e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Description (Markdown)</label>
                <textarea rows={4} className="w-full bg-slate-50 border border-slate-200 rounded-[18px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm" value={formData.descriptionMarkdown} onChange={e=>setFormData({...formData, descriptionMarkdown:e.target.value})} />
              </div>
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
