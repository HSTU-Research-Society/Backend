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
  writeBatch 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Trash2, 
  Edit2, 
  Plus, 
  Search, 
  CheckSquare, 
  Square, 
  MinusSquare, 
  Eye, 
  EyeOff, 
  Globe, 
  X, 
  FileText,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ArrowUpToLine,
  ArrowDownToLine,
  User,
  Tag,
  Clock,
  BookOpen,
  Sparkles,
  Layers
} from "lucide-react";

interface BlogPost {
  id: string;
  title: string;
  slug?: string;
  author?: string;
  authorName?: string;
  authorRole?: string;
  authorImageUrl?: string;
  category?: string;
  tags?: string[];
  readTime?: string;
  excerpt?: string;
  descriptionMarkdown: string;
  content?: string;
  coverImageUrl: string;
  displayInFrontend?: boolean;
  status?: "published" | "draft";
  order?: number;
  position?: number;
  createdAt: number;
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "visible" | "hidden">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [orderActionLoading, setOrderActionLoading] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    authorName: "",
    authorRole: "",
    authorImageUrl: "",
    category: "General",
    tags: "",
    readTime: "",
    excerpt: "",
    coverImageUrl: "",
    descriptionMarkdown: "",
    displayInFrontend: true,
    order: 1,
  });

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "blogs"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => {
        const docData = d.data();
        const authorStr = docData.authorName || docData.author || "CE Club HSTU";
        return {
          id: d.id,
          title: docData.title || "",
          slug: docData.slug || "",
          author: authorStr,
          authorName: authorStr,
          authorRole: docData.authorRole || "",
          authorImageUrl: docData.authorImageUrl || "",
          category: docData.category || "General",
          tags: Array.isArray(docData.tags) ? docData.tags : (docData.tags ? [docData.tags] : []),
          readTime: docData.readTime || "",
          excerpt: docData.excerpt || docData.summary || "",
          descriptionMarkdown: docData.descriptionMarkdown || docData.content || "",
          content: docData.content || docData.descriptionMarkdown || "",
          coverImageUrl: docData.coverImageUrl || docData.imageUrl || "",
          displayInFrontend: docData.displayInFrontend !== undefined ? Boolean(docData.displayInFrontend) : true,
          status: docData.status || (docData.displayInFrontend === false ? "draft" : "published"),
          order: typeof docData.order === "number" ? docData.order : (typeof docData.position === "number" ? docData.position : undefined),
          position: typeof docData.position === "number" ? docData.position : docData.order,
          createdAt: docData.createdAt || 0,
        } as BlogPost;
      });

      // Sort by order ascending if specified, then createdAt descending
      data.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      setPosts(data);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching blogs:", err);
      setError(err.message || "Failed to load blogs. Check database permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Unique categories list
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach(p => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set);
  }, [posts]);

  // Persist reordered array to Firestore
  const persistOrder = async (updatedPosts: BlogPost[]) => {
    setIsReordering(true);
    try {
      const batch = writeBatch(db);
      updatedPosts.forEach((post, index) => {
        const newOrder = index + 1;
        batch.update(doc(db, "blogs", post.id), { 
          order: newOrder,
          position: newOrder 
        });
      });
      await batch.commit();
    } catch (err: any) {
      console.error("Error saving post order to Firestore:", err);
      alert("Failed to save new order to database: " + err.message);
      fetchPosts(); // Rollback
    } finally {
      setIsReordering(false);
      setOrderActionLoading(null);
    }
  };

  // Move a post up or down by 1 position
  const handleMovePost = async (postId: string, direction: "up" | "down", e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isReordering) return;

    const currentIndex = posts.findIndex(p => p.id === postId);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= posts.length) return;

    setOrderActionLoading(postId);

    const reordered = [...posts];
    const [movedPost] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, movedPost);

    const normalized = reordered.map((p, idx) => ({ ...p, order: idx + 1, position: idx + 1 }));
    setPosts(normalized);

    await persistOrder(normalized);
  };

  // Move a post directly to Top (#1)
  const handleMoveToTop = async (postId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isReordering) return;

    const currentIndex = posts.findIndex(p => p.id === postId);
    if (currentIndex <= 0) return;

    setOrderActionLoading(postId);

    const reordered = [...posts];
    const [movedPost] = reordered.splice(currentIndex, 1);
    reordered.unshift(movedPost);

    const normalized = reordered.map((p, idx) => ({ ...p, order: idx + 1, position: idx + 1 }));
    setPosts(normalized);

    await persistOrder(normalized);
  };

  // Move a post directly to Bottom (Last #)
  const handleMoveToBottom = async (postId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isReordering) return;

    const currentIndex = posts.findIndex(p => p.id === postId);
    if (currentIndex === -1 || currentIndex === posts.length - 1) return;

    setOrderActionLoading(postId);

    const reordered = [...posts];
    const [movedPost] = reordered.splice(currentIndex, 1);
    reordered.push(movedPost);

    const normalized = reordered.map((p, idx) => ({ ...p, order: idx + 1, position: idx + 1 }));
    setPosts(normalized);

    await persistOrder(normalized);
  };

  // Set explicit custom position rank
  const handleSetCustomPosition = async (postId: string, targetRank: number) => {
    if (isNaN(targetRank) || targetRank < 1 || targetRank > posts.length) {
      alert(`Please enter a valid rank between 1 and ${posts.length}.`);
      return;
    }

    const currentIndex = posts.findIndex(p => p.id === postId);
    if (currentIndex === -1) return;
    const targetIndex = targetRank - 1;
    if (currentIndex === targetIndex) return;

    setOrderActionLoading(postId);

    const reordered = [...posts];
    const [movedPost] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, movedPost);

    const normalized = reordered.map((p, idx) => ({ ...p, order: idx + 1, position: idx + 1 }));
    setPosts(normalized);

    await persistOrder(normalized);
  };

  // Filtered posts
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        post.title.toLowerCase().includes(q) || 
        (post.authorName || post.author || "").toLowerCase().includes(q) ||
        (post.category || "").toLowerCase().includes(q) ||
        (post.descriptionMarkdown || "").toLowerCase().includes(q);
      
      const isVisible = post.displayInFrontend !== false;
      const matchStatus = 
        statusFilter === "all" || 
        (statusFilter === "visible" && isVisible) || 
        (statusFilter === "hidden" && !isVisible);

      const matchCategory = categoryFilter === "all" || post.category === categoryFilter;

      return matchSearch && matchStatus && matchCategory;
    });
  }, [posts, searchQuery, statusFilter, categoryFilter]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const visibleIds = useMemo(() => filteredPosts.map(p => p.id), [filteredPosts]);
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
  const handleToggleDisplay = async (post: BlogPost, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newDisplayState = !post.displayInFrontend;
    const newStatus = newDisplayState ? "published" : "draft";

    // Optimistic update
    setPosts(prev => prev.map(p => p.id === post.id ? { 
      ...p, 
      displayInFrontend: newDisplayState,
      status: newStatus
    } : p));

    try {
      await updateDoc(doc(db, "blogs", post.id), {
        displayInFrontend: newDisplayState,
        status: newStatus
      });
    } catch (err: any) {
      console.error("Error toggling display status:", err);
      alert("Failed to update frontend display status: " + err.message);
      fetchPosts(); // Rollback
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
        batch.update(doc(db, "blogs", id), {
          displayInFrontend: display,
          status: newStatus
        });
      });
      await batch.commit();

      // Optimistic update
      setPosts(prev => prev.map(p => selectedIds.includes(p.id) ? {
        ...p,
        displayInFrontend: display,
        status: newStatus
      } : p));

      alert(`${selectedIds.length} blog post(s) set to ${display ? "Display in Frontend" : "Hidden from Frontend"}.`);
    } catch (err: any) {
      console.error("Bulk toggle display error:", err);
      alert("Failed to update posts: " + err.message);
      fetchPosts();
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.length} blog post(s)?`)) return;

    setBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, "blogs", id));
      });
      await batch.commit();

      setPosts(prev => prev.filter(p => !selectedIds.includes(p.id)));
      setSelectedIds([]);
      alert(`Successfully deleted ${selectedIds.length} blog post(s).`);
    } catch (err: any) {
      console.error("Bulk delete error:", err);
      alert("Failed to delete blog posts: " + err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const rawTitle = formData.title.trim();
      const slug = rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const words = formData.descriptionMarkdown.trim().split(/\s+/).filter(Boolean).length;
      const computedReadTime = formData.readTime.trim() || `${Math.max(1, Math.ceil(words / 200))} min read`;
      const authorVal = formData.authorName.trim() || "CE Club HSTU";
      const categoryVal = formData.category.trim() || "General";
      const tagsArray = formData.tags
        ? formData.tags.split(",").map(t => t.trim()).filter(Boolean)
        : [];
      const excerptVal = formData.excerpt.trim() || 
        (formData.descriptionMarkdown.replace(/[#*`_\[\]]/g, "").slice(0, 160) + (formData.descriptionMarkdown.length > 160 ? "..." : ""));

      const finalOrder = typeof formData.order === "number" && !isNaN(formData.order) && formData.order > 0
        ? formData.order
        : (posts.length > 0 ? posts.length + 1 : 1);

      const payload: any = {
        title: rawTitle,
        slug: slug,
        author: authorVal,
        authorName: authorVal,
        authorRole: formData.authorRole.trim(),
        authorImageUrl: formData.authorImageUrl.trim(),
        category: categoryVal,
        tags: tagsArray,
        readTime: computedReadTime,
        excerpt: excerptVal,
        summary: excerptVal,
        descriptionMarkdown: formData.descriptionMarkdown.trim(),
        content: formData.descriptionMarkdown.trim(),
        bodyRichText: formData.descriptionMarkdown.trim(),
        coverImageUrl: formData.coverImageUrl.trim(),
        imageUrl: formData.coverImageUrl.trim(),
        displayInFrontend: formData.displayInFrontend,
        status: formData.displayInFrontend ? "published" : "draft",
        order: finalOrder,
        position: finalOrder,
        updatedAt: Date.now()
      };

      if (editingId) {
        await updateDoc(doc(db, "blogs", editingId), payload);
      } else {
        payload.createdAt = Date.now();
        payload.publishedAt = new Date().toISOString();
        await addDoc(collection(db, "blogs"), payload);
      }

      setIsModalOpen(false);
      resetForm();
      fetchPosts();
    } catch (err: any) {
      console.error("Error saving blog post:", err);
      alert(err.message || "Failed to save blog post. Check database permissions.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this blog post?")) return;
    try {
      await deleteDoc(doc(db, "blogs", id));
      setPosts(prev => prev.filter(p => p.id !== id));
      setSelectedIds(prev => prev.filter(item => item !== id));
    } catch (err: any) {
      console.error("Error deleting blog post:", err);
      alert(err.message || "Failed to delete blog post. Check database permissions.");
    }
  };

  const openEditModal = (post: BlogPost) => {
    const postIndex = posts.findIndex(p => p.id === post.id);
    setFormData({
      title: post.title || "",
      authorName: post.authorName || post.author || "",
      authorRole: post.authorRole || "",
      authorImageUrl: post.authorImageUrl || "",
      category: post.category || "General",
      tags: Array.isArray(post.tags) ? post.tags.join(", ") : (post.tags || ""),
      readTime: post.readTime || "",
      excerpt: post.excerpt || "",
      coverImageUrl: post.coverImageUrl || "",
      descriptionMarkdown: post.descriptionMarkdown || post.content || "",
      displayInFrontend: post.displayInFrontend !== false,
      order: post.order !== undefined ? post.order : (postIndex !== -1 ? postIndex + 1 : 1),
    });
    setEditingId(post.id);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ 
      title: "", 
      authorName: "",
      authorRole: "",
      authorImageUrl: "",
      category: "General",
      tags: "",
      readTime: "",
      excerpt: "",
      coverImageUrl: "",
      descriptionMarkdown: "", 
      displayInFrontend: true,
      order: posts.length + 1
    });
    setEditingId(null);
  };

  return (
    <div className="flex flex-col font-inter space-y-6 pb-28">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold font-montserrat text-[#0F172A] tracking-tight">
              Blog & Articles
            </h2>
            <span className="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-700 rounded-full border border-blue-100">
              {posts.length} Posts
            </span>
            {isReordering && (
              <span className="px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-700 rounded-full border border-amber-200 animate-pulse flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 animate-spin" /> Saving Order...
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Publish club articles, author bios, research updates, reorder positions, and control live visibility.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {posts.length > 1 && (
            <button
              onClick={() => setIsReorderModalOpen(true)}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-3 rounded-[16px] text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all hover:scale-[1.02]"
              title="Open Order Organizer to rearrange all blog posts"
            >
              <ArrowUpDown className="h-4 w-4 text-blue-600" />
              Reorder Posts
            </button>
          )}

          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-[16px] text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.02] shrink-0"
          >
            <Plus className="h-4 w-4" />
            Add Blog Post
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl shrink-0 flex items-center gap-2 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 p-3 sm:p-4 rounded-[20px] shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Select All Toggle Checkbox */}
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
            title="Toggle Select All in Current View"
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

          {/* Search Input */}
          <div className="relative flex-1 min-w-[140px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, author name, category..."
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-4 py-2 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 self-start md:self-auto overflow-x-auto">
          {/* Category Filter */}
          {availableCategories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">All Categories</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All ({posts.length})
            </button>
            <button
              onClick={() => setStatusFilter("visible")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                statusFilter === "visible"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              <Eye className="w-3 h-3" />
              Live ({posts.filter(p => p.displayInFrontend !== false).length})
            </button>
            <button
              onClick={() => setStatusFilter("hidden")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                statusFilter === "hidden"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
            >
              <EyeOff className="w-3 h-3" />
              Hidden ({posts.filter(p => p.displayInFrontend === false).length})
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar (Floating when items are selected) */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
              {selectedIds.length}
            </span>
            <span className="text-xs font-bold text-slate-200">
              Selected Item{selectedIds.length > 1 ? "s" : ""}
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

      {/* Grid of Blog Posts */}
      <div className="space-y-6 pb-16">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm font-medium">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
            Loading blog posts...
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">No blog posts found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all" || categoryFilter !== "all"
                ? "Try adjusting your search query or filter." 
                : "Get started by publishing your first blog post with author details using the button above."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => {
              const isSelected = selectedIds.includes(post.id);
              const isLive = post.displayInFrontend !== false;
              const globalIndex = posts.findIndex(p => p.id === post.id);
              const displayOrder = post.order !== undefined ? post.order : (globalIndex + 1);
              const isFirst = globalIndex === 0;
              const isLast = globalIndex === posts.length - 1;
              const isMoving = orderActionLoading === post.id;
              const authorDisplayName = post.authorName || post.author || "CE Club HSTU";

              return (
                <div
                  key={post.id}
                  className={`bg-white/90 backdrop-blur-xl rounded-[24px] border transition-all duration-200 overflow-hidden flex flex-col group ${
                    isSelected 
                      ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md bg-blue-50/20" 
                      : "border-slate-200/80 hover:border-slate-300 shadow-xs hover:shadow-md"
                  }`}
                >
                  {/* Top Cover Image Area */}
                  <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                    {post.coverImageUrl ? (
                      <img 
                        src={post.coverImageUrl} 
                        alt={post.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1 bg-slate-100">
                        <FileText className="w-8 h-8 text-slate-300" />
                        <span className="text-[10px] font-bold tracking-wider uppercase">No Cover Image</span>
                      </div>
                    )}

                    {/* Top Left: Checkbox and Position Badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(post.id)}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-md backdrop-blur-md transition-all ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-white/90 text-slate-400 hover:text-slate-700 hover:bg-white"
                        }`}
                        title="Select post"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <span 
                        className="px-2.5 py-1 rounded-xl text-xs font-black tracking-wide bg-slate-900/85 text-white backdrop-blur-md shadow-md flex items-center gap-1 border border-white/20"
                        title={`Display Position #${displayOrder} in frontend`}
                      >
                        #{displayOrder}
                      </span>
                    </div>

                    {/* Top Right: Move Controls & Status Badge */}
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-xs flex items-center gap-1 ${
                        isLive
                          ? "bg-emerald-500/95 text-white"
                          : "bg-amber-500/95 text-white"
                      }`}>
                        {isLive ? <Globe className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {isLive ? "Live" : "Hidden"}
                      </span>

                      {/* Quick Move Up/Down Floating Pill */}
                      <div className="flex items-center bg-white/95 backdrop-blur-md rounded-xl p-0.5 shadow-md border border-slate-200/80">
                        <button
                          type="button"
                          disabled={isFirst || isReordering}
                          onClick={(e) => handleMovePost(post.id, "up", e)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                          title="Move post UP (changes frontend order)"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isLast || isReordering}
                          onClick={(e) => handleMovePost(post.id, "down", e)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                          title="Move post DOWN (changes frontend order)"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Category & Read Time Tags */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {post.category || "General"}
                        </span>
                        {post.readTime && (
                          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {post.readTime}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-base text-[#0F172A] line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {post.title}
                      </h3>

                      {/* Author Info Bar */}
                      <div className="mt-3 py-2 px-3 bg-slate-50/90 rounded-xl border border-slate-100 flex items-center gap-2.5">
                        {post.authorImageUrl ? (
                          <img 
                            src={post.authorImageUrl} 
                            alt={authorDisplayName} 
                            className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0" 
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {authorDisplayName}
                          </p>
                          {post.authorRole && (
                            <p className="text-[10px] text-slate-500 truncate">
                              {post.authorRole}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Excerpt / Summary */}
                      <p className="text-xs text-slate-500 mt-2.5 line-clamp-2 leading-relaxed">
                        {post.excerpt || post.descriptionMarkdown || "No preview snippet available."}
                      </p>
                    </div>

                    {/* Position / Move Controls & Display Toggle */}
                    <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-2.5">
                      {/* Position Ranking Toolbar */}
                      <div className="bg-slate-50/90 p-2 rounded-xl border border-slate-200/70 flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-600">Pos:</span>
                          <select
                            value={displayOrder}
                            disabled={isReordering}
                            onChange={(e) => handleSetCustomPosition(post.id, Number(e.target.value))}
                            className="bg-white border border-slate-200 text-xs font-bold text-slate-800 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            title="Change position order"
                          >
                            {posts.map((_, idx) => (
                              <option key={idx + 1} value={idx + 1}>
                                #{idx + 1} {idx === 0 ? "(Top)" : idx === posts.length - 1 ? "(Last)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isFirst || isReordering}
                            onClick={(e) => handleMoveToTop(post.id, e)}
                            className="px-1.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-600 hover:text-blue-600 text-[10px] font-bold border border-slate-200/80 transition-colors disabled:opacity-40 flex items-center gap-0.5"
                            title="Move directly to Top (#1)"
                          >
                            <ArrowUpToLine className="w-3 h-3" /> Top
                          </button>
                          <button
                            type="button"
                            disabled={isFirst || isReordering}
                            onClick={(e) => handleMovePost(post.id, "up", e)}
                            className="p-1 text-slate-500 hover:text-blue-600 bg-white hover:bg-slate-100 rounded border border-slate-200/80 transition-colors disabled:opacity-40"
                            title="Move Up 1 position"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isLast || isReordering}
                            onClick={(e) => handleMovePost(post.id, "down", e)}
                            className="p-1 text-slate-500 hover:text-blue-600 bg-white hover:bg-slate-100 rounded border border-slate-200/80 transition-colors disabled:opacity-40"
                            title="Move Down 1 position"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isLast || isReordering}
                            onClick={(e) => handleMoveToBottom(post.id, e)}
                            className="px-1.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-600 hover:text-blue-600 text-[10px] font-bold border border-slate-200/80 transition-colors disabled:opacity-40 flex items-center gap-0.5"
                            title="Move directly to Bottom"
                          >
                            <ArrowDownToLine className="w-3 h-3" /> End
                          </button>
                        </div>
                      </div>

                      {/* Display in Frontend Move/Toggle Switch */}
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
                          onClick={(e) => handleToggleDisplay(post, e)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                            isLive ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                          title={isLive ? "Currently visible in frontend (click to hide)" : "Currently hidden from frontend (click to display)"}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                              isLive ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => openEditModal(post)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-1 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
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

      {/* Reorder Posts Organizer Modal */}
      {isReorderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[28px] p-6 sm:p-8 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold font-montserrat text-[#0F172A] flex items-center gap-2">
                  <ArrowUpDown className="w-5 h-5 text-blue-600" />
                  Reorder Blog Posts Sequence
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Adjust display hierarchy on the live site. Changes synchronize with database immediately.
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

            <div className="flex-1 overflow-y-auto py-4 space-y-2 pr-1">
              {posts.map((post, index) => {
                const isFirst = index === 0;
                const isLast = index === posts.length - 1;
                const authorDisplay = post.authorName || post.author || "CE Club";

                return (
                  <div
                    key={post.id}
                    className="flex items-center justify-between gap-3 p-3 bg-slate-50 hover:bg-blue-50/40 rounded-2xl border border-slate-200/80 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {post.title}
                        </p>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-blue-600">{authorDisplay}</span>
                          <span>•</span>
                          <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">{post.category || "General"}</span>
                          <span>•</span>
                          <span className={post.displayInFrontend !== false ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                            {post.displayInFrontend !== false ? "Live" : "Hidden"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={isFirst || isReordering}
                        onClick={() => handleMoveToTop(post.id)}
                        className="px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 rounded-xl transition-all disabled:opacity-30 flex items-center gap-1"
                        title="Move to Top"
                      >
                        <ArrowUpToLine className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Top</span>
                      </button>
                      <button
                        type="button"
                        disabled={isFirst || isReordering}
                        onClick={() => handleMovePost(post.id, "up")}
                        className="p-1.5 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 rounded-xl transition-all disabled:opacity-30"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast || isReordering}
                        onClick={() => handleMovePost(post.id, "down")}
                        className="p-1.5 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 rounded-xl transition-all disabled:opacity-30"
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast || isReordering}
                        onClick={() => handleMoveToBottom(post.id)}
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

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {isReordering ? "Saving updates to Firestore..." : "All positions synchronized with database."}
              </span>
              <button
                type="button"
                onClick={() => setIsReorderModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Blog Post Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[28px] p-6 sm:p-8 w-full max-w-3xl shadow-2xl my-8 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold font-montserrat text-[#0F172A]">
                  {editingId ? "Edit Blog Article" : "Create New Blog Article"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Connected directly with frontend repository data model.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrUpdate} className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Article Title *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Advancements in High-Performance Sustainable Concrete"
                  className="w-full rounded-[16px] border border-slate-200 bg-slate-50 p-3.5 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>

              {/* Author Information Section */}
              <div className="p-4 rounded-[20px] bg-blue-50/50 border border-blue-100/80 space-y-3.5">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-extrabold text-blue-900 uppercase tracking-wider">
                    Author Details
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Author Full Name *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Md. Shahjalal Ahmed / Dr. Tanvir"
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                      value={formData.authorName}
                      onChange={e => setFormData({...formData, authorName: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Author Role / Designation
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Research Lead, Batch '19 / Faculty"
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={formData.authorRole}
                      onChange={e => setFormData({...formData, authorRole: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Author Avatar / Image URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/author-avatar.jpg"
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.authorImageUrl}
                    onChange={e => setFormData({...formData, authorImageUrl: e.target.value})}
                  />
                </div>
              </div>

              {/* Category, Tags, Read Time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Category *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Structural, Geotech, Events"
                    className="w-full rounded-[16px] border border-slate-200 bg-slate-50 p-3 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Tags (Comma Separated)
                  </label>
                  <input
                    type="text"
                    placeholder="AutoCAD, Concrete, BIM, Thesis"
                    className="w-full rounded-[16px] border border-slate-200 bg-slate-50 p-3 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.tags}
                    onChange={e => setFormData({...formData, tags: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Read Time
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 5 min read (Auto if empty)"
                    className="w-full rounded-[16px] border border-slate-200 bg-slate-50 p-3 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.readTime}
                    onChange={e => setFormData({...formData, readTime: e.target.value})}
                  />
                </div>
              </div>

              {/* Cover Image URL */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Cover Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/cover.jpg"
                  className="w-full rounded-[16px] border border-slate-200 bg-slate-50 p-3.5 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={formData.coverImageUrl}
                  onChange={e => setFormData({...formData, coverImageUrl: e.target.value})}
                />
              </div>

              {/* Short Excerpt */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Short Excerpt / Summary (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Brief preview sentence for the card..."
                  className="w-full rounded-[16px] border border-slate-200 bg-slate-50 p-3 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={formData.excerpt}
                  onChange={e => setFormData({...formData, excerpt: e.target.value})}
                />
              </div>

              {/* Markdown Content */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Content Body (Markdown Supported) *
                  </label>
                  <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Markdown Formatter
                  </span>
                </div>
                <textarea
                  required
                  rows={10}
                  className="w-full rounded-[16px] border border-slate-200 bg-slate-50 p-3.5 text-sm font-mono text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all leading-relaxed"
                  value={formData.descriptionMarkdown}
                  onChange={e => setFormData({...formData, descriptionMarkdown: e.target.value})}
                  placeholder="# Introduction&#10;&#10;Write the full article content here in markdown...&#10;&#10;## Key Findings&#10;- Point 1&#10;- Point 2"
                />
              </div>

              {/* Order Position in Form & Live Switch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-[20px] border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Display Sequence Rank (Order) *
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    #1 places this post at the very top of the live frontend.
                  </p>
                  <input
                    type="number"
                    min={1}
                    value={formData.order}
                    onChange={e => setFormData({ ...formData, order: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500"
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
                      Toggle public visibility on the live site.
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
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        formData.displayInFrontend ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 rounded-[16px] border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-[16px] bg-blue-600 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all hover:scale-[1.02]"
                >
                  {editingId ? "Save Article Changes" : "Publish Article to Frontend"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
