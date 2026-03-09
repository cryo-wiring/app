"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { CooldownView } from "@/components/cooldown-view";
import { RepoSetupModal } from "@/components/repo-setup-modal";
import { TemplatesEditor } from "@/components/templates-editor";
import type { CryoEntry } from "@/api/models";
import type { CooldownBundle } from "@/types/cooldown";

type RepoInfo = {
  remote_url: string | null;
  local_path: string;
  has_git: boolean;
  ready: boolean;
};

export default function Home() {
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [cryos, setCryos] = useState<CryoEntry[]>([]);
  const [selected, setSelected] = useState<{ cryo: string; year: string; cooldown: string } | null>(null);
  const [bundle, setBundle] = useState<CooldownBundle | null>(null);
  const [catalog, setCatalog] = useState<Record<string, Record<string, unknown>>>({});
  const [loading, setLoading] = useState(false);
  const [showRepoSetup, setShowRepoSetup] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const fetchRepoInfo = useCallback(async () => {
    const res = await fetch("/api/repo");
    const info: RepoInfo = await res.json();
    setRepoInfo(info);
    return info;
  }, []);

  const fetchCryos = useCallback(async () => {
    const res = await fetch("/api/cryos");
    setCryos(await res.json());
  }, []);

  const fetchAll = useCallback(async () => {
    const info = await fetchRepoInfo();
    if (info.ready) {
      await fetchCryos();
      fetch("/api/components").then((r) => r.json()).then(setCatalog);
    }
  }, [fetchRepoInfo, fetchCryos]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const selectCooldown = useCallback(async (cryo: string, year: string, cooldown: string) => {
    setShowTemplates(false);
    setSelected({ cryo, year, cooldown });
    setLoading(true);
    try {
      const data = await fetch(`/api/cryos/${cryo}/${year}/${cooldown}/bundle`).then((r) => r.json());
      setBundle(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (selected) {
      await selectCooldown(selected.cryo, selected.year, selected.cooldown);
    }
    await fetchCryos();
  }, [selected, selectCooldown, fetchCryos]);

  const handleRepoConnected = useCallback(async () => {
    setShowRepoSetup(false);
    setSelected(null);
    setBundle(null);
    await fetchAll();
  }, [fetchAll]);

  if (repoInfo === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <svg className="animate-spin w-8 h-8 text-cryo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!repoInfo.ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <SetupScreen onConnect={() => setShowRepoSetup(true)} />
        {showRepoSetup && (
          <RepoSetupModal
            onConnected={handleRepoConnected}
            onClose={() => setShowRepoSetup(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        cryos={cryos}
        selected={showTemplates ? null : selected}
        onSelect={selectCooldown}
        onRefresh={refresh}
        repoInfo={repoInfo}
        onRepoSetup={() => setShowRepoSetup(true)}
        showTemplates={showTemplates}
        onShowTemplates={() => { setShowTemplates(true); setSelected(null); setBundle(null); }}
      />
      <main className="flex-1 overflow-y-auto">
        {showTemplates ? (
          <div className="p-6 max-w-[1200px]">
            <TemplatesEditor catalog={catalog} />
          </div>
        ) : !selected ? (
          <EmptyState />
        ) : loading ? (
          <LoadingSkeleton />
        ) : bundle ? (
          <div className="p-6 max-w-[1200px]">
            <CooldownView
              cryo={selected.cryo}
              year={selected.year}
              cooldown={selected.cooldown}
              bundle={bundle}
              catalog={catalog}
              onRefresh={refresh}
            />
          </div>
        ) : null}
      </main>

      {showRepoSetup && (
        <RepoSetupModal
          currentUrl={repoInfo.remote_url ?? undefined}
          onConnected={handleRepoConnected}
          onClose={() => setShowRepoSetup(false)}
        />
      )}
    </div>
  );
}

function SetupScreen({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center text-center max-w-md">
      <img
        src="/logo.png"
        alt="cryowire"
        className="w-20 h-20 object-contain mb-4"
        style={{ clipPath: "inset(15% 10% 15% 10%)" }}
      />
      <h1 className="text-xl font-bold text-cryo-50 mb-2">Welcome to cryowire</h1>
      <p className="text-sm text-cryo-300 mb-6">
        Connect a data repository to get started. You can use an existing repository or the
        template to create a new one.
      </p>
      <button onClick={onConnect} className="btn-primary inline-flex items-center gap-2 px-5 py-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        Connect Repository
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-cryo-400 select-none">
      <img
        src="/logo.png"
        alt="cryowire"
        className="w-20 h-20 object-contain opacity-40 mb-3"
      />
      <p className="text-sm font-medium text-cryo-300 mb-1">No cooldown selected</p>
      <p className="text-xs text-cryo-400">Choose a cooldown from the sidebar to get started</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 max-w-[1200px] animate-pulse">
      <div className="mb-4">
        <div className="h-7 bg-cryo-600/40 rounded-md w-56 mb-2" />
        <div className="flex gap-2">
          <div className="h-5 bg-cryo-600/30 rounded-full w-20" />
          <div className="h-5 bg-cryo-600/30 rounded-full w-28" />
          <div className="h-5 bg-cryo-600/30 rounded-full w-24" />
        </div>
      </div>
      <div className="flex gap-2 mb-5">
        <div className="h-8 bg-cryo-600/30 rounded-md w-24" />
        <div className="h-8 bg-cryo-600/30 rounded-md w-32" />
      </div>
      <div className="card overflow-hidden mb-5">
        <div className="h-10 bg-cryo-600/40 border-b border-cryo-500/30 flex items-center px-4">
          <div className="h-3.5 bg-cryo-500/30 rounded w-28" />
        </div>
        <div className="h-72 bg-cryo-800/50 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-cryo-600/30" />
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="h-10 bg-cryo-600/40 border-b border-cryo-500/30 flex items-center px-4">
          <div className="h-3.5 bg-cryo-500/30 rounded w-20" />
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 border-t border-cryo-500/20 flex items-center gap-4 px-3">
            <div className="h-3 bg-cryo-600/30 rounded w-24" />
            <div className="h-3 bg-cryo-600/30 rounded w-12" />
            <div className="h-3 bg-cryo-600/30 rounded w-10" />
            <div className="flex-1" />
            <div className="h-4 bg-cryo-600/20 rounded w-12" />
            <div className="h-4 bg-cryo-600/20 rounded w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
