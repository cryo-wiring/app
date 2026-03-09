"use client";

import { useState } from "react";
import type { CooldownBundle } from "@/types/cooldown";
import { Modal } from "@/components/ui/modal";
import { Toast } from "@/components/ui/toast";

type Props = {
  cryo: string;
  year: string;
  cooldown: string;
  metadata: CooldownBundle["metadata"];
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export function MetadataEditorModal({ cryo, year, cooldown, metadata, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/cryos/${cryo}/${year}/${cooldown}/metadata`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operator: fd.get("operator"),
          purpose: fd.get("purpose"),
          notes: fd.get("notes"),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      await onSaved();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit Metadata" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-cryo-300">Operator</span>
          <input name="operator" defaultValue={metadata.operator} className="input" placeholder="e.g. John" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-cryo-300">Purpose</span>
          <input name="purpose" defaultValue={metadata.purpose} className="input" placeholder="e.g. Qubit characterization" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-cryo-300">Notes</span>
          <textarea name="notes" rows={3} defaultValue={metadata.notes} className="input resize-none" placeholder="Additional notes..." />
        </label>
        <div className="flex justify-end gap-2 mt-1 pt-3 border-t border-cryo-500/30">
          <button type="button" onClick={onClose} className="btn">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-1.5">
            {saving ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </form>
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </Modal>
  );
}
