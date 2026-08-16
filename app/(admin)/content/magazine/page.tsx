"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  doc, 
  writeBatch 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Trash2, 
  Edit2, 
  Plus, 
  BookOpen, 
  Search, 
  CheckSquare, 
  Square, 
  MinusSquare, 
  Eye, 
  EyeOff, 
  Globe, 
  X, 
  ExternalLink,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ArrowUpToLine,
  ArrowDownToLine
} from "lucide-react";

interface Magazine {
  id: string;
  title: string;
  description: string;
  coverImageUrl: string;
  pdfUrl: string;
  displayInFrontend?: boolean;
  status?: "published" | "draft";
  order?: number;
  position?: number;
  createdAt: number;
}

export default function MagazinePage() {
  const [items, setItems] = useState<Magazine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [orderActionLoading, setOrderActionLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "visible" | "hidden">("all");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({ 
    title: "", 
    description: "", 
    coverImageUrl: "", 
    pdfUrl: "",
    displayInFrontend: true,
    order: 1
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "magazines"));
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || "",
          description: data.description || "",
          coverImageUrl: data.coverImageUrl || "",
          pdfUrl: data.pdfUrl || "",
          displayInFrontend: data.displayInFrontend !== undefined ? Boolean(data.displayInFrontend) : true,
          status: data.status || (data.displayInFrontend === false ? "draft" : "published"),
          order: typeof data.order === "number" ? data.order : (typeof data.position === "number" ? data.position : undefined),
          position: typeof data.position === "number" ? data.position : (typeof data.order === "number" ? data.order : undefined),
          createdAt: data.createdAt || 0,
        } as Magazine;
      });

      // Sort by order/position ascending first, then createdAt descending
      list.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      setItems(list);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching magazines:", err);
      setError(err.message || "Failed to load magazines.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchItems(); 
  }, [fetchItems]);

  // Persist updated list order to Firestore
  const persistOrder = async (updatedList: Magazine[]) => {
    setIsReordering(true);
    try {
      const batch = writeBatch(db);
      const normalizedList = updatedList.map((item, index) => {
        const newOrder = index + 1;
        batch.update(doc(db, "magazines", item.id), {
          order: newOrder,
          position: newOrder
        });
        return { ...item, order: newOrder, position: newOrder };
      });
      await batch.commit();
      setItems(normalizedList);
    } catch (err: any) {
      console.error("Error persisting magazine order:", err);
      alert("Failed to update magazine position order: " + err.message);
      fetchItems();
    } finally {
      setIsReordering(false);
      setOrderActionLoading(null);
    }
  };

  // Move 1 position up or down
  const handleMoveMagazine = async (id: string, direction: "up" | "down", e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const currentIndex = items.findIndex(m => m.id === id);
    if (currentIndex === -1) return;
    if (direction === "up" && currentIndex === 0) return;
    if (direction === "down" && currentIndex === items.length - 1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const newItems = [...items];
    const [movedItem] = newItems.splice(currentIndex, 1);
    newItems.splice(targetIndex, 0, movedItem);

    setItems(newItems);
    setOrderActionLoading(id);
    await persistOrder(newItems);
  };

  // Move directly to top (#1)
  const handleMoveToTop = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const currentIndex = items.findIndex(m => m.id === id);
    if (currentIndex <= 0) return;

    const newItems = [...items];
    const [movedItem] = newItems.splice(currentIndex, 1);
    newItems.unshift(movedItem);

    setItems(newItems);
    setOrderActionLoading(id);
    await persistOrder(newItems);
  };

  // Move directly to bottom (last)
  const handleMoveToBottom = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const currentIndex = items.findIndex(m => m.id === id);
    if (currentIndex === -1 || currentIndex === items.length - 1) return;

    const newItems = [...items];
    const [movedItem] = newItems.splice(currentIndex, 1);
    newItems.push(movedItem);

    setItems(newItems);
    setOrderActionLoading(id);
    await persistOrder(newItems);
  };

  // Custom position change
  const handleSetCustomPosition = async (id: string, targetPosition: number) => {
    const currentIndex = items.findIndex(m => m.id === id);
    if (currentIndex === -1) return;

    const targetIndex = Math.max(0, Math.min(items.length - 1, targetPosition - 1));
    if (targetIndex === currentIndex) return;

    const newItems = [...items];
    const [movedItem] = newItems.splice(currentIndex, 1);
    newItems.splice(targetIndex, 0, movedItem);

    setItems(newItems);
    setOrderActionLoading(id);
    await persistOrder(newItems);
  };

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        item.title.toLowerCase().includes(q) || 
        item.description.toLowerCase().includes(q);
      
      const isVisible = item.displayInFrontend !== false;
      const matchStatus = 
        statusFilter === "all" || 
        (statusFilter === "visible" && isVisible) || 
        (statusFilter === "hidden" && !isVisible);

      return matchSearch && matchStatus;
    });
  }, [items, searchQuery, statusFilter]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const visibleIds = useMemo(() => filteredItems.map(i => i.id), [filteredItems]);
  const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const isSomeVisibleSelected = visibleIds.some(id => selectedIds.includes(id)) && !isAllVisibleSelected;

  const handleSelectAllToggle = () => {
    if (isAllVisibleSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Toggle single item frontend display status
  const handleToggleDisplay = async (item: Magazine, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newDisplayState = !item.displayInFrontend;
    const newStatus = newDisplayState ? "published" : "draft";

    // Optimistic update
    setItems(prev => prev.map(m => m.id === item.id ? {
      ...m,
      displayInFrontend: newDisplayState,
      status: newStatus
    } : m));

    try {
      await updateDoc(doc(db, "magazines", item.id), {
        displayInFrontend: newDisplayState,
        status: newStatus
      });
    } catch (err: any) {
      console.error("Error toggling display status:", err);
      alert("Failed to update display status: " + err.message);
      fetchItems();
    }
  };

  // Bulk Display in Frontend toggle
  const handleBulkToggleDisplay = async (display: boolean) => {
    if (selectedIds.length === 0) return;
    setBulkActionLoading(true);
    const newStatus = display ? "published" : "draft";

    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, "magazines", id), {
          displayInFrontend: display,
          status: newStatus
        });
      });
      await batch.commit();

      setItems(prev => prev.map(m => selectedIds.includes(m.id) ? {
        ...m,
        displayInFrontend: display,
        status: newStatus
      } : m));

      alert(`${selectedIds.length} magazine(s) set to ${display ? "Display in Frontend" : "Hidden from Frontend"}.`);
    } catch (err: any) {
      console.error("Bulk toggle error:", err);
      alert("Failed to update magazines: " + err.message);
      fetchItems();
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.length} magazine(s)?`)) return;

    setBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, "magazines", id));
      });
      await batch.commit();

      setItems(prev => prev.filter(m => !selectedIds.includes(m.id)));
      setSelectedIds([]);
      alert(`Successfully deleted ${selectedIds.length} magazine(s).`);
    } catch (err: any) {
      console.error("Bulk delete error:", err);
      alert("Failed to delete magazines: " + err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalOrder = typeof formData.order === "number" && !isNaN(formData.order) && formData.order > 0 
      ? formData.order 
      : (items.length > 0 ? items.length + 1 : 1);

    const payload: any = { 
      title: formData.title.trim(),
      description: formData.description.trim(),
      coverImageUrl: formData.coverImageUrl.trim(),
      pdfUrl: formData.pdfUrl.trim(),
      displayInFrontend: formData.displayInFrontend,
      status: formData.displayInFrontend ? "published" : "draft",
      order: finalOrder,
      position: finalOrder
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "magazines", editingId), payload);
      } else {
        await addDoc(collection(db, "magazines"), { ...payload, createdAt: Date.now() });
      }
      setIsModalOpen(false);
      resetForm();
      fetchItems();
    } catch (err: any) {
      console.error("Error saving magazine:", err);
      alert("Failed to save magazine: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this magazine publication?")) {
      try {
        await deleteDoc(doc(db, "magazines", id));
        setItems(prev => prev.filter(m => m.id !== id));
        setSelectedIds(prev => prev.filter(item => item !== id));
      } catch (err: any) {
        alert("Failed to delete magazine: " + err.message);
      }
    }
  };

  const resetForm = () => {
    setFormData({ 
      title: "", 
      description: "", 
      coverImageUrl: "", 
      pdfUrl: "",
      displayInFrontend: true,
      order: items.length + 1
    });
    setEditingId(null);
  };

  const openEditModal = (item: Magazine) => {
    const globalIndex = items.findIndex(m => m.id === item.id);
    setFormData({
      title: item.title,
      description: item.description,
      coverImageUrl: item.coverImageUrl,
      pdfUrl: item.pdfUrl,
      displayInFrontend: item.displayInFrontend !== false,
      order: item.order !== undefined ? item.order : globalIndex + 1
    });
    setEditingId(item.id);
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full font-inter">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold font-montserrat text-[#0F172A] tracking-tight">
              Magazines & Periodicals
            </h2>
            <span className="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-700 rounded-full border border-blue-100">
              {items.length} Issues
            </span>
            {isReordering && (
              <span className="px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-700 rounded-full border border-amber-200 animate-pulse flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 animate-spin" /> Saving Order...
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage club publications, PDF links, reorder position hierarchy, and control live frontend visibility.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {items.length > 1 && (
            <button
              onClick={() => setIsReorderModalOpen(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-4 py-3 rounded-[16px] text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all hover:scale-[1.02]"
              title="Open Position Reorder Organizer"
            >
              <ArrowUpDown className="h-4 w-4 text-blue-600" /> Reorder Issues
            </button>
          )}

          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-[16px] text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.02] shrink-0"
          >
            <Plus className="h-4 w-4" /> Add Magazine
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl mb-4 shrink-0 flex items-center gap-2 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Control / Filter Bar */}
      <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 p-3 sm:p-4 rounded-[20px] shadow-sm mb-6 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Select All Toggle */}
          <button
            onClick={handleSelectAllToggle}
            disabled={visibleIds.length === 0}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              isAllVisibleSelected
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : isSomeVisibleSelected
                ? "bg-blue-50/50 border-blue-200 text-blue-600"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
            title="Toggle Select All"
          >
            {isAllVisibleSelected ? (
              <CheckSquare className="w-4 h-4 text-blue-600" />
            ) : isSomeVisibleSelected ? (
              <MinusSquare className="w-4 h-4 text-blue-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>Select All ({visibleIds.length})</span>
          </button>

          {/* Search Bar */}
          <div className="relative flex-1 min-w-[140px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search magazines by title or description..."
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-4 py-2 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 self-start md:self-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === "all"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All ({items.length})
          </button>
          <button
            onClick={() => setStatusFilter("visible")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              statusFilter === "visible"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            <Eye className="w-3 h-3" />
            Live ({items.filter(m => m.displayInFrontend !== false).length})
          </button>
          <button
            onClick={() => setStatusFilter("hidden")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              statusFilter === "hidden"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            <EyeOff className="w-3 h-3" />
            Hidden ({items.filter(m => m.displayInFrontend === false).length})
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
              {selectedIds.length}
            </span>
            <span className="text-xs font-bold text-slate-200">
              Selected Magazine{selectedIds.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => handleBulkToggleDisplay(true)}
              disabled={bulkActionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5" />
              Display in Frontend
            </button>

            <button
              onClick={() => handleBulkToggleDisplay(false)}
              disabled={bulkActionLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <EyeOff className="w-3.5 h-3.5" />
              Hide from Frontend
            </button>

            <button
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>

            <button
              onClick={handleClearSelection}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Grid of Magazines */}
      <div className="flex-1 overflow-y-auto pb-12">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm font-medium">Loading magazines...</div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">No magazines found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your search query or filter."
                : "Publish your first magazine issue using the button above."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map(item => {
              const isSelected = selectedIds.includes(item.id);
              const isLive = item.displayInFrontend !== false;
              const globalIndex = items.findIndex(m => m.id === item.id);
              const displayOrder = item.order !== undefined ? item.order : globalIndex + 1;
              const isFirst = globalIndex === 0;
              const isLast = globalIndex === items.length - 1;
              const isActionLoading = orderActionLoading === item.id;

              return (
                <div 
                  key={item.id} 
                  className={`bg-white/80 backdrop-blur-xl border rounded-[28px] overflow-hidden flex flex-col justify-between transition-all duration-300 group ${
                    isSelected 
                      ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md bg-blue-50/20" 
                      : "border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow-md"
                  }`}
                >
                  <div>
                    {/* Cover Preview & Selection Overlay */}
                    <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                      {item.coverImageUrl ? (
                        <img 
                          src={item.coverImageUrl} 
                          alt={item.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        />
                      ) : (
                        <div className="h-full flex flex-col justify-center items-center text-slate-300 gap-1 bg-slate-100">
                          <BookOpen className="w-10 h-10 text-slate-300" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">No Cover</span>
                        </div>
                      )}

                      {/* Top-left: Select Checkbox & Position Badge */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(item.id)}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-md backdrop-blur-md transition-all ${
                            isSelected
                              ? "bg-blue-600 text-white"
                              : "bg-white/90 text-slate-400 hover:text-slate-700 hover:bg-white"
                          }`}
                          title="Select magazine"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>

                        <span 
                          className="px-2.5 py-1 rounded-xl bg-slate-900/80 text-white text-[11px] font-extrabold shadow-md backdrop-blur-md border border-white/20"
                          title={`Display Order Position #${displayOrder}`}
                        >
                          #{displayOrder}
                        </span>
                      </div>

                      {/* Top-right: Quick Move & Status Badge */}
                      <div className="absolute top-3 right-3 flex items-center gap-1.5">
                        <div className="flex items-center bg-white/90 backdrop-blur-md rounded-xl p-0.5 shadow-sm border border-slate-200/60">
                          <button
                            type="button"
                            disabled={isFirst || isActionLoading}
                            onClick={(e) => handleMoveMagazine(item.id, "up", e)}
                            className="p-1 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Move Up 1 Position"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isLast || isActionLoading}
                            onClick={(e) => handleMoveMagazine(item.id, "down", e)}
                            className="p-1 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Move Down 1 Position"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm flex items-center gap-1 ${
                          isLive
                            ? "bg-emerald-500/90 text-white"
                            : "bg-amber-500/90 text-white"
                        }`}>
                          {isLive ? <Globe className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          {isLive ? "Live" : "Hidden"}
                        </span>
                      </div>
                    </div>

                    <div className="p-5">
                      <h3 className="font-bold text-[#0F172A] text-lg mb-1 truncate group-hover:text-blue-600 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                        {item.description || "No description provided."}
                      </p>

                      {item.pdfUrl && (
                        <a
                          href={item.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" /> View PDF Document
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Position Organizer & Display in Frontend Switch Section */}
                  <div className="p-5 pt-0">
                    <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
                      {/* Position Sequence Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-50/90 p-2 rounded-xl border border-slate-200/70">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-600">Pos:</span>
                          <select
                            value={displayOrder}
                            onChange={(e) => handleSetCustomPosition(item.id, parseInt(e.target.value))}
                            disabled={isActionLoading}
                            className="bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            title="Change display sequence rank"
                          >
                            {items.map((_, idx) => (
                              <option key={idx + 1} value={idx + 1}>
                                #{idx + 1} {idx === 0 ? "(Top)" : idx === items.length - 1 ? "(Last)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleMoveToTop(item.id, e)}
                            disabled={isFirst || isActionLoading}
                            className="px-1.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-600 hover:text-blue-600 text-[10px] font-bold border border-slate-200/80 transition-colors disabled:opacity-40 flex items-center gap-0.5"
                            title="Move to #1 (Top)"
                          >
                            <ArrowUpToLine className="w-3 h-3" /> Top
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleMoveMagazine(item.id, "up", e)}
                            disabled={isFirst || isActionLoading}
                            className="p-1 rounded bg-white hover:bg-slate-100 text-slate-600 hover:text-blue-600 border border-slate-200/80 transition-colors disabled:opacity-40"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleMoveMagazine(item.id, "down", e)}
                            disabled={isLast || isActionLoading}
                            className="p-1 rounded bg-white hover:bg-slate-100 text-slate-600 hover:text-blue-600 border border-slate-200/80 transition-colors disabled:opacity-40"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleMoveToBottom(item.id, e)}
                            disabled={isLast || isActionLoading}
                            className="px-1.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-600 hover:text-blue-600 text-[10px] font-bold border border-slate-200/80 transition-colors disabled:opacity-40 flex items-center gap-0.5"
                            title="Move to Last"
                          >
                            <ArrowDownToLine className="w-3 h-3" /> End
                          </button>
                        </div>
                      </div>

                      {/* Display in Frontend Toggle */}
                      <div className="flex items-center justify-between bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60">
                        <div className="flex items-center gap-2">
                          <Globe className={`w-4 h-4 ${isLive ? "text-emerald-600" : "text-slate-400"}`} />
                          <span className="text-xs font-bold text-slate-700">Display in Frontend</span>
                        </div>

                        {/* Interactive Toggle Switch */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isLive}
                          onClick={(e) => handleToggleDisplay(item, e)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                            isLive ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                          title={isLive ? "Currently visible in frontend (click to hide)" : "Currently hidden from frontend (click to display)"}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              isLive ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Bottom Action Buttons */}
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openEditModal(item)} 
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-1 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5"/> Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)} 
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5"/> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reorder Issues Organizer Modal */}
      {isReorderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[28px] p-6 sm:p-8 w-full max-w-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold font-montserrat text-[#0F172A] flex items-center gap-2">
                  <ArrowUpDown className="w-5 h-5 text-blue-600" />
                  Reorder Magazines Sequence
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Adjust display hierarchy on the live site. Changes save to database immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReorderModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List for fast reordering */}
            <div className="flex-1 overflow-y-auto py-4 space-y-2 pr-1">
              {items.map((item, index) => {
                const isFirst = index === 0;
                const isLast = index === items.length - 1;
                const isLive = item.displayInFrontend !== false;

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-3 bg-slate-50 hover:bg-blue-50/40 rounded-2xl border border-slate-200/80 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {item.title}
                        </p>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className={isLive ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                            {isLive ? "Live" : "Hidden"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveToTop(item.id)}
                        disabled={isFirst || isReordering}
                        className="px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 rounded-xl transition-all disabled:opacity-30 flex items-center gap-1"
                        title="Move to Top"
                      >
                        <ArrowUpToLine className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Top</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveMagazine(item.id, "up")}
                        disabled={isFirst || isReordering}
                        className="p-1.5 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 rounded-xl transition-all disabled:opacity-30"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveMagazine(item.id, "down")}
                        disabled={isLast || isReordering}
                        className="p-1.5 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 rounded-xl transition-all disabled:opacity-30"
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveToBottom(item.id)}
                        disabled={isLast || isReordering}
                        className="px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 rounded-xl transition-all disabled:opacity-30 flex items-center gap-1"
                        title="Move to Bottom"
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Bottom</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsReorderModalOpen(false)}
                className="px-6 py-2.5 rounded-[16px] bg-slate-900 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Magazine Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4">
          <form onSubmit={handleSave} className="bg-white rounded-[28px] p-6 sm:p-8 w-full max-w-lg shadow-2xl my-8 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <h3 className="text-xl font-bold font-montserrat text-[#0F172A]">
                {editingId ? 'Edit Magazine' : 'Add New Magazine'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Title *
                </label>
                <input 
                  required 
                  placeholder="e.g. Civil Spectrum Vol. 12"
                  className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                  value={formData.title} 
                  onChange={e=>setFormData({...formData, title:e.target.value})} 
                />
              </div>

              {/* Display Sequence Rank / Order input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Display Sequence Rank (Order) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 1 (Top position)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  1 places this magazine at the very top of the publications section.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Description *
                </label>
                <textarea 
                  required 
                  rows={3} 
                  placeholder="Summary of this issue's articles and features..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                  value={formData.description} 
                  onChange={e=>setFormData({...formData, description:e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Cover Image URL
                </label>
                <input 
                  type="url" 
                  placeholder="https://example.com/magazine-cover.jpg"
                  className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                  value={formData.coverImageUrl} 
                  onChange={e=>setFormData({...formData, coverImageUrl:e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  PDF URL *
                </label>
                <input 
                  required 
                  type="url" 
                  placeholder="https://example.com/magazine.pdf"
                  className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                  value={formData.pdfUrl} 
                  onChange={e=>setFormData({...formData, pdfUrl:e.target.value})} 
                />
              </div>

              {/* Display in Frontend Toggle in Form */}
              <div className="bg-slate-50 p-4 rounded-[20px] border border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-blue-600" />
                    Display in Frontend
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    When enabled, this publication is visible on the public frontend website.
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.displayInFrontend}
                  onClick={() => setFormData({ ...formData, displayInFrontend: !formData.displayInFrontend })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    formData.displayInFrontend ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      formData.displayInFrontend ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                type="button" 
                onClick={()=>setIsModalOpen(false)} 
                className="px-6 py-3 rounded-[16px] bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-6 py-3 rounded-[16px] bg-blue-600 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all hover:scale-[1.02]"
              >
                {editingId ? 'Save Changes' : 'Create Magazine'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
