"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
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

type Props = {
  cryo: string;
  onClose: () => void;
  onCreated: (year: string, cooldown: string) => Promise<void>;
};

const LINE_TYPE_LABELS: Record<string, string> = {
  control: "Control",
  readout_send: "Readout Send",
  readout_return: "Readout Return",
};

const LINE_TYPE_COLORS: Record<string, string> = {
  control: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  readout_send: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  readout_return: "text-amber-400 border-amber-400/30 bg-amber-400/10",
};

export function NewCooldownModal({ cryo, onClose, onCreated }: Props) {
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState<TemplatesInfo | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then(setTemplates)
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      cooldown_date: (fd.get("cooldown_date") as string) || null,
      operator: fd.get("operator") as string,
      purpose: fd.get("purpose") as string,
    };

    try {
      const res = await fetch(`/api/cryos/${cryo}/cooldowns/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed");
      }
      const data = await res.json();
      const parts = data.path.split("/");
      const cooldownName = parts.pop() || "cd001";
      const yearName = parts.pop() || new Date().getFullYear().toString();
      await onCreated(yearName, cooldownName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setCreating(false);
    }
  }

  return (
    <Modal title={`New Cooldown — ${cryo}`} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Cooldown info */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-semibold text-cryo-200 uppercase tracking-wider">Cooldown</span>
          </div>
          <label className="flex flex-col gap-1.5 mb-3">
            <span className="text-xs font-medium text-cryo-300">Date</span>
            <input name="cooldown_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" autoFocus />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-cryo-300">Operator</span>
              <input name="operator" placeholder="optional" className="input" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-cryo-300">Purpose</span>
              <input name="purpose" placeholder="optional" className="input" />
            </label>
          </div>
        </div>

        {/* Wiring Template preview */}
        {templates && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              <span className="text-xs font-semibold text-cryo-200 uppercase tracking-wider">Wiring Template</span>
              <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${
                templates.source === "repository"
                  ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
                  : "text-cryo-300 border-cryo-500/40 bg-cryo-600/50"
              }`}>
                {templates.source}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {templates.modules.map((mod) => (
                <div key={mod.name} className="rounded-lg border border-cryo-500/40 bg-cryo-800/40 px-3 py-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`stage-badge ${LINE_TYPE_COLORS[mod.line_type] || "text-cryo-300 border-cryo-500/40"}`}>
                      {LINE_TYPE_LABELS[mod.line_type] || mod.line_type}
                    </span>
                    <span className="text-xs font-mono text-cryo-300">{mod.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                    {mod.stages.map((stage) => (
                      <div key={stage.name} className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-cryo-400 font-medium">{stage.name}:</span>
                        <span className="text-cryo-200 font-mono">
                          {stage.components.join(", ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-cryo-400 mt-1.5">
              {templates.source === "repository"
                ? "Using templates from the data repository."
                : "Using built-in default templates."}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-cryo-500/30">
          <button type="button" onClick={onClose} className="btn">Cancel</button>
          <button type="submit" disabled={creating} className="btn-primary inline-flex items-center gap-1.5">
            {creating ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating...
              </>
            ) : (
              "Create Cooldown"
            )}
          </button>
        </div>
      </form>
      {error && <Toast message={error} type="error" onDone={() => setError("")} />}
    </Modal>
  );
}
