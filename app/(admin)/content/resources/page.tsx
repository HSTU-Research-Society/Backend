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
  File, 
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
  FolderOpen,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ArrowUpToLine,
  ArrowDownToLine
} from "lucide-react";

interface ResourceItem {
  id: string;
  title: string;
  coverImageUrl: string;
  fileUrl: string;
  fileType: string;
  categoryTag: string;
  displayInFrontend?: boolean;
  status?: "published" | "draft";
  order?: number;
  position?: number;
  createdAt: number;
}

export default function ResourcesPage() {
  const [items, setItems] = useState<ResourceItem[]>([]);
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
    coverImageUrl: "", 
    fileUrl: "", 
    fileType: "PDF", 
    categoryTag: "General",
    displayInFrontend: true,
    order: 1
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "resources"));
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || "",
          coverImageUrl: data.coverImageUrl || "",
          fileUrl: data.fileUrl || "",
          fileType: data.fileType || "PDF",
          categoryTag: data.categoryTag || "General",
          displayInFrontend: data.displayInFrontend !== undefined ? Boolean(data.displayInFrontend) : true,
          status: data.status || (data.displayInFrontend === false ? "draft" : "published"),
          order: typeof data.order === "number" ? data.order : (typeof data.position === "number" ? data.position : undefined),
          position: typeof data.position === "number" ? data.position : (typeof data.order === "number" ? data.order : undefined),
          createdAt: data.createdAt || 0,
        } as ResourceItem;
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
      console.error("Error fetching resources:", err);
      setError(err.message || "Failed to load resources.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchItems(); 
  }, [fetchItems]);

  // Persist updated order to Firestore
  const persistOrder = async (updatedList: ResourceItem[]) => {
    setIsReordering(true);
    try {
      const batch = writeBatch(db);
      const normalizedList = updatedList.map((item, index) => {
        const newOrder = index + 1;
        batch.update(doc(db, "resources", item.id), {
          order: newOrder,
          position: newOrder
        });
        return { ...item, order: newOrder, position: newOrder };
      });
      await batch.commit();
      setItems(normalizedList);
    } catch (err: any) {
      console.error("Error persisting resource order:", err);
      alert("Failed to update resource order: " + err.message);
      fetchItems();
    } finally {
      setIsReordering(false);
      setOrderActionLoading(null);
    }
  };

  // Move 1 position up or down
  const handleMoveResource = async (id: string, direction: "up" | "down", e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const currentIndex = items.findIndex(r => r.id === id);
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
    const currentIndex = items.findIndex(r => r.id === id);
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
    const currentIndex = items.findIndex(r => r.id === id);
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
    const currentIndex = items.findIndex(r => r.id === id);
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

  // Filtered resources
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        item.title.toLowerCase().includes(q) || 
        (item.categoryTag || "").toLowerCase().includes(q) ||
        (item.fileType || "").toLowerCase().includes(q);
      
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
  const handleToggleDisplay = async (item: ResourceItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newDisplayState = !item.displayInFrontend;
    const newStatus = newDisplayState ? "published" : "draft";

    // Optimistic update
    setItems(prev => prev.map(r => r.id === item.id ? {
      ...r,
      displayInFrontend: newDisplayState,
      status: newStatus
    } : r));

    try {
      await updateDoc(doc(db, "resources", item.id), {
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
        batch.update(doc(db, "resources", id), {
          displayInFrontend: display,
          status: newStatus
        });
      });
      await batch.commit();

      setItems(prev => prev.map(r => selectedIds.includes(r.id) ? {
        ...r,
        displayInFrontend: display,
        status: newStatus
      } : r));

      alert(`${selectedIds.length} resource(s) set to ${display ? "Display in Frontend" : "Hidden from Frontend"}.`);
    } catch (err: any) {
      console.error("Bulk toggle error:", err);
      alert("Failed to update resources: " + err.message);
      fetchItems();
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.length} resource(s)?`)) return;

    setBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, "resources", id));
      });
      await batch.commit();

      setItems(prev => prev.filter(r => !selectedIds.includes(r.id)));
      setSelectedIds([]);
      alert(`Successfully deleted ${selectedIds.length} resource(s).`);
    } catch (err: any) {
      console.error("Bulk delete error:", err);
      alert("Failed to delete resources: " + err.message);
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
      coverImageUrl: formData.coverImageUrl.trim(),
      fileUrl: formData.fileUrl.trim(),
      fileType: formData.fileType,
      categoryTag: formData.categoryTag.trim() || "General",
      displayInFrontend: formData.displayInFrontend,
      status: formData.displayInFrontend ? "published" : "draft",
      order: finalOrder,
      position: finalOrder
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "resources", editingId), payload);
      } else {
        await addDoc(collection(db, "resources"), { ...payload, createdAt: Date.now() });
      }
      setIsModalOpen(false);
      resetForm();
      fetchItems();
    } catch (err: any) {
      console.error("Error saving resource:", err);
      alert("Failed to save resource: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this resource?")) {
      try {
        await deleteDoc(doc(db, "resources", id));
        setItems(prev => prev.filter(r => r.id !== id));
        setSelectedIds(prev => prev.filter(item => item !== id));
      } catch (err: any) {
        alert("Failed to delete resource: " + err.message);
      }
    }
  };

  const resetForm = () => {
    setFormData({ 
      title: "", 
      coverImageUrl: "", 
      fileUrl: "", 
      fileType: "PDF", 
      categoryTag: "General",
      displayInFrontend: true,
      order: items.length + 1
    });
    setEditingId(null);
  };

  const openEditModal = (item: ResourceItem) => {
    const globalIndex = items.findIndex(r => r.id === item.id);
    setFormData({
      title: item.title,
      coverImageUrl: item.coverImageUrl,
      fileUrl: item.fileUrl,
      fileType: item.fileType || "PDF",
      categoryTag: item.categoryTag || "General",
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
              Learning Resources & Documents
            </h2>
            <span className="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-700 rounded-full border border-blue-100">
              {items.length} Files
            </span>
            {isReordering && (
              <span className="px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-700 rounded-full border border-amber-200 animate-pulse flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 animate-spin" /> Saving Order...
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage course materials, software sheets, reorder position hierarchy, and control live frontend access.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {items.length > 1 && (
            <button
              onClick={() => setIsReorderModalOpen(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-4 py-3 rounded-[16px] text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all hover:scale-[1.02]"
              title="Open Position Reorder Organizer"
            >
              <ArrowUpDown className="h-4 w-4 text-blue-600" /> Reorder Files
            </button>
          )}

          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-[16px] text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.02] shrink-0"
          >
            <Plus className="h-4 w-4" /> Add Resource
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
              placeholder="Search resources by title, category, or format..."
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
            Live ({items.filter(r => r.displayInFrontend !== false).length})
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
            Hidden ({items.filter(r => r.displayInFrontend === false).length})
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
              Selected Resource{selectedIds.length > 1 ? "s" : ""}
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

      {/* Grid of Resources */}
      <div className="flex-1 overflow-y-auto pb-12">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm font-medium">Loading resources...</div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">No resources found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your search query or filter."
                : "Add your first study resource, handbook, or template using the button above."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map(item => {
              const isSelected = selectedIds.includes(item.id);
              const isLive = item.displayInFrontend !== false;
              const globalIndex = items.findIndex(r => r.id === item.id);
              const displayOrder = item.order !== undefined ? item.order : globalIndex + 1;
              const isFirst = globalIndex === 0;
              const isLast = globalIndex === items.length - 1;
              const isActionLoading = orderActionLoading === item.id;

              return (
                <div 
                  key={item.id} 
                  className={`bg-white/80 backdrop-blur-xl border rounded-[28px] p-5 flex flex-col justify-between transition-all duration-300 group ${
                    isSelected 
                      ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md bg-blue-50/20" 
                      : "border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow-md"
                  }`}
                >
                  <div>
                    {/* Top Row: Checkbox, Position Badge, Icon, Quick Move, Status */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(item.id)}
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

                        <div className="h-10 w-10 rounded-[12px] bg-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-200/80">
                          {item.coverImageUrl ? (
                            <img src={item.coverImageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <File className="text-slate-400 w-5 h-5" />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Quick Up / Down Arrows */}
                        <div className="flex items-center bg-slate-100/90 rounded-lg p-0.5 border border-slate-200/80">
                          <button
                            type="button"
                            disabled={isFirst || isActionLoading}
                            onClick={(e) => handleMoveResource(item.id, "up", e)}
                            className="p-1 text-slate-600 hover:text-blue-600 hover:bg-white rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Move Up 1 Position"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isLast || isActionLoading}
                            onClick={(e) => handleMoveResource(item.id, "down", e)}
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

                    {/* Title & Badges */}
                    <h3 className="font-bold text-[#0F172A] text-base leading-snug mb-2 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {item.title}
                    </h3>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md">
                        {item.categoryTag || "General"}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md">
                        {item.fileType || "File"}
                      </span>
                    </div>

                    {item.fileUrl && (
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors mb-3"
                      >
                        <ExternalLink className="w-3 h-3" /> View / Download File
                      </a>
                    )}
                  </div>

                  {/* Position Sequence Bar & Display in Frontend Toggle Switch */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
                    {/* Position Sequence Toolbar */}
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
                          onClick={(e) => handleMoveResource(item.id, "up", e)}
                          disabled={isFirst || isActionLoading}
                          className="p-1 rounded bg-white hover:bg-slate-100 text-slate-600 hover:text-blue-600 border border-slate-200/80 transition-colors disabled:opacity-40"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleMoveResource(item.id, "down", e)}
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

                    {/* Display in Frontend Switch */}
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

                    {/* Action buttons */}
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
              );
            })}
          </div>
        )}
      </div>

      {/* Reorder Resources Organizer Modal */}
      {isReorderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[28px] p-6 sm:p-8 w-full max-w-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold font-montserrat text-[#0F172A] flex items-center gap-2">
                  <ArrowUpDown className="w-5 h-5 text-blue-600" />
                  Reorder Learning Resources Sequence
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
                          <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">{item.fileType}</span>
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
                        onClick={() => handleMoveResource(item.id, "up")}
                        disabled={isFirst || isReordering}
                        className="p-1.5 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 rounded-xl transition-all disabled:opacity-30"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveResource(item.id, "down")}
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

      {/* Add / Edit Resource Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4">
          <form onSubmit={handleSave} className="bg-white rounded-[28px] p-6 sm:p-8 w-full max-w-lg shadow-2xl my-8 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <h3 className="text-xl font-bold font-montserrat text-[#0F172A]">
                {editingId ? 'Edit Resource' : 'Add New Resource'}
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
                  Resource Title *
                </label>
                <input 
                  required 
                  placeholder="e.g. AutoCAD Structural Detailing Handbook"
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
                  1 places this resource document at the very top of the list.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    File Format *
                  </label>
                  <select 
                    required 
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                    value={formData.fileType} 
                    onChange={e=>setFormData({...formData, fileType:e.target.value})}
                  >
                    <option value="PDF">PDF</option>
                    <option value="DOCX">DOCX (Word)</option>
                    <option value="XLSX">XLSX (Excel)</option>
                    <option value="ZIP">ZIP</option>
                    <option value="DWG">DWG (CAD)</option>
                    <option value="MP4">MP4 (Video)</option>
                    <option value="CODE">Code/Link</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Category Tag
                  </label>
                  <input 
                    required 
                    placeholder="e.g. Structural, Geotech"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                    value={formData.categoryTag} 
                    onChange={e=>setFormData({...formData, categoryTag:e.target.value})} 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Cover / Thumbnail Image URL
                </label>
                <input 
                  type="url" 
                  placeholder="https://example.com/thumbnail.jpg"
                  className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                  value={formData.coverImageUrl} 
                  onChange={e=>setFormData({...formData, coverImageUrl:e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  File URL / Download Link *
                </label>
                <input 
                  required 
                  type="url" 
                  placeholder="https://example.com/file.pdf"
                  className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                  value={formData.fileUrl} 
                  onChange={e=>setFormData({...formData, fileUrl:e.target.value})} 
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
                    When enabled, this resource is available for students and public visitors.
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
                {editingId ? 'Save Changes' : 'Create Resource'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
