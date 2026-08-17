"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  doc, 
  query, 
  writeBatch,
  setDoc 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Handshake, 
  Trash2, 
  Edit2, 
  Plus, 
  Image as ImageIcon, 
  ExternalLink, 
  Search, 
  CheckSquare, 
  Square, 
  MinusSquare, 
  Eye, 
  EyeOff, 
  Globe, 
  X, 
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpToLine,
  ArrowDownToLine,
  Upload,
  Download,
  Link as LinkIcon,
  Sparkles,
  Building2,
  Check
} from "lucide-react";
import Papa from "papaparse";

export interface Partner {
  id: string;
  name: string;
  imageUrl: string;
  logoUrl?: string;
  websiteUrl?: string;
  category?: string;
  description?: string;
  displayInFrontend?: boolean;
  order?: number;
  position?: number;
  createdAt: number;
}

const PARTNER_CATEGORIES = [
  "All",
  "Strategic Partner",
  "Corporate Partner",
  "Academic Partner",
  "Media Partner",
  "Technology Partner",
  "Community Partner",
  "Sponsor",
  "General"
];

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickImageModalOpen, setIsQuickImageModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [quickImagePartner, setQuickImagePartner] = useState<Partner | null>(null);
  const [quickImageUrl, setQuickImageUrl] = useState("");
  const [quickImageSaving, setQuickImageSaving] = useState(false);

  // Filters and search
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"all" | "visible" | "hidden">("all");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [orderActionLoading, setOrderActionLoading] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    imageUrl: "",
    websiteUrl: "",
    category: "Corporate Partner",
    description: "",
    displayInFrontend: true,
    order: 1,
  });

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "partners"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((d) => {
        const docData = d.data();
        const img = docData.imageUrl || docData.logoUrl || docData.image || docData.logo || "";
        return {
          id: d.id,
          name: docData.name || docData.title || "Unnamed Partner",
          imageUrl: img,
          logoUrl: img,
          websiteUrl: docData.websiteUrl || docData.website || docData.url || docData.link || "",
          category: docData.category || "Corporate Partner",
          description: docData.description || "",
          displayInFrontend: docData.displayInFrontend !== undefined ? Boolean(docData.displayInFrontend) : true,
          order: typeof docData.order === "number" ? docData.order : (typeof docData.position === "number" ? docData.position : undefined),
          position: typeof docData.position === "number" ? docData.position : docData.order,
          createdAt: docData.createdAt || 0,
        } as Partner;
      });

      // Sort by order/position ascending, then by createdAt desc
      data.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      setPartners(data);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching partners:", err);
      setError(err.message || "Failed to load partners. Check database permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  // Unique categories list including custom ones
  const availableCategories = useMemo(() => {
    const set = new Set<string>(PARTNER_CATEGORIES);
    partners.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set);
  }, [partners]);

  // Filtered partners
  const filteredPartners = useMemo(() => {
    return partners.filter((partner) => {
      if (categoryFilter !== "All" && partner.category !== categoryFilter) return false;
      if (statusFilter === "visible" && partner.displayInFrontend === false) return false;
      if (statusFilter === "hidden" && partner.displayInFrontend !== false) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (partner.name || "").toLowerCase().includes(q);
        const matchCat = (partner.category || "").toLowerCase().includes(q);
        const matchDesc = (partner.description || "").toLowerCase().includes(q);
        const matchWeb = (partner.websiteUrl || "").toLowerCase().includes(q);
        const matchImg = (partner.imageUrl || "").toLowerCase().includes(q);
        return matchName || matchCat || matchDesc || matchWeb || matchImg;
      }
      return true;
    });
  }, [partners, categoryFilter, statusFilter, searchQuery]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleIds = filteredPartners.map((p) => p.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Persist order to Firestore
  const persistOrder = async (updatedList: Partner[]) => {
    setIsReordering(true);
    try {
      const batch = writeBatch(db);
      const normalizedList = updatedList.map((partner, index) => {
        const newOrder = index + 1;
        batch.update(doc(db, "partners", partner.id), {
          order: newOrder,
          position: newOrder,
        });
        return { ...partner, order: newOrder, position: newOrder };
      });
      await batch.commit();
      setPartners(normalizedList);
    } catch (err: any) {
      console.error("Error saving partner order:", err);
      alert("Failed to save order: " + err.message);
      fetchPartners();
    } finally {
      setIsReordering(false);
      setOrderActionLoading(null);
    }
  };

  const handleMovePartner = async (partnerId: string, direction: "up" | "down", e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isReordering) return;

    const currentIndex = partners.findIndex((p) => p.id === partnerId);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= partners.length) return;

    setOrderActionLoading(partnerId);

    const reordered = [...partners];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    await persistOrder(reordered);
  };

  const handleMoveToTop = async (partnerId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isReordering) return;

    const currentIndex = partners.findIndex((p) => p.id === partnerId);
    if (currentIndex <= 0) return;

    setOrderActionLoading(partnerId);

    const reordered = [...partners];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.unshift(moved);

    await persistOrder(reordered);
  };

  const handleMoveToBottom = async (partnerId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isReordering) return;

    const currentIndex = partners.findIndex((p) => p.id === partnerId);
    if (currentIndex === -1 || currentIndex === partners.length - 1) return;

    setOrderActionLoading(partnerId);

    const reordered = [...partners];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.push(moved);

    await persistOrder(reordered);
  };

  // Toggle Visibility in Frontend
  const handleToggleVisibility = async (partner: Partner, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newStatus = partner.displayInFrontend === false;
    try {
      await updateDoc(doc(db, "partners", partner.id), {
        displayInFrontend: newStatus,
        status: newStatus ? "published" : "draft",
      });
      setPartners((prev) =>
        prev.map((p) => (p.id === partner.id ? { ...p, displayInFrontend: newStatus } : p))
      );
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    }
  };

  // Open Quick Edit for Image Link
  const handleOpenQuickImageEdit = (partner: Partner, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setQuickImagePartner(partner);
    setQuickImageUrl(partner.imageUrl || partner.logoUrl || "");
    setIsQuickImageModalOpen(true);
  };

  // Save Quick Image Link
  const handleSaveQuickImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickImagePartner) return;

    setQuickImageSaving(true);
    try {
      const trimmedUrl = quickImageUrl.trim();
      await updateDoc(doc(db, "partners", quickImagePartner.id), {
        imageUrl: trimmedUrl,
        logoUrl: trimmedUrl,
        image: trimmedUrl,
        logo: trimmedUrl,
        updatedAt: Date.now(),
      });

      setPartners((prev) =>
        prev.map((p) =>
          p.id === quickImagePartner.id
            ? { ...p, imageUrl: trimmedUrl, logoUrl: trimmedUrl }
            : p
        )
      );

      setIsQuickImageModalOpen(false);
      setQuickImagePartner(null);
    } catch (err: any) {
      console.error("Error updating partner image:", err);
      alert("Failed to update image link: " + err.message);
    } finally {
      setQuickImageSaving(false);
    }
  };

  // Save Partner (Create or Full Edit)
  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const trimmedName = formData.name.trim();
      if (!trimmedName) {
        alert("Partner name is required.");
        return;
      }

      const payload = {
        name: trimmedName,
        imageUrl: formData.imageUrl.trim(),
        logoUrl: formData.imageUrl.trim(),
        image: formData.imageUrl.trim(),
        logo: formData.imageUrl.trim(),
        websiteUrl: formData.websiteUrl.trim(),
        category: formData.category,
        description: formData.description.trim(),
        displayInFrontend: formData.displayInFrontend,
        status: formData.displayInFrontend ? "published" : "draft",
        order: formData.order || partners.length + 1,
        position: formData.order || partners.length + 1,
      };

      if (editingPartner) {
        await updateDoc(doc(db, "partners", editingPartner.id), {
          ...payload,
          updatedAt: Date.now(),
        });
      } else {
        await addDoc(collection(db, "partners"), {
          ...payload,
          createdAt: Date.now(),
        });
      }

      setIsModalOpen(false);
      resetForm();
      fetchPartners();
    } catch (err: any) {
      console.error("Error saving partner:", err);
      alert(err.message || "Failed to save partner.");
    }
  };

  // Single Delete
  const handleDelete = async (partner: Partner, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(`Are you sure you want to delete partner "${partner.name}"?`)) return;

    try {
      await deleteDoc(doc(db, "partners", partner.id));
      setPartners((prev) => prev.filter((p) => p.id !== partner.id));
      setSelectedIds((prev) => prev.filter((id) => id !== partner.id));
    } catch (err: any) {
      console.error("Error deleting partner:", err);
      alert("Failed to delete partner: " + err.message);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.length} selected partner(s)?`)) return;

    setBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        batch.delete(doc(db, "partners", id));
      });
      await batch.commit();

      setPartners((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
      setSelectedIds([]);
      alert(`Deleted ${selectedIds.length} partner(s) successfully.`);
    } catch (err: any) {
      console.error("Bulk delete error:", err);
      alert("Failed to delete selected partners: " + err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk Visibility Change
  const handleBulkSetVisibility = async (visible: boolean) => {
    if (selectedIds.length === 0) return;
    setBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        batch.update(doc(db, "partners", id), {
          displayInFrontend: visible,
          status: visible ? "published" : "draft",
        });
      });
      await batch.commit();

      setPartners((prev) =>
        prev.map((p) => (selectedIds.includes(p.id) ? { ...p, displayInFrontend: visible } : p))
      );
      setSelectedIds([]);
    } catch (err: any) {
      alert("Failed to update visibility: " + err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (partner: Partner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name || "",
      imageUrl: partner.imageUrl || partner.logoUrl || "",
      websiteUrl: partner.websiteUrl || "",
      category: partner.category || "Corporate Partner",
      description: partner.description || "",
      displayInFrontend: partner.displayInFrontend !== false,
      order: partner.order || 1,
    });
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingPartner(null);
    setFormData({
      name: "",
      imageUrl: "",
      websiteUrl: "",
      category: "Corporate Partner",
      description: "",
      displayInFrontend: true,
      order: partners.length + 1,
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingPartner(null);
    setFormData({
      name: "",
      imageUrl: "",
      websiteUrl: "",
      category: "Corporate Partner",
      description: "",
      displayInFrontend: true,
      order: 1,
    });
  };

  // CSV Export
  const handleExportCSV = () => {
    if (partners.length === 0) {
      alert("No partners to export.");
      return;
    }
    const exportData = partners.map((p) => ({
      name: p.name,
      imageUrl: p.imageUrl || p.logoUrl || "",
      websiteUrl: p.websiteUrl || "",
      category: p.category || "",
      description: p.description || "",
      displayInFrontend: p.displayInFrontend !== false ? "true" : "false",
      order: p.order || 1,
    }));
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `partners_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Import
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          let count = 0;
          const batch = writeBatch(db);
          results.data.forEach((row: any, index: number) => {
            const name = (row.name || row.title || "").trim();
            if (!name) return;
            const img = (row.imageUrl || row.logoUrl || row.image || row.logo || "").trim();
            const newDocRef = doc(collection(db, "partners"));
            batch.set(newDocRef, {
              name,
              imageUrl: img,
              logoUrl: img,
              image: img,
              logo: img,
              websiteUrl: (row.websiteUrl || row.website || row.url || row.link || "").trim(),
              category: (row.category || "Corporate Partner").trim(),
              description: (row.description || "").trim(),
              displayInFrontend: row.displayInFrontend === "false" ? false : true,
              order: partners.length + index + 1,
              position: partners.length + index + 1,
              createdAt: Date.now() + index,
            });
            count++;
          });

          if (count > 0) {
            await batch.commit();
            alert(`Imported ${count} partners successfully!`);
            fetchPartners();
          } else {
            alert("No valid partner records found in CSV.");
          }
        } catch (err: any) {
          alert("Error importing CSV: " + err.message);
        }
      },
    });
    e.target.value = "";
  };

  return (
    <div className="flex flex-col h-full font-inter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-montserrat font-bold text-[#0F172A] tracking-tight">
                Partners
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Manage club sponsors, strategic collaborators, and partner organizations
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="cursor-pointer inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm">
            <Upload className="h-4 w-4 text-slate-500" />
            <span>Import CSV</span>
            <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </label>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export</span>
          </button>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 bg-[#F59E0B] hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-[0_10px_30px_rgba(245,158,11,0.25)] hover:scale-[1.02] transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add Partner</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl mb-4 text-sm shrink-0 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Control Bar (Search, Category Filter, Visibility Filter, Selection) */}
      <div className="bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl p-4 mb-4 shadow-sm shrink-0 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by partner name, category, website, or image URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-slate-800 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Category Dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-amber-500 cursor-pointer"
            >
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "All" ? "All Categories" : cat}
                </option>
              ))}
            </select>

            {/* Visibility Toggle */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="visible">Visible Only</option>
              <option value="hidden">Hidden Only</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions & Selection Toolbar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAllVisible}
              className="inline-flex items-center gap-1.5 font-bold hover:text-slate-900 transition-colors"
            >
              {filteredPartners.length > 0 &&
              filteredPartners.every((p) => selectedIds.includes(p.id)) ? (
                <CheckSquare className="w-4 h-4 text-amber-600" />
              ) : selectedIds.length > 0 ? (
                <MinusSquare className="w-4 h-4 text-amber-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {selectedIds.length > 0
                  ? `${selectedIds.length} Selected`
                  : `Select All (${filteredPartners.length})`}
              </span>
            </button>

            {selectedIds.length > 0 && (
              <button
                onClick={handleClearSelection}
                className="text-slate-400 hover:text-slate-600 underline font-medium"
              >
                Clear
              </button>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleBulkSetVisibility(true)}
                disabled={bulkActionLoading}
                className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-bold transition-all disabled:opacity-50"
              >
                <Eye className="w-3.5 h-3.5" /> Make Visible
              </button>
              <button
                onClick={() => handleBulkSetVisibility(false)}
                disabled={bulkActionLoading}
                className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-lg font-bold transition-all disabled:opacity-50"
              >
                <EyeOff className="w-3.5 h-3.5" /> Hide
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkActionLoading}
                className="inline-flex items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg font-bold transition-all disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedIds.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Partners List Container */}
      <div className="flex-1 overflow-y-auto pb-12 pr-1 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
            <div className="w-8 h-8 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
            <p className="text-sm font-medium">Loading partners directory...</p>
          </div>
        ) : filteredPartners.length === 0 ? (
          <div className="bg-white/50 backdrop-blur-md rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700 mb-1">No partners found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
              {searchQuery || categoryFilter !== "All" || statusFilter !== "all"
                ? "No partners match your current filters. Try changing or clearing filters."
                : "Your partners directory is currently empty. Click the button below to add your first partner or sponsor."}
            </p>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 bg-[#F59E0B] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-amber-600 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Partner
            </button>
          </div>
        ) : (
          filteredPartners.map((partner, index) => {
            const isSelected = selectedIds.includes(partner.id);
            const isFirst = index === 0;
            const isLast = index === filteredPartners.length - 1;
            const hasImg = Boolean(partner.imageUrl || partner.logoUrl);

            return (
              <div
                key={partner.id}
                className={`group relative bg-white/75 backdrop-blur-md border rounded-2xl p-4 transition-all duration-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm hover:shadow-md ${
                  isSelected
                    ? "border-amber-400 bg-amber-50/40 ring-1 ring-amber-400/50"
                    : "border-slate-200/80 hover:border-slate-300"
                }`}
              >
                {/* Left Section: Checkbox, Order Buttons, Logo, and Info */}
                <div className="flex items-start md:items-center gap-3.5 flex-1 min-w-0">
                  {/* Select Checkbox */}
                  <button
                    onClick={() => handleToggleSelect(partner.id)}
                    className="mt-1 md:mt-0 text-slate-400 hover:text-amber-600 transition-colors shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-amber-600" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>

                  {/* Reorder Buttons */}
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => handleMovePartner(partner.id, "up", e)}
                      disabled={isFirst || isReordering}
                      title="Move Up"
                      className="p-1 text-slate-400 hover:text-amber-600 disabled:opacity-20 hover:bg-slate-100 rounded transition-colors"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      {partner.order || index + 1}
                    </span>
                    <button
                      onClick={(e) => handleMovePartner(partner.id, "down", e)}
                      disabled={isLast || isReordering}
                      title="Move Down"
                      className="p-1 text-slate-400 hover:text-amber-600 disabled:opacity-20 hover:bg-slate-100 rounded transition-colors"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Partner Logo with Quick Edit overlay */}
                  <div className="relative group/logo w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 rounded-xl border border-slate-200/80 overflow-hidden shrink-0 flex items-center justify-center p-1 shadow-inner">
                    {hasImg ? (
                      <img
                        src={partner.imageUrl || partner.logoUrl}
                        alt={partner.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          // Fallback on broken image link
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <Building2 className="w-7 h-7 text-slate-300" />
                    )}

                    {/* Quick Image Edit button hover overlay */}
                    <button
                      onClick={(e) => handleOpenQuickImageEdit(partner, e)}
                      title="Edit Image Link"
                      className="absolute inset-0 bg-slate-900/70 text-white flex flex-col items-center justify-center gap-1 opacity-0 group-hover/logo:opacity-100 transition-opacity text-[10px] font-bold"
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span>Edit Link</span>
                    </button>
                  </div>

                  {/* Partner Details */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-slate-900 text-base sm:text-lg tracking-tight truncate">
                        {partner.name}
                      </h4>

                      {/* Category Badge */}
                      {partner.category && (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                          {partner.category}
                        </span>
                      )}

                      {/* Frontend Visibility Badge */}
                      <button
                        onClick={(e) => handleToggleVisibility(partner, e)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                          partner.displayInFrontend !== false
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                        }`}
                      >
                        {partner.displayInFrontend !== false ? (
                          <>
                            <Eye className="w-3 h-3" /> Live in Frontend
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3" /> Hidden (Draft)
                          </>
                        )}
                      </button>
                    </div>

                    {partner.description && (
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {partner.description}
                      </p>
                    )}

                    {/* Image URL link & Website link display */}
                    <div className="flex items-center gap-3 pt-0.5 text-xs text-slate-500 flex-wrap">
                      {partner.websiteUrl && (
                        <a
                          href={partner.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
                        >
                          <Globe className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[200px]">
                            {partner.websiteUrl.replace(/^https?:\/\//, "")}
                          </span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {/* Image link button */}
                      <button
                        onClick={(e) => handleOpenQuickImageEdit(partner, e)}
                        className="inline-flex items-center gap-1 text-slate-500 hover:text-amber-600 transition-colors font-mono text-[11px]"
                      >
                        <LinkIcon className="w-3 h-3 text-amber-500 shrink-0" />
                        <span className="truncate max-w-[220px]">
                          {partner.imageUrl || partner.logoUrl || "No image link set"}
                        </span>
                        <span className="text-[10px] font-sans font-bold text-amber-600 ml-1 underline">
                          (Change Image Link)
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 w-full md:w-auto justify-end">
                  {/* Jump Top/Bottom buttons */}
                  <div className="hidden lg:flex items-center gap-1 mr-2 border-r border-slate-200 pr-2">
                    <button
                      onClick={(e) => handleMoveToTop(partner.id, e)}
                      disabled={isFirst || isReordering}
                      title="Move to First Position"
                      className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <ArrowUpToLine className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleMoveToBottom(partner.id, e)}
                      disabled={isLast || isReordering}
                      title="Move to Last Position"
                      className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <ArrowDownToLine className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Edit Image Link quick button */}
                  <button
                    onClick={(e) => handleOpenQuickImageEdit(partner, e)}
                    className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Edit Image</span>
                  </button>

                  {/* Full Edit button */}
                  <button
                    onClick={() => openEditModal(partner)}
                    className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Edit</span>
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(partner, e)}
                    className="inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Edit Image Link Modal */}
      {isQuickImageModalOpen && quickImagePartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-montserrat text-slate-900">
                    Edit Image Link
                  </h3>
                  <p className="text-xs text-slate-500">{quickImagePartner.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsQuickImageModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickImage} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Image / Logo URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/logo.png"
                  value={quickImageUrl}
                  onChange={(e) => setQuickImageUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                />
              </div>

              {/* Preview Box */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Live Preview
                </label>
                <div className="h-32 bg-slate-50 rounded-2xl border border-dashed border-slate-300 flex items-center justify-center p-4 overflow-hidden">
                  {quickImageUrl ? (
                    <img
                      src={quickImageUrl}
                      alt="Partner Preview"
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="text-center text-slate-400 text-xs flex flex-col items-center gap-1">
                      <ImageIcon className="w-6 h-6" />
                      <span>Paste an image URL above to preview</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickImageModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickImageSaving}
                  className="flex-1 py-3 rounded-xl bg-[#F59E0B] text-white font-bold text-sm hover:bg-amber-600 shadow-[0_10px_20px_rgba(245,158,11,0.25)] transition-all disabled:opacity-50"
                >
                  {quickImageSaving ? "Updating..." : "Update Image Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Add / Edit Partner Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-100 my-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Handshake className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-montserrat text-slate-900">
                    {editingPartner ? "Edit Partner" : "Add New Partner"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Fill in the partner organization details below
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePartner} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Partner / Organization Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corporation, Tech Partner BD"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                />
              </div>

              {/* Image URL & Preview */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Logo / Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono text-xs"
                />

                {formData.imageUrl && (
                  <div className="mt-2 h-24 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex items-center justify-center p-2">
                    <img
                      src={formData.imageUrl}
                      alt="Logo Preview"
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Category & Website */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Category / Type
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 outline-none focus:border-amber-500 font-medium"
                  >
                    {PARTNER_CATEGORIES.filter((c) => c !== "All").map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Website URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://partnerwebsite.org"
                    value={formData.websiteUrl}
                    onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Description / Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Brief details about collaboration, sponsorship terms, or partner background..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              {/* Display in Frontend Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-xs font-bold text-slate-800">Display in Frontend</p>
                  <p className="text-[11px] text-slate-500">
                    Make this partner visible publicly on the website
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.displayInFrontend}
                    onChange={(e) =>
                      setFormData({ ...formData, displayInFrontend: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#F59E0B] text-white font-bold text-sm hover:bg-amber-600 shadow-[0_10px_20px_rgba(245,158,11,0.25)] transition-all"
                >
                  {editingPartner ? "Save Changes" : "Create Partner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
