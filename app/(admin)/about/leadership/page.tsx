"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Trash2, 
  Edit2, 
  Plus, 
  Upload, 
  Search, 
  CheckSquare, 
  Square, 
  MinusSquare, 
  Users, 
  ShieldCheck, 
  GraduationCap, 
  UserCheck, 
  SlidersHorizontal,
  X
} from "lucide-react";
import Papa from "papaparse";

interface Leader {
  id: string;
  name: string;
  batch: string;
  designation: string;
  photoUrl: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  email?: string;
  type: "executive" | "alumni" | "advisory" | "taskforce";
  createdAt: number;
}

export default function LeadershipPage() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    batch: "",
    designation: "",
    photoUrl: "",
    facebookUrl: "",
    linkedinUrl: "",
    email: "",
    type: "executive" as "executive" | "alumni" | "advisory" | "taskforce",
  });
  
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);

  useEffect(() => {
    fetchLeaders();
  }, []);

  const fetchLeaders = async () => {
    try {
      const q = query(collection(db, "leadership_members"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Leader));
      setLeaders(data);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching leadership:", err);
      setError(err.message || "Failed to load leaders. Check database permissions.");
    } finally {
      setLoading(false);
    }
  };

  // Filtered leaders
  const filteredLeaders = useMemo(() => {
    return leaders.filter(leader => {
      if (typeFilter !== "all" && leader.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (leader.name || "").toLowerCase().includes(q);
        const matchDesig = (leader.designation || "").toLowerCase().includes(q);
        const matchBatch = (leader.batch || "").toLowerCase().includes(q);
        const matchEmail = (leader.email || "").toLowerCase().includes(q);
        return matchName || matchDesig || matchBatch || matchEmail;
      }
      return true;
    });
  }, [leaders, typeFilter, searchQuery]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleIds = filteredLeaders.map(l => l.id);
    const allSelected = visibleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.length} selected member(s)?`)) return;

    setBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, "leadership_members", id));
        // also clean up any legacy collection if existed
        batch.delete(doc(db, "leadership", id));
      });
      await batch.commit();

      setLeaders(prev => prev.filter(l => !selectedIds.includes(l.id)));
      setSelectedIds([]);
      alert(`Successfully deleted ${selectedIds.length} member(s).`);
    } catch (err: any) {
      console.error("Bulk delete error:", err);
      alert("Failed to delete selected members: " + err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk Change Type
  const handleBulkChangeType = async (newType: "executive" | "alumni" | "advisory" | "taskforce") => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Change type of ${selectedIds.length} selected member(s) to "${newType.toUpperCase()}"?`)) return;

    setBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, "leadership_members", id), { type: newType });
      });
      await batch.commit();

      setLeaders(prev => prev.map(l => selectedIds.includes(l.id) ? { ...l, type: newType } : l));
      setSelectedIds([]);
      alert(`Updated ${selectedIds.length} member(s) to ${newType}.`);
    } catch (err: any) {
      console.error("Bulk type update error:", err);
      alert("Failed to update types: " + err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.type !== "advisory" && isNaN(Number(formData.batch))) {
        alert("Batch must be a number unless type is Advisory.");
        return;
      }
      
      const payload = {
        ...formData,
        batch: formData.type === "advisory" ? "A" : formData.batch,
      };

      if (editingId) {
        await updateDoc(doc(db, "leadership_members", editingId), payload);
      } else {
        await addDoc(collection(db, "leadership_members"), {
          ...payload,
          createdAt: Date.now()
        });
      }
      setIsModalOpen(false);
      resetForm();
      fetchLeaders();
    } catch (err: any) {
      console.error("Error saving leader:", err);
      alert(err.message || "Failed to save leader. Check database permissions.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this member?")) return;
    try {
      await deleteDoc(doc(db, "leadership_members", id));
      await deleteDoc(doc(db, "leadership", id)).catch(() => {});
      setLeaders(prev => prev.filter(l => l.id !== id));
      setSelectedIds(prev => prev.filter(item => item !== id));
    } catch (err: any) {
      console.error("Error deleting leader:", err);
      alert(err.message || "Failed to delete leader. Check database permissions.");
    }
  };

  const openEditModal = (leader: Leader) => {
    setFormData({
      name: leader.name,
      batch: leader.batch === "A" ? "" : leader.batch,
      designation: leader.designation,
      photoUrl: leader.photoUrl || "",
      facebookUrl: leader.facebookUrl || "",
      linkedinUrl: leader.linkedinUrl || "",
      email: leader.email || "",
      type: leader.type || "executive",
    });
    setEditingId(leader.id);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: "", batch: "", designation: "", photoUrl: "", facebookUrl: "", linkedinUrl: "", email: "", type: "executive" });
    setEditingId(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCSV(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const promises = results.data.map((row: any) => {
            const rowType = row.type || "executive";
            return addDoc(collection(db, "leadership_members"), {
              name: row.name || "",
              batch: rowType === "advisory" ? "A" : (row.batch || ""),
              designation: row.designation || "",
              photoUrl: row.photoUrl || "",
              facebookUrl: row.facebookUrl || "",
              linkedinUrl: row.linkedinUrl || "",
              email: row.email || "",
              type: rowType,
              createdAt: Date.now()
            });
          });
          await Promise.all(promises);
          fetchLeaders();
          alert("CSV Uploaded Successfully!");
        } catch (err: any) {
          console.error("Error parsing CSV:", err);
          alert(err.message || "Failed to upload CSV. Check database permissions.");
        } finally {
          setIsUploadingCSV(false);
        }
      },
      error: (error) => {
        console.error("CSV Parse Error:", error);
        alert(error.message || "Failed to parse CSV file.");
        setIsUploadingCSV(false);
      }
    });
  };

  const allVisibleSelected = filteredLeaders.length > 0 && filteredLeaders.every(l => selectedIds.includes(l.id));
  const someVisibleSelected = filteredLeaders.some(l => selectedIds.includes(l.id));

  return (
    <div className="flex flex-col h-full font-inter space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-montserrat font-bold text-[#0F172A] tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            Leadership Directory
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Manage executive committee, advisory panel, alumni, and taskforce members.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="bg-white border border-slate-200 text-slate-700 px-5 h-12 rounded-[16px] font-semibold text-sm flex items-center gap-2 hover:bg-slate-50 shadow-sm cursor-pointer transition-all">
            <Upload className="h-4 w-4 text-slate-500" />
            {isUploadingCSV ? "Uploading..." : "Upload CSV"}
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={isUploadingCSV} />
          </label>

          <button
            type="button"
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-blue-600 text-white px-5 h-12 rounded-[16px] font-semibold text-sm flex items-center gap-2 hover:scale-[1.02] shadow-[0_10px_30px_rgba(37,99,235,0.25)] transition-all"
          >
            <Plus className="h-4 w-4" />
            Add Member
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl shrink-0" role="alert">
          <strong className="font-bold">Database Error: </strong>
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/70 backdrop-blur-xl border border-white/60 p-3 rounded-[24px] shadow-sm">
        {/* Type Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setTypeFilter("all")}
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              typeFilter === "all" ? "bg-[#0F172A] text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            All ({leaders.length})
          </button>
          <button
            onClick={() => setTypeFilter("executive")}
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              typeFilter === "executive" ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Executive ({leaders.filter(l => l.type === "executive").length})
          </button>
          <button
            onClick={() => setTypeFilter("alumni")}
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              typeFilter === "alumni" ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Alumni ({leaders.filter(l => l.type === "alumni").length})
          </button>
          <button
            onClick={() => setTypeFilter("advisory")}
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              typeFilter === "advisory" ? "bg-amber-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Advisory ({leaders.filter(l => l.type === "advisory").length})
          </button>
          <button
            onClick={() => setTypeFilter("taskforce")}
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              typeFilter === "taskforce" ? "bg-emerald-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Taskforce ({leaders.filter(l => l.type === "taskforce").length})
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 sm:w-64 max-w-sm">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, role, batch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Floating / Sticky Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-30 bg-[#0F172A] text-white p-4 rounded-[22px] shadow-[0_15px_40px_rgba(0,0,0,0.3)] flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="bg-blue-600 text-white font-bold text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
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

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-400 font-medium">Batch Action:</span>

            <select
              disabled={bulkActionLoading}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkChangeType(e.target.value as any);
                  e.target.value = "";
                }
              }}
              className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="" disabled>Change Type to...</option>
              <option value="executive">Executive Committee</option>
              <option value="alumni">Alumni</option>
              <option value="advisory">Advisory</option>
              <option value="taskforce">Taskforce</option>
            </select>

            <button
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
              className="bg-red-600/90 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {bulkActionLoading ? "Deleting..." : `Delete (${selectedIds.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Directory Table */}
      <div className="bg-white/80 backdrop-blur-xl rounded-[28px] border border-slate-200/80 shadow-sm flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAllVisible}
              className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors"
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
            <span className="text-xs text-slate-400">({filteredLeaders.length} showing)</span>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="w-12 px-4 py-3 text-center">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Designation</th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Batch</th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400 text-xs font-medium">
                    <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
                    Loading member directory...
                  </td>
                </tr>
              ) : filteredLeaders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500 text-xs">
                    No members found matching your search.
                  </td>
                </tr>
              ) : (
                filteredLeaders.map((leader) => {
                  const isSelected = selectedIds.includes(leader.id);
                  return (
                    <tr 
                      key={leader.id} 
                      className={`transition-colors cursor-pointer ${
                        isSelected ? "bg-blue-50/60 hover:bg-blue-50/80" : "hover:bg-slate-50/70"
                      }`}
                      onClick={() => handleToggleSelect(leader.id)}
                    >
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(leader.id)}
                          className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center">
                          <div className="h-9 w-9 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200 shadow-sm flex items-center justify-center">
                            {leader.photoUrl ? (
                              <img className="h-full w-full object-cover" src={leader.photoUrl} alt="" />
                            ) : (
                              <div className="h-full w-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold font-montserrat">
                                {leader.name ? leader.name.charAt(0).toUpperCase() : "?"}
                              </div>
                            )}
                          </div>
                          <div className="ml-3">
                            <div className="font-bold text-sm text-[#0F172A]">{leader.name}</div>
                            {leader.email && <div className="text-xs text-slate-400">{leader.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          leader.type === "executive" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                          leader.type === "alumni" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                          leader.type === "advisory" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                          "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}>
                          {leader.type}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs font-semibold text-slate-700">{leader.designation}</td>
                      <td className="px-6 py-3 text-xs font-mono font-bold text-slate-600">
                        {leader.batch === "A" ? "Advisory" : `Batch ${leader.batch}`}
                      </td>
                      <td className="px-6 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openEditModal(leader)} 
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(leader.id)} 
                            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#020617]/50 backdrop-blur-sm p-4">
          <div className="bg-white/95 backdrop-blur-3xl border border-white/40 rounded-[32px] p-8 w-full max-w-2xl shadow-[0_25px_60px_rgba(0,0,0,0.45)] my-8">
            <h3 className="text-2xl font-bold font-montserrat tracking-tight mb-6 text-[#0F172A]">
              {editingId ? "Edit Member" : "Add Leadership Member"}
            </h3>
            <form onSubmit={handleCreateOrUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Name *</label>
                  <input 
                    required 
                    type="text" 
                    placeholder="Full Name"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Type *</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 font-semibold" 
                    value={formData.type} 
                    onChange={e => setFormData({...formData, type: e.target.value as any})}
                  >
                    <option value="executive">Executive Committee</option>
                    <option value="alumni">Alumni</option>
                    <option value="advisory">Advisory</option>
                    <option value="taskforce">Taskforce</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Designation *</label>
                  <input 
                    required 
                    type="text" 
                    placeholder="e.g. President, General Secretary"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500" 
                    value={formData.designation} 
                    onChange={e => setFormData({...formData, designation: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Batch {formData.type === 'advisory' ? "(N/A for Advisory)" : "*"}
                  </label>
                  <input 
                    required={formData.type !== 'advisory'} 
                    type={formData.type === 'advisory' ? "text" : "number"} 
                    disabled={formData.type === 'advisory'} 
                    placeholder="e.g. 20"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 font-mono disabled:opacity-50" 
                    value={formData.type === 'advisory' ? "A" : formData.batch} 
                    onChange={e => setFormData({...formData, batch: e.target.value})} 
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Photo URL</label>
                  <input 
                    type="url" 
                    placeholder="https://..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500" 
                    value={formData.photoUrl} 
                    onChange={e => setFormData({...formData, photoUrl: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Facebook URL</label>
                  <input 
                    type="url" 
                    placeholder="https://facebook.com/..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 text-xs" 
                    value={formData.facebookUrl} 
                    onChange={e => setFormData({...formData, facebookUrl: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">LinkedIn URL</label>
                  <input 
                    type="url" 
                    placeholder="https://linkedin.com/in/..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 text-xs" 
                    value={formData.linkedinUrl} 
                    onChange={e => setFormData({...formData, linkedinUrl: e.target.value})} 
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="member@example.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 text-xs" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                  />
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
                  className="flex-1 h-14 rounded-[18px] bg-blue-600 font-bold text-white shadow-[0_10px_40px_rgba(37,99,235,0.3)] hover:scale-[1.02] transition-all"
                >
                  {editingId ? "Save Changes" : "Create Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
