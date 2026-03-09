"use client";

import { useState } from "react";
import type { CooldownBundle } from "@/types/cooldown";
import type { LineDetail as LineDetailModel } from "@/api/models";
import { WiringDiagram } from "@/components/wiring-diagram";
import { SummaryTable } from "@/components/summary-table";
import { LineDetailBrowser } from "@/components/line-detail";
import { LineEditorModal } from "@/components/line-editor-modal";
import { MetadataEditorModal } from "@/components/metadata-editor-modal";
import { BulkLineEditor } from "@/components/bulk-line-editor";
import { Toast } from "@/components/ui/toast";

type Props = {
  cryo: string;
  year: string;
  cooldown: string;
  bundle: CooldownBundle;
  catalog: Record<string, Record<string, unknown>>;
  onRefresh: () => Promise<void>;
};

export function CooldownView({
  cryo,
  year,
  cooldown,
  bundle,
  catalog,
  onRefresh,
}: Props) {
  const [showMetaEdit, setShowMetaEdit] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [editingLine, setEditingLine] = useState<{ line: LineDetailModel; fileType: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const m = bundle.metadata;

  const metaTags = [
    m.cryo && { label: "Cryo", value: m.cryo },
    bundle.chip && { label: "Chip", value: `${bundle.chip.name} (${bundle.chip.num_qubits}Q)` },
    m.operator && { label: "Operator", value: m.operator },
    m.purpose && { label: "Purpose", value: m.purpose },
  ].filter(Boolean) as { label: string; value: string }[];

  async function handleEditLine(lineId: string, fileType: string) {
    const res = await fetch(`/api/cryos/${cryo}/${year}/${cooldown}/lines`);
    if (!res.ok) return;
    const linesData = await res.json();
    const sectionLines = linesData[fileType] || [];
    const lineDetail = sectionLines.find((l: LineDetailModel) => l.line_id === lineId);
    if (lineDetail) {
      setEditingLine({ line: lineDetail, fileType });
    }
  }

  return (
    <div style={{ animation: "slideUp 250ms ease-out" }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-cryo-400 mb-3">
        <span>{cryo}</span>
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
        <span>{year}</span>
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
        <span className="text-cryo-200 font-medium">{cooldown}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-cryo-50 font-mono">
              {m.cooldown_id}
              {m.date && <span className="text-cryo-300/60 font-normal text-xs sm:text-sm ml-2 sm:ml-3 font-sans">{m.date}</span>}
            </h2>
            {metaTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {metaTags.map((tag) => (
                  <span
                    key={tag.label}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cryo-600/60 border border-cryo-500/40 text-xs text-cryo-200"
                  >
                    <span className="font-medium text-cryo-100">{tag.label}</span>
                    <span className="text-cryo-300">{tag.value}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Action buttons */}
          <div className="flex gap-2 shrink-0 ml-4">
            <button onClick={() => setShowBulkEdit(true)} className="btn inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              Bulk Edit
            </button>
            <button onClick={() => setShowMetaEdit(true)} className="btn inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Metadata
            </button>
          </div>
        </div>
        {m.notes && (
          <div className="mt-4 flex items-start gap-2.5 text-sm text-cryo-200 bg-amber-500/5 rounded-xl px-4 py-3 border border-amber-500/20">
            <svg className="w-4 h-4 text-amber-400/70 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <span className="whitespace-pre-wrap text-amber-200/80">{m.notes}</span>
          </div>
        )}
      </div>

      {/* Wiring Diagram (client-side SVG, same as viewer) */}
      <div style={{ animation: "slideUp 250ms ease-out 100ms both" }}>
        <WiringDiagram data={bundle} />
      </div>

      {/* Summary tables */}
      {bundle.summary.sections.map((section, i) => (
        <div key={section.label} style={{ animation: `slideUp 250ms ease-out ${160 + i * 60}ms both` }}>
          <SummaryTable section={section} />
        </div>
      ))}

      {/* Line detail browser */}
      <div style={{ animation: `slideUp 250ms ease-out ${160 + bundle.summary.sections.length * 60}ms both` }}>
        <LineDetailBrowser data={bundle} onEditLine={handleEditLine} />
      </div>

      {/* Modals — rendered at CooldownView level (full-screen overlay) */}
      {editingLine && (
        <LineEditorModal
          cryo={cryo}
          year={year}
          cooldown={cooldown}
          fileType={editingLine.fileType}
          line={editingLine.line}
          catalog={catalog}
          onClose={() => setEditingLine(null)}
          onSaved={async () => {
            setEditingLine(null);
            setToast({ message: "Line updated", type: "success" });
            await onRefresh();
          }}
        />
      )}

      {showBulkEdit && (
        <BulkLineEditor
          cryo={cryo}
          year={year}
          cooldown={cooldown}
          bundle={bundle}
          catalog={catalog}
          onClose={() => setShowBulkEdit(false)}
          onSaved={async () => {
            setShowBulkEdit(false);
            setToast({ message: "Lines updated", type: "success" });
            await onRefresh();
          }}
        />
      )}

      {showMetaEdit && (
        <MetadataEditorModal
          cryo={cryo}
          year={year}
          cooldown={cooldown}
          metadata={m}
          onClose={() => setShowMetaEdit(false)}
          onSaved={async () => {
            setShowMetaEdit(false);
            setToast({ message: "Metadata updated", type: "success" });
            await onRefresh();
          }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
