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
  Image as ImageIcon, 
  Video, 
  Search, 
  CheckSquare, 
  Square, 
  MinusSquare, 
  Eye, 
  EyeOff, 
  Globe, 
  X, 
  AlertCircle,
  Images,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ArrowUpToLine,
  ArrowDownToLine
} from "lucide-react";

interface GalleryItem {
  type: string;
  url: string;
}

interface Gallery {
  id: string;
  title: string;
  items: GalleryItem[];
  displayInFrontend?: boolean;
  status?: "published" | "draft";
  order?: number;
  position?: number;
  createdAt: number;
}

export default function GalleryPage() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "visible" | "hidden">("all");

  // Reordering state
  const [isReordering, setIsReordering] = useState(false);
  const [orderActionLoading, setOrderActionLoading] = useState<string | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [displayInFrontend, setDisplayInFrontend] = useState(true);
  const [order, setOrder] = useState<number>(1);

  const fetchGalleries = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "gallery_items"));
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || "",
          items: Array.isArray(data.items) ? data.items : [],
          displayInFrontend: data.displayInFrontend !== undefined ? Boolean(data.displayInFrontend) : true,
          status: data.status || (data.displayInFrontend === false ? "draft" : "published"),
          order: typeof data.order === "number" ? data.order : (typeof data.position === "number" ? data.position : undefined),
          createdAt: data.createdAt || 0,
        } as Gallery;
      });

      // Sort by order ascending if specified, then createdAt descending
      list.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      setGalleries(list);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching galleries:", err);
      setError(err.message || "Failed to load galleries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchGalleries(); 
  }, [fetchGalleries]);

  // Persist reordered array to Firestore
  const persistOrder = async (updatedGalleries: Gallery[]) => {
    setIsReordering(true);
    try {
      const batch = writeBatch(db);
      updatedGalleries.forEach((gal, index) => {
        const newOrder = index + 1;
        batch.update(doc(db, "gallery_items", gal.id), { 
          order: newOrder,
          position: newOrder 
        });
      });
      await batch.commit();
    } catch (err: any) {
      console.error("Error saving gallery order to Firestore:", err);
      alert("Failed to save new order to database: " + err.message);
      fetchGalleries(); // Rollback
    } finally {
      setIsReordering(false);
      setOrderActionLoading(null);
    }
  };

  // Move an album up or down by 1 position
  const handleMoveGallery = async (galId: string, direction: "up" | "down", e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isReordering) return;

    const currentIndex = galleries.findIndex(g => g.id === galId);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= galleries.length) return;

    setOrderActionLoading(galId);

    const reordered = [...galleries];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const normalized = reordered.map((g, idx) => ({ ...g, order: idx + 1 }));
    setGalleries(normalized);

    await persistOrder(normalized);
  };

  // Move directly to Top (#1)
  const handleMoveToTop = async (galId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isReordering) return;

    const currentIndex = galleries.findIndex(g => g.id === galId);
    if (currentIndex <= 0) return;

    setOrderActionLoading(galId);

    const reordered = [...galleries];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.unshift(moved);

    const normalized = reordered.map((g, idx) => ({ ...g, order: idx + 1 }));
    setGalleries(normalized);

    await persistOrder(normalized);
  };

  // Move directly to Bottom (Last #)
  const handleMoveToBottom = async (galId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isReordering) return;

    const currentIndex = galleries.findIndex(g => g.id === galId);
    if (currentIndex === -1 || currentIndex === galleries.length - 1) return;

    setOrderActionLoading(galId);

    const reordered = [...galleries];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.push(moved);

    const normalized = reordered.map((g, idx) => ({ ...g, order: idx + 1 }));
    setGalleries(normalized);

    await persistOrder(normalized);
  };

  // Set explicit custom position rank
  const handleSetCustomPosition = async (galId: string, targetRank: number) => {
    if (isNaN(targetRank) || targetRank < 1 || targetRank > galleries.length) {
      alert(`Please enter a valid rank between 1 and ${galleries.length}.`);
      return;
    }

    const currentIndex = galleries.findIndex(g => g.id === galId);
    if (currentIndex === -1) return;
    const targetIndex = targetRank - 1;
    if (currentIndex === targetIndex) return;

    setOrderActionLoading(galId);

    const reordered = [...galleries];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const normalized = reordered.map((g, idx) => ({ ...g, order: idx + 1 }));
    setGalleries(normalized);

    await persistOrder(normalized);
  };

  // Filtered galleries
  const filteredGalleries = useMemo(() => {
    return galleries.filter(gal => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || gal.title.toLowerCase().includes(q);
      
      const isVisible = gal.displayInFrontend !== false;
      const matchStatus = 
        statusFilter === "all" || 
        (statusFilter === "visible" && isVisible) || 
        (statusFilter === "hidden" && !isVisible);

      return matchSearch && matchStatus;
    });
  }, [galleries, searchQuery, statusFilter]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const visibleIds = useMemo(() => filteredGalleries.map(g => g.id), [filteredGalleries]);
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
  const handleToggleDisplay = async (gal: Gallery, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newDisplayState = !gal.displayInFrontend;
    const newStatus = newDisplayState ? "published" : "draft";

    // Optimistic update
    setGalleries(prev => prev.map(g => g.id === gal.id ? {
      ...g,
      displayInFrontend: newDisplayState,
      status: newStatus
    } : g));

    try {
      await updateDoc(doc(db, "gallery_items", gal.id), {
        displayInFrontend: newDisplayState,
        status: newStatus
      });
    } catch (err: any) {
      console.error("Error updating display status:", err);
      alert("Failed to update frontend display status: " + err.message);
      fetchGalleries();
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
        batch.update(doc(db, "gallery_items", id), {
          displayInFrontend: display,
          status: newStatus
        });
      });
      await batch.commit();

      setGalleries(prev => prev.map(g => selectedIds.includes(g.id) ? {
        ...g,
        displayInFrontend: display,
        status: newStatus
      } : g));

      alert(`${selectedIds.length} gallery album(s) set to ${display ? "Display in Frontend" : "Hidden from Frontend"}.`);
    } catch (err: any) {
      console.error("Bulk toggle error:", err);
      alert("Failed to update galleries: " + err.message);
      fetchGalleries();
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.length} gallery album(s)?`)) return;

    setBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, "gallery_items", id));
      });
      await batch.commit();

      setGalleries(prev => prev.filter(g => !selectedIds.includes(g.id)));
      setSelectedIds([]);
      alert(`Successfully deleted ${selectedIds.length} gallery album(s).`);
    } catch (err: any) {
      console.error("Bulk delete error:", err);
      alert("Failed to delete galleries: " + err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalOrder = typeof order === "number" && !isNaN(order) && order > 0 
      ? order 
      : (galleries.length > 0 ? galleries.length + 1 : 1);

    const payload: any = { 
      title: title.trim(), 
      items,
      displayInFrontend,
      status: displayInFrontend ? "published" : "draft",
      order: finalOrder,
      position: finalOrder
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "gallery_items", editingId), payload);
      } else {
        await addDoc(collection(db, "gallery_items"), { ...payload, createdAt: Date.now() });
      }
      setIsModalOpen(false);
      fetchGalleries();
    } catch (err: any) {
      console.error("Error saving gallery:", err);
      alert("Error saving gallery: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this gallery album?")) {
      try {
        await deleteDoc(doc(db, "gallery_items", id));
        setGalleries(prev => prev.filter(g => g.id !== id));
        setSelectedIds(prev => prev.filter(item => item !== id));
      } catch (err: any) {
        alert("Failed to delete gallery: " + err.message);
      }
    }
  };

  const addItem = () => setItems([...items, { type: "image", url: "" }]);
  const updateItem = (index: number, field: string, val: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: val };
    setItems(newItems);
  };
  const removeItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  return (
    <div className="flex flex-col h-full font-inter">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold font-montserrat text-[#0F172A] tracking-tight">
              Gallery & Media
            </h2>
            <span className="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-700 rounded-full border border-blue-100">
              {galleries.length} Albums
            </span>
            {isReordering && (
              <span className="px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-700 rounded-full border border-amber-200 animate-pulse flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 animate-spin" /> Saving Order...
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Organize photo albums, project videos, reorder position hierarchy, and control frontend display status.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {galleries.length > 1 && (
            <button
              onClick={() => setIsReorderModalOpen(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-4 py-3 rounded-[16px] text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all hover:scale-[1.02]"
              title="Open Position Reorder Organizer"
            >
              <ArrowUpDown className="h-4 w-4 text-blue-600" /> Reorder Albums
            </button>
          )}

          <button 
            onClick={() => { 
              setTitle(""); 
              setItems([]); 
              setDisplayInFrontend(true);
              setOrder(galleries.length + 1);
              setEditingId(null); 
              setIsModalOpen(true); 
            }} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-[16px] text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.02] shrink-0"
          >
            <Plus className="h-4 w-4" /> Add Gallery
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
              placeholder="Search albums by title..."
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
            All ({galleries.length})
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
            Live ({galleries.filter(g => g.displayInFrontend !== false).length})
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
            Hidden ({galleries.filter(g => g.displayInFrontend === false).length})
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
              Selected Album{selectedIds.length > 1 ? "s" : ""}
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

      {/* Grid of Albums */}
      <div className="flex-1 overflow-y-auto pb-12">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm font-medium">Loading galleries...</div>
        ) : filteredGalleries.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <Images className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">No gallery albums found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your search query or filter."
                : "Create your first photo or video gallery album using the button above."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredGalleries.map((gal) => {
              const isSelected = selectedIds.includes(gal.id);
              const isLive = gal.displayInFrontend !== false;
              const globalIndex = galleries.findIndex(g => g.id === gal.id);
              const displayOrder = gal.order !== undefined ? gal.order : globalIndex + 1;
              const isFirst = globalIndex === 0;
              const isLast = globalIndex === galleries.length - 1;
              const isActionLoading = orderActionLoading === gal.id;

              return (
                <div 
                  key={gal.id} 
                  className={`bg-white/80 backdrop-blur-xl border p-6 rounded-[28px] flex flex-col justify-between transition-all duration-300 group relative ${
                    isSelected 
                      ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md bg-blue-50/20" 
                      : "border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow-md"
                  }`}
                >
                  <div>
                    {/* Top Row: Selection Checkbox, Position Badge, Title, Status, Quick Move */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(gal.id)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>

                        {/* Position Rank Badge */}
                        <div 
                          className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200/80 text-blue-700 text-[11px] font-extrabold shrink-0 shadow-2xs flex items-center gap-0.5"
                          title={`Display Order Position #${displayOrder}`}
                        >
                          <span>#{displayOrder}</span>
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-bold text-[#0F172A] text-lg leading-tight group-hover:text-blue-600 transition-colors truncate">
                            {gal.title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {gal.items?.length || 0} media item{gal.items?.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Quick Up / Down Arrows */}
                        <div className="flex items-center bg-slate-100/90 rounded-lg p-0.5 border border-slate-200/80">
                          <button
                            type="button"
                            disabled={isFirst || isActionLoading}
                            onClick={(e) => handleMoveGallery(gal.id, "up", e)}
                            className="p-1 text-slate-600 hover:text-blue-600 hover:bg-white rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Move Up 1 Position"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isLast || isActionLoading}
                            onClick={(e) => handleMoveGallery(gal.id, "down", e)}
                            className="p-1 text-slate-600 hover:text-blue-600 hover:bg-white rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Move Down 1 Position"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1 ${
                          isLive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {isLive ? <Globe className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          {isLive ? "Live" : "Hidden"}
                        </span>
                      </div>
                    </div>

                    {/* Media Thumbnail Previews */}
                    <div className="flex gap-2.5 mb-4 overflow-x-auto pb-2 pt-1">
                      {gal.items && gal.items.length > 0 ? (
                        gal.items.map((it, i) => (
                          <div key={i} className="w-16 h-16 rounded-xl bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center border border-slate-200/80 shadow-2xs">
                            {it.type === 'image' ? (
                              <img src={it.url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Video className="w-6 h-6 text-slate-400" />
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="w-full py-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          No media items added
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Rank Bar & Display in Frontend Toggle */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
                    {/* Position Organizer Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/90 p-2 rounded-xl border border-slate-200/70">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-600">Position:</span>
                        <select
                          value={displayOrder}
                          onChange={(e) => handleSetCustomPosition(gal.id, parseInt(e.target.value))}
                          disabled={isActionLoading}
                          className="bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                          title="Change display sequence rank"
                        >
                          {galleries.map((_, idx) => (
                            <option key={idx + 1} value={idx + 1}>
                              #{idx + 1} {idx === 0 ? "(Top)" : idx === galleries.length - 1 ? "(Last)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleMoveToTop(gal.id, e)}
                          disabled={isFirst || isActionLoading}
                          className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-slate-600 hover:text-blue-600 text-[11px] font-bold border border-slate-200/80 transition-colors disabled:opacity-40 flex items-center gap-1"
                          title="Move to #1 (Top)"
                        >
                          <ArrowUpToLine className="w-3 h-3" /> Top
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleMoveGallery(gal.id, "up", e)}
                          disabled={isFirst || isActionLoading}
                          className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-slate-600 hover:text-blue-600 text-[11px] font-bold border border-slate-200/80 transition-colors disabled:opacity-40 flex items-center gap-1"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3 h-3" /> Up
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleMoveGallery(gal.id, "down", e)}
                          disabled={isLast || isActionLoading}
                          className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-slate-600 hover:text-blue-600 text-[11px] font-bold border border-slate-200/80 transition-colors disabled:opacity-40 flex items-center gap-1"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3 h-3" /> Down
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleMoveToBottom(gal.id, e)}
                          disabled={isLast || isActionLoading}
                          className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-slate-600 hover:text-blue-600 text-[11px] font-bold border border-slate-200/80 transition-colors disabled:opacity-40 flex items-center gap-1"
                          title="Move to Last"
                        >
                          <ArrowDownToLine className="w-3 h-3" /> Bottom
                        </button>
                      </div>
                    </div>

                    {/* Display in Frontend Toggle Switch */}
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
                        onClick={(e) => handleToggleDisplay(gal, e)}
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

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => { 
                          setTitle(gal.title); 
                          setItems(gal.items || []); 
                          setDisplayInFrontend(gal.displayInFrontend !== false);
                          setOrder(gal.order !== undefined ? gal.order : globalIndex + 1);
                          setEditingId(gal.id); 
                          setIsModalOpen(true); 
                        }} 
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-1 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5"/> Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(gal.id)} 
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5"/> Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reorder Albums Organizer Modal */}
      {isReorderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[28px] p-6 sm:p-8 w-full max-w-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold font-montserrat text-[#0F172A] flex items-center gap-2">
                  <ArrowUpDown className="w-5 h-5 text-blue-600" />
                  Reorder Gallery Albums Sequence
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
              {galleries.map((gal, index) => {
                const isFirst = index === 0;
                const isLast = index === galleries.length - 1;
                const isLive = gal.displayInFrontend !== false;

                return (
                  <div
                    key={gal.id}
                    className="flex items-center justify-between gap-3 p-3 bg-slate-50 hover:bg-blue-50/40 rounded-2xl border border-slate-200/80 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {gal.title}
                        </p>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{gal.items?.length || 0} media</span>
                          <span>•</span>
                          <span className={isLive ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                            {isLive ? "Live" : "Hidden"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveToTop(gal.id)}
                        disabled={isFirst || isReordering}
                        className="px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 rounded-xl transition-all disabled:opacity-30 flex items-center gap-1"
                        title="Move to Top"
                      >
                        <ArrowUpToLine className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Top</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveGallery(gal.id, "up")}
                        disabled={isFirst || isReordering}
                        className="p-1.5 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 rounded-xl transition-all disabled:opacity-30"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveGallery(gal.id, "down")}
                        disabled={isLast || isReordering}
                        className="p-1.5 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 rounded-xl transition-all disabled:opacity-30"
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveToBottom(gal.id)}
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

      {/* Add / Edit Gallery Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4">
          <form onSubmit={handleSave} className="bg-white rounded-[28px] p-6 sm:p-8 w-full max-w-2xl shadow-2xl my-8 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <h3 className="text-xl font-bold font-montserrat text-[#0F172A]">
                {editingId ? 'Edit Gallery' : 'Add New Gallery'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Gallery Title *</label>
                <input 
                  required 
                  placeholder="e.g. Annual Bridge Design Competition 2026"
                  className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                  value={title} 
                  onChange={e=>setTitle(e.target.value)} 
                />
              </div>

              {/* Display Position / Order Field */}
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
                  value={order}
                  onChange={(e) => setOrder(parseInt(e.target.value) || 1)}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  1 places this gallery album at the very top of the live gallery page.
                </p>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Media Items</label>
                  <button 
                    type="button" 
                    onClick={addItem} 
                    className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1 hover:text-blue-800"
                  >
                    <Plus className="w-3.5 h-3.5"/> Add Media
                  </button>
                </div>
                
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center bg-slate-50 p-3 rounded-[16px] border border-slate-200">
                      <select 
                        className="bg-white border border-slate-200 rounded-xl p-2 outline-none text-xs font-medium w-28" 
                        value={item.type} 
                        onChange={e=>updateItem(index, 'type', e.target.value)}
                      >
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                        <option value="youtube">YouTube</option>
                      </select>
                      <input 
                        required 
                        type="url" 
                        placeholder="https://example.com/media.jpg" 
                        className="flex-1 bg-white border border-slate-200 rounded-xl p-2 outline-none text-xs" 
                        value={item.url} 
                        onChange={e=>updateItem(index, 'url', e.target.value)} 
                      />
                      <button 
                        type="button" 
                        onClick={() => removeItem(index)} 
                        className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4"/>
                      </button>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="text-xs text-slate-400 italic py-3 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No media added yet. Click &quot;Add Media&quot; above.
                    </p>
                  )}
                </div>
              </div>

              {/* Display in Frontend Toggle in Form */}
              <div className="bg-slate-50 p-4 rounded-[20px] border border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-blue-600" />
                    Display in Frontend
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    When enabled, this gallery will be displayed on the live public site.
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={displayInFrontend}
                  onClick={() => setDisplayInFrontend(!displayInFrontend)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    displayInFrontend ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      displayInFrontend ? "translate-x-5" : "translate-x-0"
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
                {editingId ? 'Save Changes' : 'Create Gallery'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
