"use client";

import { useState } from "react";
import type { LineDetail } from "@/api/models";
import { Modal } from "@/components/ui/modal";
import { Toast } from "@/components/ui/toast";

const STAGES = ["RT", "50K", "4K", "Still", "CP", "MXC"];

const STAGE_COLORS: Record<string, string> = {
  RT: "border-red-500/30 bg-red-500/5",
  "50K": "border-orange-500/30 bg-orange-500/5",
  "4K": "border-yellow-500/30 bg-yellow-500/5",
  Still: "border-emerald-500/30 bg-emerald-500/5",
  CP: "border-cyan-500/30 bg-cyan-500/5",
  MXC: "border-blue-500/30 bg-blue-500/5",
};

const STAGE_HEADER_COLORS: Record<string, string> = {
  RT: "bg-red-500/10 text-red-400",
  "50K": "bg-orange-500/10 text-orange-400",
  "4K": "bg-yellow-500/10 text-yellow-400",
  Still: "bg-emerald-500/10 text-emerald-400",
  CP: "bg-cyan-500/10 text-cyan-400",
  MXC: "bg-blue-500/10 text-blue-400",
};

type Props = {
  cryo: string;
  year: string;
  cooldown: string;
  fileType: string;
  line: LineDetail;
  catalog: Record<string, Record<string, unknown>>;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

type StageState = Record<string, string[]>;

function getCatalogInfo(catalog: Record<string, Record<string, unknown>>, key: string) {
  const entry = catalog[key];
  if (!entry) return null;
  return {
    type: entry.type as string,
    model: entry.model as string,
    value_dB: entry.value_dB as number | undefined,
    gain_dB: entry.gain_dB as number | undefined,
  };
}

export function LineEditorModal({ cryo, year, cooldown, fileType, line, catalog, onClose, onSaved }: Props) {
  const initial: StageState = {};
  STAGES.forEach((s) => {
    const comps = (line.stages as Record<string, Array<{ catalog_key?: string | null }>>)[s] ?? [];
    initial[s] = comps.map((c) => c.catalog_key ?? "").filter(Boolean);
  });

  const [stages, setStages] = useState<StageState>(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const catalogKeys = Object.keys(catalog);

  function addComponent(stage: string, key: string) {
    setStages((prev) => ({
      ...prev,
      [stage]: [...(prev[stage] || []), key],
    }));
  }

  function removeComponent(stage: string, idx: number) {
    setStages((prev) => ({
      ...prev,
      [stage]: prev[stage].filter((_, i) => i !== idx),
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/cryos/${cryo}/${year}/${cooldown}/lines/${fileType}/${line.line_id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stages }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to save");
      }
      await onSaved();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit ${line.line_id}`} onClose={onClose} large>
      <div className="flex flex-col h-[calc(85vh-5rem)]">
        {/* Line info header */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-cryo-500/30 shrink-0">
          <div className="flex items-center gap-2 text-xs text-cryo-400">
            <span className="px-2 py-0.5 bg-cryo-600/60 rounded font-medium text-cryo-200">{fileType}</span>
            {line.qubits && <span>Qubits: {String(line.qubits)}</span>}
          </div>
        </div>

        {/* Stages - 2-column grid, fills available space */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {STAGES.map((stage) => {
              const keys = stages[stage] || [];
              const borderColor = STAGE_COLORS[stage] ?? "border-cryo-500/30";
              const headerColor = STAGE_HEADER_COLORS[stage] ?? "bg-cryo-600/40 text-cryo-300";
              return (
                <div key={stage} className={`border rounded-md overflow-hidden ${borderColor}`}>
                  <div className={`px-3 py-1.5 border-b border-inherit text-xs font-semibold flex items-center justify-between ${headerColor}`}>
                    <span>{stage}</span>
                    <span className="font-normal opacity-60">{keys.length} component{keys.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="px-3 py-2 flex flex-col gap-1.5 bg-cryo-800/40">
                    {keys.length === 0 && (
                      <span className="text-[11px] text-cryo-500 italic py-1">(no components)</span>
                    )}
                    {keys.map((key, idx) => {
                      const info = getCatalogInfo(catalog, key);
                      return (
                        <div key={idx} className="flex items-center justify-between bg-cryo-700/60 rounded-md px-2.5 py-1.5 group">
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium text-cryo-100 truncate">{key}</span>
                            {info && (
                              <span className="text-[11px] text-cryo-400 truncate">
                                {info.type}
                                {info.model && ` / ${info.model}`}
                                {info.value_dB != null && ` (${info.value_dB} dB)`}
                                {info.gain_dB != null && ` (${info.gain_dB} dB)`}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => removeComponent(stage, idx)}
                            className="w-5 h-5 rounded flex items-center justify-center text-cryo-500 hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                    <div className="flex gap-1.5 mt-0.5">
                      <select
                        id={`add-${stage}`}
                        className="flex-1 min-w-0 text-xs border border-cryo-500/40 rounded-md px-2 py-1.5 bg-cryo-900/60 text-cryo-200 focus:outline-none focus:border-accent/60"
                        defaultValue=""
                      >
                        <option value="">Add component...</option>
                        {catalogKeys.map((k) => {
                          const info = getCatalogInfo(catalog, k);
                          const label = info ? `${k} (${info.type})` : k;
                          return <option key={k} value={k}>{label}</option>;
                        })}
                      </select>
                      <button
                        onClick={() => {
                          const sel = document.getElementById(`add-${stage}`) as HTMLSelectElement;
                          if (sel.value) {
                            addComponent(stage, sel.value);
                            sel.value = "";
                          }
                        }}
                        className="px-2.5 py-1.5 text-xs border border-cryo-500/40 rounded-md hover:border-accent/40 hover:text-accent bg-cryo-900/60 transition font-medium text-cryo-200 shrink-0"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer - pinned to bottom */}
        <div className="flex justify-end gap-2 pt-3 mt-4 border-t border-cryo-500/30 shrink-0">
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary inline-flex items-center gap-1.5">
            {saving ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </Modal>
  );
}
