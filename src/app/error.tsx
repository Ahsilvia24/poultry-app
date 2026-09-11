"use client";

import { useEffect } from "react";

const RELOAD_KEY = "pt-auto-reload";

export default function ErrorPage() {
  useEffect(() => {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last > 10_000) {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      window.location.reload();
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3efe6] px-4">
      <div className="text-center">
        <p className="font-serif text-xl font-extrabold tracking-tight text-emerald-900">
          PoultryTech
        </p>
        <p className="mt-3 text-sm text-stone-600">Opening Dashboard…</p>
        <button
          type="button"
          className="mt-6 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white"
          onClick={() => window.location.replace("/")}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
