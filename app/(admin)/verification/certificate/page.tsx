"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, setDoc, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Papa from "papaparse";
import { 
  Trash2, 
  Edit2, 
  Plus, 
  Upload, 
  Search, 
  Award, 
  CheckSquare, 
  Square, 
  MinusSquare, 
  X, 
  Calendar, 
  Copy, 
  FileCheck
} from "lucide-react";

interface Certificate {
  id: string;
  certificateId: string;
  name: string;
  description: string;
  issueDate: string;
  score?: number | null;
  createdAt: number;
}

export default function CertificatePage() {
  const [items, setItems] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const [formData, setFormData] = useState({ 
    certificateId: "", 
    name: "", 
    description: "", 
    issueDate: new Date().toISOString().split("T")[0], 
    score: "" 
  });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "certificates"));
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          certificateId: data.certificateId || d.id,
          name: data.name || "",
          description: data.description || "",
          issueDate: data.issueDate || "",
          score: data.score !== undefined ? data.score : null,
          createdAt: data.createdAt || 0
        } as Certificate;
      });
      setItems(list.sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
      console.error("Error fetching certificates:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchItems(); 
  }, []);

  // Filtered certificates
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item => {
      const matchName = (item.name || "").toLowerCase().includes(q);
      const matchId = (item.certificateId || item.id || "").toLowerCase().includes(q);
      const matchDesc = (item.description || "").toLowerCase().includes(q);
      return matchName || matchId || matchDesc;
    });
  }, [items, searchQuery]);

  // Selection toggles
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleIds = filteredItems.map(i => i.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.length} certificate(s)?`)) return;

    setBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, "certificates", id));
      });
      await batch.commit();

      setItems(prev => prev.filter(i => !selectedIds.includes(i.id)));
      setSelectedIds([]);
      alert(`Deleted ${selectedIds.length} certificate(s) successfully.`);
    } catch (err: any) {
      console.error("Bulk delete error:", err);
      alert("Failed to delete certificates: " + err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = formData.certificateId.trim();
    if (!id) {
      alert("Certificate ID is required.");
      return;
    }

    try {
      const existing = items.find(i => i.id === editingId);
      await setDoc(doc(db, "certificates", id), {
        certificateId: id,
        name: formData.name.trim(),
        description: formData.description.trim(),
        issueDate: formData.issueDate,
        score: formData.score ? Number(formData.score) : null,
        createdAt: existing ? existing.createdAt : Date.now()
      });
      setIsModalOpen(false);
      fetchItems();
    } catch (err: any) {
      alert("Error saving certificate: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Are you sure you want to delete certificate ID "${id}"?`)) return;
    try {
      await deleteDoc(doc(db, "certificates", id));
      setItems(prev => prev.filter(i => i.id !== id));
      setSelectedIds(prev => prev.filter(i => i !== id));
    } catch (err: any) {
      alert("Error deleting certificate: " + err.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          let count = 0;
          const promises = results.data.map((row: any) => {
            const id = (row.certificateId || row.id || "").trim();
            if (!id) return null;
            count++;
            return setDoc(doc(db, "certificates", id), {
              certificateId: id,
              name: row.name || "",
              description: row.description || "",
              issueDate: row.issueDate || new Date().toISOString().split("T")[0],
              score: row.score ? Number(row.score) : null,
              createdAt: Date.now()
            });
          });
          await Promise.all(promises.filter(Boolean));
          alert(`CSV Uploaded successfully! Imported ${count} certificates.`);
          fetchItems();
        } catch (err: any) {
          alert("Error uploading CSV: " + err.message);
        }
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const allVisibleSelected = filteredItems.length > 0 && filteredItems.every(i => selectedIds.includes(i.id));
  const someVisibleSelected = filteredItems.some(i => selectedIds.includes(i.id));

  return (
    <div className="flex flex-col font-inter space-y-6 pb-28">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-montserrat font-bold text-[#0F172A] tracking-tight flex items-center gap-3">
            <Award className="w-8 h-8 text-[#F59E0B]" />
            Certificates Management
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Issue, verify, and manage certificates for workshops, competitions, and recognitions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer bg-white border border-slate-200 text-slate-700 px-5 h-12 rounded-[16px] font-semibold text-sm flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-all">
            <Upload className="h-4 w-4 text-slate-500" />
            Bulk Upload CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>

          <button 
            onClick={() => { 
              setFormData({ certificateId: "", name: "", description: "", issueDate: new Date().toISOString().split("T")[0], score: "" }); 
              setEditingId(null); 
              setIsModalOpen(true); 
            }} 
            className="bg-[#F59E0B] text-white px-5 h-12 rounded-[16px] font-semibold text-sm flex items-center gap-2 hover:scale-[1.02] shadow-[0_10px_30px_rgba(245,158,11,0.25)] transition-all"
          >
            <Plus className="h-4 w-4" /> Add Certificate
          </button>
        </div>
      </div>

      {/* Search & Select Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-xl border border-white/60 p-3 rounded-[24px] shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSelectAllVisible}
            className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-100"
            title="Toggle Select All"
          >
            {allVisibleSelected ? (
              <CheckSquare className="w-5 h-5 text-blue-600" />
            ) : someVisibleSelected ? (
              <MinusSquare className="w-5 h-5 text-blue-600" />
            ) : (
              <Square className="w-5 h-5 text-slate-400" />
            )}
            <span>Select All Visible</span>
          </button>

          <span className="text-xs text-slate-400">
            ({filteredItems.length} certificate{filteredItems.length === 1 ? "" : "s"})
          </span>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search recipient, ID, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Sticky Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-30 bg-[#0F172A] text-white p-4 rounded-[22px] shadow-[0_15px_40px_rgba(0,0,0,0.3)] flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="bg-amber-500 text-white font-bold text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4" />
              {selectedIds.length} Selected
            </span>
            <button
              onClick={handleSelectAllVisible}
              className="text-xs text-slate-300 hover:text-white underline underline-offset-4"
            >
              {allVisibleSelected ? "Deselect Visible" : "Select All Visible"}
            </button>
            <button
              onClick={handleClearSelection}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
              className="bg-red-600/90 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {bulkActionLoading ? "Deleting..." : `Delete Selected (${selectedIds.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Cards List */}
      <div className="space-y-4 pb-16">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-3" />
            Loading certificates...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center bg-white/40 border border-dashed border-slate-300 rounded-[28px] p-8">
            <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-700">No certificates found</h3>
            <p className="text-sm text-slate-500 mt-1">
              {searchQuery ? "Try changing your search query." : "Add your first certificate or upload a CSV file."}
            </p>
          </div>
        ) : (
          filteredItems.map(item => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div 
                key={item.id} 
                onClick={() => handleToggleSelect(item.id)}
                className={`backdrop-blur-[24px] border rounded-[24px] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-200 cursor-pointer ${
                  isSelected 
                    ? "bg-blue-50/80 border-blue-300 shadow-[0_10px_35px_rgba(37,99,235,0.12)]" 
                    : "bg-white/65 hover:bg-white/90 border-white/40 shadow-[0_10px_40px_rgba(15,23,42,0.06)]"
                }`}
              >
                {/* Left: Checkbox & Info */}
                <div className="flex items-start gap-4 flex-1">
                  <div 
                    className="pt-1 shrink-0" 
                    onClick={(e) => { e.stopPropagation(); handleToggleSelect(item.id); }}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-300 hover:text-slate-500 transition-colors" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-lg text-[#0F172A]">{item.name}</h3>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(item.certificateId); }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors"
                        title="Click to copy ID"
                      >
                        ID: {item.certificateId}
                        {copiedId === item.certificateId ? (
                          <span className="text-emerald-600 text-[10px]">Copied!</span>
                        ) : (
                          <Copy className="w-3 h-3 text-slate-400" />
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2">{item.description}</p>
                  </div>
                </div>

                {/* Right: Meta & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto border-t md:border-t-0 border-slate-100 pt-3 md:pt-0" onClick={(e) => e.stopPropagation()}>
                  {item.score !== null && item.score !== undefined && (
                    <div className="text-center">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score</span>
                      <span className="font-bold text-base text-[#0F172A]">{item.score}</span>
                    </div>
                  )}

                  <div className="text-left md:text-center">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Issue Date</span>
                    <span className="font-medium text-xs text-[#0F172A] flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {item.issueDate ? new Date(item.issueDate).toLocaleDateString() : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                    <button 
                      onClick={() => { 
                        setFormData({
                          certificateId: item.certificateId || item.id,
                          name: item.name,
                          description: item.description,
                          issueDate: item.issueDate,
                          score: item.score ? String(item.score) : ""
                        }); 
                        setEditingId(item.id); 
                        setIsModalOpen(true); 
                      }} 
                      className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4"/>
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)} 
                      className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#020617]/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSave} className="bg-white/95 backdrop-blur-3xl border border-white/40 p-8 rounded-[32px] w-full max-w-lg shadow-[0_25px_60px_rgba(0,0,0,0.45)] my-8">
            <h3 className="text-2xl font-bold font-montserrat tracking-tight mb-6 text-[#0F172A]">
              {editingId ? 'Edit' : 'Add'} Certificate
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                  Certificate ID *
                </label>
                <input 
                  required 
                  disabled={!!editingId} 
                  placeholder="e.g. CERT-2024-001"
                  className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50 font-mono" 
                  value={formData.certificateId} 
                  onChange={e => setFormData({...formData, certificateId: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                  Recipient Name *
                </label>
                <input 
                  required 
                  placeholder="Recipient full name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                  Description / Event Name *
                </label>
                <textarea 
                  required 
                  rows={2}
                  placeholder="e.g. Certificate of Participation in CAD Workshop 2024"
                  className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Issue Date *
                  </label>
                  <input 
                    required 
                    type="date" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" 
                    value={formData.issueDate} 
                    onChange={e => setFormData({...formData, issueDate: e.target.value})} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Score (Optional)
                  </label>
                  <input 
                    type="number" 
                    placeholder="e.g. 95"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" 
                    value={formData.score} 
                    onChange={e => setFormData({...formData, score: e.target.value})} 
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="flex-1 h-14 rounded-[18px] bg-white border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="flex-1 h-14 rounded-[18px] bg-[#F59E0B] font-bold text-white shadow-[0_10px_40px_rgba(245,158,11,0.3)] hover:scale-[1.02] transition-all"
              >
                {editingId ? "Update" : "Save"} Certificate
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
