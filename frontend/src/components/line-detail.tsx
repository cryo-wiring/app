"use client";

import { useState } from "react";
import type { CooldownBundle, ResolvedLine, ResolvedComponent } from "@/types/cooldown";

const STAGES = ["RT", "50K", "4K", "Still", "CP", "MXC"] as const;

const STAGE_STYLES: Record<string, { badge: string; bg: string; border: string }> = {
  RT:    { badge: "bg-red-500/15 text-red-400 border-red-500/30",         bg: "bg-red-500/5",     border: "border-red-500/15" },
  "50K": { badge: "bg-orange-500/15 text-orange-400 border-orange-500/30", bg: "bg-orange-500/5",  border: "border-orange-500/15" },
  "4K":  { badge: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30", bg: "bg-yellow-500/5",  border: "border-yellow-500/15" },
  Still: { badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", bg: "bg-emerald-500/5", border: "border-emerald-500/15" },
  CP:    { badge: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",       bg: "bg-cyan-500/5",    border: "border-cyan-500/15" },
  MXC:   { badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",       bg: "bg-blue-500/5",    border: "border-blue-500/15" },
};

const TYPE_LABELS: Record<string, string> = {
  attenuator: "ATT",
  filter: "FLT",
  isolator: "ISO",
  amplifier: "AMP",
};

function computeLineTotals(line: ResolvedLine) {
  let totalAtten = 0;
  let totalGain = 0;
  let compCount = 0;
  for (const stage of STAGES) {
    for (const c of line.stages[stage] ?? []) {
      compCount++;
      if (c.value_dB) totalAtten += c.value_dB;
      if (c.gain_dB) totalGain += c.gain_dB;
    }
  }
  return { totalAtten, totalGain, compCount };
}

function CompCard({ comp, index }: { comp: ResolvedComponent; index: number }) {
  return (
    <div className="flex items-start gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg bg-cryo-800/50 border border-cryo-500/20">
      <span className="text-[10px] text-cryo-500 font-mono mt-0.5 w-3 shrink-0">{index + 1}</span>
      <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-cryo-600/60 text-cryo-200 border border-cryo-500/30">
        {TYPE_LABELS[comp.type] ?? comp.type}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-xs font-medium text-cryo-100 truncate">
            {comp.summary_label || comp.model}
          </span>
          {comp.value_dB != null && (
            <span className="text-[10px] font-mono text-red-400/80 shrink-0">-{comp.value_dB} dB</span>
          )}
          {comp.gain_dB != null && (
            <span className="text-[10px] font-mono text-emerald-400/80 shrink-0">+{comp.gain_dB} dB</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          <span className="text-[11px] text-cryo-400">{comp.manufacturer}</span>
          <span className="text-[11px] text-cryo-500">{comp.model}</span>
          {comp.serial && (
            <span className="text-[10px] text-cryo-500/70 font-mono">#{comp.serial}</span>
          )}
          {comp.filter_type && (
            <span className="text-[10px] text-cryo-400/60 italic">{comp.filter_type}</span>
          )}
          {comp.amplifier_type && (
            <span className="text-[10px] text-cryo-400/60 italic">{comp.amplifier_type}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailPane({ line, onEdit }: { line: ResolvedLine; onEdit?: () => void }) {
  const totals = computeLineTotals(line);
  return (
    <div style={{ animation: "fadeIn 150ms ease-out" }}>
      {/* Line header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
          <span className="font-mono font-bold text-lg text-cryo-50">{line.line_id}</span>
          <span className="text-sm text-cryo-300">
            {line.qubit ?? line.qubits?.join(", ")}
          </span>
          {line.representative && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent/70 border border-accent/20">
              representative
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
          {totals.totalAtten > 0 && (
            <span className="text-red-400/80">
              Atten <span className="font-semibold">-{totals.totalAtten} dB</span>
            </span>
          )}
          {totals.totalGain > 0 && (
            <span className="text-emerald-400/80">
              Gain <span className="font-semibold">+{totals.totalGain} dB</span>
            </span>
          )}
          <span className="text-cryo-400">
            {totals.compCount} component{totals.compCount !== 1 ? "s" : ""}
          </span>
          {onEdit && (
            <button onClick={onEdit} className="btn inline-flex items-center gap-1 text-xs ml-2">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Stage sections */}
      <div className="space-y-3">
        {STAGES.map((stage) => {
          const comps = line.stages[stage] ?? [];
          const style = STAGE_STYLES[stage];
          return (
            <div key={stage} className={`rounded-lg border ${style.border} ${style.bg} overflow-hidden`}>
              <div className="flex items-center gap-2 px-3 py-1.5">
                <span className={`stage-badge ${style.badge}`}>
                  {stage}
                </span>
                <span className="text-[10px] text-cryo-500">
                  {comps.length === 0 ? "pass-through" : `${comps.length} component${comps.length !== 1 ? "s" : ""}`}
                </span>
              </div>
              {comps.length > 0 && (
                <div className="px-2 sm:px-3 pb-2 space-y-1.5">
                  {comps.map((c, i) => (
                    <CompCard key={i} comp={c} index={i} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Props = {
  data: CooldownBundle;
  onEditLine?: (lineId: string, fileType: string) => void;
};

export function LineDetailBrowser({ data, onEditLine }: Props) {
  const [selectedSection, setSelectedSection] = useState<string>("control");
  const [selectedLine, setSelectedLine] = useState<ResolvedLine | null>(null);

  const sections: { key: string; label: string; shortLabel: string; lines: ResolvedLine[] }[] = [
    { key: "control", label: "Control", shortLabel: "Ctrl", lines: data.control.lines },
    { key: "readout_send", label: "Readout Send", shortLabel: "RS", lines: data.readout_send.lines },
    { key: "readout_return", label: "Readout Return", shortLabel: "RR", lines: data.readout_return.lines },
  ];

  const currentSection = sections.find((s) => s.key === selectedSection)!;

  return (
    <div className="card mb-6 overflow-hidden">
      {/* Header with section toggle */}
      <div className="px-4 sm:px-5 py-3 border-b border-cryo-500/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-sm font-semibold text-cryo-100 tracking-wide">Line Detail</h3>
        <div className="flex gap-0.5 bg-cryo-900/50 rounded-lg p-0.5 border border-cryo-500/30">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => { setSelectedSection(s.key); setSelectedLine(null); }}
              className={`px-2 sm:px-3 py-1.5 text-xs rounded-md transition-all ${
                selectedSection === s.key
                  ? "bg-accent/15 text-accent font-medium border border-accent/20"
                  : "text-cryo-300 hover:text-cryo-100 border border-transparent"
              }`}
            >
              <span className="sm:hidden">{s.shortLabel}</span>
              <span className="hidden sm:inline">{s.label}</span>
              <span className={`ml-1 ${selectedSection === s.key ? "text-accent/60" : "text-cryo-400"}`}>
                {s.lines.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Mobile: line selector as horizontal tabs */}
      <div className="md:hidden">
        <div className="flex overflow-x-auto border-b border-cryo-500/20 gap-0">
          {currentSection.lines.map((line) => {
            const active = selectedLine?.line_id === line.line_id;
            return (
              <button
                key={line.line_id}
                onClick={() => setSelectedLine(line)}
                className={`shrink-0 px-3 py-2 text-xs border-b-2 transition-colors ${
                  active
                    ? "border-b-accent text-accent bg-accent/5"
                    : "border-b-transparent text-cryo-300 hover:text-cryo-100"
                }`}
              >
                <span className="font-mono font-semibold">{line.line_id}</span>
              </button>
            );
          })}
        </div>
        <div className="p-4">
          {selectedLine ? (
            <DetailPane line={selectedLine} onEdit={onEditLine ? () => onEditLine(selectedLine.line_id, selectedSection) : undefined} />
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-cryo-400 gap-2">
              <span className="text-xs">Select a line above</span>
            </div>
          )}
        </div>
      </div>

      {/* Desktop: sidebar + detail side by side */}
      <div className="hidden md:flex">
        <div className="w-52 shrink-0 border-r border-cryo-500/30 max-h-[32rem] overflow-y-auto">
          {currentSection.lines.map((line) => {
            const active = selectedLine?.line_id === line.line_id;
            const lt = computeLineTotals(line);
            return (
              <button
                key={line.line_id}
                onClick={() => setSelectedLine(line)}
                className={`w-full text-left px-4 py-2.5 text-xs border-b border-cryo-500/15 last:border-0 transition-colors ${
                  active
                    ? "bg-accent/10 border-l-2 border-l-accent"
                    : "hover:bg-cryo-600/50 border-l-2 border-l-transparent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-mono font-semibold ${active ? "text-accent" : "text-cryo-100"}`}>
                    {line.line_id}
                  </span>
                  <span className="text-[10px] text-cryo-500 font-mono">
                    {lt.compCount}c
                  </span>
                </div>
                <div className="text-cryo-400 mt-0.5">
                  {line.qubit ?? line.qubits?.join(", ")}
                </div>
                {(lt.totalAtten > 0 || lt.totalGain > 0) && (
                  <div className="flex gap-2 mt-1">
                    {lt.totalAtten > 0 && (
                      <span className="text-[10px] font-mono text-red-400/60">-{lt.totalAtten}dB</span>
                    )}
                    {lt.totalGain > 0 && (
                      <span className="text-[10px] font-mono text-emerald-400/60">+{lt.totalGain}dB</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1 p-5 max-h-[32rem] overflow-y-auto">
          {selectedLine ? (
            <DetailPane line={selectedLine} onEdit={onEditLine ? () => onEditLine(selectedLine.line_id, selectedSection) : undefined} />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-cryo-400 gap-2">
              <svg className="w-8 h-8 text-cryo-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span className="text-xs">Select a line to view details</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
