"use client";

import type { BundleSummarySection } from "@/types/cooldown";

const STAGES = ["RT", "50K", "4K", "Still", "CP", "MXC"] as const;

const STAGE_STYLES: Record<string, { badge: string; cell: string }> = {
  RT:    { badge: "bg-red-500/15 text-red-400 border-red-500/30",     cell: "text-red-300/70" },
  "50K": { badge: "bg-orange-500/15 text-orange-400 border-orange-500/30", cell: "text-orange-300/70" },
  "4K":  { badge: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30", cell: "text-yellow-300/70" },
  Still: { badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", cell: "text-emerald-300/70" },
  CP:    { badge: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",   cell: "text-cyan-300/70" },
  MXC:   { badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",   cell: "text-blue-300/70" },
};

type Props = {
  section: BundleSummarySection;
};

export function SummaryTable({ section }: Props) {
  return (
    <div className="card mb-6 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-cryo-500/40">
        <h3 className="text-sm font-semibold text-cryo-100 tracking-wide">{section.label}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-cryo-500/30">
              <th className="text-left px-4 py-2.5 font-medium text-cryo-300 w-20">Line</th>
              <th className="text-left px-4 py-2.5 font-medium text-cryo-300 w-28">Qubit(s)</th>
              <th className="text-right px-4 py-2.5 font-medium text-cryo-300 w-20">Atten</th>
              <th className="text-right px-4 py-2.5 font-medium text-cryo-300 w-20">Gain</th>
              {STAGES.map((s) => (
                <th key={s} className="text-center px-2 py-2.5 font-medium text-cryo-300 min-w-[80px]">
                  <span className={`stage-badge ${STAGE_STYLES[s].badge}`}>
                    {s}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.lines.map((line, i) => (
              <tr
                key={line.line_id}
                className={`border-b border-cryo-500/15 last:border-0 hover:bg-accent-glow transition-colors ${
                  i % 2 === 1 ? "bg-cryo-800/30" : ""
                }`}
              >
                <td className="px-4 py-2.5 font-mono font-semibold text-cryo-100">{line.line_id}</td>
                <td className="px-4 py-2.5 text-cryo-300">{line.qubits}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-cryo-200 font-mono">
                  {line.total_atten ? `${line.total_atten.toFixed(0)} dB` : <span className="text-cryo-500">-</span>}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-cryo-200 font-mono">
                  {line.total_gain ? `${line.total_gain.toFixed(0)} dB` : <span className="text-cryo-500">-</span>}
                </td>
                {STAGES.map((stage) => {
                  const comps = line.stage_components[stage] ?? [];
                  return (
                    <td key={stage} className="px-2 py-2.5 text-center">
                      {comps.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {comps.map((c, j) => (
                            <span key={j} className={`truncate text-xs ${STAGE_STYLES[stage].cell}`}>{c}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-cryo-500/50">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
