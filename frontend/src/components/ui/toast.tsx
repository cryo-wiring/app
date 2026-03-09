"use client";

import { useEffect } from "react";

type Props = {
  message: string;
  type?: "success" | "error";
  onDone: () => void;
};

export function Toast({ message, type = "success", onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm text-white animate-[slideUp_200ms_ease-out] border ${
        type === "error"
          ? "bg-red-500/20 border-red-500/40 text-red-300 backdrop-blur-sm"
          : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 backdrop-blur-sm"
      }`}
    >
      {type === "error" ? (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      {message}
    </div>
  );
}
