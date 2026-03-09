"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Toast } from "@/components/ui/toast";

type Props = {
  currentUrl?: string;
  onClose?: () => void;
  onConnected: () => Promise<void>;
  dismissable?: boolean;
};

export function RepoSetupModal({ currentUrl, onClose, onConnected, dismissable = true }: Props) {
  const [url, setUrl] = useState(currentUrl ?? "");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setConnecting(true);
    try {
      const res = await fetch("/api/repo/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_url: url.trim(), token: token.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      await onConnected();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Connection failed", type: "error" });
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Modal title="Connect Repository" onClose={dismissable ? (onClose ?? (() => {})) : () => {}}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-cryo-300">
          Enter the URL of a cryowire data repository. It will be cloned to the server.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-cryo-300">Repository URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/user/cryo-data.git"
            className="input"
            required
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-cryo-300">
            GitHub Token <span className="font-normal text-cryo-400">(optional, for private repos)</span>
          </span>
          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              className="input w-full pr-9 font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-cryo-400 hover:text-cryo-200 transition"
              tabIndex={-1}
            >
              {showToken ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </label>
        <p className="text-xs text-cryo-400">
          Public repos don&apos;t need a token. For private repos, use a
          {" "}<a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">personal access token</a> with repo read access.
        </p>
        <div className="flex justify-end gap-2 mt-1 pt-3 border-t border-cryo-500/30">
          {dismissable && onClose && (
            <button type="button" onClick={onClose} className="btn">Cancel</button>
          )}
          <button type="submit" disabled={connecting || !url.trim()} className="btn-primary inline-flex items-center gap-1.5">
            {connecting ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Cloning...
              </>
            ) : (
              "Connect"
            )}
          </button>
        </div>
      </form>
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </Modal>
  );
}
