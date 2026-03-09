"use client";

import { useEffect } from "react";

type Props = {
  title: string;
  onClose: () => void;
  wide?: boolean;
  large?: boolean;
  children: React.ReactNode;
};

export function Modal({ title, onClose, wide, large, children }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-[fadeIn_150ms_ease-out]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative bg-cryo-700 border border-cryo-500/50 rounded-xl shadow-2xl p-6 animate-[slideUp_150ms_ease-out] ${
          large
            ? "w-[90vw] max-w-[1100px] h-[85vh] overflow-y-auto"
            : `max-h-[90vh] overflow-y-auto ${wide ? "w-[560px]" : "w-[420px]"} max-w-[90vw]`
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-cryo-50">{title}</h3>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md flex items-center justify-center text-cryo-400 hover:text-cryo-100 hover:bg-cryo-600 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
