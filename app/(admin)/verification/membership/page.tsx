"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, getDocs, setDoc, deleteDoc, doc, getDoc, addDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Papa from "papaparse";
import { 
  Trash2, 
  Edit2, 
  Plus, 
  Upload, 
  Download, 
  Search, 
  UserCheck, 
  GraduationCap, 
  Users, 
  Facebook, 
  Linkedin, 
  Mail, 
  CheckCircle2, 
  SlidersHorizontal, 
  RefreshCw, 
  Copy, 
  Calendar, 
  Sparkles,
  CheckSquare,
  Square,
  MinusSquare,
  X
} from "lucide-react";

interface Member {
  id: string;
  membershipId: string;
  name: string;
  batch: string;
  designation: string;
  photoUrl: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  email?: string;
  department?: string;
  issueDate: string;
  createdAt: number;
}

interface MembershipConfig {
  activeBatchStart: number;
  activeBatchEnd: number;
  academicYear?: string;
}

export default function MembershipPage() {
  const [items, setItems] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "alumni">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatchFilter, setSelectedBatchFilter] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Active membership batch rule (e.g. from Batch 20 to Batch 24)
  const [config, setConfig] = useState<MembershipConfig>({
    activeBatchStart: 20,
    activeBatchEnd: 24,
    academicYear: "2025-2026",
  });
  const [tempConfig, setTempConfig] = useState<MembershipConfig>({ ...config });

  const [formData, setFormData] = useState({
    membershipId: "",
    name: "",
    batch: "",
    designation: "General Member",
    photoUrl: "",
    facebookUrl: "",
    linkedinUrl: "",
    email: "",
    department: "Civil Engineering",
    issueDate: new Date().toISOString().split("T")[0],
  });

  const fetchConfig = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, "site_settings", "membership_config"));
      if (snap.exists()) {
        const data = snap.data() as MembershipConfig;
        const loadedConfig: MembershipConfig = {
          activeBatchStart: Number(data.activeBatchStart) || 20,
          activeBatchEnd: Number(data.activeBatchEnd) || 24,
          academicYear: data.academicYear || "2025-2026",
        };
        setConfig(loadedConfig);
        setTempConfig(loadedConfig);
      }
    } catch (e) {
      console.error("Error loading membership config:", e);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "memberships"));
      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          membershipId: data.membershipId || d.id,
          name: data.name || "",
          batch: data.batch ? String(data.batch) : "",
          designation: data.designation || "General Member",
          photoUrl: data.photoUrl || "",
          facebookUrl: data.facebookUrl || "",
          linkedinUrl: data.linkedinUrl || "",
          email: data.email || "",
          department: data.department || "Civil Engineering",
          issueDate: data.issueDate || "",
          createdAt: data.createdAt || 0,
        } as Member;
      });
      setItems(list.sort((a, b) => b.createdAt - a.createdAt));
    } catch (e) {
      console.error("Error fetching memberships:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchItems();
  }, [fetchConfig, fetchItems]);

  // Helper to determine if a member is automatically classified as Alumni based on batch range
  const isMemberAlumni = useCallback((member: Member): boolean => {
    const batchNum = parseInt(member.batch);
    if (!isNaN(batchNum)) {
      return batchNum < config.activeBatchStart;
    }
    return false;
  }, [config.activeBatchStart]);

  const isMemberActive = useCallback((member: Member): boolean => {
    const batchNum = parseInt(member.batch);
    if (!isNaN(batchNum)) {
      return batchNum >= config.activeBatchStart && batchNum <= config.activeBatchEnd;
    }
    return true;
  }, [config.activeBatchStart, config.activeBatchEnd]);

  // Filtered members
  const filteredMembers = useMemo(() => {
    return items.filter((member) => {
      // Tab filter
      if (activeTab === "active" && !isMemberActive(member)) return false;
      if (activeTab === "alumni" && !isMemberAlumni(member)) return false;

      // Batch filter
      if (selectedBatchFilter !== "all" && member.batch !== selectedBatchFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = member.name.toLowerCase().includes(q);
        const matchId = member.membershipId.toLowerCase().includes(q);
        const matchBatch = member.batch.toLowerCase().includes(q);
        const matchDesig = member.designation.toLowerCase().includes(q);
        const matchEmail = (member.email || "").toLowerCase().includes(q);
        return matchName || matchId || matchBatch || matchDesig || matchEmail;
      }
      return true;
    });
  }, [items, activeTab, selectedBatchFilter, searchQuery, isMemberActive, isMemberAlumni]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleIds = filteredMembers.map((m) => m.id);
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

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.length} selected member(s)?`)) return;

    setBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        batch.delete(doc(db, "memberships", id));
      });
      await batch.commit();

      setItems((prev) => prev.filter((m) => !selectedIds.includes(m.id)));
      setSelectedIds([]);
      alert(`Deleted ${selectedIds.length} member(s) successfully.`);
    } catch (err: any) {
      console.error("Bulk delete error:", err);
      alert("Failed to delete members: " + err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk Change Batch
  const handleBulkChangeBatch = async () => {
    if (selectedIds.length === 0) return;
    const targetBatch = prompt(`Enter new batch number for ${selectedIds.length} selected member(s):`);
    if (!targetBatch || !targetBatch.trim()) return;

    setBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      const trimmed = targetBatch.trim();
      selectedIds.forEach((id) => {
        batch.update(doc(db, "memberships", id), { batch: trimmed });
      });
      await batch.commit();

      setItems((prev) => prev.map((m) => (selectedIds.includes(m.id) ? { ...m, batch: trimmed } : m)));
      setSelectedIds([]);
      alert(`Updated batch for ${selectedIds.length} member(s) to Batch ${trimmed}.`);
    } catch (err: any) {
      console.error("Bulk update batch error:", err);
      alert("Failed to update batch: " + err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk sync selected to leadership alumni
  const handleBulkSyncSelectedToLeadership = async () => {
    if (selectedIds.length === 0) return;
    const selectedMembers = items.filter((m) => selectedIds.includes(m.id));
    if (!confirm(`Sync ${selectedMembers.length} selected member(s) to the Leadership Alumni directory?`)) return;

    setBulkActionLoading(true);
    try {
      const snap = await getDocs(collection(db, "leadership_members"));
      const existingNames = new Set(snap.docs.map((d) => (d.data().name || "").toLowerCase().trim()));

      let addedCount = 0;
      for (const m of selectedMembers) {
        if (!existingNames.has(m.name.toLowerCase().trim())) {
          await addDoc(collection(db, "leadership_members"), {
            name: m.name,
            batch: m.batch,
            designation: m.designation || "Alumni Member",
            photoUrl: m.photoUrl || "",
            facebookUrl: m.facebookUrl || "",
            linkedinUrl: m.linkedinUrl || "",
            email: m.email || "",
            type: "alumni",
            createdAt: Date.now(),
          });
          addedCount++;
        }
      }

      alert(`Sync Complete! Added ${addedCount} member(s) to Leadership Alumni.`);
    } catch (err: any) {
      alert("Error syncing to leadership: " + err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        activeBatchStart: Number(tempConfig.activeBatchStart),
        activeBatchEnd: Number(tempConfig.activeBatchEnd),
        academicYear: tempConfig.academicYear || "",
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, "site_settings", "membership_config"), payload);
      setConfig(tempConfig);
      setIsConfigOpen(false);
      alert("Active membership batch rules updated successfully! Members outside this range are now automatically recognized as alumni.");
    } catch (err: any) {
      alert("Failed to save config: " + err.message);
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = formData.membershipId.trim();
    if (!id) {
      alert("Membership ID is required.");
      return;
    }

    try {
      const now = Date.now();
      const existing = items.find((i) => i.id === editingId);
      const payload = {
        membershipId: id,
        name: formData.name.trim(),
        batch: formData.batch.trim(),
        designation: formData.designation.trim(),
        photoUrl: formData.photoUrl.trim(),
        facebookUrl: formData.facebookUrl.trim(),
        linkedinUrl: formData.linkedinUrl.trim(),
        email: formData.email.trim(),
        department: formData.department.trim(),
        issueDate: formData.issueDate,
        createdAt: existing ? existing.createdAt : now,
      };

      await setDoc(doc(db, "memberships", id), payload);
      setIsModalOpen(false);
      resetForm();
      fetchItems();
    } catch (err: any) {
      alert("Error saving member: " + err.message);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm(`Are you sure you want to delete member ID "${id}"?`)) return;
    try {
      await deleteDoc(doc(db, "memberships", id));
      setItems((prev) => prev.filter((m) => m.id !== id));
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    } catch (err: any) {
      alert("Error deleting member: " + err.message);
    }
  };

  const openEditModal = (member: Member) => {
    setFormData({
      membershipId: member.membershipId || member.id,
      name: member.name || "",
      batch: member.batch || "",
      designation: member.designation || "General Member",
      photoUrl: member.photoUrl || "",
      facebookUrl: member.facebookUrl || "",
      linkedinUrl: member.linkedinUrl || "",
      email: member.email || "",
      department: member.department || "Civil Engineering",
      issueDate: member.issueDate || new Date().toISOString().split("T")[0],
    });
    setEditingId(member.id);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      membershipId: "",
      name: "",
      batch: "",
      designation: "General Member",
      photoUrl: "",
      facebookUrl: "",
      linkedinUrl: "",
      email: "",
      department: "Civil Engineering",
      issueDate: new Date().toISOString().split("T")[0],
    });
    setEditingId(null);
  };

  // Sync graduated alumni into leadership_members collection
  const handleAutoSyncToLeadershipAlumni = async () => {
    if (!confirm(`Auto-sync all graduated members (Batch < ${config.activeBatchStart}) into the Leadership Alumni database?`)) return;
    setSyncing(true);
    try {
      const alumniMembers = items.filter(isMemberAlumni);
      if (alumniMembers.length === 0) {
        alert("No members found with batch < " + config.activeBatchStart);
        setSyncing(false);
        return;
      }

      const snap = await getDocs(collection(db, "leadership_members"));
      const existingNames = new Set(snap.docs.map((d) => (d.data().name || "").toLowerCase().trim()));

      let addedCount = 0;
      for (const m of alumniMembers) {
        if (!existingNames.has(m.name.toLowerCase().trim())) {
          await addDoc(collection(db, "leadership_members"), {
            name: m.name,
            batch: m.batch,
            designation: m.designation || "Alumni Member",
            photoUrl: m.photoUrl || "",
            facebookUrl: m.facebookUrl || "",
            linkedinUrl: m.linkedinUrl || "",
            email: m.email || "",
            type: "alumni",
            createdAt: Date.now(),
          });
          addedCount++;
        }
      }

      alert(`Sync Complete! Successfully added ${addedCount} new alumni into the Leadership Alumni database.`);
    } catch (err: any) {
      alert("Error syncing alumni: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // CSV Bulk Upload
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
            const id = (row.membershipId || row.id || "").trim();
            if (!id) return null;
            count++;
            return setDoc(doc(db, "memberships", id), {
              membershipId: id,
              name: row.name || "",
              batch: row.batch ? String(row.batch) : "",
              designation: row.designation || "General Member",
              photoUrl: row.photoUrl || "",
              facebookUrl: row.facebookUrl || "",
              linkedinUrl: row.linkedinUrl || "",
              email: row.email || "",
              department: row.department || "Civil Engineering",
              issueDate: row.issueDate || new Date().toISOString().split("T")[0],
              createdAt: Date.now(),
            });
          });

          await Promise.all(promises.filter(Boolean));
          alert(`CSV Uploaded successfully! Imported ${count} members.`);
          fetchItems();
        } catch (err: any) {
          alert("Error uploading CSV: " + err.message);
        }
      },
      error: (err) => {
        alert("Failed to parse CSV file: " + err.message);
      },
    });
  };

  const handleDownloadTemplate = () => {
    const headers = "membershipId,name,batch,designation,photoUrl,facebookUrl,linkedinUrl,email,department,issueDate\n";
    const sample1 = "MEM-2024-001,Rahim Ahmed,21,General Member,https://picsum.photos/400,https://facebook.com,https://linkedin.com,rahim@example.com,Civil Engineering,2024-01-15\n";
    const sample2 = "MEM-2022-045,Sadia Islam,18,Former Executive,https://picsum.photos/400,https://facebook.com,https://linkedin.com,sadia@example.com,Civil Engineering,2022-03-10\n";
    
    const blob = new Blob([headers + sample1 + sample2], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "membership_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Unique batches for filter dropdown
  const uniqueBatches = useMemo(() => {
    const set = new Set<string>();
    items.forEach((m) => {
      if (m.batch) set.add(m.batch);
    });
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
      return b.localeCompare(a);
    });
  }, [items]);

  // Alumni grouped by batch (descending)
  const groupedAlumni = useMemo(() => {
    const alumni = filteredMembers.filter(isMemberAlumni);
    const grouped: Record<string, Member[]> = {};
    alumni.forEach((m) => {
      const b = m.batch || "Unknown Batch";
      if (!grouped[b]) grouped[b] = [];
      grouped[b].push(m);
    });

    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
      return b.localeCompare(a);
    });

    return { grouped, sortedKeys };
  }, [filteredMembers, isMemberAlumni]);

  const activeCount = items.filter(isMemberActive).length;
  const alumniCount = items.filter(isMemberAlumni).length;

  const allVisibleSelected = filteredMembers.length > 0 && filteredMembers.every((m) => selectedIds.includes(m.id));
  const someVisibleSelected = filteredMembers.some((m) => selectedIds.includes(m.id));

  return (
    <div className="flex flex-col font-inter space-y-6 pb-28">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-montserrat font-bold text-[#0F172A] tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-[#F59E0B]" />
            Membership Management
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Manage active club members, multi-select for batch actions, and automatically transition graduated batches.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsConfigOpen(true)}
            className="bg-white border border-slate-200 text-slate-700 px-4 h-12 rounded-[16px] font-semibold text-sm flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-all"
          >
            <SlidersHorizontal className="h-4 w-4 text-blue-600" />
            Batch Rules
          </button>

          <button
            onClick={handleDownloadTemplate}
            title="Download Sample CSV Template"
            className="bg-white border border-slate-200 text-slate-700 px-4 h-12 rounded-[16px] font-semibold text-sm flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-all"
          >
            <Download className="h-4 w-4 text-slate-500" />
            CSV Template
          </button>

          <label className="cursor-pointer bg-blue-600 text-white px-5 h-12 rounded-[16px] font-semibold text-sm flex items-center gap-2 hover:scale-[1.02] shadow-[0_10px_30px_rgba(37,99,235,0.25)] transition-all">
            <Upload className="h-4 w-4" /> Bulk Upload CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>

          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-[#F59E0B] text-white px-5 h-12 rounded-[16px] font-semibold text-sm flex items-center gap-2 hover:scale-[1.02] shadow-[0_10px_30px_rgba(245,158,11,0.25)] transition-all"
          >
            <Plus className="h-4 w-4" /> Add Member
          </button>
        </div>
      </div>

      {/* Batch Rule Banner */}
      <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-amber-50/80 border border-blue-100 rounded-[24px] p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-[#0F172A] text-base">Active Membership Batch Rule:</h4>
              <span className="bg-blue-600 text-white text-xs px-2.5 py-0.5 rounded-full font-bold">
                Batch {config.activeBatchStart} - {config.activeBatchEnd}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Members with <span className="font-bold text-indigo-700">Batch &lt; {config.activeBatchStart}</span> automatically graduate &amp; move to the <strong>Alumni Section</strong> batch-wise.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            onClick={handleAutoSyncToLeadershipAlumni}
            disabled={syncing}
            className="bg-white/80 hover:bg-white text-indigo-700 border border-indigo-200 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync to Leadership Alumni"}
          </button>
          <button
            onClick={() => setIsConfigOpen(true)}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 underline underline-offset-4"
          >
            Change Range
          </button>
        </div>
      </div>

      {/* Navigation Tabs & Search Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/70 backdrop-blur-xl border border-white/60 p-3 rounded-[24px] shadow-sm">
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === "all"
                ? "bg-[#0F172A] text-white shadow-md"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Users className="w-4 h-4" />
            All Members
            <span className="ml-1 bg-white/20 text-xs px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("active")}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === "active"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Active Members
            <span className="ml-1 bg-emerald-700/40 text-xs px-2 py-0.5 rounded-full">
              {activeCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("alumni")}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === "alumni"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Alumni (Auto Transitioned)
            <span className="ml-1 bg-indigo-700/40 text-xs px-2 py-0.5 rounded-full">
              {alumniCount}
            </span>
          </button>
        </div>

        {/* Search & Batch Dropdown */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, ID, batch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedBatchFilter}
            onChange={(e) => setSelectedBatchFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
          >
            <option value="all">All Batches</option>
            {uniqueBatches.map((b) => (
              <option key={b} value={b}>
                Batch {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Select All Toggle Bar */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSelectAllVisible}
            className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-xl bg-white/80 border border-slate-200 shadow-sm"
            title="Toggle Select All"
          >
            {allVisibleSelected ? (
              <CheckSquare className="w-4 h-4 text-blue-600" />
            ) : someVisibleSelected ? (
              <MinusSquare className="w-4 h-4 text-blue-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>{allVisibleSelected ? "Deselect All Visible" : "Select All Visible"}</span>
          </button>
          <span className="text-xs text-slate-400">
            ({filteredMembers.length} member{filteredMembers.length === 1 ? "" : "s"} visible)
          </span>
        </div>
      </div>

      {/* Sticky Bulk Action Floating Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-30 bg-[#0F172A] text-white p-4 rounded-[22px] shadow-[0_15px_40px_rgba(0,0,0,0.3)] flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="bg-[#F59E0B] text-slate-950 font-bold text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4" />
              {selectedIds.length} Selected
            </span>
            <button
              onClick={handleSelectAllVisible}
              className="text-xs text-slate-300 hover:text-white underline underline-offset-4"
            >
              {allVisibleSelected ? "Deselect Visible" : "Select All"}
            </button>
            <button
              onClick={handleClearSelection}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleBulkChangeBatch}
              disabled={bulkActionLoading}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
              Change Batch
            </button>

            <button
              onClick={handleBulkSyncSelectedToLeadership}
              disabled={bulkActionLoading}
              className="bg-indigo-600/90 hover:bg-indigo-600 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Sync to Alumni
            </button>

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

      {/* Member Cards Directory */}
      <div className="space-y-6 pb-16">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
            Loading member directory...
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-16 text-center bg-white/40 border border-dashed border-slate-300 rounded-[28px] p-8">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-700">No members found</h3>
            <p className="text-sm text-slate-500 mt-1">
              {searchQuery ? "Try changing your search keywords." : "Add a new member or upload a CSV to get started."}
            </p>
          </div>
        ) : activeTab === "alumni" ? (
          // Grouped Alumni View
          <div className="space-y-10">
            {groupedAlumni.sortedKeys.map((batchKey) => (
              <div key={batchKey} className="space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                  <h3 className="text-xl font-bold font-montserrat text-[#0F172A] flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-indigo-600" />
                    Batch {batchKey !== "Unknown Batch" ? batchKey : "Unspecified"}
                  </h3>
                  <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                    {groupedAlumni.grouped[batchKey].length} Alumni Members
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {groupedAlumni.grouped[batchKey].map((member) => (
                    <HorizontalMemberCard
                      key={member.id}
                      member={member}
                      isAlumni={true}
                      isSelected={selectedIds.includes(member.id)}
                      onToggleSelect={() => handleToggleSelect(member.id)}
                      copiedId={copiedId}
                      onCopyId={copyToClipboard}
                      onEdit={() => openEditModal(member)}
                      onDelete={() => handleDeleteMember(member.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Regular Horizontal Cards List
          <div className="grid grid-cols-1 gap-4">
            {filteredMembers.map((member) => {
              const alumni = isMemberAlumni(member);
              return (
                <HorizontalMemberCard
                  key={member.id}
                  member={member}
                  isAlumni={alumni}
                  isSelected={selectedIds.includes(member.id)}
                  onToggleSelect={() => handleToggleSelect(member.id)}
                  copiedId={copiedId}
                  onCopyId={copyToClipboard}
                  onEdit={() => openEditModal(member)}
                  onDelete={() => handleDeleteMember(member.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#020617]/50 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveMember}
            className="bg-white/95 backdrop-blur-3xl border border-white/40 p-8 rounded-[32px] w-full max-w-2xl shadow-[0_25px_60px_rgba(0,0,0,0.45)] my-8"
          >
            <h3 className="text-2xl font-bold font-montserrat tracking-tight mb-6 text-[#0F172A]">
              {editingId ? "Edit Member Details" : "Add New Member"}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Membership ID *
                  </label>
                  <input
                    required
                    disabled={!!editingId}
                    placeholder="e.g. MEM-2024-001"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono disabled:opacity-50"
                    value={formData.membershipId}
                    onChange={(e) => setFormData({ ...formData, membershipId: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Full Name *
                  </label>
                  <input
                    required
                    placeholder="Member full name"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Batch (Numeric) *
                  </label>
                  <input
                    required
                    type="number"
                    placeholder="e.g. 21"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                    value={formData.batch}
                    onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Designation / Role
                  </label>
                  <input
                    placeholder="e.g. General Member"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Issue Date
                  </label>
                  <input
                    required
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    value={formData.issueDate}
                    onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                  Photo URL
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={formData.photoUrl}
                  onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Facebook URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://facebook.com/..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all text-xs"
                    value={formData.facebookUrl}
                    onChange={(e) => setFormData({ ...formData, facebookUrl: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    LinkedIn URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://linkedin.com/in/..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all text-xs"
                    value={formData.linkedinUrl}
                    onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all text-xs"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Department
                  </label>
                  <input
                    placeholder="Civil Engineering"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all text-xs"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
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
                {editingId ? "Update Member" : "Save Member"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Batch Range Configuration Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#020617]/50 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveConfig}
            className="bg-white/95 backdrop-blur-3xl border border-white/40 p-8 rounded-[32px] w-full max-w-lg shadow-[0_25px_60px_rgba(0,0,0,0.45)] my-12"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <h3 className="text-2xl font-bold font-montserrat tracking-tight text-[#0F172A]">
                Batch Range Settings
              </h3>
            </div>

            <p className="text-sm text-slate-500 mb-6">
              Define the active batch range for ongoing university students. Any batch older than the starting batch will automatically be marked and grouped as Alumni.
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Active Batch From (Min) *
                  </label>
                  <input
                    required
                    type="number"
                    placeholder="e.g. 20"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-lg"
                    value={tempConfig.activeBatchStart}
                    onChange={(e) => setTempConfig({ ...tempConfig, activeBatchStart: parseInt(e.target.value) || 0 })}
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">Oldest active batch</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Active Batch To (Max) *
                  </label>
                  <input
                    required
                    type="number"
                    placeholder="e.g. 24"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-lg"
                    value={tempConfig.activeBatchEnd}
                    onChange={(e) => setTempConfig({ ...tempConfig, activeBatchEnd: parseInt(e.target.value) || 0 })}
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">Newest enrolled batch</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                  Academic Session / Note
                </label>
                <input
                  placeholder="e.g. 2025-2026"
                  className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-3.5 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  value={tempConfig.academicYear || ""}
                  onChange={(e) => setTempConfig({ ...tempConfig, academicYear: e.target.value })}
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                <p className="text-xs font-medium text-amber-800 leading-relaxed">
                  <strong>Automatic Transition Rule:</strong> All members with <strong>Batch &lt; {tempConfig.activeBatchStart}</strong> (e.g. Batch {tempConfig.activeBatchStart - 1}, {tempConfig.activeBatchStart - 2}...) will automatically move to the Alumni tab and qualify for Alumni status across the platform.
                </p>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="flex-1 h-14 rounded-[18px] bg-white border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 h-14 rounded-[18px] bg-blue-600 font-bold text-white shadow-[0_10px_40px_rgba(37,99,235,0.3)] hover:scale-[1.02] transition-all"
              >
                Apply Rule
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Horizontal Member Card Component
// ----------------------------------------------------------------------------
interface HorizontalMemberCardProps {
  member: Member;
  isAlumni: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  copiedId: string | null;
  onCopyId: (id: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function HorizontalMemberCard({
  member,
  isAlumni,
  isSelected,
  onToggleSelect,
  copiedId,
  onCopyId,
  onEdit,
  onDelete,
}: HorizontalMemberCardProps) {
  return (
    <div 
      onClick={onToggleSelect}
      className={`backdrop-blur-[24px] border rounded-[28px] p-6 transition-all duration-300 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 cursor-pointer ${
        isSelected 
          ? "bg-blue-50/85 border-blue-300 shadow-[0_15px_40px_rgba(37,99,235,0.12)]" 
          : "bg-white/65 hover:bg-white/90 border-white/40 shadow-[0_10px_35px_rgba(15,23,42,0.06)] hover:shadow-[0_20px_50px_rgba(15,23,42,0.12)]"
      }`}
    >
      {/* Left: Checkbox & Photo & Badge */}
      <div className="flex items-center gap-4 shrink-0">
        <div 
          className="p-1 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        >
          {isSelected ? (
            <CheckSquare className="w-5 h-5 text-blue-600" />
          ) : (
            <Square className="w-5 h-5 text-slate-300 hover:text-slate-500 transition-colors" />
          )}
        </div>

        <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 border-2 border-white shadow-md shrink-0 flex items-center justify-center">
          {member.photoUrl ? (
            <img
              src={member.photoUrl}
              alt={member.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center font-bold text-slate-600 text-xl font-montserrat">
              {member.name ? member.name.charAt(0).toUpperCase() : "M"}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
              Batch {member.batch || "N/A"}
            </span>

            {isAlumni ? (
              <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" /> Alumni (Graduated)
              </span>
            ) : (
              <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active Member
              </span>
            )}
          </div>

          <h3 className="font-bold text-xl font-montserrat text-[#0F172A] tracking-tight">
            {member.name}
          </h3>

          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mt-0.5">
            {member.designation} {member.department ? `• ${member.department}` : ""}
          </p>
        </div>
      </div>

      {/* Middle: ID, Date, Description & Socials */}
      <div 
        className="flex-1 min-w-0 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onCopyId(member.membershipId)}
            title="Click to copy ID"
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all"
          >
            ID: {member.membershipId}
            {copiedId === member.membershipId ? (
              <span className="text-emerald-600 text-[10px]">Copied!</span>
            ) : (
              <Copy className="w-3 h-3 text-slate-400" />
            )}
          </button>

          {member.issueDate && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Issued: {new Date(member.issueDate).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Social Links */}
        <div className="flex items-center gap-2 pt-1">
          {member.facebookUrl && (
            <a
              href={member.facebookUrl}
              target="_blank"
              rel="noreferrer"
              className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-colors shadow-sm"
              title="Facebook"
            >
              <Facebook className="w-3.5 h-3.5" />
            </a>
          )}
          {member.linkedinUrl && (
            <a
              href={member.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white flex items-center justify-center transition-colors shadow-sm"
              title="LinkedIn"
            >
              <Linkedin className="w-3.5 h-3.5" />
            </a>
          )}
          {member.email && (
            <a
              href={`mailto:${member.email}`}
              className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-800 hover:text-white flex items-center justify-center transition-colors shadow-sm"
              title={member.email}
            >
              <Mail className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div 
        className="flex items-center gap-2 border-t lg:border-t-0 border-slate-100 pt-4 lg:pt-0 shrink-0 w-full lg:w-auto justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onEdit}
          className="px-4 py-2.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm"
        >
          <Edit2 className="w-3.5 h-3.5" /> Edit
        </button>

        <button
          onClick={onDelete}
          className="px-4 py-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}
