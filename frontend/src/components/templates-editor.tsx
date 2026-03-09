"use client";

import { useEffect, useState } from "react";
import { Toast } from "@/components/ui/toast";

type ModuleStage = {
  name: string;
  components: string[];
};

type ModuleTemplate = {
  name: string;
  file: string;
  line_type: string;
  stages: ModuleStage[];
};

type TemplatesInfo = {
  source: string;
  modules: ModuleTemplate[];
};

const STAGE_COLORS: Record<string, { header: string; border: string; bg: string }> = {
  RT:    { header: "bg-red-500/10 text-red-400",     border: "border-red-500/30",     bg: "bg-red-500/5" },
  "50K": { header: "bg-orange-500/10 text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/5" },
  "4K":  { header: "bg-yellow-500/10 text-yellow-300", border: "border-yellow-500/30", bg: "bg-yellow-500/5" },
  Still: { header: "bg-emerald-500/10 text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/5" },
  CP:    { header: "bg-cyan-500/10 text-cyan-400",   border: "border-cyan-500/30",    bg: "bg-cyan-500/5" },
  MXC:   { header: "bg-blue-500/10 text-blue-400",   border: "border-blue-500/30",    bg: "bg-blue-500/5" },
};

const LINE_TYPE_LABELS: Record<string, string> = {
  control: "Control",
  readout_send: "Readout Send",
  readout_return: "Readout Return",
};

const LINE_TYPE_BADGE: Record<string, string> = {
  control: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  readout_send: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  readout_return: "text-amber-400 border-amber-400/30 bg-amber-400/10",
};

type Props = {
  catalog: Record<string, Record<string, unknown>>;
};

