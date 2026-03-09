"use client";

import { useEffect, useState, useCallback } from "react";
import type { CryoEntry } from "@/api/models";
import { NewCryoModal } from "@/components/new-cryo-modal";
import { NewCooldownModal } from "@/components/new-cooldown-modal";

type SyncInfo = {
  has_git: boolean;
  has_remote: boolean;
  unpushed_commits: number;
  branch: string;
};

type RepoInfo = {
  remote_url: string | null;
  local_path: string;
  has_git: boolean;
  ready: boolean;
};

type Props = {
  cryos: CryoEntry[];
  selected: { cryo: string; year: string; cooldown: string } | null;
  onSelect: (cryo: string, year: string, cooldown: string) => void;
  onRefresh: () => Promise<void>;
  repoInfo: RepoInfo;
  onRepoSetup: () => void;
  showTemplates?: boolean;
  onShowTemplates?: () => void;
};

export function Sidebar({ cryos, selected, onSelect, onRefresh, repoInfo, onRepoSetup, showTemplates, onShowTemplates }: Props) {
  const [showNew, setShowNew] = useState(false);
  const [addCooldownCryo, setAddCooldownCryo] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<SyncInfo | null>(null);

  const fetchSync = useCallback(async () => {
    try {
      const res = await fetch("/api/repo/sync");
      if (res.ok) setSyncInfo(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    if (!repoInfo.has_git) return;
    fetchSync();
    const id = setInterval(fetchSync, 30_000);
    return () => clearInterval(id);
  }, [repoInfo.has_git, fetchSync]);

  const repoName = repoInfo.remote_url
    ? repoInfo.remote_url.replace(/\.git$/, "").split("/").slice(-2).join("/")
    : repoInfo.local_path.split("/").pop() || "data";

  return (
    <aside className="w-64 min-w-64 h-screen border-r border-cryo-500/50 flex flex-col" style={{ backgroundColor: "rgba(22,28,40,0.95)" }}>
      {/* Brand */}
      <div className="px-4 pt-4 pb-3 border-b border-cryo-500/40">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="cryo-wiring"
            className="h-12 object-contain"
            style={{ clipPath: "inset(15% 10% 15% 10%)", margin: "-0.25rem 0" }}
          />
          <div>
            <h1 className="text-base font-bold text-cryo-50 tracking-tight">cryo-wiring</h1>
            <p className="text-[11px] text-cryo-400 mt-0.5">Wiring Configuration Manager</p>
          </div>
        </div>
      </div>

      {/* Repo info */}
      <button
        onClick={onRepoSetup}
        className="mx-3 mt-3 flex items-center gap-2 px-2.5 py-2 rounded-lg border border-cryo-500/30 hover:border-accent/40 hover:bg-accent-glow transition text-left group"
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${
          syncInfo && syncInfo.unpushed_commits > 0
            ? "bg-amber-400"
            : repoInfo.has_git ? "bg-emerald-400" : "bg-cryo-400"
        }`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-cryo-100 truncate">{repoName}</p>
          <p className="text-[10px] text-cryo-400 truncate">
            {syncInfo && syncInfo.unpushed_commits > 0
              ? `${syncInfo.unpushed_commits} unpushed commit${syncInfo.unpushed_commits !== 1 ? "s" : ""}`
              : repoInfo.has_git ? "Git connected" : "Local directory"}
          </p>
        </div>
        <svg className="w-3.5 h-3.5 text-cryo-400 group-hover:text-accent transition shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* New cryo button + Templates */}
      <div className="px-3 py-3 border-b border-cryo-500/30 flex flex-col gap-2">
        <button
          onClick={() => setShowNew(true)}
          className="w-full py-1.5 text-sm font-medium bg-accent-dim/20 text-accent border border-accent-dim/30 rounded-lg hover:bg-accent-dim/30 transition inline-flex items-center justify-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Cryo
        </button>
        {onShowTemplates && (
          <button
            onClick={onShowTemplates}
            className={`w-full py-1.5 text-sm font-medium border rounded-lg transition inline-flex items-center justify-center gap-1.5 ${
              showTemplates
                ? "bg-accent/10 text-accent border-accent/30"
                : "bg-cryo-600/40 text-cryo-300 border-cryo-500/30 hover:text-cryo-100 hover:bg-cryo-600/60"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            Templates
          </button>
        )}
      </div>

      {/* Tree navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {cryos.length === 0 && (
          <div className="px-4 py-8 text-center">
            <svg className="w-8 h-8 mx-auto mb-2 text-cryo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-xs text-cryo-400">No cryos found</p>
          </div>
        )}
        {cryos.map((entry) => (
          <CryoGroup
            key={entry.name}
            cryo={entry}
            selected={selected}
            onSelect={onSelect}
            onAddCooldown={() => setAddCooldownCryo(entry.name)}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-cryo-500/30 text-[10px] text-cryo-500">
        cryo-wiring v0.1
      </div>

      {showNew && (
        <NewCryoModal
          onClose={() => setShowNew(false)}
          onCreated={async (cryo, year, cooldown) => {
            setShowNew(false);
            await onRefresh();
            onSelect(cryo, year, cooldown);
          }}
        />
      )}

      {addCooldownCryo && (
        <NewCooldownModal
          cryo={addCooldownCryo}
          onClose={() => setAddCooldownCryo(null)}
          onCreated={async (year, cooldown) => {
            const f = addCooldownCryo;
            setAddCooldownCryo(null);
            await onRefresh();
            onSelect(f, year, cooldown);
          }}
        />
      )}
    </aside>
  );
}

function CryoGroup({
  cryo,
  selected,
  onSelect,
  onAddCooldown,
}: {
  cryo: CryoEntry;
  selected: { cryo: string; year: string; cooldown: string } | null;
  onSelect: (cryo: string, year: string, cooldown: string) => void;
  onAddCooldown: () => void;
}) {
  const [open, setOpen] = useState(true);
  const count = cryo.years.reduce((sum, yg) => sum + yg.cooldowns.length, 0);

  return (
    <div className="mb-0.5">
      <div className="flex items-center px-4 py-1.5 group">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 flex-1 text-left text-xs font-semibold text-cryo-300 uppercase tracking-wider hover:text-cryo-100"
        >
          <svg
            className={`w-3 h-3 text-cryo-400 transition-transform ${open ? "rotate-90" : ""}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
          <span className="flex-1">{cryo.name}</span>
          <span className="text-[10px] font-normal text-cryo-500 group-hover:text-cryo-400">{count}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onAddCooldown(); }}
          className="ml-1 w-5 h-5 rounded flex items-center justify-center text-cryo-400 hover:text-accent hover:bg-accent-glow transition"
          title="New cooldown"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="ml-3">
          {cryo.years.map((yg) => (
            <YearGroup key={yg.year} cryoName={cryo.name} yearGroup={yg} selected={selected} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

function YearGroup({
  cryoName,
  yearGroup,
  selected,
  onSelect,
}: {
  cryoName: string;
  yearGroup: { year: string; cooldowns: string[] };
  selected: { cryo: string; year: string; cooldown: string } | null;
  onSelect: (cryo: string, year: string, cooldown: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full text-left pl-4 pr-4 py-1 text-[11px] font-medium text-cryo-400 hover:text-cryo-200"
      >
        <svg
          className={`w-2.5 h-2.5 text-cryo-500 transition-transform ${open ? "rotate-90" : ""}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
        {yearGroup.year}
        <span className="text-[10px] text-cryo-500 ml-auto">{yearGroup.cooldowns.length}</span>
      </button>
      {open && yearGroup.cooldowns.map((cd) => {
        const isActive = selected?.cryo === cryoName && selected?.year === yearGroup.year && selected?.cooldown === cd;
        return (
          <button
            key={cd}
            onClick={() => onSelect(cryoName, yearGroup.year, cd)}
            className={`flex items-center gap-2 w-full text-left pl-8 pr-4 py-1.5 text-sm rounded-l-md transition ${
              isActive
                ? "bg-accent/10 text-accent font-medium border-r-2 border-accent"
                : "text-cryo-200 hover:bg-cryo-600/50 hover:text-cryo-50"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-accent" : "bg-cryo-500"}`} />
            {cd}
          </button>
        );
      })}
    </div>
  );
}
