"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Save } from "lucide-react";

export default function FooterPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    address: "",
    email: "",
    phone: "",
    facebookUrl: "",
    linkedinUrl: "",
    youtubeUrl: "",
    instagramUrl: "",
  });

  useEffect(() => {
    async function fetchFooter() {
      try {
        const docRef = doc(db, "site_settings", "footer");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            address: data.address || "",
            email: data.email || "",
            phone: data.phone || "",
            facebookUrl: data.facebookUrl || "",
            linkedinUrl: data.linkedinUrl || "",
            youtubeUrl: data.youtubeUrl || "",
            instagramUrl: data.instagramUrl || "",
          });
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchFooter();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, "site_settings", "footer"), {
        ...formData,
        updatedAt: Date.now()
      });
      alert("Footer details saved successfully!");
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex flex-col items-center shrink-0 mb-6">
        <h2 className="text-xl font-bold text-slate-900">Footer details</h2>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-6 text-sm shrink-0 font-medium">
          Failed to load content: {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-gray-500 font-medium text-sm">Loading footer details...</div>
      ) : (
        <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm max-w-2xl mx-auto w-full p-6 sm:p-8">
          <div className="space-y-6">
            <div className="pb-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4">Contact Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Address Info</label>
                  <textarea
                    required
                    rows={2}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 border"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Email</label>
                    <input
                      type="email"
                      required
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 border"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Phone Info</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 border"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pb-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4">Social Media Links</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Facebook</label>
                  <input
                    type="url"
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 border"
                    value={formData.facebookUrl}
                    onChange={(e) => setFormData({ ...formData, facebookUrl: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">LinkedIn</label>
                  <input
                    type="url"
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 border"
                    value={formData.linkedinUrl}
                    onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">YouTube</label>
                  <input
                    type="url"
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 border"
                    value={formData.youtubeUrl}
                    onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Instagram</label>
                  <input
                    type="url"
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 border"
                    value={formData.instagramUrl}
                    onChange={(e) => setFormData({ ...formData, instagramUrl: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 bg-blue-600 px-6 py-2.5 rounded-lg text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save details"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