export function TemplatesEditor({ catalog }: Props) {
  const [templates, setTemplates] = useState<TemplatesInfo | null>(null);
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editStages, setEditStages] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const catalogKeys = Object.keys(catalog);

  async function fetchTemplates() {
    const res = await fetch("/api/templates");
    setTemplates(await res.json());
  }

  useEffect(() => {
    fetchTemplates();
  }, []);

  function startEdit(mod: ModuleTemplate) {
    const stages: Record<string, string[]> = {};
    mod.stages.forEach((s) => {
      stages[s.name] = [...s.components];
    });
    setEditStages(stages);
    setEditingModule(mod.file);
  }

  function cancelEdit() {
    setEditingModule(null);
    setEditStages({});
  }

  function addComponent(stage: string, key: string) {
    setEditStages((prev) => ({
      ...prev,
      [stage]: [...(prev[stage] || []), key],
    }));
  }

  function removeComponent(stage: string, idx: number) {
    setEditStages((prev) => ({
      ...prev,
      [stage]: prev[stage].filter((_, i) => i !== idx),
    }));
  }

  async function handleSave(filename: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${filename}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages: editStages }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to save");
      }
      setToast({ message: "Template saved", type: "success" });
      setEditingModule(null);
      await fetchTemplates();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (!templates) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin w-6 h-6 text-cryo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div style={{ animation: "slideUp 250ms ease-out" }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-xl font-bold tracking-tight text-cryo-50">Wiring Templates</h2>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
            templates.source === "repository"
              ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
              : "text-cryo-300 border-cryo-500/40 bg-cryo-600/50"
          }`}>
            {templates.source}
          </span>
        </div>
        <p className="text-sm text-cryo-400">
          {templates.source === "repository"
            ? "Edit the module templates used when creating new cooldowns."
            : "These are built-in default templates. Connect a data repository with a templates/ directory to customize."}
        </p>
      </div>

      {/* Module cards */}
      <div className="flex flex-col gap-5">
        {templates.modules.map((mod) => {
          const isEditing = editingModule === mod.file;
          return (
            <div key={mod.file} className="card overflow-hidden">
              {/* Module header */}
              <div className="px-5 py-3 border-b border-cryo-500/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`stage-badge ${LINE_TYPE_BADGE[mod.line_type] || "text-cryo-300 border-cryo-500/40"}`}>
                    {LINE_TYPE_LABELS[mod.line_type] || mod.line_type}
                  </span>
                  <span className="text-sm font-mono font-medium text-cryo-200">{mod.name}</span>
                  <span className="text-[10px] text-cryo-500">{mod.file}</span>
                </div>
                {!isEditing ? (
                  <button
                    onClick={() => startEdit(mod)}
                    className="btn inline-flex items-center gap-1.5 text-xs"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={cancelEdit} className="btn text-xs">Cancel</button>
                    <button
                      onClick={() => handleSave(mod.file)}
                      disabled={saving}
                      className="btn-primary text-xs inline-flex items-center gap-1.5"
                    >
                      {saving ? (
                        <>
                          <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Saving...
                        </>
                      ) : "Save"}
                    </button>
                  </div>
                )}
              </div>

              {/* Stages */}
              <div className="p-4 flex flex-col gap-3">
                {isEditing ? (
                  /* Edit mode */
                  Object.entries(editStages).map(([stageName, components]) => {
                    const colors = STAGE_COLORS[stageName] || { header: "bg-cryo-600/40 text-cryo-300", border: "border-cryo-500/30", bg: "bg-cryo-800/40" };
                    return (
                      <div key={stageName} className={`border rounded-md overflow-hidden ${colors.border}`}>
                        <div className={`px-3 py-1.5 border-b border-inherit text-xs font-semibold flex items-center justify-between ${colors.header}`}>
                          <span>{stageName}</span>
                          <span className="font-normal opacity-60">{components.length} component{components.length !== 1 ? "s" : ""}</span>
                        </div>
                        <div className={`px-3 py-2 flex flex-col gap-1.5 ${colors.bg}`}>
                          {components.length === 0 && (
                            <span className="text-[11px] text-cryo-500 italic py-1">(no components)</span>
                          )}
                          {components.map((key, idx) => {
                            const info = catalog[key];
                            return (
                              <div key={idx} className="flex items-center justify-between bg-cryo-700/60 rounded-md px-2.5 py-1.5 group">
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-cryo-100">{key}</span>
                                  {info && (
                                    <span className="text-[11px] text-cryo-400">
                                      {String(info.type || "")}
                                      {info.model ? ` / ${String(info.model)}` : ""}
                                      {info.value_dB != null && ` (${info.value_dB} dB)`}
                                      {info.gain_dB != null && ` (${info.gain_dB} dB)`}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => removeComponent(stageName, idx)}
                                  className="w-5 h-5 rounded flex items-center justify-center text-cryo-500 hover:text-red-400 hover:bg-red-500/10 transition"
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
                              id={`tmpl-add-${mod.file}-${stageName}`}
                              className="flex-1 text-xs border border-cryo-500/40 rounded-md px-2 py-1.5 bg-cryo-900/60 text-cryo-200 focus:outline-none focus:border-accent/60"
                              defaultValue=""
                            >
                              <option value="">Add component...</option>
                              {catalogKeys.map((k) => {
                                const ci = catalog[k];
                                const label = ci ? `${k} (${String(ci.type || "")})` : k;
                                return <option key={k} value={k}>{label}</option>;
                              })}
                            </select>
                            <button
                              onClick={() => {
                                const sel = document.getElementById(`tmpl-add-${mod.file}-${stageName}`) as HTMLSelectElement;
                                if (sel.value) {
                                  addComponent(stageName, sel.value);
                                  sel.value = "";
                                }
                              }}
                              className="px-2.5 py-1.5 text-xs border border-cryo-500/40 rounded-md hover:border-accent/40 hover:text-accent bg-cryo-900/60 transition font-medium text-cryo-200"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  /* Read-only mode */
                  mod.stages.map((stage) => {
                    const colors = STAGE_COLORS[stage.name] || { header: "bg-cryo-600/40 text-cryo-300", border: "border-cryo-500/30", bg: "bg-cryo-800/40" };
                    return (
                      <div key={stage.name} className={`border rounded-md overflow-hidden ${colors.border}`}>
                        <div className={`px-3 py-1.5 border-b border-inherit text-xs font-semibold flex items-center justify-between ${colors.header}`}>
                          <span>{stage.name}</span>
                          <span className="font-normal opacity-60">{stage.components.length} component{stage.components.length !== 1 ? "s" : ""}</span>
                        </div>
                        {stage.components.length > 0 && (
                          <div className={`px-3 py-2 flex flex-col gap-1 ${colors.bg}`}>
                            {stage.components.map((key, idx) => {
                              const info = catalog[key];
                              return (
                                <div key={idx} className="flex items-center gap-2 bg-cryo-700/40 rounded px-2.5 py-1.5">
                                  <span className="text-sm font-medium text-cryo-100">{key}</span>
                                  {info && (
                                    <span className="text-[11px] text-cryo-400">
                                      {String(info.type || "")}
                                      {info.model ? ` / ${String(info.model)}` : ""}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
