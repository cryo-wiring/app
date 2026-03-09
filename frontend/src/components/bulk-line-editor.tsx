"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Toast } from "@/components/ui/toast";
import type { CooldownBundle, ResolvedLine } from "@/types/cooldown";

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

const SECTION_LABELS: Record<string, string> = {
  control: "Control",
  readout_send: "Readout Send",
  readout_return: "Readout Return",
};

type Props = {
  cryo: string;
  year: string;
  cooldown: string;
  bundle: CooldownBundle;
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

export function BulkLineEditor({ cryo, year, cooldown, bundle, catalog, onClose, onSaved }: Props) {
  const [section, setSection] = useState<string>("control");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [stages, setStages] = useState<StageState>(() => {
    const init: StageState = {};
    STAGES.forEach((s) => { init[s] = []; });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const catalogKeys = Object.keys(catalog);

  const sections: { key: string; lines: ResolvedLine[] }[] = [
    { key: "control", lines: bundle.control.lines },
    { key: "readout_send", lines: bundle.readout_send.lines },
    { key: "readout_return", lines: bundle.readout_return.lines },
  ];

  const currentLines = sections.find((s) => s.key === section)!.lines;

  function toggleLine(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(currentLines.map((l) => l.line_id)));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  // Load stages from a representative line
  function loadFromLine(line: ResolvedLine) {
    const loaded: StageState = {};
    STAGES.forEach((s) => {
      const comps = line.stages[s] ?? [];
      // Try to find catalog keys for resolved components
      loaded[s] = comps.map((c) => {
        for (const [key, val] of Object.entries(catalog)) {
          if ((val as Record<string, unknown>).model === c.model) return key;
        }
        return c.model;
      });
    });
    setStages(loaded);
  }

  function addComponent(stage: string, key: string) {
    setStages((prev) => ({ ...prev, [stage]: [...(prev[stage] || []), key] }));
  }

  function removeComponent(stage: string, idx: number) {
    setStages((prev) => ({ ...prev, [stage]: prev[stage].filter((_, i) => i !== idx) }));
  }

  async function handleApply() {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/cryos/${cryo}/${year}/${cooldown}/lines/${section}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            line_ids: Array.from(selectedIds),
            stages,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to save");
      }
      setToast({ message: `${selectedIds.size} lines updated`, type: "success" });
      setSelectedIds(new Set());
      await onSaved();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Bulk Edit Lines" onClose={onClose} large>
      <div className="flex flex-col h-[calc(85vh-5rem)]">
        {/* Section selector */}
        <div className="flex gap-0.5 bg-cryo-900/50 rounded-lg p-0.5 border border-cryo-500/30 mb-4 shrink-0">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => { setSection(s.key); setSelectedIds(new Set()); }}
              className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-all ${
                section === s.key
                  ? "bg-accent/15 text-accent font-medium border border-accent/20"
                  : "text-cryo-300 hover:text-cryo-100 border border-transparent"
              }`}
            >
              {SECTION_LABELS[s.key]}
              <span className={`ml-1 ${section === s.key ? "text-accent/60" : "text-cryo-400"}`}>
                {s.lines.length}
              </span>
            </button>
          ))}
        </div>

        {/* Main content area - fills remaining space */}
        <div className="flex gap-4 min-h-0 flex-1">
          {/* Left: line selector */}
          <div className="w-52 shrink-0 flex flex-col border border-cryo-500/30 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-cryo-500/30 bg-cryo-800/60 flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-cryo-200">Lines</span>
              <div className="flex gap-1">
                <button onClick={selectAll} className="text-[10px] text-accent hover:underline">All</button>
                <span className="text-cryo-500 text-[10px]">/</span>
                <button onClick={selectNone} className="text-[10px] text-cryo-400 hover:underline">None</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {currentLines.map((line) => {
                const checked = selectedIds.has(line.line_id);
                return (
                  <label
                    key={line.line_id}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-cryo-500/15 last:border-0 transition-colors ${
                      checked ? "bg-accent/5" : "hover:bg-cryo-600/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleLine(line.line_id)}
                      className="accent-[var(--color-accent)] w-3.5 h-3.5"
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs font-mono font-semibold ${checked ? "text-accent" : "text-cryo-100"}`}>
                        {line.line_id}
                      </span>
                      <span className="text-[10px] text-cryo-400 ml-1.5">
                        {line.qubit ?? line.qubits?.join(",")}
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); loadFromLine(line); }}
                      className="text-[10px] text-cryo-500 hover:text-accent transition shrink-0"
                      title="Load this line's config"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </button>
                  </label>
                );
              })}
            </div>
            <div className="px-3 py-1.5 border-t border-cryo-500/30 bg-cryo-800/60 shrink-0">
              <span className="text-[10px] text-cryo-400">
                {selectedIds.size} selected
              </span>
            </div>
          </div>

          {/* Right: stage editor - 2-column grid on wider screens */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            <p className="text-[11px] text-cryo-400 mb-2">
              Configure stages below, then apply to all selected lines.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
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
                        <span className="text-[11px] text-cryo-500 italic py-0.5">(no components)</span>
                      )}
                      {keys.map((key, idx) => {
                        const info = getCatalogInfo(catalog, key);
                        return (
                          <div key={idx} className="flex items-center justify-between bg-cryo-700/60 rounded-md px-2.5 py-1 group">
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-cryo-100 truncate">{key}</span>
                              {info && (
                                <span className="text-[10px] text-cryo-400 truncate">
                                  {info.type}
                                  {info.model && ` / ${info.model}`}
                                  {info.value_dB != null && ` (${info.value_dB} dB)`}
                                  {info.gain_dB != null && ` (${info.gain_dB} dB)`}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => removeComponent(stage, idx)}
                              className="w-4 h-4 rounded flex items-center justify-center text-cryo-500 hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                      <div className="flex gap-1.5 mt-0.5">
                        <select
                          id={`bulk-add-${stage}`}
                          className="flex-1 min-w-0 text-xs border border-cryo-500/40 rounded-md px-2 py-1 bg-cryo-900/60 text-cryo-200 focus:outline-none focus:border-accent/60"
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
                            const sel = document.getElementById(`bulk-add-${stage}`) as HTMLSelectElement;
                            if (sel.value) {
                              addComponent(stage, sel.value);
                              sel.value = "";
                            }
                          }}
                          className="px-2 py-1 text-xs border border-cryo-500/40 rounded-md hover:border-accent/40 hover:text-accent bg-cryo-900/60 transition font-medium text-cryo-200 shrink-0"
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
        </div>

        {/* Footer - pinned to bottom */}
        <div className="flex items-center justify-between pt-3 mt-4 border-t border-cryo-500/30 shrink-0">
          <span className="text-xs text-cryo-400">
            {selectedIds.size > 0
              ? `Apply to ${selectedIds.size} line${selectedIds.size !== 1 ? "s" : ""}`
              : "Select lines to apply changes"}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn">Cancel</button>
            <button
              onClick={handleApply}
              disabled={saving || selectedIds.size === 0}
              className="btn-primary inline-flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Applying...
                </>
              ) : (
                "Apply to Selected"
              )}
            </button>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </Modal>
  );
}
