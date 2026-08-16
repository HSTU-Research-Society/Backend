"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Trash2, Edit2, Plus } from "lucide-react";

interface Notice {
  id: string;
  title: string;
  description: string;
  noticeDate: string;
  createdAt: number;
}

export default function NoticePage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    noticeDate: "",
  });

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    try {
      const q = query(collection(db, "notices"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notice));
      setNotices(data);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching notices:", err);
      setError(err.message || "Failed to load notices. Check database permissions.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, "notices", editingId), formData);
      } else {
        await addDoc(collection(db, "notices"), {
          ...formData,
          createdAt: Date.now()
        });
      }
      setIsModalOpen(false);
      resetForm();
      fetchNotices();
    } catch (err: any) {
      console.error("Error saving notice:", err);
      alert(err.message || "Failed to save notice. Check database permissions.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notice?")) return;
    try {
      await deleteDoc(doc(db, "notices", id));
      fetchNotices();
    } catch (err: any) {
      console.error("Error deleting notice:", err);
      alert(err.message || "Failed to delete notice. Check database permissions.");
    }
  };

  const openEditModal = (notice: Notice) => {
    setFormData({
      title: notice.title,
      description: notice.description,
      noticeDate: notice.noticeDate || "",
    });
    setEditingId(notice.id);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ title: "", description: "", noticeDate: "" });
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col items-center shrink-0 mb-4">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Notice</h2>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="inline-flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 shrink-0" />
          Add Notice
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4 shrink-0" role="alert">
          <strong className="font-bold">Database Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="mt-4 flex-1 overflow-auto pb-8">
        {loading ? (
          <div className="py-10 text-center text-gray-500">Loading notices...</div>
        ) : notices.length === 0 ? (
          <div className="py-10 text-center text-gray-500">No notices found.</div>
        ) : (
          <div className="overflow-hidden bg-white shadow-sm border border-gray-200 rounded-xl">
            <ul role="list" className="divide-y divide-gray-100">
              {notices.map((notice) => (
                <li key={notice.id} className="hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-5 gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="truncate font-black text-slate-800 text-lg">{notice.title}</p>
                        {notice.noticeDate && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                            {notice.noticeDate}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {(notice.description || '').substring(0, 50)}{((notice.description || '').length > 50) ? '...' : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <button onClick={() => openEditModal(notice)} className="text-blue-500 hover:text-blue-700 flex items-center text-xs font-bold uppercase tracking-wider transition-colors">
                        <Edit2 className="h-4 w-4 mr-1" /> Edit
                      </button>
                      <button onClick={() => handleDelete(notice.id)} className="text-red-500 hover:text-red-700 flex items-center text-xs font-bold uppercase tracking-wider transition-colors">
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-xl my-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6">{editingId ? "Edit Notice" : "Add Notice"}</h3>
            <form onSubmit={handleCreateOrUpdate} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Title</label>
                <input required type="text" className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 border" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Notice Date</label>
                <input type="date" required className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 border" value={formData.noticeDate} onChange={e => setFormData({...formData, noticeDate: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Description (Markdown Supported)</label>
                <textarea required rows={8} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 border font-mono" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="# Notice Details&#10;Write your content in markdown..." />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="inline-flex justify-center rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="inline-flex justify-center rounded-lg border border-transparent bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
                  {editingId ? "Save Changes" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
