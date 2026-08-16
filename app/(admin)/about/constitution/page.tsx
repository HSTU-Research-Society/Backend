"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Save } from "lucide-react";

export default function ConstitutionPage() {
  const [contentMarkdown, setContentMarkdown] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchContent() {
      try {
        const docRef = doc(db, "pages_static", "constitution");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setContentMarkdown(docSnap.data().contentMarkdown || "");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchContent();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "pages_static", "constitution"), {
        contentMarkdown,
        updatedAt: Date.now()
      });
      alert("Constitution saved successfully!");
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col items-center shrink-0 mb-2">
        <h2 className="text-xl font-bold text-slate-900">Constitution</h2>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm shrink-0">
          Failed to load contentMarkdown: {error}
        </div>
      )}

      <div className="flex flex-col flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm p-4">
        {loading ? (
          <div className="flex items-center justify-center flex-1 text-gray-500">Loading editor...</div>
        ) : (
          <>
            <textarea
              className="flex-1 w-full resize-none outline-none border border-gray-200 rounded-lg p-4 font-mono text-sm"
              placeholder="Write constitution in Markdown format..."
              value={contentMarkdown}
              onChange={(e) => setContentMarkdown(e.target.value)}
            />
            <div className="mt-4 flex justify-end shrink-0">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-blue-600 px-6 py-2 rounded-lg text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Content"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
